// UI smoke tests: iPhone emulation, served under the /daybook/ sub-path like GitHub Pages.
// Uses WebKit when installed (npx playwright install webkit), otherwise Chromium.
// Run: node tests/e2e/smoke.mjs   Screenshots go to tests/e2e/screenshots/.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { webkit, chromium, devices } from 'playwright';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SHOTS = join(ROOT, 'tests/e2e/screenshots');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/daybook/')) { res.writeHead(404).end(); return; }
  let p = normalize(url.pathname.slice('/daybook/'.length));
  if (p === '.' || p.endsWith('/')) p = join(p, 'index.html');
  try {
    const body = await readFile(join(ROOT, p));
    res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://localhost:${server.address().port}/daybook/`;

await mkdir(SHOTS, { recursive: true });
let browserType = webkit;
let browser;
try { browser = await webkit.launch(); } catch { browserType = chromium; browser = await chromium.launch(); }
console.log(`Engine: ${browserType.name()}`);
const iphone = devices['iPhone 15 Pro'] || devices['iPhone 13'];
const results = [];
let currentPage = null;
async function step(name, fn) {
  try {
    if (currentPage && results.length) { await currentPage.reload(); await currentPage.waitForSelector('.tile'); } await fn(); results.push(['ok', name]); console.log(`ok - ${name}`); }
  catch (e) { results.push(['FAIL', name]); console.log(`FAIL - ${name}\n  ${e.message.split('\n').slice(0, 14).join('\n  ')}`); if (currentPage) await shot(currentPage, `fail-${results.length}`); }
}

async function newPage(opts = {}) {
  const ctx = await browser.newContext({ ...iphone, ...(browserType === chromium ? {} : {}), reducedMotion: 'no-preference', ...opts });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('  console:', m.text()); });
  return { ctx, page };
}

const shot = (page, name) => page.screenshot({ path: join(SHOTS, `${name}.png`) });
const openSection = async (page, label) => { await page.getByRole('button', { name: label, exact: true }).click(); await page.waitForTimeout(260); };
const back = async (page) => { await page.locator('.panel.open .back-btn').click(); await page.waitForTimeout(260); };
const tapBackdrop = async (page) => { await page.locator('.sheet-layer.open .sheet-backdrop').last().click({ position: { x: 20, y: 12 } }); await page.waitForTimeout(260); };

async function swipeLeft(page, rowLocator, fraction = 0.8) {
  const box = await rowLocator.boundingBox();
  const y = box.y + box.height / 2;
  const x0 = box.x + box.width - 10;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i++) await page.mouse.move(x0 - (box.width * fraction * i) / steps, y);
  await page.mouse.up();
  await page.waitForTimeout(350);
}

const { ctx, page } = await newPage();
currentPage = page;
await page.goto(BASE);
await page.waitForSelector('.tile');

await step('home: six tiles fill the screen, no overflow', async () => {
  await shot(page, '01-home');
  const vp = page.viewportSize();
  const tiles = await page.locator('.tile').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
  assert.equal(tiles.length, 6);
  const bottom = Math.max(...tiles.map((t) => t.bottom));
  const top = Math.min(...tiles.map((t) => t.top));
  assert.ok(top >= 0 && top < 80, `top ${top}`);
  assert.ok(bottom > vp.height - 130 && bottom <= vp.height - 50, `tiles bottom ${bottom} of ${vp.height}`);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(sw <= vp.width, 'no horizontal overflow');
  const labels = await page.locator('.tile-label').allTextContents();
  assert.deepEqual(labels, ['Shopping', 'Meals', 'Money', 'Events', 'Tasks', 'Notes']);
});

