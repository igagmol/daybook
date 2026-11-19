import * as store from '../store.js';
import { el } from '../ui.js';

export function createNotes() {
  const area = el('textarea', {
    class: 'note-area',
    placeholder: 'Write your ideas…',
    'aria-label': 'Note',
    spellcheck: 'true',
  });
  let timer = null;

  const save = () => {
    clearTimeout(timer);
    timer = null;
    store.setNote(area.value);
  };
  area.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(save, 400);
  });
  area.addEventListener('blur', save);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
  window.addEventListener('pagehide', save);

  function render() {
    // Do not overwrite while typing (a pending save holds newer text).
    if (timer) return;
    const text = store.getData().note.text;
    if (area.value !== text) area.value = text;
  }

  return { id: 'notes', title: 'Notes', body: [area], render, flush: save, className: 'panel-notes' };
}
