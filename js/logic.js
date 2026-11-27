// Pure list logic used by the sections. Unit tested.
import { addDays, toDateStr } from './dates.js';

/** Priority ascending (1 first), then due date ascending, then creation time. */
export function sortTasks(tasks) {
  return [...tasks].sort(
    (a, b) =>
      a.priority - b.priority ||
      (a.due < b.due ? -1 : a.due > b.due ? 1 : 0) ||
      (a.createdAt || 0) - (b.createdAt || 0),
  );
}

export function isOverdue(due, today) {
  return due < today;
}

/** Events sorted by date, then time (events without a time first), then creation. */
export function sortEvents(events) {
  return [...events].sort(
    (a, b) =>
      (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) ||
      (a.time || '').localeCompare(b.time || '') ||
      (a.createdAt || 0) - (b.createdAt || 0),
  );
}

/** Upcoming events from today onward, grouped by date: [{ date, events }]. */
export function upcomingGroups(events, today) {
  const groups = [];
  for (const ev of sortEvents(events.filter((e) => e.date >= today))) {
    const last = groups[groups.length - 1];
    if (last && last.date === ev.date) last.events.push(ev);
    else groups.push({ date: ev.date, events: [ev] });
  }
  return groups;
}

export function sortRecipes(recipes) {
  return [...recipes].sort((a, b) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || (a.createdAt || 0) - (b.createdAt || 0),
  );
}

export function filterRecipes(recipes, query) {
  const q = query.trim().toLowerCase();
  if (!q) return recipes;
  return recipes.filter((r) => r.name.toLowerCase().includes(q));
}

/** Parse a user-typed euro amount ("12,5", "12.50") into integer cents, or null. */
export function parseAmount(text) {
  const t = String(text).trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(t) && !/^\.\d{1,2}$/.test(t)) return null;
  const cents = Math.round(parseFloat(t) * 100);
  return cents > 0 ? cents : null;
}

