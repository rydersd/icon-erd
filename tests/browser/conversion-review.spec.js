import {test,expect} from '@playwright/test';import {readFile} from 'node:fs/promises';import {readLibraryZIP} from '../../src/library-zip.js';
const ready=async page=>{await page.goto('/');await page.waitForFunction(()=>window.__gw?.ready);};
const disc={name:'disc',group:'Shapes',weight:1.2,layers:[{id:'disc',paint:'fill',node:{shape:'circle',cx:12,cy:12,r:5}}]};
const outline={name:'disc-outline',group:'Shapes',weight:1.2,layers:[{id:'line',paint:'stroke',node:{shape:'circle',cx:12,cy:12,r:4.4}}]};
async function setup(page,paired=true){await ready(page);await page.evaluate(async ({disc,outline,paired})=>{await window.__gw.importLibraryText(JSON.stringify(paired?[disc,outline]:[disc]),'conversion.json','replace');},{disc,outline,paired});await page.locator('#insetReviewBtn').click();}
test('conversion isolates distortion, updates each inset/stroke, exports its baseline and applies with Undo',async({page})=>{
 await setup(page);await expect(page.locator('#groupReview')).toContainText('0 need review');const filter=page.getByLabel('Problems only',{exact:true});await filter.uncheck();const card=page.locator('.inset-review-card');await expect(card).toHaveCount(1);
 const original=await page.evaluate(()=>JSON.stringify(window.__gw.S.lib.find(g=>g.name==='disc')));
 await page.getByLabel('disc inset',{exact:true}).fill('2');await page.getByLabel('disc inset',{exact:true}).press('Tab');await expect(card).toContainText('Needs review');await filter.check();await expect(card).toBeVisible();
 await page.getByLabel('disc stroke',{exact:true}).fill('1.6');await page.getByLabel('disc stroke',{exact:true}).press('Tab');await expect(card.getByRole('button',{name:'Download outline ZIP'})).toBeEnabled();
 const promise=page.waitForEvent('download');await card.getByRole('button',{name:'Download outline ZIP'}).click();const archive=JSON.parse(readLibraryZIP(await readFile(await(await promise).path())));expect(archive.glyphs[0].strokeOverride).toBe(1.6);expect(archive.originals[0].layers).toEqual(JSON.parse(original).layers);
 await card.getByRole('button',{name:'Apply outline',exact:true}).click();await expect(card).toContainText('Applied. Undo');expect(await page.evaluate(()=>JSON.stringify(window.__gw.S.lib.find(g=>g.name==='disc')))).toBe(original);
 await page.getByRole('button',{name:'Back to canvas',exact:true}).click();await expect(page.locator('#gLayers path').first()).toHaveAttribute('stroke-width','1.6');
 await page.locator('#undoBtn').click();expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.shape)).toBe('circle');await page.locator('#redoBtn').click();expect(await page.evaluate(()=>window.__gw.S.glyph.insetConversion.inset)).toBe(2);
 await page.locator('#setThicknessEnabled').check();await page.locator('#setThickness').fill('2.5');await page.locator('#setThickness').press('Tab');expect(await page.evaluate(()=>window.__gw.S.rt.weight)).toBe(1.6);
 await page.reload();await page.waitForFunction(()=>window.__gw?.ready);expect(await page.evaluate(()=>window.__gw.S.glyph.strokeOverride)).toBe(1.6);
});
test('new outline creation is undoable, survives reload, and does not replace its source',async({page})=>{
 await setup(page,false);await expect(page.locator('#groupReview')).toContainText('1 need review');await page.getByLabel('Problems only',{exact:true}).uncheck();await page.getByRole('button',{name:'Apply outline',exact:true}).click();await expect(page.locator('#groupReview')).toContainText('Applied. Undo');
 await page.getByRole('button',{name:'Back to canvas',exact:true}).click();await expect(page.locator('.lib-item')).toHaveCount(2);await page.reload();await page.waitForFunction(()=>window.__gw?.ready);await page.locator('#undoBtn').click();await expect(page.locator('.lib-item')).toHaveCount(1);
 await page.reload();await page.waitForFunction(()=>window.__gw?.ready);await expect(page.locator('.lib-item')).toHaveCount(1);await page.locator('#redoBtn').click();await expect(page.locator('.lib-item')).toHaveCount(2);expect(await page.evaluate(()=>window.__gw.S.lib.find(g=>g.name==='disc').layers[0].paint)).toBe('fill');
});
test('Pen endpoint closing highlight uses the same hit distance as closing, and clears on leaving',async({page})=>{
 await ready(page);await page.locator('#newBtn').click();await page.locator('[data-tool="pen"]').click();const point=async(x,y)=>page.evaluate(({x,y})=>{const c=document.querySelector('#canvas'),p=c.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(c.getScreenCTM());return{x:q.x,y:q.y};},{x,y});
 for(const [x,y]of [[4,4],[12,4],[12,12]]){const p=await point(x,y);await page.mouse.click(p.x,p.y);}const start=await point(4,4);await page.mouse.move(start.x+5,start.y);await expect(page.locator('[data-close-preview]')).toHaveCount(1);await page.mouse.move(start.x+20,start.y);await expect(page.locator('[data-close-preview]')).toHaveCount(0);await page.mouse.move(start.x,start.y);await expect(page.locator('[data-close-preview]')).toHaveCount(1);await page.mouse.click(start.x,start.y);expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.children[0].closed)).toBe(true);await expect(page.locator('[data-close-preview]')).toHaveCount(0);
});
test('gradients appear only in App icon mode, switching opens their panel, including compact UI',async({page})=>{
 await ready(page);await expect(page.locator('#appIconStudio')).toBeHidden();await page.setViewportSize({width:700,height:900});await page.locator('#drawingMode').selectOption('app-icon');await expect(page.getByLabel('App icon fill type',{exact:true})).toBeVisible();await page.getByLabel('App icon fill type',{exact:true}).selectOption('linear');await expect(page.locator('#gLayers linearGradient')).toHaveCount(1);
 await page.locator('#drawingMode').selectOption('interface');await expect(page.locator('#appIconStudio')).toBeHidden();
});

test('a corrected candidate stays visible in Problems only until it is applied',async({page})=>{
 await setup(page);await expect(page.locator('#groupReview')).toContainText('0 need review');await page.getByLabel('Problems only',{exact:true}).uncheck();const inset=page.getByLabel('disc inset',{exact:true}),card=page.locator('.inset-review-card');await inset.fill('2');await inset.press('Tab');await expect(card).toContainText('Needs review');await page.getByLabel('Problems only',{exact:true}).check();await inset.fill('.6');await inset.press('Tab');await expect(page.locator('#groupReview')).toContainText('0 need review');await expect(card).toBeVisible();await expect(card.getByRole('button',{name:'Apply outline',exact:true})).toBeEnabled();
});

test('stale source metadata cannot be overwritten by applying an old conversion',async({page})=>{
 await setup(page);await expect(page.locator('#groupReview')).toContainText('0 need review');await page.getByLabel('Problems only',{exact:true}).uncheck();const before=await page.evaluate(()=>JSON.stringify(window.__gw.S.lib.find(g=>g.name==='disc-outline')));await page.evaluate(()=>{const w=window.__gw;w.S.glyph.description='New source metadata';w.commit();});await page.getByRole('button',{name:'Apply outline',exact:true}).click();await expect(page.locator('.inset-review-card')).toContainText('Source or target changed');expect(await page.evaluate(()=>JSON.stringify(window.__gw.S.lib.find(g=>g.name==='disc-outline')))).toBe(before);
});
