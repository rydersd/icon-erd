import { test, expect } from '@playwright/test';
// UX-03 Library place. Spec: wiki/product-spec/ux-03-library-place.md (local wiki); owner ruling 2026-11-03: centre placement.
const SECTIONS = {
  tokens: ['libraryTokensTitle', 'libraryPropertiesMenuBtn', 'linkTokensBtn', 'unlinkTokensBtn', 'exportTokensBtn', 'tokensFile', 'setThicknessEnabled', 'setThickness', 'thicknessTokenRow', 'opticalSizeEnabled', 'opticalCurve', 'setRoundingEnabled', 'setRounding', 'roundingTokenRow', 'setEndRoundingEnabled', 'setEndRounding', 'lineEndScopeNote', 'useLibraryEndRounding', 'endRoundingTokenRow'],
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
  const name = await page.locator('#hdrName').textContent();
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  await toggleKey(page);
  await expect(page.locator('#libraryPlace')).toBeVisible();
  await toggleKey(page);
  await expect(page.locator('#libraryPlace')).toBeHidden();
  await expect(page.locator('#hdrName')).toHaveText(name);
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

test('escape returns to the icon place', async ({ page }) => {
  await ready(page);
  await libraryButton(page).click();
  await nav(page).locator('[data-library-section="output"]').click();
  await page.keyboard.press('Escape');
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
});
