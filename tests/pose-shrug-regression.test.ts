import test from 'node:test';
import assert from 'node:assert/strict';
import {PoseInput,type Landmark} from '../src/pose-input';

function pose(left=0,right=left,head=0):Landmark[]{
 const l=Array.from({length:33},()=>({x:.5,y:.7,visibility:0,presence:1}));
 for(const [i,x,y] of [[0,.5,.25-head],[2,.46,.23-head],[5,.54,.23-head],[7,.43,.25-head],[8,.57,.25-head],[11,.38,.55-left],[12,.62,.55-right]])l[i]={x,y,visibility:1,presence:1};
 return l;
}
function fitted(){const p=new PoseInput();for(let t=1000;t<2000;t+=50){p.consume(pose(),t);p.read(t);}assert.ok(p.ready&&p.shrugArmed);return p;}
function feed(p:PoseInput,start:number,duration:number,left=0,right=left,head=0,step=50){
 const fired:number[]=[];
 for(let t=start;t<start+duration;t+=step){p.consume(pose(left,right,head),t);const input=p.read(t);if(input.boost)fired.push(t-start);assert.equal(input.directionAction,0);assert.equal(input.turnAction,0);assert.equal(input.resume,false);}
 return fired;
}

test('a comfortable small bilateral shrug is detected at 10, 15 and 20 pose frames per second',()=>{
 for(const step of [100,1000/15,50]){const p=fitted(),fired=feed(p,2050,400,.018,.018,.003,step);assert.equal(fired.length,1);assert.ok(fired[0]<=200);}
});
test('a brief 120 ms shrug needs no sustained hold',()=>{
 const p=fitted();assert.equal(feed(p,2050,120,.02,.02,.003,40).length,1);assert.equal(feed(p,2170,400).length,0);
});
test('a natural shrug still works when the head rises slightly with both shoulders',()=>{
 const p=fitted();assert.equal(feed(p,2050,450,.025,.025,.012).length,1);
});
test('a slightly uneven bilateral shrug sprays without becoming a shoulder turn',()=>{
 const p=fitted();assert.equal(feed(p,2050,400,.019,.027,.005).length,1);
});
test('three relaxed quick shrugs give three sprays; holding high never repeats',()=>{
 const p=fitted();let time=2050,total=0;
 for(let i=0;i<3;i++){total+=feed(p,time,150,.02,.02,.003).length;time+=150;feed(p,time,250);time+=250;}
 assert.equal(total,3);assert.equal(feed(p,time,5000,.02,.02,.003).length,1);assert.equal(feed(p,time+5000,3000,.02,.02,.003).length,0);
});
test('whole-body movement does not spray or prevent the next real shrug',()=>{
 for(const move of [.04,-.04]){const p=fitted();assert.equal(feed(p,2050,400,.018,.018,.003).length,1);
 assert.equal(feed(p,2450,600,move,move,move).length,0);
 assert.equal(feed(p,3050,400,move+.018,move+.018,move+.003).length,1);}
});
test('a single pose spike, single shoulder and neutral jitter cannot spray at high sensitivity',()=>{
 const p=fitted();p.sensitivity=1.8;
 assert.equal(feed(p,2050,50,.06).length,0);assert.equal(feed(p,2100,400).length,0);
 for(const [left,right,head] of [[.04,0,0],[0,.04,0],[.05,.05,.05],[0,0,-.04]]){
  for(let t=2550;t<2950;t+=50){p.consume(pose(left,right,head),t);assert.equal(p.read(t).boost,false);}
  feed(p,2950,500);
 }
 for(let t=3500;t<63500;t+=50){p.consume(pose(Math.sin(t)*.003,Math.cos(t/2)*.003,Math.cos(t)*.002),t);assert.equal(p.read(t).boost,false);}
});
test('220 ms inference intervals detect one shrug despite intervening game-frame reads',()=>{
 const p=fitted();let count=0;
 for(let t=2050;t<2750;t+=220){p.consume(pose(.018,.018,.003),t);for(let d=0;d<220;d+=17)if(p.read(t+d).boost)count++;}
 assert.equal(count,1);
});

test('a nod can still resume after a relaxed whole-body position shift',()=>{
 for(const move of [-.04,.04]){const p=fitted();feed(p,2050,600,move,move,move);let resumes=0;
  for(let t=2650;t<3000;t+=50){p.consume(pose(move,move,move-.07),t);const f=p.read(t);assert.equal(f.boost,false);if(f.resume)resumes++;}
  for(let t=3000;t<3500;t+=50){p.consume(pose(move,move,move),t);const f=p.read(t);assert.equal(f.boost,false);if(f.resume)resumes++;}
  assert.equal(resumes,1);
 }
});

test('a changed relaxed head height does not block or delay the next gentle shrug',()=>{
 for(const head of[-.025,.025]){const p=fitted();assert.equal(feed(p,2050,600,0,0,head).length,0);const hits=feed(p,2650,150,.015,.015,head+.003,34);assert.equal(hits.length,1);assert.ok(hits[0]<=68);assert.equal(feed(p,2800,1200,.015,.015,head+.003,34).length,0);}
});
test('a gradually rising small shrug is not absorbed into the relaxed reference',()=>{
 const p=fitted();let count=0;for(let t=0;t<360;t+=34){const lift=Math.min(.015,t/220*.015);p.consume(pose(lift,lift,.002*t/360),2050+t);const f=p.read(2050+t);if(f.boost)count++;assert.equal(f.directionAction,0);assert.equal(f.turnAction,0);}assert.equal(count,1);
});
