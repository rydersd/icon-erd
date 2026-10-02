import test from 'node:test';
import assert from 'node:assert/strict';
import paper from 'paper/dist/paper-core.js';
import {createGlyphCore} from '../src/glyph-core.js';
import {regularEllipse} from '../src/regular-shape.js';
new paper.Project();const core=createGlyphCore(paper);
test('normalization produces parametric four-anchor ellipses while preserving winding, position and instance identity',()=>{
 const n=core.toPen({shape:'ellipse',cx:9.6,cy:7.8,rx:1.2,ry:0.8,clockwise:false});n.name='Eye';n.transform={rotate:30};n.component={id:'eye',name:'Eye',origin:[8.4,7],scale:1};
 const e=regularEllipse(n,core);assert.equal(e.shape,'ellipse');assert.ok(Math.abs(e.cx-9.6)<1e-9);assert.ok(Math.abs(e.cy-7.8)<1e-9);assert.deepEqual(e.component,n.component);assert.deepEqual(e.transform,n.transform);
 const paths=core.shapeItems(e);assert.equal(paths[0].segments.length,4);assert.equal(paths[0].clockwise,false);assert.equal(core.toPen(e).pts.length,4);
});
test('circles become four-anchor regular circles; open and multi-contour paths are not silently closed or discarded',()=>{
 const n=core.toPen({shape:'circle',cx:5,cy:5,r:2});const e=regularEllipse(n,core);assert.equal(e.shape,'circle');assert.equal(e.r,2);assert.equal(core.toPen(e).pts.length,4);
 assert.equal(regularEllipse({shape:'pen',closed:false,pts:[{x:0,y:0},{x:1,y:1}]},core),null);
 assert.equal(regularEllipse({op:'compound',children:[n,n]},core),null);
});
