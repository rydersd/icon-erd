// AXIS-01a — library thickness curve by target point size (browser acceptance).
// Spec: wiki/product-spec/designspace-axis-01.md (private wiki). Synthetic fixtures only.
// UI contract: Library properties gains #opticalSizeEnabled (checkbox) and #opticalCurve
// (text, "points: multiplier" pairs separated by commas, e.g. "18: 1.2121, 24: 1").
// Reference size is the 24-unit authoring plane. Multipliers scale the library Thickness token.
import {test,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {unzipSync,strFromU8} from 'fflate';

const FIXTURE=new URL('../fixtures/designspace-noop.json',import.meta.url);
const ready=async page=>{await page.goto('/');await page.waitForFunction(()=>window.__gw?.ready);};
const properties=async page=>page.locator('.set-settings').evaluate(el=>el.open=true);
const exportsOpen=async page=>page.locator('.export-options').evaluate(el=>el.open=true);
const icons=[
  {name:'thin-line',group:'Fixtures',weight:1.1,layers:[{id:'art',name:'Line',paint:'stroke',node:{shape:'line',x1:3,y1:12,x2:21,y2:12}}]},
  {name:'ring',group:'Fixtures',weight:1.1,layers:[{id:'ring',name:'Ring',paint:'stroke',node:{shape:'circle',cx:12,cy:12,r:6}}]},
  {name:'bars',group:'Fixtures',weight:1.1,strokeOverride:1.5,layers:[
    {id:'wide',name:'Wide',paint:'stroke',strokeWidth:3,node:{shape:'line',x1:6,y1:4,x2:6,y2:20}},
    {id:'thin',name:'Thin',paint:'stroke',node:{shape:'line',x1:12,y1:4,x2:12,y2:20}}]},
];
// Import replaces the library asynchronously; wait for it so later settings are not overwritten.
const importFixtures=async page=>{await page.locator('#ioText').fill(JSON.stringify(icons));await page.locator('#importBtn').click();await page.locator('#confirmImportBtn').click();await page.waitForFunction(names=>{const lib=window.__gw.S.lib;return lib.length===names.length&&names.every(n=>lib.some(g=>g.name===n));},icons.map(i=>i.name));await expect(page.locator('#status')).toContainText('Replaced library');};
const select=async(page,name)=>page.locator(`.lib-item[data-name="${name}"]`).click();
const exportAll=async page=>{await exportsOpen(page);await page.locator('#exportSVGs').check();await page.locator('#exportPNGs').check();const pending=page.waitForEvent('download');await page.locator('#expAll').click();return unzipSync(await readFile(await (await pending).path()));};
const svgFiles=files=>Object.fromEntries(Object.keys(files).filter(n=>n.endsWith('.svg')).sort().map(n=>[n,strFromU8(files[n])]));
const setCurve=async(page,text)=>{await properties(page);await page.locator('#opticalSizeEnabled').check();await page.locator('#opticalCurve').fill(text);await page.locator('#opticalCurve').press('Enter');};
const strokeWidths=svg=>[...svg.matchAll(/stroke-width="([\d.]+)"/g)].map(m=>+m[1]);

// Records what a library without a designspace exports. Captured once from main
// (CAPTURE_NOOP=1) before AXIS-01a changes; every later build must reproduce it.
async function noopSnapshot(page){
  await ready(page);await importFixtures(page);await properties(page);
  await page.locator('#libraryOutputProfile').selectOption('menu-bar');
  const files=await exportAll(page);
  await select(page,'ring');
  const pending=page.waitForEvent('download');await page.locator('#downloadSvg').click();
  const single=await readFile(await (await pending).path(),'utf8');
  return {files:Object.keys(files).filter(n=>!n.endsWith('.png')).sort(),svgs:svgFiles(files),single,strip:await page.locator('#pvLight').innerHTML()};
}

test('absent designspace is a no-op',async({page})=>{
  const snapshot=await noopSnapshot(page);
  if(process.env.CAPTURE_NOOP){await writeFile(FIXTURE,JSON.stringify(snapshot,null,1)+'\n');return;}
  const golden=JSON.parse(await readFile(FIXTURE,'utf8'));
  expect(snapshot.files).toEqual(golden.files);
  for(const [name,svg] of Object.entries(golden.svgs))expect(snapshot.svgs[name],name).toBe(svg);
  expect(snapshot.single).toBe(golden.single);
  expect(snapshot.strip).toBe(golden.strip);
});

test('edit curve and undo',async({page})=>{
  await ready(page);await setCurve(page,'18: 1.2121, 24: 1');
  expect(await page.evaluate(()=>window.__gw.S.libraryProperties?.designspace?.opticalSize?.curve)).toEqual([[18,1.2121],[24,1]]);
  await page.locator('#undoBtn').click();
  expect(await page.evaluate(()=>window.__gw.S.libraryProperties?.designspace??null)).toBeNull();
  await expect(page.locator('#opticalSizeEnabled')).not.toBeChecked();
  await page.locator('#redoBtn').click();
  await expect(page.locator('#opticalSizeEnabled')).toBeChecked();
  await expect(page.locator('#opticalCurve')).toHaveValue('18: 1.2121, 24: 1');
});

test('curve survives reload',async({page})=>{
  await ready(page);await setCurve(page,'16: 1.4, 24: 1');
  await page.reload();await page.waitForFunction(()=>window.__gw?.ready);await properties(page);
  await expect(page.locator('#opticalSizeEnabled')).toBeChecked();
  await expect(page.locator('#opticalCurve')).toHaveValue('16: 1.4, 24: 1');
});

test('curve round-trips JSON and ZIP',async({page})=>{
  await ready(page);await importFixtures(page);await setCurve(page,'18: 1.2121, 24: 1');
  const files=await exportAll(page);
  const doc=JSON.parse(strFromU8(files['library.json']));
  expect(doc.libraryProperties.designspace.opticalSize.curve).toEqual([[18,1.2121],[24,1]]);
  await page.evaluate(()=>window.__gw.S.libraryProperties&&delete window.__gw.S.libraryProperties.designspace);
  await page.locator('#ioText').fill(JSON.stringify(doc));await page.locator('#importBtn').click();
  await page.locator('#importReplace').check();await page.locator('#confirmImportBtn').click();
  await expect.poll(()=>page.evaluate(()=>window.__gw.S.libraryProperties?.designspace?.opticalSize?.curve)).toEqual([[18,1.2121],[24,1]]);
});

test('malformed curve rejected',async({page})=>{
  await ready(page);await setCurve(page,'18: 1.2121, 24: 1');
  await page.locator('#opticalCurve').fill('18: x, 24: 1');await page.locator('#opticalCurve').press('Enter');
  await expect(page.locator('#status')).toContainText(/curve/i);
  expect(await page.evaluate(()=>window.__gw.S.libraryProperties.designspace.opticalSize.curve)).toEqual([[18,1.2121],[24,1]]);
});

test('menu-bar 18 export uses 18 thickness',async({page})=>{
  await ready(page);await importFixtures(page);await properties(page);
  await page.locator('#libraryOutputProfile').selectOption('menu-bar');await setCurve(page,'18: 1.2121, 24: 1');
  const svgs=svgFiles(await exportAll(page));
  // 36px is 18pt @2x, so both sizes carry the 18pt thickness: 1.1 × 1.2121 ≈ 1.3333.
  for(const size of [18,36]){const widths=strokeWidths(svgs[`svg/Fixtures/thin-line-${size}.svg`]);expect(widths.length).toBeGreaterThan(0);for(const w of widths)expect(w).toBeCloseTo(1.3333,3);}
  // Absolute exceptions scale by the same ratio, keeping 3 : 1.5.
  const bars=strokeWidths(svgs['svg/Fixtures/bars-18.svg']).sort((a,b)=>a-b);
  expect(bars[0]).toBeCloseTo(1.5*1.2121,3);expect(bars.at(-1)).toBeCloseTo(3*1.2121,3);
});

test('single download equals ZIP at 18',async({page})=>{
  await ready(page);await importFixtures(page);await properties(page);
  await page.locator('#libraryOutputProfile').selectOption('menu-bar');await setCurve(page,'18: 1.2121, 24: 1');
  const svgs=svgFiles(await exportAll(page));
  await select(page,'thin-line');
  const pending=page.waitForEvent('download');await page.locator('#downloadSvg').click();
  const single=await readFile(await (await pending).path(),'utf8');
  expect(single).toBe(svgs['svg/Fixtures/thin-line-18.svg']);
});

test('size strip uses curve',async({page})=>{
  await ready(page);await importFixtures(page);await select(page,'thin-line');await setCurve(page,'16: 1.5, 24: 1');
  const width=async size=>page.locator('#pvLight .pv').filter({has:page.locator('span',{hasText:new RegExp(`^${size}$`)})}).locator('path[stroke]').first().evaluate(el=>parseFloat(getComputedStyle(el).strokeWidth));
  // Tiles render in a 24-unit viewBox; the computed width is in user units before scaling.
  expect(await width(24)).toBeCloseTo(1.1,2);
  expect(await width(16)).toBeCloseTo(1.65,2);
  expect(await width(48)).toBeCloseTo(1.1,2);
});

test('empty curve keeps its checked state and writes no history',async({page})=>{
  await ready(page);await properties(page);
  const history=()=>page.evaluate(()=>window.__gw.S.undo.length);const before=await history();
  await page.locator('#opticalSizeEnabled').check();
  await expect(page.locator('#opticalCurve')).toBeEnabled();
  await page.evaluate(()=>window.__gw.refresh(true));
  await expect(page.locator('#opticalSizeEnabled')).toBeChecked();
  await page.locator('#opticalSizeEnabled').uncheck();
  expect(await history()).toBe(before);
  expect(await page.evaluate(()=>window.__gw.S.libraryProperties?.designspace??null)).toBeNull();
});
