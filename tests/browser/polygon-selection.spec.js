import { test, expect } from '@playwright/test';
for (const finish of ['Return', 'double-click']) {
  test(`polygon object selection requires the whole path/group enclosed and ${finish} keeps selection`, async ({ page }) => {
    await page.goto('/'); await page.waitForFunction(() => window.__gw?.ready);
    await page.evaluate(async () => {
      const w = window.__gw, line = (x1, y1, x2, y2) => ({ shape: 'line', x1, y1, x2, y2 });
      await w.importLibraryText(JSON.stringify({ name: 'enclosure', layers: [
        { id: 'inside', paint: 'stroke', node: line(4, 4, 8, 4) },
        { id: 'crossing', paint: 'stroke', node: line(6, 6, 18, 6) },
        { id: 'partly-inside-group', paint: 'stroke', node: { op: 'union', children: [line(4, 8, 8, 8), line(14, 14, 18, 14)] } },
      ] }), 'enclosure.json');
      w.setTool('select');
    });
    await page.locator('#areaSelectToggle').click(); await page.getByRole('menuitemradio', { name: 'Polygon lasso', exact: true }).click();
    await page.locator('#canvas').scrollIntoViewIfNeeded();
    const screen = async (x, y) => page.evaluate(({ x, y }) => { const c = document.querySelector('#canvas'), p = c.createSVGPoint(); p.x = x; p.y = y; const q = p.matrixTransform(c.getScreenCTM()); return { x: q.x, y: q.y }; }, { x, y });
    for (const [x, y] of [[2, 2], [10, 2], [10, 10]]) { const p = await screen(x, y); await page.mouse.click(p.x, p.y); }
    const p = await screen(2, 10);
    if (finish === 'double-click') await page.mouse.dblclick(p.x, p.y);
    else { await page.mouse.click(p.x, p.y); await page.keyboard.press('Enter'); }
    await expect(page.locator('#anchorMarquee')).toHaveCount(0);
    expect(await page.evaluate(() => window.__gw.S.sel)).toEqual([{ l: 0, p: [] }]);
    await expect(page.locator('#gSel path').first()).toHaveAttribute('stroke', 'var(--sel)');
    await expect(page.locator('#canvas')).toBeVisible();
  });
}
