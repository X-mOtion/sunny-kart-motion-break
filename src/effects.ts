import * as T from 'three';
import {CONFIG,clamp} from './config';
import type {Car,Race} from './race';

type Kind='smoke'|'spark'|'jet'|'confetti';
type Particle={sprite:T.Sprite;kind:Kind;age:number;life:number;vx:number;vy:number;vz:number;size:number;spin:number};
type Feedback={kind:string;text:string;direction:number;remaining:number};

// All effects use a fixed pool and the simulation clock, including pause and replay.
export class KartEffects {
 particles:Particle[]=[];skids:T.InstancedMesh;time=0;skidCount=0;nextParticle=0;nextSkid=0;lastSkid=0;
 boostPulse=0;speedLines=0;overtakes=0;celebrated=false;
 feedback:Feedback={kind:'',text:'',direction:0,remaining:0};
 signalDirection=0;signalRemaining=0;signalElapsed=0;
 reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
 private smokeMap:T.Texture;private glowMap:T.Texture;private sparkMap:T.Texture;private paperMap:T.Texture;
 private emissions=Array.from({length:6},()=>({smoke:0,spark:0,jet:0}));
 private passArmed=Array(6).fill(false);private passCooldown=Array(6).fill(0);
 private lastLane=0;private laneCooldown=0;private dummy=new T.Object3D();
 constructor(scene:T.Scene){
  this.glowMap=this.texture('glow');this.sparkMap=this.texture('spark');this.paperMap=this.texture('paper');this.smokeMap=this.texture('puff');
  for(let i=0;i<CONFIG.effects.particles;i++){
   const sprite=new T.Sprite(new T.SpriteMaterial({map:this.glowMap,transparent:true,opacity:0,depthWrite:false,toneMapped:false}));
   sprite.visible=false;scene.add(sprite);this.particles.push({sprite,kind:'smoke',age:0,life:1,vx:0,vy:0,vz:0,size:1,spin:0});
  }
  this.skids=new T.InstancedMesh(new T.PlaneGeometry(.2,.95),new T.MeshBasicMaterial({color:'#29363e',transparent:true,opacity:.34,depthWrite:false}),CONFIG.effects.skidMarks);
  this.skids.frustumCulled=false;scene.add(this.skids);this.reset();
 }
 private texture(kind:'glow'|'spark'|'paper'|'puff'){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d')!;
  if(kind==='glow'){const g=ctx.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'#ffffff');g.addColorStop(.2,'#ffffff');g.addColorStop(.55,'#ffffff88');g.addColorStop(1,'#ffffff00');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);}
  else if(kind==='puff'){for(const [x,y,r] of [[22,24,19],[40,24,18],[18,39,15],[36,42,18],[46,36,13]]){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'#ffffff');g.addColorStop(.62,'#ffffffee');g.addColorStop(1,'#ffffff00');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}}
  else if(kind==='spark'){ctx.fillStyle='white';ctx.beginPath();ctx.moveTo(32,0);for(const [x,y] of [[38,25],[64,32],[38,39],[32,64],[26,39],[0,32],[26,25]])ctx.lineTo(x,y);ctx.closePath();ctx.fill();}
  else{ctx.fillStyle='white';ctx.fillRect(12,6,40,52);}
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;return map;
 }
 private emit(c:Car,kind:Kind,low:boolean,burst=false){
  const p=this.particles[this.nextParticle++%(low?CONFIG.effects.lowParticles:CONFIG.effects.particles)],side=this.nextParticle%2?1:-1;
  const fx=Math.sin(c.yaw),fz=Math.cos(c.yaw),material=p.sprite.material;
  p.kind=kind;p.age=0;p.spin=(Math.random()-.5)*3;
  p.sprite.position.set(c.x-fx*.9-fz*.62*side,.26,c.z-fz*.9+fx*.62*side);
  p.vx=-c.vx*.05;p.vz=-c.vz*.05;p.vy=.55;
  material.rotation=Math.random()*Math.PI;material.blending=T.NormalBlending;material.map=this.smokeMap;
  if(kind==='smoke'){p.life=.75+Math.random()*.3;p.size=.9+Math.random()*.25;p.sprite.position.x-=fz*.2*side;p.sprite.position.z+=fx*.2*side;material.color.set('#fcf6e7');}
  else if(kind==='confetti'){
   p.sprite.position.set(c.x+(Math.random()-.5)*13,3+Math.random()*4,c.z+(Math.random()-.5)*10);
   p.life=2+Math.random();p.size=.14+Math.random()*.1;p.vx=(Math.random()-.5)*3;p.vz=(Math.random()-.5)*3;p.vy=1+Math.random()*2;
   material.map=this.paperMap;material.color.set(CONFIG.colors[this.nextParticle%6]);
  }else{
   material.map=kind==='spark'?this.sparkMap:this.glowMap;material.blending=T.AdditiveBlending;
   p.life=kind==='jet'?.32:.38;p.size=kind==='jet'?.28:.22;p.vy=.15+Math.random()*.9;
   p.vx=-fx*(kind==='jet'?6:2)+(Math.random()-.5)*(burst?6:2);p.vz=-fz*(kind==='jet'?6:2)+(Math.random()-.5)*(burst?6:2);
   material.color.set(kind==='jet'?'#6de7ff':c.collision>0?'#ffc65b':c.charge>65?'#ffcf59':'#74e7ff');
  }
  p.sprite.visible=true;this.drawParticle(p);
 }
 private drawParticle(p:Particle){
  const t=clamp(p.age/p.life,0,1),m=p.sprite.material;
  if(t>=1){p.sprite.visible=false;return;}
  const size=p.kind==='smoke'?p.size+t*1.3:p.kind==='confetti'?p.size:p.size*(1-t*.65);
  p.sprite.scale.set(size,p.kind==='jet'?size*1.7:size,1);
  m.opacity=(1-t)*(p.kind==='smoke'?.52:p.kind==='confetti'?1:.9);
 }
 private show(kind:string,text:string,direction=0){
  if(kind==='lane'||kind==='turn'){if(direction){this.signalDirection=direction<0?-1:1;this.signalRemaining=CONFIG.effects.signalSeconds;this.signalElapsed=0;}return;}
  this.feedback={kind,text,direction,remaining:CONFIG.effects.feedbackSeconds};
 }
 get turnSignal(){
  const direction=this.signalRemaining>0?this.signalDirection:0;
  return {direction,remaining:+this.signalRemaining.toFixed(3),lit:direction!==0&&(this.reducedMotion||this.signalElapsed%CONFIG.effects.signalPeriod<CONFIG.effects.signalPeriod*.55)};
 }
 step(race:Race,dt:number,low:boolean){
  const active=race.phase==='racing',finishing=race.phase==='finished';
  if(!active&&!finishing)return false;
  this.time+=dt;this.boostPulse=Math.max(0,this.boostPulse-dt);this.feedback.remaining=Math.max(0,this.feedback.remaining-dt);
  this.signalRemaining=Math.max(0,this.signalRemaining-dt);this.signalElapsed+=dt;
  if(!active||this.signalRemaining===0){this.signalDirection=0;this.signalRemaining=0;}
  this.laneCooldown=Math.max(0,this.laneCooldown-dt);const c=race.cars[0];let passed=false;
  if(finishing&&!this.celebrated){this.celebrated=true;this.show('finish','Three laps of sunshine!');for(let i=0;i<(low?28:80);i++)this.emit(c,'confetti',low);}
  if(active){
   for(const e of race.events){if(e.id!==0)continue;
    if(e.type==='nitro'||e.type==='mini'){this.boostPulse=CONFIG.effects.boostPulseSeconds;if(e.type==='nitro'||c.nitro<=0)this.show(e.type,e.type==='nitro'?'NITRO BOOST!':'MINI BOOST');for(let i=0;i<(low?6:14);i++)this.emit(c,'jet',low,true);}
    if(['lane-left','lane-right','lane-center'].includes(e.type)){this.lastLane=c.laneChoice;this.laneCooldown=.5;this.show('lane',e.type==='lane-center'?'Center lane':e.type==='lane-left'?'Left lane':'Right lane',e.direction??(e.type==='lane-left'?-1:e.type==='lane-right'?1:0));}
    if(e.type==='turn-left'||e.type==='turn-right')this.show('turn',e.type==='turn-left'?'Turn left':'Turn right',e.type==='turn-left'?-1:1);
    if(e.type==='hit')for(let i=0;i<(low?4:10);i++)this.emit(c,'spark',low,true);
    if(e.type==='reset'){this.boostPulse=0;this.speedLines=0;this.feedback.remaining=0;this.signalDirection=0;this.signalRemaining=0;this.passArmed.fill(false);}
   }
   // Keyboard and gesture driving share the same gentle lane confirmation.
   const lane=c.lane>1.6?1:c.lane< -1.6?-1:Math.abs(c.lane)<.6?0:this.lastLane;
   if(!race.playerActionControl&&lane!==this.lastLane){const direction=Math.sign(lane-this.lastLane);this.lastLane=lane;if(this.laneCooldown===0){this.laneCooldown=.5;this.show('lane',lane<0?'Left lane':lane>0?'Right lane':'Center lane',direction);}}
   for(const other of race.cars.slice(1)){
    const id=other.id,gap=other.progress-c.progress;this.passCooldown[id]=Math.max(0,this.passCooldown[id]-dt);
    if(gap>CONFIG.effects.overtakeMargin)this.passArmed[id]=true;
    if(this.passArmed[id]&&gap< -CONFIG.effects.overtakeMargin){
     this.passArmed[id]=false;
     if(this.passCooldown[id]===0&&c.speed>8&&other.finishTime===null&&Math.hypot(c.x-other.x,c.z-other.z)<16){this.overtakes++;passed=true;this.passCooldown[id]=CONFIG.effects.overtakeCooldown;this.show('overtake','NICE PASS!');}
    }
   }
   for(const car of race.cars){
    if(Math.hypot(car.x-c.x,car.z-c.z)>38)continue;const e=this.emissions[car.id];
    const sliding=car.drifting&&car.speed>8&&Math.abs(car.slip)>.09;
    e.smoke+=sliding?dt*CONFIG.effects.smokeRate*(car.id===0?1:.5)*(low?.5:1):0;
    e.spark+=sliding?dt*(car.id===0?9:4)*(low?.5:1):0;
    e.jet+=car.nitro>0||car.mini>0?dt*CONFIG.effects.jetRate*(car.id===0?1:.4)*(low?.5:1):0;
    for(const kind of ['smoke','spark','jet'] as const)while(e[kind]>=1){e[kind]--;this.emit(car,kind,low);}
   }
   if(c.drifting&&c.speed>8&&Math.abs(c.slip)>.09&&this.time-this.lastSkid>.035){
    this.lastSkid=this.time;
    for(const side of [-1,1]){const fx=Math.sin(c.yaw),fz=Math.cos(c.yaw);this.dummy.position.set(c.x-fx*.8-fz*.61*side,.036,c.z-fz*.8+fx*.61*side);this.dummy.rotation.set(-Math.PI/2,0,c.yaw);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();this.skids.setMatrixAt(this.nextSkid++%CONFIG.effects.skidMarks,this.dummy.matrix);this.skidCount=Math.min(CONFIG.effects.skidMarks,this.skidCount+1);}
    this.skids.instanceMatrix.needsUpdate=true;
   }
  }
  const target=active?(c.nitro>0?1:c.mini>0?.55:0):0;this.speedLines+=(target-this.speedLines)*(1-Math.exp(-dt*10));
  for(let i=0;i<this.particles.length;i++){
   const p=this.particles[i];if(low&&i>=CONFIG.effects.lowParticles){p.sprite.visible=false;continue;}if(!p.sprite.visible)continue;
   p.age+=dt;p.sprite.position.x+=p.vx*dt;p.sprite.position.z+=p.vz*dt;p.sprite.position.y+=p.vy*dt;
   if(p.kind==='confetti')p.vy-=dt*4;p.sprite.material.rotation+=p.spin*dt;this.drawParticle(p);
  }
  return passed;
 }
 snapshot(){
  const visible=this.particles.filter(p=>p.sprite.visible);
  return {particles:visible.length,smoke:visible.filter(p=>p.kind==='smoke').length,sparks:visible.filter(p=>p.kind==='spark').length,jets:visible.filter(p=>p.kind==='jet').length,confetti:visible.filter(p=>p.kind==='confetti').length,skids:this.skidCount,overtakes:this.overtakes,boostPulse:+this.boostPulse.toFixed(3),speedLines:+this.speedLines.toFixed(3),feedback:{...this.feedback},turnSignal:this.turnSignal,time:+this.time.toFixed(3),reducedMotion:this.reducedMotion};
 }
 reset(){
  for(const p of this.particles)p.sprite.visible=false;
  this.dummy.scale.setScalar(0);this.dummy.updateMatrix();for(let i=0;i<CONFIG.effects.skidMarks;i++)this.skids.setMatrixAt(i,this.dummy.matrix);this.skids.instanceMatrix.needsUpdate=true;
  this.time=0;this.skidCount=0;this.nextParticle=0;this.nextSkid=0;this.lastSkid=0;this.boostPulse=0;this.speedLines=0;this.overtakes=0;this.celebrated=false;this.lastLane=0;this.laneCooldown=0;this.feedback={kind:'',text:'',direction:0,remaining:0};
  this.signalDirection=0;this.signalRemaining=0;this.signalElapsed=0;
  this.passArmed.fill(false);this.passCooldown.fill(0);for(const e of this.emissions)e.smoke=e.spark=e.jet=0;
 }
}
