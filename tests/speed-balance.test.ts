import test from 'node:test';import assert from 'node:assert/strict';
import {Race} from '../src/race';import {Track} from '../src/track';import {CONFIG,emptyInput} from '../src/config';
const body={...emptyInput(),throttle:1,actionControl:true};

test('the player reaches a faster cruise and a single shoulder burst provides a useful passing speed',()=>{
 const r=new Race(new Track('meadow'));r.phase='racing';r.cars.slice(1).forEach(c=>c.finishTime=0);
 for(let i=0;i<60*4;i++)r.tick(1/60,body);
 const cruise=r.cars[0].speed*3.6;assert.ok(cruise>115,`Cruise ${cruise} km/h`);
 let peak=cruise;r.tick(1/60,{...body,boost:true});
 for(let i=0;i<60;i++){r.tick(1/60,{...body,boost:true});peak=Math.max(peak,r.cars[0].speed*3.6);}
 assert.ok(peak>150,`Passing peak ${peak} km/h`);assert.ok(peak>cruise+20);
 assert.ok(peak<=CONFIG.casual.nitroSpeed*3.6*1.05);assert.equal(r.cars[0].nitroEvents,1);
});

test('companions at every pace stay near normal no-gesture driving on either new route',()=>{
 for(const id of ['meadow','lakeside'] as const)for(const pace of ['easy','normal','hard'] as const)for(const seed of [1,7,29]){
  const r=new Race(new Track(id));r.reset(pace,seed);r.phase='racing';let maximumLead=0,hits=0;const passed=new Set<number>();
  for(let i=0;i<60*300&&r.phase==='racing';i++){
   r.tick(1/60,body);const c=r.cars[0];
   maximumLead=Math.max(maximumLead,...r.cars.slice(1).map(o=>o.progress-c.progress));
   for(const o of r.cars.slice(1))if(c.progress>o.progress+3)passed.add(o.id);
   hits+=r.events.filter(e=>e.id===0&&e.type==='hit').length;
  }
  assert.equal(r.cars[0].lap,3,`${id}/${pace}/${seed}`);
  assert.ok(maximumLead<75,`${id}/${pace}/${seed}: lead ${maximumLead} m`);
  assert.ok(passed.size>=4,`${id}/${pace}/${seed}: passed ${passed.size}`);
  assert.equal(hits,0);assert.equal(r.cars[0].recoveries,0);
 }
});
