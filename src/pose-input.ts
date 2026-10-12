import {CONFIG,clamp,type InputFrame} from './config';
export interface Landmark {x:number;y:number;z?:number;visibility?:number;presence?:number}

/** Head + shoulder control. No wrist, hand or hip confidence is required. */
export class PoseInput {
  neutral=0;neutralHeight=1;headHeight=1;neutralX=[.5,.62,.38];neutralWidth=.24;motion=[0,0,0];calibrated=false;calibrating=true;calibrationProgress=0;sensitivity=1;
  steer=0;drift=false;boost=false;resume=false;valid=false;lastGood=-Infinity;lastTime=0;stableSince=-1;
  samples:{time:number;angle:number;height:number;xs:number[];width:number;ys:number[];faceRolls:Record<string,number>;shoulderRoll:number;headRoll:number}[]=[];
  directionAction: -1|0|1=0;directionArmed=false;directionCandidate=0;directionSince=-1;centerSince=-1;lastDirection=0;lastDirectionAt=-Infinity;
  neutralHeadRoll=0;neutralHeadPosition=0;neutralShoulderRoll=0;faceTilt=0;headTilt=0;shoulderTilt=0;faceReferences:Record<string,number>={};faceVisible=false;lastFaceGood=-Infinity;faceReferenceSince=-1;turnAction: -1|0|1=0;turnArmed=false;turnCandidate=0;turnSince=-1;turnCenterSince=-1;lastTurn=0;lastTurnAt=-Infinity;
  nodPhase:'ready'|'down'|'cooldown'='ready';nodSince=-1;nodReleaseSince=-1;lastNod=-Infinity;
  neutralY=[.25,.55,.55];vertical=[0,0,0];shrugRestLift=[0,0];shrugRestClose=[0,0];shrugArmed=false;shrugSince=-1;shrugReleaseSince=-1;lastShrug=-Infinity;
  message='Show your head and shoulders to auto-fit';

  reset(){this.steer=0;this.drift=false;this.boost=false;this.resume=false;this.shrugArmed=false;this.shrugSince=-1;this.shrugReleaseSince=-1;this.shrugRestLift=[0,0];this.shrugRestClose=[0,0];this.turnAction=0;this.turnArmed=false;this.turnCandidate=0;this.turnSince=-1;this.turnCenterSince=-1;this.directionAction=0;this.directionArmed=false;this.directionCandidate=0;this.directionSince=-1;this.centerSince=-1;this.motion=[0,0,0];this.vertical=[0,0,0];this.lastDirection=0;this.lastDirectionAt=-Infinity;this.faceTilt=0;this.headTilt=0;this.shoulderTilt=0;this.lastTurn=0;this.lastTurnAt=-Infinity;this.nodPhase='cooldown';this.nodSince=-1;this.nodReleaseSince=-1;}
  calibrate(){this.reset();this.shrugRestClose=[0,0];this.faceReferences={};this.faceVisible=false;this.lastFaceGood=-Infinity;this.faceReferenceSince=-1;this.samples=[];this.calibrating=true;this.calibrated=false;this.calibrationProgress=0;this.stableSince=-1;this.message='Look at the screen with your head and shoulders in view';}

