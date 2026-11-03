import { test, expect } from '@playwright/test';
// UX-03 Library place. Spec: wiki/product-spec/ux-03-library-place.md (local wiki); owner ruling 2026-11-03: centre placement.
const SECTIONS = {
  tokens: ['libraryTokensTitle', 'libraryTokenSource', 'libraryPropertiesMenu', 'libraryPropertiesMenuBtn', 'linkTokensBtn', 'unlinkTokensBtn', 'exportTokensBtn', 'tokensFile', 'setThicknessEnabled', 'setThickness', 'thicknessTokenRow', 'thicknessToken', 'opticalSizeEnabled', 'opticalCurve', 'setRoundingEnabled', 'setRounding', 'roundingTokenRow', 'roundingToken', 'setEndRoundingEnabled', 'setEndRounding', 'lineEndScopeNote', 'useLibraryEndRounding', 'endRoundingTokenRow', 'endRoundingToken'],
  output: ['libraryOutputProfile', 'libraryOutputSizes', 'libraryOutputHint'],
  colors: ['libraryVariant', 'libraryFamilyView', 'libraryColorMode', 'libraryFillColor', 'libraryStrokeColor', 'libraryAccentColor', 'libraryUseColorTokens', 'libraryFillToken', 'libraryStrokeToken', 'libraryAccentToken', 'testSolidVariantsBtn', 'solidTestProgress'],
  components: ['componentsCount', 'componentList'],
  organize: ['organizeLibraryBtn', 'undoOrganizationBtn', 'findSharedFormsBtn', 'insetReviewBtn', 'resetLibraryBtn', 'undoLibraryResetBtn'],
  versions: ['libraryVersionsBtn', 'newLibraryBtn'],
  shortcuts: ['shortcutFields', 'resetShortcuts'],
};
const ready = async page => { await page.goto('/'); await page.waitForFunction(() => window.__gw?.ready); };
const place = page => page.getByRole('group', { name: 'Place', exact: true });
const libraryButton = page => place(page).getByRole('button', { name: 'Library', exact: true });
const iconButton = page => place(page).getByRole('button', { name: 'Icon', exact: true });
const nav = page => page.locator('#libraryPlace').getByRole('navigation', { name: 'Library sections' });
const toggleKey = page => page.keyboard.press('ControlOrMeta+l');

test('the library place switch shows library sections in the centre', async ({ page }) => {
  await ready(page);
  await expect(page.locator('#libraryPlace')).toBeHidden();
  await expect(iconButton(page)).toHaveAttribute('aria-pressed', 'true');
  await libraryButton(page).click();
  await expect(page.locator('#libraryPlace')).toBeVisible();
  await expect(page.locator('.col-centre')).toBeHidden();
  await expect(page.locator('.col-right')).toBeHidden();
  await expect(page.locator('#pane-left')).toBeVisible();
  await expect(libraryButton(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(iconButton(page)).toHaveAttribute('aria-pressed', 'false');
  await iconButton(page).click();
  await expect(page.locator('#libraryPlace')).toBeHidden();
  await expect(page.locator('#canvas')).toBeVisible();
  await expect(iconButton(page)).toHaveAttribute('aria-pressed', 'true');
});

test('mod+L toggles the library place and keeps the current icon', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => window.__gw.loadGlyph(2));
  await page.evaluate(() => { const w = window.__gw; w.S.sel = [{ l: 0, p: [] }]; w.refresh(true); });
  const name = await page.locator('#hdrName').textContent();
  const state = () => page.evaluate(() => JSON.stringify([window.__gw.S.cur, window.__gw.S.sel]));
  const before = await state();
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  await toggleKey(page);
  await expect(page.locator('#libraryPlace')).toBeVisible();
  await toggleKey(page);
  await expect(page.locator('#libraryPlace')).toBeHidden();
  await expect(page.locator('#hdrName')).toHaveText(name);
  expect(await state()).toBe(before);
});

