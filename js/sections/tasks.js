import * as store from '../store.js';
import { el, icon, openSheet, plusButton, field } from '../ui.js';
import { formatShort, isValidDateStr } from '../dates.js';
import { sortTasks, isOverdue } from '../logic.js';

export function createTasks(ctx) {
  const listEl = el('ul', { class: 'rows', 'aria-label': 'Tasks' });
  const completing = new Set();

  function render() {
    const today = ctx.today();
    listEl.replaceChildren(
      ...sortTasks(store.list('tasks')).map((t) => {
        const overdue = isOverdue(t.due, today);
        const check = el('button', {
          type: 'button', class: 'task-check', 'aria-label': `Complete ${t.name}`,
          onclick: () => complete(t.id, li),
        }, [icon('check', 18)]);
        const li = el('li', { class: `task-row${completing.has(t.id) ? ' done' : ''}` }, [
          el('div', { class: 'row-card task-card' }, [
            check,
            el('span', { class: 'row-text', text: t.name }),
            el('span', { class: 'task-prio', 'aria-label': `Priority ${t.priority}`, text: String(t.priority) }),
            el('span', { class: `task-due${overdue ? ' overdue' : ''}`, text: formatShort(t.due, today) }),
          ]),
        ]);
        return li;
      }),
    );
  }

  function complete(id, li) {
    if (completing.has(id)) return;
    completing.add(id);
    li.classList.add('done');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => {
      completing.delete(id);
      store.remove('tasks', id); // tombstone: never comes back, even after a sync
    }, reduce ? 0 : 200);
  }

  function openAdd() {
    let priority = 3;
    const name = el('input', { type: 'text', class: 'input', autocomplete: 'off', maxlength: '200' });
    const segs = [1, 2, 3, 4, 5].map((p) => el('button', {
      type: 'button', class: 'seg', role: 'radio', text: String(p),
      'aria-checked': String(p === priority),
      onclick: () => { priority = p; segs.forEach((s, i) => s.setAttribute('aria-checked', String(i + 1 === p))); },
    }));
    const prioGroup = el('div', { class: 'field' }, [
      el('span', { class: 'field-label', id: 'prio-label', text: 'Priority' }),
      el('div', { class: 'segmented segmented-5', role: 'radiogroup', 'aria-labelledby': 'prio-label' }, segs),
      el('p', { class: 'field-hint', text: '1 = most urgent' }),
    ]);
    const due = el('input', { type: 'date', class: 'input', required: true, value: ctx.today() });
    const error = el('p', { class: 'field-error', role: 'alert' });
    const form = el('form', { class: 'sheet-form', novalidate: true }, [
      field('Task', name),
      prioGroup,
      field('Due date', due),
      error,
      el('button', { class: 'btn btn-primary btn-block', type: 'submit', text: 'Add' }),
    ]);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!name.value.trim()) { error.textContent = 'Enter a task.'; name.focus(); return; }
      if (!isValidDateStr(due.value)) { error.textContent = 'Choose a due date.'; due.focus(); return; }
      store.add('tasks', { name: name.value.trim(), priority, due: due.value });
      sheet.close();
    });
    const sheet = openSheet({ title: 'New task', content: form, focus: name });
  }

  return {
    id: 'tasks',
    title: 'Tasks',
    body: [listEl],
    footer: [plusButton('Add task', openAdd)],
    render,
  };
}
