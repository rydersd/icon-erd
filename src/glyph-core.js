/* Shared Paper.js geometry evaluator for the editor and headless tests. */
export function createGlyphCore(paper) {
  'use strict';
  paper.settings.insertItems = false;
  paper.settings.applyMatrix = true;
  const P = (x, y) => new paper.Point(x, y);
  const C = 12;
  const EPS = 1e-4;
  const ROLE_VARS = {
    primary: 'currentColor',
    secondary: 'var(--icon-color-secondary, #7a8494)',
    accent: 'var(--icon-color-accent, #0267e0)',
  };
  const ROLE_DEFAULTS = { primary: '#1d2430', secondary: '#7a8494', accent: '#0267e0' };

  // ---------- corner rounding (used by rect, polyline/polygon 'round' deformer) ----------
  // verts: [{p:Point, r}] ; closed polygon or open polyline. Emits a paper.Path with cubic fillets.
  function filletPath(verts, closed) {
    const n = verts.length;
    // pass 1: geometry + desired tangent length per vertex
    const info = verts.map((v, i) => {
      const isEnd = !closed && (i === 0 || i === n - 1);
      if (isEnd || !(v.r > 0)) return null;
      const prev = verts[(i - 1 + n) % n].p, next = verts[(i + 1) % n].p;
      const a = v.p.subtract(prev), b = next.subtract(v.p);
      const la = a.length, lb = b.length;
      if (la < EPS || lb < EPS) return null;
      const u = a.divide(la), w = b.divide(lb);
      const phi = Math.acos(Math.max(-1, Math.min(1, u.dot(w)))); // turning angle
      if (phi < 1e-3) return null;
      return { u, w, la, lb, phi, t: v.r * Math.tan(phi / 2) };
    });
    // pass 2: where two neighbouring fillets want more than their shared edge, scale both down
    // proportionally (CSS border-radius behaviour) so unequal radii — a dome over a flat base — survive
    const tOf = i => (info[i] ? info[i].t : 0);
    const scale = verts.map(() => 1);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n; if (!closed && j === 0) break;
      const len = verts[j].p.subtract(verts[i].p).length, want = tOf(i) + tOf(j);
      if (want > len && want > 0) { const f = len / want; scale[i] = Math.min(scale[i], f); scale[j] = Math.min(scale[j], f); }
    }
    const segs = [];
    for (let i = 0; i < n; i++) {
      const v = verts[i], I = info[i];
      if (!I) { segs.push(new paper.Segment(v.p)); continue; }
      const t = I.t * scale[i];
      const r = t / Math.tan(I.phi / 2);
      const h = (4 / 3) * Math.tan(I.phi / 4) * r;
      const p1 = v.p.subtract(I.u.multiply(t)), p2 = v.p.add(I.w.multiply(t));
      segs.push(new paper.Segment(p1, null, I.u.multiply(h)));
      segs.push(new paper.Segment(p2, I.w.multiply(-h), null));
    }
    // collapse coincident neighbours (two fillets meeting exactly mid-edge)
    const out = [];
    for (const sg of segs) {
      const last = out[out.length - 1];
      if (last && last.point.isClose(sg.point, EPS)) { last.handleOut = sg.handleOut; continue; }
      out.push(sg);
    }
    if (closed && out.length > 1 && out[0].point.isClose(out[out.length - 1].point, EPS)) { out[0].handleIn = out[out.length - 1].handleIn; out.pop(); }
    return new paper.Path({ segments: out, closed });
  }

  // ---------- shapes ----------
  const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
  function shapeItems(n) {
    switch (n.shape) {
      case 'rect': {
        let x = num(n.x), y = num(n.y), w = num(n.w, 1), h = num(n.h, 1);
        if (w < 0) { x += w; w = -w; } if (h < 0) { y += h; h = -h; }
        const rr = Array.isArray(n.r) ? n.r : [n.r, n.r, n.r, n.r];
        const lim = Math.min(w, h);
        const r = [0, 1, 2, 3].map(i => Math.max(0, Math.min(num(rr[i]), lim)));
        return [filletPath([
          { p: P(x, y), r: r[0] }, { p: P(x + w, y), r: r[1] },
          { p: P(x + w, y + h), r: r[2] }, { p: P(x, y + h), r: r[3] }], true)];
      }
      case 'circle':
        return [new paper.Path.Circle({ center: [num(n.cx, C), num(n.cy, C)], radius: Math.abs(num(n.r, 1)) })];
      case 'triangle': {
        // isosceles in its box, apex at top centre; optional uniform corner radius r
        let x = num(n.x), y = num(n.y), w = num(n.w, 1), h = num(n.h, 1);
        if (w < 0) { x += w; w = -w; } if (h < 0) { y += h; h = -h; }
        const r = Math.max(0, num(n.r));
        return [filletPath([{ p: P(x + w / 2, y), r }, { p: P(x + w, y + h), r }, { p: P(x, y + h), r }], true)];
      }
      case 'pen': {
        // anchors with optional relative bezier handles: {x, y, in:[dx,dy], out:[dx,dy]}
        const pts = (n.pts || []).filter(q => q && isFinite(q.x) && isFinite(q.y));
        if (pts.length < 2) return [];
        const h = v => (Array.isArray(v) ? P(num(v[0]), num(v[1])) : null);
        let p = new paper.Path({ segments: pts.map(q => new paper.Segment(P(q.x, q.y), h(q.in), h(q.out))), closed: !!n.closed });
        // optional per-anchor corner radius r (rounds that vertex only; smooth anchors are left alone)
        if (pts.some(q => num(q.r) > 0)) p = filletCurves(p, pts.map(q => Math.max(0, num(q.r))));
        if (n.cap) p.data.cap = n.cap;
        return [p];
      }
      case 'ellipse':
        return [new paper.Path.Ellipse({ center: [num(n.cx, C), num(n.cy, C)], radius: [Math.abs(num(n.rx, 1)), Math.abs(num(n.ry, num(n.rx, 1)))] })];
      case 'line': {
        const p = new paper.Path({ segments: [[num(n.x1), num(n.y1)], [num(n.x2), num(n.y2)]], closed: false });
        if (n.cap) p.data.cap = n.cap;
        return [p];
      }
      case 'polyline': {
        const pts = (n.pts || []).filter(q => Array.isArray(q) && q.length >= 2);
        if (pts.length < 2) return [];
        // optional third value per point = that vertex's corner radius (like a vertex radius in Figma)
        const p = pts.some(q => num(q[2]) > 0)
          ? filletPath(pts.map(q => ({ p: P(num(q[0]), num(q[1])), r: Math.max(0, num(q[2])) })), !!n.closed)
          : new paper.Path({ segments: pts.map(q => [num(q[0]), num(q[1])]), closed: !!n.closed });
        if (n.cap) p.data.cap = n.cap;
        return [p];
      }
      case 'polygon': {
        const sides = Math.max(3, Math.round(num(n.sides, 6)));
        const cx = num(n.cx, C), cy = num(n.cy, C), r = num(n.r, 6), rot = num(n.rotation);
        const inner = n.star ? num(n.star.inner, r / 2) : null;
        const count = inner != null ? sides * 2 : sides;
        const segs = [];
        for (let i = 0; i < count; i++) {
          const ang = (rot - 90 + (i * 360) / count) * Math.PI / 180;
          const rad = inner != null && i % 2 ? inner : r;
          segs.push([cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)]);
        }
        return [new paper.Path({ segments: segs, closed: true })];
      }
      case 'arc': {
        // angles in degrees, 0 = 12 o'clock, clockwise (y-down screen space)
        const cx = num(n.cx, C), cy = num(n.cy, C), r = Math.abs(num(n.r, 6));
        let s = num(n.start), e = num(n.end, 90);
        if (e < s) e += 360;
        if (e - s >= 359.999) return [new paper.Path.Circle({ center: [cx, cy], radius: r })];
        const at = d => { const a = (d - 90) * Math.PI / 180; return P(cx + r * Math.cos(a), cy + r * Math.sin(a)); };
        const p = new paper.Path.Arc(at(s), at((s + e) / 2), at(e));
        if (n.cap) p.data.cap = n.cap;
        return [p];
      }
      case 'path': {
        if (!n.d || typeof n.d !== 'string') return [];
        let cp;
        try { cp = new paper.CompoundPath(n.d); } catch (err) { return []; }
        const kids = cp.children.slice().map(k => k.clone());
        kids.forEach(k => { if (n.cap && !k.closed) k.data.cap = n.cap; });
        return kids;
      }
      default: return [];
    }
  }

  // ---------- deformers (non-destructive, applied in order on the shape's paper paths) ----------
  function boundsOf(items) {
    let b = null;
    for (const it of items) { const ib = it.bounds; b = b ? b.unite(ib) : ib.clone(); }
    return b;
  }
  function mapSegments(items, fn) {
    for (const it of items) for (const s of it.segments) {
      const p = s.point.clone();
      const hi = p.add(s.handleIn), ho = p.add(s.handleOut);
      const np = fn(p), nhi = fn(hi), nho = fn(ho);
      s.point = np; s.handleIn = nhi.subtract(np); s.handleOut = nho.subtract(np);
    }
  }
  function taper(items, d) {
    const b = boundsOf(items);
    if (!b || b.width < EPS || b.height < EPS) return items;
    const cx = b.center.x, cy = b.center.y;
    mapSegments(items, p => {
      let x = p.x, y = p.y;
      const tt = (b.bottom - p.y) / b.height, tb = (p.y - b.top) / b.height;
      const tl = (b.right - p.x) / b.width, tr = (p.x - b.left) / b.width;
      const sx = 1 - (2 * num(d.top) / b.width) * tt - (2 * num(d.bottom) / b.width) * tb;
      const sy = 1 - (2 * num(d.left) / b.height) * tl - (2 * num(d.right) / b.height) * tr;
      x = cx + (p.x - cx) * sx; y = cy + (p.y - cy) * sy;
      return P(x, y);
    });
    return items;
  }
  function skew(items, d) {
    const b = boundsOf(items); if (!b) return items;
    const kx = Math.tan(num(d.x) * Math.PI / 180), ky = Math.tan(num(d.y) * Math.PI / 180);
    const c = b.center;
    mapSegments(items, p => P(p.x + kx * (p.y - c.y), p.y + ky * (p.x - c.x)));
    return items;
  }
  function roundCorners(items, d) {
    const r = Math.max(0, num(d.r));
    if (!r) return items;
    return items.map(it => {
      // only sharp corners (no handles on either side) are filleted; curved joins are left alone
      const segs = it.segments;
      const allStraight = segs.every(s => s.handleIn.isZero() && s.handleOut.isZero());
      if (allStraight) {
        const out = filletPath(segs.map(s => ({ p: s.point.clone(), r })), it.closed);
        out.data = Object.assign({}, it.data);
        return out;
      }
      return it;
    });
  }
  function offset(items, d) {
    const dist = num(d.d);
    if (!dist) return items;
    return items.map(it => {
      const curved = it.segments.some(s => !s.handleIn.isZero() || !s.handleOut.isZero());
      const src = it.clone();
      if (curved) src.flatten(0.02);
      const pts = src.segments.map(s => s.point);
      const n = pts.length; if (n < 2) return it;
      const closed = it.closed;
      // sign: positive offset grows a closed path outward
      const sgn = closed ? (it.clockwise ? 1 : -1) : 1;
      const normal = (a, b) => { const v = b.subtract(a).normalize(); return P(-v.y, v.x).multiply(-1); };
      const out = [];
      for (let i = 0; i < n; i++) {
        const hasPrev = closed || i > 0, hasNext = closed || i < n - 1;
        const nPrev = hasPrev ? normal(pts[(i - 1 + n) % n], pts[i]) : null;
        const nNext = hasNext ? normal(pts[i], pts[(i + 1) % n]) : null;
        let m;
        if (nPrev && nNext) {
          const sum = nPrev.add(nNext); const len = sum.length;
          if (len < 1e-6) m = nNext; else { const bis = sum.divide(len); const c = Math.max(0.25, bis.dot(nNext)); m = bis.divide(c); }
        } else m = nPrev || nNext;
        out.push(pts[i].add(m.multiply(dist * sgn)));
      }
      const p = new paper.Path({ segments: out, closed });
      if (curved) p.simplify(0.0025);
      p.data = Object.assign({}, it.data);
      return p;
    });
  }
  const DEFORMERS = { taper, skew, round: roundCorners, offset };

  // ---------- evaluation ----------
  // result: { closed: PathItem|null, open: Path[] }
  const EMPTY = () => ({ closed: null, open: [] });
  function closedOf(items) {
    const cl = items.filter(i => i.closed);
    if (!cl.length) return null;
    if (cl.length === 1) return cl[0];
    return uniteAll(cl);
  }
  function uniteAll(list) {
    let acc = null;
    for (const it of list) if (it && !isEmpty(it)) acc = acc ? acc.unite(it) : it;
    return acc;
  }
  function isEmpty(it) { return !it || (it.children ? it.children.length === 0 : it.segments.length === 0); }
  function openParts(item) {
    if (!item) return [];
    const list = item.children ? item.children.slice() : [item];
    return list.filter(p => p.segments && p.segments.length > 1).map(p => p.clone());
  }
  function evalShape(n) {
    let items = shapeItems(n);
    for (const d of n.deform || []) {
      const fn = DEFORMERS[d && d.type];
      if (fn && items.length) items = fn(items, d);
    }
    let closed = n.shape === 'path' && items.filter(item => item.closed).length > 1 ? null : closedOf(items);
    if (n.shape === 'path' && items.filter(item => item.closed).length > 1) {
      const compound = new paper.CompoundPath({ children: items.filter(item => item.closed).map(item => item.clone()), insert: false });
      compound.fillRule = n.fillRule === 'evenodd' ? 'evenodd' : 'nonzero';
      closed = compound.resolveCrossings().reorient(compound.fillRule === 'nonzero', true);
    }
    return { closed, open: items.filter(i => !i.closed) };
  }
  // ---------- non-destructive transform: { origin:[x,y], rotate, scaleX, scaleY, flipX, flipY } ----------
  // p' = origin + R(rotate) · S(scaleX·flipX, scaleY·flipY) · (p − origin). Without an origin, the centre of the
  // node's own (untransformed) bounds is used. Stroke weight is never scaled (it is applied at render time).
  function hasTransform(t) {
    return !!t && ((+t.rotate || 0) !== 0 || (t.scaleX != null && +t.scaleX !== 1) || (t.scaleY != null && +t.scaleY !== 1) || !!t.flipX || !!t.flipY);
  }
  function resultBounds(r) { const items = [].concat(r.closed ? [r.closed] : [], r.open); return items.length ? boundsOf(items) : null; }
  function transformMatrix(t, origin) {
    const o = t.origin && t.origin.length === 2 ? P(num(t.origin[0]), num(t.origin[1])) : origin || P(C, C);
    const sx = (t.scaleX == null ? 1 : num(t.scaleX, 1)) * (t.flipX ? -1 : 1);
    const sy = (t.scaleY == null ? 1 : num(t.scaleY, 1)) * (t.flipY ? -1 : 1);
    const a = num(t.rotate) * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
    // linear part A = R·S
    const A = [cs * sx, sn * sx, -sn * sy, cs * sy]; // paper order a,b,c,d : x' = a x + c y + tx ; y' = b x + d y + ty
    const tx = o.x - (A[0] * o.x + A[2] * o.y), ty = o.y - (A[1] * o.x + A[3] * o.y);
    return new paper.Matrix(A[0], A[1], A[2], A[3], tx, ty);
  }
  function applyMatrix(r, M) {
    if (r.closed) { r.closed = r.closed.clone(); r.closed.transform(M); }
    r.open = r.open.map(o => { const c = o.clone(); c.transform(M); c.data = Object.assign({}, o.data); return c; });
    return r;
  }
  /** Matrix of one node's own transform as [a,b,c,d,tx,ty] (identity if none). */
  function nodeMatrix(n) {
    if (!n || !hasTransform(n.transform)) return [1, 0, 0, 1, 0, 0];
    let o = null;
    if (!(n.transform.origin && n.transform.origin.length === 2)) { const b = resultBounds(evalRaw(n)); o = b ? b.center : null; }
    const M = transformMatrix(n.transform, o);
    return [M.a, M.b, M.c, M.d, M.tx, M.ty];
  }
  /** Untransformed bounds of a node's own geometry (in its parent's space) as [x,y,w,h]. */
  function rawBounds(n) { const b = resultBounds(evalRaw(n)); return b ? [b.x, b.y, b.width, b.height] : null; }
  function evalNode(n) {
    if (!n || n.hidden) return EMPTY();
    let r = evalRaw(n);
    if (n.symmetry && n.symmetry !== false && (n.symmetry.mirror || (n.symmetry.rotate || 1) > 1)) r = applySym(r, n.symmetry);
    if (hasTransform(n.transform)) {
      const b = n.transform.origin ? null : resultBounds(r);
      applyMatrix(r, transformMatrix(n.transform, b ? b.center : null));
    }
    return r;
  }
  // ---------- fillet: round the sharp corners of a boolean result ----------
  // Every vertex whose tangent turns by more than ~6 deg gets a circular-ish blend of radius r (clamped to
  // 45% of each neighbouring curve, so short edges never invert). Works on curved results (arc meets arc).
  function filletCurves(path, r) {
    const n = path.segments.length, closed = path.closed;
    if (n < 2) return path.clone();
    const curves = path.curves, m = curves.length;
    const inC = i => closed ? curves[(i - 1 + m) % m] : (i > 0 ? curves[i - 1] : null);
    const outC = i => closed ? curves[i % m] : (i < m ? curves[i] : null);
    const corner = [];
    for (let i = 0; i < n; i++) {
      const a = inC(i), b = outC(i);
      if (!a || !b) { corner.push(null); continue; }
      const t1 = a.getTangentAtTime(1), t2 = b.getTangentAtTime(0);
      if (t1.isZero() || t2.isZero()) { corner.push(null); continue; }
      const phi = Math.abs(t1.getDirectedAngle(t2)) * Math.PI / 180;
      if (phi < 0.1 || phi > Math.PI - 0.05) { corner.push(null); continue; }
      const ri = Array.isArray(r) ? r[i] : r;
      if (!(ri > 0)) { corner.push(null); continue; }
      const d = Math.min(ri * Math.tan(phi / 2), a.length * 0.45, b.length * 0.45);
      corner.push(d > 1e-3 ? { d, phi } : null);
    }
    const parts = curves.map((c, i) => {
      const s0 = corner[i], s1 = corner[(i + 1) % n];
      const t0 = s0 ? c.getTimeAt(s0.d) : 0, t1 = s1 ? c.getTimeAt(c.length - s1.d) : 1;
      return c.getPart(t0 == null ? 0 : t0, t1 == null ? 1 : t1);
    });
    const segs = [];
    for (let i = 0; i < n; i++) {
      const prev = closed ? parts[(i - 1 + m) % m] : (i > 0 ? parts[i - 1] : null);
      const cur = closed ? parts[i % m] : (i < m ? parts[i] : null);
      const k = corner[i];
      if (k && prev && cur) {
        const reff = k.d / Math.tan(k.phi / 2), h = (4 / 3) * Math.tan(k.phi / 4) * reff;
        const ta = prev.getTangentAtTime(1).normalize(h), tb = cur.getTangentAtTime(0).normalize(h);
        segs.push(new paper.Segment(prev.point2, prev.handle2, ta));
        segs.push(new paper.Segment(cur.point1, tb.multiply(-1), cur.handle1));
      } else {
        const pt = cur ? cur.point1 : prev.point2;
        segs.push(new paper.Segment(pt, prev ? prev.handle2 : null, cur ? cur.handle1 : null));
      }
    }
    const out = new paper.Path({ segments: segs, closed, insert: false });
    out.data = Object.assign({}, path.data);
    return out;
  }
  function fillet(item, r) {
    if (item.children) return new paper.CompoundPath({ children: item.children.map(p => filletCurves(p, r)), insert: false, fillRule: 'nonzero' });
    return filletCurves(item, r);
  }
  function evalRaw(n) {
    if (!n || n.hidden) return EMPTY();
    if (n.shape) return evalShape(n);
    const kids = (n.children || []).map(evalNode);
    if (!kids.length) return EMPTY();
    switch (n.op) {
      case 'subtract': {
        // Cutters are children[1..]. A cutter with edge:'open' is a clearance cutter: it removes outline
        // without drawing its own boundary (the closed result is opened into stroked segments).
        const kidsC = kids.slice(1), nodesC = n.children.slice(1);
        const cutter = uniteAll(kidsC.filter((k, i) => nodesC[i].edge !== 'open').map(k => k.closed));
        const clear = uniteAll(kidsC.filter((k, i) => nodesC[i].edge === 'open').map(k => k.closed));
        const subj = kids[0];
        let closed = subj.closed ? (cutter ? subj.closed.subtract(cutter) : subj.closed) : null;
        if (isEmpty(closed)) closed = null;
        if (closed && +n.fillet > 0) closed = fillet(closed, +n.fillet);
        let open = [];
        for (const p of subj.open) {
          const cap = p.data.cap;
          for (const q of cutter ? openParts(p.subtract(cutter, { trace: false })) : [p.clone()]) { if (cap) q.data.cap = cap; open.push(q); }
        }
        if (clear) {
          const outline = closed ? (closed.children ? closed.children.slice() : [closed]) : [];
          const trimmed = [];
          for (const p0 of outline) {
            // open the loop first (trace:false on a closed path is ambiguous in paper.js); joinOpen re-welds the seam
            const p = p0.clone(); p.closed = false; p.add(new paper.Segment(p0.firstSegment.point, p0.firstSegment.handleIn, null));
            for (const q of openParts(p.subtract(clear, { trace: false }))) { if (n.cap) q.data.cap = n.cap; trimmed.push(q); }
          }
          for (const p of open) { const cap = p.data.cap; for (const q of openParts(p.subtract(clear, { trace: false }))) { if (cap) q.data.cap = cap; trimmed.push(q); } }
          return { closed: null, open: trimmed };
        }
        return { closed, open };
      }
      case 'intersect': {
        const subj = kids[0];
        let mask = null;
        for (const k of kids.slice(1)) if (k.closed) mask = mask ? mask.intersect(k.closed) : k.closed;
        if (!mask) return subj;
        const closed = subj.closed ? subj.closed.intersect(mask) : null;
        const open = [];
        for (const p of subj.open) { const cap = p.data.cap; for (const q of openParts(p.intersect(mask, { trace: false }))) { if (cap) q.data.cap = cap; open.push(q); } }
        return { closed: isEmpty(closed) ? null : closed, open };
      }
      case 'compound': {
        // One filled outline made of subpaths, like an SVG <path> with several M…Z runs: holes come from
        // winding (fillRule 'nonzero', the default) or parity ('evenodd'). Each child keeps its own drawn
        // direction, so an imported counter stays a counter while its anchors are edited. Open children
        // are closed implicitly, as SVG fill does.
        const subs = [];
        for (const k of kids) {
          if (k.closed) for (const p of (k.closed.children ? k.closed.children : [k.closed])) subs.push(p.clone());
          for (const o of k.open) { const c = o.clone(); c.closed = true; subs.push(c); }
        }
        if (!subs.length) return EMPTY();
        const cp = new paper.CompoundPath({ children: subs, insert: false });
        cp.fillRule = n.fillRule === 'evenodd' ? 'evenodd' : 'nonzero';
        const res = cp.resolveCrossings().reorient(cp.fillRule === 'nonzero', true);
        return { closed: isEmpty(res) ? null : res, open: [] };
      }
      case 'exclude': {
        let acc = null;
        for (const k of kids) if (k.closed) acc = acc ? acc.exclude(k.closed) : k.closed;
        return { closed: acc, open: kids.flatMap(k => k.open) };
      }
      case 'union':
      default:
        return { closed: uniteAll(kids.map(k => k.closed)), open: kids.flatMap(k => k.open) };
    }
  }

  // ---------- symmetry ----------
  function symmetryGroup(sym) {
    const rotations = Math.max(1, Math.min(32, Math.round(Number(sym?.rotate) || 1)));
    const mirror = sym?.mirror;
    // Two perpendicular mirrors add a half-turn. For odd rotation counts the closure has 2n rotations.
    const count = mirror === 'xy' && rotations % 2 ? rotations * 2 : rotations;
    const out = [];
    const reflection = mirror === 'y' ? [1, 0, 0, -1] : [-1, 0, 0, 1];
    for (let i = 0; i < count; i++) {
      const angle = 2 * Math.PI * i / count;
      const c = Math.abs(Math.cos(angle)) < 1e-12 ? 0 : Math.cos(angle);
      const v = Math.abs(Math.sin(angle)) < 1e-12 ? 0 : Math.sin(angle);
      out.push([c, -v, v, c]);
    }
    if (mirror) for (const [a, b, c, d] of out.slice()) out.push([a * reflection[0], b * reflection[3], c * reflection[0], d * reflection[3]]);
    return out;
  }
  const toMatrix = T => new paper.Matrix(T[0], T[2], T[1], T[3], C - C * T[0] - C * T[1], C - C * T[2] - C * T[3]);
  // The symmetry axis: a line through (x, y) whose direction is 'angle' degrees clockwise from vertical
  // (default: the vertical centre line). mirror 'x' reflects across that line, 'y' across its perpendicular,
  // rotate n turns about (x, y).
  function axisOf(sym) { const a = (sym && sym.axis) || {}; return { x: num(a.x, C), y: num(a.y, C), angle: num(a.angle, 0) }; }
  function axisFrame(sym) { const a = axisOf(sym); return new paper.Matrix().translate(a.x, a.y).rotate(a.angle); }
  function symMatrices(sym) {
    const F = axisFrame(sym), Fi = F.inverted();
    return symmetryGroup(sym).map(T => F.clone().append(new paper.Matrix(T[0], T[2], T[1], T[3], 0, 0)).append(Fi));
  }
  /** Symmetry images as [a,b,c,d,tx,ty] (identity first). */
  function symmetryMatrices(sym) { return symMatrices(sym).map(M => [M.a, M.b, M.c, M.d, M.tx, M.ty]); }
  // draw-half: the drawn geometry is clipped to one side of the axis (the side holding most of it) before it
  // is mirrored, so the two halves meet exactly on the axis and unite without a seam or a doubled sliver.
  function halfRegion(sym, closed, open) {
    const L = 1000, F = axisFrame(sym), m = sym.mirror;
    const sides = m === 'xy' ? [[-L, -L], [0, -L], [0, 0], [-L, 0]].map(([x, y]) => [x, y, L, L])
      : m === 'y' ? [[-L, -L, 2 * L, L], [-L, 0, 2 * L, L]] : [[-L, -L, L, 2 * L], [0, -L, L, 2 * L]];
    const regions = sides.map(([x, y, w, h]) => { const r = new paper.Path.Rectangle({ point: [x, y], size: [w, h], insert: false }); r.transform(F); return r; });
    const score = rg => {
      if (closed) { const i = closed.intersect(rg); return Math.abs(i.area || 0); }
      return open.reduce((t, o) => t + clipOpen(o, rg).reduce((u, q) => u + q.length, 0), 0);
    };
    let best = regions[0], bs = -1;
    for (const rg of regions) { const v = score(rg); if (v > bs + 1e-6) { bs = v; best = rg; } }
    return best;
  }
  function clipOpen(o, region) {
    const r = o.intersect(region, { trace: false });
    const parts = (r.children ? r.children.slice() : [r]).filter(q => q.segments && q.segments.length > 1 && q.length > 1e-4);
    parts.forEach(q => { q.data = Object.assign({}, o.data); });
    return parts;
  }
  function applySym(base, sym) {
    const Ms = symMatrices(sym);
    if (Ms.length < 2) return base;
    let closed = base.closed, open = base.open;
    if (sym.half && sym.mirror) {
      const rg = halfRegion(sym, closed, open);
      if (closed) closed = closed.intersect(rg);
      open = open.flatMap(o => clipOpen(o, rg));
    }
    const cl = [], op = [];
    for (const M of Ms) {
      if (closed && !isEmpty(closed)) { const c = closed.clone(); c.transform(M); cl.push(c); }
      for (const o of open) { const c = o.clone(); c.transform(M); c.data.cap = o.data.cap; op.push(c); }
    }
    const u = uniteAll(cl);
    return { closed: u && !isEmpty(u) ? u : null, open: joinOpen(dedupeOpen(op)) };
  }
  // ---------- editing helpers: shape -> pen, insert an anchor on a segment ----------
  const r4 = v => Math.round(v * 10000) / 10000;
  function segsToPts(path) {
    return path.segments.map(sg => {
      const q = { x: r4(sg.point.x), y: r4(sg.point.y) };
      if (!sg.handleIn.isZero()) q.in = [r4(sg.handleIn.x), r4(sg.handleIn.y)];
      if (!sg.handleOut.isZero()) q.out = [r4(sg.handleOut.x), r4(sg.handleOut.y)];
      return q;
    });
  }
  /** Converts a primitive into an editable pen node in place (same transform, role and cutter edge; from: <shape>). */
  function toPen(n) {
    if (!n || !n.shape) return null;
    if (n.shape === 'pen' && !(n.deform?.length) && !(n.pts || []).some(point => point.r > 0)) return JSON.parse(JSON.stringify(n));
    const keep = {};
    for (const key of ['name', 'transform', 'symmetry', 'edge', 'cap', 'hidden', 'fillRule']) if (n[key] != null) keep[key] = JSON.parse(JSON.stringify(n[key]));
    // Bake the visible local geometry once; deformers and parametric radii must not run again afterward.
    let items = shapeItems(n);
    for (const deformer of n.deform || []) if (DEFORMERS[deformer.type]) items = DEFORMERS[deformer.type](items, deformer);
    if (!items.length) return null;
    const children = items.map(path => ({ shape: 'pen', closed: path.closed, pts: segsToPts(path), ...(n.cap ? { cap: n.cap } : {}) }));
    if (children.length === 1) return Object.assign(children[0], { from: n.shape }, keep);
    // Keep counters together, even when the same SVG also includes open strokes.
    const closed = children.filter(path => path.closed), open = children.filter(path => !path.closed);
    if (!open.length) return Object.assign({ op: 'compound', children, from: n.shape }, keep);
    const combined = closed.length > 1 ? [{ op: 'compound', children: closed, ...(n.fillRule ? { fillRule: n.fillRule } : {}) }, ...open] : children;
    return Object.assign({ op: 'union', children: combined, from: n.shape }, keep);
  }
  /** Inserts an anchor on a pen node's nearest segment to (x, y) (node-local units). Returns { node, index, dist } or null. */
  function insertPoint(n, x, y) {
    const pts = (n.pts || []); if (pts.length < 2) return null;
    const h = v => (Array.isArray(v) ? P(v[0], v[1]) : null);
    const path = new paper.Path({ segments: pts.map(q => new paper.Segment(P(q.x, q.y), h(q.in), h(q.out))), closed: !!n.closed, insert: false });
    const loc = path.getNearestLocation(P(x, y)); if (!loc) return null;
    const ci = loc.curve.index, t = loc.time;
    if (t < 1e-3 || t > 1 - 1e-3) return null;
    loc.curve.divideAtTime(t);
    const out = segsToPts(path);
    const at = ci + 1;
    out.forEach((q, j) => { const src = j < at ? pts[j] : j > at ? pts[j - 1] : null; if (src && src.r) q.r = src.r; });
    const node = JSON.parse(JSON.stringify(n)); node.pts = out;
    return { node, index: at, dist: loc.point.getDistance(P(x, y)) };
  }
  const round3 = v => Math.round(v * 1000) / 1000;
  function pathKey(p) { return p.curves.map(curve => curve.values.map(round3).join(',')).join(' '); }
  function dedupeOpen(paths) {
    const seen = new Set(), out = [];
    for (const p of paths) {
      const k = pathKey(p), r = p.clone(); r.reverse(); const kr = pathKey(r);
      if (seen.has(k) || seen.has(kr)) continue;
      seen.add(k); out.push(p);
    }
    return out;
  }
  function joinOpen(paths, tol = 1e-3) {
    const list = paths.slice();
    let changed = true;
    while (changed) {
      changed = false;
      outer: for (let i = 0; i < list.length; i++) for (let j = 0; j < list.length; j++) {
        if (i === j) continue;
        const a = list[i], b = list[j];
        if (a.closed || b.closed || (a.data.cap || '') !== (b.data.cap || '')) continue;
        const ends = [a.firstSegment.point, a.lastSegment.point], bends = [b.firstSegment.point, b.lastSegment.point];
        if (ends.some(e => bends.some(f => e.isClose(f, tol)))) {
          const cap = a.data.cap;
          a.join(b, tol);
          if (cap) a.data.cap = cap;
          list.splice(j, 1);
          changed = true;
          break outer;
        }
      }
    }
    for (const p of list) {
      if (!p.closed && p.segments.length > 2 && p.firstSegment.point.isClose(p.lastSegment.point, tol)) {
        const last = p.lastSegment; p.firstSegment.handleIn = last.handleIn.clone(); last.remove(); p.closed = true;
      }
    }
    return list;
  }

  function evalLayer(layer, glyph) {
    const base = evalNode(layer.node);
    const rounding = Math.max(0, num(glyph.setStyle?.rounding));
    if (rounding > 0) {
      if (base.closed) base.closed = fillet(base.closed, rounding);
      base.open = base.open.map(path => filletCurves(path, rounding));
    }
    const useSym = layer.symmetry !== false;
    let closed = base.closed, open = base.open;
    if (useSym && glyph.symmetry && symmetryGroup(glyph.symmetry).length > 1) ({ closed, open } = applySym(base, glyph.symmetry));
    open = joinOpen(open);
    return { closed: isEmpty(closed) ? null : closed, open };
  }

  // ---------- path data ----------
  const fmt = v => { const s = (Math.round(v * 1000) / 1000).toString(); return s === '-0' ? '0' : s; };
  function itemD(item) {
    if (!item) return '';
    const paths = item.children ? item.children : [item];
    let d = '';
    for (const p of paths) {
      const segs = p.segments; if (!segs.length) continue;
      d += 'M' + fmt(segs[0].point.x) + ' ' + fmt(segs[0].point.y);
      const n = segs.length, m = p.closed ? n : n - 1;
      for (let i = 0; i < m; i++) {
        const a = segs[i], b = segs[(i + 1) % n];
        if (a.handleOut.isZero() && b.handleIn.isZero()) d += 'L' + fmt(b.point.x) + ' ' + fmt(b.point.y);
        else {
          const c1 = a.point.add(a.handleOut), c2 = b.point.add(b.handleIn);
          d += 'C' + [c1.x, c1.y, c2.x, c2.y, b.point.x, b.point.y].map(fmt).join(' ');
        }
      }
      if (p.closed) d += 'Z';
    }
    return d;
  }

  /** Resolve every layer to path data. Returns [{ id, name, role, paint, opacity, visible, d, parts:[{d, cap}] }]. */
  function resolve(glyph) {
    return (glyph.layers || []).map(layer => {
      let r;
      try { r = evalLayer(layer, glyph); } catch (err) { r = { closed: null, open: [], error: String(err && err.message || err) }; }
      const parts = [];
      const closedD = itemD(r.closed);
      const plain = r.open.filter(p => !p.data.cap).map(itemD).join('');
      if (closedD || plain) parts.push({ d: closedD + plain, cap: null });
      const byCap = {};
      for (const p of r.open) if (p.data.cap) (byCap[p.data.cap] = byCap[p.data.cap] || []).push(itemD(p));
      for (const cap in byCap) parts.push({ d: byCap[cap].join(''), cap });
      return {
        id: layer.id, name: layer.name, role: layer.role || 'primary', paint: layer.paint || 'stroke', color: layer.color || null,
        opacity: layer.opacity == null ? 1 : layer.opacity, visible: layer.visible !== false,
        d: parts.map(p => p.d).join(''), parts, error: r.error || null,
      };
    });
  }

  // ---------- pixel hinting (preview only) ----------
  function hintD(d, sizePx, weight, paint) {
    if (!d) return { d, weight };
    const s = sizePx / 24;
    const wpx = Math.max(1, Math.round(weight * s));
    const off = paint === 'fill' ? 0 : (wpx % 2 ? 0.5 : 0);
    const snap = v => (Math.round(v * s - off) + off) / s;
    let cp; try { cp = new paper.CompoundPath(d); } catch (e) { return { d, weight }; }
    for (const p of cp.children) for (const seg of p.segments) seg.point = P(snap(seg.point.x), snap(seg.point.y));
    return { d: itemD(cp), weight: wpx / s };
  }

  // ---------- SVG ----------
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function strokeStyle(glyph, opts = {}, partCap = null) {
    const rounded = num(glyph.setStyle?.rounding) > 0;
    return {
      cap: rounded ? 'round' : partCap || opts.cap || 'round',
      join: rounded ? 'round' : opts.join || 'round',
      runtimeCap: rounded ? 'round' : partCap || 'var(--icon-stroke-linecap,round)',
      runtimeJoin: rounded ? 'round' : 'var(--icon-stroke-linejoin,round)',
    };
  }
  /**
   * opts.mode 'runtime' (default): stroke width / cap / join and role colours use CSS vars.
   * Positive set rounding overrides caps and joins with round in every output mode.
   * opts.mode 'baked': numbers inlined (for rasterising in tools that lack CSS — resvg).
   */
  function toSVG(glyph, opts = {}) {
    const mode = opts.mode || 'runtime';
    const weight = opts.weight != null ? opts.weight : (glyph.setStyle?.thickness ?? glyph.weight ?? 1.2);
    const layers = opts.resolved || resolve(glyph);
    const colours = Object.assign({}, ROLE_DEFAULTS, opts.colors || {});
    const body = [];
    for (const L of layers) {
      if (!L.visible || !L.d) continue;
      const col = L.color || (mode === 'baked' ? (opts.mono ? '#000' : colours[L.role] || '#000') : ROLE_VARS[L.role] || 'currentColor');
      for (const part of L.parts) {
        const stroke = L.paint === 'stroke' || L.paint === 'both';
        const fill = L.paint === 'fill' || L.paint === 'both';
        const a = [`d="${part.d}"`];
        a.push(`fill="${fill ? col : 'none'}"`);
        if (fill) a.push('fill-rule="nonzero"');
        if (stroke) {
          a.push(`stroke="${col}"`);
          const style = strokeStyle(glyph, opts, part.cap);
          if (mode === 'baked') a.push(`stroke-width="${weight}" stroke-linecap="${style.cap}" stroke-linejoin="${style.join}"`);
          else a.push(`style="stroke-width:var(--icon-stroke-width,${glyph.setStyle?.thickness ?? glyph.weight ?? 1.2});stroke-linecap:${style.runtimeCap};stroke-linejoin:${style.runtimeJoin}"`);
        }
        if (L.opacity !== 1) a.push(`opacity="${L.opacity}"`);
        if (mode === 'runtime') a.push(`data-layer="${esc(L.id)}" data-role="${L.role}"`);
        body.push(`<path ${a.join(' ')}/>`);
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${opts.size || glyph.exportSize || 24}" height="${opts.size || glyph.exportSize || 24}"${glyph.name ? ` data-icon="${esc(glyph.name)}"` : ''}>${body.join('')}</svg>`;
  }

  // ---------- stats ----------
  function walk(n, f) { if (!n) return; f(n); (n.children || []).forEach(c => walk(c, f)); }
  function stats(glyph) {
    let nodes = 0, shapes = 0, paths = 0, ops = 0, deformers = 0;
    for (const L of glyph.layers || []) walk(L.node, n => { nodes++; if (n.shape) { shapes++; if (n.shape === 'path') paths++; deformers += (n.deform || []).length; } else ops++; });
    return { layers: (glyph.layers || []).length, nodes, shapes, ops, paths, deformers };
  }

  /** Raw form geometry of one node (after its deformers / booleans, before symmetry) — for canvas guides and hit-testing. */
  function form(node, ancestors) {
    const r = evalNode(node);
    for (const a of (ancestors || []).slice().reverse()) { const m = nodeMatrix(a); if (m.join() !== '1,0,0,1,0,0') applyMatrix(r, new paper.Matrix(m[0], m[1], m[2], m[3], m[4], m[5])); }
    return { closed: r.closed, open: r.open, d: itemD(r.closed) + r.open.map(itemD).join('') };
  }
  function translateD(d, dx, dy) { const cp = new paper.CompoundPath(d); cp.translate(P(dx, dy)); return itemD(cp); }

  return { resolve, toSVG, strokeStyle, form, translateD, nodeMatrix, rawBounds, hasTransform, hintD, symmetryGroup, symmetryMatrices, axisOf, toPen, insertPoint, evalNode, stats, ROLE_VARS, ROLE_DEFAULTS, itemD, shapeItems, version: 1 };
}
