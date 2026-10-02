// Versioned JSON interchange; no dependency on the DOM, storage, or a particular icon vendor.
import { ensureLayerNames } from './layer-tree.js';
const SHAPES = new Set(['rect', 'circle', 'triangle', 'pen', 'ellipse', 'line', 'polyline', 'polygon', 'arc', 'path']);
const OPS = new Set(['union', 'subtract', 'intersect', 'exclude', 'compound']);
const PROVENANCE = new Set(['hand-built', 'converted-stroke', 'imported-fill', 'imported-stroke']);
const clone = value => JSON.parse(JSON.stringify(value));

function validateSymmetry(sym) {
  if (sym == null || sym === false) return;
  if (typeof sym !== 'object' || Array.isArray(sym)) throw new Error('Invalid symmetry');
  if (sym.axis) for (const key of ['x','y','angle']) if (sym.axis[key] != null && !Number.isFinite(sym.axis[key])) throw new Error('Invalid symmetry axis');
  if (sym.mirror != null && !['x', 'y', 'xy'].includes(sym.mirror)) throw new Error('Invalid mirror axis');
  if (sym.rotate != null && (!Number.isInteger(sym.rotate) || sym.rotate < 1 || sym.rotate > 32)) throw new Error('Radial copies must be an integer from 1 to 32');
}

export function normalizeGlyph(input) {
  if (!input || typeof input !== 'object' || typeof input.name !== 'string' || !input.name.trim()) throw new Error('Each icon needs a name');
  if (!Array.isArray(input.layers) || !input.layers.length || input.layers.length > 128) throw new Error(`${input.name}: expected 1–128 layers`);
  const glyph = clone(input);
  if (glyph.aliases != null && (!Array.isArray(glyph.aliases) || !glyph.aliases.every(term => typeof term === 'string'))) throw new Error(`${glyph.name}: search terms must be strings`);
  if (glyph.description != null && typeof glyph.description !== 'string') throw new Error(`${glyph.name}: description must be text`);
  if (glyph.exportSize != null && (!Number.isInteger(glyph.exportSize) || glyph.exportSize < 16 || glyph.exportSize > 4096)) throw new Error(`${glyph.name}: invalid export size`);
  if (glyph.setStyle != null) {
    if (glyph.setStyle.thickness != null && (!Number.isFinite(glyph.setStyle.thickness) || glyph.setStyle.thickness < 0.1 || glyph.setStyle.thickness > 8)) throw new Error(`${glyph.name}: invalid set thickness`);
    if (glyph.setStyle.rounding != null && (!Number.isFinite(glyph.setStyle.rounding) || glyph.setStyle.rounding < 0 || glyph.setStyle.rounding > 6)) throw new Error(`${glyph.name}: invalid rounding`);
  }
  if (glyph.setStyle?.endRounding != null && (!Number.isFinite(glyph.setStyle.endRounding) || glyph.setStyle.endRounding < 0 || glyph.setStyle.endRounding > 6)) throw new Error(`${glyph.name}: invalid line-end rounding`);
  let count = 0;
  const walk = (node, depth = 0) => {
    if (!node || typeof node !== 'object' || depth > 32 || ++count > 10000) throw new Error(`${glyph.name}: invalid or oversized form tree`);
    validateSymmetry(node.symmetry);
    if (node.roundingAnchors != null && (!Array.isArray(node.roundingAnchors) || !node.roundingAnchors.every(index => Number.isInteger(index) && index >= 0))) throw new Error(`${glyph.name}: invalid rounding anchor tags`);
    if (node.cap != null && !['', 'round', 'butt', 'square'].includes(node.cap)) throw new Error(`${glyph.name}: invalid line cap`);
    if (node.deform != null) {
      if (!Array.isArray(node.deform)) throw new Error(`${glyph.name}: invalid deformers`);
      for (const deformer of node.deform) {
        if (!deformer || !['taper', 'skew', 'round', 'offset'].includes(deformer.type)) throw new Error(`${glyph.name}: unsupported deformer`);
        for (const [key, value] of Object.entries(deformer)) if (key !== 'type' && !Number.isFinite(value)) throw new Error(`${glyph.name}: deformer parameters must be numeric`);
      }
    }
    for (const key of ['x', 'y', 'w', 'h', 'cx', 'cy', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'sides', 'rotation', 'start', 'end', 'fillet']) {
      if (node[key] != null && !Number.isFinite(node[key])) throw new Error(`${glyph.name}: ${key} must be numeric`);
    }
    if (node.r != null && !(Array.isArray(node.r) ? node.r.every(Number.isFinite) : Number.isFinite(node.r))) throw new Error(`${glyph.name}: invalid radius`);
    if (node.transform) {
      for (const key of ['rotate','scaleX','scaleY']) if (node.transform[key] != null && !Number.isFinite(node.transform[key])) throw new Error(`${glyph.name}: invalid transform`);
      if (node.transform.origin != null && (!Array.isArray(node.transform.origin) || node.transform.origin.length !== 2 || !node.transform.origin.every(Number.isFinite))) throw new Error(`${glyph.name}: invalid transform origin`);
    }
    if (node.shape) {
      if (!SHAPES.has(node.shape)) throw new Error(`${glyph.name}: unsupported shape ${node.shape}`);
      if (node.children) throw new Error(`${glyph.name}: a shape cannot also be a group`);
      if (node.shape === 'path' && typeof node.d !== 'string') throw new Error(`${glyph.name}: path needs SVG path data`);
      if (['pen', 'polyline'].includes(node.shape)) {
        if (!Array.isArray(node.pts)) throw new Error(`${glyph.name}: path needs points`);
        for (const point of node.pts) {
          const coords = node.shape === 'pen' ? [point?.x, point?.y] : point;
          if (!Array.isArray(coords) || coords.length < 2 || !coords.slice(0, 2).every(Number.isFinite)) throw new Error(`${glyph.name}: invalid path point`);
          if (node.shape === 'pen') for (const key of ['in', 'out']) {
            if (point[key] != null && (!Array.isArray(point[key]) || point[key].length !== 2 || !point[key].every(Number.isFinite))) throw new Error(`${glyph.name}: invalid curve handle`);
          }
        }
      }
      if (node.sides != null && (!Number.isInteger(node.sides) || node.sides < 3 || node.sides > 512)) throw new Error(`${glyph.name}: polygon sides must be 3–512`);
    } else {
      if (!OPS.has(node.op || 'union') || !Array.isArray(node.children)) throw new Error(`${glyph.name}: invalid boolean group`);
      node.children.forEach(child => walk(child, depth + 1));
    }
  };
  validateSymmetry(glyph.symmetry);
  for (const [index, layer] of glyph.layers.entries()) {
    if (!layer || typeof layer !== 'object') throw new Error(`${glyph.name}: invalid layer`);
    if (layer.role != null && !['primary', 'secondary', 'accent'].includes(layer.role)) throw new Error(`${glyph.name}: invalid color role`);
    if (layer.paint != null && !['stroke', 'fill', 'both'].includes(layer.paint)) throw new Error(`${glyph.name}: invalid paint mode`);
    if (layer.color != null && !/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(layer.color)) throw new Error(`${glyph.name}: color must be a hex color`);
    if (layer.opacity != null && (!Number.isFinite(layer.opacity) || layer.opacity < 0 || layer.opacity > 1)) throw new Error(`${glyph.name}: invalid opacity`);
    layer.id ||= `layer-${index + 1}`;
    walk(layer.node);
  }
  glyph.grid ??= 0.1;
  glyph.weight ??= 1.2;
  if (!Number.isFinite(glyph.grid) || glyph.grid < 0 || !Number.isFinite(glyph.weight) || glyph.weight <= 0) throw new Error(`${glyph.name}: invalid grid or weight`);
  glyph.symmetry ??= { mirror: null, rotate: 1 };
  if (!PROVENANCE.has(glyph.provenance)) glyph.provenance = 'hand-built';
  return ensureLayerNames(glyph);
}

