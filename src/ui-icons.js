// Font Awesome Free UI artwork (CC BY 4.0), plus original direct-selection and Boolean symbols (MIT).
// Kept separate from editable user icons.
import {
  faArrowPointer, faPenNib, faCircle, faSquare, faPlay, faStar, faDrawPolygon,
  faMinus, faBezierCurve, faLayerGroup, faEye, faEyeSlash, faLock, faLockOpen,
  faScissors, faObjectUngroup, faClone, faTrash, faPlus,
  faArrowUp, faArrowDown, faRotateLeft, faRotateRight, faRotate, faArrowsUpDownLeftRight,
  faMagnifyingGlassPlus, faMagnifyingGlassMinus, faExpand, faUpload, faDownload,
  faMoon, faSun, faSliders, faCrosshairs, faArrowsLeftRight, faArrowsUpDown, faMagnifyingGlass,
  faBorderAll, faBullseye, faBraille, faShapes,
} from '@fortawesome/free-solid-svg-icons';
const ICONS = {
  select: faArrowPointer, pen: faPenNib, circle: faCircle, ellipse: faCircle,
  rect: faSquare, triangle: faPlay, star: faStar, polygon: faDrawPolygon,
  line: faMinus, polyline: faBezierCurve, path: faBezierCurve, arc: faBezierCurve,
  layers: faLayerGroup, eye: faEye, 'eye-off': faEyeSlash, lock: faLock, unlock: faLockOpen,
  cutter: faScissors,
  ungroup: faObjectUngroup, duplicate: faClone, delete: faTrash,
  'plus-outline': faPlus, up: faArrowUp, down: faArrowDown, undo: faRotateLeft, redo: faRotateRight,
  rotate: faRotate, transform: faArrowsUpDownLeftRight, anchor: faCrosshairs, guides: faCrosshairs,
  'zoom-in': faMagnifyingGlassPlus, 'zoom-out': faMagnifyingGlassMinus, fit: faExpand,
  import: faUpload, export: faDownload, theme: faMoon, sun: faSun, deform: faSliders,
  'flip-h': faArrowsLeftRight, 'flip-v': faArrowsUpDown, 'search-outline': faMagnifyingGlass,
  grid: faBorderAll, safe: faDrawPolygon, keylines: faBullseye, points: faBraille, forms: faShapes,
};
const BOOLEAN_PATHS = {
  union: '<path d="M3 3H15V9H21V21H9V15H3Z"/>',
  subtract: '<path d="M3 3H15V9H9V15H3Z"/><path d="M15 9H21V21H9V15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2" opacity=".45"/>',
  intersect: '<path d="M3 3H15V15H3ZM9 9H21V21H9Z" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".45"/><path d="M9 9H15V15H9Z"/>',
  exclude: '<path d="M3 3H15V15H3ZM9 9H21V21H9Z" fill-rule="evenodd"/>',
};
export function uiSVG(name) {
  const areaPaths={marquee:'<rect x="4" y="5" width="16" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 2"/>',lasso:'<path d="M8 18C-2 14 3 3 13 4C24 5 23 17 13 18C5 19 5 12 9 12C14 12 11 23 7 22" fill="none" stroke="currentColor" stroke-width="1.6"/>','polygon-lasso':'<path d="M4 7L16 3L21 13L14 20L3 17Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 2"/>',chevron:'<path d="M7 9L12 14L17 9" fill="none" stroke="currentColor" stroke-width="1.8"/>'};
  if(areaPaths[name])return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${areaPaths[name]}</svg>`;
  const operation = name.replace(/^ui-/, '');
  if (BOOLEAN_PATHS[operation]) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor">${BOOLEAN_PATHS[operation]}</svg>`;
  if (name === 'direct') return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 2L19 14L12 15L9 22L5 2Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const definition = ICONS[name.replace(/^ui-/, '')] || faCircle;
  const [width, height, , , paths] = definition.icon;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false" fill="currentColor">${(Array.isArray(paths) ? paths : [paths]).map(d => `<path d="${d}"/>`).join('')}</svg>`;
}
