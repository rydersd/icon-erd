// One hoverable tooltip for icon controls; accessible names stay on the buttons.
export function mountControlTooltips(root, listen) {
  const tooltip = document.createElement('div');
  tooltip.id = 'workbench-control-tooltip'; tooltip.className = 'control-tooltip';
  tooltip.setAttribute('role', 'tooltip'); tooltip.hidden = true; root.appendChild(tooltip);
  let owner = null, timer = null;
  const buttons = [...root.querySelectorAll('[data-control-tooltip]')];
  const descriptions = new Map(buttons.map(button => [button, button.getAttribute('aria-describedby')]));
  for (const button of buttons) {
    button.removeAttribute('title'); // Avoid a second browser-native tooltip.
    listen(button, 'mouseenter', () => show(button));
    listen(button, 'mouseleave', () => scheduleHide());
    listen(button, 'focus', () => show(button));
    listen(button, 'blur', () => hide());
    listen(button, 'click', () => hide());
  }
  function show(button) {
    hide(); owner = button;
    button.setAttribute('aria-describedby', [descriptions.get(button), tooltip.id].filter(Boolean).join(' ')); tooltip.textContent = button.dataset.controlTooltip; tooltip.hidden = false;
    const rect = button.getBoundingClientRect(), box = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(innerWidth-box.width-8, rect.left+rect.width/2-box.width/2))}px`;
    tooltip.style.top = `${rect.bottom+8+box.height > innerHeight ? rect.top-box.height-8 : rect.bottom+8}px`;
  }
  function hide() {
    clearTimeout(timer); tooltip.hidden = true;
    if(owner) { const original=descriptions.get(owner); if(original)owner.setAttribute('aria-describedby',original);else owner.removeAttribute('aria-describedby'); }
    owner = null;
  }
  function scheduleHide() { clearTimeout(timer); timer = setTimeout(() => { if(owner !== document.activeElement)hide(); },150); }
  listen(tooltip, 'mouseenter', () => clearTimeout(timer));
  listen(tooltip, 'mouseleave', scheduleHide);
  listen(document, 'keydown', event => { if(event.key==='Escape' && !tooltip.hidden){hide();event.stopPropagation();} }, {capture:true});
  listen(window, 'resize', hide);
  // Keyboard focus can scroll the toolbar into view after its focus event.
  // Keep that tooltip attached to the focused control at its new position.
  listen(document, 'scroll', () => { if(owner === document.activeElement)show(owner);else hide(); }, {capture:true});
}
