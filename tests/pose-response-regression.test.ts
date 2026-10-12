import test from 'node:test';import assert from 'node:assert/strict';
import {PoseInput,type Landmark} from '../src/pose-input';
import {Race} from '../src/race';import {Track} from '../src/track';import {emptyInput,wrapAngle} from '../src/config';
function pose(neck=0,shoulder=0,left=0,right=left,head=0):Landmark[]{
 const l=Array.from({length:33},()=>({x:.5,y:.5,visibility:0,presence:0})),s=shoulder*Math.PI/180,f=(neck+shoulder)*Math.PI/180;
 l[0]={x:.5+Math.sin(f)*.225,y:.55-Math.cos(f)*.3-head,visibility:1,presence:1};
 l[11]={x:.5+Math.cos(s)*.12,y:.55+Math.sin(s)*.16-left,visibility:1,presence:1};l[12]={x:.5-Math.cos(s)*.12,y:.55-Math.sin(s)*.16-right,visibility:1,presence:1};
 for(const[i,sign,radius]of[[2,1,.04],[5,-1,.04],[7,1,.09],[8,-1,.09]])l[i]={x:l[0].x+sign*Math.cos(f)*radius,y:l[0].y-.035+sign*Math.sin(f)*radius*4/3,visibility:1,presence:1};return l;
}
function fitted(){const p=new PoseInput();for(let t=1000;t<=2000;t+=50){p.consume(pose(),t);p.read(t);}assert.ok(p.ready);return p;}
function feed(p:PoseInput,start:number,ms:number,l:Landmark[],step=34){const events:{kind:string;value:number;ms:number}[]=[];for(let t=0;t<ms;t+=step){p.consume(l,start+t);const f=p.read(start+t);if(f.directionAction)events.push({kind:'lane',value:f.directionAction,ms:t});if(f.turnAction)events.push({kind:'turn',value:f.turnAction,ms:t});if(f.boost)events.push({kind:'boost',value:1,ms:t});}return events;}
test('small neck, shoulder and shrug actions are accepted within two follow-up samples',()=>{
 for(const step of[34,50,100])for(const sign of[-1,1])for(const[kind,l]of[['lane',pose(sign*6)],['turn',pose(0,sign*7)],['boost',pose(0,0,.018,.018,.003)]] as const){const p=fitted(),events=feed(p,2050,250,l,step);assert.equal(events.length,1);assert.equal(events[0].kind,kind);assert.equal(events[0].value,kind==='boost'?1:-sign);assert.ok(events[0].ms<=step*2);assert.deepEqual(feed(p,2300,900,l,step),[]);}
});
test('mixed neck and shoulder angles wait for clear intent instead of producing a wrong turn',()=>{
 for(const sign of[-1,1]){const p=fitted();assert.deepEqual(feed(p,2050,400,pose(sign*8,sign*9)),[]);const e=feed(p,2500,200,pose(sign*10,sign*5));assert.deepEqual(e.map(e=>e.kind),['lane']);assert.equal(e[0].value,-sign);}
});
test('shoulder-led movement and neck-led movement stay separate in both directions',()=>{
 for(const sign of[-1,1]){assert.deepEqual(feed(fitted(),2050,250,pose(sign*4,sign*9)).map(e=>e.kind),['turn']);assert.deepEqual(feed(fitted(),2050,250,pose(sign*10,sign*6)).map(e=>e.kind),['lane']);}
});
test('tipping one shoulder while keeping the face level turns instead of changing lanes',()=>{
 for(const[left,right]of[[.06,0],[0,.06]])assert.deepEqual(feed(fitted(),2050,250,pose(0,0,left,right)).map(e=>e.kind),['turn']);
});
test('uneven bilateral shrugs do not become steering gestures at maximum sensitivity',()=>{
 for(const[left,right]of[[.024,.054],[.054,.024]]){const p=fitted();p.sensitivity=1.8;assert.deepEqual(feed(p,2050,250,pose(0,0,left,right,.003)).map(e=>e.kind),['boost']);}
});
test('one-sample neck, shoulder and shrug spikes cannot trigger an action',()=>{
 for(const l of[pose(20),pose(0,20),pose(0,0,.06)]){const p=fitted();assert.deepEqual(feed(p,2050,1,l),[]);assert.deepEqual(feed(p,2084,600,pose()),[]);}
});
function cruising(){const tr=new Track('meadow'),r=new Race(tr);r.phase='racing';r.cars.slice(1).forEach(c=>c.finishTime=0);const c=r.cars[0],q=tr.at(80);Object.assign(c,{x:q.x,z:q.z,yaw:q.yaw,prevYaw:q.yaw,s:q.s,progress:80,lastProgress:80,nextGate:tr.length/24*2,vx:q.tx*29,vz:q.tz*29,speed:29});return {tr,r,c};}
test('body lane change shows physical movement and yaw within 250 ms and keeps its lane',()=>{
 for(const direction of[-1,1] as const){const{tr,r,c}=cruising(),yaw=c.yaw;for(let i=0;i<15;i++)r.tick(1/60,{...emptyInput(),throttle:1,actionControl:true,directionAction:i===0?direction:0});assert.ok(tr.nearest(c.x,c.z,c.s).lateral*direction>.05);assert.ok(wrapAngle(c.yaw-yaw)*direction<-.04);for(let i=0;i<105;i++)r.tick(1/60,{...emptyInput(),throttle:1,actionControl:true});assert.equal(c.laneChoice,direction);assert.equal(c.laneChanges,1);assert.ok(tr.nearest(c.x,c.z,c.s).lateral*direction>3);assert.equal(c.recoveries,0);}
});
test('body shoulder turns have prompt visible yaw without changing the selected lane',()=>{
 for(const direction of[-1,1] as const){const{r,c}=cruising(),yaw=c.yaw;for(let i=0;i<9;i++)r.tick(1/60,{...emptyInput(),throttle:1,actionControl:true,turnAction:i===0?direction:0});assert.ok(wrapAngle(c.yaw-yaw)*direction<-.025);assert.equal(c.laneChoice,0);assert.equal(c.turnEvents,1);}
});
