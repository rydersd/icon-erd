// Shared forms keep an editable projection in each icon. IDs bind those projections;
// commits publish geometry to every instance, retaining its placement and local styling.
const clone = value => JSON.parse(JSON.stringify(value));
const LOCAL = ['name', 'transform', 'hidden', 'edge', 'component'];
const round = n => Math.round(n * 10000) / 10000;
export function formsIn(glyph) {
  const forms = [];
  const walk = (node, l, p, linkedAncestor = false, ancestors = []) => {
    forms.push({ node, glyph, l, p, linkedAncestor, ancestors });
    (node.children || []).forEach((child, i) => walk(child, l, [...p, i], linkedAncestor || !!node.component, [...ancestors,node]));
  };
  glyph.layers.forEach((layer, l) => walk(layer.node, l, []));
  return forms;
}
export function shiftForm(node, dx, dy, translateD) {
  const n = clone(node);
  const walk = n => {
    for (const k of ['x', 'cx', 'x1', 'x2']) if (typeof n[k] === 'number') n[k] = round(n[k] + dx);
    for (const k of ['y', 'cy', 'y1', 'y2']) if (typeof n[k] === 'number') n[k] = round(n[k] + dy);
    if (n.pts) for (const p of n.pts) { if (Array.isArray(p)) { p[0] = round(p[0]+dx); p[1] = round(p[1]+dy); } else { p.x = round(p.x+dx); p.y = round(p.y+dy); } }
    if (n.d && (dx || dy)) n.d = translateD(n.d, dx, dy);
    if (n.transform?.origin) n.transform.origin = [round(n.transform.origin[0]+dx), round(n.transform.origin[1]+dy)];
    if (n.symmetry && (n.symmetry.mirror || n.symmetry.rotate>1) && !n.symmetry.axis) n.symmetry.axis={x:12,y:12,angle:0};
    if (n.symmetry?.axis) { n.symmetry.axis.x = round(n.symmetry.axis.x+dx); n.symmetry.axis.y = round(n.symmetry.axis.y+dy); }
    (n.children || []).forEach(walk);
  };
  walk(n); return n;
}
function definition(node, core) {
  const n = clone(node);
  const origin = n.component?.origin || [0, 0];
  for (const key of LOCAL) delete n[key];
  // Names are instance annotations, including child names inside a shared group.
  const strip = n => { delete n.name; delete n.from; (n.children || []).forEach(strip); };
  strip(n);
  return shiftForm(n, -origin[0], -origin[1], core.translateD);
}
const stable = value => JSON.stringify(value, (key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(k => [k, item[k]])) : item);
function replaceInstance(target, source, core) {
  const origin = target.component.origin;
  const next = shiftForm(source, origin[0], origin[1], core.translateD);
  const names = (a,b) => { if (a.name) b.name = a.name; (b.children || []).forEach((c,i) => { if (a.children?.[i]) names(a.children[i],c); }); };
  names(target, next);
  for (const key of LOCAL) if (target[key] != null) next[key] = clone(target[key]);
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, next);
}
export function publishSharedForms(glyph, before, library, core) {
  const previous = new Map(formsIn(before).filter(f => f.node.component).map(f => [f.node.component.id, definition(f.node,core)]));
  const updates = new Map();
  for (const {node} of formsIn(glyph)) if (node.component) {
    const def = definition(node,core), old = previous.get(node.component.id);
    if (old && stable(old) !== stable(def) && !updates.has(node.component.id)) updates.set(node.component.id, def);
  }
  const changed = [];
  for (const peer of library) {
    if (peer === glyph) continue;
    let original = null;
    for (const {node} of formsIn(peer)) if (node.component && updates.has(node.component.id)) {
      const def = updates.get(node.component.id);
      if (stable(definition(node,core)) === stable(def)) continue;
      original ||= clone(peer); replaceInstance(node,def,core);
    }
    if (original) changed.push(original);
  }
  // Include other instances in the working icon, while leaving the edited source intact.
  for (const {node} of formsIn(glyph)) if (node.component && updates.has(node.component.id)) {
    const def = updates.get(node.component.id);
    if (stable(definition(node,core)) !== stable(def)) replaceInstance(node,def,core);
  }
  return changed;
}
function matchData(form, core) {
  if (form.linkedAncestor || formsIn({layers:[{node:form.node}]}).some(f => f.node.component)) return null;
  // Symmetry with implicit origins is deliberately excluded from translated matching.
  if (formsIn({layers:[{node:form.node}]}).some(f => f.node.symmetry || f.node.deform?.length)) return null;
  const bounds = core.rawBounds(form.node); if (!bounds || !bounds.every(Number.isFinite) || Math.max(bounds[2],bounds[3]) < 0.001) return null;
  const origin = bounds.slice(0,2).map(round);
  const node = clone(form.node); node.component = {origin};
  let def = definition(node,core);
  // Closed paths may start at any anchor; sort cyclic rotations without reversing winding.
  const canonical = n => {
    if (n.shape === 'pen') {
      n.closed = !!n.closed;
      n.pts = n.pts.map(p => ({x:p.x,y:p.y,in:p.in || [0,0],out:p.out || [0,0],r:p.r || 0}));
      if (n.closed && n.pts.length && !n.roundingAnchors?.length) {
        let at = 0; for(let i=1;i<n.pts.length;i++) if(n.pts[i].x < n.pts[at].x || n.pts[i].x===n.pts[at].x && n.pts[i].y<n.pts[at].y)at=i;
        n.pts=[...n.pts.slice(at),...n.pts.slice(0,at)];
      }
    }
    (n.children || []).forEach(canonical);
  };
  canonical(def);
  const topology = stable(def).replace(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g,'#');
  return {...form,origin,def,topology};
}
function difference(a,b) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a-b);
  if (a && b && typeof a==='object' && typeof b==='object') {
    const keys = Object.keys(a); if(keys.length!==Object.keys(b).length)return Infinity;
    return Math.max(0,...keys.map(k => k in b ? difference(a[k],b[k]) : Infinity));
  }
  return a === b ? 0 : Infinity;
}
export function findSharedForms(library, core) {
  const buckets = new Map();
  for (const glyph of library) for(const form of formsIn(glyph)) {
    const data = matchData(form,core); if(!data)continue;
    const bucket = buckets.get(data.topology) || []; bucket.push(data); buckets.set(data.topology,bucket);
  }
  const groups=[];
  for(const bucket of buckets.values()) {
    const remaining = [...bucket];
    while(remaining.length) {
      const source=remaining.shift(), members=[source]; let maxDelta=0;
      for(let i=remaining.length-1;i>=0;i--) {
        const delta=difference(source.def,remaining[i].def);
        if(delta<=0.03001){maxDelta=Math.max(maxDelta,delta);members.push(remaining.splice(i,1)[0]);}
      }
      if(members.length>1)groups.push({members,approximate:maxDelta>0.0001,maxDelta,name:source.node.name || source.node.shape || 'Shared group'});
    }
  }
  // Prefer reusable groups over linking their children independently.
  groups.sort((a,b)=>(b.members[0].node.children?.length || 0)-(a.members[0].node.children?.length || 0) || b.members.length-a.members.length);
  return groups;
}
export function linkSharedForms(group, name, core, id) {
  const members=group.members;
  const source=clone(members[0].node); source.component={origin:members[0].origin};
  const def=definition(source,core);
  for(const member of members) {
    member.node.component={id,name,origin:member.origin};
    replaceInstance(member.node,def,core);
  }
  return id;
}
export function remapSharedForms(glyphs, newId) {
  const ids=new Map();
  for(const glyph of glyphs)for(const {node} of formsIn(glyph))if(node.component) {
    const old=node.component.id; if(!ids.has(old))ids.set(old,newId());node.component.id=ids.get(old);
  }
  return ids;
}
