export async function openDisclosure(page, selector) {
  const disclosure = page.locator(selector);
  if (!(await disclosure.evaluate(element => element.open))) await disclosure.locator(':scope > summary').click();
  return disclosure;
}

export async function openDisclosures(page, ...selectors) {
  for (const selector of selectors) await openDisclosure(page, selector);
}

export async function openDrawingControls(page) {
  const toggle = page.getByRole('button', { name: 'Drawing controls', exact: true });
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
}
