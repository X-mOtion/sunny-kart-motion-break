import test from 'node:test';
import assert from 'node:assert/strict';
import {PoseInput,type Landmark} from '../src/pose-input';
import {Race} from '../src/race';
import {Track} from '../src/track';
import {emptyInput} from '../src/config';

function landmarks(neck=0,shoulder=0):Landmark[]{
 const l=Array.from({length:33},()=>({x:.5,y:.5,visibility:0,presence:0}));
 const s=shoulder*Math.PI/180,f=(neck+shoulder)*Math.PI/180;
 l[0]={x:.5+Math.sin(f)*.3/(4/3),y:.55-Math.cos(f)*.3,visibility:1,presence:1};
 l[11]={x:.5+Math.cos(s)*.12,y:.55+Math.sin(s)*.16,visibility:1,presence:1};
 l[12]={x:.5-Math.cos(s)*.12,y:.55-Math.sin(s)*.16,visibility:1,presence:1};
 for(const [i,sign,radius] of [[2,1,.04],[5,-1,.04],[7,1,.09],[8,-1,.09]])l[i]={x:l[0].x+sign*Math.cos(f)*radius,y:l[0].y-.035+sign*Math.sin(f)*radius*4/3,visibility:1,presence:1};
 return l;
}
function fitted(){const p=new PoseInput();for(let t=1000;t<=2000;t+=50){p.consume(landmarks(),t);p.read(t);}assert.ok(p.ready);return p;}
function collect(p:PoseInput,from:number,to:number,neck:number,shoulder=0,interval=50,eyes=1){
 const lanes:number[]=[],turns:number[]=[],times:number[]=[];
 for(let t=from;t<to;t+=interval){const l=landmarks(neck,shoulder);for(const i of [2,5])l[i].visibility=eyes;p.consume(l,t);const f=p.read(t);if(f.directionAction){lanes.push(f.directionAction);times.push(t-from);}if(f.turnAction)turns.push(f.turnAction);}
 return {lanes,turns,times};
}
test('small deliberate 9 degree neck tilts classify promptly at 10, 15 and 20 camera FPS',()=>{
 for(const interval of [50,67,100])for(const direction of [-1,1]){const p=fitted(),r=collect(p,2050,2251,9*direction,0,interval);assert.deepEqual(r.lanes,[-direction]);assert.deepEqual(r.turns,[]);assert.ok(r.times[0]<=120);assert.deepEqual(collect(p,2300,3300,9*direction).lanes,[]);}
});
test('a quick 100 ms small neck gesture is accepted once without needing a long hold',()=>{
 for(const direction of [-1,1]){const p=fitted();assert.deepEqual(collect(p,2050,2150,9*direction).lanes,[-direction]);assert.deepEqual(collect(p,2150,2800,0).lanes,[]);}
});
test('dominant neck roll wins over modest incidental shoulder lean instead of making a temporary turn',()=>{
 for(const direction of [-1,1]){const p=fitted(),r=collect(p,2050,2700,16*direction,9*direction);assert.deepEqual(r.lanes,[-direction]);assert.deepEqual(r.turns,[]);}
});
test('eyes to ears fallback keeps the neutral reference through a tilt and its return',()=>{
 for(const direction of [-1,1]){const p=fitted();const r=collect(p,2050,2700,12*direction,0,50,0);assert.deepEqual(r.lanes,[-direction]);assert.deepEqual(collect(p,2700,3500,0,0,50,0).lanes,[]);assert.deepEqual(collect(p,3500,4000,0).lanes,[]);assert.deepEqual(collect(p,4000,4600,12*direction).lanes,[-direction]);}
});
test('moderate eye confidence still uses reliable face geometry without losing a valid tilt',()=>{
 const p=fitted();const r=collect(p,2050,2350,9,0,67,.48);assert.deepEqual(r.lanes,[-1]);assert.deepEqual(r.turns,[]);
});
test('a 220 ms inference interval cannot repeatedly disarm a valid neck gesture',()=>{
 const p=fitted(),lanes:number[]=[];
 for(let t=2050;t<3550;t+=220){p.consume(landmarks(14),t);for(let d=0;d<220;d+=17){const f=p.read(t+d);if(f.directionAction)lanes.push(f.directionAction);}}
 assert.deepEqual(lanes,[-1]);
});
test('an isolated missing face frame does not require an extra neutral ritual before the next tilt',()=>{
 const p=fitted(),l=landmarks();for(const i of [2,5,7,8])l[i].visibility=0;p.consume(l,2050);assert.equal(p.read(2050).directionAction,0);
 assert.deepEqual(collect(p,2100,2550,12).lanes,[-1]);
});
test('sustained missing face data cancels arming and cannot replay a tilt until a neutral return',()=>{
 const p=fitted();for(let t=2050;t<2500;t+=50){const l=landmarks();for(const i of [2,5,7,8])l[i].visibility=0;p.consume(l,t);assert.equal(p.read(t).directionAction,0);}
 assert.equal(p.directionArmed,false);assert.deepEqual(collect(p,2500,3050,12).lanes,[]);collect(p,3050,3650,0);assert.deepEqual(collect(p,3650,4150,12).lanes,[-1]);
});
test('independent eye/ear point jitter at a neutral posture does not create lane or turn commands',()=>{
 const p=fitted();for(let t=2050;t<62000;t+=50){const l=landmarks(Math.sin(t/810),Math.cos(t/920));for(const i of [2,5,7,8]){l[i].x+=Math.sin(t/130+i)*.002;l[i].y+=Math.sin(t/270+i)*.003;}p.consume(l,t);const f=p.read(t);assert.equal(f.directionAction,0);assert.equal(f.turnAction,0);assert.equal(f.boost,false);assert.equal(f.resume,false);}
});
test('a brief opposite wobble while returning neutral cannot undo the selected lane',()=>{
 const p=fitted();assert.deepEqual(collect(p,2050,2450,-12).lanes,[1]);
 assert.deepEqual(collect(p,2450,2570,2).lanes,[]);assert.deepEqual(collect(p,2570,2650,12).lanes,[]);
 assert.deepEqual(collect(p,2650,3250,0).lanes,[]);assert.deepEqual(collect(p,3250,3850,12).lanes,[-1]);
});
test('latched action lane survives quiet input frames, pause and recovery; explicit keyboard switch releases it',()=>{
 const track=new Track('meadow'),r=new Race(track);r.phase='racing';r.cars.slice(1).forEach(c=>c.finishTime=0);const c=r.cars[0];
 r.tick(1/60,{...emptyInput(),throttle:1,actionControl:true,directionAction:1});
 for(let i=0;i<360;i++)r.tick(1/60,{...emptyInput(),throttle:1});
 assert.equal(c.laneChoice,1);assert.equal(c.laneChanges,1);assert.ok(track.nearest(c.x,c.z,c.s).lateral>3);
 r.pause();r.resume();for(let i=0;i<300;i++)r.tick(1/60,{...emptyInput(),throttle:1});assert.equal(c.laneChoice,1);
 r.respawn(c);assert.equal(c.laneChoice,1);for(let i=0;i<120;i++)r.tick(1/60,{...emptyInput(),throttle:1,actionControl:true});assert.ok(track.nearest(c.x,c.z,c.s).lateral>3);
 r.tick(1/60,{...emptyInput(),throttle:1,actionControl:false});assert.equal(c.laneChoice,0);
});
