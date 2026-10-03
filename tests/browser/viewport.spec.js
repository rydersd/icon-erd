import { test, expect } from '@playwright/test';

test('editor stays in the viewport while panels scroll and canvas pans', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__gw?.ready);
  for (const viewport of [{ width: 1500, height: 900 }, { width: 1100, height: 900 }, { width: 700, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect(page.locator('#canvas')).toBeInViewport();
    if (viewport.width > 1180) {
      await expect(page.locator('.pane-close').first()).toBeHidden();
      await expect(page.getByRole('button', { name: 'Close editor pane', exact: true })).toBeHidden();
      await expect(page.getByRole('button', { name: 'Drawing controls', exact: true })).toBeHidden();
    }
    await expect(page.locator('#showToggle')).toBeInViewport();
    const before = await page.locator('header.bar').boundingBox();
    await page.mouse.move(10, 10);
    await page.mouse.wheel(0, 1600);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    expect(await page.locator('header.bar').boundingBox()).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(viewport.height);

    // The lower settings remain reachable without moving the drawing plane.
    const canvasBefore = await page.locator('#canvas').boundingBox();
    if (viewport.width <= 1180) await page.getByRole('button', { name: 'Details', exact: true }).click();
    await page.locator('#iconAliases').scrollIntoViewIfNeeded();
    await expect(page.locator('#iconAliases')).toBeInViewport();
    expect(await page.locator('#canvas').boundingBox()).toEqual(canvasBefore);
    if (viewport.width <= 1180) await page.getByRole('button', { name: 'Library', exact: true }).first().click();
    await page.locator('#libraryOutputSizes').scrollIntoViewIfNeeded();
    await expect(page.locator('#libraryOutputSizes')).toBeInViewport();
    if (viewport.width <= 1180) await page.getByRole('button', { name: 'Output', exact: true }).click();
    await page.locator('#expJson').scrollIntoViewIfNeeded();
    await expect(page.locator('#expJson')).toBeInViewport();
    expect(await page.locator('#canvas').boundingBox()).toEqual(canvasBefore);

    if (viewport.width <= 1180) {
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Output', exact: true })).toBeFocused();
      await expect(page.locator('.col-right')).toBeHidden();
    }
    const viewBefore = await page.evaluate(() => ({ ...window.__gw.S.view }));
    const canvas = await page.locator('#canvas').boundingBox();
    expect(canvas.height).toBeGreaterThan(60);
    expect(canvas.width).toBeCloseTo(canvas.height, 0);
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await page.mouse.wheel(40, 80);
    await expect.poll(() => page.evaluate(() => window.__gw.S.view.y)).not.toBe(viewBefore.y);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  }
});

test('compact controls expand without resetting artwork and disclosures use 12px markers', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto('/'); await page.waitForFunction(() => window.__gw?.ready);
  const glyph = await page.evaluate(() => JSON.stringify(window.__gw.S.glyph));
  await expect(page.locator('#snapSeg')).toBeHidden();
  await page.getByRole('button', { name: 'Drawing controls', exact: true }).click();
  await expect(page.locator('#snapSeg')).toBeVisible();
  await page.locator('[data-snap="0.5"]').click();
  expect(await page.evaluate(() => JSON.stringify(window.__gw.S.glyph))).toBe(glyph);
  await page.getByRole('button', { name: 'Library', exact: true }).first().click();
  expect(await page.locator('#libToggle .disclosure-arrow').evaluate(el => [getComputedStyle(el).width, getComputedStyle(el).height])).toEqual(['12px', '12px']);
  expect(await page.locator('#libraryTokensTitle').evaluate(el => [getComputedStyle(el, '::before').width, getComputedStyle(el, '::before').height])).toEqual(['12px', '12px']);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Library', exact: true }).first().click();
  const app = await page.locator('.app').boundingBox();
  await page.mouse.click(app.x + app.width - 20, app.y + app.height / 2);
  await expect(page.locator('.col-left')).toBeHidden();
  await page.screenshot({ path: 'artifacts/responsive-compact.png' });
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.screenshot({ path: 'artifacts/responsive-desktop.png' });
});