await step('shopping: add several, swipe-delete, clear all, persistence', async () => {
  await openSection(page, 'Shopping');
  await page.getByRole('button', { name: 'Add item' }).click();
  const input = page.locator('.sheet input');
  for (const t of ['Milk', 'Eggs', 'Bread']) { await input.fill(t); await input.press('Enter'); }
  assert.equal(await input.inputValue(), '');
  assert.ok(await input.evaluate((n) => n === document.activeElement), 'field stays focused');
  await shot(page, '02-shopping-sheet');
  await tapBackdrop(page);
  assert.deepEqual(await page.locator('#p-shopping .row-text').allTextContents(), ['Milk', 'Eggs', 'Bread']);
  await swipeLeft(page, page.locator('#p-shopping .swipe-row').nth(1));
  assert.deepEqual(await page.locator('#p-shopping .row-text').allTextContents(), ['Milk', 'Bread']);
  // short swipe reveals the button; tapping it deletes
  await swipeLeft(page, page.locator('#p-shopping .swipe-row').nth(1), 0.3);
  await page.locator('#p-shopping .swipe-row.is-open .swipe-action').click({ position: { x: (await page.locator('#p-shopping .swipe-row.is-open').boundingBox()).width - 40, y: 26 } });
  await page.waitForTimeout(300);
  assert.deepEqual(await page.locator('#p-shopping .row-text').allTextContents(), ['Milk']);
  await shot(page, '03-shopping');
  await page.reload(); await page.waitForSelector('.tile');
  await openSection(page, 'Shopping');
  assert.deepEqual(await page.locator('#p-shopping .row-text').allTextContents(), ['Milk']);
  await page.getByRole('button', { name: 'Clear all' }).click();
  await page.waitForTimeout(250);
  await page.locator('.sheet').getByRole('button', { name: 'Cancel' }).click();
  await page.waitForTimeout(250);
  assert.equal(await page.locator('#p-shopping .row-text').count(), 1);
  await page.getByRole('button', { name: 'Clear all' }).click();
  await page.waitForTimeout(250);
  await page.locator('.sheet').getByRole('button', { name: 'Clear', exact: true }).click();
  await page.waitForTimeout(250);
  assert.equal(await page.locator('#p-shopping .row-text').count(), 0);
  await page.getByRole('button', { name: 'Add item' }).click();
  await page.locator('.sheet input').fill('Coffee'); await page.locator('.sheet input').press('Enter');
  await tapBackdrop(page);
  await back(page);
});

