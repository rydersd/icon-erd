import {test,expect} from '@playwright/test';
test('icon tools and Boolean actions have names, hover/focus tooltips, Escape dismissal and separated frames',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>window.__gw?.ready);
 const tool=page.getByRole('group',{name:'Tool',exact:true});
 for(const name of ['Select','Direct selection','Pen']) {
  const button=tool.getByRole('button',{name,exact:true});await expect(button).toHaveText('');await expect(button.locator('svg')).toHaveCount(1);
 }
 const booleans=page.getByRole('group',{name:'Boolean on selection',exact:true});
 const paths=[];
 for(const name of ['Union','Subtract','Intersect','Exclude']) {
  const button=booleans.getByRole('button',{name,exact:true});await expect(button).toHaveText('');
  paths.push(await button.locator('svg').innerHTML());
 }
 expect(new Set(paths).size).toBe(4);
 expect(paths[1]).not.toBe(await page.locator('#makeCutterBtn svg').innerHTML());
 const subtract=booleans.getByRole('button',{name:'Subtract',exact:true});
 await subtract.hover();await expect(page.getByRole('tooltip')).toHaveText('Subtract: first shape minus the rest');
 await page.getByRole('tooltip').hover();await expect(page.getByRole('tooltip')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.getByRole('tooltip')).toBeHidden();
 // Tab, rather than a programmatic focus call, exercises the actual keyboard path.
 await tool.getByRole('button',{name:'Select',exact:true}).focus();await page.keyboard.press('Tab');
 await expect(tool.getByRole('button',{name:'Direct selection',exact:true})).toBeFocused();await expect(page.getByRole('tooltip')).toHaveText('Direct selection (A)');
 await page.keyboard.press('Enter');await expect(tool.getByRole('button',{name:'Direct selection',exact:true})).toHaveAttribute('aria-pressed','true');
 const frame=await tool.evaluate(el=>{const s=getComputedStyle(el);const buttons=[...el.children];return {gap:s.gap,border:s.borderTopWidth,shadow:s.boxShadow,separation:buttons[1].getBoundingClientRect().left-buttons[0].getBoundingClientRect().right};});
 expect(frame.gap).toBe('2px');expect(frame.border).toBe('1px');expect(frame.shadow).not.toBe('none');expect(frame.separation).toBe(2);
 await expect(tool.getByRole('button',{name:'Direct selection',exact:true})).not.toHaveAttribute('title');
 await page.locator('.shortcut-settings summary').click();await page.getByRole('textbox',{name:'Direct selection shortcut',exact:true}).press('x');
 await tool.getByRole('button',{name:'Select',exact:true}).focus();await page.keyboard.press('Tab');await expect(page.getByRole('tooltip')).toHaveText('Direct selection (X)');
 await expect(tool.getByRole('button',{name:'Direct selection',exact:true})).toHaveAttribute('aria-keyshortcuts','X');
 await page.screenshot({path:'artifacts/controls-light.png'});
 await page.getByRole('button',{name:'Dark theme',exact:true}).click();await page.screenshot({path:'artifacts/controls-dark.png'});
});
