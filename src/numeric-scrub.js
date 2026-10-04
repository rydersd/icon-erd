// Delegate from the stable editor root so dynamically built inspector labels work too.
export function mountNumericScrub(root, listen) {
  let gesture = null, suppressClick = false;
  const control = label => {
    const associated = label.control;
    if (associated?.matches('input[type="number"],input[type="range"]')) return associated;
    return label.querySelector('input[type="number"],input[type="range"]') ||
      label.parentElement?.querySelector(':scope > input[type="number"]');
  };
  const eligible = input => input && !input.disabled && !input.readOnly;
  const formatted = g => {
    const base = g.input.min === '' ? 0 : Number(g.input.min);
    return String(Number((base + Math.round((g.value - base) / g.step) * g.step).toPrecision(12)));
  };
  const mark = label => {
    const input = control(label);
    label.classList.toggle('numeric-scrub-label', !!eligible(input));
    if (eligible(input)) label.title = 'Drag to adjust; Shift adjusts the next larger digit. Click to type.';
  };
  root.querySelectorAll('label').forEach(mark);
  listen(root, 'pointerover', e => { const label = e.target.closest('label'); if (label) mark(label); });
  listen(root, 'pointerdown', e => {
    if (e.button !== 0 || e.target.closest('input,select,textarea,button,a')) return;
    const label = e.target.closest('label'), input = label && control(label);
    if (!eligible(input) || !Number.isFinite(input.valueAsNumber)) return;
    const step = Number(input.step);
    gesture = {input, original: input.value, value: input.valueAsNumber, step: step > 0 ? step : 1,
      start: e.clientX, last: e.clientX, pointer: e.pointerId, moved: false};
    root.setPointerCapture(e.pointerId);
  });
  const finish = cancel => {
    const g = gesture; if (!g) return; gesture = null;
    if (root.hasPointerCapture(g.pointer)) root.releasePointerCapture(g.pointer);
    root.classList.remove('numeric-scrubbing');
    if (!g.moved) { if (!cancel) g.input.focus({preventScroll:true}); return; }
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    g.input.value = cancel ? g.original : formatted(g);
    if (!cancel || g.input.dataset.scrubLive === 'true') g.input.dispatchEvent(new Event('input', {bubbles:true}));
    if (!cancel && g.input.value !== g.original) g.input.dispatchEvent(new Event('change', {bubbles:true}));
  };
  listen(root, 'pointermove', e => {
    const g = gesture; if (!g || e.pointerId !== g.pointer) return;
    if (!g.moved && Math.abs(e.clientX - g.start) < 3) return;
    g.moved = true; root.classList.add('numeric-scrubbing'); e.preventDefault();
    const next = g.value + (e.clientX - g.last) / 4 * g.step * (e.shiftKey ? 10 : 1); g.last = e.clientX;
    if (!Number.isFinite(next)) return;
    g.value = next;
    const min = g.input.min === '' ? -Infinity : Number(g.input.min), max = g.input.max === '' ? Infinity : Number(g.input.max);
    g.value = Math.max(min, Math.min(max, g.value));
    g.input.value = formatted(g);
    if (g.input.dataset.scrubLive === 'true') g.input.dispatchEvent(new Event('input', {bubbles:true}));
  });
  listen(root, 'pointerup', e => { if (gesture?.pointer === e.pointerId) finish(false); });
  listen(root, 'pointercancel', () => finish(true));
  listen(root, 'lostpointercapture', () => finish(true));
  listen(window, 'blur', () => finish(true));
  listen(document, 'keydown', e => {
    if (gesture && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); finish(true); }
    else if (gesture && !['Shift','Alt','Control','Meta'].includes(e.key)) finish(true);
  }, {capture:true});
  listen(root, 'click', e => {
    if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopImmediatePropagation(); }
  }, {capture:true});
}
