import {test,expect} from '@playwright/test';
import {readFile,access} from 'node:fs/promises';
const screen=async(page,x,y)=>page.evaluate(({x,y})=>{const c=document.querySelector('#canvas'),p=c.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(c.getScreenCTM());return {x:q.x,y:q.y};},{x,y});
const setup=async(page,node)=>{
  await page.goto('/');await page.waitForFunction(()=>window.__gw?.ready);
  await page.evaluate(async node=>{const w=window.__gw;await w.importLibraryText(JSON.stringify({name:'source-selection',layers:[{id:'outline',paint:'fill',node}]}),'source.json');w.S.sel=[];w.setTool('direct');w.refresh(true);},node);
  await page.locator('#canvas').scrollIntoViewIfNeeded();
};
for(const mode of ['Marquee','Lasso','Polygon lasso'])test(`${mode} selects imported compound anchors and preserves counters and transforms`,async({page})=>{
  await setup(page,{name:'Imported outline',shape:'path',d:'M4 4L16 4L16 16L4 16ZM8 8L8 12L12 12L12 8Z',transform:{origin:[0,0],scaleX:1.25,scaleY:1}});
  expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.shape)).toBe('path');
  await page.locator('#areaSelectToggle').click();await page.getByRole('menuitemradio',{name:mode,exact:true}).click();
  const vertices=[[3,2],[7,2],[7,6],[3,6]];
  if(mode==='Polygon lasso'){
    for(const [x,y] of vertices){const p=await screen(page,x,y);await page.mouse.click(p.x,p.y);}await page.keyboard.press('Enter');
  }else{
    const p=await screen(page,...vertices[0]);await page.mouse.move(p.x,p.y);await page.mouse.down();
    for(const [x,y] of mode==='Marquee'?[[7,6]]:[...vertices.slice(1),vertices[0]]){const q=await screen(page,x,y);await page.mouse.move(q.x,q.y,{steps:4});}await page.mouse.up();
  }
  expect(await page.evaluate(()=>window.__gw.S.selectedAnchors)).toEqual([{selection:{l:0,p:[0]},index:0}]);
  const node=await page.evaluate(()=>window.__gw.S.glyph.layers[0].node);expect(node.op).toBe('compound');expect(node.children).toHaveLength(2);expect(node.transform).toEqual({origin:[0,0],scaleX:1.25,scaleY:1});
  await page.locator('#undoBtn').click();expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.shape)).toBe('path');
});
test('source row selects an imported anchor that can immediately move and undo',async({page})=>{
  await setup(page,{name:'Imported triangle',shape:'path',d:'M4 4L16 4L10 16Z'});
  await page.locator('#pointRows [data-source-point="0::1"]').click();
  expect(await page.evaluate(()=>window.__gw.S.selectedAnchors)).toEqual([{selection:{l:0,p:[]},index:1}]);
  await expect(page.locator('#gSel [data-anchor="1"]')).toHaveAttribute('data-selected','true');
  await page.locator('#canvas').press('ArrowRight');expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts[1].x)).toBeGreaterThan(16);
  await page.locator('#undoBtn').click();expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts[1].x)).toBe(16);
});
test('a source row in an imported counter becomes an editable child and keeps its point list',async({page})=>{
  await setup(page,{name:'Outline with counter',shape:'path',d:'M4 4L16 4L16 16L4 16ZM8 8L8 12L12 12L12 8Z'});
  await page.locator('#pointRows [data-source-point="0:1:1"]').click();
  expect(await page.evaluate(()=>window.__gw.S.selectedAnchors)).toEqual([{selection:{l:0,p:[1]},index:1}]);
  await expect(page.locator('#pointRows tr')).toHaveCount(4);
  await expect(page.locator('#pointRows [data-source-point="0:1:1"]')).toHaveAttribute('aria-selected','true');
  await page.locator('#canvas').press('ArrowRight');expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.children[1].pts[1].x)).toBeGreaterThan(8);
});
test('multiple selected anchors hide other point rows and clearing selection restores them without changing rounding tags',async({page})=>{
  await setup(page,{shape:'pen',closed:true,pts:[{x:4,y:4},{x:16,y:4},{x:16,y:16},{x:4,y:16}]});
  await page.locator('#pointRows [data-source-point="0::0"]').click();await page.locator('#pointRows [data-source-point="0::1"]').click({modifiers:['Shift']});
  await expect(page.locator('#pointRows tr')).toHaveCount(2);await expect(page.locator('#pointRows tr[aria-selected="true"]')).toHaveCount(2);
  await page.locator('#pointRows [data-source-point="0::0"]').getByRole('checkbox').uncheck();
  expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.roundingAnchors)).toEqual([1,2,3]);
  await page.locator('#canvas').press('Escape');await expect(page.locator('#pointRows tr')).toHaveCount(4);
});
test('rounded source anchors remain selectable outside the evaluated outline, with shift add and option-click',async({page})=>{
  await setup(page,{shape:'pen',closed:true,pts:[{x:4,y:4,r:3},{x:16,y:4},{x:16,y:16},{x:4,y:16}]});
  await expect(page.locator('#pointRows tr')).toHaveCount(4);
  const p=await screen(page,4,4);await page.mouse.click(p.x,p.y);
  expect(await page.evaluate(()=>window.__gw.S.selectedAnchors.map(a=>a.index))).toEqual([0]);
  const q=await screen(page,16,4);await page.keyboard.down('Shift');await page.mouse.click(q.x,q.y);await page.keyboard.up('Shift');
  expect(await page.evaluate(()=>window.__gw.S.selectedAnchors.map(a=>a.index))).toEqual([0,1]);
  await page.keyboard.down('Alt');await page.mouse.click(p.x,p.y);await page.keyboard.up('Alt');
  expect(await page.evaluate(()=>window.__gw.S.selectedAnchors.map(a=>a.index))).toEqual([0]);
  expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts[0].r)).toBe(3);
});
test('Cleanup reconstructs the private comment corner while preserving both sharp intersections',async({page})=>{
  const file='imports/eds-icons-named.json';test.skip(!await access(file).then(()=>true,()=>false),'Private EDS artwork is not published');
  const pack=JSON.parse(await readFile(file,'utf8')),outline=pack.glyphs.find(g=>g.name==='comment-exclamation').layers[0].node.children[0];
  await setup(page,outline);
  const a=await screen(page,14.3,22.4),b=await screen(page,7.8,17.7);
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y);await page.mouse.up();
  expect(await page.evaluate(()=>window.__gw.S.selectedAnchors.map(a=>a.index))).toEqual([6,7,8,9,10]);
  await page.locator('#canvas').press('Shift+F10');await page.getByRole('menuitem',{name:'Cleanup',exact:true}).click();
  const points=await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts);
  expect(points).toHaveLength(11);expect(points[6]).toEqual(outline.pts[6]);expect(points[8]).toEqual(outline.pts[10]);expect(points[7].r).toBeCloseTo(0.6,2);
  await expect(page.locator('#gSel [data-anchor="7"]')).toHaveAttribute('data-point-kind','circle');
  await expect(page.locator('#gSel [data-anchor="6"]')).toHaveAttribute('data-point-kind','square');
  await page.locator('#undoBtn').click();expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts)).toEqual(outline.pts);
});
test('the comment outline previews a nearby broken-handle merge before release',async({page})=>{
  const file='imports/eds-icons-named.json';
  test.skip(!await access(file).then(()=>true,()=>false),'Private EDS artwork is not published');
  const pack=JSON.parse(await readFile(file,'utf8'));
  const outline=pack.glyphs.find(g=>g.name==='comment-exclamation').layers[0].node.children[0];
  await setup(page,outline);
  await page.locator('[data-snap="0"]').click();await page.locator('#proximityMergeBtn').click();
  const from=await screen(page,8.73,21.54),to=await screen(page,8.45,21.03);
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y);
  await expect(page.locator('#gMergePreview [data-merge-target]')).toHaveCount(2);
  await expect(page.locator('#gMergePreview [data-merge-result]')).toHaveCount(1);
  expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts.length)).toBe(13);
  await page.mouse.up();const pts=await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts);
  expect(pts).toHaveLength(12);expect(pts[8].in).toEqual([0.21,0.1]);expect(pts[8].out).toBeUndefined();
  await page.locator('#undoBtn').click();expect(await page.evaluate(()=>window.__gw.S.glyph.layers[0].node.pts.length)).toBe(13);
});
