import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  habitDays, tickDays, currentStreak, parseMinutes, wasteByDay, formatMinutes, formatMinutesShort,
} from '../../js/logic.js';
import { mergeData, emptyData } from '../../js/merge.js';

test('habits: Language and Habit presses add up per day, capped per button', () => {
  const list = [
    { id: 'language:2026-11-20', kind: 'language', date: '2026-11-20', count: 1 },
    { id: 'habits:2026-11-20', kind: 'habits', date: '2026-11-20', count: 3 },
    { id: 'habits:2026-11-21', kind: 'habits', date: '2026-11-21', count: 1 },
    { id: 'language:2026-11-22', kind: 'language', date: '2026-11-22', count: 5 },
    { id: 'water:2026-11-22', kind: 'water', date: '2026-11-22', count: 4 },
  ];
  const days = habitDays(list);
  assert.deepEqual(days.get('2026-11-20'), { language: 1, habits: 3, total: 4 });
  assert.deepEqual(days.get('2026-11-21'), { language: 0, habits: 1, total: 1 });
  assert.deepEqual(days.get('2026-11-22'), { language: 1, habits: 0, total: 1 });
});

test('habits: a tick needs two presses in total (two Habit, or Language + Habit)', () => {
  const list = [
    { kind: 'habits', date: '2026-11-20', count: 2 },
    { kind: 'language', date: '2026-11-21', count: 1 },
    { kind: 'habits', date: '2026-11-21', count: 1 },
    { kind: 'language', date: '2026-11-22', count: 1 },
  ];
  const ticks = tickDays(habitDays(list));
  assert.deepEqual([...ticks], [['2026-11-20', 2], ['2026-11-21', 2]]);
  assert.equal(currentStreak(ticks, '2026-11-22'), 2);
});

test('waste: minutes typed', () => {
  assert.equal(parseMinutes('5'), 5);
  assert.equal(parseMinutes(' 90 '), 90);
  for (const bad of ['', '0', '-5', '2.5', 'abc', '1441']) assert.equal(parseMinutes(bad), null, bad);
});

test('waste: entries add up per day', () => {
  const map = wasteByDay([
    { date: '2026-11-20', minutes: 5 }, { date: '2026-11-20', minutes: 30 }, { date: '2026-11-21', minutes: 0 },
  ]);
  assert.deepEqual([...map], [['2026-11-20', 35]]);
});

test('waste: minutes below one hour, hours above', () => {
  assert.equal(formatMinutes(45), '45 min');
  assert.equal(formatMinutes(60), '1 h');
  assert.equal(formatMinutes(80), '1 h 20 min');
  assert.equal(formatMinutesShort(45), '45m');
  assert.equal(formatMinutesShort(120), '2h');
  assert.equal(formatMinutesShort(65), '1h05');
});

test('waste: entries from two devices are all kept after sync', () => {
  const a = emptyData();
  const b = emptyData();
  a.waste.push({ id: 'x', date: '2026-11-20', minutes: 5, createdAt: 1, updatedAt: 1 });
  b.waste.push({ id: 'y', date: '2026-11-20', minutes: 10, createdAt: 2, updatedAt: 2 });
  assert.equal(wasteByDay(mergeData(a, b).waste).get('2026-11-20'), 15);
});