  consume(l:Landmark[],now:number,aspect=4/3){
    const good=(i:number)=>l[i]&&(l[i].visibility??1)>=CONFIG.pose.confidence&&(l[i].presence??1)>=.5;
    this.valid=!!(good(0)&&good(11)&&good(12));
    const dt=this.lastTime?clamp(now-this.lastTime,1,150):50;this.lastTime=now;
    if(!this.valid){
      this.stableSince=-1;this.samples=[];this.calibrationProgress=0;this.nodPhase='cooldown';this.nodReleaseSince=-1;this.boost=false;this.resume=false;this.shrugArmed=false;this.shrugSince=-1;this.shrugReleaseSince=-1;this.drift=false;this.turnAction=0;this.turnArmed=false;this.turnCandidate=0;this.turnSince=-1;this.turnCenterSince=-1;this.directionAction=0;this.directionArmed=false;this.directionSince=-1;this.centerSince=-1;
      this.message='Move your head and shoulders back into view';return;
    }
    this.lastGood=now;if(this.stableSince<0)this.stableSince=now;
    const a=l[11],b=l[12],nose=l[0],mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    const left=a.x<b.x?a:b,right=a.x<b.x?b:a;
    const sx=(right.x-left.x)*aspect,sy=right.y-left.y,width=Math.max(.06,Math.hypot(sx,sy));
    const head=Math.atan2((nose.x-mx)*aspect,Math.max(.04,my-nose.y))*180/Math.PI;
    const shoulders=Math.atan2(sy,sx)*180/Math.PI;
    const angle=head*.75+shoulders*.25;
    const faceGood=(i:number)=>l[i]&&(l[i].visibility??1)>=CONFIG.pose.faceConfidence&&(l[i].presence??1)>=.5;
    const faces:{source:string;roll:number;weight:number}[]=[],faceRolls:Record<string,number>={};
    // Fit every visible eye/ear pair, so fallback never treats a tilted frame as neutral.
    for(const [source,i,j] of [['eyes',2,5],['inner-eyes',1,4],['outer-eyes',3,6],['ears',7,8]] as const){
      if(!faceGood(i)||!faceGood(j))continue;const pair=[l[i],l[j]].sort((a,b)=>a.x-b.x),span=(pair[1].x-pair[0].x)*aspect;
      if(span<.025)continue;const roll=Math.atan2(pair[1].y-pair[0].y,span)*180/Math.PI;
      faceRolls[source]=roll;faces.push({source,roll,weight:span*Math.min(l[i].visibility??1,l[j].visibility??1)});
    }
    this.faceVisible=faces.length>0;if(this.faceVisible)this.lastFaceGood=now;
    // Project onto the shoulder-line normal: sideways leaning should not look like nodding.
    const height=((nose.x-mx)*aspect*sy-(nose.y-my)*sx)/(width*width);
    if(this.calibrating){
      const xs=[nose.x,a.x,b.x],rawWidth=Math.abs(a.x-b.x);
      this.samples.push({time:now,angle,height,xs,width:rawWidth,ys:[nose.y,a.y,b.y],faceRolls,shoulderRoll:shoulders,headRoll:head});this.samples=this.samples.filter(v=>now-v.time<650);
      const mean=this.samples.reduce((s,v)=>s+v.angle,0)/this.samples.length;
      if(this.samples.some(v=>Math.abs(v.angle-mean)>7||Math.abs((v.xs[1]+v.xs[2]-a.x-b.x)/2)>rawWidth*.12))this.samples=this.samples.slice(-2);
      this.calibrationProgress=clamp((now-this.samples[0].time)/CONFIG.pose.autoFitMs,0,1);
      this.message='Found you · Fitting your posture';
      if(this.calibrationProgress>=1&&this.samples.length>=5){
        const middle=Math.floor(this.samples.length/2);
        this.neutral=[...this.samples].sort((a,b)=>a.angle-b.angle)[middle].angle;
        this.neutralShoulderRoll=[...this.samples].sort((a,b)=>a.shoulderRoll-b.shoulderRoll)[middle].shoulderRoll;
        this.neutralX=[0,1,2].map(i=>[...this.samples].sort((a,b)=>a.xs[i]-b.xs[i])[middle].xs[i]);
        this.neutralY=[0,1,2].map(i=>[...this.samples].sort((a,b)=>a.ys[i]-b.ys[i])[middle].ys[i]);
        this.neutralHeadPosition=[...this.samples].sort((a,b)=>a.headRoll-b.headRoll)[middle].headRoll;
        for(const source of ['eyes','inner-eyes','outer-eyes','ears']){const values=this.samples.map(v=>v.faceRolls[source]).filter(v=>v!==undefined).sort((a,b)=>a-b);if(values.length)this.faceReferences[source]=values[Math.floor(values.length/2)];}
        this.neutralWidth=Math.max(.08,[...this.samples].sort((a,b)=>a.width-b.width)[middle].width);
        this.neutralHeight=[...this.samples].sort((a,b)=>a.height-b.height)[middle].height;this.headHeight=this.neutralHeight;
        this.calibrated=true;this.calibrating=false;this.reset();this.message='Ready · Head tilt for lanes, shoulders for turns';
      }
      return;
    }
    if(!this.calibrated)return;
    const smooth=1-Math.exp(-dt/CONFIG.pose.smoothMs);
    this.headHeight+=(height-this.headHeight)*smooth;
    const dip=this.neutralHeight-this.headHeight;
    // Keep translation values only for diagnostics. Driving commands are classified by angles.
    const xs=[nose.x,a.x,b.x];
    for(let i=0;i<3;i++)this.motion[i]+=(-(xs[i]-this.neutralX[i])/this.neutralWidth-this.motion[i])*smooth;
    const rawShoulder=-(shoulders-this.neutralShoulderRoll),shoulderSmooth=1-Math.exp(-dt/CONFIG.pose.shoulderSmoothMs);this.shoulderTilt+=(rawShoulder-this.shoulderTilt)*shoulderSmooth;
    let referenced=faces.filter(f=>this.faceReferences[f.source]!==undefined);
    if(referenced.length){
      const weight=referenced.reduce((s,f)=>s+f.weight,0),delta=referenced.reduce((s,f)=>s+(f.roll-this.faceReferences[f.source])*f.weight,0)/weight;
      for(const f of faces)if(this.faceReferences[f.source]===undefined)this.faceReferences[f.source]=f.roll-delta;
      referenced=faces;
    }else if(faces.length&&Math.abs(head-this.neutralHeadPosition)<CONFIG.pose.laneTiltRelease/this.sensitivity&&Math.abs(rawShoulder)<CONFIG.pose.shoulderTurnRelease/this.sensitivity){
      if(this.faceReferenceSince<0)this.faceReferenceSince=now;
      if(now-this.faceReferenceSince>=CONFIG.pose.gestureRearmMs){for(const f of faces)this.faceReferences[f.source]=f.roll;referenced=faces;}
    }else this.faceReferenceSince=-1;
    this.faceVisible=referenced.length>0;let rawNeck=0;
    if(this.faceVisible){
      const weight=referenced.reduce((s,f)=>s+f.weight,0),rawFace=-referenced.reduce((s,f)=>s+(f.roll-this.faceReferences[f.source])*f.weight,0)/weight;
      this.neutralHeadRoll=referenced.reduce((s,f)=>s+this.faceReferences[f.source]*f.weight,0)/weight;
      const headSmooth=1-Math.exp(-dt/CONFIG.pose.headSmoothMs);this.faceTilt+=(rawFace-this.faceTilt)*headSmooth;
      // Subtract shoulder roll before filtering, avoiding different smoothing delays on a whole-body lean.
      rawNeck=rawFace-rawShoulder;this.headTilt+=(rawNeck-this.headTilt)*headSmooth;
    }else {this.directionAction=0;if(now-this.lastFaceGood>=CONFIG.pose.faceGraceMs)this.directionArmed=false;this.directionCandidate=0;this.directionSince=-1;this.centerSince=-1;this.faceTilt=0;this.headTilt=0;}

    const ys=[nose.y,a.y,b.y],verticalScale=this.neutralWidth*aspect;
    const rawVertical=ys.map((y,i)=>(this.neutralY[i]-y)/verticalScale);
    const shrugSensitivity=clamp(this.sensitivity,.8,1.35),liftEnter=CONFIG.pose.shrugLift/shrugSensitivity,closeEnter=CONFIG.pose.shrugClose/shrugSensitivity;
    const rawShoulders=rawVertical.slice(1),rawRelative=rawShoulders.map(v=>v-rawVertical[0]);
    const rawRise=rawShoulders.map((v,i)=>v-this.shrugRestLift[i]);
    const rawClose=rawRelative.map((v,i)=>v-this.shrugRestClose[i]);
    const raised=rawRise.every(v=>v>=liftEnter)&&rawClose.every(v=>v>=closeEnter);
    // Require a clear winner. Mixed neck/shoulder motion waits instead of guessing a turn.
    // A bilateral shrug owns its gesture even when the shoulders rise slightly unevenly.
    const laneEnter=CONFIG.pose.laneTiltEnter/this.sensitivity,turnEnter=CONFIG.pose.shoulderTurnEnter/this.sensitivity;
    const neckMagnitude=Math.abs(rawNeck),shoulderMagnitude=Math.abs(rawShoulder),faceMagnitude=Math.abs(rawNeck+rawShoulder);
    // Keeping the face level while tipping the shoulders is a shoulder action, not a neck tilt.
    const faceLevel=faceMagnitude<CONFIG.pose.laneTiltRelease/this.sensitivity;
    const turnIntent=!raised&&shoulderMagnitude>=turnEnter&&(!this.faceVisible||faceLevel||neckMagnitude<CONFIG.pose.laneTiltRelease/this.sensitivity||shoulderMagnitude>=neckMagnitude*CONFIG.pose.turnDominance);
    const laneIntent=!raised&&!turnIntent&&this.faceVisible&&faceMagnitude>=laneEnter*.55&&neckMagnitude>=laneEnter&&(shoulderMagnitude<turnEnter||neckMagnitude>=shoulderMagnitude*CONFIG.pose.laneDominance);
    const turnCandidate=turnIntent&&Math.abs(this.shoulderTilt)>=turnEnter*.55?Math.sign(rawShoulder) as -1|1:0;
    // Start confirmation on the first coherent tilt; still require the filtered angle before firing.
    const candidate=laneIntent&&Math.abs(this.headTilt)>=laneEnter*.55?Math.sign(rawNeck) as -1|1:0;
    const centered=this.faceVisible&&Math.abs(rawNeck)<CONFIG.pose.laneTiltRelease/this.sensitivity&&Math.abs(this.headTilt)<CONFIG.pose.laneTiltRelease/this.sensitivity;
    if(centered){
      if(this.centerSince<0)this.centerSince=now;
      if(now-this.centerSince>=CONFIG.pose.gestureRearmMs)this.directionArmed=true;
    }else this.centerSince=-1;
    // A larger neck roll also lowers the nose; height must not veto a valid sideways tilt.
    if(this.directionArmed&&candidate){
      if(candidate!==this.directionCandidate){this.directionCandidate=candidate;this.directionSince=now;}
      if(now-this.directionSince>=CONFIG.pose.laneHoldMs&&Math.abs(this.headTilt)>=laneEnter){
        this.directionAction=candidate;this.lastDirection=candidate;this.lastDirectionAt=now;
        this.directionArmed=false;this.directionCandidate=0;this.directionSince=-1;this.centerSince=-1;
        this.turnArmed=false;this.turnCenterSince=-1;
      }
    }else {this.directionCandidate=0;this.directionSince=-1;}

    if(Math.abs(rawShoulder)<CONFIG.pose.shoulderTurnRelease/this.sensitivity&&Math.abs(this.shoulderTilt)<CONFIG.pose.shoulderTurnRelease/this.sensitivity){
      if(this.turnCenterSince<0)this.turnCenterSince=now;
      if(now-this.turnCenterSince>=CONFIG.pose.gestureRearmMs)this.turnArmed=true;
    }else this.turnCenterSince=-1;
    // Raising one shoulder moves the shoulder midpoint up and can resemble a nod.
    // A turn depends on shoulder roll alone; nod recognition is already blocked by raised shoulders.
    if(this.turnArmed&&turnCandidate){
      if(turnCandidate!==this.turnCandidate){this.turnCandidate=turnCandidate;this.turnSince=now;}
      if(now-this.turnSince>=CONFIG.pose.shoulderTurnHoldMs&&Math.abs(this.shoulderTilt)>=turnEnter){
        this.turnAction=turnCandidate;this.lastTurn=turnCandidate;this.lastTurnAt=now;
        this.turnArmed=false;this.turnCandidate=0;this.turnSince=-1;this.turnCenterSince=-1;
        this.directionAction=0;this.directionArmed=false;this.directionSince=-1;
      }
    }else {this.turnCandidate=0;this.turnSince=-1;}

    const shrugSmooth=1-Math.exp(-dt/CONFIG.pose.shrugSmoothMs);
    for(let i=0;i<3;i++)this.vertical[i]+=(rawVertical[i]-this.vertical[i])*shrugSmooth;
    const headLift=this.vertical[0],shoulderLift=this.vertical.slice(1),relativeLift=shoulderLift.map(v=>v-headLift);
    const filteredRise=shoulderLift.map((v,i)=>v-this.shrugRestLift[i]),filteredClose=relativeLift.map((v,i)=>v-this.shrugRestClose[i]);
    // Confirm a bilateral rise relative to the head; natural head following is allowed.
    // Raw onset starts the short confirmation, while filtered values must also pass before firing.
    const rising=raised&&filteredRise.every(v=>v>=liftEnter*.55)&&filteredClose.every(v=>v>=closeEnter*.55);
    // Relaxing the shoulder-to-head distances re-arms even after a whole-body position shift.
    const shouldersStill=rawRise.every(v=>v<liftEnter*.2)&&filteredRise.every(v=>v<liftEnter*.2);
    const lowered=filteredClose.every(v=>v<CONFIG.pose.shrugRelease)&&rawClose.every(v=>v<CONFIG.pose.shrugRelease)||shouldersStill;
    const shouldersResting=filteredRise.every(v=>Math.abs(v)<CONFIG.pose.shrugLift);
    if(lowered){
      if(this.shrugReleaseSince<0)this.shrugReleaseSince=now;
      if(now-this.shrugReleaseSince>=CONFIG.pose.shrugRearmMs&&now-this.lastShrug>=CONFIG.pose.shrugCooldownMs){
        this.shrugArmed=true;
        // Do not follow the early rise of a slow shrug into the resting reference.
        if(shouldersStill||rawClose.every(v=>v<=closeEnter*.25)){this.shrugRestLift=[...rawShoulders];this.shrugRestClose=[...rawRelative];}
      }
    }else this.shrugReleaseSince=-1;
    if(this.shrugArmed&&rising){
      if(this.shrugSince<0)this.shrugSince=now;
      if(now-this.shrugSince>=CONFIG.pose.shrugHoldMs&&filteredRise.every(v=>v>=liftEnter)&&filteredClose.every(v=>v>=closeEnter)){this.boost=true;this.lastShrug=now;this.shrugArmed=false;this.shrugSince=-1;this.shrugReleaseSince=-1;}
    }else this.shrugSince=-1;

    // Neck rolls can lower the nose too. Only upright head/shoulders may complete a resume nod.
    if(!shouldersResting||Math.abs(this.headTilt)>=CONFIG.pose.laneTiltRelease/this.sensitivity||Math.abs(this.shoulderTilt)>=CONFIG.pose.shoulderTurnRelease/this.sensitivity){this.nodPhase='cooldown';this.nodSince=-1;this.nodReleaseSince=-1;}
    else if(this.nodPhase==='cooldown'){
      if(Math.abs(dip)<CONFIG.pose.nodRelease){if(this.nodReleaseSince<0)this.nodReleaseSince=now;if(now-this.nodReleaseSince>=180&&now-this.lastNod>=CONFIG.pose.nodCooldownMs){this.nodPhase='ready';this.nodSince=-1;}}
      else this.nodReleaseSince=-1;
    }else if(this.nodPhase==='ready'){
      if(dip>=CONFIG.pose.nodDown){if(this.nodSince<0)this.nodSince=now;if(now-this.nodSince>=CONFIG.pose.nodHoldMs){this.nodPhase='down';this.nodReleaseSince=-1;}}
      else this.nodSince=-1;
    }else if(now-this.nodSince>CONFIG.pose.nodMaxMs){this.nodPhase='cooldown';this.nodReleaseSince=-1;}
    else if(dip<CONFIG.pose.nodRelease){
      if(this.nodReleaseSince<0)this.nodReleaseSince=now;
      if(now-this.nodReleaseSince>=CONFIG.pose.nodHoldMs){this.resume=true;this.lastNod=now;this.nodPhase='cooldown';this.nodReleaseSince=-1;}
    }else this.nodReleaseSince=-1;

    // Slowly follow comfortable seated posture when the player is centred, without a setup ritual.
    if(centered&&this.directionArmed&&Math.abs(this.shoulderTilt)<2&&this.turnArmed&&Math.abs(dip)<.035&&this.nodPhase==='ready'&&lowered&&shouldersResting){
      const adapt=1-Math.exp(-dt/10000);this.neutral+=(angle-this.neutral)*adapt;this.neutralHeight+=(height-this.neutralHeight)*adapt;
      this.neutralShoulderRoll+=(shoulders-this.neutralShoulderRoll)*adapt;
      for(const f of referenced)this.faceReferences[f.source]+=(f.roll-this.faceReferences[f.source])*adapt;
      for(let i=0;i<3;i++){this.neutralX[i]+=(xs[i]-this.neutralX[i])*adapt;this.neutralY[i]+=(ys[i]-this.neutralY[i])*adapt;}
    }
    this.message=this.boost?'Shrug detected · One boost':now-this.lastShrug<700?'Relax your shoulders, then shrug again':!this.faceVisible?'Show your face for lane changes · Shoulders can still turn':this.lastTurnAt>this.lastDirectionAt&&now-this.lastTurnAt<1000?(this.lastTurn<0?'Shoulders left · Turning left':'Shoulders right · Turning right'):now-this.lastDirectionAt<900?(this.lastDirection<0?'Head left · One lane change':'Head right · One lane change'):!this.directionArmed&&Math.abs(this.headTilt)>CONFIG.pose.laneTiltRelease?'Straighten your head to change lanes again':!this.turnArmed&&Math.abs(this.shoulderTilt)>CONFIG.pose.shoulderTurnRelease?'Level your shoulders to turn again':'Head tilt: lanes · Shoulder tilt: turns';
  }

  read(now:number):InputFrame {
    const stale=now-this.lastGood;
    if(stale>=CONFIG.pose.lossMs||!this.valid){this.steer=0;this.drift=false;this.boost=false;this.resume=false;this.shrugArmed=false;this.shrugSince=-1;this.shrugReleaseSince=-1;this.turnAction=0;this.turnArmed=false;this.turnCandidate=0;this.turnSince=-1;this.turnCenterSince=-1;this.directionAction=0;this.directionArmed=false;this.directionCandidate=0;this.directionSince=-1;this.centerSince=-1;this.nodPhase='cooldown';this.nodReleaseSince=-1;}
    const out:InputFrame={steer:0,actionControl:true,directionAction:this.directionAction,turnAction:this.turnAction,throttle:this.calibrated&&this.valid&&stale<CONFIG.pose.lossMs?1:0,brake:0,drift:this.drift,boost:this.boost,resume:this.resume};this.boost=false;this.resume=false;this.directionAction=0;this.turnAction=0;return out;
  }
  get ready(){return this.calibrated&&this.valid;}
}
