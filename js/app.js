// Daybook entry point. First render happens synchronously from localStorage.
import { VERSION } from '../config.js';
import * as store from './store.js';
import * as sync from './sync.js';
import * as auth from './auth.js';
import { mergeData } from './merge.js';
import { todayStr } from './dates.js';
import { el, icon, googleG, watchViewport, closeAllSheets, closeOpenRow, confirmSheet, showToast, hideToast } from './ui.js';
import { createShopping } from './sections/shopping.js';
import { createMeals } from './sections/meals.js';
import { createMoney } from './sections/money.js';
import { createEvents } from './sections/events.js';
import { createTasks } from './sections/tasks.js';
import { createNotes } from './sections/notes.js';
import { openAccountSheet } from './sections/account.js';

let today = todayStr();
const ctx = { today: () => today };

const TILES = [
  ['shopping', 'Shopping', 'cart'],
  ['meals', 'Meals', 'tomato'],
  ['money', 'Money', 'dollar'],
  ['events', 'Events', 'calendar'],
  ['tasks', 'Tasks', 'check'],
  ['notes', 'Notes', 'pencil'],
];

const app = document.getElementById('app');
const sections = [createShopping(), createMeals(ctx), createMoney(), createEvents(ctx), createTasks(ctx), createNotes()];
const panels = new Map();
let openPanelId = null;

/* ---------- Layout ---------- */

function buildHome() {
  const grid = el('nav', { class: 'tiles', 'aria-label': 'Sections' },
    TILES.map(([id, label, ic], i) =>
      el('button', { type: 'button', class: `tile tile-${i + 1}`, onclick: () => openPanel(id) },
        [el('span', { class: 'tile-icon' }, [icon(ic, 56)]), el('span', { class: 'tile-label', text: label })])));
  const bar = el('div', { class: 'home-bar' }, [
    el('button', { type: 'button', class: 'icon-btn account-btn', 'aria-label': 'Account', onclick: openAccount }, [icon('user', 26)]),
  ]);
  return el('main', { class: 'home', id: 'home' }, [grid, bar]);
}

function buildPanel(sec) {
  const back = el('button', { type: 'button', class: 'icon-btn back-btn', 'aria-label': 'Back', onclick: closePanel }, [icon('back', 26)]);
  const header = el('header', { class: 'panel-header' }, [back, el('h1', { class: 'panel-title', text: sec.title })]);
  const panel = el('section', {
    class: `panel ${sec.className || ''}`,
    id: `p-${sec.id}`,
    'aria-label': sec.title,
    inert: true,
    'aria-hidden': 'true',
  }, [
    header,
    sec.top ? el('div', { class: 'panel-top' }, sec.top) : null,
    el('div', { class: 'panel-body' }, sec.body),
    sec.footer ? el('div', { class: 'panel-footer' }, sec.footer) : null,
  ]);
  panels.set(sec.id, panel);
  return panel;
}

function openPanel(id) {
  const panel = panels.get(id);
  if (!panel) return;
  openPanelId = id;
  sections.find((s) => s.id === id)?.render();
  panel.inert = false;
  panel.removeAttribute('aria-hidden');
  panel.classList.add('open');
  const home = document.getElementById('home');
  home.inert = true;
  home.setAttribute('aria-hidden', 'true');
  panel.querySelector('.back-btn').focus({ preventScroll: true });
}

function closePanel() {
  if (!openPanelId) return;
  const id = openPanelId;
  const panel = panels.get(id);
  sections.find((s) => s.id === id)?.flush?.();
  closeOpenRow();
  panel.classList.remove('open');
  panel.inert = true;
  panel.setAttribute('aria-hidden', 'true');
  openPanelId = null;
  const home = document.getElementById('home');
  home.inert = false;
  home.removeAttribute('aria-hidden');
  home.querySelector(`.tile-${TILES.findIndex((t) => t[0] === id) + 1}`)?.focus({ preventScroll: true });
}

function renderAll() {
  for (const s of sections) s.render();
}

/* ---------- Sign-in screen ---------- */

function buildSignIn() {
  const err = el('p', { class: 'signin-error', role: 'alert' });
  const btn = el('button', { type: 'button', class: 'gsi-btn' }, [
    el('span', { class: 'gsi-icon' }, [googleG()]),
    el('span', { class: 'gsi-text', text: 'Sign in with Google' }),
  ]);
  btn.addEventListener('click', async () => {
    err.textContent = '';
    btn.disabled = true;
    try {
      const profile = await auth.signInInteractive();
      completeSignIn(profile);
    } catch (e) {
      console.warn('Sign-in failed', e);
      err.textContent = 'Sign-in didn’t complete. Please try again.';
    } finally {
      btn.disabled = false;
    }
  });
  const logo = el('div', { class: 'signin-logo', 'aria-hidden': 'true' }, [icon('list', 40)]);
  return el('main', { class: 'signin', id: 'signin', hidden: true }, [
    el('div', { class: 'signin-inner' }, [logo, el('h1', { class: 'signin-title', text: 'Daybook' }), btn, err]),
  ]);
}

