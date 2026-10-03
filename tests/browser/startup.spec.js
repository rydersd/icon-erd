import {test,expect} from '@playwright/test';
test('startup checks checkpoint IDs without loading checkpoint documents or duplicating saved history',async({page})=>{
  await page.addInitScript(()=>{
    window.snapshotScans=0;
    const getAll=IDBObjectStore.prototype.getAll;
    IDBObjectStore.prototype.getAll=function(...args){if(this.name==='snapshots')window.snapshotScans++;return getAll.apply(this,args);};
  });
  await page.goto('/');await page.waitForFunction(()=>window.__gw?.ready);
  expect(await page.evaluate(()=>window.snapshotScans)).toBe(0);
  await page.locator('#libraryVersionsBtn').click();await expect(page.locator('#libraryVersionsList')).toContainText('Initial library checkpoint');await page.locator('#closeLibraryVersionsBtn').click();
  await page.reload();await page.waitForFunction(()=>window.__gw?.ready);
  expect(await page.evaluate(()=>window.snapshotScans)).toBe(0);
  await page.locator('#libraryVersionsBtn').click();await expect(page.locator('.version-row')).toHaveCount(1);
});
test('scrolling the canvas while browser storage opens does not access an unloaded glyph',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    const open=indexedDB.open.bind(indexedDB);
    indexedDB.open=(...args)=>{
      const request=open(...args);
      Object.defineProperty(request,'onsuccess',{set(handler){request.addEventListener('success',event=>setTimeout(()=>handler.call(request,event),1500),{once:true});}});
      return request;
    };
  });
  await page.goto('/');await page.waitForFunction(()=>window.__gw && !window.__gw.S.glyph);
  await page.locator('#canvas').hover();await page.mouse.wheel(0,100);
  await page.waitForFunction(()=>window.__gw?.ready);expect(errors).toEqual([]);
});