export function formatEuro(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}€${euros}.${String(abs % 100).padStart(2, '0')}`;
}

/* ---------- Ingredients ---------- */

/** Case- and space-insensitive key for an ingredient or shopping item name. */
export function nameKey(name) {
  return String(name).trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
}

/**
 * Catalog id for an ingredient name. Deterministic, so two devices that add or
 * migrate the same ingredient create the same catalog entry (no duplicates after sync).
 */
export function ingredientId(name) {
  return `ing:${nameKey(name)}`;
}

/** Clean up a typed ingredient name: trims, collapses spaces, drops list bullets and a final period. */
export function cleanIngredientName(text) {
  return String(text)
    .replace(/^\s*(?:[-–—•*·]+|\d+[.)])\s*/, '')
    .replace(/[.;,]+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split old free-text recipe notes into ingredient names: one per line, no duplicates. */
export function parseIngredientLines(text) {
  const out = [];
  const seen = new Set();
  for (const line of String(text || '').split(/\r?\n/)) {
    const name = cleanIngredientName(line).slice(0, 120);
    if (!name || seen.has(nameKey(name))) continue;
    seen.add(nameKey(name));
    out.push(name);
  }
  return out;
}

/**
 * One-time migration of recipes that still have the old "notes" text and no ingredient list.
 * Each line of the notes becomes an ingredient, added to the catalog.
 * Mutates `data` (recipes + ingredients). Returns true when something changed.
 */
export function migrateRecipes(data, stamp = Date.now) {
  let changed = false;
  const catalog = new Map(data.ingredients.map((i) => [i.id, i]));
  for (const r of data.recipes) {
    if (r.deletedAt || Array.isArray(r.ingredients)) continue;
    const names = parseIngredientLines(r.notes);
    r.ingredients = names.map((name) => ({ id: ingredientId(name), name }));
    delete r.notes;
    r.updatedAt = stamp();
    changed = true;
    for (const ing of r.ingredients) {
      const existing = catalog.get(ing.id);
      if (existing && !existing.deletedAt) continue;
      const t = stamp();
      if (existing) {
        delete existing.deletedAt;
        Object.assign(existing, { name: ing.name, updatedAt: t });
      } else {
        const item = { id: ing.id, name: ing.name, createdAt: t, updatedAt: t };
        data.ingredients.push(item);
        catalog.set(item.id, item);
      }
    }
  }
  return changed;
}

/** Catalog suggestions for a typed query, excluding ids already in the recipe. */
export function suggestIngredients(catalog, query, excludeIds = [], limit = 30) {
  const q = nameKey(query);
  const skip = new Set(excludeIds);
  return [...catalog]
    .filter((i) => !skip.has(i.id) && (!q || nameKey(i.name).includes(q)))
    .sort((a, b) => {
      // Names that start with the query first, then alphabetical.
      const sa = q && nameKey(a.name).startsWith(q) ? 0 : 1;
      const sb = q && nameKey(b.name).startsWith(q) ? 0 : 1;
      return sa - sb || a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    })
    .slice(0, limit);
}

/* ---------- Shopping ---------- */

/**
 * Group shopping items with the same name so an ingredient needed by several
 * meals shows once. Keeps the order of first appearance.
 */
export function groupShopping(items) {
  const groups = new Map();
  for (const it of items) {
    const k = nameKey(it.text);
    const g = groups.get(k);
    if (g) { g.ids.push(it.id); g.count++; }
    else groups.set(k, { key: k, text: it.text, ids: [it.id], count: 1 });
  }
  return [...groups.values()];
}

/* ---------- Events ---------- */

/**
 * Home-screen indicator for the Events tile: "red" when an event is today,
 * "yellow" when one is tomorrow or the day after, otherwise null. Red wins.
 */
export function eventAlert(events, today) {
  const soon = new Set([addDays(today, 1), addDays(today, 2)]);
  let level = null;
  for (const e of events) {
    if (e.date === today) return 'red';
    if (soon.has(e.date)) level = 'yellow';
  }
  return level;
}

/** Ids of events whose date is before today (they are deleted automatically). */
export function pastEventIds(events, today) {
  return events.filter((e) => e.date < today).map((e) => e.id);
}

/* ---------- Daily check-ins (Language, Habits) ---------- */

/** Id of the check-in item for one section and one day: one item per day, merged last-writer-wins. */
export const checkinId = (kind, date) => `${kind}:${date}`;

/** Map date -> count (only days with at least one completion) for one section. */
export function checkinCounts(checkins, kind) {
  const map = new Map();
  for (const c of checkins) {
    const n = Number(c.count) || 0;
    if (c.kind === kind && n > 0) map.set(c.date, n);
  }
  return map;
}

/**
 * Consecutive days with at least one completion, ending today.
 * If today is not done yet, the streak still counts up to yesterday (it is not broken until the day ends).
 */
export function currentStreak(counts, today) {
  let day = counts.get(today) ? today : addDays(today, -1);
  let n = 0;
  while (counts.get(day)) { n++; day = addDays(day, -1); }
  return n;
}

/* ---------- Sleep (Habits) ---------- */

/** A sleep shorter than this is treated as an accidental double press and is not saved. */
export const SLEEP_MIN_MS = 30 * 60 * 1000;
/** A bedtime with no wake-up after this long is treated as forgotten and ignored. */
export const SLEEP_MAX_MS = 18 * 60 * 60 * 1000;

/** The sleep in progress (bedtime recorded, no wake-up yet), or null. */
export function openSleep(list, now) {
  const open = list.filter((s) => !s.end && now - s.start < SLEEP_MAX_MS);
  return open.sort((a, b) => b.start - a.start)[0] || null;
}

/** Stale bedtimes with no wake-up (forgotten): cleaned up on the next press. */
export function staleSleepIds(list, now) {
  return list.filter((s) => !s.end && now - s.start >= SLEEP_MAX_MS).map((s) => s.id);
}

/**
 * The night a sleep belongs to: the day the bedtime evening started.
 * A bedtime after midnight but before noon (e.g. 01:30) still belongs to the previous day's night.
 */
export function nightOf(start) {
  const d = new Date(start);
  const day = toDateStr(d);
  return d.getHours() < 12 ? addDays(day, -1) : day;
}

/** Finished sleeps by night: Map "YYYY-MM-DD" -> { start, end }. Longest sleep of the night wins. */
export function sleepByDay(list) {
  const map = new Map();
  for (const s of list) {
    if (!s.end || s.end - s.start < SLEEP_MIN_MS) continue;
    const day = nightOf(s.start);
    const cur = map.get(day);
    if (!cur || s.end - s.start > cur.end - cur.start) map.set(day, { start: s.start, end: s.end });
  }
  return map;
}

const pad2 = (n) => String(n).padStart(2, '0');

/** "23:40" in local time. */
export function clockTime(ms) {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "7h 35m" */
export function formatDuration(ms) {
  const m = Math.round(ms / 60000);
  return `${Math.floor(m / 60)}h ${pad2(m % 60)}m`;
}

/* ---------- Habits: two Done buttons (Language and Habit) ---------- */

/** Presses allowed per day in the Habits section. */
export const HABIT_MAX = { language: 1, habits: 3 };
/** Days with at least this many presses in total get a tick in the calendar (and count for the streak). */
export const HABITS_TICK = 2;

/**
 * Total presses per day for the Habits section: Map date -> { language, habits, total }.
 * Language keeps its own check-in items (kind "language"), so its old history still counts.
 */
export function habitDays(checkins) {
  const map = new Map();
  for (const c of checkins) {
    if (c.kind !== 'language' && c.kind !== 'habits') continue;
    const n = Math.min(Math.max(Number(c.count) || 0, 0), HABIT_MAX[c.kind]);
    if (!n) continue;
    const d = map.get(c.date) || { language: 0, habits: 0, total: 0 };
    d[c.kind] = n;
    d.total = d.language + d.habits;
    map.set(c.date, d);
  }
  return map;
}

/** Map date -> total, only for days with a tick (2 presses or more). Used for the streak. */
export function tickDays(days) {
  const map = new Map();
  for (const [date, d] of days) if (d.total >= HABITS_TICK) map.set(date, d.total);
  return map;
}

/* ---------- Waste (time lost) ---------- */

/** Minutes typed by the user: a whole number from 1 to 1440, or null. */
export function parseMinutes(text) {
  const t = String(text).trim();
  if (!/^\d{1,4}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= 1440 ? n : null;
}

/** Map date -> total minutes wasted that day. Each "+" is one entry, so two devices never overwrite each other. */
export function wasteByDay(entries) {
  const map = new Map();
  for (const e of entries) {
    const m = Number(e.minutes) || 0;
    if (m > 0) map.set(e.date, (map.get(e.date) || 0) + m);
  }
  return map;
}

/** "45 min", "1 h", "1 h 20 min": minutes below one hour, hours above. */
export function formatMinutes(total) {
  const m = Math.max(0, Math.round(total));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

/** Short form for a calendar cell: "45m", "1h", "1h20". */
export function formatMinutesShort(total) {
  const m = Math.max(0, Math.round(total));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h${pad2(m % 60)}` : `${h}h`;
}

/* ---------- Water ---------- */

/** Glasses of water a day that fill the bottle. */
export const WATER_GLASSES = 5;
