// Daybook entry point. First render happens synchronously from localStorage.
import { VERSION } from '../config.js';
import * as store from './store.js';
import * as sync from './sync.js';
import * as auth from './auth.js';
import { mergeData } from './merge.js';
import { todayStr } from './dates.js';
import { eventAlert, pastEventIds, checkinId, WATER_GLASSES, formatMinutes } from './logic.js';
import { el, icon, googleG, watchViewport, closeAllSheets, closeOpenRow, confirmSheet, showToast, hideToast } from './ui.js';
import { createShopping } from './sections/shopping.js';
import { createMeals } from './sections/meals.js';
import { createEvents } from './sections/events.js';
import { createTasks } from './sections/tasks.js';
import { createNotes } from './sections/notes.js';
import { createHabits, habitsLevel } from './sections/daily.js';
import { createWaste, wasteToday } from './sections/waste.js';
import { openAccountSheet } from './sections/account.js';

let today = todayStr();
const ctx = { today: () => today };

const TILES = [
  ['shopping', 'Shopping', 'cart'],
  ['meals', 'Meals', 'tomato'],
  ['tasks', 'Tasks', 'check'],
  ['events', 'Events', 'calendar'],
  ['waste', 'Waste', 'trash'],
  ['habits', 'Habits', 'smile'],
  ['water', 'Water', null],
  ['notes', 'Notes', 'pencil'],
];

const app = document.getElementById('app');
const sections = [
  createShopping(), createMeals(ctx), createTasks(ctx), createEvents(ctx),
  createWaste(ctx),
  createHabits(ctx),
  createNotes(),
];
const panels = new Map();
let openPanelId = null;

/* ---------- Layout ---------- */

function buildHome() {
  const grid = el('nav', { class: 'tiles', 'aria-label': 'Sections' },
    TILES.map(([id, label, ic], i) => id === 'water' ? buildWaterTile(i) :
      el('button', { type: 'button', class: `tile tile-${i + 1} tile-${id}`, 'data-id': id, onclick: () => openPanel(id) },
        [
          el('span', { class: 'tile-icon' }, [icon(ic, 56)]),
          el('span', { class: 'tile-label', text: label }),
          id === 'events' ? el('span', { class: 'tile-dot', id: 'events-dot', hidden: true, 'aria-hidden': 'true' }) : null,
          id === 'waste' ? el('span', { class: 'tile-sub', id: 'waste-sub', hidden: true }) : null,
        ])));
  const bar = el('div', { class: 'home-bar' }, [
    el('button', { type: 'button', class: 'icon-btn account-btn', 'aria-label': 'Account', onclick: openAccount }, [icon('user', 26)]),
  ]);
  return el('main', { class: 'home', id: 'home' }, [grid, bar]);
}

/* ---------- Water ---------- */

