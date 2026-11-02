export async function openDisclosure(page, selector) {
  const disclosure = page.locator(selector);
  if (await disclosure.getAttribute('open') === null) await disclosure.locator(':scope > summary').click();
  return disclosure;
}

export async function openDisclosures(page, ...selectors) {
  for (const selector of selectors) await openDisclosure(page, selector);
}

export async function openDrawingControls(page) {
  const toggle = page.getByRole('button', { name: 'Drawing controls', exact: true });
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
}

export async function revealControl(page, selector) {
  const control = page.locator(selector).first();
  if (!await control.count()) return null;
  const disclosures = control.locator('xpath=ancestor::details');
  for (let index = 0; index < await disclosures.count(); index++) {
    const disclosure = disclosures.nth(index);
    if (await disclosure.getAttribute('open') === null) await disclosure.locator(':scope > summary').click();
  }
  const canvasOptions = control.locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " canvas-options ")]').first();
  if (await canvasOptions.count() && (await canvasOptions.getAttribute('data-expanded')) !== 'true') await openDrawingControls(page);
  return control;
}
