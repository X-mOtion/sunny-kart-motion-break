import test from 'node:test';import assert from 'node:assert/strict';
import {Track} from '../src/track';import {Race} from '../src/race';import {CONFIG,emptyInput,wrapAngle} from '../src/config';import {PoseInput,type Landmark} from '../src/pose';
const track=new Track();
function run(r:Race,seconds:number,input=emptyInput(),auto=false){for(let i=0;i<seconds*60;i++)r.tick(1/60,input,auto);}
function racing(){const r=new Race(track);r.reset();r.phase='racing';return r;}
test('track wraps smoothly and projection stays on its local branch',()=>{assert.equal(track.length,1100);const p=track.at(349.5),q=track.nearest(p.x,p.z,p.s);assert.ok(Math.abs(q.s-p.s)<.1);assert.ok(Math.hypot(track.at(0).x-track.at(1100).x,track.at(0).z-track.at(1100).z)<.0001);});
test('countdown prevents movement and spending; pause freezes every racer and clock',()=>{const r=new Race(track);r.reset();const x=r.cars[0].x;r.cars[0].cards=1;run(r,2,{...emptyInput(),throttle:1,boost:true});assert.equal(r.cars[0].x,x);assert.equal(r.cars[0].cards,1);run(r,2,{...emptyInput(),throttle:1});r.pause();const state=JSON.stringify(r.snapshot());run(r,5,{...emptyInput(),throttle:1});assert.equal(JSON.stringify(r.snapshot()),state);});
test('nitro is edge-triggered, cannot stack or consume while active',()=>{const r=racing(),c=r.cars[0];c.cards=2;run(r,.1,{...emptyInput(),throttle:1,boost:true});assert.equal(c.cards,1);run(r,4,{...emptyInput(),throttle:1,boost:true});assert.equal(c.cards,1);run(r,.1,{...emptyInput(),throttle:1});run(r,.1,{...emptyInput(),throttle:1,boost:true});assert.equal(c.cards,0);assert.equal(c.nitroEvents,2);});
test('longer drift increases yaw tendency and valid release gives mini boost',()=>{const wide=new Track();wide.nearest=(x,z,h)=>({...wide.at(h??0),x,z,width:10000,lateral:0,distance:0});const r=new Race(wide),c=r.cars[0];c.speed=28;c.vx=Math.sin(c.yaw)*28;c.vz=Math.cos(c.yaw)*28;
 let early=0;for(let i=0;i<90;i++){r.drive(c,{steer:.65,throttle:1,brake:0,drift:true,boost:false},1/60);if(i===35)early=Math.abs(c.yawRate);}
 assert.ok(Math.abs(c.yawRate)>early);assert.ok(c.validDrift>.45);assert.ok(c.charge>0);r.drive(c,{...emptyInput(),throttle:1},1/60);assert.ok(c.mini>0);assert.equal(c.miniEvents,1);
 c.drifting=true;c.validDrift=1;r.cancelDrift(c);c.mini=0;r.drive(c,emptyInput(),1/60);assert.equal(c.mini,0);
});
test('full inventory cannot bank a hidden third nitro',()=>{const wide=new Track();wide.nearest=(x,z,h)=>({...wide.at(h??0),x,z,width:10000,lateral:0,distance:0});const r=new Race(wide),c=r.cars[0];c.cards=2;c.speed=25;c.vx=Math.sin(c.yaw)*25;c.vz=Math.cos(c.yaw)*25;for(let i=0;i<300;i++)r.drive(c,{steer:.7,throttle:1,brake:0,drift:true,boost:false},1/60);assert.equal(c.cards,2);assert.equal(c.charge,0);});
test('checkpoint order prevents reverse-line farming and skipped checkpoints',()=>{const r=racing(),c=r.cars[0];const place=(s:number)=>{const p=track.at(s);c.x=p.x;c.z=p.z;c.vx=p.tx*20;c.vz=p.tz*20;c.speed=20;};c.s=1099.8;c.progress=-.2;place(.2);r.updateProgress(c,1/60);assert.equal(c.nextGate,1100/24);assert.equal(c.lap,0);
 c.s=.2;c.progress=.2;place(1099.9);r.updateProgress(c,1/60);assert.equal(c.lap,0);
 c.s=1099.8;c.progress=1099.8;place(.2);r.updateProgress(c,1/60);assert.equal(c.lap,0);assert.equal(c.nextGate,1100/24);
});
test('casual recovery is free, preserves earned laps and never skips the next checkpoint',()=>{const r=racing(),c=r.cars[0];c.nextGate=1100+1100/24*4;c.lap=1;c.nitro=2;c.mini=.4;c.drifting=true;c.validDrift=2;r.respawn(c);assert.equal(c.penalty,0);assert.equal(c.lap,1);assert.ok(c.progress<c.nextGate);assert.equal(c.nitro,0);assert.equal(c.mini,0);assert.equal(c.drifting,false);});
test('restarting ten times leaves exactly six clean cars',()=>{const r=racing();for(let i=0;i<10;i++){run(r,1,{...emptyInput(),throttle:1});r.reset();assert.equal(r.cars.length,6);assert.equal(r.time,0);assert.ok(r.cars.every(c=>c.cards===0&&c.penalty===0&&c.lap===0&&c.finishTime===null));}});
test('wall collision contains high speed movement',()=>{const r=racing(),c=r.cars[0],p=track.at(50);c.x=p.x+p.nx*6;c.z=p.z+p.nz*6;c.s=50;c.progress=50;c.yaw=Math.atan2(p.nx,p.nz);c.speed=54;c.vx=p.nx*54;c.vz=p.nz*54;for(let i=0;i<40;i++)r.drive(c,{...emptyInput(),throttle:1},1/60);const q=track.nearest(c.x,c.z,c.s);assert.ok(Math.abs(q.lateral)<=q.width/2+1-CONFIG.car.radius+.02);});
test('six physical AI racers finish across seeds and difficulty without persistent traps',()=>{for(const difficulty of ['easy','normal','hard'] as const)for(const seed of [1,7,29]){const r=new Race(track);r.reset(difficulty,seed);for(let i=0;i<60*340&&!r.cars.every(c=>c.finishTime!==null);i++){if(r.phase==='finished')r.phase='racing';r.tick(1/60,emptyInput(),true);}assert.ok(r.cars.every(c=>c.finishTime!==null),`${difficulty}/${seed}: ${JSON.stringify(r.snapshot())}`);assert.ok(r.cars.every(c=>c.recoveries<4));}});
test('casual road assistance completes three laps with neutral, held-left, held-right and wavering input',()=>{
 for(const direction of [0,-1,1,2]){
  const r=racing(),c=r.cars[0];let maxLateral=0,hits=0;
  for(let i=0;i<60*400&&r.phase==='racing';i++){
   const steer=direction===2?Math.sin(i/45):direction;
   r.tick(1/60,{steer,throttle:1,brake:0,drift:direction!==0,boost:i%360===0});
   maxLateral=Math.max(maxLateral,Math.abs(track.nearest(c.x,c.z,c.s).lateral));
   hits+=r.events.filter(e=>e.id===0&&e.type==='hit').length;
  }
  assert.equal(c.lap,3,`input ${direction}: ${JSON.stringify(r.snapshot())}`);
  assert.ok(maxLateral<5,`input ${direction}: lateral ${maxLateral}`);
  assert.ok(c.recoveries<=1,`input ${direction}: recoveries ${c.recoveries}`);
  assert.ok(hits<=2,`input ${direction}: hits ${hits}`);assert.equal(c.penalty,0);
 }
});
test('casual barrier redirects the car forward promptly; resting and braking do not cause resets',()=>{
 const r=racing(),c=r.cars[0],p=track.at(60);
 Object.assign(c,{x:p.x+p.nx*7.04,z:p.z+p.nz*7.04,s:60,progress:60,lastProgress:60,nextGate:1100/24*2,yaw:Math.atan2(p.nx,p.nz),vx:0,vz:0,speed:0});
 run(r,2,{...emptyInput(),throttle:1,steer:1});assert.ok(c.progress>68);assert.ok(c.speed>5);assert.equal(c.penalty,0);
 const stopped=racing();run(stopped,4);assert.equal(stopped.cars[0].recoveries,0);
 run(stopped,4,{...emptyInput(),brake:1});assert.equal(stopped.cars[0].recoveries,0);
});
test('free recovery keeps valid progress, starts facing forward and clears the previous lane target',()=>{
 const r=racing(),c=r.cars[0];c.progress=75;c.nextGate=1100/24*2;c.lane=2.6;c.steer=1;c.nitro=2;
 r.respawn(c);assert.equal(c.progress,75);assert.equal(c.penalty,0);assert.equal(c.nitro,0);assert.equal(c.steer,0);
 assert.ok(c.speed>0);assert.ok(Math.abs(c.yaw-track.at(75).yaw)<.01);
});
function landmarks(neck=0,dip=0,shoulder=0):Landmark[]{
 const l=Array.from({length:33},()=>({x:.5,y:.5,visibility:0,presence:0}));
 const sa=shoulder*Math.PI/180,fa=(shoulder+neck)*Math.PI/180,h=.3-dip;
 l[0]={x:.5+Math.sin(fa)*h/(4/3),y:.55-Math.cos(fa)*h,visibility:1,presence:1};
 l[11]={x:.5+Math.cos(sa)*.12,y:.55+Math.sin(sa)*.16,visibility:1,presence:1};
 l[12]={x:.5-Math.cos(sa)*.12,y:.55-Math.sin(sa)*.16,visibility:1,presence:1};
 for(const [i,sign,radius] of [[2,1,.04],[5,-1,.04],[7,1,.09],[8,-1,.09]])l[i]={x:l[0].x+sign*Math.cos(fa)*radius,y:l[0].y-.035+sign*Math.sin(fa)*radius*(4/3),visibility:1,presence:1};return l;
}
function fitted(){const p=new PoseInput();for(let t=1000;t<=2000;t+=50)p.consume(landmarks(),t);assert.ok(p.ready);return p;}
function feed(p:PoseInput,from:number,to:number,neck=0,dip=0,shoulder=0){let resumes=0;for(let t=from;t<to;t+=50){p.consume(landmarks(neck,dip,shoulder),t);if(p.read(t).resume)resumes++;}return resumes;}
function neckActions(p:PoseInput,from:number,to:number,neck=0){const actions:{value:number;time:number}[]=[];for(let t=from;t<to;t+=50){p.consume(landmarks(neck),t);const f=p.read(t);assert.equal(f.turnAction,0);assert.equal(f.boost,false);assert.equal(f.resume,false);if(f.directionAction)actions.push({value:f.directionAction,time:t});}return actions;}
function shoulderActions(p:PoseInput,from:number,to:number,shoulder=0,hideFace=false){const actions:{value:number;time:number}[]=[];for(let t=from;t<to;t+=50){const l=landmarks(0,0,shoulder);if(hideFace)for(const i of [2,5,7,8])l[i].visibility=0;p.consume(l,t);const f=p.read(t);assert.equal(f.directionAction,0);assert.equal(f.boost,false);assert.equal(f.resume,false);if(f.turnAction)actions.push({value:f.turnAction,time:t});}return actions;}
function shifted(direction:number){const l=landmarks();for(const i of [0,2,5,7,8,11,12])l[i].x-=direction*.065;return l;}