test('each library control is present once, inside its section', async ({ page }) => {
  await ready(page);
  for (const [section, ids] of Object.entries(SECTIONS)) for (const id of ids) {
    const where = await page.evaluate(({ id, section }) => {
      const all = document.querySelectorAll(`#${id}`), el = all[0];
      return { count: all.length, inPlace: !!el?.closest('#libraryPlace'), inSection: !!el?.closest(`#libraryPlace section[data-library-section="${section}"]`), inLeft: !!el?.closest('#pane-left') };
    }, { id, section });
    expect(where, `${section} › #${id}`).toEqual({ count: 1, inPlace: true, inSection: true, inLeft: false });
  }
  for (const sel of ['.set-settings', '#componentsPanel', '.shortcut-settings']) {
    await expect(page.locator(`#libraryPlace ${sel}`), sel).toHaveCount(1);
    expect(await page.locator(`#libraryPlace ${sel}`).evaluate(el => el.tagName), sel).not.toBe('DETAILS');
  }
});

test('library place markup is mounted at load and owned by one place state', async ({ page }) => {
  await ready(page);
  expect(await page.evaluate(() => [!!document.getElementById('setThickness'), !!document.getElementById('shortcutFields'), document.querySelector('main.app').dataset.place])).toEqual([true, true, 'icon']);
  await libraryButton(page).click();
  expect(await page.evaluate(() => document.querySelector('main.app').dataset.place)).toBe('library');
});

test('the left column keeps the icon list and loses library-wide settings', async ({ page }) => {
  await ready(page);
  const left = page.locator('#pane-left');
  for (const id of ['lib', 'libSearch', 'newBtn', 'impFileBtn', 'selectShownIconsBtn']) await expect(left.locator(`#${id}`), id).toHaveCount(1);
  for (const sel of ['.set-settings', '#componentsPanel', '.shortcut-settings']) await expect(left.locator(sel), sel).toHaveCount(0);
});

test('section navigation shows one section and remembers it', async ({ page }) => {
  await ready(page);
  await libraryButton(page).click();
  for (const section of Object.keys(SECTIONS)) {
    await nav(page).locator(`[data-library-section="${section}"]`).click();
    await expect(nav(page).locator(`[data-library-section="${section}"]`)).toHaveAttribute('aria-current', 'true');
    await expect(page.locator(`#libraryPlace section[data-library-section="${section}"]`)).toBeVisible();
    await expect(page.locator('#libraryPlace section[data-library-section]:visible')).toHaveCount(1);
  }
  await nav(page).locator('[data-library-section="versions"]').click();
  await ready(page);
  await expect(page.locator('#libraryPlace')).toBeHidden();
  await libraryButton(page).click();
  await expect(page.locator('#libraryPlace section[data-library-section="versions"]')).toBeVisible();
  await expect(page.locator('#libraryVersionsBtn')).toBeVisible();
});

test('escape returns to the icon place and keeps the selection', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => { const w = window.__gw; w.S.sel = [{ l: 0, p: [] }]; w.refresh(true); });
  const sel = () => page.evaluate(() => JSON.stringify(window.__gw.S.sel));
  const before = await sel();
  await libraryButton(page).click();
  await nav(page).locator('[data-library-section="output"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#libraryPlace')).toBeHidden();
  await expect(page.locator('#canvas')).toBeVisible();
  expect(await sel()).toBe(before);
  await expect(libraryButton(page)).toBeFocused();
});

test('escape closes an open dialog, menu or field before leaving the library place', async ({ page }) => {
  await ready(page);
  await libraryButton(page).click();
  await nav(page).locator('[data-library-section="versions"]').click();
  await page.locator('#libraryVersionsBtn').click();
  await expect(page.locator('#libraryVersionsDialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#libraryVersionsDialog')).toBeHidden();
  await expect(page.locator('#libraryPlace')).toBeVisible();
  await nav(page).locator('[data-library-section="tokens"]').click();
  await page.locator('#libraryPropertiesMenuBtn').click();
  await expect(page.locator('#libraryPropertiesMenu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#libraryPropertiesMenu')).toBeHidden();
  await expect(page.locator('#libraryPlace')).toBeVisible();
  await page.locator('#setThickness').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('#setThickness')).not.toBeFocused();
  await expect(page.locator('#libraryPlace')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#libraryPlace')).toBeHidden();
});