await step('meals: 7 chips, new recipe assigned, swipe removes from day only, manage + delete with confirmation', async () => {
  await openSection(page, 'Meals');
  const chips = page.locator('.day-chip');
  assert.equal(await chips.count(), 7);
  assert.equal(await chips.first().locator('.chip-wd').textContent(), 'Today');
  assert.equal(await chips.first().getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('.meal-card .card-title').allTextContents().then((x) => x.join(',')), 'Breakfast,Lunch,Snack,Dinner');
  await page.getByRole('button', { name: 'Add to Lunch' }).click();
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: 'New recipe' }).click();
  await page.waitForTimeout(250);
  await page.locator('.sheet').last().locator('input').fill('Lentil soup');
  await page.locator('.sheet').last().locator('textarea').fill('Cumin');
  await page.locator('.sheet').last().getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(300);
  const lunch = page.locator('.meal-card').nth(1);
  assert.deepEqual(await lunch.locator('.row-text').allTextContents(), ['Lentil soup']);
  // add the same recipe to dinner via the picker, and to tomorrow
  await page.getByRole('button', { name: 'Add to Dinner' }).click();
  await page.waitForTimeout(250);
  await page.locator('.sheet .pick-row', { hasText: 'Lentil soup' }).click();
  await page.waitForTimeout(250);
  await chips.nth(1).click();
  await page.getByRole('button', { name: 'Add to Breakfast' }).click();
  await page.waitForTimeout(250);
  await page.locator('.sheet input[type=search]').fill('lent');
  await page.locator('.sheet .pick-row', { hasText: 'Lentil soup' }).click();
  await page.waitForTimeout(250);
  await chips.first().click();
  await shot(page, '04-meals');
  await swipeLeft(page, page.locator('.meal-card').nth(3).locator('.swipe-row').first());
  assert.equal(await page.locator('.meal-card').nth(3).locator('.row-text').count(), 0);
  assert.equal(await page.locator('.meal-card').nth(1).locator('.row-text').count(), 1);
  // 50+ recipes stay smooth
  await page.evaluate(() => {
    const k = 'daybook:v1:local:data';
    const d = JSON.parse(localStorage.getItem(k));
    for (let i = 0; i < 60; i++) d.recipes.push({ id: `r${i}`, name: `Recipe ${String(i).padStart(2, '0')}`, notes: '', createdAt: i, updatedAt: i });
    localStorage.setItem(k, JSON.stringify(d));
  });
  await page.reload(); await page.waitForSelector('.tile');
  await openSection(page, 'Meals');
  await page.getByRole('button', { name: 'Manage recipes' }).click();
  await page.waitForTimeout(250);
  assert.equal(await page.locator('.sheet .pick-row').count(), 61);
  await shot(page, '05-recipes');
  await page.locator('.sheet .pick-row', { hasText: 'Lentil soup' }).click();
  await page.waitForTimeout(250);
  await page.locator('.sheet').last().getByRole('button', { name: 'Delete' }).click();
  await page.waitForTimeout(250);
  const msg = await page.locator('.sheet').last().locator('.sheet-text').textContent();
  assert.match(msg, /2 planned meals/);
  await shot(page, '06-recipe-delete-confirm');
  await page.locator('.sheet').last().getByRole('button', { name: 'Delete' }).click();
  await page.waitForTimeout(450);
  assert.equal(await page.locator('.sheet .pick-row', { hasText: 'Lentil soup' }).count(), 0);
  await tapBackdrop(page);
  assert.equal(await page.locator('.meal-card .row-text').count(), 0);
  await back(page);
});

await step('money: add both directions, colours, swipe-delete, persistence', async () => {
  await openSection(page, 'Money');
  for (const [amt, concept, dir] of [['12,5', 'Dinner Ana', 'They owe me'], ['30', 'Concert', 'I owe'], ['4.2', 'Coffee', 'I owe']]) {
    await page.getByRole('button', { name: 'Add entry' }).click();
    await page.waitForTimeout(250);
    const s = page.locator('.sheet').last();
    assert.equal(await s.locator('input').first().getAttribute('inputmode'), 'decimal');
    await s.locator('input').first().fill(amt);
    await s.locator('input').nth(1).fill(concept);
    await s.getByRole('button', { name: dir }).click();
    if (concept === 'Dinner Ana') await shot(page, '07-money-form');
    await s.getByRole('button', { name: 'Add' }).click();
    await page.waitForTimeout(250);
  }
  assert.deepEqual(await page.locator('#p-money .money-amount').allTextContents(), ['€12.50', '€30.00', '€4.20']);
  assert.equal(await page.locator('#p-money .money-owed').count(), 1);
  assert.equal(await page.locator('#p-money .money-owe').count(), 2);
  await shot(page, '08-money');
  await swipeLeft(page, page.locator('#p-money .swipe-row').nth(2));
  await page.reload(); await page.waitForSelector('.tile');
  await openSection(page, 'Money');
  assert.deepEqual(await page.locator('#p-money .row-text').allTextContents(), ['Dinner Ana', 'Concert']);
  await back(page);
});