test('head/shoulders auto-fit; small neutral motion emits no command or boost for 60 seconds',()=>{const p=new PoseInput();for(let t=1000;t<62000;t+=50){p.consume(landmarks(Math.sin(t)*.4,Math.cos(t)*.001,Math.cos(t/2)*.3),t);const f=p.read(t);assert.equal(f.boost,false);assert.equal(f.directionAction,0);assert.equal(f.turnAction,0);}assert.ok(p.ready);});
test('one neck tilt immediately changes one lane; holding does not repeat and neutral re-arms',()=>{
 for(const angle of [16,35]){const p=fitted(),left=neckActions(p,2050,3000,angle);assert.deepEqual(left.map(a=>a.value),[-1]);assert.ok(left[0].time-2050<=250);
 assert.deepEqual(neckActions(p,3000,5000,angle),[]);neckActions(p,5000,5700);const right=neckActions(p,5700,6600,-angle);assert.deepEqual(right.map(a=>a.value),[1]);assert.ok(right[0].time-5700<=250);}
});
test('whole head/shoulder translation and brief angle jitter do not trigger either command',()=>{
 const p=fitted();for(let t=2050;t<4000;t+=50){const l=shifted(Math.sin(t/250));p.consume(l,t);const f=p.read(t);assert.equal(f.directionAction,0);assert.equal(f.turnAction,0);}
 for(let t=4000;t<6000;t+=50){p.consume(landmarks(Math.sin(t/170)*2,0,Math.cos(t/220)*2),t);const f=p.read(t);assert.equal(f.directionAction,0);assert.equal(f.turnAction,0);}
});
test('a queued neck tilt is discarded on occlusion and requires a neutral return',()=>{
 const p=fitted();for(let t=2050;t<2400;t+=50)p.consume(landmarks(-16),t);assert.equal(p.directionAction,1);
 p.consume([],2400);assert.equal(p.read(2400).directionAction,0);assert.deepEqual(neckActions(p,2450,3600,-16),[]);
 neckActions(p,3600,4300);assert.deepEqual(neckActions(p,4300,5000,-16).map(a=>a.value),[1]);
});
test('one classified neck action changes one lane and returning neutral preserves that lane',()=>{
 const r=racing(),c=r.cars[0],action={...emptyInput(),throttle:1,actionControl:true};
 r.tick(1/60,{...action,directionAction:1});run(r,2,action);assert.equal(c.laneChoice,1);assert.equal(c.laneChanges,1);
 assert.ok(track.nearest(c.x,c.z,c.s).lateral>1);
 r.tick(1/60,{...action,directionAction:1});assert.equal(c.laneChanges,1);assert.equal(c.laneChoice,1);
 r.tick(1/60,{...action,directionAction:-1});run(r,2,action);assert.equal(c.laneChoice,0);assert.equal(c.laneChanges,2);
 r.tick(1/60,{...action,directionAction:-1});run(r,2,action);assert.equal(c.laneChoice,-1);assert.equal(c.laneChanges,3);
 r.pause();const frozen=JSON.stringify(r.snapshot());run(r,2,action);assert.equal(JSON.stringify(r.snapshot()),frozen);
 r.reset();assert.equal(r.cars[0].laneChoice,0);assert.equal(r.cars[0].laneChanges,0);
});
test('discrete body controls safely complete three laps without requiring a gesture for bends',()=>{
 const r=racing(),c=r.cars[0],action={...emptyInput(),throttle:1,actionControl:true};
 for(let i=0;i<60*400&&r.phase==='racing';i++)r.tick(1/60,{...action,directionAction:i%600===0?(i%1200===0?1:-1):0,turnAction:i%300===150?(i%600===150?1:-1):0,boost:i%360===0});
 assert.equal(c.lap,3);assert.ok(c.recoveries<=1);assert.equal(c.penalty,0);assert.ok(c.laneChanges>10);assert.ok(c.nitroEvents>0);
});
test('nod emits only a one-shot resume request; it is no longer nitro',()=>{const p=fitted();assert.equal(feed(p,2050,2400,0,.07),0);assert.equal(feed(p,2400,2750),1);assert.equal(feed(p,2750,3000,0,.07),0);assert.equal(feed(p,3000,3800),0);assert.equal(feed(p,3800,4150,0,.07),0);assert.equal(feed(p,4150,4550),1);});
test('sideways translation does not boost or steer; nod resume does not change lanes',()=>{
 const p=fitted();for(let t=2050;t<4000;t+=50){p.consume(shifted(Math.sin(t/300)),t);const f=p.read(t);assert.equal(f.boost,false);assert.equal(f.directionAction,0);assert.equal(f.turnAction,0);}
 feed(p,4000,4300,0,.07);assert.equal(p.directionAction,0);assert.equal(feed(p,4300,4750),1);assert.equal(p.directionAction,0);
});
test('a prolonged bow does not resume; occlusion cannot finish a stale nod',()=>{const p=fitted();assert.equal(feed(p,2050,4100,0,.07),0);assert.equal(feed(p,4100,4700),0);feed(p,4700,4950,0,.07);const l=landmarks();l[0].visibility=0;p.consume(l,5000);assert.equal(p.valid,false);assert.equal(feed(p,5050,5600),0);const stale=p.read(6300);assert.equal(stale.throttle,0);assert.equal(stale.drift,false);assert.equal(stale.boost,false);});

