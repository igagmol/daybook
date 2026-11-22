import * as store from '../store.js';
import { el, icon, openSheet, confirmSheet, swipeRow, field } from '../ui.js';
import { weekWindow, weekdayShort, dayNumber, formatLong } from '../dates.js';
import { sortRecipes, filterRecipes, ingredientId, cleanIngredientName, suggestIngredients } from '../logic.js';

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
              const inCart = cartItemsOf(m.id).length;
              const card = el('button', {
                type: 'button', class: 'row-card row-card-inset row-btn', 'aria-label': `${r.name}, ingredients`,
                onclick: () => openMeal(m.id),
              }, [
                el('span', { class: 'row-text', text: r.name }),
                inCart ? el('span', { class: 'row-meta row-cart', 'aria-label': `${inCart} in shopping list` }, [icon('cart', 18), el('span', { text: String(inCart) })]) : null,
                el('span', { class: 'row-chevron' }, [icon('next', 18)]),
              ]);
              return swipeRow(card, () => removeMeals([m.id]), { label: r.name });
            }))
            : null,
        ]);
      }),
    );
  }

  /* ---------- Shopping cart links ---------- */

  /** Shopping items that were sent to the list from this planned meal. */
  function cartItemsOf(mealId, ingId) {
    return store.list('shopping').filter((it) => it.mealId === mealId && (ingId == null || it.ingredientId === ingId));
  }

  function setInCart(meal, ing, on) {
    const existing = cartItemsOf(meal.id, ing.id);
    if (on && !existing.length) store.add('shopping', { text: ing.name, mealId: meal.id, ingredientId: ing.id });
    if (!on && existing.length) store.remove('shopping', existing.map((it) => it.id));
  }

  /** Remove planned meals and the ingredients they put on the shopping list. */
  function removeMeals(mealIds) {
    const set = new Set(mealIds);
    const linked = store.list('shopping').filter((it) => set.has(it.mealId)).map((it) => it.id);
    if (linked.length) store.remove('shopping', linked);
    store.remove('meals', mealIds);
  }

  /* ---------- A planned meal: its ingredients with shopping-cart switches ---------- */

  function openMeal(mealId) {
    const listEl = el('ul', { class: 'ing-list', 'aria-label': 'Ingredients' });
    const hint = el('p', { class: 'field-hint ing-hint', text: 'Turn on the cart for what you need to buy. It goes straight to Shopping.' });
    const empty = el('p', { class: 'empty', text: 'This recipe has no ingredients yet.' });
    const editBtn = el('button', { type: 'button', class: 'btn btn-secondary btn-block', text: 'Edit recipe' });
    let sheet = null;

    const draw = () => {
      const meal = store.find('meals', mealId);
      const recipe = meal && store.find('recipes', meal.recipeId);
      if (!meal || !recipe) { sheet?.close(); return; }
      const ings = recipe.ingredients || [];
      const cart = new Set(cartItemsOf(meal.id).map((it) => it.ingredientId));
      empty.hidden = ings.length > 0;
      hint.hidden = ings.length === 0;
      const focusedId = listEl.contains(document.activeElement) ? document.activeElement.dataset.ing : null;
      listEl.replaceChildren(...ings.map((ing) => {
        const on = cart.has(ing.id);
        return el('li', { class: 'ing-row' }, [
          el('span', { class: 'row-text', text: ing.name }),
          el('button', {
            type: 'button', role: 'switch', class: 'cart-switch', 'aria-checked': String(on),
            'aria-label': `${ing.name}: add to shopping list`,
            dataset: { ing: ing.id },
            onclick: () => setInCart(meal, ing, !on),
          }, [el('span', { class: 'cart-knob' }, [icon('cart', 16)])]),
        ]);
      }));
      // Keep focus on the switch that was just toggled.
      if (focusedId) [...listEl.querySelectorAll('.cart-switch')].find((b) => b.dataset.ing === focusedId)?.focus({ preventScroll: true });
      editBtn.onclick = () => openRecipeForm({ recipe });
      if (sheet) sheet.el.querySelector('.sheet-title').textContent = recipe.name;
    };

    const meal = store.find('meals', mealId);
    const recipe = meal && store.find('recipes', meal.recipeId);
    if (!recipe) return;
    const slotLabel = SLOTS.find(([s]) => s === meal.slot)?.[1] || '';
    const sub = el('p', { class: 'sheet-sub', text: `${slotLabel} · ${formatLong(meal.date, ctx.today())}` });
    const off = store.onChange(draw);
    sheet = openSheet({ title: recipe.name, content: [sub, hint, listEl, empty, editBtn], onClose: off });
    draw();
  }

  function openPicker(date, slot, slotLabel) {
    const search = el('input', { type: 'search', class: 'input', placeholder: 'Search', autocomplete: 'off', 'aria-label': 'Search recipes', enterkeyhint: 'search' });
    const listEl = el('ul', { class: 'pick-list' });
    const all = sortRecipes(store.list('recipes'));
    const assign = (recipeId) => {
      const meal = store.add('meals', { date, slot, recipeId });
      sheet.close();
      // Straight to the ingredients so the cart can be filled in.
      if (store.find('recipes', recipeId)?.ingredients?.length) openMeal(meal.id);
    };
    const newRow = el('li', {}, [
      el('button', {
        type: 'button', class: 'pick-row pick-new',
        onclick: () => {
          sheet.close();
          openRecipeForm({
            onSaved: (r) => {
              const meal = store.add('meals', { date, slot, recipeId: r.id });
              if (r.ingredients.length) openMeal(meal.id);
            },
          });
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

  /** Recipe form: name, then the ingredient list. Create (optionally assign via onSaved) or edit. */
  function openRecipeForm({ recipe = null, onSaved } = {}) {
    const name = el('input', { type: 'text', class: 'input', autocomplete: 'off', maxlength: '120', value: recipe?.name || '' });
    let ings = (recipe?.ingredients || []).map((i) => ({ ...i }));

    const ingList = el('ul', { class: 'ing-list ing-edit', 'aria-label': 'Ingredients' });
    const ingInput = el('input', {
      type: 'text', class: 'input', autocomplete: 'off', autocapitalize: 'sentences', maxlength: '120',
      enterkeyhint: 'enter', placeholder: 'Add an ingredient', 'aria-label': 'Add an ingredient',
    });
    const addBtn = el('button', { type: 'button', class: 'icon-btn icon-btn-primary', 'aria-label': 'Add ingredient' }, [icon('plus', 22)]);
    const suggest = el('div', { class: 'ing-suggest', 'aria-label': 'Suggestions' });

    const drawIngs = () => {
      ingList.replaceChildren(...ings.map((ing) => el('li', { class: 'ing-row' }, [
        el('span', { class: 'row-text', text: ing.name }),
        el('button', {
          type: 'button', class: 'icon-btn ing-remove', 'aria-label': `Remove ${ing.name}`,
          onclick: () => { ings = ings.filter((x) => x.id !== ing.id); drawIngs(); drawSuggest(); },
        }, [icon('close', 18)]),
      ])));
    };
    const drawSuggest = () => {
      const list = suggestIngredients(store.list('ingredients'), ingInput.value, ings.map((i) => i.id));
      suggest.replaceChildren(...list.map((i) => el('button', {
        type: 'button', class: 'chip', text: i.name,
        // pointerdown keeps the keyboard open on iOS while tapping a suggestion.
        onpointerdown: (e) => e.preventDefault(),
        onclick: () => addIngredient(i.name),
      })));
      suggest.hidden = !list.length;
    };
    const addIngredient = (raw) => {
      const n = cleanIngredientName(raw);
      if (!n) { ingInput.focus(); return; }
      const id = ingredientId(n);
      const known = store.find('ingredients', id);
      if (!ings.some((x) => x.id === id)) ings.push({ id, name: known?.name || n });
      ingInput.value = '';
      drawIngs();
      drawSuggest();
      ingInput.focus();
    };
    ingInput.addEventListener('input', drawSuggest);
    ingInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); if (ingInput.value.trim()) addIngredient(ingInput.value); }
    });
    addBtn.addEventListener('click', () => addIngredient(ingInput.value));
    drawIngs();
    drawSuggest();

    const error = el('p', { class: 'field-error', role: 'alert' });
    const buttons = [el('button', { class: 'btn btn-primary btn-block', type: 'submit', text: 'Save' })];
    if (recipe) {
      buttons.push(el('button', { class: 'btn btn-danger btn-block', type: 'button', text: 'Delete', onclick: () => deleteRecipe(recipe, sheet) }));
    }
    ingInput.id = `f-ing-${Math.random().toString(36).slice(2, 9)}`;
    const form = el('form', { class: 'sheet-form' }, [
      field('Name', name),
      el('div', { class: 'field' }, [
        el('label', { class: 'field-label', for: ingInput.id, text: 'Ingredients' }),
        ingList,
        el('div', { class: 'ing-add' }, [ingInput, addBtn]),
        suggest,
      ]),
      error,
      ...buttons,
    ]);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const n = name.value.trim();
      if (!n) { error.textContent = 'Enter a name.'; name.focus(); return; }
      if (cleanIngredientName(ingInput.value)) addIngredient(ingInput.value); // typed but not added yet
      // Every ingredient goes into the shared catalog (suggestions for other recipes).
      for (const ing of ings) store.put('ingredients', ing.id, { name: ing.name });
      const fields = { name: n, ingredients: ings };
      let saved;
      if (recipe) {
        // Ingredients taken out of the recipe also leave the shopping list.
        const kept = new Set(ings.map((i) => i.id));
        const mealIds = new Set(store.list('meals').filter((m) => m.recipeId === recipe.id).map((m) => m.id));
        const stale = store.list('shopping').filter((it) => mealIds.has(it.mealId) && !kept.has(it.ingredientId));
        if (stale.length) store.remove('shopping', stale.map((it) => it.id));
        saved = store.update('recipes', recipe.id, fields);
      } else {
        saved = store.add('recipes', fields);
      }
      sheet.close();
      onSaved?.(saved);
    });
    const sheet = openSheet({ title: recipe ? 'Edit recipe' : 'New recipe', content: form, focus: name });
    sheet.el.classList.add('sheet-tall');
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
      removeMeals(uses.map((m) => m.id));
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
    const ingBtn = el('button', { type: 'button', class: 'btn btn-secondary', text: 'Ingredients', onclick: openIngredients });
    const sheet = openSheet({ title: 'Recipes', content: [el('div', { class: 'sheet-actions sheet-actions-split' }, [ingBtn, addBtn]), listEl], onClose: off });
    sheet.el.classList.add('sheet-tall');
  }

  /** The shared ingredient catalog. Deleting here only removes the suggestion; recipes keep theirs. */
  function openIngredients() {
    const listEl = el('ul', { class: 'rows' });
    const empty = el('p', { class: 'empty', text: 'Ingredients you add to recipes appear here.' });
    const draw = () => {
      const all = suggestIngredients(store.list('ingredients'), '', [], Infinity);
      empty.hidden = all.length > 0;
      listEl.replaceChildren(...all.map((i) =>
        swipeRow(el('div', { class: 'row-card row-card-inset' }, [el('span', { class: 'row-text', text: i.name })]),
          () => store.remove('ingredients', i.id), { label: i.name })));
    };
    draw();
    const off = store.onChange(draw);
    const sheet = openSheet({
      title: 'Ingredients',
      content: [el('p', { class: 'field-hint', text: 'Swipe left to remove a suggestion. Recipes keep their ingredients.' }), empty, listEl],
      onClose: off,
    });
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
