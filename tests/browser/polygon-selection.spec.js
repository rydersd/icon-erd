import { test, expect } from '@playwright/test';
for (const finish of ['Return', 'double-click', 'Marquee', 'Lasso']) {
  test(`area object selection requires the whole path/group enclosed and ${finish} keeps selection`, async ({ page }) => {
    await page.goto('/'); await page.waitForFunction(() => window.__gw?.ready);
    await page.evaluate(async () => {
      const w = window.__gw, line = (x1, y1, x2, y2) => ({ shape: 'line', x1, y1, x2, y2 });
      await w.importLibraryText(JSON.stringify({ name: 'enclosure', layers: [
        { id: 'inside', paint: 'stroke', node: line(4, 4, 8, 4) },
        { id: 'crossing', paint: 'stroke', node: line(6, 6, 18, 6) },
        { id: 'partly-inside-group', paint: 'stroke', node: { op: 'union', children: [line(4, 8, 8, 8), line(14, 14, 18, 14)] } },
      ] }), 'enclosure.json');
      w.setTool('select');
    });
    await page.locator('#areaSelectToggle').click();await page.getByRole('menuitemradio',{name:'Select objects',exact:true}).click();
    await page.locator('#areaSelectToggle').click(); await page.getByRole('menuitemradio', { name: ['Marquee','Lasso'].includes(finish) ? finish : 'Polygon lasso', exact: true }).click();
    await page.locator('#canvas').scrollIntoViewIfNeeded();
    const screen = async (x, y) => page.evaluate(({ x, y }) => { const c = document.querySelector('#canvas'), p = c.createSVGPoint(); p.x = x; p.y = y; const q = p.matrixTransform(c.getScreenCTM()); return { x: q.x, y: q.y }; }, { x, y });
    if (finish === 'Marquee' || finish === 'Lasso') {
      const start=await screen(2,2);await page.mouse.move(start.x,start.y);await page.mouse.down();
      const points=finish==='Marquee'?[[10,10]]:[[10,2],[10,10],[2,10],[2,2]];
      for(const [x,y] of points){const p=await screen(x,y);await page.mouse.move(p.x,p.y,{steps:4});}
      await page.mouse.up();
    } else {
      for (const [x,y] of [[2,2],[10,2],[10,10]]) {const p=await screen(x,y);await page.mouse.click(p.x,p.y);}
      const p=await screen(2,10);
      if(finish==='double-click')await page.mouse.dblclick(p.x,p.y);
      else {await page.mouse.click(p.x,p.y);await page.keyboard.press('Enter');}
    }
    await expect(page.locator('#anchorMarquee')).toHaveCount(0);
    expect(await page.evaluate(() => window.__gw.S.sel)).toEqual([{ l: 0, p: [] }]);
    await expect(page.locator('#gSel path').first()).toHaveAttribute('stroke', 'var(--sel)');
    await expect(page.locator('#canvas')).toBeVisible();
  });
}

for (const scope of ['objects', 'anchors']) for (const finish of ['Return at preview', 'double-click across targets']) {
  test(`polygon ${scope} completes with ${finish} and selects the visible region`, async ({ page }) => {
    await page.goto('/'); await page.waitForFunction(() => window.__gw?.ready);
    await page.evaluate(async scope => {
      const w = window.__gw;
      await w.importLibraryText(JSON.stringify({name:'completion',layers:[
        {id:'inside-preview',paint:'stroke',node:{shape:'line',x1:3,y1:8,x2:4,y2:8}},
        {id:'boundary-target',paint:'fill',node:{shape:'path',d:'M-1 10L11 10L11 12L-1 12Z'}},
      ]}), 'completion.json'); w.setTool('select');
    }, scope);
    if(scope==='objects'){await page.locator('#areaSelectToggle').click();await page.getByRole('menuitemradio',{name:'Select objects',exact:true}).click();}
    await page.locator('#areaSelectToggle').click();
    await page.getByRole('menuitemradio',{name:'Polygon lasso',exact:true}).click();
    const screen = async (x,y) => page.evaluate(({x,y}) => {
      const c=document.querySelector('#canvas'),p=c.createSVGPoint();p.x=x;p.y=y;
      const q=p.matrixTransform(c.getScreenCTM());return {x:q.x,y:q.y};
    },{x,y});
    for (const [x,y] of [[2,2],[10,2],[10,10]]) {
      const p=await screen(x,y);await page.mouse.click(p.x,p.y);await page.waitForTimeout(450);
    }
    const end=await screen(2,10);
    if (finish==='Return at preview') {
      await page.mouse.move(end.x,end.y);await page.keyboard.press('Enter');
    } else {
      // A real double-click can cross the edge of a rendered SVG path.
      // The two targets differ, so the browser does not emit native dblclick.
      await page.mouse.click(end.x,end.y-1);
      await page.mouse.click(end.x,end.y+1);
    }
    await expect(page.locator('#anchorMarquee')).toHaveCount(0);
    expect(await page.evaluate(()=>window.__gw.S.sel)).toEqual([{l:0,p:[]}]);
    if(scope==='anchors')expect(await page.evaluate(()=>window.__gw.S.selectedAnchors)).toEqual([
      {selection:{l:0,p:[]},index:0},{selection:{l:0,p:[]},index:1},
    ]);
  });
}

test('area target is explicit, remembered and independent of the previous arrow tool', async ({ page }) => {
  await page.goto('/');await page.waitForFunction(()=>window.__gw?.ready);
  await page.locator('[data-tool="select"]').click();await page.locator('#areaSelectBtn').click();
  expect(await page.evaluate(()=>window.__gw.S.areaScope)).toBe('anchors');
  await expect(page.locator('#areaSelectBtn')).toHaveAttribute('aria-description','Select anchors');
  await page.locator('#areaSelectToggle').click();
  await expect(page.getByRole('menuitemradio',{name:'Select anchors',exact:true})).toHaveAttribute('aria-checked','true');
  await page.getByRole('menuitemradio',{name:'Select objects',exact:true}).click();
  await page.locator('[data-tool="direct"]').click();await page.locator('#areaSelectBtn').click();
  expect(await page.evaluate(()=>window.__gw.S.areaScope)).toBe('objects');
  await page.reload();await page.waitForFunction(()=>window.__gw?.ready);
  await page.locator('#areaSelectToggle').click();
  await expect(page.getByRole('menuitemradio',{name:'Select objects',exact:true})).toHaveAttribute('aria-checked','true');
  await page.getByRole('menuitemradio',{name:'Select anchors',exact:true}).click();
  await page.locator('[data-tool="select"]').click();await page.locator('#areaSelectBtn').click();
  expect(await page.evaluate(()=>window.__gw.S.areaScope)).toBe('anchors');
});
