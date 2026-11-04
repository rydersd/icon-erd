export async function showPlace(page, place, section) {
  const current = await page.locator('main.app').getAttribute('data-place');
  const libraryClosed = place === 'library' && !await page.locator('#libraryPlace').isVisible();
  if (current !== place || libraryClosed) await page.getByRole('group', { name: 'Place', exact: true }).getByRole('button', { name: place === 'library' ? 'Library' : 'Icon', exact: true }).click();
  if (place === 'library' && section) await page.locator(`#libraryPlace nav [data-library-section="${section}"]`).click();
}

async function revealPlaceFor(page, locator) {
  const location = await locator.evaluate(el => ({
    inLibrary: !!el.closest('#libraryPlace'),
    section: el.closest('#libraryPlace [data-library-section]:not(button)')?.dataset.librarySection,
  }));
  await showPlace(page, location.inLibrary ? 'library' : 'icon', location.section);
}

export async function openDisclosure(page, selector) {
  const disclosure = page.locator(selector);
  await revealPlaceFor(page, disclosure.first());
  if (await disclosure.evaluate(el => el.tagName) === 'DETAILS' && await disclosure.getAttribute('open') === null) await disclosure.locator(':scope > summary').click();
  return disclosure;
}

export async function openDisclosures(page, ...selectors) {
  for (const selector of selectors) await openDisclosure(page, selector);
}

export async function openDrawingControls(page) {
  await showPlace(page, 'icon');
  const toggle = page.getByRole('button', { name: 'Drawing controls', exact: true });
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
}

export async function revealControl(page, selector) {
  const control = page.locator(selector).first();
  if (!await control.count()) return null;
  await revealPlaceFor(page, control);
  const disclosures = control.locator('xpath=ancestor::details');
  for (let index = 0; index < await disclosures.count(); index++) {
    const disclosure = disclosures.nth(index);
    if (await disclosure.getAttribute('open') === null) await disclosure.locator(':scope > summary').click();
  }
  const canvasOptions = control.locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " canvas-options ")]').first();
  if (await canvasOptions.count() && (await canvasOptions.getAttribute('data-expanded')) !== 'true') await openDrawingControls(page);
  return control;
}
