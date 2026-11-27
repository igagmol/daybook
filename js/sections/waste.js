// Waste section: time lost today (e.g. 5 minutes on Instagram). One "+" adds minutes; they add up per day.
// Each "+" is one item in the "waste" collection ({ date, minutes }), so presses on two devices never
// overwrite each other. A month calendar shows the total of every day.
import * as store from '../store.js';
import { el, icon, openSheet, field } from '../ui.js';
import { monthGrid, monthTitle, WEEKDAY_HEADERS, parseDate, dayNumber, formatLong } from '../dates.js';
import { wasteByDay, formatMinutes, formatMinutesShort, parseMinutes } from '../logic.js';

const QUICK = [5, 10, 15, 30];

/** Minutes wasted today (0 when none). */
export function wasteToday(today) {
  return wasteByDay(store.list('waste')).get(today) || 0;
}

/** @param ctx { today: () => "YYYY-MM-DD" } */
export function createWaste(ctx) {
  let ym = null;
  let shownToday = null;

  const monthEl = el('div', { class: 'month daily-month' });
  const totalEl = el('p', { class: 'waste-total', 'aria-live': 'polite' });
  const addBtn = el('button', { type: 'button', class: 'done-btn waste-add', 'aria-label': 'Add minutes', onclick: openAdd }, [
    el('span', { class: 'done-icon' }, [icon('plus', 44)]),
    el('span', { class: 'done-text', text: 'Add minutes' }),
  ]);
  const undoBtn = el('button', { type: 'button', class: 'undo-btn', text: 'Undo', onclick: undo });
  const action = el('div', { class: 'daily-action' }, [addBtn, el('div', { class: 'daily-row' }, [undoBtn])]);

  function add(minutes) {
    store.add('waste', { date: ctx.today(), minutes });
  }

  /** Takes back the latest "+" of today. */
  function undo() {
    const last = store.list('waste')
      .filter((e) => e.date === ctx.today())
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
    if (last) store.remove('waste', last.id);
  }

  function openAdd() {
    const input = el('input', {
      type: 'text', class: 'input', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'off', maxlength: '4', placeholder: 'Minutes',
    });
    const error = el('p', { class: 'field-error', role: 'alert' });
    const quick = el('div', { class: 'waste-quick' }, QUICK.map((m) => el('button', {
      type: 'button', class: 'chip', text: `+${m} min`, onclick: () => { add(m); sheet.close(); },
    })));
    const form = el('form', { class: 'sheet-form', novalidate: true }, [
      field('Minutes', input),
      quick,
      error,
      el('button', { class: 'btn btn-primary btn-block', type: 'submit', text: 'Add' }),
    ]);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const m = parseMinutes(input.value);
      if (!m) { error.textContent = 'Enter the minutes (1 to 1440).'; input.focus(); return; }
      add(m);
      sheet.close();
    });
    const sheet = openSheet({ title: 'Time wasted', content: form, focus: input });
  }

  function shift(n) {
    const d = new Date(ym.y, ym.m + n, 1);
    ym = { y: d.getFullYear(), m: d.getMonth() };
    render();
  }

  function render() {
    const today = ctx.today();
    const t = parseDate(today);
    if (!ym || shownToday !== today) { ym = { y: t.getFullYear(), m: t.getMonth() }; shownToday = today; }
    const isCurrent = ym.y === t.getFullYear() && ym.m === t.getMonth();
    const totals = wasteByDay(store.list('waste'));

    monthEl.replaceChildren(
      el('div', { class: 'month-head' }, [
        el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Previous month', onclick: () => shift(-1) }, [icon('back', 22)]),
        el('h2', { class: 'month-title', text: monthTitle(ym.y, ym.m), 'aria-live': 'polite' }),
        el('button', {
          type: 'button', class: 'icon-btn', 'aria-label': 'Next month', disabled: isCurrent, onclick: () => shift(1),
        }, [icon('next', 22)]),
      ]),
      el('div', { class: 'month-grid', role: 'grid' }, [
        ...WEEKDAY_HEADERS.map((w) => el('div', { class: 'wd', role: 'columnheader', text: w })),
        ...monthGrid(ym.y, ym.m).flat().map((c) => {
          const m = c.inMonth ? totals.get(c.date) || 0 : 0;
          return el('div', {
            role: 'gridcell',
            class: `day daily-day waste-day${c.inMonth ? '' : ' out'}${c.date === today ? ' today' : ''}`,
            'aria-label': `${formatLong(c.date, today)}${m ? `, ${formatMinutes(m)} wasted` : ''}`,
            'aria-current': c.date === today ? 'date' : null,
          }, [
            el('span', { class: 'day-num', text: String(dayNumber(c.date)) }),
            m ? el('span', { class: 'waste-mark', 'aria-hidden': 'true', text: formatMinutesShort(m) }) : null,
          ]);
        }),
      ]),
    );

    const m = totals.get(today) || 0;
    totalEl.replaceChildren(icon('trash', 18), el('span', { text: m ? `Today: ${formatMinutes(m)} wasted` : 'Today: nothing wasted' }));
    totalEl.classList.toggle('waste-on', m > 0);
    undoBtn.hidden = !m;
  }

  return {
    id: 'waste',
    title: 'Waste',
    className: 'panel-daily panel-waste',
    body: [monthEl, el('div', { class: 'daily-info' }, [totalEl]), action],
    render,
  };
}
