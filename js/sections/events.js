import * as store from '../store.js';
import { el, icon, openSheet, swipeRow, plusButton, field } from '../ui.js';
import { monthGrid, monthTitle, WEEKDAY_HEADERS, parseDate, dayNumber, formatLong, isValidDateStr } from '../dates.js';
import { sortEvents, upcomingGroups } from '../logic.js';

export function createEvents(ctx) {
  let view = 'month';
  let ym = null; // { y, m }
  let daySheet = null;

  const segMonth = el('button', { type: 'button', class: 'seg', role: 'tab', text: 'Month', onclick: () => setView('month') });
  const segList = el('button', { type: 'button', class: 'seg', role: 'tab', text: 'List', onclick: () => setView('list') });
  const segmented = el('div', { class: 'segmented', role: 'tablist', 'aria-label': 'View' }, [segMonth, segList]);
  const monthEl = el('div', { class: 'month' });
  const listEl = el('div', { class: 'event-list' });

  function setView(v) { view = v; render(); }

  function eventRow(ev, showDate) {
    const meta = [ev.time, showDate ? formatLong(ev.date, ctx.today()) : null].filter(Boolean).join(' · ');
    const card = el('div', { class: 'row-card' }, [
      el('span', { class: 'row-text', text: ev.title }),
      meta ? el('span', { class: 'row-meta', text: meta }) : null,
    ]);
    return swipeRow(card, () => store.remove('events', ev.id), { label: ev.title });
  }

  function render() {
    const today = ctx.today();
    if (!ym) { const d = parseDate(today); ym = { y: d.getFullYear(), m: d.getMonth() }; }
    segMonth.setAttribute('aria-selected', String(view === 'month'));
    segList.setAttribute('aria-selected', String(view === 'list'));
    monthEl.hidden = view !== 'month';
    listEl.hidden = view !== 'list';

    const events = store.list('events');
    if (view === 'month') {
      const withEvents = new Set(events.map((e) => e.date));
      const grid = monthGrid(ym.y, ym.m);
      monthEl.replaceChildren(
        el('div', { class: 'month-head' }, [
          el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Previous month', onclick: () => shift(-1) }, [icon('back', 22)]),
          el('h2', { class: 'month-title', text: monthTitle(ym.y, ym.m), 'aria-live': 'polite' }),
          el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Next month', onclick: () => shift(1) }, [icon('next', 22)]),
        ]),
        el('div', { class: 'month-grid', role: 'grid' }, [
          ...WEEKDAY_HEADERS.map((w) => el('div', { class: 'wd', role: 'columnheader', text: w })),
          ...grid.flat().map((c) => {
            const has = withEvents.has(c.date);
            return el('button', {
              type: 'button',
              role: 'gridcell',
              class: `day${c.inMonth ? '' : ' out'}${c.date === today ? ' today' : ''}`,
              'aria-label': `${formatLong(c.date, today)}${has ? ', has events' : ''}`,
              'aria-current': c.date === today ? 'date' : null,
              onclick: () => openDay(c.date),
            }, [el('span', { text: String(dayNumber(c.date)) }), has ? el('span', { class: 'dot', 'aria-hidden': 'true' }) : null]);
          }),
        ]),
      );
    } else {
      const groups = upcomingGroups(events, today);
      listEl.replaceChildren(
        ...groups.map((g) => el('section', { class: 'group' }, [
          el('h2', { class: 'group-title', text: formatLong(g.date, today) }),
          el('ul', { class: 'rows' }, g.events.map((e) => eventRow(e, false))),
        ])),
      );
    }
    daySheet?.draw();
  }

  function shift(n) {
    const d = new Date(ym.y, ym.m + n, 1);
    ym = { y: d.getFullYear(), m: d.getMonth() };
    render();
  }

  function openDay(date) {
    const listUl = el('ul', { class: 'rows' });
    const draw = () => listUl.replaceChildren(
      ...sortEvents(store.list('events').filter((e) => e.date === date)).map((e) => eventRow(e, false)));
    draw();
    const addBtn = el('button', {
      type: 'button', class: 'icon-btn icon-btn-primary', 'aria-label': 'Add event',
      onclick: () => openForm(date),
    }, [icon('plus', 22)]);
    const sheet = openSheet({
      title: formatLong(date, ctx.today()),
      content: [el('div', { class: 'sheet-actions' }, [addBtn]), listUl],
      onClose: () => { if (daySheet?.sheet === sheet) daySheet = null; },
    });
    daySheet = { sheet, draw };
  }

  function openForm(defaultDate) {
    const title = el('input', { type: 'text', class: 'input', autocomplete: 'off', maxlength: '200', required: true });
    const date = el('input', { type: 'date', class: 'input', required: true, value: defaultDate || ctx.today() });
    const time = el('input', { type: 'time', class: 'input' });
    const error = el('p', { class: 'field-error', role: 'alert' });
    const form = el('form', { class: 'sheet-form', novalidate: true }, [
      field('Title', title),
      field('Date', date),
      field('Time (optional)', time),
      error,
      el('button', { class: 'btn btn-primary btn-block', type: 'submit', text: 'Add' }),
    ]);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!title.value.trim()) { error.textContent = 'Enter a title.'; title.focus(); return; }
      if (!isValidDateStr(date.value)) { error.textContent = 'Choose a date.'; date.focus(); return; }
      store.add('events', { title: title.value.trim(), date: date.value, time: time.value || '' });
      sheet.close();
    });
    const sheet = openSheet({ title: 'New event', content: form, focus: title });
  }

  return {
    id: 'events',
    title: 'Events',
    top: [segmented],
    body: [monthEl, listEl],
    footer: [plusButton('Add event', () => openForm(null))],
    render,
  };
}
