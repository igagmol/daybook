// Pure merge logic for sync. No DOM, no storage: safe to unit test with node --test.

export const SCHEMA_VERSION = 1;
export const COLLECTIONS = ['shopping', 'recipes', 'ingredients', 'meals', 'money', 'events', 'tasks', 'checkins', 'sleep'];
export const TOMBSTONE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export function emptyData() {
  const data = { version: SCHEMA_VERSION, note: { text: '', updatedAt: 0 } };
  for (const c of COLLECTIONS) data[c] = [];
  return data;
}

/** Fill missing fields so older or partial objects are safe to use. */
export function normalize(raw) {
  const data = emptyData();
  if (!raw || typeof raw !== 'object') return data;
  for (const c of COLLECTIONS) {
    if (Array.isArray(raw[c])) {
      data[c] = raw[c].filter((it) => it && typeof it === 'object' && typeof it.id === 'string');
    }
  }
  if (raw.note && typeof raw.note === 'object') {
    data.note = {
      text: typeof raw.note.text === 'string' ? raw.note.text : '',
      updatedAt: Number(raw.note.updatedAt) || 0,
    };
  }
  return data;
}

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);

/** Deterministic tie-break so merge(a,b) === merge(b,a). */
function stable(a, b) {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  return sa >= sb ? a : b;
}

/** Merge two versions of the same item (same id). */
export function mergeItem(a, b) {
  if (!a) return b;
  if (!b) return a;
  const ua = num(a.updatedAt);
  const ub = num(b.updatedAt);
  const winner = ua > ub ? a : ub > ua ? b : stable(a, b);
  const result = { ...winner };
  const deletedAt = Math.max(num(a.deletedAt), num(b.deletedAt));
  if (deletedAt && deletedAt >= num(result.updatedAt)) {
    result.deletedAt = deletedAt;
  } else {
    delete result.deletedAt;
  }
  return result;
}

/** Union by id with last-writer-wins and tombstones. Output is sorted by createdAt, then id. */
export function mergeList(listA = [], listB = []) {
  const map = new Map();
  for (const it of listA) map.set(it.id, mergeItem(map.get(it.id), it));
  for (const it of listB) map.set(it.id, mergeItem(map.get(it.id), it));
  return [...map.values()].sort(
    (x, y) => num(x.createdAt) - num(y.createdAt) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0),
  );
}

export function mergeNote(a, b) {
  const na = a || { text: '', updatedAt: 0 };
  const nb = b || { text: '', updatedAt: 0 };
  const ua = num(na.updatedAt);
  const ub = num(nb.updatedAt);
  if (ua !== ub) return { ...(ua > ub ? na : nb) };
  return { ...stable(na, nb) };
}

/** Remove tombstones older than one year. Never touches live items. */
export function pruneTombstones(data, now = Date.now()) {
  const out = { ...data };
  for (const c of COLLECTIONS) {
    out[c] = (data[c] || []).filter((it) => !(it.deletedAt && now - it.deletedAt > TOMBSTONE_TTL_MS));
  }
  return out;
}

/** Merge two full data objects. Pure and commutative. */
export function mergeData(a, b, now = Date.now()) {
  const da = normalize(a);
  const db = normalize(b);
  const out = { version: SCHEMA_VERSION };
  for (const c of COLLECTIONS) out[c] = mergeList(da[c], db[c]);
  out.note = mergeNote(da.note, db.note);
  return pruneTombstones(out, now);
}

/** Items that are not tombstoned. */
export function live(list) {
  return (list || []).filter((it) => !it.deletedAt);
}

/** True when both data objects hold the same content. */
export function sameData(a, b) {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}
