import * as store from '../store.js';
import { el, icon, openSheet, confirmSheet, swipeRow, field } from '../ui.js';
import { weekWindow, weekdayShort, dayNumber, formatLong } from '../dates.js';
import { sortRecipes, filterRecipes } from '../logic.js';

const SLOTS = [
  ['breakfast', 'Breakfast'],
  ['lunch', 'Lunch'],
  ['snack', 'Snack'],
  ['dinner', 'Dinner'],
];

export function createMeals(ctx) {
  let selected = null;
  const strip = el('div', { class: 'day-strip', role: 'tablist', 'aria-label': 'Days' });
  const cards = el('div', { class: 'meal-cards' });

  function recipesById() {
    return new Map(store.list('recipes').map((r) => [r.id, r]));
  }

  function render() {
    const today = ctx.today();
    const days = weekWindow(today);
    if (!days.includes(selected)) selected = today;

    strip.replaceChildren(
      ...days.map((d) =>
        el('button', {
          type: 'button',
          role: 'tab',
          class: 'day-chip',
          'aria-selected': String(d === selected),
          'aria-label': formatLong(d, today),
          onclick: () => { selected = d; render(); },
        }, [
          el('span', { class: 'chip-wd', text: d === today ? 'Today' : weekdayShort(d) }),
          el('span', { class: 'chip-num', text: String(dayNumber(d)) }),
        ]),
      ),
    );

    const byId = recipesById();
    const meals = store.list('meals').filter((m) => m.date === selected && byId.has(m.recipeId));
    cards.replaceChildren(
      ...SLOTS.map(([slot, label]) => {
        const items = meals.filter((m) => m.slot === slot);
        return el('section', { class: 'card meal-card', 'aria-label': label }, [
          el('div', { class: 'card-head' }, [
            el('h2', { class: 'card-title', text: label }),
            el('button', {
              type: 'button', class: 'icon-btn icon-btn-primary', 'aria-label': `Add to ${label}`,
              onclick: () => openPicker(selected, slot, label),
            }, [icon('plus', 22)]),
          ]),
          items.length
            ? el('ul', { class: 'rows rows-inset' }, items.map((m) => {
              const r = byId.get(m.recipeId);
              return swipeRow(el('div', { class: 'row-card row-card-inset' }, [el('span', { class: 'row-text', text: r.name })]),
                () => store.remove('meals', m.id), { label: r.name });
            }))
            : null,
        ]);
      }),
    );
  }

  function openPicker(date, slot, slotLabel) {
    const search = el('input', { type: 'search', class: 'input', placeholder: 'Search', autocomplete: 'off', 'aria-label': 'Search recipes', enterkeyhint: 'search' });
    const listEl = el('ul', { class: 'pick-list' });
    const all = sortRecipes(store.list('recipes'));
    const assign = (recipeId) => {
      store.add('meals', { date, slot, recipeId });
      sheet.close();
    };
    const newRow = el('li', {}, [
      el('button', {
        type: 'button', class: 'pick-row pick-new',
        onclick: () => {
          sheet.close();
          openRecipeForm({ onSaved: (r) => store.add('meals', { date, slot, recipeId: r.id }) });
        },
      }, [icon('plus', 20), el('span', { text: 'New recipe' })]),
    ]);
    const draw = () => {
      const rows = filterRecipes(all, search.value).map((r) =>
        el('li', {}, [el('button', { type: 'button', class: 'pick-row', text: r.name, onclick: () => assign(r.id) })]));
      listEl.replaceChildren(newRow, ...rows);
    };
    search.addEventListener('input', draw);
    draw();
    const sheet = openSheet({ title: `${slotLabel} · ${formatLong(date, ctx.today())}`, content: [search, listEl], focus: search });
    sheet.el.classList.add('sheet-tall');
  }

  /** Recipe form: create (optionally assign via onSaved) or edit an existing recipe. */
  function openRecipeForm({ recipe = null, onSaved } = {}) {
    const name = el('input', { type: 'text', class: 'input', autocomplete: 'off', maxlength: '120', value: recipe?.name || '' });
    const notes = el('textarea', { class: 'input textarea', rows: '4', maxlength: '4000' });
    notes.value = recipe?.notes || '';
    const error = el('p', { class: 'field-error', role: 'alert' });
    const buttons = [el('button', { class: 'btn btn-primary btn-block', type: 'submit', text: 'Save' })];
    if (recipe) {
      buttons.push(el('button', { class: 'btn btn-danger btn-block', type: 'button', text: 'Delete', onclick: () => deleteRecipe(recipe, sheet) }));
    }
    const form = el('form', { class: 'sheet-form' }, [
      field('Name', name),
      field('Notes (optional)', notes),
      error,
      ...buttons,
    ]);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const n = name.value.trim();
      if (!n) { error.textContent = 'Enter a name.'; name.focus(); return; }
      let saved;
      if (recipe) saved = store.update('recipes', recipe.id, { name: n, notes: notes.value.trim() });
      else saved = store.add('recipes', { name: n, notes: notes.value.trim() });
      sheet.close();
      onSaved?.(saved);
    });
    const sheet = openSheet({ title: recipe ? 'Edit recipe' : 'New recipe', content: form, focus: name });
  }

  async function deleteRecipe(recipe, formSheet) {
    const uses = store.list('meals').filter((m) => m.recipeId === recipe.id);
    if (uses.length) {
      const n = uses.length;
      const ok = await confirmSheet({
        title: 'Delete recipe?',
        message: `“${recipe.name}” is used in ${n} planned meal${n === 1 ? '' : 's'}. Deleting it also removes it from ${n === 1 ? 'that day' : 'those days'}.`,
        confirmLabel: 'Delete',
      });
      if (!ok) return;
      store.remove('meals', uses.map((m) => m.id));
    }
    store.remove('recipes', recipe.id);
    formSheet.close();
  }

  function openManage() {
    const listEl = el('ul', { class: 'pick-list' });
    const draw = () => {
      listEl.replaceChildren(
        ...sortRecipes(store.list('recipes')).map((r) =>
          el('li', {}, [el('button', {
            type: 'button', class: 'pick-row', text: r.name,
            onclick: () => openRecipeForm({ recipe: r }),
          })])),
      );
    };
    draw();
    const off = store.onChange(draw);
    const addBtn = el('button', {
      type: 'button', class: 'icon-btn icon-btn-primary', 'aria-label': 'Add recipe',
      onclick: () => openRecipeForm(),
    }, [icon('plus', 22)]);
    const sheet = openSheet({ title: 'Recipes', content: [el('div', { class: 'sheet-actions' }, [addBtn]), listEl], onClose: off });
    sheet.el.classList.add('sheet-tall');
  }

  return {
    id: 'meals',
    title: 'Meals',
    top: [strip],
    body: [cards],
    footer: [el('button', { class: 'btn btn-secondary btn-wide', type: 'button', text: 'Manage recipes', onclick: openManage })],
    render,
  };
}
