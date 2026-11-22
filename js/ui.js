// Small DOM toolkit: element builder, icons, bottom sheets, swipe-to-delete rows, toast.
// User text is only ever set through textContent.

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'icon') node.append(icon(v));
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k in node && typeof v !== 'string') node[k] = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) if (c != null && c !== false) node.append(c);
  return node;
}

// Static, trusted SVG markup only (never user data).
const PATHS = {
  cart: '<path d="M3 4h2.2l2.3 10.4a1.6 1.6 0 0 0 1.6 1.3h8.4a1.6 1.6 0 0 0 1.6-1.2L21 8H6.3"/><circle cx="10" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>',
  tomato: '<circle cx="12" cy="14" r="7.5"/><path d="M8.6 7.6c1.2-.2 2.4.3 3.4 1.2 1-.9 2.2-1.4 3.4-1.2M12 8.8V4.5M12 4.5c.8-.6 1.8-.8 2.6-.6"/>',
  dollar: '<path d="M12 3v18M16.5 7.2c-.7-1.3-2.4-2.2-4.5-2.2-2.6 0-4.5 1.4-4.5 3.4 0 4.6 9.3 2.6 9.3 7.3 0 2-2 3.3-4.8 3.3-2.3 0-4.1-1-4.8-2.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  check: '<path d="M4.5 12.5l4.8 4.8L19.5 7"/>',
  pencil: '<path d="M15.2 4.8l4 4L8.6 19.4 4 20l.6-4.6z"/><path d="M13 7l4 4"/>',
  talk: '<circle cx="9.5" cy="12" r="7.5"/><path d="M7 9.8h.01M12 9.8h.01M7.3 14h4.4a2.2 2.2 0 0 1-4.4 0zM19.4 9.2c1 1.8 1 3.8 0 5.6M21.9 7.2c1.8 3 1.8 6.6 0 9.6"/>',
  smile: '<circle cx="12" cy="12" r="8.5"/><path d="M9 10h.01M15 10h.01M8.4 14c.9 1.5 2.1 2.2 3.6 2.2s2.7-.7 3.6-2.2"/>',
  flame: '<path d="M12 3.5c.6 3 4.8 4.9 4.8 9.7a4.8 4.8 0 0 1-9.6 0c0-2 .9-3.4 2-4.4.2 1.4.9 2.4 2 2.8-.1-3 .2-5.6.8-8.1z"/>',
  moon: '<path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4"/>',
  user: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20c1.2-3.6 4.1-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  list: '<path d="M4.5 6.5l1.3 1.3 2.4-2.6M11 6.5h8.5M5.5 12h1M11 12h8.5M5.5 17.5h1M11 17.5h8.5"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2a1.5 1.5 0 0 0 1.5 1.3h6.2a1.5 1.5 0 0 0 1.5-1.3L17.5 7"/>',
};

export function icon(name, size = 24) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = PATHS[name];
  return svg;
}

/** Official multicolour Google "G" mark. */
export function googleG() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML =
    '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
    '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
    '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
    '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>';
  return svg;
}

/* ---------- Keyboard-aware layout (visualViewport) ---------- */

export function watchViewport() {
  const vv = window.visualViewport;
  if (!vv) return;
  const update = () => {
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--kb', `${Math.round(kb)}px`);
    document.documentElement.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
    document.documentElement.classList.toggle('kb-open', kb > 40);
  };
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  update();
}

/* ---------- Bottom sheets ---------- */

const sheetStack = [];
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select, [href], [tabindex]:not([tabindex="-1"])';

/**
 * Open a bottom sheet. Returns { el, body, close }.
 * Closes on backdrop tap, Escape, or a downward drag on the handle/header.
 */
