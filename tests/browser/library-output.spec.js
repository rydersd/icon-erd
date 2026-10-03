import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {unzipSync,strFromU8} from 'fflate';
const ready=async page=>{await page.goto('/');await page.waitForFunction(()=>window.__gw?.ready);};
const circle=(name,r,paint='stroke')=>({name,group:'Eyes',weight:2,layers:[{id:'eye',name:'Eye',paint,node:{shape:'circle',cx:12,cy:12,r}}]});
const importPair=async page=>{await page.locator('#ioText').fill(JSON.stringify([circle('eye-outline',4),circle('eye',5,'fill'),circle('broken-outline',2),circle('broken',7,'fill')]));await page.locator('#importBtn').click();await page.locator('#confirmImportBtn').click();};
const properties=async page=>page.locator('.set-settings').evaluate(el=>el.open=true);
test('solid test, grouped problem isolation, family view and approval retain sources',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);await importPair(page);await properties(page);
 await page.locator('#testSolidVariantsBtn').click();await expect(page.locator('#solidTestProgress')).toContainText('1 matched; 1 need review');
 await page.getByRole('button',{name:'Problems in Eyes',exact:true}).click();await expect(page.locator('.lib-group[data-group="Eyes"] .lib-item:visible')).toHaveCount(1);
 await expect(page.locator('.lib-group[data-group="Eyes"] .lib-item:visible')).toHaveAttribute('data-name','broken-outline');
 await page.getByRole('button',{name:'Problems in Eyes',exact:true}).click();await page.locator('#libraryFamilyView').check();await expect(page.locator('.lib-group[data-group="Eyes"] .lib-item:visible')).toHaveCount(2);
 await page.getByRole('button',{name:'Review Eyes',exact:true}).click();await page.locator('.group-review-card').filter({has:page.getByRole('heading',{name:'broken-outline',exact:true})}).getByRole('button',{name:'Approve solid',exact:true}).click();
 await page.getByRole('button',{name:'Back to drawing',exact:true}).click();await page.getByRole('button',{name:'Problems in Eyes',exact:true}).click();await expect(page.locator('.lib-group[data-group="Eyes"]')).toBeVisible();await expect(page.locator('.lib-group[data-group="Eyes"] .lib-item:visible')).toHaveCount(0);
 await page.getByRole('button',{name:'Problems in Eyes',exact:true}).click();await expect(page.locator('.lib-group[data-group="Eyes"] .lib-item:visible')).toHaveCount(2);
 expect(await page.evaluate(()=>window.__gw.S.lib.filter(g=>g.group==='Eyes').length)).toBe(4);expect(errors).toEqual([]);
});
test('output properties persist and undo, export real menu bar PNGs with template assets',async({page})=>{
 await ready(page);await properties(page);await page.locator('#libraryColorMode').selectOption('multicolor');await page.locator('#libraryOutputProfile').selectOption('menu-bar');await expect(page.locator('#libraryOutputSizes')).toHaveValue('18, 36');
 await page.locator('#undoBtn').click();await expect(page.locator('#libraryOutputProfile')).toHaveValue('interface');await page.locator('#redoBtn').click();await expect(page.locator('#libraryOutputProfile')).toHaveValue('menu-bar');
 await page.reload();await page.waitForFunction(()=>window.__gw?.ready);await properties(page);await expect(page.locator('#libraryOutputProfile')).toHaveValue('menu-bar');
 await page.locator('.export-options').evaluate(el=>el.open=true);await page.locator('#exportPNGs').check();const pending=page.waitForEvent('download');await page.locator('#expOne').click();const download=await pending,files=unzipSync(await readFile(await download.path()));
 const assetName=Object.keys(files).find(name=>name.endsWith('.imageset/Contents.json')),asset=JSON.parse(strFromU8(files[assetName]));expect(asset.properties['template-rendering-intent']).toBe('template');
 const pngs=Object.keys(files).filter(name=>name.startsWith('png/')&&name.endsWith('.png'));expect(pngs).toHaveLength(2);for(const name of pngs){const buffer=Buffer.from(files[name]);expect(buffer.readUInt32BE(16)).toBe(name.endsWith('-18.png')?18:36);expect(buffer.readUInt32BE(20)).toBe(buffer.readUInt32BE(16));}
});
test('generated EDS variants use canonical names in ZIPs, then Mac app exports real 1024px raster assets',async({page})=>{
 await ready(page);await importPair(page);await page.locator('#testSolidVariantsBtn').click();await expect(page.locator('#solidTestProgress')).toContainText('1 matched');await page.locator('.lib-item[data-name="eye-outline"]').click();await page.locator('#libraryVariant').selectOption('both');
 await page.locator('.export-options').evaluate(el=>el.open=true);let pending=page.waitForEvent('download');await page.locator('#expOne').click();let files=unzipSync(await readFile(await (await pending).path()));expect(Object.keys(files).filter(name=>name.endsWith('.svg')).sort()).toEqual(['svg/Eyes/eye-outline.svg','svg/Eyes/eye.svg']);expect(JSON.parse(strFromU8(files['library.json'])).glyphs).toHaveLength(1);
 await page.locator('#libraryVariant').selectOption('source');await page.locator('#tplSel').selectOption('app');await page.locator('#newBtn').click();await page.locator('#libraryOutputProfile').selectOption('mac-app');await expect(page.locator('#exportSize')).toHaveValue('1024');await page.locator('#exportPNGs').check();pending=page.waitForEvent('download');await page.locator('#expOne').click();files=unzipSync(await readFile(await (await pending).path()));
 const largest=Object.keys(files).find(name=>name.startsWith('png/')&&name.endsWith('-1024.png'));expect(Buffer.from(files[largest]).readUInt32BE(16)).toBe(1024);const catalog=Object.keys(files).find(name=>name.endsWith('.appiconset/Contents.json'));expect(JSON.parse(strFromU8(files[catalog])).images).toHaveLength(10);
 await page.screenshot({path:'artifacts/library-output-properties.png',fullPage:true});
});
test('solid comparison report attaches atomically, Undo removes it, and changing thickness invalidates it',async({page})=>{
 await ready(page);await importPair(page);await page.locator('.lib-item[data-name="eye-outline"]').click();await page.locator('#testSolidVariantsBtn').click();await expect(page.locator('#solidTestProgress')).toContainText('1 matched');
 const report=await page.evaluate(()=>({format:'iconerd-solid-review',version:1,entries:window.__gw.S.lib.filter(g=>g.solidReview).map(g=>({name:g.name,...g.solidReview}))}));
 await page.locator('#undoBtn').click();expect(await page.evaluate(()=>window.__gw.S.lib.some(g=>g.solidReview))).toBe(false);
 await page.locator('#ioText').fill(JSON.stringify(report));await page.locator('#importBtn').click();await page.locator('#confirmImportBtn').click();await expect(page.locator('#status')).toContainText('Attached 1 solid results');
 await page.locator('#setThicknessEnabled').check();await expect(page.locator('.lib-item[data-name="eye-outline"]')).toHaveClass(/needs-reconstruction-review/);await page.locator('#libraryVariant').selectOption('solid');await page.locator('#downloadSvg').click();await expect(page.locator('#status')).toContainText('Review the generated solid');
});
