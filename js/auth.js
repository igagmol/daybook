// Google sign-in. Primary path: Google Identity Services token client (popup).
// Fallback: OAuth 2.0 redirect (implicit) flow, used when the popup cannot open or,
// inside an iOS home-screen app, when the popup closes without returning a token.
// Access tokens are kept in memory only.
import { GOOGLE_CLIENT_ID } from '../config.js';
import { readGlobal, writeGlobal, removeGlobal } from './store.js';

export const SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.file';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

let token = null; // { value, expiresAt }
let gisPromise = null;
let tokenClient = null;
let pending = null;

export const authEnabled = () => Boolean(GOOGLE_CLIENT_ID);
export const isStandalone = () =>
  window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

export function getToken() {
  if (token && token.expiresAt - 60_000 > Date.now()) return token.value;
  return null;
}

export function expireToken() {
  token = null;
}

function setToken(value, expiresIn) {
  token = { value, expiresAt: Date.now() + (Number(expiresIn) || 3600) * 1000 };
}

/* ---------- Remembered account ---------- */

export const getAccount = () => readGlobal('account');
export const rememberAccount = (acc) => writeGlobal('account', acc);
export const forgetAccount = () => { removeGlobal('account'); token = null; };

/* ---------- GIS loading (lazy, after first paint) ---------- */

export function loadGis() {
  if (!authEnabled()) return Promise.reject(new Error('no-client-id'));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => { gisPromise = null; reject(new Error('gis-load-failed')); };
    document.head.append(s);
  });
  return gisPromise;
}

function getTokenClient() {
  if (tokenClient) return tokenClient;
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPES,
    include_granted_scopes: true,
    callback: (resp) => {
      const p = pending; pending = null;
      if (!p) return;
      if (resp.error || !resp.access_token) p.reject(Object.assign(new Error(resp.error || 'no-token'), { type: resp.error }));
      else {
        setToken(resp.access_token, resp.expires_in);
        p.resolve(resp.access_token);
      }
    },
    error_callback: (err) => {
      const p = pending; pending = null;
      p?.reject(Object.assign(new Error(err?.type || 'popup-error'), { type: err?.type }));
    },
  });
  return tokenClient;
}

/** Request a token through the GIS popup. `prompt: ''` tries a silent refresh. */
function popupToken({ prompt, hint }) {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) { reject(Object.assign(new Error('gis-not-loaded'), { type: 'gis-not-loaded' })); return; }
    pending?.reject(new Error('superseded'));
    pending = { resolve, reject };
    const opts = { prompt };
    if (hint) opts.login_hint = hint;
    getTokenClient().requestAccessToken(opts);
  });
}

/** Silent refresh, run after first paint. Never throws; returns true on success. */
export async function silentRefresh() {
  const acc = getAccount();
  if (!acc) return false;
  try {
    await loadGis();
    await withTimeout(popupToken({ prompt: '', hint: acc.email }), 15000);
    return true;
  } catch {
    return false;
  }
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

/**
 * Interactive sign-in. Must be called from a user gesture (tap).
 * Resolves with the account profile, or redirects the page (fallback) and never resolves.
 */
export async function signInInteractive({ hint } = {}) {
  // GIS must already be loaded so the popup opens inside the tap (iOS blocks it otherwise).
  if (!window.google?.accounts?.oauth2) {
    loadGis().catch(() => {});
    redirectSignIn(hint);
    return new Promise(() => {});
  }
  try {
    await popupToken({ prompt: hint ? '' : 'select_account', hint });
  } catch (err) {
    const t = err.type || err.message;
    const fallback = t === 'popup_failed_to_open' || (t === 'popup_closed' && isStandalone());
    if (fallback) {
      redirectSignIn(hint);
      return new Promise(() => {});
    }
    throw err;
  }
  return fetchProfile();
}

/* ---------- Redirect fallback (OAuth 2.0 implicit flow endpoint) ---------- */

export function redirectUri() {
  // The app root, e.g. https://igagmol.github.io/daybook/
  return new URL('./', location.href).href.split('#')[0].split('?')[0];
}

function redirectSignIn(hint) {
  const state = crypto.getRandomValues(new Uint32Array(4)).join('-');
  writeGlobal('oauth-state', { state, at: Date.now() });
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'token',
    scope: SCOPES,
    include_granted_scopes: 'true',
    state,
  });
  if (hint) params.set('login_hint', hint);
  else params.set('prompt', 'select_account');
  location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

/**
 * On startup, pick up a token returned in the URL fragment by the redirect flow.
 * Returns true when a token was found. Cleans the URL either way.
 */
export function consumeRedirect() {
  if (!location.hash || !/(access_token|error)=/.test(location.hash)) return false;
  const params = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, '', location.pathname + location.search);
  const saved = readGlobal('oauth-state');
  removeGlobal('oauth-state');
  if (!saved || saved.state !== params.get('state')) return false;
  const value = params.get('access_token');
  if (!value) return false;
  setToken(value, params.get('expires_in'));
  return true;
}

/* ---------- Profile ---------- */

export async function fetchProfile() {
  const t = getToken();
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${t}` },
  });
  if (!res.ok) throw Object.assign(new Error(`userinfo ${res.status}`), { status: res.status });
  const p = await res.json();
  return { sub: p.sub, email: p.email || '', name: p.name || p.email || '', picture: p.picture || '' };
}
