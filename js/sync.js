// Google Drive sync. Folder "Daily App" in My Drive, one file "daily-app-data.json" inside it.
// Scope drive.file: the app only sees files and folders it created itself.
import * as store from './store.js';
import { mergeData, sameData, normalize } from './merge.js';
import { getToken, expireToken, authEnabled, getAccount } from './auth.js';

export const FOLDER_NAME = 'Daily App';
export const FILE_NAME = 'daily-app-data.json';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

// status: 'idle' | 'syncing' | 'synced' | 'paused' | 'offline' | 'error'
let state = { status: 'idle', lastSyncAt: 0 };
const listeners = new Set();
let running = null;
let again = false;
let debounceTimer = null;
let backoffTimer = null;
let backoffMs = 0;

export const getState = () => state;
export function onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function setState(patch) {
  state = { ...state, ...patch };
  for (const fn of listeners) fn(state);
}

export function init() {
  const meta = store.getMeta();
  setState({ status: getToken() ? 'idle' : 'paused', lastSyncAt: meta.lastSyncAt || 0 });
}

export function hasUnsynced() {
  return Boolean(store.getMeta().dirty);
}

/** Debounced sync about 3 s after a local change. */
export function scheduleSync(delay = 3000) {
  if (!authEnabled() || !getAccount()) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => syncNow(), delay);
}

class HttpError extends Error {
  constructor(status, text) { super(`HTTP ${status} ${text || ''}`); this.status = status; }
}

async function api(url, opts = {}) {
  const t = getToken();
  if (!t) throw new HttpError(401, 'no token');
  let res;
  try {
    res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${t}`, ...(opts.headers || {}) } });
  } catch (err) {
    err.offline = true;
    throw err;
  }
  if (!res.ok) throw new HttpError(res.status, await res.text().catch(() => ''));
  return res;
}

const q = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function listFiles(query) {
  const params = new URLSearchParams({
    q: query,
    fields: 'files(id,name,createdTime,trashed)',
    orderBy: 'createdTime',
    spaces: 'drive',
    pageSize: '100',
  });
  const res = await api(`${API}/files?${params}`);
  const { files = [] } = await res.json();
  // Oldest first; never delete or touch the others.
  return files.sort((a, b) => (a.createdTime < b.createdTime ? -1 : a.createdTime > b.createdTime ? 1 : 0));
}

async function isAlive(id) {
  try {
    const res = await api(`${API}/files/${encodeURIComponent(id)}?fields=id,trashed`);
    const f = await res.json();
    return !f.trashed;
  } catch (err) {
    if (err.status === 404) return false;
    throw err;
  }
}

async function ensureFolder(meta) {
  if (meta.folderId && (await isAlive(meta.folderId))) return meta.folderId;
  const found = await listFiles(`name='${q(FOLDER_NAME)}' and mimeType='${FOLDER_MIME}' and trashed=false`);
  if (found.length) return found[0].id;
  const res = await api(`${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME, parents: ['root'] }),
  });
  return (await res.json()).id;
}

async function findFile(meta, folderId) {
  if (meta.fileId && meta.folderId === folderId && (await isAlive(meta.fileId))) return meta.fileId;
  const found = await listFiles(`name='${q(FILE_NAME)}' and '${q(folderId)}' in parents and trashed=false`);
  return found.length ? found[0].id : null;
}

async function download(fileId) {
  const res = await api(`${API}/files/${encodeURIComponent(fileId)}?alt=media`);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return null; }
}

async function createFile(folderId, data) {
  const boundary = `daybook${Date.now()}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: FILE_NAME, parents: [folderId], mimeType: 'application/json' }) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    JSON.stringify(data) +
    `\r\n--${boundary}--`;
  const res = await api(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return (await res.json()).id;
}

async function uploadFile(fileId, data) {
  await api(`${UPLOAD}/files/${encodeURIComponent(fileId)}?uploadType=media`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

async function runSync() {
  const ns = store.namespace();
  const startRev = store.rev();
  const meta = store.getMeta(ns);
  const folderId = await ensureFolder(meta);
  let fileId = await findFile(meta, folderId);
  let remote = null;
  if (fileId) remote = await download(fileId);
  if (store.namespace() !== ns) return; // account switched mid-sync

  // Merge with the latest local data (a missing remote never empties local data).
  const merged = mergeData(store.getData(), remote || {});
  if (!sameData(merged, store.getData())) store.replaceData(merged, 'sync');

  if (!fileId) fileId = await createFile(folderId, merged);
  else if (!remote || !sameData(merged, normalize(remote))) await uploadFile(fileId, merged);

  const patch = { folderId, fileId, lastSyncAt: Date.now() };
  if (store.rev() === startRev) patch.dirty = false;
  store.setMeta(patch, ns);
  return store.rev() !== startRev;
}

/** Run a sync now. Resolves to true on success. Never throws. */
export async function syncNow() {
  if (!authEnabled() || !getAccount()) return false;
  clearTimeout(debounceTimer);
  if (running) { again = true; return running; }
  if (!getToken()) { setState({ status: 'paused' }); return false; }
  if (navigator.onLine === false) { setState({ status: 'offline' }); return false; }
  setState({ status: 'syncing' });
  running = (async () => {
    try {
      const changedMeanwhile = await runSync();
      backoffMs = 0;
      setState({ status: 'synced', lastSyncAt: Date.now() });
      if (changedMeanwhile) again = true;
      return true;
    } catch (err) {
      if (err.status === 401) {
        expireToken();
        setState({ status: 'paused' });
      } else if (err.status === 403 || err.status === 429 || err.status >= 500) {
        backoffMs = Math.min(backoffMs ? backoffMs * 2 : 5000, 5 * 60_000);
        clearTimeout(backoffTimer);
        backoffTimer = setTimeout(() => syncNow(), backoffMs + Math.random() * 1000);
        setState({ status: 'error' });
      } else if (err.offline || navigator.onLine === false) {
        setState({ status: 'offline' });
      } else {
        console.warn('Daybook sync failed', err);
        setState({ status: 'error' });
      }
      return false;
    } finally {
      running = null;
      if (again) { again = false; scheduleSync(500); }
    }
  })();
  return running;
}

window.addEventListener('online', () => scheduleSync(500));
window.addEventListener('offline', () => { if (authEnabled() && getAccount()) setState({ status: 'offline' }); });