export function openSheet({ title, content = [], onClose, focus, label } = {}) {
  const opener = document.activeElement;
  const root = document.getElementById('sheets');
  const backdrop = el('div', { class: 'sheet-backdrop' });
  const heading = title ? el('h2', { class: 'sheet-title', text: title, id: `sh-${Date.now()}` }) : null;
  const handle = el('div', { class: 'sheet-handle', 'aria-hidden': 'true' });
  const head = el('div', { class: 'sheet-head' }, [handle, heading]);
  const body = el('div', { class: 'sheet-body' }, content);
  const sheet = el('div', {
    class: 'sheet',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': label || title || 'Dialog',
    tabindex: '-1',
  }, [head, body]);
  const layer = el('div', { class: 'sheet-layer' }, [backdrop, sheet]);
  root.append(layer);
  document.body.classList.add('has-sheet');

  let closed = false;
  const api = { el: sheet, body, close };

  function close() {
    if (closed) return;
    closed = true;
    const i = sheetStack.indexOf(api);
    if (i >= 0) sheetStack.splice(i, 1);
    if (document.activeElement && sheet.contains(document.activeElement)) document.activeElement.blur();
    layer.classList.remove('open');
    const done = () => {
      layer.remove();
      if (!sheetStack.length) document.body.classList.remove('has-sheet');
      if (shouldRestoreFocus(opener)) opener.focus({ preventScroll: true });
      onClose?.();
    };
    if (reducedMotion()) done();
    else setTimeout(done, 200);
  }

  backdrop.addEventListener('click', close);
  sheet.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key === 'Tab') {
      const items = [...sheet.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  enableDragToClose(head, sheet, close);

  sheetStack.push(api);
  const target = typeof focus === 'string' ? sheet.querySelector(focus) : focus;
  // iOS only opens the keyboard for a field that is on screen when it is focused.
  // A sheet that focuses a text field rises a few pixels instead of sliding in from below.
  if (isTextField(target)) layer.classList.add('sheet-layer-input');
  // Force layout so the transition runs, then open.
  void layer.offsetHeight;
  layer.classList.add('open');
  // Focus synchronously, still inside the tap, so iOS shows the keyboard.
  (target || sheet).focus({ preventScroll: true });
  return api;
}

/** Fields that bring up the on-screen keyboard. */
export function isTextField(node) {
  if (!node) return false;
  if (node.tagName === 'TEXTAREA') return !node.readOnly;
  if (node.tagName !== 'INPUT' || node.readOnly || node.disabled) return false;
  return ['text', 'search', 'email', 'url', 'tel', 'number', 'password'].includes(node.type);
}

/**
 * After a sheet closes, give focus back to what opened it, unless the user has moved on:
 * a field in a newly opened sheet keeps its focus (and the iOS keyboard stays open).
 */
function shouldRestoreFocus(opener) {
  if (!opener?.focus || !document.contains(opener)) return false;
  const active = document.activeElement;
  if (active && active !== document.body) return false;
  const top = sheetStack[sheetStack.length - 1];
  return !top || top.el.contains(opener);
}

function enableDragToClose(handleArea, sheet, close) {
  let startY = null;
  let dy = 0;
  handleArea.addEventListener('pointerdown', (e) => {
    startY = e.clientY;
    dy = 0;
    handleArea.setPointerCapture(e.pointerId);
    sheet.style.transition = 'none';
  });
  handleArea.addEventListener('pointermove', (e) => {
    if (startY == null) return;
    dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (startY == null) return;
    startY = null;
    sheet.style.transition = '';
    sheet.style.transform = '';
    if (dy > 80) close();
  };
  handleArea.addEventListener('pointerup', end);
  handleArea.addEventListener('pointercancel', end);
}

export function closeAllSheets() {
  for (const s of [...sheetStack]) s.close();
}

/** Confirmation sheet with Cancel / action buttons. Resolves true when confirmed. */
export function confirmSheet({ title, message, confirmLabel, danger = true }) {
  return new Promise((resolve) => {
    let result = false;
    const cancel = el('button', { class: 'btn btn-secondary', type: 'button', text: 'Cancel' });
    const ok = el('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, type: 'button', text: confirmLabel });
    const sheet = openSheet({
      title,
      content: [
        message ? el('p', { class: 'sheet-text', text: message }) : null,
        el('div', { class: 'btn-row' }, [cancel, ok]),
      ],
      focus: cancel,
      onClose: () => resolve(result),
    });
    sheet.el.setAttribute('role', 'alertdialog');
    cancel.addEventListener('click', () => sheet.close());
    ok.addEventListener('click', () => { result = true; sheet.close(); });
  });
}

/* ---------- Swipe-to-delete rows ---------- */

let openRow = null;
const ACTION_W = 88;

/**
 * Wrap content in a row that reveals a red Delete action when swiped left.
 * A full swipe (past 60% of the width) or a tap on the action deletes it.
 */
export function swipeRow(content, onDelete, { label = 'item', className = '' } = {}) {
  const action = el('button', {
    class: 'swipe-action',
    type: 'button',
    'aria-label': `Delete ${label}`,
  }, [icon('trash', 22), el('span', { text: 'Delete' })]);
  const front = el('div', { class: 'swipe-front' }, [content]);
  const row = el('li', { class: `swipe-row ${className}` }, [action, front]);

  let startX = 0, startY = 0, dx = 0, base = 0, mode = null, pid = null, dragEndedAt = 0;

  const setX = (x, animate) => {
    front.style.transition = animate ? '' : 'none';
    front.style.transform = x ? `translateX(${x}px)` : '';
  };
  const closeRow = () => { setX(0, true); row.classList.remove('is-open'); if (openRow === api) openRow = null; };
  const doDelete = () => {
    if (row.classList.contains('is-removing')) return;
    row.classList.add('is-removing');
    front.style.transition = '';
    front.style.transform = 'translateX(-100%)';
    if (openRow === api) openRow = null;
    setTimeout(onDelete, reducedMotion() ? 0 : 180);
  };
  const api = { close: closeRow };

  front.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (openRow && openRow !== api) openRow.close();
    startX = e.clientX; startY = e.clientY; dx = 0; mode = null; pid = e.pointerId;
    base = row.classList.contains('is-open') ? -ACTION_W : 0;
  });
  front.addEventListener('pointermove', (e) => {
    if (pid !== e.pointerId) return;
    const mx = e.clientX - startX;
    const my = e.clientY - startY;
    if (!mode) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      mode = Math.abs(mx) > Math.abs(my) ? 'h' : 'v';
      if (mode === 'h') front.setPointerCapture(e.pointerId);
    }
    if (mode !== 'h') return;
    dx = Math.min(0, base + mx);
    setX(dx, false);
  });
  const end = (e) => {
    if (pid !== e.pointerId) return;
    pid = null;
    if (mode !== 'h') { mode = null; return; }
    const w = row.offsetWidth;
    if (-dx > w * 0.6) doDelete();
    else if (-dx > 40) { setX(-ACTION_W, true); row.classList.add('is-open'); openRow = api; }
    else closeRow();
    // Swallow the click that follows a horizontal drag.
    dragEndedAt = Date.now();
    mode = null;
  };
  front.addEventListener('pointerup', end);
  front.addEventListener('pointercancel', (e) => { if (pid === e.pointerId) { pid = null; mode = null; setX(base, true); } });
  front.addEventListener('click', (e) => {
    if (Date.now() - dragEndedAt < 400) { e.stopPropagation(); e.preventDefault(); return; }
    if (row.classList.contains('is-open')) { e.stopPropagation(); e.preventDefault(); closeRow(); }
  }, { capture: true });
  action.addEventListener('click', doDelete);
  return row;
}

