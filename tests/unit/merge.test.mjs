import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeData, mergeItem, mergeList, mergeNote, emptyData, pruneTombstones, live, TOMBSTONE_TTL_MS } from '../../js/merge.js';

const item = (id, updatedAt, extra = {}) => ({ id, createdAt: 1, updatedAt, ...extra });

test('union by id keeps items from both sides', () => {
  const out = mergeList([item('a', 1)], [item('b', 2)]);
  assert.deepEqual(out.map((i) => i.id).sort(), ['a', 'b']);
});

test('last writer wins on updatedAt', () => {
  const out = mergeItem(item('a', 5, { text: 'old' }), item('a', 9, { text: 'new' }));
  assert.equal(out.text, 'new');
  assert.equal(mergeItem(item('a', 9, { text: 'new' }), item('a', 5, { text: 'old' })).text, 'new');
});

test('tombstone wins when deletedAt >= updatedAt', () => {
  const deleted = item('a', 10, { deletedAt: 10 });
  const edited = item('a', 8, { text: 'x' });
  assert.equal(mergeItem(deleted, edited).deletedAt, 10);
  assert.equal(mergeItem(edited, deleted).deletedAt, 10);
});

test('an edit newer than the tombstone wins', () => {
  const deleted = item('a', 10, { deletedAt: 10 });
  const edited = item('a', 12, { text: 'back' });
  const out = mergeItem(deleted, edited);
  assert.equal(out.deletedAt, undefined);
  assert.equal(out.text, 'back');
});

test('completed task never comes back after sync with an old copy', () => {
  const local = { ...emptyData(), tasks: [item('t1', 20, { name: 'x', deletedAt: 20 })] };
  const remote = { ...emptyData(), tasks: [item('t1', 5, { name: 'x' })] };
  const merged = mergeData(local, remote, 30);
  assert.equal(live(merged.tasks).length, 0);
  assert.equal(merged.tasks.length, 1, 'tombstone is kept');
});

test('merge is commutative and idempotent', () => {
  const a = { ...emptyData(), shopping: [item('1', 3, { text: 'milk' }), item('2', 4, { text: 'eggs' })], note: { text: 'A', updatedAt: 5 } };
  const b = { ...emptyData(), shopping: [item('1', 6, { text: 'oat milk' }), item('3', 1, { text: 'jam' })], note: { text: 'B', updatedAt: 4 } };
  const ab = mergeData(a, b, 100);
  const ba = mergeData(b, a, 100);
  assert.deepEqual(ab, ba);
  assert.deepEqual(mergeData(ab, ab, 100), ab);
  assert.equal(ab.note.text, 'A');
  assert.equal(ab.shopping.find((i) => i.id === '1').text, 'oat milk');
});

test('equal timestamps resolve deterministically', () => {
  const x = item('a', 5, { text: 'x' });
  const y = item('a', 5, { text: 'y' });
  assert.deepEqual(mergeItem(x, y), mergeItem(y, x));
});

test('missing or empty remote never empties local data', () => {
  const local = { ...emptyData(), money: [item('m', 2, { amount: 100 })], note: { text: 'hi', updatedAt: 3 } };
  for (const remote of [null, undefined, {}, emptyData(), 'garbage']) {
    const out = mergeData(local, remote, 10);
    assert.equal(out.money.length, 1);
    assert.equal(out.note.text, 'hi');
  }
});

test('note is last-writer-wins', () => {
  assert.equal(mergeNote({ text: 'a', updatedAt: 1 }, { text: 'b', updatedAt: 2 }).text, 'b');
  assert.equal(mergeNote({ text: 'a', updatedAt: 3 }, { text: 'b', updatedAt: 2 }).text, 'a');
});

test('tombstones are pruned only after one year; live items never', () => {
  const now = 10 * TOMBSTONE_TTL_MS;
  const data = {
    ...emptyData(),
    events: [
      item('old', 1, { deletedAt: now - TOMBSTONE_TTL_MS - 1 }),
      item('recent', 1, { deletedAt: now - 1000 }),
      item('ancient-live', 1),
    ],
  };
  const out = pruneTombstones(data, now);
  assert.deepEqual(out.events.map((e) => e.id).sort(), ['ancient-live', 'recent']);
});

test('output has schema version', () => {
  assert.equal(mergeData({}, {}).version, 1);
});