test('canvas shortcuts do nothing in the library place; undo stays live', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => { const w = window.__gw; w.S.sel = [{ l: 0, p: [] }]; w.refresh(true); });
  const state = () => page.evaluate(() => JSON.stringify([window.__gw.S.glyph, window.__gw.S.sel, window.__gw.S.tool]));
  const before = await state();
  await libraryButton(page).click();
  await nav(page).locator('[data-library-section="output"]').focus();
  for (const key of ['Delete', 'ArrowRight', 'ControlOrMeta+d', 'ControlOrMeta+g', 'ControlOrMeta+a', 'v', 'p', 't']) await page.keyboard.press(key);
  await expect(page.locator('#libraryPlace')).toBeVisible();
  expect(await state()).toBe(before);
  await nav(page).locator('[data-library-section="tokens"]').click();
  const thickness = await page.locator('#setThickness').inputValue();
  await page.locator('#setThicknessEnabled').check();
  await page.locator('#setThickness').fill('2.4'); await page.locator('#setThickness').press('Tab');
  await nav(page).locator('[data-library-section="tokens"]').focus();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator('#setThickness')).toHaveValue(thickness);
});

test('a plain icon tile click returns to the icon place; modified clicks stay', async ({ page }) => {
  await ready(page);
  await libraryButton(page).click();
  await page.locator('.lib-item').nth(1).click({ modifiers: ['ControlOrMeta'] });
  await expect(page.locator('#libraryPlace')).toBeVisible();
  await page.locator('.lib-item').nth(2).click();
  await expect(page.locator('#libraryPlace')).toBeHidden();
  await expect(page.locator('#canvas')).toBeVisible();
});

test('a library action whose review opens on the canvas returns to the icon place', async ({ page }) => {
  await ready(page);
  await page.evaluate(async () => window.__gw.importLibraryText(JSON.stringify([{ name: 'disc', group: 'Shapes', weight: 1.2, layers: [{ id: 'disc', paint: 'fill', node: { shape: 'circle', cx: 12, cy: 12, r: 5 } }] }]), 'test.json', 'replace'));
  await libraryButton(page).click();
  await nav(page).locator('[data-library-section="organize"]').click();
  await page.locator('#insetReviewBtn').click();
  await expect(page.locator('#libraryPlace')).toBeHidden();
  await expect(page.locator('#groupReview')).toContainText('1 / 1 tested');
});

test('restore deleted opens its review on the canvas from the library place', async ({ page }) => {
  await ready(page);
  await page.locator('.lib-item').first().click();
  await page.locator('[data-collapse="libraryActions"] > summary').click();
  await page.locator('#deleteIconsBtn').click();
  await libraryButton(page).click();
  await page.locator('#restoreIconsBtn').click();
  await expect(page.locator('#libraryPlace')).toBeHidden();
  await expect(page.locator('#groupReview')).toBeVisible();
});