function showSignIn(show) {
  document.getElementById('signin').hidden = !show;
  document.getElementById('shell').hidden = show;
}

/** Open an account's data. Adopts local-profile data on the first sign-in on this device. */
function completeSignIn(profile) {
  auth.rememberAccount(profile);
  if (!store.readGlobal('local-adopted') && store.hasDataIn(store.LOCAL_NS)) {
    const merged = mergeData(store.readDataOf(profile.sub), store.readDataOf(store.LOCAL_NS));
    store.open(profile.sub);
    store.replaceData(merged, 'local');
    store.writeGlobal('local-adopted', { sub: profile.sub, at: Date.now() });
  } else {
    store.open(profile.sub);
  }
  sync.init();
  showSignIn(false);
  renderAll();
  sync.syncNow();
}

async function reconnect() {
  const acc = auth.getAccount();
  try {
    const profile = await auth.signInInteractive({ hint: acc?.email });
    if (!acc || profile.sub !== acc.sub) {
      closeAllSheets();
      completeSignIn(profile);
    } else {
      auth.rememberAccount(profile);
      sync.syncNow();
    }
  } catch (e) {
    console.warn('Reconnect failed', e);
  }
}

async function signOut(sheet) {
  if (auth.getToken()) await sync.syncNow();
  if (sync.hasUnsynced()) {
    const ok = await confirmSheet({
      title: 'Sign out?',
      message: 'Some changes haven’t been synced to Google Drive yet. They stay on this device and will sync the next time you sign in with this account.',
      confirmLabel: 'Sign out',
    });
    if (!ok) return;
  }
  sheet?.close();
  closeAllSheets();
  closePanel();
  auth.forgetAccount();
  store.open('signed-out'); // empty, never persisted: nothing is written unless edited
  showSignIn(true);
}

/* ---------- Account sheet ---------- */

function openAccount() {
  openAccountSheet({ reconnect, signOut, checkForUpdates });
}

/* ---------- Service worker / updates ---------- */

let registration = null;

function promptUpdate(worker) {
  showToast('Update available', 'Reload', () => {
    hideToast();
    worker.postMessage({ type: 'SKIP_WAITING' });
  });
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  let reloading = false;
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // First install claims the page: no reload needed. Only reload for updates.
    if (reloading || !hadController) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    registration = reg;
    if (reg.waiting && navigator.serviceWorker.controller) promptUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(w);
      });
    });
  }).catch((e) => console.warn('SW registration failed', e));
}

async function checkForUpdates() {
  if (!registration) return 'Updates are not available here.';
  try {
    await registration.update();
  } catch {
    return 'Couldn’t check. Are you online?';
  }
  const w = registration.waiting || registration.installing;
  if (w) {
    if (registration.waiting) promptUpdate(registration.waiting);
    return 'Update available.';
  }
  return `You’re up to date (version ${VERSION}).`;
}

/* ---------- Boot ---------- */

function boot() {
  watchViewport();
  const shell = el('div', { id: 'shell' }, [buildHome(), ...sections.map(buildPanel)]);
  app.replaceChildren(buildSignIn(), shell);

  store.onChange((source) => {
    renderAll();
    if (source === 'local') sync.scheduleSync();
  });

  let redirected = false;
  if (!auth.authEnabled()) {
    store.open(store.LOCAL_NS);
  } else {
    redirected = auth.consumeRedirect();
    const acc = auth.getAccount();
    if (acc) {
      store.open(acc.sub);
      sync.init();
    } else {
      store.open('signed-out');
      showSignIn(true);
    }
  }
  renderAll();

  // Everything below runs after the first paint.
  requestAnimationFrame(() => setTimeout(() => afterPaint(redirected), 0));
}

async function afterPaint(redirected) {
  registerSW();
  window.addEventListener('pointerdown', () => navigator.storage?.persist?.().catch(() => {}), { once: true });
  if (!auth.authEnabled()) return;
  auth.loadGis().catch(() => {});
  const acc = auth.getAccount();
  if (redirected) {
    try {
      const profile = await auth.fetchProfile();
      if (!acc || acc.sub !== profile.sub) { completeSignIn(profile); return; }
      auth.rememberAccount(profile);
    } catch (e) {
      console.warn('Profile fetch failed', e);
    }
  }
  if (!acc) return;
  if (!auth.getToken()) await auth.silentRefresh();
  sync.init();
  sync.syncNow();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const t = todayStr();
  if (t !== today) { today = t; renderAll(); }
  if (auth.authEnabled() && auth.getAccount()) sync.syncNow();
});

boot();
