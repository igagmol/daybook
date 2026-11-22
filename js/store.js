// Local storage layer. localStorage is the source of truth for instant use.
// Every key is prefixed with "daybook:v1:" because all GitHub Pages projects share one origin.
import { emptyData, normalize, live, COLLECTIONS } from './merge.js';
import { migrateRecipes } from './logic.js';

export const PREFIX = 'daybook:v1:';
export const LOCAL_NS = 'local';

const listeners = new Set();
let ns = null;
let data = emptyData();
let lastStamp = 0;
let localRev = 0;

/** Increments on every local change; lets sync know if something changed while it ran. */
export const rev = () => localRev;

export const key = (namespace, name) => `${PREFIX}${namespace}:${name}`;

function readJSON(k) {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJSON(k, value) {
  try {
    localStorage.setItem(k, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn('Daybook: could not save', err);
    return false;
  }
}

export const readGlobal = (name) => readJSON(PREFIX + name);
export const writeGlobal = (name, value) => writeJSON(PREFIX + name, value);
export const removeGlobal = (name) => {
  try { localStorage.removeItem(PREFIX + name); } catch { /* ignore */ }
};

export function stamp() {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return lastStamp;
}

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Open (load) the data of one namespace: "local" or a Google account "sub". */
export function open(namespace) {
  ns = namespace;
  data = normalize(readJSON(key(ns, 'data')));
  if (migrateRecipes(data, stamp)) persist('local');
  emit('open');
}

export const namespace = () => ns;
export const getData = () => data;
export const readDataOf = (namespace) => normalize(readJSON(key(namespace, 'data')));
export const hasDataIn = (namespace) => {
  const d = readDataOf(namespace);
  return COLLECTIONS.some((c) => d[c].length > 0) || d.note.updatedAt > 0;
};

export function getMeta(namespace = ns) {
  return readJSON(key(namespace, 'meta')) || {};
}

export function setMeta(patch, namespace = ns) {
  const meta = { ...getMeta(namespace), ...patch };
  writeJSON(key(namespace, 'meta'), meta);
  return meta;
}

function persist(source) {
  writeJSON(key(ns, 'data'), data);
  if (source === 'local') {
    localRev++;
    setMeta({ dirty: true });
  }
  emit(source);
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(source) {
  for (const fn of listeners) fn(source);
}

export function list(collection) {
  return live(data[collection]);
}

export function find(collection, id) {
  return data[collection].find((it) => it.id === id && !it.deletedAt) || null;
}

export function add(collection, fields) {
  const t = stamp();
  const item = { id: uuid(), createdAt: t, updatedAt: t, ...fields };
  data[collection].push(item);
  persist('local');
  return item;
}

/** Create or revive an item with a fixed id (used for the ingredient catalog). */
export function put(collection, id, fields) {
  const item = data[collection].find((it) => it.id === id);
  if (item && !item.deletedAt) return item;
  const t = stamp();
  if (item) {
    delete item.deletedAt;
    Object.assign(item, fields, { updatedAt: t });
  } else {
    data[collection].push({ id, createdAt: t, updatedAt: t, ...fields });
  }
  persist('local');
  return find(collection, id);
}

/** Create (or revive) an item with a fixed id, or update it. One change, one sync. */
export function upsert(collection, id, fields) {
  const t = stamp();
  const item = data[collection].find((it) => it.id === id);
  if (item) {
    delete item.deletedAt;
    Object.assign(item, fields, { updatedAt: t });
  } else {
    data[collection].push({ id, createdAt: t, updatedAt: t, ...fields });
  }
  persist('local');
  return find(collection, id);
}

export function update(collection, id, fields) {
  const item = data[collection].find((it) => it.id === id);
  if (!item) return null;
  Object.assign(item, fields, { updatedAt: stamp() });
  persist('local');
  return item;
}

/** Delete = tombstone. Nothing is ever removed from storage by a delete. */
export function remove(collection, ids) {
  const set = new Set(Array.isArray(ids) ? ids : [ids]);
  const t = stamp();
  for (const item of data[collection]) {
    if (set.has(item.id) && !item.deletedAt) {
      item.deletedAt = t;
      item.updatedAt = t;
    }
  }
  persist('local');
}

export function setNote(text) {
  if (data.note.text === text) return;
  data.note = { text, updatedAt: stamp() };
  persist('local');
}

/** Replace everything with merged data. `source` is "sync" or "local" (import). */
export function replaceData(next, source = 'sync') {
  data = normalize(structuredClone(next));
  // Recipes in the old notes format can arrive from another device: migrate and upload them.
  persist(migrateRecipes(data, stamp) ? 'local' : source);
}
