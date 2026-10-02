const labels = { rect: 'Rectangle', polyline: 'Polyline', pen: 'Pen path', path: 'Path', compound: 'Compound path' };
const title = value => labels[value] || value.charAt(0).toUpperCase() + value.slice(1);

// Add readable fallbacks; preserve the owner's names and geometry.
export function ensureLayerNames(glyph) {
  const nameNodes = nodes => {
    const counts = {};
    const used = new Set(nodes.map(node => node.name).filter(name => typeof name === 'string' && name.trim()));
    for (const node of nodes) {
      const kind = node.shape || `${node.op || 'union'} group`;
      counts[kind] = (counts[kind] || 0) + 1;
      if (typeof node.name !== 'string' || !node.name.trim()) {
        while (used.has(`${title(kind)} ${counts[kind]}`)) counts[kind]++;
        node.name = `${title(kind)} ${counts[kind]}`; used.add(node.name);
      }
      if (node.children) nameNodes(node.children);
    }
  };
  for (const [index, layer] of (glyph.layers || []).entries()) {
    if (typeof layer.name !== 'string' || !layer.name.trim()) layer.name = `Layer ${index + 1}`;
    if (layer.node) nameNodes([layer.node]);
  }
  return glyph;
}

const nodeAt = (glyph, selection) => selection.p.reduce((node, index) => node.children[index], glyph.layers[selection.l].node);
const contains = (node, target) => node === target || (node.children || []).some(child => contains(child, target));

export function canMoveTreeItem(glyph, source, target, position) {
  if (!['before', 'after', 'inside'].includes(position)) return false;
  if (!glyph.layers[source.l] || !glyph.layers[target.l]) return false;
  if (source.p === null) return target.p === null && source.l !== target.l && position !== 'inside';
  const node = nodeAt(glyph, source);
  const destination = target.p === null ? glyph.layers[target.l].node : nodeAt(glyph, target);
  if (contains(node, destination)) return false;
  const hasComponent = n => !!n.component || (n.children || []).some(hasComponent);
  if(hasComponent(node)) {
    const parentPath=position==='inside' && destination.children ? (target.p || []) : target.p?.length ? target.p.slice(0,-1) : null;
    if(parentPath)for(let i=0;i<=parentPath.length;i++)if(nodeAt(glyph,{l:target.l,p:parentPath.slice(0,i)}).component)return false;
  }
  if (target.p === null) return position === 'inside';
  return position !== 'inside' || Array.isArray(destination.children);
}

export function moveTreeItem(glyph, source, target, position) {
  if (!canMoveTreeItem(glyph, source, target, position)) return null;
  if (source.p === null) {
    const layer = glyph.layers[source.l], destination = glyph.layers[target.l];
    glyph.layers.splice(source.l, 1);
    const index = glyph.layers.indexOf(destination) + (position === 'after' ? 1 : 0);
    glyph.layers.splice(index, 0, layer);
    return { l: index, p: null };
  }
  const node = nodeAt(glyph, source), destinationLayer = glyph.layers[target.l];
  const destination = target.p === null ? destinationLayer.node : nodeAt(glyph, target);
  let parent = target.p !== null && target.p.length ? nodeAt(glyph, { l: target.l, p: target.p.slice(0, -1) }) : null;
  if (source.p.length) {
    const sourceParent = nodeAt(glyph, { l: source.l, p: source.p.slice(0, -1) });
    sourceParent.children.splice(source.p.at(-1), 1);
  } else glyph.layers[source.l].node = { op: 'union', name: 'Empty group', children: [] };
  if (position === 'inside') {
    if (!destination.children) destinationLayer.node = { op: 'union', children: [destination, node] };
    else destination.children.push(node);
  } else {
    if (!parent) {
      parent = { op: 'union', children: [destination] };
      destinationLayer.node = parent;
    }
    parent.children.splice(parent.children.indexOf(destination) + (position === 'after' ? 1 : 0), 0, node);
  }
  ensureLayerNames(glyph);
  let result = null;
  const find = (current, path) => {
    if (current === node) result = { l: target.l, p: path };
    (current.children || []).forEach((child, index) => find(child, [...path, index]));
  };
  find(destinationLayer.node, []);
  return result;
}

export function useAsCutter(glyph, selection) {
  if (!selection || selection.p === null || !selection.p.length) return null;
  const parent = nodeAt(glyph, { l: selection.l, p: selection.p.slice(0, -1) });
  const index = selection.p.at(-1), cutter = parent.children[index];
  if (!cutter || parent.children.length < 2) return null;
  if (parent.op === 'subtract' && index > 0) {
    delete cutter.edge;
    if (parent.children.length === 2) parent.op = 'union';
    else {
      const remaining = parent.children.filter((_, i) => i !== index);
      const subject = { ...parent, children: remaining };
      delete subject.component; // The outer group retains the shared identity.
      parent.op = 'union'; parent.children = [subject, cutter]; delete parent.fillet;
      return { l: selection.l, p: [...selection.p.slice(0, -1), 1] };
    }
    return selection;
  }
  const others = parent.children.filter((_, i) => i !== index);
  parent.op = 'subtract';
  parent.children = [others.length === 1 ? others[0] : { op: 'union', name: 'Artwork', children: others }, cutter];
  return { l: selection.l, p: [...selection.p.slice(0, -1), 1] };
}
