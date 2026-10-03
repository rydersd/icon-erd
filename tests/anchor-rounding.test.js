import test from 'node:test';
import assert from 'node:assert/strict';
import paper from 'paper';
import {createGlyphCore} from '../src/glyph-core.js';
import {roundableAnchor} from '../src/anchor-rounding.js';
import {anchorMarker} from '../src/anchor-marker.js';
new paper.Project();const core=createGlyphCore(paper);
test('roundable corner uses original curve tangents and retains broken handles',()=>{
 const n={shape:'pen',pts:[{x:2,y:2},{x:8,y:2,in:[-2,0],out:[0,2]},{x:8,y:8}]};
 const before=structuredClone(n);const geometry=roundableAnchor(n,1,core);assert.ok(geometry);assert.deepEqual(n,before);assert.ok(Math.abs(geometry.k-Math.SQRT2)<1e-8);
 n.pts[1].r=0.5;assert.equal(anchorMarker(n,1),'circle');assert.deepEqual(n.pts[1].in,[-2,0]);
 const path=core.shapeItems(n)[0];assert.ok(path.segments.length>3);assert.equal(path.firstSegment.point.x,2);assert.equal(path.lastSegment.point.y,8);
});
test('endpoints, straight-through smooth anchors and reversals cannot become fillet corners',()=>{
 const n={shape:'pen',pts:[{x:2,y:2},{x:8,y:2},{x:14,y:2}]};assert.equal(roundableAnchor(n,0,core),null);assert.equal(roundableAnchor(n,1,core),null);
 n.pts[2]={x:2,y:2};assert.equal(roundableAnchor(n,1,core),null);
});
