// Habits section: two "Done" buttons (Language, once a day; Habit, up to 3 a day), a month calendar
// and a streak. Each button has one item per day in the "checkins" collection with a
// fixed id, e.g. "habits:2026-11-22" or "language:2026-11-22" (Language keeps its old history).
// "Today" is the device's local date, so the buttons reset at local midnight.
import * as store from '../store.js';
import { el, icon } from '../ui.js';
import { monthGrid, monthTitle, WEEKDAY_HEADERS, parseDate, dayNumber, formatLong } from '../dates.js';
import {
  checkinId, currentStreak, HABIT_MAX, HABITS_TICK, habitDays, tickDays,
} from '../logic.js';

/** Today's count for one button (0 when not pressed). */
export function todayCount(kind, today) {
  return Math.min(Number(store.find('checkins', checkinId(kind, today))?.count) || 0, HABIT_MAX[kind]);
}

/** Presses today on both buttons together (0 to 4): the colour of the Habits tile. */
export function habitsLevel(today) {
  return todayCount('language', today) + todayCount('habits', today);
}

const BUTTONS = [
  { kind: 'language', label: 'Language' },
  { kind: 'habits', label: 'Habit' },
];

/** @param ctx { today: () => "YYYY-MM-DD" } */
export function createHabits(ctx) {
  let ym = null; // month shown { y, m }
  let shownToday = null;

  const monthEl = el('div', { class: 'month daily-month' });
  const streakEl = el('p', { class: 'streak', 'aria-live': 'polite' });
  const doneBtns = BUTTONS.map(({ kind }) => el('button', {
    type: 'button', class: `done-btn done-${kind}`, 'data-kind': kind, onclick: () => press(kind),
  }));
  const undoBtn = el('button', { type: 'button', class: 'undo-btn', text: 'Undo', onclick: undo });
  const info = el('div', { class: 'daily-info' }, [streakEl]);
  const action = el('div', { class: 'daily-action' }, [
    el('div', { class: 'done-pair' }, doneBtns),
    el('div', { class: 'daily-row' }, [undoBtn]),
  ]);

  function setCount(kind, n) {
    store.upsert('checkins', checkinId(kind, ctx.today()), { kind, date: ctx.today(), count: n });
  }

  function press(kind) {
    const n = todayCount(kind, ctx.today());
    if (n >= HABIT_MAX[kind]) return;
    setCount(kind, n + 1);
  }

  /** Takes back the latest press of today, on whichever button it was. */
  function undo() {
    const today = ctx.today();
    const items = BUTTONS
      .map(({ kind }) => store.find('checkins', checkinId(kind, today)))
      .filter((c) => c && Number(c.count) > 0)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (items[0]) setCount(items[0].kind, todayCount(items[0].kind, today) - 1);
  }

  function mark(total) {
    return el('span', { class: `mark mark-${total}`, 'aria-hidden': 'true' }, [
      icon('check', 16),
      el('span', { class: 'mark-num', text: String(total) }),
    ]);
  }

  function shift(n) {
    const d = new Date(ym.y, ym.m + n, 1);
    ym = { y: d.getFullYear(), m: d.getMonth() };
    render();
  }

  function render() {
    const today = ctx.today();
    const t = parseDate(today);
    // A new day (or first render) brings the calendar back to the current month.
    if (!ym || shownToday !== today) { ym = { y: t.getFullYear(), m: t.getMonth() }; shownToday = today; }
    const isCurrent = ym.y === t.getFullYear() && ym.m === t.getMonth();
    const days = habitDays(store.list('checkins'));
    const ticks = tickDays(days);

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
          const d = c.inMonth ? days.get(c.date) : null;
          const n = d && d.total >= HABITS_TICK ? d.total : 0;
          const label = d ? `, done ${d.total} (Language ${d.language}, Habit ${d.habits})` : '';
          return el('div', {
            role: 'gridcell',
            class: `day daily-day${c.inMonth ? '' : ' out'}${c.date === today ? ' today' : ''}`,
            'aria-label': `${formatLong(c.date, today)}${label}`,
            'aria-current': c.date === today ? 'date' : null,
          }, [
            el('span', { class: 'day-num', text: String(dayNumber(c.date)) }),
            n ? mark(n) : null,
          ]);
        }),
      ]),
    );

    const n = ticks.get(today) || 0;
    const streak = currentStreak(ticks, today);
    let text;
    if (!streak) text = 'Start your streak today';
    else if (n) text = `${streak}-day streak`;
    else text = `${streak}-day streak · keep it going today`;
    streakEl.replaceChildren(icon('flame', 18), el('span', { text }));
    streakEl.classList.toggle('streak-on', streak > 0);

    BUTTONS.forEach(({ kind, label }, i) => {
      const btn = doneBtns[i];
      const max = HABIT_MAX[kind];
      const c = todayCount(kind, today);
      const full = c >= max;
      btn.className = `done-btn done-${kind} done-${max === 1 ? (c ? 'full' : '0') : c}`;
      btn.disabled = full;
      btn.setAttribute('aria-label', max > 1 ? `${label} done, ${c} of ${max} today` : c ? `${label} done today` : `${label} done`);
      btn.replaceChildren(...[
        el('span', { class: 'done-icon' }, [icon('check', 44)]),
        el('span', { class: 'done-text', text: label }),
        max > 1 ? el('span', { class: 'done-pips', 'aria-hidden': 'true' },
          Array.from({ length: max }, (_, j) => el('span', { class: `pip${j < c ? ' on' : ''}` })))
          : el('span', { class: 'done-sub', text: full ? 'Done today' : 'Done' }),
      ]);
    });
    undoBtn.hidden = !(days.get(today)?.total);
  }

  return {
    id: 'habits',
    title: 'Habits',
    className: 'panel-daily',
    body: [monthEl, info, action],
    render,
  };
}
