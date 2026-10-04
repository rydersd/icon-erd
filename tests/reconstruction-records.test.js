import test from 'node:test';
import assert from 'node:assert/strict';
import {geometryIdentity,exampleState,learnedInset} from '../src/reconstruction-records.js';
const accepted={name:'test-outline',weight:1.2,layers:[{id:'x',node:{shape:'line',x1:0,y1:0,x2:1,y2:1}}]};
const example=(inset,intent='faithful')=>({schemaVersion:1,accepted,acceptedIdentity:geometryIdentity(accepted),group:'Shapes',intent,settings:{inset,stroke:1.2}});
test('local calibration uses only current accepted recoveries in the same group; renamed, edited and redesign examples do not contaminate it',()=>{
 const library=[accepted],source={group:'Shapes'};assert.equal(exampleState(example(.6),library),'current');
 const learned=learnedInset([example(.6),example(.8),example(99,'redesign')],library,source,2.4);assert.equal(learned.count,2);assert.ok(Math.abs(learned.inset-1.4)<1e-9);
 assert.equal(learnedInset([example(.6)],library,{group:'Other'},1.2),null);
 assert.equal(learnedInset([example(.6)],[{...accepted,weight:2}],source,1.2),null);
 assert.equal(exampleState(example(.6),[]),'superseded');
});
