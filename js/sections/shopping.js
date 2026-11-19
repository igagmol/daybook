import * as store from '../store.js';
import { el, openSheet, confirmSheet, swipeRow, plusButton, field } from '../ui.js';

export function createShopping() {
  const listEl = el('ul', { class: 'rows', 'aria-label': 'Shopping list' });

  function render() {
    const items = store.list('shopping');
    listEl.replaceChildren(
      ...items.map((it) =>
        swipeRow(el('div', { class: 'row-card' }, [el('span', { class: 'row-text', text: it.text })]),
          () => store.remove('shopping', it.id), { label: it.text }),
      ),
    );
  }

  function openAdd() {
    const input = el('input', { type: 'text', class: 'input', enterkeyhint: 'done', autocomplete: 'off', maxlength: '200' });
    const form = el('form', { class: 'sheet-form' }, [
      field('Item', input),
      el('button', { class: 'btn btn-primary btn-block', type: 'submit', text: 'Add' }),
    ]);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) { input.focus(); return; }
      store.add('shopping', { text });
      input.value = '';
      input.focus();
    });
    openSheet({ title: 'Add item', content: form, focus: input });
  }

  async function clearAll() {
    const items = store.list('shopping');
    if (!items.length) return;
    const ok = await confirmSheet({ title: 'Clear all items?', confirmLabel: 'Clear' });
    if (ok) store.remove('shopping', items.map((i) => i.id));
  }

  return {
    id: 'shopping',
    title: 'Shopping',
    body: [listEl],
    footer: [
      el('button', { class: 'btn btn-secondary btn-clear', type: 'button', text: 'Clear all', onclick: clearAll }),
      plusButton('Add item', openAdd),
    ],
    render,
  };
}