test('one shoulder-line tilt turns once; holding does not repeat and level shoulders re-arm',()=>{
 const p=fitted(),left=shoulderActions(p,2050,3100,18);assert.deepEqual(left.map(a=>a.value),[-1]);assert.ok(left[0].time-2050<=300);
 assert.deepEqual(shoulderActions(p,3100,5000,18),[]);shoulderActions(p,5000,5700);assert.deepEqual(shoulderActions(p,5700,6700,-18).map(a=>a.value),[1]);
});
test('whole-body lean only turns; an equally strong mixed tilt waits instead of guessing',()=>{
 for(const neck of [0,18]){const p=fitted(),turns:number[]=[],lanes:number[]=[];for(let t=2050;t<3100;t+=50){p.consume(landmarks(neck,0,18),t);const f=p.read(t);if(f.directionAction)lanes.push(f.directionAction);if(f.turnAction)turns.push(f.turnAction);}assert.deepEqual(lanes,[]);assert.deepEqual(turns,neck?[]:[-1]);}
});
test('turn action changes physical heading for a bounded manoeuvre without changing lane selection',()=>{
 const samples:number[]=[];const input={...emptyInput(),actionControl:true,throttle:1};
 for(const turn of [-1,0,1] as const){const r=racing(),c=r.cars[0],p=track.at(40);r.cars.slice(1).forEach(o=>o.finishTime=0);
  Object.assign(c,{x:p.x,z:p.z,s:40,progress:40,lastProgress:40,nextGate:1100/24,yaw:p.yaw,prevYaw:p.yaw,vx:p.tx*20,vz:p.tz*20,speed:20,lane:0});
  r.tick(1/60,{...input,turnAction:turn});run(r,.55,input);samples.push(c.yaw);assert.equal(c.laneChoice,0);
  if(turn){assert.ok(c.turnRemaining>0);assert.equal(c.turnEvents,1);r.pause();const remaining=c.turnRemaining;run(r,2,input);assert.equal(c.turnRemaining,remaining);r.phase='racing';}
  run(r,2,input);assert.equal(c.turnRemaining,0);assert.equal(c.laneChoice,0);assert.equal(c.penalty,0);
 }
 assert.ok(wrapAngle(samples[0]-samples[1])>.025);assert.ok(wrapAngle(samples[2]-samples[1])<-.025);
});

