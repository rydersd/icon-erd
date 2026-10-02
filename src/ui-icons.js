// Font Awesome Free UI artwork (CC BY 4.0). Kept separate from editable user icons.
import {
  faArrowPointer, faPenNib, faCircle, faSquare, faPlay, faStar, faDrawPolygon,
  faMinus, faBezierCurve, faLayerGroup, faEye, faEyeSlash, faLock, faLockOpen,
  faScissors, faObjectGroup, faObjectUngroup, faClone, faTrash, faPlus,
  faArrowUp, faArrowDown, faRotateLeft, faRotateRight, faRotate, faArrowsUpDownLeftRight,
  faMagnifyingGlassPlus, faMagnifyingGlassMinus, faExpand, faUpload, faDownload,
  faMoon, faSliders, faCrosshairs, faArrowsLeftRight, faArrowsUpDown, faMagnifyingGlass,
  faBorderAll, faBullseye, faBraille, faShapes,
} from '@fortawesome/free-solid-svg-icons';
const ICONS = {
  select: faArrowPointer, pen: faPenNib, circle: faCircle, ellipse: faCircle,
  rect: faSquare, triangle: faPlay, star: faStar, polygon: faDrawPolygon,
  line: faMinus, polyline: faBezierCurve, path: faBezierCurve, arc: faBezierCurve,
  layers: faLayerGroup, eye: faEye, 'eye-off': faEyeSlash, lock: faLock, unlock: faLockOpen,
  cutter: faScissors, subtract: faScissors, union: faObjectGroup, intersect: faObjectGroup,
  exclude: faObjectUngroup, ungroup: faObjectUngroup, duplicate: faClone, delete: faTrash,
  'plus-outline': faPlus, up: faArrowUp, down: faArrowDown, undo: faRotateLeft, redo: faRotateRight,
  rotate: faRotate, transform: faArrowsUpDownLeftRight, anchor: faCrosshairs, guides: faCrosshairs,
  'zoom-in': faMagnifyingGlassPlus, 'zoom-out': faMagnifyingGlassMinus, fit: faExpand,
  import: faUpload, export: faDownload, theme: faMoon, deform: faSliders,
  'flip-h': faArrowsLeftRight, 'flip-v': faArrowsUpDown, 'search-outline': faMagnifyingGlass,
  grid: faBorderAll, safe: faDrawPolygon, keylines: faBullseye, points: faBraille, forms: faShapes,
};
export function uiSVG(name) {
  if (name === 'direct') return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 2L19 14L12 15L9 22L5 2Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const definition = ICONS[name.replace(/^ui-/, '')] || faCircle;
  const [width, height, , , paths] = definition.icon;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false" fill="currentColor">${(Array.isArray(paths) ? paths : [paths]).map(d => `<path d="${d}"/>`).join('')}</svg>`;
}
