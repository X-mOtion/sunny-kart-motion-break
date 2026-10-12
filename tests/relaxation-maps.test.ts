import test from 'node:test';
import assert from 'node:assert/strict';
import {Track,TRACKS,validTrackId,resolveTrackId} from '../src/track';
import {Race} from '../src/race';
import {normalizeSettings} from '../src/settings';
import {emptyInput,wrapAngle,type InputFrame} from '../src/config';

const body:InputFrame={...emptyInput(),throttle:1,actionControl:true};

test('retired simple maps are removed; bookmarks/preferences migrate without reusing old times',()=>{
 assert.deepEqual(Object.keys(TRACKS),['meadow','lakeside','city']);
 assert.equal(validTrackId('boulevard'),false);assert.equal(validTrackId('garden'),false);
 assert.equal(resolveTrackId('boulevard'),'meadow');assert.equal(resolveTrackId('garden'),'lakeside');
 for(const [old,current] of [['boulevard','meadow'],['garden','lakeside']]){
  const s=normalizeSettings({trackId:old,mode:'pose',cameraId:'camera',sensitivity:1.2,music:0,effects:.4,casualVersion:1});
  assert.equal(s.trackId,current);assert.equal(s.mode,'pose');assert.equal(s.cameraId,'camera');assert.equal(s.sensitivity,1.2);assert.equal(s.music,0);
 }
 assert.equal(normalizeSettings(null).trackId,'meadow');
});

