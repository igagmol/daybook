import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortTasks, isOverdue, upcomingGroups, sortRecipes, filterRecipes, parseAmount, formatEuro } from '../../js/logic.js';

test('tasks: priority asc, then due asc, then creation', () => {
  const tasks = [
    { id: 'a', priority: 3, due: '2026-11-20', createdAt: 1 },
    { id: 'b', priority: 1, due: '2026-12-01', createdAt: 2 },
    { id: 'c', priority: 1, due: '2026-11-25', createdAt: 3 },
    { id: 'd', priority: 1, due: '2026-11-25', createdAt: 1 },
    { id: 'e', priority: 5, due: '2026-11-01', createdAt: 0 },
  ];
  assert.deepEqual(sortTasks(tasks).map((t) => t.id), ['d', 'c', 'b', 'a', 'e']);
});

test('overdue', () => {
  assert.ok(isOverdue('2026-11-18', '2026-11-19'));
  assert.ok(!isOverdue('2026-11-19', '2026-11-19'));
});

test('upcoming events grouped by date, past hidden', () => {
  const events = [
    { id: '1', date: '2026-11-18', title: 'past', createdAt: 1 },
    { id: '2', date: '2026-11-21', time: '18:00', title: 'b', createdAt: 2 },
    { id: '3', date: '2026-11-21', time: '09:00', title: 'a', createdAt: 3 },
    { id: '4', date: '2026-11-19', title: 'today', createdAt: 4 },
  ];
  const g = upcomingGroups(events, '2026-11-19');
  assert.deepEqual(g.map((x) => x.date), ['2026-11-19', '2026-11-21']);
  assert.deepEqual(g[1].events.map((e) => e.id), ['3', '2']);
});

test('recipes alphabetical (case-insensitive) and filter', () => {
  const r = [{ name: 'pasta' }, { name: 'Apple pie' }, { name: 'banana bread' }];
  assert.deepEqual(sortRecipes(r).map((x) => x.name), ['Apple pie', 'banana bread', 'pasta']);
  assert.deepEqual(filterRecipes(r, 'BREAD').map((x) => x.name), ['banana bread']);
});

test('amount parsing to cents', () => {
  assert.equal(parseAmount('12'), 1200);
  assert.equal(parseAmount('12,5'), 1250);
  assert.equal(parseAmount('12.05'), 1205);
  assert.equal(parseAmount('0.1'), 10);
  assert.equal(parseAmount(',5'), 50);
  assert.equal(parseAmount('.5'), 50);
  assert.equal(parseAmount('0'), null);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount('1.234'), null);
});

test('euro formatting, two decimals', () => {
  assert.equal(formatEuro(1250), '€12.50');
  assert.equal(formatEuro(5), '€0.05');
  assert.equal(formatEuro(123456789), '€1,234,567.89');
});
