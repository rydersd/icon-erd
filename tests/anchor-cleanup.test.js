import test from 'node:test';import assert from 'node:assert/strict';import paper from 'paper';
import {cleanupAnchors} from '../src/anchor-cleanup.js';import {mergeAnchorCorners} from '../src/anchor-corner.js';
new paper.Project();const identity=[1,0,0,1,0,0];
test('cleanup removes selected redundant anchors, retaining endpoints, unselected points and sharp corners',()=>{
 const n={shape:'pen',pts:[{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:3,y:0},{x:3,y:3},{x:4,y:3}]};const untouched=structuredClone(n.pts[2]);
 const result=cleanupAnchors(n,[1,3,4],identity);assert.equal(result.removed,1);assert.deepEqual(n.pts[1],untouched);assert.ok(n.pts.some(p=>p.x===3&&p.y===0));assert.ok(n.pts.some(p=>p.x===3&&p.y===3));assert.equal(result.indexMap[1],-1);
});
test('cleanup refits sampled curves within the global drawing-plane tolerance and preserves tags',()=>{
 const pts=Array.from({length:21},(_,i)=>({x:i/2,y:Math.sin(i/20)*2}));const n={shape:'pen',pts,roundingAnchors:[10]};const result=cleanupAnchors(n,pts.map((_,i)=>i),identity,0.03);assert.ok(result.removed>5);assert.ok(n.roundingAnchors[0]>=0);assert.deepEqual(n.pts[n.roundingAnchors[0]],pts[10]);
 const path=new paper.Path({insert:false,segments:n.pts.map(p=>new paper.Segment([p.x,p.y],p.in,p.out))});for(const p of pts)assert.ok(path.getNearestPoint([p.x,p.y]).getDistance([p.x,p.y])<=0.03);path.remove();
});
test('merge to corner reconstructs the edge intersection instead of averaging the rounded cluster',()=>{
 const n={shape:'pen',pts:[{x:0,y:0},{x:3.8,y:0},{x:3.95,y:0.05},{x:4,y:0.2},{x:4,y:4}],roundingAnchors:[2]};const result=mergeAnchorCorners(n,[1,2,3]);assert.equal(result.merged,2);assert.equal(n.pts.length,3);assert.equal(n.pts[1].x,4);assert.equal(n.pts[1].y,0);assert.deepEqual(n.pts[0],{x:0,y:0});assert.deepEqual(n.pts[2],{x:4,y:4});assert.deepEqual(n.roundingAnchors,[1]);
});
test('corner merge preserves closed seam ordering and refuses whole-path collapse or isolated points',()=>{
 const n={shape:'pen',closed:true,pts:[{x:0,y:0.1},{x:0,y:3},{x:3,y:3},{x:3,y:0},{x:0.1,y:0}]};const r=mergeAnchorCorners(n,[4,0]);assert.equal(r.merged,1);assert.deepEqual(r.indexMap,[0,1,2,3,0]);assert.ok(Math.abs(n.pts[0].x)<1e-10);assert.ok(Math.abs(n.pts[0].y)<1e-10);assert.equal(mergeAnchorCorners(n,[0,1,2,3]).merged,0);assert.equal(mergeAnchorCorners(n,[1,3]).merged,0);
});