for(const id of ['meadow','lakeside'] as const){
 const track=new Track(id);
 test(`${id}: smooth closed road, safe three-lane projection, both bend directions and no overlapping branches`,()=>{
  let longest=0,run=0,maxCurve=0;const directions:number[]=[];
  for(let i=0;i<track.count*2;i++){
   const p=track.at(i*.5),k=track.curvature(p.s),next=track.at(p.s+.5);
   run=Math.abs(k)<.001?run+.5:0;longest=Math.max(longest,run);
   if(i>=track.count)continue;
   maxCurve=Math.max(maxCurve,Math.abs(k));
   if(Math.abs(k)>.003&&directions.at(-1)!==Math.sign(k))directions.push(Math.sign(k));
   assert.equal(p.width,18);assert.ok(Math.abs(Math.hypot(next.x-p.x,next.z-p.z)-.5)<.003);
   assert.ok(Math.abs(wrapAngle(next.yaw-p.yaw))<.009);
   for(const lane of [-4.6,0,4.6]){
    const q=track.nearest(p.x+p.nx*lane,p.z+p.nz*lane,p.s);assert.ok(Math.abs(q.lateral-lane)<.015);
   }
  }
  assert.ok(maxCurve<1/60,`${id}: minimum bend radius ${1/maxCurve}`);
  assert.ok(directions.includes(1)&&directions.includes(-1));
  assert.ok(longest>230,`Passing straight ${longest}`);
  assert.ok(directions.filter(d=>d===1).length>=3&&directions.filter(d=>d===-1).length>=3);
  assert.deepEqual(track.at(0),track.at(track.length));
  for(let i=0;i<track.count;i+=12)for(let j=i+12;j<track.count;j+=12){
   const separation=Math.min((j-i)*.5,track.length-(j-i)*.5);if(separation<40)continue;
   const a=track.points[i],b=track.points[j];assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>track.definition.width+4);
  }
 });
 test(`${id}: each sequence is acceleration, left lane, right lane, left turn, right turn with straight lane sections`,()=>{
  const count=id==='meadow'?3:4;
  assert.equal(track.sections[0].start,0);assert.equal(track.sections.at(-1)!.end,track.length);
  for(let i=1;i<track.sections.length;i++)assert.ok(Math.abs(track.sections[i].start-track.sections[i-1].end)<1e-8);
  for(let sequence=0;sequence<count;sequence++){
   const parts=track.sections.filter(p=>p.sequence===sequence&&p.action!=='recover');
   assert.deepEqual(parts.map(p=>p.action),['accelerate','lane-left','lane-right','turn-left','turn-right']);
   for(const p of parts){
    const k=track.curvature((p.start+p.end)/2);
    if(p.action==='turn-left')assert.ok(k>.005);
    else if(p.action==='turn-right')assert.ok(k<-.005);
    else assert.ok(Math.abs(k)<1e-7);
   }
   assert.equal(parts[1].lane,-1);assert.equal(parts[2].lane,0);
   assert.ok(parts[1].end-parts[1].start>50);assert.ok(parts[2].end-parts[2].start>50);
   const rest=track.sections.find(p=>p.sequence===sequence&&p.action==='recover'&&p.start>=parts[3].end&&p.end<=parts[4].start)!;
   assert.ok(rest.end-rest.start>25);
  }
  for(let s=-65;s<=35;s+=5)assert.ok(Math.abs(track.curvature(s))<1e-7,'Grid and opening acceleration must be straight');
 });
 test(`${id}: lane selection stays after straightening, shoulder turns preserve it, held shrug triggers once`,()=>{
  const r=new Race(track);r.phase='racing';const c=r.cars[0];
  r.tick(1/60,{...body,directionAction:1});for(let i=0;i<360;i++)r.tick(1/60,body);
  assert.equal(c.laneChoice,1);assert.ok(track.nearest(c.x,c.z,c.s).lateral>3);
  r.tick(1/60,{...body,turnAction:-1,boost:true});
  for(let i=0;i<120;i++)r.tick(1/60,{...body,boost:true});
  assert.equal(c.laneChoice,1);assert.equal(c.turnRemaining,0);assert.equal(c.nitroEvents,1);assert.equal(c.nitro,0);
 });
 test(`${id}: the exact five-action sequence repeats every lap and finishes safely`,()=>{
  const r=new Race(track);r.phase='racing';let previous='',hits=0;const actions:string[]=[];
  for(let i=0;i<60*300&&r.phase==='racing';i++){
   const c=r.cars[0],part=c.progress>=0?track.sections.find(p=>c.s>=p.start&&c.s<p.end):undefined;
   const key=part?`${c.lap}:${part.sequence}:${part.action}`:'grid',fresh=key!==previous;
   const input:InputFrame={...body};
   if(part&&fresh&&part.action!=='recover'){
    actions.push(part.action);
    if(part.action==='accelerate')input.boost=true;
    if(part.action==='lane-left')input.directionAction=-1;
    if(part.action==='lane-right')input.directionAction=1;
    if(part.action==='turn-left')input.turnAction=-1;
    if(part.action==='turn-right')input.turnAction=1;
   }
   previous=key;r.tick(1/60,input);hits+=r.events.filter(e=>e.id===0&&e.type==='hit').length;
  }
  const sets=(id==='meadow'?3:4)*3,expected=Array.from({length:sets},()=>['accelerate','lane-left','lane-right','turn-left','turn-right']).flat();
  assert.deepEqual(actions,expected);assert.equal(r.cars[0].lap,3);assert.equal(r.cars[0].laneChoice,0);
  assert.equal(r.cars[0].laneChanges,sets*2);assert.equal(r.cars[0].turnEvents,sets*2);assert.equal(r.cars[0].nitroEvents,sets);
  assert.equal(hits,0);assert.equal(r.cars[0].recoveries,0);assert.ok(r.time<300);
 });
 test(`${id}: neutral, mixed gestures and keyboard holds finish under five minutes without wall hits or recovery`,()=>{
  for(const style of ['neutral','actions','held-right'] as const){
   const r=new Race(track);r.reset('easy',7);r.phase='racing';let hits=0;
   for(let i=0;i<60*300&&r.phase==='racing';i++){
    const input:InputFrame=style==='neutral'?body:style==='held-right'?{...emptyInput(),throttle:1,steer:1}:
     {...body,directionAction:i%360===0?(i%1440<720?1:-1):0,turnAction:i%540===270?(i%1080<540?1:-1):0,boost:i%180===0};
    r.tick(1/60,input);hits+=r.events.filter(e=>e.id===0&&e.type==='hit').length;
   }
   const c=r.cars[0];assert.equal(c.lap,3,`${style}: ${JSON.stringify(r.snapshot())}`);
   assert.equal(hits,0,style);assert.equal(c.recoveries,0,style);assert.equal(c.penalty,0);assert.equal(c.lapTimes.length,3);
   if(style==='actions'){assert.ok(c.laneChanges>10);assert.ok(c.turnEvents>10);assert.ok(c.nitroEvents>10);}
  }
 });
 test(`${id}: all companions finish at every pace across fixed seeds`,()=>{
  for(const pace of ['easy','normal','hard'] as const)for(const seed of [1,29]){
   const r=new Race(track);r.reset(pace,seed);
   for(let i=0;i<60*300&&!r.cars.every(c=>c.finishTime!==null);i++){
    if(r.phase==='finished')r.phase='racing';r.tick(1/60,emptyInput(),true);
   }
   assert.ok(r.cars.every(c=>c.finishTime!==null),`${pace}/${seed}`);assert.ok(r.cars.every(c=>c.recoveries===0),`${pace}/${seed}`);
  }
 });
}
