import test from 'node:test';
import assert from 'node:assert/strict';
import paper from 'paper';
import {createGlyphCore} from '../src/glyph-core.js';
import {cleanupDrawingAnchors} from '../src/corner-cleanup.js';
new paper.Project();const core=createGlyphCore(paper),identity=[1,0,0,1,0,0];
const rounded=()=>({shape:'pen',pts:[{x:0,y:0},{x:3,y:0,out:[0.55228475,0]},{x:4,y:1,in:[0,-0.55228475]},{x:4,y:5}]});
test('cleanup reconstructs a baked fillet as a single procedural corner at the edge intersection',()=>{
  const n=rounded(),ends=[structuredClone(n.pts[0]),structuredClone(n.pts[3])];
  const result=cleanupDrawingAnchors(n,[1,2],identity,core);
  assert.equal(result.removed,1);assert.equal(result.rounded,1);assert.equal(n.pts.length,3);
  assert.equal(n.pts[1].x,4);assert.equal(n.pts[1].y,0);assert.ok(Math.abs(n.pts[1].r-1)<1e-6);
  assert.deepEqual(n.pts[0],ends[0]);assert.deepEqual(n.pts[2],ends[1]);assert.deepEqual(result.indexMap,[0,1,1,2]);
});
test('cleanup retains a sharp junction beside a reconstructed rounded corner and works on whole-path selection',()=>{
  const n=rounded();n.pts.push({x:8,y:5});const sharp=structuredClone(n.pts[3]);
  const result=cleanupDrawingAnchors(n,[0,1,2,3,4],identity,core);
  assert.equal(result.rounded,1);assert.deepEqual(n.pts[result.indexMap[3]],sharp);assert.equal(n.pts[result.indexMap[3]].r,undefined);
});
test('cleanup merges duplicate sharp points without introducing rounding',()=>{
  const n={shape:'pen',pts:[{x:0,y:0},{x:4,y:0},{x:4,y:0},{x:4,y:4}]};
  const result=cleanupDrawingAnchors(n,[1,2],identity,core);
  assert.equal(result.removed,1);assert.equal(result.rounded,0);assert.equal(n.pts.length,3);assert.ok(!(n.pts[1].r>0));
});
test('cleanup refuses a noncircular curved cluster and retains explicit procedural radii',()=>{
  const n=rounded();n.pts[1].out=[0.1,0];n.pts[2].in=[0,-0.1];const before=structuredClone(n);
  assert.equal(cleanupDrawingAnchors(n,[1,2],identity,core).removed,0);assert.deepEqual(n,before);
  const procedural={shape:'pen',pts:[{x:0,y:0},{x:4,y:0,r:1},{x:4,y:5}]};const copy=structuredClone(procedural);
  assert.equal(cleanupDrawingAnchors(procedural,[0,1,2],identity,core).removed,0);assert.deepEqual(procedural,copy);
});