export function parseLibrary(text) {
  const data = JSON.parse(text);
  if (data?.format != null && (data.format !== 'glyph-workbench-library' || data.version !== 1)) throw new Error('Unsupported library format or version');
  const list = Array.isArray(data) ? data : Array.isArray(data?.glyphs) ? data.glyphs : [data];
  if (!list.length || list.length > 10000) throw new Error('Expected 1–10000 icons');
  const names = new Set();
  return list.map(input => {
    const glyph = normalizeGlyph(input);
    if (names.has(glyph.name)) throw new Error(`Duplicate name in import: ${glyph.name}`);
    names.add(glyph.name);
    return glyph;
  });
}

export function mergeLibrary(existing, incoming, mode = 'add') {
  if (!['add', 'overwrite'].includes(mode)) throw new Error('Choose add or overwrite');
  const library = existing.slice(), slots = new Map(library.map((glyph, index) => [glyph.name, index]));
  // Reserve every incoming name, so renamed collisions cannot steal another imported icon's name.
  const reserved = new Set([...slots.keys(), ...incoming.map(glyph => glyph.name)]);
  let added = 0, replaced = 0, renamed = 0;
  const names = [];
  for (const original of incoming) {
    const glyph = clone(original);
    const at = slots.get(glyph.name);
    if (mode === 'overwrite' && at != null) { library[at] = glyph; replaced++; }
    else {
      if (at != null) {
        let suffix = 2;
        while (reserved.has(`${glyph.name}-${suffix}`)) suffix++;
        glyph.name = `${glyph.name}-${suffix}`; renamed++;
      }
      reserved.add(glyph.name); slots.set(glyph.name, library.length); library.push(glyph); added++;
    }
    names.push(glyph.name);
  }
  return { library, names, added, replaced, renamed };
}

export function libraryDocument(glyphs, scope = 'all') {
  return { format: 'glyph-workbench-library', version: 1, scope, exportedAt: new Date().toISOString(), count: glyphs.length, glyphs: glyphs.map(clone) };
}
