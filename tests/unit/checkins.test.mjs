import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkinId, checkinCounts, currentStreak } from '../../js/logic.js';
import { mergeData } from '../../js/merge.js';

const counts = (obj) => new Map(Object.entries(obj));

test('checkins: one id per section and day', () => {
  assert.equal(checkinId('habits', '2026-11-22'), 'habits:2026-11-22');
});

test('checkins: counts per kind, zero counts ignored', () => {
  const list = [
    { id: 'a', kind: 'language', date: '2026-11-20', count: 1 },
    { id: 'b', kind: 'habits', date: '2026-11-20', count: 3 },
    { id: 'c', kind: 'habits', date: '2026-11-21', count: 0 },
  ];
  assert.deepEqual([...checkinCounts(list, 'habits')], [['2026-11-20', 3]]);
  assert.deepEqual([...checkinCounts(list, 'language')], [['2026-11-20', 1]]);
});

test('streak: counts back from today', () => {
  assert.equal(currentStreak(counts({ '2026-11-22': 1, '2026-11-21': 2, '2026-11-20': 1, '2026-11-18': 1 }), '2026-11-22'), 3);
});

test('streak: not broken while today is still open', () => {
  assert.equal(currentStreak(counts({ '2026-11-21': 1, '2026-11-20': 1 }), '2026-11-22'), 2);
});

test('streak: broken by a missed day, across month boundaries', () => {
  assert.equal(currentStreak(counts({ '2026-11-20': 1 }), '2026-11-22'), 0);
  assert.equal(currentStreak(counts({ '2026-12-01': 1, '2026-11-30': 1, '2026-11-29': 1 }), '2026-12-01'), 3);
  assert.equal(currentStreak(new Map(), '2026-11-22'), 0);
});

test('checkins: merged last-writer-wins per day', () => {
  const a = { checkins: [{ id: 'habits:2026-11-22', kind: 'habits', date: '2026-11-22', count: 1, createdAt: 1, updatedAt: 5 }] };
  const b = { checkins: [{ id: 'habits:2026-11-22', kind: 'habits', date: '2026-11-22', count: 2, createdAt: 2, updatedAt: 9 }] };
  assert.equal(mergeData(a, b).checkins[0].count, 2);
  assert.equal(mergeData(b, a).checkins[0].count, 2);
});
