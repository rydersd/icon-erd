// Editor appearance stays separate from icon artwork and exported libraries.
export const APPEARANCE_SECTIONS = [
  ['Surfaces', [['bg','Page'],['panel','Panels'],['panel-2','Inset panels'],['canvas-bg','Artboard'],['canvas-out','Outside artboard'],['border','Borders'],['border-strong','Strong borders']]],
  ['Text & accents', [['text','Primary text'],['text-2','Secondary text'],['text-3','Muted text'],['accent','Accent'],['accent-weak','Accent background'],['accent-text','Accent text']]],
  ['Grid', [['grid-minor','Minor grid'],['grid-lattice','Snap lattice'],['grid-major','Major grid'],['grid-unit2','Two-unit grid']]],
  ['Guides & overlays', [['guide','Guides'],['keyline','Keylines'],['safe','Safe area'],['live','Live geometry'],['form','Source forms'],['orig','Original overlay']]],
  ['Selection & cutters', [['sel','Selection'],['cutter','Cutter outline'],['cutter-fill','Cutter fill']]],
  ['Rulers', [['ruler-bg','Ruler background'],['ruler-tick','Ruler ticks'],['ruler-text','Ruler labels']]],
  ['Status', [['warn','Warning text'],['warn-bg','Warning background'],['danger','Error / delete']]],
];
export const APPEARANCE_NUMBERS = [
  ['Grid','grid-line-scale','Line weight',0.25,3,0.25],
  ['Rulers','ruler-tick-width','Tick weight',0.5,3,0.5],
  ['Rulers','ruler-font-size','Label size',7,16,1],
  ['Surfaces','radius','Control corners',0,16,1],
];
export function mountAppearance({ root, listen, openPopup, closePopup, getPopup, renderGrid, renderRulers }) {
  const $ = id => root.querySelector(`#${id}`), html = document.documentElement;
  const media = matchMedia('(prefers-color-scheme: dark)');
  const theme = () => html.dataset.theme || (media.matches ? 'dark' : 'light');
  let saved = { light: {}, dark: {} };
  try { const value = JSON.parse(localStorage.getItem('gw-appearance')); if (value && typeof value === 'object') saved = { light: value.light || {}, dark: value.dark || {} }; } catch {}
  const names = APPEARANCE_SECTIONS.flatMap(([, fields]) => fields.map(([name]) => name));
  const controlled = [...names, ...APPEARANCE_NUMBERS.map(([, name]) => name)];
  const fields = new Map();
  const parse = value => {
    const nums = value.match(/[\d.]+/g)?.map(Number) || [];
    if (value.startsWith('#')) {
      let hex = value.slice(1).trim();
      if (hex.length === 3 || hex.length === 4) hex = [...hex].map(char=>char+char).join('');
      return { color: '#' + hex.slice(0,6), alpha: hex.length === 8 ? parseInt(hex.slice(6),16) / 255 : 1 };
    }
    return { color: '#' + nums.slice(0,3).map(n => Math.round(n).toString(16).padStart(2,'0')).join(''), alpha: nums[3] ?? 1 };
  };
  const persist = () => { try { localStorage.setItem('gw-appearance', JSON.stringify(saved)); } catch {} };
  function sync() {
    for (const name of controlled) html.style.removeProperty(`--${name}`);
    const palette = saved[theme()];
    for (const name of names) if (typeof palette[name] === 'string' && /^(#[0-9a-f]{6}|rgba?\([\d.,\s]+\))$/i.test(palette[name])) html.style.setProperty(`--${name}`, palette[name]);
    for (const [, name,, min,max] of APPEARANCE_NUMBERS) if (Number.isFinite(palette[name]) && palette[name] >= min && palette[name] <= max) html.style.setProperty(`--${name}`, palette[name] + (['radius','ruler-font-size'].includes(name) ? 'px' : ''));
    const styles = getComputedStyle(html);
    for (const [name, { color, alpha }] of fields) { const value = parse(styles.getPropertyValue(`--${name}`).trim()); color.value = value.color; alpha.value = Math.round(value.alpha * 100); }
    root.querySelectorAll('[data-theme-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme())));
    root.querySelectorAll('[data-appearance-number]').forEach(input => { input.value = parseFloat(styles.getPropertyValue(`--${input.dataset.appearanceNumber}`)); });
    $('appearanceTheme').textContent = `${theme() === 'light' ? 'Light' : 'Dark'} appearance`;
    renderGrid(); renderRulers();
  }
  const body = $('appearanceFields');
  for (const [section, colors] of APPEARANCE_SECTIONS) {
    const group = document.createElement('fieldset'), legend = document.createElement('legend'); legend.textContent = section; group.appendChild(legend);
    for (const [name,label] of colors) {
      const row = document.createElement('div'); row.className = 'appearance-row';
      const title = document.createElement('label'); title.textContent = label; title.htmlFor = `appearance-${name}`;
      const color = document.createElement('input'); color.type = 'color'; color.id = title.htmlFor;
      const alpha = document.createElement('input'); alpha.type = 'number'; alpha.min = 0; alpha.max = 100; alpha.step = 1; alpha.setAttribute('aria-label', `${label} opacity`); alpha.title = 'Opacity (%)';
      const save = () => { const opacity = Math.max(0,Math.min(100,+alpha.value || 0))/100; const rgb = color.value.match(/\w\w/g).map(hex=>parseInt(hex,16)); saved[theme()][name] = `rgba(${rgb.join(',')},${opacity})`; html.style.setProperty(`--${name}`,saved[theme()][name]); persist(); };
      listen(color,'input',save); listen(alpha,'input',save);
      row.append(title,color,alpha); group.appendChild(row); fields.set(name,{color,alpha});
    }
    for (const [category,name,label,min,max,step] of APPEARANCE_NUMBERS.filter(([category])=>category===section)) {
      const row=document.createElement('label');row.className='appearance-row';row.textContent=label;
      const input=document.createElement('input');input.type='number';input.min=min;input.max=max;input.step=step;input.dataset.appearanceNumber=name;input.setAttribute('aria-label',`${section} ${label}`);
      listen(input,'change',()=>{const value=Math.max(min,Math.min(max,+input.value||min));saved[theme()][name]=value;persist();sync();});row.appendChild(input);group.appendChild(row);
    }
    body.appendChild(group);
  }
  try { const value=localStorage.getItem('gw-theme');if(['light','dark'].includes(value))html.dataset.theme=value; } catch {}
  root.querySelectorAll('[data-theme-choice]').forEach(button=>listen(button,'click',()=>{html.dataset.theme=button.dataset.themeChoice;try{localStorage.setItem('gw-theme',theme());}catch{}sync();}));
  listen(media,'change',sync);
  listen($('appearanceToggle'),'click',()=>{const panel=$('appearancePalette'),button=$('appearanceToggle');if(getPopup()?.panel===panel){closePopup(true);return;}sync();const bounds=button.getBoundingClientRect();openPopup(panel,button,bounds.right-360,bounds.bottom+6,()=>button);});
  listen($('resetAppearance'),'click',()=>{saved[theme()]={};persist();sync();});
  sync();
}
