import * as store from '../store.js';
import { el } from '../ui.js';
import { createMoney } from './money.js';

/** The note (one free-text area). */
function createNoteTab() {
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

  return { body: [area], render, flush: save };
}

/** Notes section: two tabs at the top, Notes (the note) and Money (who owes whom). */
export function createNotes() {
  const note = createNoteTab();
  const money = createMoney();
  let tab = store.readGlobal('notes-tab') === 'money' ? 'money' : 'notes';

  const segNotes = el('button', { type: 'button', class: 'seg', role: 'tab', text: 'Notes', onclick: () => setTab('notes') });
  const segMoney = el('button', { type: 'button', class: 'seg', role: 'tab', text: 'Money', onclick: () => setTab('money') });
  const segmented = el('div', { class: 'segmented', role: 'tablist', 'aria-label': 'Notes or Money' }, [segNotes, segMoney]);
  const noteView = el('div', { class: 'notes-view notes-view-note' }, note.body);
  const moneyView = el('div', { class: 'notes-view notes-view-money' }, money.body);
  const moneyFooter = el('div', { class: 'notes-money-footer' }, money.footer);

  function setTab(t) {
    if (t === tab) return;
    if (tab === 'notes') note.flush();
    tab = t;
    store.writeGlobal('notes-tab', t);
    render();
  }

  function render() {
    segNotes.setAttribute('aria-selected', String(tab === 'notes'));
    segMoney.setAttribute('aria-selected', String(tab === 'money'));
    noteView.hidden = tab !== 'notes';
    moneyView.hidden = tab !== 'money';
    moneyFooter.hidden = tab !== 'money';
    noteView.closest('.panel')?.setAttribute('data-tab', tab);
    note.render();
    money.render();
  }

  return {
    id: 'notes',
    title: 'Notes',
    top: [segmented],
    body: [noteView, moneyView],
    footer: [moneyFooter],
    render,
    flush: note.flush,
    className: 'panel-notes',
  };
}
