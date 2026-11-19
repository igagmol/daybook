import * as store from '../store.js';
import { el, openSheet, confirmSheet, swipeRow, plusButton, field } from '../ui.js';
import { parseAmount, formatEuro } from '../logic.js';

const LABELS = { owed: 'They owe me', owe: 'I owe' };

export function createMoney() {
  const listEl = el('ul', { class: 'rows', 'aria-label': 'Money entries' });

  function render() {
    listEl.replaceChildren(
      ...store.list('money').map((it) => {
        const dir = it.direction === 'owe' ? 'owe' : 'owed';
        const card = el('div', { class: `row-card money-${dir}` }, [
          el('span', { class: 'row-text', text: it.concept }),
          el('span', { class: 'money-amount', text: formatEuro(it.amount) }),
          el('span', { class: 'sr-only', text: LABELS[dir] }),
        ]);
        return swipeRow(card, () => store.remove('money', it.id), { label: it.concept || formatEuro(it.amount) });
      }),
    );
  }

  function openAdd() {
    let direction = null;
    const amount = el('input', { type: 'text', inputmode: 'decimal', class: 'input', autocomplete: 'off', placeholder: '0.00' });
    const concept = el('input', { type: 'text', class: 'input', autocomplete: 'off', maxlength: '200', enterkeyhint: 'done' });
    const btnOwed = el('button', { type: 'button', class: 'choice choice-owed', 'aria-pressed': 'false', text: LABELS.owed });
    const btnOwe = el('button', { type: 'button', class: 'choice choice-owe', 'aria-pressed': 'false', text: LABELS.owe });
    const choose = (d) => {
      direction = d;
      btnOwed.setAttribute('aria-pressed', String(d === 'owed'));
      btnOwe.setAttribute('aria-pressed', String(d === 'owe'));
      submit.disabled = false;
    };
    btnOwed.addEventListener('click', () => choose('owed'));
    btnOwe.addEventListener('click', () => choose('owe'));
    const error = el('p', { class: 'field-error', role: 'alert' });
    const submit = el('button', { class: 'btn btn-primary btn-block', type: 'submit', text: 'Add', disabled: true });
    const form = el('form', { class: 'sheet-form' }, [
      field('Amount (€)', amount),
      field('Concept', concept),
      el('div', { class: 'choice-row', role: 'group', 'aria-label': 'Direction' }, [btnOwed, btnOwe]),
      error,
      submit,
    ]);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const cents = parseAmount(amount.value);
      if (cents == null) { error.textContent = 'Enter a valid amount.'; amount.focus(); return; }
      if (!concept.value.trim()) { error.textContent = 'Enter a concept.'; concept.focus(); return; }
      if (!direction) return;
      store.add('money', { amount: cents, concept: concept.value.trim(), direction });
      sheet.close();
    });
    const sheet = openSheet({ title: 'Add entry', content: form, focus: amount });
  }

  async function clearAll() {
    const items = store.list('money');
    if (!items.length) return;
    const ok = await confirmSheet({ title: 'Clear all entries?', confirmLabel: 'Clear' });
    if (ok) store.remove('money', items.map((i) => i.id));
  }

  return {
    id: 'money',
    title: 'Money',
    body: [listEl],
    footer: [
      el('button', { class: 'btn btn-secondary btn-clear', type: 'button', text: 'Clear all', onclick: clearAll }),
      plusButton('Add entry', openAdd),
    ],
    render,
  };
}
