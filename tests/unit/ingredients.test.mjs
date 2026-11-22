import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ingredientId, cleanIngredientName, parseIngredientLines, migrateRecipes,
  suggestIngredients, groupShopping, eventAlert, pastEventIds,
} from '../../js/logic.js';
import { mergeData, emptyData } from '../../js/merge.js';

test('ingredient ids ignore case and extra spaces', () => {
  assert.equal(ingredientId('  Tomate   frito '), ingredientId('tomate frito'));
  assert.notEqual(ingredientId('tomate'), ingredientId('tomates'));
});

test('clean names: bullets, numbering and final period go', () => {
  assert.equal(cleanIngredientName('- Arroz.'), 'Arroz');
  assert.equal(cleanIngredientName('2) Pollo  asado'), 'Pollo asado');
  assert.equal(cleanIngredientName('• Leche;'), 'Leche');
  assert.equal(cleanIngredientName('   '), '');
});

test('old notes split into one ingredient per line, no blanks or duplicates', () => {
  assert.deepEqual(parseIngredientLines('Arroz.\n\nPollo\r\narroz\n - Pimiento rojo '), ['Arroz', 'Pollo', 'Pimiento rojo']);
  assert.deepEqual(parseIngredientLines(''), []);
  assert.deepEqual(parseIngredientLines(undefined), []);
});

test('migration turns notes into ingredients and fills the catalog once', () => {
  let t = 100;
  const stamp = () => ++t;
  const data = emptyData();
  data.recipes = [
    { id: 'r1', name: 'Paella', notes: 'Arroz\nPollo', createdAt: 1, updatedAt: 1 },
    { id: 'r2', name: 'Pollo al horno', notes: 'pollo\nPatatas', createdAt: 2, updatedAt: 2 },
    { id: 'r3', name: 'Done', ingredients: [{ id: 'ing:x', name: 'X' }], createdAt: 3, updatedAt: 3 },
    { id: 'r4', name: 'Empty', notes: '', createdAt: 4, updatedAt: 4 },
    { id: 'r5', name: 'Gone', notes: 'Sal', createdAt: 5, updatedAt: 5, deletedAt: 5 },
  ];
  assert.equal(migrateRecipes(data, stamp), true);
  assert.deepEqual(data.recipes[0].ingredients, [{ id: 'ing:arroz', name: 'Arroz' }, { id: 'ing:pollo', name: 'Pollo' }]);
  assert.equal('notes' in data.recipes[0], false);
  assert.deepEqual(data.recipes[1].ingredients.map((i) => i.id), ['ing:pollo', 'ing:patatas']);
  assert.equal(data.recipes[2].updatedAt, 3);
  assert.deepEqual(data.recipes[3].ingredients, []);
  assert.equal(data.recipes[4].ingredients, undefined);
  assert.deepEqual(data.ingredients.map((i) => i.name).sort(), ['Arroz', 'Patatas', 'Pollo']);
  assert.equal(migrateRecipes(data, stamp), false, 'idempotent');
});

test('two devices migrating the same recipe end up with one catalog entry each', () => {
  const make = (base) => {
    let t = base;
    const d = emptyData();
    d.recipes = [{ id: 'r1', name: 'Paella', notes: 'Arroz\nGambas', createdAt: 1, updatedAt: 1 }];
    migrateRecipes(d, () => ++t);
    return d;
  };
  const merged = mergeData(make(100), make(200));
  assert.deepEqual(merged.ingredients.map((i) => i.id).sort(), ['ing:arroz', 'ing:gambas']);
  assert.equal(merged.recipes.length, 1);
  assert.equal(merged.recipes[0].ingredients.length, 2);
});

test('suggestions: matches first by prefix, excludes the recipe ones', () => {
  const cat = [{ id: 'ing:pan', name: 'Pan' }, { id: 'ing:pimiento', name: 'Pimiento' }, { id: 'ing:tomate', name: 'Tomate' }, { id: 'ing:espinacas', name: 'Espinacas' }];
  assert.deepEqual(suggestIngredients(cat, 'pi').map((i) => i.name), ['Pimiento', 'Espinacas']);
  assert.deepEqual(suggestIngredients(cat, 'n').map((i) => i.name), ['Espinacas', 'Pan', 'Pimiento']);
  assert.deepEqual(suggestIngredients(cat, '', ['ing:pan']).map((i) => i.name), ['Espinacas', 'Pimiento', 'Tomate']);
});

test('shopping groups the same item from several meals', () => {
  const g = groupShopping([
    { id: 'a', text: 'Tomate' }, { id: 'b', text: 'Leche' }, { id: 'c', text: 'tomate ' },
  ]);
  assert.deepEqual(g.map((x) => [x.text, x.count, x.ids]), [['Tomate', 2, ['a', 'c']], ['Leche', 1, ['b']]]);
});

test('events dot: red today, yellow 1–2 days ahead, red wins, nothing otherwise', () => {
  const today = '2026-11-30';
  assert.equal(eventAlert([], today), null);
  assert.equal(eventAlert([{ date: '2026-12-03' }], today), null);
  assert.equal(eventAlert([{ date: '2026-12-02' }], today), 'yellow');
  assert.equal(eventAlert([{ date: '2026-12-01' }], today), 'yellow');
  assert.equal(eventAlert([{ date: '2026-12-01' }, { date: today }], today), 'red');
});

test('past events are picked for deletion, today and later stay', () => {
  const ev = [{ id: '1', date: '2026-11-29' }, { id: '2', date: '2026-11-30' }, { id: '3', date: '2027-01-01' }];
  assert.deepEqual(pastEventIds(ev, '2026-11-30'), ['1']);
});
