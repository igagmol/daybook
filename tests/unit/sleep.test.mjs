import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nightOf, openSleep, staleSleepIds, sleepByDay, clockTime, formatDuration, SLEEP_MIN_MS } from '../../js/logic.js';

const at = (d, h, m = 0) => new Date(2026, 10, d, h, m).getTime();

test('sleep: open bedtime is found, forgotten ones are stale', () => {
  const list = [{ id: 'a', start: at(20, 23), end: 0 }, { id: 'b', start: at(22, 23), end: 0 }];
  assert.equal(openSleep(list, at(23, 1)).id, 'b');
  assert.deepEqual(staleSleepIds(list, at(23, 1)), ['a']);
  assert.equal(openSleep([{ id: 'c', start: at(22, 23), end: at(23, 7) }], at(23, 8)), null);
});

test('sleep: belongs to the night it started, even after midnight', () => {
  assert.equal(nightOf(at(22, 23, 40)), '2026-11-22');
  assert.equal(nightOf(at(23, 1, 30)), '2026-11-22');
  assert.equal(nightOf(at(23, 2)), '2026-11-22');
  assert.equal(nightOf(at(1, 1)), '2026-10-31');
  assert.equal(nightOf(at(23, 15)), '2026-11-23');
  const map = sleepByDay([{ id: 'a', start: at(22, 23, 40), end: at(23, 7, 15) }]);
  assert.deepEqual([...map.keys()], ['2026-11-22']);
  const s = map.get('2026-11-22');
  assert.equal(`${clockTime(s.start)} → ${clockTime(s.end)}`, '23:40 → 07:15');
  assert.equal(formatDuration(s.end - s.start), '7h 35m');
});

test('sleep: too short is ignored, longest of the day wins', () => {
  const map = sleepByDay([
    { id: 'a', start: at(23, 0, 30), end: at(23, 7) },
    { id: 'b', start: at(23, 15), end: at(23, 15) + SLEEP_MIN_MS - 1 },
    { id: 'c', start: at(22, 22), end: at(22, 23) },
  ]);
  assert.equal(map.get('2026-11-22').start, at(23, 0, 30));
  assert.equal(map.size, 1);
});
