import * as store from '../store.js';
import * as sync from '../sync.js';
import { el, icon, openSheet, confirmSheet } from '../ui.js';
import { authEnabled, getAccount } from '../auth.js';
import { mergeData, normalize, COLLECTIONS } from '../merge.js';
import { VERSION } from '../../config.js';

function relTime(ms) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function statusText(st) {
  switch (st.status) {
    case 'syncing': return 'Syncing…';
    case 'paused': return 'Sync paused';
    case 'offline': return 'Offline';
    case 'error': return 'Couldn’t sync, will retry';
    default: return st.lastSyncAt ? `Synced ${relTime(st.lastSyncAt)}` : 'Not synced yet';
  }
}

/**
 * ctx: { reconnect(), signOut(), checkForUpdates() -> Promise<string> }
 */
export function openAccountSheet(ctx) {
  const acc = authEnabled() ? getAccount() : null;

  const avatar = el('div', { class: 'avatar', 'aria-hidden': 'true' });
  if (acc?.picture) {
    const img = el('img', { alt: '', src: acc.picture, referrerpolicy: 'no-referrer', width: '56', height: '56' });
    img.addEventListener('error', () => { img.remove(); avatar.append(icon('user', 28)); });
    avatar.append(img);
  } else {
    avatar.append(icon('user', 28));
  }
  const who = el('div', { class: 'who' }, acc
    ? [el('p', { class: 'who-name', text: acc.name }), el('p', { class: 'who-email', text: acc.email })]
    : [el('p', { class: 'who-name', text: 'Local profile' })]);

  const parts = [el('div', { class: 'account-head' }, [avatar, who])];

  let offStatus = null;
  if (acc) {
    const statusEl = el('p', { class: 'sync-status', 'aria-live': 'polite' });
    const syncBtn = el('button', { type: 'button', class: 'btn btn-secondary' });
    const drawStatus = (st) => {
      statusEl.textContent = statusText(st);
      statusEl.classList.toggle('is-paused', st.status === 'paused');
      const paused = st.status === 'paused';
      syncBtn.textContent = paused ? 'Reconnect' : 'Sync now';
      syncBtn.disabled = st.status === 'syncing';
    };
    syncBtn.addEventListener('click', () => {
      if (sync.getState().status === 'paused') ctx.reconnect();
      else sync.syncNow();
    });
    drawStatus(sync.getState());
    offStatus = sync.onStatus(drawStatus);
    parts.push(el('div', { class: 'account-row' }, [statusEl, syncBtn]));
  }

  // Export / import
  const exportOut = el('div', { class: 'export-out' });
  const exportBtn = el('button', {
    type: 'button', class: 'btn btn-secondary btn-block', text: 'Export backup',
    onclick: async () => {
      const json = JSON.stringify(store.getData(), null, 2);
      const area = el('textarea', { class: 'input textarea mono', readonly: true, rows: '6', 'aria-label': 'Backup JSON' });
      area.value = json;
      const msg = el('p', { class: 'field-hint', role: 'status' });
      exportOut.replaceChildren(msg, area);
      try {
        await navigator.clipboard.writeText(json);
        msg.textContent = 'Copied to clipboard.';
      } catch {
        msg.textContent = 'Select the text below and copy it.';
        area.focus();
        area.select();
      }
    },
  });
  const importBtn = el('button', { type: 'button', class: 'btn btn-secondary btn-block', text: 'Import backup', onclick: openImport });
  parts.push(el('div', { class: 'account-block' }, [exportBtn, exportOut, importBtn]));

  // Version + updates
  const updMsg = el('p', { class: 'field-hint', role: 'status' });
  parts.push(el('div', { class: 'account-row' }, [
    el('p', { class: 'version', text: `Version ${VERSION}` }),
    el('button', {
      type: 'button', class: 'btn btn-secondary', text: 'Check for updates',
      onclick: async () => { updMsg.textContent = 'Checking…'; updMsg.textContent = await ctx.checkForUpdates(); },
    }),
  ]), updMsg);

  if (acc) {
    parts.push(el('button', {
      type: 'button', class: 'btn btn-danger btn-block', text: 'Sign out',
      onclick: () => ctx.signOut(sheet),
    }));
  }

  const sheet = openSheet({ title: 'Account', content: parts, onClose: () => offStatus?.() });
  sheet.el.classList.add('sheet-tall');
  return sheet;
}

function openImport() {
  const area = el('textarea', { class: 'input textarea mono', rows: '8', 'aria-label': 'Backup JSON', placeholder: 'Paste your backup here' });
  const error = el('p', { class: 'field-error', role: 'alert' });
  const btn = el('button', { type: 'submit', class: 'btn btn-primary btn-block', text: 'Import' });
  const form = el('form', { class: 'sheet-form' }, [area, error, btn]);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let parsed;
    try { parsed = JSON.parse(area.value); } catch { error.textContent = 'This is not a valid backup.'; return; }
    if (!parsed || typeof parsed !== 'object' || !COLLECTIONS.some((c) => Array.isArray(parsed[c])) && !parsed.note) {
      error.textContent = 'This is not a valid backup.';
      return;
    }
    const ok = await confirmSheet({
      title: 'Import backup?',
      message: 'The backup will be merged into your current data. Nothing will be deleted.',
      confirmLabel: 'Import',
      danger: false,
    });
    if (!ok) return;
    // Importing never deletes: tombstones in the backup are ignored.
    const incoming = normalize(parsed);
    for (const c of COLLECTIONS) incoming[c] = incoming[c].filter((it) => !it.deletedAt);
    store.replaceData(mergeData(store.getData(), incoming), 'local');
    sheet.close();
  });
  const sheet = openSheet({ title: 'Import backup', content: form, focus: area });
}