export function closeOpenRow() {
  openRow?.close();
}

/* ---------- Toast ---------- */

export function showToast(text, actionLabel, onAction) {
  const root = document.getElementById('toast');
  root.replaceChildren(
    el('span', { text }),
    actionLabel ? el('button', { type: 'button', class: 'toast-action', text: actionLabel, onclick: onAction }) : null,
  );
  clearTimeout(toastHideTimer); // a toast shown right after a hide must stay visible
  root.hidden = false;
  requestAnimationFrame(() => root.classList.add('show'));
}

let toastHideTimer = null;

export function hideToast() {
  const root = document.getElementById('toast');
  root.classList.remove('show');
  clearTimeout(toastHideTimer);
  toastHideTimer = setTimeout(() => { root.hidden = true; }, 200);
}

/** Large round primary "+" button. */
export function plusButton(label, onclick) {
  return el('button', { class: 'fab', type: 'button', 'aria-label': label, onclick }, [icon('plus', 28)]);
}

/** A labelled field wrapper. */
export function field(labelText, input, hint) {
  const id = input.id || `f-${Math.random().toString(36).slice(2, 9)}`;
  input.id = id;
  return el('div', { class: 'field' }, [
    el('label', { for: id, class: 'field-label', text: labelText }),
    input,
    hint ? el('p', { class: 'field-hint', text: hint }) : null,
  ]);
}

export function emptyState(text) {
  return el('p', { class: 'empty', text });
}
