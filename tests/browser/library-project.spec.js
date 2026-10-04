import {test,expect} from '@playwright/test';
import {libraryZIP} from '../../src/library-zip.js';
const icon=name=>({name,weight:1.2,layers:[{id:'form',paint:'fill',node:{shape:'circle',cx:12,cy:12,r:4}}]});
const ready=async page=>{await page.goto('/');await page.waitForFunction(()=>window.__gw?.ready);};
async function importSet(page,names){const glyphs=names.map(icon);const bytes=await libraryZIP({format:'glyph-workbench-library',version:1,scope:'all',glyphs},()=>'<svg/>');await page.locator('#impFile').setInputFiles({name:'project.zip',mimeType:'application/zip',buffer:Buffer.from(bytes)});await expect(page.locator('#importReplace')).toBeChecked();await page.locator('#confirmImportBtn').click();await expect.poll(()=>page.evaluate(()=>window.__gw.S.lib.map(g=>g.name))).toEqual(names);}
test('New library empties persisted artwork, tokens, components, history and trash; checkpoint restores the old set',async({page})=>{
 await ready(page);await page.locator('#setThicknessEnabled').check();await page.locator('#setThickness').fill('2');await page.locator('#setThickness').press('Tab');
 await page.locator('#newLibraryBtn').click();await expect(page.locator('.lib-item')).toHaveCount(0);await expect(page.locator('#undoBtn')).toBeDisabled();
 expect(await page.evaluate(()=>({properties:window.__gw.S.libraryProperties,components:window.__gw.S.components.size}))).toEqual({properties:null,components:0});
 await page.reload();await page.waitForFunction(()=>window.__gw?.ready);await expect(page.locator('.lib-item')).toHaveCount(0);
 await page.locator('#libraryVersionsBtn').click();await page.locator('.version-row').filter({hasText:'Before starting a new library'}).getByRole('button',{name:'Restore',exact:true}).click();await expect(page.locator('.lib-item')).toHaveCount(4);await expect(page.locator('#setThickness')).toHaveValue('2');
 await page.locator('#closeLibraryVersionsBtn').click();await page.locator('#newLibraryBtn').click();await page.locator('#newBtn').click();await expect(page.locator('.lib-item')).toHaveCount(1);
 await page.reload();await page.waitForFunction(()=>window.__gw?.ready);await expect(page.locator('.lib-item')).toHaveCount(1);
});
test('whole-project ZIP replacements remove unrelated icons, retain originals and do not inherit old library tokens',async({page})=>{
 await ready(page);await page.locator('#setThicknessEnabled').check();await page.locator('#setThickness').fill('2');await page.locator('#setThickness').press('Tab');
 await importSet(page,['eds-one','eds-two']);await importSet(page,['illmater-one','illmater-two']);await importSet(page,['illtool-one']);
 expect(await page.evaluate(()=>window.__gw.S.libraryProperties)).toBeNull();
 await page.reload();await page.waitForFunction(()=>window.__gw?.ready);expect(await page.evaluate(()=>window.__gw.S.lib.map(g=>g.name))).toEqual(['illtool-one']);
 await page.locator('#iconDescription').fill('changed');await page.locator('#iconDescription').press('Tab');await expect(page.locator('#revertBtn')).toHaveText('Revert icon');await page.locator('#revertBtn').click();await expect(page.locator('#iconDescription')).toHaveValue('');
 await page.locator('#libraryVersionsBtn').click();const rows=page.locator('.version-row').filter({hasText:'Before replacing library with project.zip'});await rows.nth(1).getByRole('button',{name:'Restore',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__gw.S.lib.map(g=>g.name))).toEqual(['eds-one','eds-two']);
});
test('Import and Export align; paint uses a single borderless color rectangle per field',async({page})=>{
 await ready(page);const a=await page.locator('#impFileBtn').boundingBox(),b=await page.locator('.export-options > summary').boundingBox();expect(a.y).toBe(b.y);expect(a.x+a.width).toBeLessThan(b.x);
 await expect(page.locator('.paint-preview')).toHaveCount(0);await expect(page.locator('#libraryFillColor')).toHaveCSS('border-top-width','0px');await expect(page.locator('#libraryFillColor')).toHaveCSS('width','48px');
 await page.locator('.export-options > summary').click();await expect(page.locator('#expAll')).toBeVisible();await expect(page.locator('#impFileBtn')).toBeVisible();
});
