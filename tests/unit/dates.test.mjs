import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayStr, addDays, weekWindow, monthGrid, isValidDateStr, weekdayShort, formatLong, toDateStr } from '../../js/dates.js';

test('todayStr uses local time', () => {
  assert.equal(todayStr(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(todayStr(new Date(2026, 0, 5, 0, 1)), '2026-01-05');
});

test('addDays crosses months, years and DST without drifting', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-28', 2), '2026-03-30'); // EU DST change on 29 March
  assert.equal(addDays('2026-10-24', 2), '2026-10-26');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('7-day window: today plus 6 days', () => {
  const w = weekWindow('2026-11-28');
  assert.equal(w.length, 7);
  assert.equal(w[0], '2026-11-28');
  assert.equal(w[6], '2026-12-04');
});

test('month grid starts on Monday and covers the month', () => {
  const g = monthGrid(2026, 10); // November 2026, 1st is a Sunday
  assert.equal(g[0][0].date, '2026-10-26');
  assert.equal(g[0][6].date, '2026-11-01');
  assert.ok(g.every((w) => w.length === 7));
  const inMonth = g.flat().filter((c) => c.inMonth);
  assert.equal(inMonth.length, 30);
  assert.equal(weekdayShort(g[0][0].date), 'Mon');
});

test('date validation', () => {
  assert.ok(isValidDateStr('2026-02-28'));
  assert.ok(!isValidDateStr('2026-02-30'));
  assert.ok(!isValidDateStr('2026-2-3'));
  assert.ok(!isValidDateStr(''));
});

test('formatLong labels', () => {
  assert.equal(formatLong('2026-11-19', '2026-11-19'), 'Today');
  assert.equal(formatLong('2026-11-20', '2026-11-19'), 'Tomorrow');
  assert.equal(formatLong('2026-11-23', '2026-11-19'), 'Monday 23 November');
  assert.equal(formatLong('2027-01-04', '2026-11-19'), 'Monday 4 January 2027');
});

test('toDateStr pads', () => {
  assert.equal(toDateStr(new Date(2026, 2, 7)), '2026-03-07');
});
