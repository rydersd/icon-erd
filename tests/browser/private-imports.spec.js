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
    await page.locator('#impFile').setInputFiles(file);
    count += pack.count;
    await expect(page.locator('.lib-item')).toHaveCount(count);
    await expect(page.locator('#status')).toContainText(`${pack.count} added`);
    expect(await page.evaluate(prefix => window.__gw.S.lib.filter(g => g.name.startsWith(prefix)).length, `${set}-`)).toBe(pack.count);
    await page.locator('.lib-item').filter({ hasText: pack.glyphs[0].name }).first().click();
    await expect(page.locator('#hdrName')).toHaveText(pack.glyphs[0].name);
  }
  const promise = page.waitForEvent('download'); await page.locator('#expAll').click(); const download = await promise;
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(exported.count).toBe(count);
  await page.reload(); await page.waitForFunction(() => window.__gw?.ready); await expect(page.locator('.lib-item')).toHaveCount(count);
});

test('named EDS pack starts unedited with useful arrow groups, reset originals and full archive export',async({page})=>{
  const file='imports/eds-icons-named.json';test.skip(!(await access(file).then(()=>true,()=>false)),'Named private EDS pack is local only');test.setTimeout(120000);
  await page.goto('/');await page.waitForFunction(()=>window.__gw?.ready);await page.locator('#impFile').setInputFiles(file);
  await expect(page.locator('.lib-item')).toHaveCount(584);await expect(page.locator('#status')).toContainText('580 added');
  await page.locator('.lib-item').filter({hasText:'arrow-right-outline'}).click();
  await expect(page.locator('#tree')).toContainText('Head of Arrow');await expect(page.locator('#tree')).toContainText('Shaft of Arrow');await expect(page.locator('#revertBtn')).toBeDisabled();
  await page.locator('#iconDescription').fill('Edited EDS arrow');await page.locator('#iconDescription').press('Tab');
  await page.locator('#revertBtn').click();await expect(page.locator('#iconDescription')).toHaveValue('');
  const promise=page.waitForEvent('download');await page.locator('#expAll').click();const data=JSON.parse(await readFile(await(await promise).path(),'utf8'));expect(data.count).toBe(584);expect(data.originals).toHaveLength(584);
  await page.reload();await page.waitForFunction(()=>window.__gw?.ready);await expect(page.locator('.lib-item')).toHaveCount(584);await expect(page.locator('#tree')).toContainText('Head of Arrow');
});