await step('events: month grid (Mon first), add from day sheet, dot, list view, swipe-delete', async () => {
  await openSection(page, 'Events');
  assert.equal(await page.locator('.wd').first().textContent(), 'Mon');
  assert.equal(await page.locator('.day.today').count(), 1);
  await page.locator('.day.today').click();
  await page.waitForTimeout(250);
  await page.locator('.sheet').getByRole('button', { name: 'Add event' }).click();
  await page.waitForTimeout(250);
  const f = page.locator('.sheet').last();
  await f.locator('input[type=text]').fill('Dentist');
  await f.locator('input[type=time]').fill('09:30');
  await f.getByRole('button', { name: 'Add' }).click();
  await page.waitForTimeout(300);
  assert.deepEqual(await page.locator('.sheet .row-text').allTextContents(), ['Dentist']);
  await tapBackdrop(page);
  assert.equal(await page.locator('.day.today .dot').count(), 1);
  // add from bottom + with a later date
  await page.getByRole('button', { name: 'Add event', exact: true }).last().click();
  await page.waitForTimeout(250);
  const f2 = page.locator('.sheet').last();
  await f2.locator('input[type=text]').fill('Trip');
  const later = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 9); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  await f2.locator('input[type=date]').fill(later);
  await f2.getByRole('button', { name: 'Add' }).click();
  await page.waitForTimeout(300);
  await shot(page, '09-events-month');
  await page.getByRole('tab', { name: 'List' }).click();
  assert.equal(await page.locator('.group-title').count(), 2);
  assert.equal(await page.locator('.group-title').first().textContent(), 'Today');
  await shot(page, '10-events-list');
  await swipeLeft(page, page.locator('.event-list .swipe-row').first());
  assert.deepEqual(await page.locator('.event-list .row-text').allTextContents(), ['Trip']);
  await back(page);
});

await step('tasks: sorting, overdue colour, completion removes forever', async () => {
  await openSection(page, 'Tasks');
  const add = async (name, prio, due) => {
    await page.getByRole('button', { name: 'Add task' }).click();
    await page.waitForTimeout(250);
    const s = page.locator('.sheet').last();
    await s.locator('input[type=text]').fill(name);
    await s.getByRole('radio', { name: String(prio) }).click();
    if (due) await s.locator('input[type=date]').fill(due);
    if (name === 'Pay rent') await shot(page, '11-task-form');
    await s.getByRole('button', { name: 'Add' }).click();
    await page.waitForTimeout(250);
  };
  await add('Pay rent', 2, null);
  await add('Call mum', 1, '2030-01-01');
  await add('Old thing', 2, '2020-05-05');
  assert.deepEqual(await page.locator('#p-tasks .row-text').allTextContents(), ['Call mum', 'Old thing', 'Pay rent']);
  assert.equal(await page.locator('#p-tasks .task-due.overdue').count(), 1);
  await shot(page, '12-tasks');
  await page.getByRole('button', { name: 'Complete Old thing' }).click();
  await page.waitForTimeout(400);
  assert.deepEqual(await page.locator('#p-tasks .row-text').allTextContents(), ['Call mum', 'Pay rent']);
  await page.reload(); await page.waitForSelector('.tile');
  await openSection(page, 'Tasks');
  assert.deepEqual(await page.locator('#p-tasks .row-text').allTextContents(), ['Call mum', 'Pay rent']);
  const tomb = await page.evaluate(() => JSON.parse(localStorage.getItem('daybook:v1:local:data')).tasks.filter((t) => t.deletedAt).length);
  assert.equal(tomb, 1, 'tombstone stored');
  await back(page);
});

await step('notes: autosave and restore', async () => {
  await openSection(page, 'Notes');
  const area = page.locator('.note-area');
  assert.equal(await area.getAttribute('placeholder'), 'Write your ideas…');
  await area.fill('Line one\nLine two');
  await page.waitForTimeout(600);
  await shot(page, '13-notes');
  await page.reload(); await page.waitForSelector('.tile');
  await openSection(page, 'Notes');
  assert.equal(await page.locator('.note-area').inputValue(), 'Line one\nLine two');
  await back(page);
});

