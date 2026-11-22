// Daily check-in sections (Language, Habits): one big "Done" button, a month calendar and a streak.
// Each day is one item in the "checkins" collection with a fixed id, e.g. "habits:2026-11-22".
// "Today" is the device's local date, so the button resets at local midnight.
import * as store from '../store.js';
import { el, icon, showToast, hideToast } from '../ui.js';
import { monthGrid, monthTitle, WEEKDAY_HEADERS, parseDate, dayNumber, formatLong, addDays } from '../dates.js';
import {
  checkinId, checkinCounts, currentStreak,
  SLEEP_MIN_MS, openSleep, staleSleepIds, sleepByDay, nightOf, clockTime, formatDuration,
} from '../logic.js';

/** Today's count for one section (0 when not done). */
export function todayCount(kind, today) {
  return Number(store.find('checkins', checkinId(kind, today))?.count) || 0;
}

/**
 * @param ctx   { today: () => "YYYY-MM-DD" }
 * @param id    section id and check-in kind ("language" | "habits")
 * @param title panel title
 * @param max   presses allowed per day (1 for Language, 3 for Habits)
 * @param sleep true adds the sleep button and the bedtime/wake-up line (Habits)
 */
export function createDaily(ctx, { id, title, max, sleep = false }) {
  let ym = null; // month shown { y, m }
  let shownToday = null;
  let selected = null; // day whose sleep is shown (Habits)
  let toastTimer = null;

  const monthEl = el('div', { class: 'month daily-month' });
  const streakEl = el('p', { class: 'streak', 'aria-live': 'polite' });
  const doneBtn = el('button', { type: 'button', class: 'done-btn', onclick: press });
  const undoBtn = el('button', { type: 'button', class: 'undo-btn', text: 'Undo', onclick: undo });
  const sleepInfo = sleep ? el('p', { class: 'sleep-info', 'aria-live': 'polite' }) : null;
  const sleepBtn = sleep ? el('button', { type: 'button', class: 'sleep-btn', onclick: pressSleep }) : null;
  const info = el('div', { class: 'daily-info' }, [streakEl, sleepInfo]);
  const action = el('div', { class: 'daily-action' }, [
    doneBtn,
    el('div', { class: 'daily-row' }, [sleepBtn, undoBtn]),
  ]);

  /** One button: first press = bedtime, next press = wake-up. A very short sleep is an accidental press. */
  function pressSleep() {
    const now = Date.now();
    const list = store.list('sleep');
    const stale = staleSleepIds(list, now);
    if (stale.length) store.remove('sleep', stale);
    const open = openSleep(list, now);
    if (!open) {
      store.add('sleep', { start: now, end: 0 });
      return;
    }
    if (now - open.start < SLEEP_MIN_MS) {
      store.remove('sleep', open.id);
      toast('Bedtime cancelled');
      return;
    }
    store.update('sleep', open.id, { end: now });
    selected = nightOf(open.start);
    toast(`Slept ${formatDuration(now - open.start)}`);
  }

  function toast(text) {
    clearTimeout(toastTimer);
    showToast(text);
    toastTimer = setTimeout(hideToast, 2500);
  }

  function setCount(n) {
    store.upsert('checkins', checkinId(id, ctx.today()), { kind: id, date: ctx.today(), count: n });
  }

  function press() {
    const n = todayCount(id, ctx.today());
    if (n >= max) return;
    setCount(n + 1);
  }

  function undo() {
    const n = todayCount(id, ctx.today());
    if (n > 0) setCount(n - 1);
  }

  function mark(count) {
    const level = max === 1 ? 'full' : String(count);
    return el('span', { class: `mark mark-${level}`, 'aria-hidden': 'true' }, [
      icon('check', 16),
      max > 1 ? el('span', { class: 'mark-num', text: String(count) }) : null,
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
    if (!ym || shownToday !== today) { ym = { y: t.getFullYear(), m: t.getMonth() }; shownToday = today; selected = addDays(today, -1); }
    const isCurrent = ym.y === t.getFullYear() && ym.m === t.getMonth();
    const counts = checkinCounts(store.list('checkins'), id);
    const sleeps = sleep ? sleepByDay(store.list('sleep')) : null;
    if (!selected || selected > today) selected = addDays(today, -1);

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
          const n = c.inMonth ? counts.get(c.date) || 0 : 0;
          const label = n ? (max > 1 ? `, done ${n} of ${max}` : ', done') : '';
          const slept = sleep && c.inMonth ? sleeps.get(c.date) : null;
          const pickable = sleep && c.inMonth && c.date <= today;
          return el(pickable ? 'button' : 'div', {
            type: pickable ? 'button' : null,
            role: 'gridcell',
            class: `day daily-day${c.inMonth ? '' : ' out'}${c.date === today ? ' today' : ''}${pickable && c.date === selected ? ' selected' : ''}`,
            'aria-label': `${formatLong(c.date, today)}${label}${slept ? `, slept ${clockTime(slept.start)} to ${clockTime(slept.end)}` : ''}`,
            'aria-current': c.date === today ? 'date' : null,
            'aria-selected': pickable ? String(c.date === selected) : null,
            onclick: pickable ? () => { selected = c.date; render(); } : null,
          }, [
            el('span', { class: 'day-num', text: String(dayNumber(c.date)) }),
            n ? mark(n) : null,
            slept ? el('span', { class: 'sleep-dot', 'aria-hidden': 'true' }) : null,
          ]);
        }),
      ]),
    );

    const n = counts.get(today) || 0;
    const streak = currentStreak(counts, today);
    let text;
    if (!streak) text = 'Start your streak today';
    else if (n) text = `${streak}-day streak`;
    else text = `${streak}-day streak · keep it going today`;
    streakEl.replaceChildren(icon('flame', 18), el('span', { text }));
    streakEl.classList.toggle('streak-on', streak > 0);

    const full = n >= max;
    doneBtn.className = `done-btn done-${max === 1 ? (n ? 'full' : '0') : n}`;
    doneBtn.disabled = full;
    doneBtn.setAttribute('aria-label', max > 1 ? `Done, ${n} of ${max} today` : n ? 'Done today' : 'Done');
    doneBtn.replaceChildren(...[
      el('span', { class: 'done-icon' }, [icon('check', 44)]),
      el('span', { class: 'done-text', text: full ? 'Done today' : 'Done' }),
      max > 1 ? el('span', { class: 'done-pips', 'aria-hidden': 'true' },
        Array.from({ length: max }, (_, i) => el('span', { class: `pip${i < n ? ' on' : ''}` }))) : null,
    ].filter(Boolean));
    undoBtn.hidden = !n;
    if (sleep) renderSleep(today, sleeps);
  }

  function renderSleep(today, sleeps) {
    const s = sleeps.get(selected);
    const when = selected === addDays(today, -1) ? 'Last night'
      : selected === today ? 'Tonight' : `Night of ${formatLong(selected, today)}`;
    sleepInfo.replaceChildren(icon('moon', 16), el('span', {
      text: s ? `${when} ${clockTime(s.start)} → ${clockTime(s.end)} · ${formatDuration(s.end - s.start)}` : `${when}: no sleep logged`,
    }));
    sleepInfo.classList.toggle('sleep-on', Boolean(s));
    const open = openSleep(store.list('sleep'), Date.now());
    sleepBtn.classList.toggle('asleep', Boolean(open));
    sleepBtn.replaceChildren(
      icon(open ? 'sun' : 'moon', 20),
      el('span', { text: open ? `Wake up · asleep since ${clockTime(open.start)}` : 'Going to sleep' }),
    );
  }

  return {
    id,
    title,
    className: 'panel-daily',
    body: [monthEl, info, action],
    render,
  };
}
