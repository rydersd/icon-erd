export const SHORTCUT_ACTIONS = {
  select: { label: 'Selection', key: 'V' }, direct: { label: 'Direct selection', key: 'A' }, pen: { label: 'Pen', key: 'P' },
  handles: { label: 'Toggle shape / transform handles', key: 'T' }, selectAll: { label: 'Select all objects', key: 'Mod+A' },
  undo: { label: 'Undo', key: 'Mod+Z' }, redo: { label: 'Redo', key: 'Mod+Shift+Z' },
  libraryPlace: { label: 'Library place', key: 'Mod+Alt+L' },
  duplicate: { label: 'Duplicate', key: 'Mod+D' }, group: { label: 'Group', key: 'Mod+G' }, ungroup: { label: 'Ungroup', key: 'Mod+Shift+G' },
  delete: { label: 'Delete', key: 'Delete' },
};
export const DEFAULT_SHORTCUTS = Object.fromEntries(Object.entries(SHORTCUT_ACTIONS).map(([action, value]) => [action, value.key]));
export function normalizeShortcut(value) {
  const parts = String(value).trim().split('+').map(part => part.trim());
  const key = parts.pop(), modifiers = new Set(parts.map(part => /^(cmd|ctrl|control|meta|mod)$/i.test(part) ? 'Mod' : /^shift$/i.test(part) ? 'Shift' : /^alt$/i.test(part) ? 'Alt' : part));
  if ([...modifiers].some(part => !['Mod', 'Shift', 'Alt'].includes(part)) || !(/^\w$/.test(key) || ['Delete', 'Backspace'].includes(key))) throw new Error('Use a letter, digit or Delete, optionally with Mod, Shift or Alt.');
  return [...['Mod', 'Shift', 'Alt'].filter(part => modifiers.has(part)), key === 'Backspace' ? 'Delete' : key.length === 1 ? key.toUpperCase() : key].join('+');
}
export function shortcutFromEvent(event) {
  // Option on a Mac changes event.key (Option+L types "¬"), so Alt combinations name the physical key.
  const physical = event.altKey && /^(?:Key([A-Z])|Digit(\d))$/.exec(event.code || '');
  const key = physical ? physical[1] || physical[2] : event.key === 'Backspace' ? 'Delete' : event.key;
  return [event.metaKey || event.ctrlKey ? 'Mod' : null, event.shiftKey ? 'Shift' : null, event.altKey ? 'Alt' : null, key.length === 1 ? key.toUpperCase() : key].filter(Boolean).join('+');
}
export function setShortcut(shortcuts, action, value) {
  if (!(action in SHORTCUT_ACTIONS)) throw new Error('Unknown shortcut action');
  const key = normalizeShortcut(value);
  const conflict = Object.keys(shortcuts).find(other => other !== action && shortcuts[other] === key);
  if (conflict) throw new Error(`${key} is already assigned to ${SHORTCUT_ACTIONS[conflict].label}.`);
  return { ...shortcuts, [action]: key };
}
export function restoreShortcuts(stored = {}) {
  const saved = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  let restored = {};
  for (const action of Object.keys(SHORTCUT_ACTIONS)) {
    if (action === 'libraryPlace') continue;
    restored = setShortcut(restored, action, saved[action] ?? DEFAULT_SHORTCUTS[action]);
  }
  const requested = Object.prototype.hasOwnProperty.call(saved, 'libraryPlace') ? [saved.libraryPlace] : [DEFAULT_SHORTCUTS.libraryPlace, 'Mod+Shift+L', 'Alt+L', 'Shift+L', 'L'];
  let error;
  for (const key of requested) {
    try { return setShortcut(restored, 'libraryPlace', key); } catch (caught) { error = caught; }
  }
  throw error;
}
