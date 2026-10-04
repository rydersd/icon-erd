import { readLibraryZIP } from '../../src/library-zip.js';
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const ready = async page => { await page.goto('/'); await page.waitForFunction(() => window.__gw?.ready); };
test('fresh launch, Font Awesome controls, remembered library collapse, metadata search and top-right diagnostics', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  await expect(page.locator('.lib-item')).toHaveCount(4);
  await expect(page.locator('#undoBtn svg path')).toHaveCount(1);
  await expect(page.locator('.col-right > details').first()).toHaveAttribute('aria-labelledby', 'geometryH');
  await page.locator('#iconAliases').fill('suggestion, vote, ballot'); await page.locator('#iconAliases').press('Tab');
  await page.locator('#libSearch').fill('ballot'); await expect(page.locator('.lib-item:visible')).toHaveCount(1);
  await page.locator('#libToggle').click(); await expect(page.locator('#libBody')).toBeHidden();
  await page.reload(); await page.waitForFunction(() => window.__gw?.ready);
  await expect(page.locator('#libBody')).toBeHidden(); await page.locator('#libToggle').click();
  await page.locator('#libSearch').fill('ballot'); await expect(page.locator('.lib-item:visible')).toHaveCount(1);
  expect(errors).toEqual([]);
});
test('file import add/replace library, atomic rejection, and single/all downloads', async ({ page }) => {
  await ready(page);
  const source = await page.evaluate(() => structuredClone(window.__gw.S.lib[0])); source.aliases = ['ballot'];
  await page.locator('#impFile').setInputFiles({ name: 'one.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await expect(page.getByRole('dialog',{name:'Import icons'})).toBeVisible();
  await expect(page.locator('#importSummary')).toContainText('1 matching existing name');
  await expect(page.locator('.lib-item')).toHaveCount(4);await expect(page.locator('#importReplace')).not.toBeChecked();
  await page.locator('#cancelImportBtn').click();await expect(page.locator('.lib-item')).toHaveCount(4);
  await page.locator('#impFile').setInputFiles({ name: 'one.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await page.locator('#confirmImportBtn').click();
  await expect(page.locator('.lib-item')).toHaveCount(5);
  source.description = 'Updated';
  await page.locator('#impFile').setInputFiles({ name: 'replace.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await page.locator('#importReplace').check();await page.locator('#confirmImportBtn').click();
  await expect(page.locator('.lib-item')).toHaveCount(1);
  await expect.poll(()=>page.evaluate(() => window.__gw.S.lib[0].description)).toBe('Updated');
  await page.locator('#ioText').fill(JSON.stringify([source, { name: 'invalid', layers: [{}] }])); await page.locator('#importBtn').click();
  await expect(page.locator('#status')).toContainText('Import:'); await expect(page.locator('.lib-item')).toHaveCount(1);
  for (const [id, count] of [['expOne', 1], ['expAll', 1]]) {
    await page.locator('.export-options').evaluate(el=>el.open=true);const downloadPromise = page.waitForEvent('download'); await page.locator(`#${id}`).click(); const download = await downloadPromise;
    const data = JSON.parse(readLibraryZIP(await readFile(await download.path()))); expect(data.count).toBe(count); expect(data.glyphs).toHaveLength(count);
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
  await page.locator('#setEndRoundingEnabled').check();
  expect(await page.evaluate(()=>window.__gw.S.lib.every(g=>g.setStyle.thickness===1.6&&g.setStyle.rounding===0.5))).toBe(true);
  await expect(page.locator('#pointRows tr').first()).toBeVisible();
  await page.evaluate(()=>{const app=window.__gw; app.S.glyph.layers[1].node.children=[{shape:'line',x1:4,y1:12,x2:20,y2:12},{shape:'line',x1:20,y1:12,x2:4,y2:12}];app.refresh(true);});
  await expect(page.locator('#geometrySummary')).toContainText('coincident segment(s)');
});
test('corner rounding controls stroke joins and caps across canvas, previews and exports, and disabling restores choices', async ({ page }) => {
  await ready(page);
  await page.locator('#ioText').fill(JSON.stringify({ name: 'rounding-check', layers: [{ id: 'stroke', paint: 'stroke', node: { shape: 'path', d: 'M4 16L12 4L20 16', cap: 'butt' } }] }));
  await page.locator('#importBtn').click();await page.locator('#confirmImportBtn').click();
  await page.locator('[data-cap="square"]').click();
  await page.locator('[data-join="miter"]').click();
  const canvas = page.locator('#gLayers path').first();
  await expect(canvas).toHaveAttribute('stroke-linecap', 'butt');
  await expect(canvas).toHaveAttribute('stroke-linejoin', 'miter');
  await page.locator('#setRoundingEnabled').check();
  await page.locator('#setEndRoundingEnabled').check();
  await expect(canvas).toHaveAttribute('stroke-linecap', 'butt');
  await expect(canvas).toHaveAttribute('stroke-linejoin', 'round');
  const previewStyle = () => page.locator('#pvLight path').first().evaluate(path => ({ cap: getComputedStyle(path).strokeLinecap, join: getComputedStyle(path).strokeLinejoin }));
  expect(await previewStyle()).toEqual({ cap: 'butt', join: 'round' });
  await page.locator('#expSvg').click();
  expect(await page.locator('#ioText').inputValue()).toContain('stroke-linecap:butt;stroke-linejoin:round');
  await page.locator('#expBaked').click();
  expect(await page.locator('#ioText').inputValue()).toContain('stroke-linecap="butt" stroke-linejoin="round"');
  await page.locator('#setRoundingEnabled').uncheck();
  await page.locator('#setEndRoundingEnabled').uncheck();
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
  await page.locator('#importBtn').click();await page.locator('#confirmImportBtn').click();
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
  await page.getByRole('menuitemcheckbox', { name: 'Use as cutter', exact: true }).click();
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
test('View grid density changes displayed lines independently of snapping and survives reload', async ({ page }) => {
  await ready(page);
  await page.locator('#showToggle').click();
  await page.getByLabel('Grid spacing', { exact: true }).selectOption('2');
  await expect(page.locator('#gGrid path')).toHaveCount(1);
  const sparse = await page.locator('#gGrid path').getAttribute('d');
  expect(sparse).toContain('M2 0V24'); expect(sparse).not.toContain('M1 0V24');
  await page.getByLabel('Grid spacing', { exact: true }).selectOption('0.1');
  const dense = await page.locator('#gGrid path').getAttribute('d');
  expect(dense.length).toBeGreaterThan(sparse.length * 10);
  await expect(page.locator('[data-snap="0.1"]')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await page.locator('[data-tree-key="0:0"] .name').click();
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => window.__gw.S.glyph.layers[0].node.children[0].x1)).toBe(5);
  await page.locator('[data-snap="0.5"]').click();
  expect(await page.locator('#gGrid path').getAttribute('d')).toBe(dense);
  await page.reload(); await page.waitForFunction(() => window.__gw?.ready);
  await page.locator('#showToggle').click();
  await expect(page.getByLabel('Grid spacing', { exact: true })).toHaveValue('0.1');
});
test('Radius rounds joined strokes and the isolated view agrees with the canvas', async ({ page }) => {
  await ready(page);
  await page.locator('#ioText').fill(JSON.stringify({ name: 'joined-stroke', layers: [{ id: 'stroke', paint: 'stroke', node: { op: 'union', children: [
    { shape: 'line', x1: 4, y1: 4, x2: 16, y2: 4 }, { shape: 'line', x1: 16, y1: 4, x2: 16, y2: 20 },
  ] } }] }));
  await page.locator('#importBtn').click();await page.locator('#confirmImportBtn').click();
  await page.locator('#setRoundingEnabled').check();
  await page.locator('#setEndRoundingEnabled').check();
  await page.locator('#setRounding').fill('2'); await page.locator('#setRounding').press('Tab');
  const rounded = await page.locator('#gLayers path').first().getAttribute('d');
  expect(rounded).toContain('C');
  await page.locator('[data-isolate="0:"]').click();
  await expect(page.locator('#gIso > path')).toHaveAttribute('d', rounded);
  await page.locator('#setRounding').fill('0.5'); await page.locator('#setRounding').press('Tab');
  const smaller = await page.locator('#gLayers path').first().getAttribute('d');
  expect(smaller).not.toBe(rounded);
  await expect(page.locator('#gIso > path')).toHaveAttribute('d', smaller);
  await page.locator('#setRoundingEnabled').uncheck();
  expect(await page.locator('#gLayers path').first().getAttribute('d')).not.toContain('C');
});
test('desktop/mobile layout and dark theme remain readable', async ({ page }) => {
  await ready(page);
  await page.screenshot({ path: 'artifacts/workbench-desktop.png', fullPage: true });
  await page.getByRole('button',{name:'Dark theme',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: 'artifacts/workbench-dark.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/workbench-mobile.png', fullPage: true });
});

test('source anchor selection and rounding tags change individual stroke tips with undo and persistence', async ({ page }) => {
  await ready(page);
  await page.locator('#ioText').fill(JSON.stringify({ name: 'tagged-tips', layers: [{ id: 'stroke', paint: 'stroke', node: { shape: 'pen', name: 'Stem', pts: [{ x: 12, y: 5 }, { x: 12, y: 20 }] } }] }));
  await page.locator('#importBtn').click();await page.locator('#confirmImportBtn').click();
  await page.locator('#setRoundingEnabled').check();
  await page.locator('#setEndRoundingEnabled').check();
  await page.locator('#setEndRounding').fill('0.1'); await page.locator('#setEndRounding').press('Tab');
  const tips = page.locator('#gLayers [data-stroke-tip] path');
  await expect(tips).toHaveCount(2);
  const small = await tips.first().getAttribute('d');
  await page.locator('#setEndRounding').fill('0.6'); await page.locator('#setEndRounding').press('Tab');
  expect(await tips.first().getAttribute('d')).not.toBe(small);
  await page.locator('[data-source-point="0::0"]').click();
  await expect(page.locator('#gPoints [data-selected-source-point]')).toHaveCount(1);
  expect(await page.evaluate(() => window.__gw.S.anchor)).toBe(0);
  const roundedEnd = await tips.last().getAttribute('d');
  await page.getByRole('checkbox', { name: 'Round Stem anchor 1', exact: true }).uncheck();
  expect(await tips.first().getAttribute('d')).not.toBe(roundedEnd);
  await expect(tips.last()).toHaveAttribute('d', roundedEnd);
  await page.locator('#undoBtn').click();
  await expect(page.getByRole('checkbox', { name: 'Round Stem anchor 1', exact: true })).toBeChecked();
  await page.getByRole('checkbox', { name: 'Round Stem anchor 1', exact: true }).uncheck();
  await page.waitForTimeout(600);
  await page.reload(); await page.waitForFunction(() => window.__gw?.ready);
  await expect(page.getByRole('checkbox', { name: 'Round Stem anchor 1', exact: true })).not.toBeChecked();
});

test('tip radius changes rendered pixels in runtime and baked SVG', async ({ page }) => {
  await ready(page);
  const pixels = await page.evaluate(async () => {
    const glyph = { name: 'pixel-tip', setStyle: { rounding: 0.1, thickness: 2 }, layers: [{ id: 'stem', paint: 'stroke', node: { shape: 'line', x1: 12, y1: 5, x2: 12, y2: 20 } }] };
    const sample = async (mode, radius) => {
      glyph.setStyle.rounding = radius;
      const svg = window.__gw.core.toSVG(glyph, { mode, size: 240 });
      const image = new Image(); image.src = 'data:image/svg+xml,' + encodeURIComponent(svg); await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 240;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
      return context.getImageData(128, 42, 1, 1).data[3];
    };
    return { runtimeSmall: await sample('runtime', 0.1), runtimeRound: await sample('runtime', 1), bakedSmall: await sample('baked', 0.1), bakedRound: await sample('baked', 1) };
  });
  expect(pixels.runtimeSmall).toBeGreaterThan(240); expect(pixels.bakedSmall).toBeGreaterThan(240);
  expect(pixels.runtimeRound).toBeLessThan(15); expect(pixels.bakedRound).toBeLessThan(15);
});

test('corner and line-end radii are independent', async ({ page }) => {
  await ready(page);
  await page.locator('#ioText').fill(JSON.stringify({ name: 'independent-radii', layers: [{ id: 'stroke', paint: 'stroke', node: { shape: 'pen', pts: [{ x: 4, y: 4 }, { x: 16, y: 4 }, { x: 16, y: 20 }] } }] }));
  await page.locator('#importBtn').click();await page.locator('#confirmImportBtn').click();
  await page.locator('#setEndRoundingEnabled').check();
  const path = page.locator('#gLayers > path').first();
  const tip = page.locator('#gLayers [data-stroke-tip] path').first();
  const sharp = await path.getAttribute('d'), originalTip = await tip.getAttribute('d');
  expect(sharp).not.toContain('C');
  await page.locator('#setRoundingEnabled').check();
  await page.locator('#setRounding').fill('2'); await page.locator('#setRounding').press('Tab');
  const rounded = await path.getAttribute('d'); expect(rounded).toContain('C');
  await expect(tip).toHaveAttribute('d', originalTip);
  await page.locator('#setEndRounding').fill('0.1'); await page.locator('#setEndRounding').press('Tab');
  await expect(path).toHaveAttribute('d', rounded);
  expect(await tip.getAttribute('d')).not.toBe(originalTip);
  await page.locator('#setEndRoundingEnabled').uncheck();
  await expect(page.locator('#gLayers [data-stroke-tip]')).toHaveCount(0);
  await expect(path).toHaveAttribute('d', rounded);
});

test('Use as cutter toggles back to normal geometry from the context menu and inspector', async ({ page }) => {
  await importTree(page);
  await page.locator('[data-tree-key="0:1"]').click({ button: 'right' });
  const toggle = page.getByRole('menuitemcheckbox', { name: 'Use as cutter', exact: true });
  await expect(toggle).toHaveAttribute('aria-checked', 'false'); await toggle.click();
  await page.locator('[data-tree-key="0:1"]').click({ button: 'right' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true'); await toggle.click();
  expect(await page.evaluate(() => window.__gw.S.glyph.layers[0].node.op)).toBe('union');
  const inspector = page.locator('#insp').getByRole('button', { name: 'Use as cutter', exact: true });
  await expect(inspector).toHaveAttribute('aria-pressed', 'false'); await inspector.click();
  await expect(inspector).toHaveAttribute('aria-pressed', 'true'); await inspector.click();
  await expect(inspector).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => window.__gw.S.glyph.layers[0].node.children[1].shape)).toBe('circle');
});

const screenPoint = (page, x, y) => page.evaluate(({x,y}) => { const svg=document.querySelector('#canvas'),point=svg.createSVGPoint();point.x=x;point.y=y;const screen=point.matrixTransform(svg.getScreenCTM());return {x:screen.x,y:screen.y}; },{x,y});
test('Direct selection selects and moves multiple anchors independently from object selection', async ({page}) => {
  await ready(page);
  await page.locator('#ioText').fill(JSON.stringify({name:'direct-fixture',layers:[{id:'lines',paint:'stroke',node:{op:'union',children:[{shape:'pen',name:'Bent line',pts:[{x:4,y:4},{x:12,y:4},{x:12,y:12},{x:20,y:12}]}]}}]}));await page.locator('#importBtn').click();await page.locator('#confirmImportBtn').click();await expect(page.locator('#hdrName')).toHaveText('direct-fixture');
  await page.locator('#canvas').focus();await page.keyboard.press('v');
  const start=await screenPoint(page,4,4);await page.mouse.click(start.x,start.y);
  expect(await page.evaluate(()=>window.__gw.S.sel[0].p)).toEqual([]);
  await page.keyboard.press('a');await page.mouse.click(start.x,start.y);
  await expect(page.locator('#gSel [data-anchor="0"]')).toHaveAttribute('data-selected','true');
  const second=await screenPoint(page,12,12);await page.keyboard.down('Shift');await page.mouse.click(second.x,second.y);await page.keyboard.up('Shift');
  await expect(page.locator('#gSel [data-anchor][data-selected="true"]')).toHaveCount(2);
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.children[0].pts.map(point=>point.x))).toEqual([4.1,12,12.1,20]);
  const from=await screenPoint(page,4.1,4),to=await screenPoint(page,5.1,5);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:5});await page.mouse.up();
  expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.children[0].pts.slice(0,3).map(point=>[point.x,point.y]))).toEqual([[5.1,5],[12,4],[13.1,13]]);
  await page.keyboard.press('Delete');expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.children[0].pts.length)).toBe(2);
  await page.locator('#undoBtn').click();expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.children[0].pts.length)).toBe(4);
  await page.keyboard.press('v');await expect(page.locator('[data-tool="select"]')).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('p');await expect(page.locator('[data-tool="pen"]')).toHaveAttribute('aria-pressed','true');
});
test('rounded, square and disconnected anchors have circle, square and diamond markers', async ({page}) => {
  await ready(page);await page.locator('#ioText').fill(JSON.stringify({name:'marker-fixture',setStyle:{rounding:1,endRounding:0},layers:[{id:'stroke',paint:'stroke',node:{shape:'pen',name:'Markers',pts:[{x:4,y:4},{x:12,y:4},{x:12,y:12,in:[0,-1],out:[1,0]},{x:20,y:12}]}}]}));await page.locator('#importBtn').click();await page.locator('#confirmImportBtn').click();
  await page.locator('[data-source-point="0::0"]').click();
  await expect(page.locator('#gSel [data-anchor="0"]')).toHaveAttribute('data-point-kind','square');
  await expect(page.locator('#gSel [data-anchor="1"]')).toHaveAttribute('data-point-kind','circle');
  await expect(page.locator('#gSel [data-anchor="2"]')).toHaveAttribute('data-point-kind','diamond');
  const corner = await screenPoint(page,12,4);await page.mouse.click(corner.x,corner.y);
  await page.getByRole('checkbox',{name:'Round Markers anchor 2',exact:true}).uncheck();
  await expect(page.locator('#gSel [data-anchor="1"]')).toHaveAttribute('data-point-kind','square');
});
test('Alt-click defines persistent snap slots and shortcuts can be remapped without conflicts',async({page})=>{
  await ready(page);await page.locator('[data-snap="0.3"]').click({modifiers:['Alt']});
  await page.getByRole('spinbutton',{name:'Custom snap spacing'}).fill('0.2');await page.getByRole('menuitem',{name:'Save snap spacing',exact:true}).click();
  await expect(page.locator('[data-snap="0.2"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('.shortcut-settings summary').click();
  await page.getByRole('textbox',{name:'Selection shortcut',exact:true}).press('a');await expect(page.locator('#status')).toContainText('already assigned');
  await page.getByRole('textbox',{name:'Selection shortcut',exact:true}).press('x');
  await page.reload();await page.waitForFunction(()=>window.__gw?.ready);await expect(page.locator('[data-snap="0.2"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#canvas').focus();await page.keyboard.press('a');await expect(page.locator('[data-tool="direct"]')).toHaveAttribute('aria-pressed','true');await page.keyboard.press('x');await expect(page.locator('[data-tool="select"]')).toHaveAttribute('aria-pressed','true');
});
test('import originals reset after reload and exported archives retain baselines; library reset is recoverable',async({page})=>{
  await ready(page);const original={name:'reset-fixture',layers:[{id:'art',name:'Artwork',paint:'fill',node:{shape:'rect',name:'Body',x:4,y:4,w:16,h:16}}]};
  await page.locator('#impFile').setInputFiles({name:'original.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(original))});
  await page.locator('#confirmImportBtn').click();
  await expect(page.locator('#hdrName')).toHaveText('reset-fixture');
  await expect(page.locator('#revertBtn')).toBeDisabled();
  await page.locator('#iconDescription').fill('Edited description');await page.locator('#iconDescription').press('Tab');
  await page.waitForTimeout(400);await page.reload();await page.waitForFunction(()=>window.__gw?.ready);
  await expect(page.locator('#revertBtn')).toBeEnabled();
  await page.locator('.export-options').evaluate(el=>el.open=true);const pending=page.waitForEvent('download');await page.locator('#expOne').click();const archive=JSON.parse(readLibraryZIP(await readFile(await(await pending).path())));
  expect(archive.originals[0].description).toBeUndefined();expect(archive.glyphs[0].description).toBe('Edited description');
  await page.locator('#revertBtn').click();await expect(page.locator('#iconDescription')).toHaveValue('');await page.locator('#undoBtn').click();await expect(page.locator('#iconDescription')).toHaveValue('Edited description');
  await page.locator('#resetLibraryBtn').click();await expect(page.locator('#iconDescription')).toHaveValue('');
  await page.reload();await page.waitForFunction(()=>window.__gw?.ready);await page.locator('#undoLibraryResetBtn').click();await expect(page.locator('#iconDescription')).toHaveValue('Edited description');
  await page.locator('#impFile').setInputFiles({name:'archive.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(archive))});
  await page.locator('#confirmImportBtn').click();
  await expect(page.locator('#hdrName')).toHaveText('reset-fixture-2');await page.locator('#revertBtn').click();await expect(page.locator('#iconDescription')).toHaveValue('');
});

test('Direct selection extends across paths without moving unselected anchors',async({page})=>{
  await ready(page);await page.locator('#ioText').fill(JSON.stringify({name:'multiple-path-points',layers:[{id:'lines',paint:'stroke',node:{op:'union',children:[{shape:'pen',name:'Upper line',pts:[{x:4,y:4},{x:20,y:4}]},{shape:'pen',name:'Lower line',pts:[{x:4,y:20},{x:20,y:20}]}]}}]}));await page.locator('#importBtn').click();await page.locator('#confirmImportBtn').click();
  await expect(page.locator('#hdrName')).toHaveText('multiple-path-points');await page.locator('[data-source-point="0:0:0"]').click();
  const point=await screenPoint(page,4,20);await page.keyboard.down('Shift');await page.mouse.click(point.x,point.y);await page.keyboard.up('Shift');
  await expect(page.locator('#gSel [data-anchor][data-selected="true"]')).toHaveCount(2);await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.children.map(node=>node.pts.map(point=>point.x)))).toEqual([[4.1,20],[4.1,20]]);
});

test('appearance card customizes colors, opacity and ruler weights independently by theme and persists',async({page})=>{
  await ready(page);
  await page.getByRole('button',{name:'Light theme',exact:true}).click();
  await page.getByRole('button',{name:'Customize appearance',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Customize appearance'})).toBeVisible();
  await expect(page.getByRole('spinbutton',{name:'Minor grid opacity',exact:true})).toHaveValue('5');
  await page.locator('#appearance-grid-major').fill('#aabbcc');await page.getByRole('spinbutton',{name:'Major grid opacity',exact:true}).fill('45');
  await page.locator('#appearance-accent').fill('#cc2244');await page.getByRole('spinbutton',{name:'Rulers Tick weight',exact:true}).fill('2');await page.getByRole('spinbutton',{name:'Rulers Tick weight',exact:true}).press('Tab');
  await expect(page.locator('#rulerTop path').first()).toHaveCSS('stroke-width','2px');
  expect(await page.locator('#gGrid path').evaluateAll(elements=>elements.map(el=>getComputedStyle(el).stroke))).toContain('rgba(170, 187, 204, 0.45)');
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Dark theme',exact:true}).click();
  expect(await page.locator('html').evaluate(el=>el.style.getPropertyValue('--accent'))).toBe('');
  await page.getByRole('button',{name:'Light theme',exact:true}).click();
  expect(await page.locator('html').evaluate(el=>el.style.getPropertyValue('--accent'))).toBe('rgba(204,34,68,1)');
  await page.reload();await page.waitForFunction(()=>window.__gw?.ready);
  expect(await page.locator('html').evaluate(el=>el.style.getPropertyValue('--grid-major'))).toBe('rgba(170,187,204,0.45)');
  await page.getByRole('button',{name:'Customize appearance',exact:true}).click();await page.screenshot({path:'artifacts/appearance-card.png'});
  await page.getByRole('button',{name:'Reset this theme',exact:true}).click();expect(await page.locator('html').evaluate(el=>el.style.getPropertyValue('--accent'))).toBe('');
  await page.keyboard.press('Escape');await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Customize appearance',exact:true}).click();const bounds=await page.locator('#appearancePalette').boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(390);
});

test('primary groups organize library and ZIP folders; tags search, collapsed groups persist and bulk suggestions are reversible',async({page})=>{
 await ready(page);await page.locator('#iconGroup').fill('Navigation/Arrows');await page.locator('#iconGroup').press('Tab');await page.locator('#iconTags').fill('pagination, table');await page.locator('#iconTags').press('Tab');
 await expect(page.locator('.lib-group').filter({hasText:'Navigation/Arrows'})).toHaveCount(1);
 await page.locator('#libSearch').fill('pagination');await expect(page.locator('.lib-item:visible')).toHaveCount(1);await page.locator('#libSearch').fill('');
 const section=page.locator('.lib-group[data-group="Navigation/Arrows"]');await section.locator('summary').click();await expect(section).not.toHaveAttribute('open');
 await page.reload();await page.waitForFunction(()=>window.__gw?.ready);await expect(section).not.toHaveAttribute('open');await page.locator('#libSearch').fill('table');await expect(section).toHaveAttribute('open');await page.locator('#libSearch').fill('');
 await page.locator('#organizeLibraryBtn').click();await expect(page.locator('#organizeSummary')).toContainText('Navigation/Arrows: 3');await page.locator('#applyOrganizeBtn').click();await expect(page.locator('.lib-group')).toHaveCount(1);await expect(page.locator('#status')).toContainText('Name-based');
 await page.locator('.export-options summary').click();await page.locator('#exportRoot').fill('icons');await page.locator('#exportRoot').press('Tab');
 const pending=page.waitForEvent('download');await page.locator('#expAll').click();const download=await pending;expect(download.suggestedFilename()).toMatch(/\.zip$/);const bytes=await readFile(await download.path());
 const exported=JSON.parse(readLibraryZIP(bytes));expect(exported.glyphs.filter(icon=>icon.group==='Navigation/Arrows')).toHaveLength(4);
 // Import the ZIP through the real picker flow and cancel first: no library mutation.
 await page.locator('#impFile').setInputFiles({name:'roundtrip.zip',mimeType:'application/zip',buffer:bytes});await expect(page.locator('#importSummary')).toContainText('4 matching existing names');await page.locator('#cancelImportBtn').click();await expect(page.locator('.lib-item')).toHaveCount(4);
 await page.locator('#undoOrganizationBtn').click();await expect(page.locator('.lib-group')).toHaveCount(2);await expect(page.locator('#iconTags')).toHaveValue('pagination, table');
});

test('library selection deletes ranges durably and restores edited icons with originals after reload',async({page})=>{
 await ready(page);await page.locator('#iconDescription').fill('Keep my artwork notes');await page.locator('#iconDescription').press('Tab');
 const tiles=page.locator('.lib-item');await tiles.nth(0).click();await tiles.nth(2).click({modifiers:['Shift']});await expect(page.locator('#librarySelectionCount')).toHaveText('3 selected');
 await expect(page.locator('.lib-item[aria-pressed=true]')).toHaveCount(3);await page.keyboard.press('Delete');await expect(tiles).toHaveCount(1);await expect(page.locator('#restoreIconsBtn')).toHaveText('Restore deleted (3)');
 await page.reload();await page.waitForFunction(()=>window.__gw?.ready);await expect(tiles).toHaveCount(1);await page.locator('#restoreIconsBtn').click();await page.locator('#selectAllDeletedBtn').click();await page.locator('#restoreSelectedIconsBtn').click();await expect(tiles).toHaveCount(4);
 await tiles.filter({hasText:'arrow-right'}).click();await expect(page.locator('#iconDescription')).toHaveValue('Keep my artwork notes');await page.locator('#revertBtn').click();await expect(page.locator('#iconDescription')).toHaveValue('');
 await page.reload();await page.waitForFunction(()=>window.__gw?.ready);await expect(tiles).toHaveCount(4);await expect(page.locator('#restoreIconsBtn')).toBeDisabled();
});
test('library toggle selection and shown selection respect search; canvas Delete still edits objects',async({page})=>{
 await ready(page);const tiles=page.locator('.lib-item');await tiles.nth(0).click();await tiles.nth(2).click({modifiers:['Meta']});await expect(page.locator('#librarySelectionCount')).toHaveText('2 selected');await tiles.nth(0).locator('.library-pick').click();await expect(page.locator('#librarySelectionCount')).toHaveText('1 selected');
 await page.locator('#clearIconSelectionBtn').click();await page.locator('#libSearch').fill('arrow-up');await page.locator('#selectShownIconsBtn').click();await expect(page.locator('#librarySelectionCount')).toHaveText('1 selected');await page.locator('#deleteIconsBtn').click();await page.locator('#libSearch').fill('');await expect(tiles).toHaveCount(3);
 await tiles.first().click({button:'right'});await page.getByRole('menuitem',{name:'Delete icon',exact:true}).click();await expect(tiles).toHaveCount(2);
 await page.locator('#restoreIconsBtn').click();await page.locator('#selectAllDeletedBtn').click();await page.locator('#restoreSelectedIconsBtn').click();await expect(tiles).toHaveCount(4);
 await page.locator('[data-tree-key="0:0"] .name').click();await page.keyboard.press('Delete');await expect(tiles).toHaveCount(4);
});
test('empty library stays empty across reload; restoring deleted collisions keeps newer imports',async({page})=>{
 await ready(page);const original=await page.evaluate(()=>structuredClone(window.__gw.S.lib[0]));await page.locator('#selectShownIconsBtn').click();await page.locator('#deleteIconsBtn').click();await expect(page.locator('.lib-item')).toHaveCount(0);
 await page.reload();await page.waitForFunction(()=>window.__gw?.ready);await expect(page.locator('.lib-item')).toHaveCount(0);await expect(page.locator('#restoreIconsBtn')).toBeEnabled();
 original.description='Newer imported version';await page.locator('#ioText').fill(JSON.stringify(original));await page.locator('#importBtn').click();await page.locator('#confirmImportBtn').click();await expect(page.locator('.lib-item')).toHaveCount(1);
 await page.locator('#restoreIconsBtn').click();await page.locator('#selectAllDeletedBtn').click();await page.locator('#restoreSelectedIconsBtn').click();await expect(page.locator('.lib-item')).toHaveCount(5);expect(await page.evaluate(()=>window.__gw.S.lib.find(icon=>icon.name==='arrow-right').description)).toBe('Newer imported version');expect(await page.evaluate(()=>window.__gw.S.lib.find(icon=>icon.name==='arrow-right-2').description)).toBeUndefined();
 await page.reload();await page.waitForFunction(()=>window.__gw?.ready);await expect(page.locator('.lib-item')).toHaveCount(5);
});

test('group review arrow takes over drawing plane and highlights reconstruction failures without replacing originals',async({page})=>{
 await ready(page);
 const report=await page.evaluate(()=>({format:'glyph-workbench-reconstruction',version:1,entries:window.__gw.S.lib.slice(0,2).map((glyph,index)=>({name:glyph.name,sourceSignature:JSON.stringify(window.__gw.core.resolve(glyph).map(layer=>({id:layer.id,paint:layer.paint,d:layer.d}))),status:index?'needs-review':'candidate',reason:index?'Ambiguous filled arrow':'Test match',candidate:index?null:{...structuredClone(glyph),weight:1.1}}))}));
 const weightBefore=await page.evaluate(()=>window.__gw.S.lib[0].weight);const before=await page.evaluate(()=>JSON.stringify(window.__gw.S.lib[0].layers));await page.locator('#impFile').setInputFiles({name:'review.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(report))});await expect(page.locator('#importReplace')).toBeHidden();await page.locator('#confirmImportBtn').click();await expect(page.locator('#status')).toContainText('Attached 2');
 expect(await page.evaluate(()=>JSON.stringify(window.__gw.S.lib[0].layers))).toBe(before);await expect(page.locator('.needs-reconstruction-review')).toHaveCount(1);
 await page.getByRole('button',{name:'Review Ungrouped',exact:true}).click();await expect(page.locator('.stage')).toBeHidden();await expect(page.locator('.group-review-card')).toHaveCount(4);await expect(page.locator('#groupReview')).toContainText('Ambiguous filled arrow');
 await page.getByRole('checkbox',{name:'Problems only',exact:true}).check();await expect(page.locator('.group-review-card:visible')).toHaveCount(1);await page.getByRole('checkbox',{name:'Problems only',exact:true}).uncheck();
 await page.getByRole('button',{name:'Use centerlines',exact:true}).click();await expect(page.locator('#groupReview')).toContainText('Centerlines applied');await page.getByRole('button',{name:'Edit arrow-right',exact:true}).click();await expect(page.locator('.stage')).toBeVisible();await expect(page.locator('#groupReview')).toBeHidden();
 await page.locator('#undoBtn').click();expect(await page.evaluate(()=>window.__gw.S.glyph.weight)).toBe(weightBefore);
 await page.reload();await page.waitForFunction(()=>window.__gw?.ready);await expect(page.locator('.needs-reconstruction-review')).toHaveCount(1);
});

test('EDS reconstruction matching keeps starter arrows separate from renamed imported arrows',async({page})=>{
 await ready(page);const source=await page.evaluate(()=>structuredClone(window.__gw.S.lib[0]));source.eds={iou24:1,iou96:1};await page.locator('#ioText').fill(JSON.stringify(source));await page.locator('#importBtn').click();await page.locator('#confirmImportBtn').click();await expect(page.locator('#hdrName')).toHaveText('arrow-right-2');
 const report=await page.evaluate(()=>({format:'glyph-workbench-reconstruction',version:1,sourceProject:'eds-icons',entries:[{name:'arrow-right',status:'existing',reason:'Existing paths',sourceSignature:JSON.stringify(window.__gw.core.resolve(window.__gw.S.glyph).map(layer=>({id:layer.id,paint:layer.paint,d:layer.d}))),candidate:null}]}));
 await page.locator('#impFile').setInputFiles({name:'eds-review.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(report))});await page.locator('#confirmImportBtn').click();await expect(page.locator('#status')).toContainText('Attached 1');
 expect(await page.evaluate(()=>window.__gw.S.lib.find(g=>g.name==='arrow-right').reconstruction)).toBeUndefined();expect(await page.evaluate(()=>window.__gw.S.lib.find(g=>g.name==='arrow-right-2').reconstruction.status)).toBe('existing');
});
