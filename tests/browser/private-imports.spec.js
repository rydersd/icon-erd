import { readLibraryZIP } from '../../src/library-zip.js';
import { test, expect } from '@playwright/test';
import { readFile, access } from 'node:fs/promises';
const available = await access('imports/illmater-icons.json').then(() => true, () => false);
test('real project sets import in order and export every icon without data loss', async ({ page }) => {
  test.skip(!available, 'Local project import packs are intentionally excluded from public source');
  test.setTimeout(120000);
  await page.goto('/'); await page.waitForFunction(() => window.__gw?.ready);
  let count = 4;
  for (const set of ['illtool', 'illmater', 'spurious-ecosystem']) {
    const file = `imports/${set}-icons.json`, pack = JSON.parse(await readFile(file, 'utf8'));
    await page.locator('#impFile').setInputFiles(file);await page.locator('#confirmImportBtn').click();
    count += pack.count;
    await expect(page.locator('.lib-item')).toHaveCount(count);
    await expect(page.locator('#status')).toContainText(`${pack.count} added`);
    expect(await page.evaluate(prefix => window.__gw.S.lib.filter(g => g.name.startsWith(prefix)).length, `${set}-`)).toBe(pack.count);
    await page.locator('.lib-item').filter({ hasText: pack.glyphs[0].name }).first().click();
    await expect(page.locator('#hdrName')).toHaveText(pack.glyphs[0].name);
  }
  await page.locator('.export-options').evaluate(el=>el.open=true);const promise = page.waitForEvent('download'); await page.locator('#expAll').click(); const download = await promise;
  const exported = JSON.parse(readLibraryZIP(await readFile(await download.path())));
  expect(exported.count).toBe(count);
  await page.reload(); await page.waitForFunction(() => window.__gw?.ready); await expect(page.locator('.lib-item')).toHaveCount(count);
});

test('named EDS pack starts unedited with useful arrow groups, reset originals and full archive export',async({page})=>{
  const file='imports/eds-icons-named.json';test.skip(!(await access(file).then(()=>true,()=>false)),'Named private EDS pack is local only');test.setTimeout(120000);
  await page.goto('/');await page.waitForFunction(()=>window.__gw?.ready);await page.locator('#impFile').setInputFiles(file);await page.locator('#confirmImportBtn').click();
  await expect(page.locator('.lib-item')).toHaveCount(584);await expect(page.locator('#status')).toContainText('580 added');
  await page.locator('.lib-item').filter({hasText:'arrow-right-outline'}).click();
  await expect(page.locator('#tree')).toContainText('Head of Arrow');await expect(page.locator('#tree')).toContainText('Shaft of Arrow');await expect(page.locator('#revertBtn')).toBeDisabled();
  await page.locator('#iconDescription').fill('Edited EDS arrow');await page.locator('#iconDescription').press('Tab');
  await page.locator('#revertBtn').click();await expect(page.locator('#iconDescription')).toHaveValue('');
  await page.locator('.export-options').evaluate(el=>el.open=true);const promise=page.waitForEvent('download');await page.locator('#expAll').click();const data=JSON.parse(readLibraryZIP(await readFile(await(await promise).path())));expect(data.count).toBe(584);expect(data.originals).toHaveLength(584);
  await page.reload();await page.waitForFunction(()=>window.__gw?.ready);await expect(page.locator('.lib-item')).toHaveCount(584);await expect(page.locator('#tree')).toContainText('Head of Arrow');
});

test('EDS cloud silhouette is detected in app logic, reviewed as a near match, and edited across ten icons',async({page})=>{
  const file='imports/eds-icons-named.json';test.skip(!await access(file).then(()=>true,()=>false),'Private EDS pack is not published');test.setTimeout(120000);
  await page.goto('/');await page.waitForFunction(()=>window.__gw?.ready);
  await page.locator('#impFile').setInputFiles(file);await page.locator('#confirmImportBtn').click();
  await page.locator('#findSharedFormsBtn').click();await page.locator('#sharedFormsSearch').fill('application-cloud');
  const card=page.locator('.shared-form-card').filter({hasText:'10 instances'});await expect(card).toHaveCount(1);
  await card.getByRole('textbox',{name:'Shared form name'}).fill('Cloud silhouette');
  await page.screenshot({path:'artifacts/shared-cloud-review.png'});
  await card.getByRole('button',{name:'Adopt shared shape and link',exact:true}).click();
  const linked=await page.evaluate(()=>window.__gw.S.lib.flatMap(g=>g.layers.flatMap((l,li)=>{const result=[];const walk=(n,p)=>{if(n.component?.name==='Cloud silhouette')result.push({name:g.name,l:li,p});(n.children||[]).forEach((c,i)=>walk(c,[...p,i]));};walk(l.node,[]);return result;})));
  expect(linked).toHaveLength(10);
  await page.evaluate(instance=>{const w=window.__gw;w.loadGlyph(w.idx(instance.name));w.S.sel=[{l:instance.l,p:instance.p}];w.setTool('direct');w.refresh(true);},linked[0]);
  const before=await page.evaluate(()=>{const w=window.__gw,n=w.getNode(w.S.sel[0]);return {id:n.component.id,point:n.pts[0].x};});
  // Perform an actual inspector edit to exercise the event/commit path, not just a utility call.
  // The anchor list supports selection; point inspector controls use indexed keys.
  await page.evaluate(()=>{const w=window.__gw;w.S.anchor=0;w.S.selectedAnchors=[{selection:w.S.sel[0],index:0}];w.refresh(true);});
  const field=page.locator('#insp input[data-key="ax"]');
  await field.fill(String(before.point+0.2));await field.press('Tab');
  const peers=await page.evaluate(id=>{const out=[];for(const g of window.__gw.S.lib){const walk=n=>{if(n.component?.id===id)out.push(n.pts[0].x-n.component.origin[0]);(n.children||[]).forEach(walk);};g.layers.forEach(l=>walk(l.node));}return out;},before.id);
  expect(peers).toHaveLength(10);expect(Math.max(...peers)-Math.min(...peers)).toBeLessThan(0.0001);
  await page.screenshot({path:'artifacts/shared-cloud-linked.png'});
  await page.locator('#undoBtn').click();expect(await page.evaluate(()=>window.__gw.getNode(window.__gw.S.sel[0]).pts[0].x)).toBe(before.point);
});