await step('account sheet (local profile) and export', async () => {
  await page.getByRole('button', { name: 'Account' }).click();
  await page.waitForTimeout(250);
  assert.ok(await page.locator('.sheet').getByText('Local profile').isVisible());
  await page.getByRole('button', { name: 'Export backup' }).click();
  await page.waitForTimeout(200);
  const json = JSON.parse(await page.locator('.export-out textarea').inputValue());
  assert.equal(json.version, 1);
  await shot(page, '14-account-local');
  await tapBackdrop(page);
});

await step('import backup merges without deleting', async () => {
  await page.getByRole('button', { name: 'Account' }).click();
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: 'Import backup' }).click();
  await page.waitForTimeout(250);
  const backup = { version: 1, shopping: [{ id: 'imp1', text: 'Imported', createdAt: 1, updatedAt: 1 }, { id: 'imp2', text: 'X', createdAt: 1, updatedAt: 2, deletedAt: 2 }] };
  await page.locator('.sheet').last().locator('textarea').fill(JSON.stringify(backup));
  await page.locator('.sheet').last().getByRole('button', { name: 'Import' }).click();
  await page.waitForTimeout(250);
  await page.locator('.sheet').last().getByRole('button', { name: 'Import' }).click();
  await page.waitForTimeout(450);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  await openSection(page, 'Shopping');
  assert.deepEqual((await page.locator('#p-shopping .row-text').allTextContents()).sort(), ['Coffee', 'Imported']);
  await back(page);
});

await step('offline load through the service worker', async () => {
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 10000 });
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('.tile', { timeout: 5000 });
  await openSection(page, 'Shopping');
  assert.ok((await page.locator('#p-shopping .row-text').count()) >= 1);
  await ctx.setOffline(false);
});
await ctx.close();
currentPage = null;

// ---- Signed-in mode, with a fake session seeded for tests only ----
await step('signed-in: remembered account opens instantly offline; namespaces are separate', async () => {
  const { ctx: c2, page: p2 } = await newPage();
  await c2.route('**/config.js', async (route) => {
    const body = (await readFile(join(ROOT, 'config.js'), 'utf8')).replace('GOOGLE_CLIENT_ID = ""', 'GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com"');
    await route.fulfill({ body, contentType: 'text/javascript' });
  });
  await c2.route(/google|googleapis/, (route) => route.abort());
  await p2.goto(BASE);
  await p2.waitForSelector('#signin:not([hidden])');
  assert.ok(await p2.getByRole('button', { name: 'Sign in with Google' }).isVisible());
  await shot(p2, '15-signin');
  await p2.evaluate(() => {
    localStorage.setItem('daybook:v1:account', JSON.stringify({ sub: 'test-sub-1', email: 'test@example.com', name: 'Test User', picture: '' }));
    localStorage.setItem('daybook:v1:test-sub-1:data', JSON.stringify({ version: 1, shopping: [{ id: 's1', text: 'Seeded', createdAt: 1, updatedAt: 1 }] }));
    localStorage.setItem('daybook:v1:local:data', JSON.stringify({ version: 1, shopping: [{ id: 'l1', text: 'Local only', createdAt: 1, updatedAt: 1 }] }));
  });
  await p2.reload();
  await p2.waitForSelector('.tile');
  assert.ok(await p2.locator('#signin').isHidden());
  await openSection(p2, 'Shopping');
  assert.deepEqual(await p2.locator('#p-shopping .row-text').allTextContents(), ['Seeded']);
  await back(p2);
  await p2.getByRole('button', { name: 'Account' }).click();
  await p2.waitForTimeout(400);
  assert.ok(await p2.locator('.sheet').getByText('test@example.com').isVisible());
  await p2.waitForFunction(() => document.querySelector('.sync-status')?.textContent === 'Sync paused', null, { timeout: 20000 });
  assert.ok(await p2.locator('.sheet').getByRole('button', { name: 'Reconnect' }).isVisible());
  await shot(p2, '16-account-signed-in');
  await c2.close();
});

await browser.close();
server.close();
const failed = results.filter((r) => r[0] === 'FAIL');
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
