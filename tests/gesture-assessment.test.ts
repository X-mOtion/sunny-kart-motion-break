import test from 'node:test';import assert from 'node:assert/strict';import {GestureAssessment} from '../src/gesture-assessment';
function run(s:GestureAssessment,expected:any,events:any[],tracking=true){s.begin(expected,0);for(let t=100;t<=2500;t+=100)s.observe(t,tracking,t===500?events:[]);}
test('gesture trials count correct, missed, wrong and repeated results separately',()=>{
 const s=new GestureAssessment();run(s,'left',['left']);run(s,'left',[]);run(s,'left',['turnLeft']);run(s,'left',['left','left']);const r=s.summary().rows[0];assert.equal(r.valid,4);assert.equal(r.correct,1);assert.equal(r.missed,1);assert.equal(r.wrong,1);assert.equal(r.repeated,1);assert.equal(r.accuracy,.25);
});
test('camera loss or inactive-tab timing invalidates a trial rather than improving accuracy',()=>{
 const s=new GestureAssessment();run(s,'boost',[],false);assert.equal(s.summary().valid,0);assert.equal(s.summary().rows[4].accuracy,null);s.begin('boost',0);s.observe(2500,true,['boost']);assert.equal(s.trials.at(-1)?.valid,false);
});
test('neutral check counts false actions over a full minute and cancellation makes no fake completed trial',()=>{
 const s=new GestureAssessment();s.begin('neutral',0);for(let t=100;t<=60000;t+=100)s.observe(t,true,t===1000?['boost']:[]);assert.equal(s.summary().rows[5].wrong,1);s.begin('left',61000);s.cancel();assert.equal(s.trials.length,1);s.reset();assert.equal(s.summary().total,0);
});
