import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {unzipSync,strFromU8} from 'fflate';
const circle=(name,paint,r=4)=>({name,weight:1.2,group:'Faces',layers:[{id:'eye',name:'Eye',role:'accent',paint,node:{shape:'circle',cx:12,cy:12,r}}]});
const pair=[circle('eye','fill',4.6),circle('eye-outline','stroke')];
const ready=async page=>{await page.goto('/');await page.waitForFunction(()=>window.__gw?.ready);};
const request=async(page,glyphs)=>{await page.locator('#impFile').setInputFiles({name:'test-set.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(glyphs))});};
test('import offers explained cleanup; cancellation and just import keep source variants',async({page})=>{
  await ready(page);await request(page,pair);await expect(page.locator('#importOnly')).toBeChecked();await expect(page.locator('#importCleanupHelp')).toContainText('untouched import');await page.locator('#importCleanup').check();await page.locator('#cancelImportBtn').click();expect(await page.evaluate(()=>window.__gw.S.lib.length)).toBe(4);
  await request(page,pair);await expect(page.locator('#importOnly')).toBeChecked();await page.locator('#confirmImportBtn').click();await expect.poll(()=>page.evaluate(()=>window.__gw.S.lib.map(g=>g.name))).toEqual(['eye','eye-outline']);
});
test('cleaned family persists, generated fills and accent tokens export, untouched imported variants restore',async({page})=>{
  await ready(page);await request(page,pair);await page.locator('#importCleanup').check();await page.locator('#confirmImportBtn').click();await expect.poll(()=>page.evaluate(()=>window.__gw.S.lib.map(g=>g.name))).toEqual(['eye']);await expect(page.locator('#status')).toContainText('1 pairs consolidated');
  await page.reload();await page.waitForFunction(()=>window.__gw?.ready);await page.locator('#libraryVariant').selectOption('both');await page.locator('#libraryColorMode').selectOption('multicolor');await page.locator('#libraryAccentColor').fill('#ff00ff');await page.locator('#libraryAccentColor').dispatchEvent('change');await page.locator('#libraryUseColorTokens').check();
  await page.locator('.export-options > summary').click();const event=page.waitForEvent('download');await page.locator('#expAll').click();const files=unzipSync(new Uint8Array(await readFile(await(await event).path())));const doc=JSON.parse(strFromU8(files['library.json']));expect(doc.glyphs.map(g=>g.name)).toEqual(['eye']);
  expect(Object.keys(files)).toContain('svg/Faces/eye-outline.svg');expect(Object.keys(files)).toContain('svg/Faces/eye.svg');expect(strFromU8(files['svg/Faces/eye.svg'])).toContain('var(--icon-accent, #ff00ff)');expect(strFromU8(files['svg/Faces/eye.svg'])).toMatch(/fill="var/);
  await page.locator('#libraryVersionsBtn').click();await page.locator('.version-row').filter({hasText:'Untouched import test-set.json'}).getByRole('button',{name:'Restore',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__gw.S.lib.map(g=>g.name))).toEqual(['eye','eye-outline']);
});
test('missing outline is isolated for review; accepting replaces that icon, Undo restores the untouched fill',async({page})=>{
  await ready(page);await request(page,[...pair,circle('dot','fill')]);await page.locator('#importCleanup').check();await page.locator('#confirmImportBtn').click();await expect(page.locator('#groupReview')).toContainText('1 / 1 tested');await expect(page.locator('.inset-review-card')).toHaveCount(1);await expect(page.locator('.inset-review-card')).toHaveAttribute('data-source','dot');await page.getByRole('button',{name:'Apply outline',exact:true}).click();await expect(page.locator('.inset-review-card')).toContainText('Applied. Undo');expect(await page.evaluate(()=>window.__gw.S.lib.map(g=>g.name))).toEqual(['eye','dot']);expect(await page.evaluate(()=>window.__gw.S.lib.find(g=>g.name==='dot').variantFamily.status)).toBe('ready');
  await page.getByRole('button',{name:'Back to canvas',exact:true}).click();await page.locator('#undoBtn').click();expect(await page.evaluate(()=>window.__gw.S.lib.find(g=>g.name==='dot').layers[0].paint)).toBe('fill');expect(await page.evaluate(()=>window.__gw.S.lib.find(g=>g.name==='dot').variantFamily.status)).toBe('needs-review');
});
test('failed cleaned import rolls back geometry and untouched-import snapshot atomically',async({page})=>{
  await ready(page);await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;window.restorePut=()=>IDBObjectStore.prototype.put=put;IDBObjectStore.prototype.put=function(value,...args){if(value.name==='Untouched import test-set.json')throw Error('Injected checkpoint failure');return put.call(this,value,...args);};});await request(page,pair);await page.locator('#importCleanup').check();await page.locator('#confirmImportBtn').click();await expect(page.locator('#status')).toContainText('Injected checkpoint failure');expect(await page.evaluate(()=>window.__gw.S.lib.length)).toBe(4);await page.evaluate(()=>window.restorePut());await page.reload();await page.waitForFunction(()=>window.__gw?.ready);expect(await page.evaluate(()=>window.__gw.S.lib.length)).toBe(4);
});
test('Add and clean preserves existing geometry and library properties, and reserves collision names',async({page})=>{
  await ready(page);await page.locator('#libraryColorMode').selectOption('single');
  const before=await page.evaluate(()=>({glyphs:JSON.stringify(window.__gw.S.lib),properties:JSON.stringify(window.__gw.S.libraryProperties)}));
  await request(page,pair);await page.locator('#importReplace').uncheck();await page.locator('#importCleanup').check();await page.locator('#confirmImportBtn').click();await expect.poll(()=>page.evaluate(()=>window.__gw.S.lib.length)).toBe(5);
  expect(await page.evaluate(()=>JSON.stringify(window.__gw.S.lib.slice(0,4)))).toBe(before.glyphs);expect(await page.evaluate(()=>JSON.stringify(window.__gw.S.libraryProperties))).toBe(before.properties);
  await request(page,pair);await page.locator('#importReplace').uncheck();await page.locator('#importCleanup').check();await page.locator('#confirmImportBtn').click();await expect.poll(()=>page.evaluate(()=>window.__gw.S.lib.map(g=>g.name).slice(-2))).toEqual(['eye','eye-2']);
});
test('a collapsed cleanup inset can be redrawn in place and accepted without reintroducing an outline duplicate',async({page})=>{
  await ready(page);await request(page,[circle('dot','fill')]);await page.locator('#importReplace').check();await page.locator('#importCleanup').check();await page.locator('#confirmImportBtn').click();await expect(page.locator('#groupReview')).toContainText('1 / 1 tested');
  await page.getByLabel('dot inset',{exact:true}).fill('10');await page.getByLabel('dot inset',{exact:true}).press('Tab');await page.getByRole('button',{name:'Repair on canvas',exact:true}).click();await expect(page.locator('.repair-toolbar')).toBeVisible();await page.locator('[data-palette="circle"]').click();await page.getByRole('button',{name:'Accept correction'}).click();await expect(page.locator('.repair-toolbar')).toBeHidden();
  expect(await page.evaluate(()=>window.__gw.S.lib.map(g=>g.name))).toEqual(['dot']);expect(await page.evaluate(()=>window.__gw.S.lib[0].variantFamily.status)).toBe('ready');await page.reload();await page.waitForFunction(()=>window.__gw?.ready);expect(await page.evaluate(()=>window.__gw.S.lib.map(g=>g.name))).toEqual(['dot']);
});
test('import choice stays usable when responsive side panes collapse; small dialog scrolls to its action',async({page})=>{
  await ready(page);await request(page,pair);await page.setViewportSize({width:390,height:500});await expect(page.locator('#importDialog')).toBeVisible();await page.locator('#importCleanup').check();await page.locator('#confirmImportBtn').click();await expect.poll(()=>page.evaluate(()=>window.__gw.S.lib.map(g=>g.name))).toEqual(['eye']);await expect(page.locator('#importDialog')).not.toBeVisible();
});
