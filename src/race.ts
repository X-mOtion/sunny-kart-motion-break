import {CONFIG,clamp,emptyInput,mod,wrapAngle,type Difficulty,type InputFrame} from './config';
import {Track} from './track';
export type Phase='menu'|'countdown'|'racing'|'paused'|'finished';
export interface Car {
 id:number;x:number;z:number;prevX:number;prevZ:number;yaw:number;prevYaw:number;vx:number;vz:number;speed:number;yawRate:number;steer:number;
 s:number;progress:number;nextGate:number;lap:number;lapStart:number;lapTimes:number[];finishTime:number|null;penalty:number;
 drifting:boolean;driftTime:number;validDrift:number;slip:number;charge:number;cards:number;nitro:number;mini:number;
 collision:number;stuck:number;recoveries:number;lastProgress:number;lane:number;laneChoice:number;laneChanges:number;turnDirection:number;turnRemaining:number;turnEvents:number;lastBoost:boolean;miniEvents:number;nitroEvents:number;
}
export class Race {
 phase:Phase='menu'; beforePause:Phase='racing'; pauseReason=''; countdown=3; time=0; difficulty:Difficulty='easy'; seed=1;playerActionControl=false;
 cars:Car[]=[]; finishOrder:number[]=[]; events:{type:string,id:number,direction?:number}[]=[];
 constructor(public track:Track) {this.reset();this.phase='menu';}
 reset(difficulty:Difficulty=this.difficulty, seed=1) {
  this.difficulty=difficulty;this.seed=seed;this.time=0;this.countdown=3;this.finishOrder=[];this.events=[];this.playerActionControl=false;
  this.cars=Array.from({length:6},(_,id)=>{
    const boulevard=this.track.wideRoad;
    const progress=boulevard?(id===0?-65:-12-(id-1)*10):-9-Math.floor(id/2)*5.5,p=this.track.at(progress);
    const lane=boulevard?(id===0?0:[0,-1,1,-1,1][id-1]*this.track.definition.laneRange):(id%2===0?-1:1)*2.1;
    return {id,x:p.x+p.nx*lane,z:p.z+p.nz*lane,prevX:p.x+p.nx*lane,prevZ:p.z+p.nz*lane,yaw:p.yaw,prevYaw:p.yaw,vx:0,vz:0,speed:0,yawRate:0,steer:0,s:p.s,progress,nextGate:0,lap:0,lapStart:0,lapTimes:[],finishTime:null,penalty:0,drifting:false,driftTime:0,validDrift:0,slip:0,charge:0,cards:0,nitro:0,mini:0,collision:0,stuck:0,recoveries:0,lastProgress:progress,lane,laneChoice:0,laneChanges:0,turnDirection:0,turnRemaining:0,turnEvents:0,lastBoost:false,miniEvents:0,nitroEvents:0};
  });this.phase='countdown';this.pauseReason='';
 }
 pause(reason='Ride paused') {if(this.phase==='racing'||this.phase==='countdown'){this.beforePause=this.phase;this.phase='paused';this.pauseReason=reason;this.cars.forEach(c=>this.cancelDrift(c));}}
 resume(){if(this.phase==='paused'){this.phase='countdown';this.countdown=3;}}
 cancelDrift(c:Car){c.drifting=false;c.driftTime=0;c.validDrift=0;}
 setActionControl(enabled:boolean){
  this.playerActionControl=enabled;
  if(!enabled){const c=this.cars[0];c.laneChoice=0;c.turnRemaining=0;c.turnDirection=0;}
 }
 respawn(c:Car) {
  if(c.finishTime!==null)return;
  const previous=this.track.length/CONFIG.checkpoints;
  // Keep the player's earned position, but never skip the next ordered gate.
  const progress=c.id===0?clamp(c.progress,c.nextGate-previous+.5,c.nextGate-.5):c.nextGate===0?-8:c.nextGate-previous+3;
  const p=this.track.at(progress),keepLane=c.id===0&&this.playerActionControl,lane=keepLane?c.laneChoice*this.track.definition.laneRange:(c.id%2===0?-1:1)*1.6;
  const speed=c.id===0?CONFIG.casual.recoverySpeed:0;
  Object.assign(c,{x:p.x+p.nx*lane,z:p.z+p.nz*lane,prevX:p.x+p.nx*lane,prevZ:p.z+p.nz*lane,yaw:p.yaw,prevYaw:p.yaw,vx:p.tx*speed,vz:p.tz*speed,speed,yawRate:0,s:p.s,progress,lastProgress:progress,lane,laneChoice:keepLane?c.laneChoice:0,turnDirection:0,turnRemaining:0,steer:0,stuck:0,nitro:0,mini:0,collision:0});
  if(c.id!==0)c.penalty+=CONFIG.car.respawnPenalty;c.recoveries++;this.cancelDrift(c);this.events.push({type:'reset',id:c.id});
 }
 // Steering selects a comfortable lateral position. Road following handles the turn itself.
 assistedInput(c:Car,input:InputFrame,dt:number):InputFrame {
  // An absent command is silence, not a request to switch back to keyboard centring.
  if(input.actionControl!==undefined)this.setActionControl(input.actionControl);
  input={...input,actionControl:this.playerActionControl};
  const q=this.track.nearest(c.x,c.z,c.s),speed=Math.max(0,c.speed);
  let curvature=0;for(let d=0;d<=36;d+=4)curvature=Math.max(curvature,Math.abs(this.track.curvature(c.s+d)));
  const laneRange=this.track.definition.laneRange/(1+curvature*12);
  if(input.actionControl&&input.directionAction){
   const next=clamp(c.laneChoice+input.directionAction,-1,1);
   if(next!==c.laneChoice){c.laneChoice=next;c.laneChanges++;this.events.push({type:next<0?'lane-left':next>0?'lane-right':'lane-center',id:c.id,direction:input.directionAction});}
   else this.events.push({type:'lane-edge',id:c.id});
  }
  c.turnRemaining=Math.max(0,c.turnRemaining-dt);
  if(input.actionControl&&input.turnAction){c.turnDirection=input.turnAction;c.turnRemaining=CONFIG.casual.turnDuration;c.turnEvents++;this.events.push({type:input.turnAction<0?'turn-left':'turn-right',id:c.id});}
  const turn=c.turnRemaining>0?c.turnDirection*CONFIG.casual.turnStrength*Math.min(1,(CONFIG.casual.turnDuration-c.turnRemaining+dt)/.08)*Math.min(1,c.turnRemaining/.35):0;
  const laneTarget=(input.actionControl?c.laneChoice:clamp(input.steer,-1,1))*laneRange;
  c.lane+=(laneTarget-c.lane)*(1-Math.exp(-dt*(input.actionControl?CONFIG.casual.actionLaneSmoothing:CONFIG.casual.laneSmoothing)));
  const look=clamp(5+speed*.32,6,14),p=this.track.at(c.s+look);
  const error=wrapAngle(Math.atan2(p.x+p.nx*c.lane-c.x,p.z+p.nz*c.lane-c.z)-c.yaw);
  const top=c.nitro>0?CONFIG.casual.nitroSpeed:c.mini>0?CONFIG.casual.miniSpeed:CONFIG.casual.topSpeed;
  const cornerAcceleration=this.track.wideRoad?CONFIG.casual.cornerAcceleration:CONFIG.casual.cityCornerAcceleration;
  const target=Math.min(top,Math.sqrt(cornerAcceleration/Math.max(.006,curvature)));
  const margin=q.width/2-CONFIG.car.radius-.6;
  const closeToWall=Math.abs(q.lateral)>margin;
  return {...input,steer:clamp(-error*2.8+(c.drifting?c.slip*.9:0)+turn,-1,1),
    throttle:speed>target?Math.min(input.throttle,.1):input.throttle,
    brake:Math.max(input.brake,speed>target+1?clamp((speed-target)/5,0,1):0),
    drift:(input.actionControl?input.throttle>0&&curvature>.027&&curvature<.085&&speed>13:input.drift)&&!closeToWall&&Math.abs(error)<.65};
 }
 ranking(){return [...this.cars].sort((a,b)=>{
  if(a.finishTime!==null||b.finishTime!==null){if(a.finishTime===null)return 1;if(b.finishTime===null)return -1;return a.finishTime-b.finishTime;}
  return Math.min(b.progress,b.nextGate)-Math.min(a.progress,a.nextGate);
 });}
 bot(c:Car):InputFrame {
  if(c.finishTime!==null)return emptyInput();
  const track=this.track, q=track.nearest(c.x,c.z,c.s), speed=Math.max(0,c.speed);
  let curvature=0;for(let d=3;d<=40;d+=5)curvature=Math.max(curvature,Math.abs(track.curvature(c.s+d)));
  const strategy=CONFIG.ai[this.difficulty],skill=strategy.pace;
  const personal=.975+Math.sin(c.id*17.1+this.seed*2.3)*.02;
  const boulevard=track.wideRoad;
  // Wide-road companions share the player's corner budget and stay near their cruising pace.
  const casual=CONFIG.ai.casual;
  const cruise=boulevard?CONFIG.casual.topSpeed*(casual.cruiseBase+c.id*casual.cruisePerCar+casual.cruiseVariation*Math.sin(this.time/14+c.id*1.7)):CONFIG.car.topSpeed;
  const pace=boulevard?1+(skill-CONFIG.ai.easy.pace)*casual.paceGain:skill;
  const cornerAcceleration=boulevard?CONFIG.casual.cornerAcceleration:12;
  const targetSpeed=Math.min(cruise,Math.sqrt(cornerAcceleration/Math.max(.006,curvature)))*pace*personal;
  const near=this.cars.find(o=>o.id!==c.id&&o.finishTime===null&&o.progress>c.progress&&o.progress-c.progress<15&&Math.hypot(o.x-c.x,o.z-c.z)<16);
  const preferred=boulevard?(near?(near.lane>=0?-1:1):[0,-1,1,-1,1][c.id-1]??0)*track.definition.laneRange:near?(near.lane>=0?-2:2):Math.sin(c.id*3.1+this.seed)*1.5;
  c.lane+=(preferred-c.lane)*.02;
  const look=clamp(CONFIG.ai.lookAheadBase+speed*CONFIG.ai.lookAheadSpeedFactor,7,18),p=track.at(c.s+look),dx=p.x+p.nx*c.lane-c.x,dz=p.z+p.nz*c.lane-c.z;
  const error=wrapAngle(Math.atan2(dx,dz)-c.yaw);
  const drifting=curvature>strategy.driftCurve&&curvature<.085&&speed>14&&Math.abs(error)>.16&&Math.abs(q.lateral)<3.5&&c.collision<=0;
  const drift=drifting&&(c.driftTime<strategy.driftHold||Math.abs(error)>.38);
  const steer=clamp(-error*CONFIG.ai.steeringGain+(c.drifting?c.slip*.75:0),-1,1);
  return {steer,throttle:speed<targetSpeed?1:.08,brake:speed>targetSpeed+1.5?clamp((speed-targetSpeed)/7,0,1):0,drift,boost:curvature<strategy.nitroCurve&&speed>strategy.nitroSpeed&&c.cards>0&&c.nitro<=0};
 }
 tick(dt:number,input:InputFrame,autopilot=false) {
  this.events=[];
  if(this.phase==='countdown'){this.countdown-=dt;if(this.countdown<=0){this.phase='racing';this.events.push({type:'go',id:0});}return;}
  if(this.phase!=='racing')return;
  this.time+=dt;
  for(const c of this.cars) {
   c.prevX=c.x;c.prevZ=c.z;c.prevYaw=c.yaw;
   if(c.finishTime!==null)continue;
   const controls=c.id===0&&!autopilot?input:this.bot(c);
   const assisted=c.id===0&&!autopilot,driving=assisted?this.assistedInput(c,controls,dt):controls;
   if(assisted&&controls.drift&&!driving.drift)this.cancelDrift(c);
   this.drive(c,driving,dt,assisted);
  }
  for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){
   const a=this.cars[i],b=this.cars[j];if(a.finishTime!==null||b.finishTime!==null)continue;
   const dx=b.x-a.x,dz=b.z-a.z,dist=Math.hypot(dx,dz),min=CONFIG.car.radius*2;
   if(dist<min&&dist>.001){const nx=dx/dist,nz=dz/dist,push=(min-dist)*.5;a.x-=nx*push;a.z-=nz*push;b.x+=nx*push;b.z+=nz*push;
    const rel=(a.vx-b.vx)*nx+(a.vz-b.vz)*nz;if(rel>0){const impact=i===0&&!autopilot?.15:.6;a.vx-=nx*rel*impact;a.vz-=nz*rel*impact;b.vx+=nx*rel*.6;b.vz+=nz*rel*.6;}
    for(const c of [a,b]){c.collision=.2;this.cancelDrift(c);}
   }
  }
  for(const c of this.cars){if(c.finishTime!==null)continue;this.updateProgress(c,dt);
   const casual=c.id===0&&!autopilot,wantsMove=!casual||input.throttle>.1&&input.brake<.8;
   if(wantsMove&&c.progress-c.lastProgress<dt*.75)c.stuck+=dt;else c.stuck=0;
   c.lastProgress=c.progress;if(c.stuck>(casual?CONFIG.casual.recoverySeconds:CONFIG.ai.recoverySeconds))this.respawn(c);
  }
  if(this.cars[0].finishTime!==null)this.phase='finished';
 }
 drive(c:Car,input:InputFrame,dt:number,assisted=false) {
  const responsive=assisted&&input.actionControl;
  const steer=clamp(input.steer,-1,1);c.steer+=(steer-c.steer)*(1-Math.exp(-dt*(responsive?CONFIG.casual.actionSteerResponse:10)));
  c.collision=Math.max(0,c.collision-dt);c.nitro=Math.max(0,c.nitro-dt);c.mini=Math.max(0,c.mini-dt);
  if(input.boost&&!c.lastBoost){
   if(input.actionControl&&c.id===0){c.nitro=CONFIG.casual.shrugBurstDuration;c.nitroEvents++;this.events.push({type:'nitro',id:c.id});}
   else if(c.cards>0&&c.nitro<=0){c.cards--;c.nitro=CONFIG.car.nitroDuration;c.nitroEvents++;this.events.push({type:'nitro',id:c.id});}
  }c.lastBoost=input.boost;
  const wasDrift=c.drifting;
  c.drifting=input.drift&&c.speed>CONFIG.car.driftMinSpeed&&(Math.abs(c.steer)>.12||wasDrift)&&c.collision<=0;
  if(wasDrift&&!c.drifting){if(!input.drift&&c.validDrift>=CONFIG.car.driftMinTime&&c.collision<=0){c.mini=CONFIG.car.miniDuration;c.miniEvents++;this.events.push({type:'mini',id:c.id});}c.driftTime=0;c.validDrift=0;}
  if(c.drifting)c.driftTime+=dt;
  const maxYaw=Math.min(Math.abs(c.speed)*.105,1.45)/(1+Math.abs(c.speed)*.014);
  const driftGain=c.drifting?(assisted?1.05:CONFIG.drift.initialYawGain+Math.min(c.driftTime,CONFIG.drift.growthSeconds)*CONFIG.drift.yawGainPerSecond):1;
  const desiredYaw=-c.steer*maxYaw*driftGain*(c.speed<0?-1:1);
  c.yawRate+=(desiredYaw-c.yawRate)*(1-Math.exp(-dt*(responsive?CONFIG.casual.actionYawResponse:7)));c.yaw=wrapAngle(c.yaw+c.yawRate*dt);
  const fx=Math.sin(c.yaw),fz=Math.cos(c.yaw),rx=-fz,rz=fx;
  let longitudinal=c.vx*fx+c.vz*fz, lateral=c.vx*rx+c.vz*rz;
  const boost=c.nitro>0?1:c.mini>0?.55:0;
  longitudinal+=clamp(input.throttle,0,1)*(CONFIG.car.acceleration+boost*13)*dt;
  if(input.brake>0){if(longitudinal>1)longitudinal=Math.max(0,longitudinal-CONFIG.car.brake*input.brake*dt);else if(input.throttle===0)longitudinal=Math.max(-6,longitudinal-6*dt);}
  longitudinal*=Math.exp(-dt*(input.throttle>0?.055:.34));
  if(c.drifting)longitudinal*=Math.exp(-dt*.105);
  const limits=assisted?CONFIG.casual:CONFIG.car;
  const top=c.nitro>0?limits.nitroSpeed:c.mini>0?limits.miniSpeed:limits.topSpeed;
  if(longitudinal>top)longitudinal=Math.max(top,longitudinal-18*dt);
  lateral*=Math.exp(-dt*(c.drifting?(assisted?CONFIG.casual.slidingGrip:CONFIG.drift.slidingGrip):CONFIG.drift.normalGrip));
  c.vx=fx*longitudinal+rx*lateral;c.vz=fz*longitudinal+rz*lateral;
  if(assisted){
   const q=this.track.nearest(c.x,c.z,c.s),future=this.track.nearest(c.x+c.vx*.45,c.z+c.vz*.45,c.s);
   const margin=q.width/2-CONFIG.car.radius-1.4;
   const risk=Math.max(Math.abs(q.lateral),Math.abs(future.lateral));
   const help=clamp((risk-margin)/1.5,0,1)*(1-Math.exp(-dt*12));
   if(help>0){
    const forward=Math.max(0,c.vx*q.tx+c.vz*q.tz),inward=clamp((c.lane-q.lateral)*2,-5,5);
    c.vx+=(q.tx*forward+q.nx*inward-c.vx)*help;c.vz+=(q.tz*forward+q.nz*inward-c.vz)*help;
    c.yaw=wrapAngle(c.yaw+wrapAngle(q.yaw-c.yaw)*help);c.yawRate*=1-help;
   }
  }
  const magnitude=Math.hypot(c.vx,c.vz);if(magnitude>top*1.04){c.vx*=top*1.04/magnitude;c.vz*=top*1.04/magnitude;}
  c.slip=Math.atan2(lateral,Math.max(1,Math.abs(longitudinal)));
  if(c.drifting&&longitudinal>(assisted?8:12)&&Math.abs(c.slip)>(assisted?.045:.12)&&Math.abs(c.slip)<1.1){c.validDrift+=dt;if(c.cards<2){c.charge+=CONFIG.car.chargeRate*dt;if(c.charge>=100){c.charge-=100;c.cards++;if(c.cards===2)c.charge=0;this.events.push({type:'charge',id:c.id});}}}
  const substeps=Math.max(1,Math.ceil(Math.hypot(c.vx,c.vz)*dt/.45));
  for(let n=0;n<substeps;n++){
   c.x+=c.vx*dt/substeps;c.z+=c.vz*dt/substeps;
   const q=this.track.nearest(c.x,c.z,c.s), edge=q.width/2+1-CONFIG.car.radius;
   if(Math.abs(q.lateral)>q.width/2){c.vx*=Math.exp(-dt*1.7/substeps);c.vz*=Math.exp(-dt*1.7/substeps);}
   if(Math.abs(q.lateral)>edge){const sign=Math.sign(q.lateral),nx=q.nx*sign,nz=q.nz*sign;
    c.x=q.x+nx*edge;c.z=q.z+nz*edge;const out=c.vx*nx+c.vz*nz;
    if(out>0){c.vx-=nx*out*1.15;c.vz-=nz*out*1.15;c.vx*=.94;c.vz*=.94;if(out>2&&c.collision<=0)this.events.push({type:'hit',id:c.id});}
    c.collision=.3;this.cancelDrift(c);
    if(assisted){
     // A soft barrier redirects motion along the road instead of trapping the nose.
     const forward=clamp(Math.hypot(c.vx,c.vz)*.8,CONFIG.casual.recoverySpeed,CONFIG.casual.topSpeed);
     c.yaw=q.yaw;c.yawRate=0;c.steer=0;c.vx=q.tx*forward-q.nx*sign*2;c.vz=q.tz*forward-q.nz*sign*2;
    }
   }
  }
  c.speed=Math.hypot(c.vx,c.vz)*(longitudinal<0?-1:1);
 }
 updateProgress(c:Car,dt:number){
  const q=this.track.nearest(c.x,c.z,c.s);let delta=q.s-c.s;if(delta>this.track.length/2)delta-=this.track.length;if(delta<-this.track.length/2)delta+=this.track.length;
  const old=c.progress;c.s=q.s;
  if(Math.abs(delta)>Math.max(3,Math.abs(c.speed)*dt+2))return;
  c.progress+=delta;
  if(old<c.nextGate&&c.progress>=c.nextGate&&delta>0&&Math.abs(q.lateral)<q.width/2+1&&c.vx*q.tx+c.vz*q.tz>0){
   const gateIndex=Math.round(c.nextGate/(this.track.length/CONFIG.checkpoints));
   if(gateIndex>0&&gateIndex%CONFIG.checkpoints===0){c.lap++;c.lapTimes.push(this.time+c.penalty-c.lapStart);c.lapStart=this.time+c.penalty;this.events.push({type:'lap',id:c.id});
    if(c.lap>=CONFIG.laps){c.finishTime=this.time+c.penalty;this.finishOrder.push(c.id);c.vx=0;c.vz=0;c.speed=0;this.events.push({type:'finish',id:c.id});}}
   c.nextGate+=this.track.length/CONFIG.checkpoints;
  }
 }
 snapshot(){const rank=this.ranking();return {phase:this.phase,drivingStyle:'casual',roadAssist:true,time:+this.time.toFixed(2),countdown:Math.ceil(this.countdown),difficulty:this.difficulty,coordinates:'meters; ground X/Z, Y up; steer +1 = screen right',trackId:this.track.id,trackName:this.track.definition.name,trackLength:this.track.length,playerRank:rank.findIndex(c=>c.id===0)+1,cars:this.cars.map(c=>({id:c.id,x:+c.x.toFixed(2),z:+c.z.toFixed(2),yaw:+c.yaw.toFixed(3),speedKmh:+(c.speed*3.6).toFixed(1),progress:+c.progress.toFixed(1),lap:Math.min(3,c.lap+1),nextCheckpoint:Math.round(c.nextGate/(this.track.length/24))%24,laneChoice:c.laneChoice,laneChanges:c.laneChanges,turnDirection:c.turnRemaining>0?c.turnDirection:0,turnRemaining:+c.turnRemaining.toFixed(2),turnEvents:c.turnEvents,drift:c.drifting,slip:+c.slip.toFixed(2),charge:+c.charge.toFixed(1),cards:c.cards,nitro:+c.nitro.toFixed(2),mini:+c.mini.toFixed(2),penalty:c.penalty,finishTime:c.finishTime,recoveries:c.recoveries}))};}
}
