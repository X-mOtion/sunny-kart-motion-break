export type Gesture='left'|'right'|'turnLeft'|'turnRight'|'boost'|'neutral';
export interface GestureTrial {expected:Gesture;detected:Exclude<Gesture,'neutral'>[];durationMs:number;trackingCoverage:number;valid:boolean}
export class GestureAssessment {
 trials:GestureTrial[]=[];
 active:{expected:Gesture;start:number;durationMs:number;detected:Exclude<Gesture,'neutral'>[];validMs:number;observedMs:number;last:number}|null=null;
 begin(expected:Gesture,now:number){if(this.active)throw Error('A trial is already running');this.active={expected,start:now,last:now,durationMs:expected==='neutral'?60000:2500,detected:[],validMs:0,observedMs:0};}
 observe(now:number,tracking:boolean,detected:Exclude<Gesture,'neutral'>[]=[]){
  const a=this.active;if(!a)return;
  const dt=Math.max(0,Math.min(now,a.start+a.durationMs)-a.last);a.observedMs+=dt;if(tracking&&dt<=250)a.validMs+=dt;a.last=now;
  if(now<=a.start+a.durationMs)a.detected.push(...detected);
  if(now-a.start>=a.durationMs){const coverage=a.validMs/a.durationMs;this.trials.push({expected:a.expected,detected:a.detected,durationMs:a.durationMs,trackingCoverage:coverage,valid:coverage>=.9});if(this.trials.length>240)this.trials.shift();this.active=null;}
 }
 cancel(){this.active=null;}
 reset(){this.active=null;this.trials=[];}
 summary(){
  const rows=['left','right','turnLeft','turnRight','boost','neutral'].map(key=>{
   const expected=key as Gesture,all=this.trials.filter(t=>t.expected===expected),valid=all.filter(t=>t.valid);
   const correct=valid.filter(t=>expected==='neutral'?t.detected.length===0:t.detected.length===1&&t.detected[0]===expected).length;
   return {expected,attempts:all.length,valid:valid.length,excluded:all.length-valid.length,correct,missed:valid.filter(t=>expected!=='neutral'&&t.detected.length===0).length,wrong:valid.filter(t=>t.detected.some(d=>d!==expected)).length,repeated:valid.filter(t=>t.detected.length>1).length,accuracy:valid.length?correct/valid.length:null};
  });
  return {rows,total:this.trials.length,valid:this.trials.filter(t=>t.valid).length,note:'User performs the selected action. Tracking-invalid trials are excluded. This is gesture classification feedback, not a medical assessment or measured physical-to-screen latency.'};
 }
}
