import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeNearbyAnchors} from '../src/anchor-merge.js';
import {anchorMarker} from '../src/anchor-marker.js';
const identity=[1,0,0,1,0,0];
test('proximity merge averages neighbors and retains external broken handle vectors and tags',()=>{
 const n={shape:'pen',pts:[{x:0,y:0},{x:3,y:4,in:[-2,0],out:[0.01,0.02]},{x:3.1,y:4.2,in:[-0.01,-0.02],out:[0,-3]},{x:10,y:10}],roundingAnchors:[2]};
 const r=mergeNearbyAnchors(n,[1],identity,0.3);
 assert.equal(r.merged,1);assert.deepEqual(r.indexMap,[0,1,1,2]);assert.deepEqual(n.pts[1],{x:3.05,y:4.1,in:[-2,0],out:[0,-3]});assert.equal(anchorMarker(n,1),'diamond');assert.deepEqual(n.roundingAnchors,[1]);
});
test('smooth and sharp merged points retain their marker state; closed seams retain external handles',()=>{
 const n={shape:'pen',closed:true,pts:[{x:0,y:0,out:[2,0]},{x:10,y:0},{x:10,y:10},{x:0.1,y:0,in:[-3,0]}]};
 const r=mergeNearbyAnchors(n,[3],identity,0.2);assert.equal(r.merged,1);assert.deepEqual(n.pts[0],{x:0.05,y:0,in:[-3,0],out:[2,0]});assert.equal(anchorMarker(n,0),'circle');
 const sharp={shape:'pen',pts:[{x:0,y:0},{x:2,y:2},{x:2.1,y:2},{x:4,y:4}]};mergeNearbyAnchors(sharp,[1],identity,0.2);assert.equal(anchorMarker(sharp,1),'square');
});
test('merge threshold is in drawing-plane space, preserves minimum topology and does not collapse untouched or jointly moved points',()=>{
 const n={shape:'pen',pts:[{x:0,y:0},{x:1,y:1},{x:1.1,y:1},{x:4,y:4}]};
 assert.equal(mergeNearbyAnchors(n,[1],[3,0,0,3,0,0],0.2).merged,0);
 assert.equal(mergeNearbyAnchors(n,[1,2],identity,0.2).merged,0);
 assert.equal(mergeNearbyAnchors(n,[],identity,10).merged,0);
 const line={shape:'pen',pts:[{x:0,y:0},{x:0.1,y:0}]};assert.equal(mergeNearbyAnchors(line,[1],identity,1).merged,0);
});