// Looks like a section but opens nothing: each tap is one glass, 5 glasses fill the bottle.
// One synced check-in per day ("water:YYYY-MM-DD"), so the bottle is empty again every morning.
// A long press takes one glass back (for a tap by mistake).
const SVG_NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs) => {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
const BOTTLE = 'M9.5 2.5h5v3c0 .8.6 1.3 1.3 1.9 1 .8 1.7 2 1.7 3.6v9.2a1.8 1.8 0 0 1-1.8 1.8H8.3a1.8 1.8 0 0 1-1.8-1.8V11c0-1.6.7-2.8 1.7-3.6.7-.6 1.3-1.1 1.3-1.9z';
const BOTTLE_TOP = 9; // where the water can start (y), bottom is 22
const BOTTLE_BOTTOM = 22;

function waterCount() {
  return Math.min(Number(store.find('checkins', checkinId('water', today))?.count) || 0, WATER_GLASSES);
}

function setWater(n) {
  store.upsert('checkins', checkinId('water', today), { kind: 'water', date: today, count: n });
}

function buildBottle() {
  const svg = svgEl('svg', { viewBox: '0 0 24 24', class: 'bottle', 'aria-hidden': 'true', focusable: 'false' });
  const clipId = 'bottle-clip';
  const clip = svgEl('clipPath', { id: clipId });
  clip.append(svgEl('path', { d: BOTTLE }));
  const water = svgEl('rect', { class: 'bottle-water', x: '0', width: '24', y: String(BOTTLE_BOTTOM), height: '0', 'clip-path': `url(#${clipId})` });
  const lines = svgEl('g', { class: 'bottle-lines' });
  for (let i = 1; i < WATER_GLASSES; i++) {
    const y = BOTTLE_BOTTOM - ((BOTTLE_BOTTOM - BOTTLE_TOP) * i) / WATER_GLASSES;
    lines.append(svgEl('path', { d: `M6.5 ${y}h1.6M15.9 ${y}h1.6` }));
  }
  const outline = svgEl('path', { class: 'bottle-outline', d: BOTTLE });
  const cap = svgEl('path', { class: 'bottle-outline', d: 'M9 2.5h6' });
  const defs = svgEl('defs', {});
  defs.append(clip);
  svg.append(defs, water, lines, outline, cap);
  return { svg, water };
}

function buildWaterTile(i) {
  const { svg, water } = buildBottle();
  const count = el('span', { class: 'tile-sub water-count' });
  const tile = el('button', { type: 'button', class: `tile tile-${i + 1} tile-water`, 'data-id': 'water' }, [
    el('span', { class: 'tile-icon' }, [svg]),
    el('span', { class: 'tile-label', text: 'Water' }),
    count,
  ]);
  tile._paint = () => {
    const n = waterCount();
    const h = ((BOTTLE_BOTTOM - BOTTLE_TOP) * n) / WATER_GLASSES;
    water.setAttribute('y', String(BOTTLE_BOTTOM - h));
    water.setAttribute('height', String(h));
    tile.dataset.level = n >= WATER_GLASSES ? 'full' : String(n);
    count.textContent = `${n}/${WATER_GLASSES}`;
    tile.setAttribute('aria-label', `Water, ${n} of ${WATER_GLASSES} glasses today. Tap to add a glass, long press to take one back.`);
  };
  let holdTimer = null;
  let held = false;
  const cancelHold = () => { clearTimeout(holdTimer); holdTimer = null; };
  tile.addEventListener('pointerdown', () => {
    held = false;
    cancelHold();
    holdTimer = setTimeout(() => {
      held = true;
      const n = waterCount();
      if (n > 0) { setWater(n - 1); flashToast('One glass taken back'); }
    }, 550);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) tile.addEventListener(ev, cancelHold);
  tile.addEventListener('contextmenu', (e) => e.preventDefault());
  tile.addEventListener('click', () => {
    if (held) { held = false; return; }
    const n = waterCount();
    if (n >= WATER_GLASSES) return;
    setWater(n + 1);
    svg.classList.remove('pop');
    void svg.offsetWidth; // restart the animation
    svg.classList.add('pop');
    if (n + 1 === WATER_GLASSES) flashToast('Bottle full, well done!');
  });
  return tile;
}

let toastTimer = null;
function flashToast(text) {
  clearTimeout(toastTimer);
  showToast(text);
  toastTimer = setTimeout(hideToast, 2000);
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
  renderEventDot();
  renderDailyTiles();
}

/**
 * Habits tile: grey until a Done today, then yellow (1 press), green (2), stronger green (3)
 * and bright green (4: three Habit + one Language). Presses of both buttons add up.
 */
function renderDailyTiles() {
  const habits = document.querySelector('.tile-habits');
  if (habits) {
    const n = habitsLevel(today);
    habits.dataset.level = String(n);
    habits.setAttribute('aria-label', `Habits${n ? `, done ${n} of 4 today` : ', not done today'}`);
  }
  const sub = document.getElementById('waste-sub');
  if (sub) {
    const m = wasteToday(today);
    sub.hidden = !m;
    sub.textContent = m ? formatMinutes(m) : '';
    sub.closest('.tile').setAttribute('aria-label', `Waste${m ? `, ${formatMinutes(m)} today` : ''}`);
  }
  document.querySelector('.tile-water')?._paint();
}

/** Red dot on the Events tile for an event today, yellow for tomorrow or the day after. */
function renderEventDot() {
  const dot = document.getElementById('events-dot');
  if (!dot) return;
  const level = eventAlert(store.list('events'), today);
  dot.hidden = !level;
  dot.className = `tile-dot${level ? ` tile-dot-${level}` : ''}`;
  const tile = dot.closest('.tile');
  const note = level === 'red' ? ', event today' : level === 'yellow' ? ', event soon' : '';
  tile.setAttribute('aria-label', `Events${note}`);
}

/** Events whose day has passed are deleted automatically. */
function purgePastEvents() {
  const ids = pastEventIds(store.list('events'), today);
  if (ids.length) store.remove('events', ids);
}

/** Pick up a new day (app left open past midnight, or reopened). */
function checkDay() {
  const t = todayStr();
  if (t !== today) { today = t; purgePastEvents(); renderAll(); }
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
  purgePastEvents();
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
    // Events from another device may already be in the past.
    if (source === 'sync' && pastEventIds(store.list('events'), today).length) { purgePastEvents(); return; }
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
  purgePastEvents();
  renderAll();
  setInterval(checkDay, 60_000);

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
  checkDay();
  if (auth.authEnabled() && auth.getAccount()) sync.syncNow();
});

boot();
