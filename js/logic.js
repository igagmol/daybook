// Pure list logic used by the sections. Unit tested.

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
