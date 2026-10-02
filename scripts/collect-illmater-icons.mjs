// Extract the actual Lucide imports used in Illmater, without changing that repository.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const source = process.argv[2] || '/Users/ryders/Developer/GitHub/illmater/src';
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = await Promise.all(entries.map(entry => entry.isDirectory() ? files(join(directory, entry.name)) : /\.[jt]sx?$/.test(entry.name) ? [join(directory, entry.name)] : []));
  return results.flat();
}
const names = new Set();
for (const file of await files(source)) {
  const text = await readFile(file, 'utf8');
  for (const match of text.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g)) {
    for (const name of match[1].split(',')) { const imported = name.trim().split(/\s+as\s+/)[0]; if (imported) names.add(imported); }
  }
}
const packageRoot = resolve(source, '../node_modules/lucide-react');
const packageInfo = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
async function iconNodes(slug) {
  let file = join(packageRoot, 'dist/esm/icons', `${slug}.mjs`);
  const text = await readFile(file, 'utf8');
  const alias = text.match(/export \{ default \} from ['"](.+)['"]/);
  if (alias) file = resolve(packageRoot, 'dist/esm/icons', alias[1]);
  return (await import(pathToFileURL(file).href)).__iconNode;
}
const kebab = name => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([a-zA-Z])(\d)/g, '$1-$2').toLowerCase();
const glyphs = [];
for (const name of [...names].sort()) {
  const slug = kebab(name), shapes = await iconNodes(slug);
  if (!shapes) throw new Error(`No Lucide source for ${name} (${slug})`);
  const children = shapes.map(([tag, attrs]) => {
    if (tag === 'path') return { shape: 'path', d: attrs.d };
    if (tag === 'circle') return { shape: 'circle', cx: +attrs.cx, cy: +attrs.cy, r: +attrs.r };
    if (tag === 'rect') return { shape: 'rect', x: +attrs.x, y: +attrs.y, w: +attrs.width, h: +attrs.height, r: +(attrs.rx || 0) };
    if (tag === 'line') return { shape: 'line', x1: +attrs.x1, y1: +attrs.y1, x2: +attrs.x2, y2: +attrs.y2 };
    if (tag === 'ellipse') return { shape: 'ellipse', cx: +attrs.cx, cy: +attrs.cy, rx: +attrs.rx, ry: +attrs.ry };
    if (tag === 'polyline' || tag === 'polygon') return { shape: 'polyline', closed: tag === 'polygon', pts: attrs.points.trim().split(/\s+/).map(pair => pair.split(',').map(Number)) };
    throw new Error(`Unsupported Lucide shape ${tag}`);
  });
  glyphs.push({ name: `illmater-${slug}`, aliases: [slug, name], description: `${name} used by Illmater`, grid: 0.1, weight: 2, provenance: 'imported-stroke', source: { project: 'illmater', package: 'lucide', version: packageInfo.version, icon: name, license: 'ISC' }, symmetry: { mirror: null, rotate: 1 }, layers: [{ id: 'icon', name, paint: 'stroke', role: 'primary', node: { op: 'union', children } }] });
}
await writeFile('imports/illmater-icons.json', JSON.stringify({ format: 'glyph-workbench-library', version: 1, scope: 'all', count: glyphs.length, source: { project: 'illmater', package: 'lucide', license: 'ISC' }, glyphs }, null, 2) + '\n');
console.log(`Exported ${glyphs.length} actual Illmater Lucide icons`);
