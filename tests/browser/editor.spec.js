import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const ready = async page => { await page.goto('/'); await page.waitForFunction(() => window.__gw?.ready); };
test('fresh launch, Font Awesome controls, remembered library collapse, metadata search and top-right diagnostics', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  await expect(page.locator('.lib-item')).toHaveCount(4);
  await expect(page.locator('#undoBtn svg path')).toHaveCount(1);
  await expect(page.locator('.col-right > section').first()).toHaveAttribute('aria-labelledby', 'geometryH');
  await page.locator('#iconAliases').fill('suggestion, vote, ballot'); await page.locator('#iconAliases').press('Tab');
  await page.locator('#libSearch').fill('ballot'); await expect(page.locator('.lib-item:visible')).toHaveCount(1);
  await page.locator('#libToggle').click(); await expect(page.locator('#libBody')).toBeHidden();
  await page.reload(); await page.waitForFunction(() => window.__gw?.ready);
  await expect(page.locator('#libBody')).toBeHidden(); await page.locator('#libToggle').click();
  await page.locator('#libSearch').fill('ballot'); await expect(page.locator('.lib-item:visible')).toHaveCount(1);
  expect(errors).toEqual([]);
});
test('file import add/overwrite, atomic rejection, and single/all downloads', async ({ page }) => {
  await ready(page);
  const source = await page.evaluate(() => structuredClone(window.__gw.S.lib[0])); source.aliases = ['ballot'];
  await page.locator('#impFile').setInputFiles({ name: 'one.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await expect(page.locator('.lib-item')).toHaveCount(5);
  await page.locator('#importMode').selectOption('overwrite'); source.description = 'Updated';
  await page.locator('#impFile').setInputFiles({ name: 'replace.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await expect(page.locator('.lib-item')).toHaveCount(5);
  expect(await page.evaluate(() => window.__gw.S.lib[0].description)).toBe('Updated');
  await page.locator('#ioText').fill(JSON.stringify([source, { name: 'invalid', layers: [{}] }])); await page.locator('#importBtn').click();
  await expect(page.locator('#status')).toContainText('Import:'); await expect(page.locator('.lib-item')).toHaveCount(5);
  for (const [id, count] of [['expOne', 1], ['expAll', 5]]) {
    const downloadPromise = page.waitForEvent('download'); await page.locator(`#${id}`).click(); const download = await downloadPromise;
    const data = JSON.parse(await readFile(await download.path(), 'utf8')); expect(data.count).toBe(count); expect(data.glyphs).toHaveLength(count);
  }
});
test('pen inserts/removes points in a parametric line, undo restores geometry; group symmetry is scoped', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => { const app=window.__gw; app.S.sel=[{l:0,p:[0]}]; app.setTool('pen'); app.refresh(true); });
  const canvas=page.locator('#canvas'); const rect=await canvas.boundingBox();
  const point = async (x,y) => page.evaluate(({x,y}) => { const svg=document.querySelector('#canvas'),p=svg.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(svg.getScreenCTM());return {x:q.x,y:q.y}; }, {x,y});
  const middle=await point(10,12); await page.mouse.click(middle.x,middle.y);
  expect(await page.evaluate(()=>window.__gw.getNode({l:0,p:[0]}).shape)).toBe('pen');
  expect(await page.evaluate(()=>window.__gw.getNode({l:0,p:[0]}).pts.length)).toBe(3);
  await page.keyboard.down('Alt'); await page.mouse.click(middle.x,middle.y); await page.keyboard.up('Alt');
  expect(await page.evaluate(()=>window.__gw.getNode({l:0,p:[0]}).pts.length)).toBe(2);
  await page.locator('#undoBtn').click(); expect(await page.evaluate(()=>window.__gw.getNode({l:0,p:[0]}).pts.length)).toBe(3);
  await page.evaluate(() => {window.__gw.S.sel=[{l:0,p:[]}];window.__gw.refresh(true);});
  await page.locator('#symScope').selectOption('group'); await page.locator('[data-rot="6"]').click();
  expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.symmetry.rotate)).toBe(6);
  expect(await page.evaluate(()=>window.__gw.S.glyph.symmetry.rotate)).toBe(1);
});
test('app icon, per-layer colors, set settings, points and overlap diagnostics', async ({ page }) => {
  await ready(page); await page.locator('#tplSel').selectOption('app'); await page.locator('#newBtn').click();
  await expect(page.locator('#drawingMode')).toHaveValue('app-icon'); await expect(page.locator('#exportSize')).toHaveValue('1024');
  await page.locator('[data-palette="circle"]').click();
  await page.evaluate(()=>{window.__gw.S.glyph.layers[1].color='#ff0000';window.__gw.commit();window.__gw.refresh(true);});
  await page.locator('#expBaked').click(); const svg=await page.locator('#ioText').inputValue();
  expect(svg).toContain('#ff0000');expect(svg).toContain('#0267e0');expect(svg).toContain('width="1024"');
  await expect(page.locator('#pvLight path[fill="#ff0000"]').first()).toHaveCount(1);
  const pngPromise=page.waitForEvent('download');await page.locator('#downloadPng').click();const png=await pngPromise;const bytes=await readFile(await png.path());expect(bytes.readUInt32BE(16)).toBe(1024);expect(bytes.readUInt32BE(20)).toBe(1024);
  await page.locator('#setThicknessEnabled').check(); await page.locator('#setRoundingEnabled').check();
  expect(await page.evaluate(()=>window.__gw.S.lib.every(g=>g.setStyle.thickness===1.6&&g.setStyle.rounding===0.5))).toBe(true);
  await expect(page.locator('#pointRows tr').first()).toBeVisible();
  await page.evaluate(()=>{const app=window.__gw; app.S.glyph.layers[1].node.children=[{shape:'line',x1:4,y1:12,x2:20,y2:12},{shape:'line',x1:20,y1:12,x2:4,y2:12}];app.refresh(true);});
  await expect(page.locator('#geometrySummary')).toContainText('coincident segment(s)');
});
test('corner rounding controls stroke joins and caps across canvas, previews and exports, and disabling restores choices', async ({ page }) => {
  await ready(page);
  await page.locator('#ioText').fill(JSON.stringify({ name: 'rounding-check', layers: [{ id: 'stroke', paint: 'stroke', node: { shape: 'path', d: 'M4 16L12 4L20 16', cap: 'butt' } }] }));
  await page.locator('#importBtn').click();
  await page.locator('[data-cap="square"]').click();
  await page.locator('[data-join="miter"]').click();
  const canvas = page.locator('#gLayers path').first();
  await expect(canvas).toHaveAttribute('stroke-linecap', 'butt');
  await expect(canvas).toHaveAttribute('stroke-linejoin', 'miter');
  await page.locator('#setRoundingEnabled').check();
  await expect(canvas).toHaveAttribute('stroke-linecap', 'round');
  await expect(canvas).toHaveAttribute('stroke-linejoin', 'round');
  const previewStyle = () => page.locator('#pvLight path').first().evaluate(path => ({ cap: getComputedStyle(path).strokeLinecap, join: getComputedStyle(path).strokeLinejoin }));
  expect(await previewStyle()).toEqual({ cap: 'round', join: 'round' });
  await page.locator('#expSvg').click();
  expect(await page.locator('#ioText').inputValue()).toContain('stroke-linecap:round;stroke-linejoin:round');
  await page.locator('#expBaked').click();
  expect(await page.locator('#ioText').inputValue()).toContain('stroke-linecap="round" stroke-linejoin="round"');
  await page.locator('#setRoundingEnabled').uncheck();
  await expect(canvas).toHaveAttribute('stroke-linecap', 'butt');
  await expect(canvas).toHaveAttribute('stroke-linejoin', 'miter');
  expect(await previewStyle()).toEqual({ cap: 'butt', join: 'miter' });
});
const importTree = async page => {
  await ready(page);
  await page.locator('#ioText').fill(JSON.stringify({ name: 'tree-check', layers: [{ id: 'art', name: 'Artwork', paint: 'fill', node: { op: 'union', name: 'Root', children: [
    { shape: 'rect', name: 'Subject', x: 2, y: 2, w: 20, h: 20 },
    { shape: 'circle', name: 'Cutout', cx: 12, cy: 12, r: 4 },
    { op: 'union', name: 'Details', children: [{ shape: 'circle', name: 'Dot', cx: 5, cy: 5, r: 1 }] },
  ] } }] }));
  await page.locator('#importBtn').click();
};
test('right-click targets the item, changes group type/symmetry and makes an editable cutter with undo', async ({ page }) => {
  await importTree(page);
  const group = page.locator('[data-tree-key="0:2"]');
  await group.click({ button: 'right' });
  await page.screenshot({ path: 'artifacts/layer-context-menu.png' });
  await page.getByRole('menuitemcheckbox', { name: 'Exclude', exact: true }).click();
  expect(await page.evaluate(() => window.__gw.S.glyph.layers[0].node.children[2].op)).toBe('exclude');
  await group.click({ button: 'right' });
  await page.getByRole('menuitemcheckbox', { name: 'Turn symmetry on' }).click();
  expect(await page.evaluate(() => window.__gw.S.glyph.layers[0].node.children[2].symmetry.mirror)).toBe('x');
  expect(await page.evaluate(() => window.__gw.S.glyph.symmetry.mirror)).toBeNull();
  const cutout = page.locator('[data-tree-key="0:1"]');
  await cutout.focus(); await page.keyboard.press('Shift+F10');
  await page.getByRole('menuitem', { name: 'Use as cutter', exact: true }).click();
  expect(await page.evaluate(() => {
    const { S, core } = window.__gw, node = S.glyph.layers[0].node;
    return { type: node.op, cutter: node.children[1].name, hole: !core.evalNode(node).closed.contains([12, 12]), shape: node.children[1].shape };
  })).toEqual({ type: 'subtract', cutter: 'Cutout', hole: true, shape: 'circle' });
  await page.locator('#undoBtn').click();
  expect(await page.evaluate(() => window.__gw.S.glyph.layers[0].node.op)).toBe('union');
  await cutout.click(); await page.locator('#makeCutterBtn').click();
  expect(await page.evaluate(() => window.__gw.S.glyph.layers[0].node.op)).toBe('subtract');
});
test('physical tree dragging reorders objects, nests them, rejects cycles, supports undo and persists', async ({ page }) => {
  await importTree(page);
  const row = path => page.locator(`[data-tree-key="0:${path}"]`);
  await row('0').locator('.name').dragTo(row('1'), { targetPosition: { x: 100, y: 25 } });
  expect(await page.evaluate(() => window.__gw.S.glyph.layers[0].node.children.map(node => node.name))).toEqual(['Cutout', 'Subject', 'Details']);
  await page.locator('#undoBtn').click();
  await row('0').locator('.name').dragTo(row('2'));
  expect(await page.evaluate(() => window.__gw.S.glyph.layers[0].node.children[1].children.map(node => node.name))).toEqual(['Dot', 'Subject']);
  const before = await page.evaluate(() => JSON.stringify(window.__gw.S.glyph));
  await row('1').locator('.name').dragTo(row('1.0'));
  expect(await page.evaluate(() => JSON.stringify(window.__gw.S.glyph))).toBe(before);
  await page.evaluate(() => window.__gw.flushSaves());
  await page.reload(); await page.waitForFunction(() => window.__gw?.ready);
  expect(await page.evaluate(() => window.__gw.S.glyph.layers[0].node.children[1].children.map(node => node.name))).toEqual(['Dot', 'Subject']);
});
test('Show icon palette and zoom sit below the canvas, support toggling, Escape and mobile bounds', async ({ page }) => {
  await ready(page);
  expect(await page.evaluate(() => {
    const named = node => !!node.name && (node.children || []).every(named);
    return window.__gw.S.lib.every(glyph => glyph.layers.every(layer => !!layer.name && named(layer.node)));
  })).toBe(true);
  const canvas = await page.locator('#canvas').boundingBox(), controls = await page.locator('.view-controls').boundingBox();
  expect(controls.y).toBeGreaterThanOrEqual(canvas.y + canvas.height);
  await expect(page.locator('#showPalette')).toBeHidden();
  await page.locator('#showToggle').click();
  await expect(page.locator('#showPalette')).toBeVisible();
  await expect(page.locator('#showPalette [data-show] svg')).toHaveCount(9);
  await page.locator('#showPalette [data-show="points"]').click();
  await expect(page.locator('[data-show="points"]')).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Escape');
  await expect(page.locator('#showPalette')).toBeHidden();
  await expect(page.locator('#showToggle')).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#showToggle').click();
  const palette = await page.locator('#showPalette').boundingBox();
  expect(palette.x).toBeGreaterThanOrEqual(0); expect(palette.x + palette.width).toBeLessThanOrEqual(390);
  await expect(page.locator('#showPalette')).toBeVisible();
  await page.screenshot({ path: 'artifacts/view-palette-mobile.png' });
});
test('library thumbnail menu changes icon type and exposes its root group symmetry', async ({ page }) => {
  await ready(page);
  await page.locator('.lib-item[data-name="arrow-down"]').click({ button: 'right' });
  await page.getByRole('menuitemcheckbox', { name: 'App icon', exact: true }).click();
  await expect(page.locator('#drawingMode')).toHaveValue('app-icon');
  expect(await page.evaluate(() => window.__gw.S.glyph.name)).toBe('arrow-down');
  await page.locator('.lib-item[data-name="arrow-down"]').click({ button: 'right' });
  await page.getByRole('menuitemcheckbox', { name: 'Mirror Y', exact: true }).click();
  expect(await page.evaluate(() => window.__gw.S.glyph.layers[0].node.symmetry.mirror)).toBe('y');
});
test('desktop/mobile layout and dark theme remain readable', async ({ page }) => {
  await ready(page);
  await page.screenshot({ path: 'artifacts/workbench-desktop.png', fullPage: true });
  await page.locator('#themeBtn').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: 'artifacts/workbench-dark.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/workbench-mobile.png', fullPage: true });
});