test('missing eyes and ears disables neck-lane classification but shoulder turning remains available',()=>{
 const p=fitted();assert.deepEqual(shoulderActions(p,2050,3100,18,true).map(a=>a.value),[-1]);assert.ok(p.valid);
 shoulderActions(p,3100,3800,0,true);for(let t=3800;t<4700;t+=50){const l=landmarks(-18);for(const i of [2,5,7,8])l[i].visibility=0;p.consume(l,t);const f=p.read(t);assert.equal(f.directionAction,0);assert.equal(f.turnAction,0);}
});

function shrugged(lift=.06,headLift=0,side=0){const l=landmarks();for(const i of side?[side]:[11,12])l[i].y-=lift;for(const i of [0,2,5,7,8])l[i].y-=headLift;return l;}
function shrugFeed(p:PoseInput,from:number,to:number,lift=0,headLift=0,side=0){let bursts=0;for(let t=from;t<to;t+=50){p.consume(shrugged(lift,headLift,side),t);const f=p.read(t);if(f.boost)bursts++;assert.equal(f.resume,false);assert.equal(f.directionAction,0);if(!side)assert.equal(f.turnAction,0);}return bursts;}
test('both shoulders rising emits one immediate burst, holding never repeats, lowering re-arms',()=>{
 const p=fitted();assert.equal(shrugFeed(p,2050,2550,.06),1);assert.equal(shrugFeed(p,2550,6500,.06),0);
 assert.equal(shrugFeed(p,6500,7100),0);assert.equal(shrugFeed(p,7100,7600,.06),1);
});
test('a brief shoulder dip does not re-arm; a stable relaxed posture does',()=>{
 const p=fitted();assert.equal(shrugFeed(p,2050,2500,.06),1);assert.equal(shrugFeed(p,2500,2600),0);assert.equal(shrugFeed(p,2600,3300,.06),0);
 shrugFeed(p,3300,3900);assert.equal(shrugFeed(p,3900,4300,.06),1);
});
test('nods, a single shoulder, whole-body vertical motion and shoulder jitter cannot spray nitro',()=>{
 for(const [lift,head,side] of [[0,-.07,0],[.06,0,11],[.06,0,12],[.06,.06,0],[.009,0,0]]){
  const p=fitted();for(let t=2050;t<2800;t+=50){p.consume(shrugged(lift,head,side),t);assert.equal(p.read(t).boost,false);}
  for(let t=2800;t<3500;t+=50){p.consume(landmarks(),t);assert.equal(p.read(t).boost,false);}
 }
});
test('raising only one shoulder is a shoulder-line turn, never a nitro spray or lane change',()=>{
 for(const side of [11,12]){const p=fitted(),turns:number[]=[];for(let t=2050;t<3000;t+=50){p.consume(shrugged(.06,0,side),t);const f=p.read(t);assert.equal(f.boost,false);assert.equal(f.directionAction,0);if(f.turnAction)turns.push(f.turnAction);}assert.equal(turns.length,1);}
});
test('occlusion cancels a pending shrug; returning with shoulders raised cannot spray again',()=>{
 const p=fitted();for(let t=2050;t<2500;t+=50)p.consume(shrugged(),t);assert.ok(p.boost);
 p.consume([],2500);assert.equal(p.read(2500).boost,false);assert.equal(shrugFeed(p,2550,3500,.06),0);
 shrugFeed(p,3500,4200);assert.equal(shrugFeed(p,4200,4600,.06),1);
});
test('body-mode short sprays need no cards, do not stack speed or repeat while held, and pause freezes them',()=>{
 const r=racing(),c=r.cars[0],input={...emptyInput(),actionControl:true,throttle:1};assert.equal(c.cards,0);
 r.tick(1/60,{...input,boost:true});assert.equal(c.nitroEvents,1);assert.equal(c.nitro,CONFIG.casual.shrugBurstDuration);
 run(r,.2,{...input,boost:true});assert.equal(c.nitroEvents,1);run(r,.05,input);
 r.tick(1/60,{...input,boost:true});assert.equal(c.nitroEvents,2);assert.equal(c.nitro,CONFIG.casual.shrugBurstDuration);assert.equal(c.cards,0);
 r.pause();const frozen=c.nitro;run(r,1,input);assert.equal(c.nitro,frozen);r.phase='racing';run(r,1,input);assert.equal(c.nitro,0);assert.equal(c.nitroEvents,2);
});