test('component insert from the library place returns to the icon with the new layer', async ({ page }) => {
  await ready(page);
  const bell = { name: 'bell', weight: 1.2, layers: [{ id: 'bell', name: 'Bell', paint: 'stroke', node: { name: 'Half bell', shape: 'pen', pts: [{ x: 12, y: 4 }, { x: 8, y: 7 }, { x: 7, y: 17 }, { x: 12, y: 17 }], closed: false } }] };
  const target = { name: 'target', layers: [{ id: 'slash', name: 'Slash', paint: 'stroke', node: { shape: 'line', x1: 4, y1: 4, x2: 20, y2: 20 } }] };
  await page.evaluate(async glyphs => window.__gw.importLibraryText(JSON.stringify(glyphs), 'bells.json', 'replace'), [bell, target]);
  const point = await page.evaluate(() => { const c = document.querySelector('#canvas'), p = c.createSVGPoint(); p.x = 7.4; p.y = 13; const q = p.matrixTransform(c.getScreenCTM()); return { x: q.x, y: q.y }; });
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await page.getByRole('menuitem', { name: 'Actions', exact: true }).click();
  page.once('dialog', d => d.accept('Bell'));
  await page.getByRole('menuitem', { name: 'Create component', exact: true }).click();
  await expect(page.locator('#componentsCount')).toHaveText('1');
  await expect(page.locator('#libraryPlace')).toBeHidden();
  await page.evaluate(() => window.__gw.loadGlyph(1));
  await libraryButton(page).click();
  await nav(page).locator('[data-library-section="components"]').click();
  await page.getByRole('button', { name: 'Insert Bell into current icon', exact: true }).click();
  await expect(page.locator('#libraryPlace')).toBeHidden();
  expect(await page.evaluate(() => window.__gw.S.glyph.layers.length)).toBe(2);
});

test('library place is locked during guided repair', async ({ page }) => {
  await ready(page);
  await page.evaluate(async () => window.__gw.importLibraryText(JSON.stringify([{ name: 'disc', group: 'Shapes', weight: 1.2, layers: [{ id: 'disc', paint: 'fill', node: { shape: 'circle', cx: 12, cy: 12, r: 5 } }] }]), 'test.json', 'replace'));
  await libraryButton(page).click();
  await nav(page).locator('[data-library-section="organize"]').click();
  await page.locator('#insetReviewBtn').click();
  await page.getByRole('button', { name: 'Repair on canvas', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Guided outline repair' })).toBeVisible();
  await expect(page.locator('#canvas')).toBeVisible();
  expect(await page.evaluate(() => ['placeIcon', 'placeLibrary', 'libraryPlace'].map(id => document.getElementById(id)?.closest('[inert]') != null))).toEqual([true, true, true]);
  await page.locator('#canvas').focus();
  await toggleKey(page);
  await expect(page.locator('#libraryPlace')).toBeHidden();
  await page.getByRole('button', { name: 'Discard repair' }).click();
  await expect(page.getByRole('region', { name: 'Guided outline repair' })).toBeHidden();
  expect(await page.evaluate(() => ['placeIcon', 'placeLibrary', 'libraryPlace'].map(id => document.getElementById(id)?.closest('[inert]') != null))).toEqual([false, false, false]);
});

test('the library place shortcut is customizable', async ({ page }) => {
  await ready(page);
  await libraryButton(page).click();
  await nav(page).locator('[data-library-section="shortcuts"]').click();
  const field = page.getByLabel('Library place shortcut', { exact: true });
  await expect(field).toHaveValue('Mod+L');
  await field.fill('Mod+Shift+L'); await field.dispatchEvent('change');
  await expect(field).toHaveValue('Mod+Shift+L');
  await iconButton(page).click();
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  await page.keyboard.press('ControlOrMeta+Shift+l');
  await expect(page.locator('#libraryPlace')).toBeVisible();
  await page.evaluate(() => localStorage.removeItem('gw-shortcuts'));
});

for (const [width, height] of [[900, 900], [430, 900]]) test(`library place fits at ${width} px`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  await ready(page);
  await libraryButton(page).click();
  await expect(page.locator('#libraryPlace')).toBeVisible();
  await expect(page.locator('#libraryPlace section[data-library-section]:visible')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const panes = page.getByRole('group', { name: 'Editor panes' });
  await panes.getByRole('button', { name: 'Library' }).click();
  await expect(page.locator('#pane-left')).toBeVisible();
  await panes.getByRole('button', { name: 'Library' }).click();
  await panes.getByRole('button', { name: 'Inspector' }).click();
  await expect(page.locator('#libraryPlace')).toBeHidden();
  await expect(page.locator('#pane-right')).toBeVisible();
});
