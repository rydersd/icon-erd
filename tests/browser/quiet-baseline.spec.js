import { test, expect } from '@playwright/test';
// UX-01 Quiet baseline. Spec: wiki/product-spec/ux-01-quiet-baseline.md (local wiki).
const boot = async page => { await page.goto('/'); await page.waitForFunction(() => window.__gw?.ready); await page.waitForTimeout(300); };
const strictVisible = 'e=>e.checkVisibility({contentVisibilityAuto:true,opacityProperty:true,visibilityProperty:true})';

// Every control reachable on main (2026-10-31 inventory, static shell markup), by id or by data hook.
const REACHABLE = ['#drawingMode','#exportSize','#revertBtn','#undoBtn','#redoBtn','#appearanceToggle','#cleanupTolerance','#mergeDistance','#cleanupSelectedBtn','#libToggle','#tplSel','#newBtn','#libSearch','#libFilter','#organizeLibraryBtn','#undoOrganizationBtn','#findSharedFormsBtn','#insetReviewBtn','#libraryVersionsBtn','#selectShownIconsBtn','#clearIconSelectionBtn','#deleteIconsBtn','#restoreIconsBtn','#impFileBtn','#exportStructure','#exportRoot','#exportSVGs','#exportPNGs','#expOne','#expEdited','#expAll','#newLibraryBtn','#resetLibraryBtn','#undoLibraryResetBtn','#libraryPropertiesMenuBtn','#setThicknessEnabled','#setThickness','#opticalSizeEnabled','#opticalCurve','#setRoundingEnabled','#setRounding','#setEndRoundingEnabled','#setEndRounding','#libraryVariant','#libraryFamilyView','#libraryColorMode','#libraryFillColor','#libraryStrokeColor','#libraryAccentColor','#libraryUseColorTokens','#libraryFillToken','#libraryStrokeToken','#libraryAccentToken','#testSolidVariantsBtn','#libraryOutputProfile','#libraryOutputSizes','#resetShortcuts','#addLayerBtn','#ungroupBtn','#makeCutterBtn','#upBtn','#downBtn','#dupBtn','#delBtn','#areaSelectBtn','#areaSelectToggle','#proximityMergeBtn','#symScope','#showToggle','#zoomOut','#zoomFit','#zoomIn','#iconDescription','#iconGroup','#iconTags','#iconAliases','#solidTreatment','#approvePreviewSolid','#wRange','#iconThicknessOverride','#iconThickness','#hintBtn','#rtlBtn','#swSecL','#swSecD','#swAccL','#swAccD','#expJson','#expSvg','#expBaked','#downloadSvg','#downloadPng','#copyBtn','#importBtn','#ioText',
  '[data-tool="select"]','[data-tool="direct"]','[data-tool="pen"]','[data-hmode="shape"]','[data-hmode="transform"]','#canvasOptions [data-group="union"]','.tree-tools [data-group="union"]','[data-snap="0.1"]','[data-mirror="x"]','[data-rot="4"]','[data-cap="round"]','[data-join="miter"]','[data-cleanup-tolerance="0.1"]','[data-theme-choice="dark"]'];

test('first screen shows at most 60 controls', async ({ page }) => {
  await boot(page);
  const count = await page.evaluate(`[...document.querySelectorAll('button,input,select,textarea')].filter(${strictVisible}).length`);
  console.log(`visible controls at load: ${count}`);
  expect(count).toBeLessThanOrEqual(60);
});

test('canvas is at least 560 px wide', async ({ page }) => {
  await boot(page);
  const box = await page.locator('#canvas').boundingBox();
  console.log(`canvas width: ${box.width}`);
  expect(box.width).toBeGreaterThanOrEqual(560);
});

test('panel headings are sentence case', async ({ page }) => {
  await boot(page);
  const upper = await page.evaluate(`[...document.querySelectorAll('.panel > h2, details > summary, legend')].filter(${strictVisible}).filter(e=>getComputedStyle(e).textTransform==='uppercase').map(e=>e.textContent.trim().slice(0,30))`);
  expect(upper).toEqual([]);
});

test('layers and inspector sit in the right column', async ({ page }) => {
  await boot(page);
  for (const sel of ['#tree', '#insp', '#pane-details']) await expect(page.locator(`#pane-right ${sel}`)).toHaveCount(1);
  await expect(page.locator('.col-left #tree')).toHaveCount(0);
  await expect(page.locator('.col-centre #insp')).toHaveCount(0);
  await expect(page.locator('.col-centre > .panel')).toHaveCount(1);
  await expect(page.locator('.col-centre > .panel #canvas')).toHaveCount(1);
});

test('secondary panels start closed', async ({ page }) => {
  await boot(page);
  for (const key of ['tool-settings', 'componentsH', 'metadataH', 'libraryActions', 'geometryH', 'measureH', 'solidPreviewH', 'exportPreviewH', 'pvH', 'ctxH', 'ioH']) {
    const panel = page.locator(`details[data-collapse="${key}"]`);
    await expect(panel, key).toHaveCount(1);
    await expect(panel, key).not.toHaveAttribute('open', '');
  }
  await expect(page.locator('details.set-settings')).not.toHaveAttribute('open', '');
  await expect(page.locator('details.shortcut-settings')).not.toHaveAttribute('open', '');
  await expect(page.locator('[data-collapse="tool-settings"] > summary')).toHaveText(/Anchor cleanup/);
});

test('stale open state does not override new defaults once', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('gw-panel-measureH', 'open'); });
  await page.reload(); await page.waitForFunction(() => window.__gw?.ready);
  const measure = page.locator('details[data-collapse="measureH"]');
  await expect(measure).not.toHaveAttribute('open', '');
  await measure.locator(':scope > summary').click();
  await expect(measure).toHaveAttribute('open', '');
  await page.reload(); await page.waitForFunction(() => window.__gw?.ready);
  await expect(measure).toHaveAttribute('open', '');
});

test('every control is still reachable', async ({ page }) => {
  await boot(page);
  const missing = [];
  for (const sel of REACHABLE) {
    const found = await page.evaluate(async ({ sel, vis }) => {
      const el = document.querySelector(sel); if (!el) return 'absent';
      for (let d = el.closest('details'); d; d = d.parentElement?.closest('details')) d.open = true;
      const opts = el.closest('.canvas-options'); const toggle = opts?.querySelector('.canvas-options-toggle');
      if (toggle && toggle.getAttribute('aria-expanded') === 'false') toggle.click();
      await new Promise(r => setTimeout(r, 50));
      return (0, eval)(vis)(el) ? 'ok' : 'hidden';
    }, { sel, vis: strictVisible });
    if (found !== 'ok') missing.push(`${sel}: ${found}`);
  }
  expect(missing).toEqual([]);
});

test('dark previews are dark', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.locator('details[data-collapse="exportPreviewH"] > summary').click();
  const art = page.locator('#exportPreview .variant-art').first();
  await expect(art).toHaveCount(1);
  const bg = await art.evaluate(e => getComputedStyle(e).backgroundImage + ' ' + getComputedStyle(e).backgroundColor);
  expect(bg).not.toContain('rgb(255, 255, 255)');
});

test('no shadows on flat controls', async ({ page }) => {
  await boot(page);
  const shadows = await page.evaluate(() => [...document.querySelectorAll('.seg, .seg .btn')].map(e => getComputedStyle(e).boxShadow).filter(s => s !== 'none'));
  expect(shadows).toEqual([]);
});
