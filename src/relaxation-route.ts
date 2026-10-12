import {mod} from './config';

export type RouteAction='accelerate'|'lane-left'|'lane-right'|'turn-left'|'turn-right'|'recover';
export interface RouteSection {start:number;end:number;action:RouteAction;sequence:number;lane?:number}
interface Segment {start:number;length:number;x:number;z:number;yaw:number;curvature:number}

export function makeRelaxationRoute(id:'meadow'|'lakeside',length:number){
 const lake=id==='lakeside',repeats=lake?4:3,straight=lake?420:360,leftRadius=lake?110:90,rightRadius=lake?110:105;
 const leftAngle=(lake?135:150)*Math.PI/180,rightAngle=(lake?45:30)*Math.PI/180;
 const segments:Segment[]=[],rawSections:{start:number;end:number;action:RouteAction;sequence:number;lane?:number}[]=[];
 let x=0,z=0,yaw=0,total=0;
 const add=(distance:number,curvature:number,action:RouteAction,sequence:number,lane?:number)=>{
  segments.push({start:total,length:distance,x,z,yaw,curvature});rawSections.push({start:total,end:total+distance,action,sequence,lane});
  if(curvature){const next=yaw+distance*curvature;x+=(Math.cos(yaw)-Math.cos(next))/curvature;z+=(Math.sin(next)-Math.sin(yaw))/curvature;yaw=next;}
  else{x+=Math.sin(yaw)*distance;z+=Math.cos(yaw)*distance;}
  total+=distance;
 };
 for(let sequence=0;sequence<repeats;sequence++){
  add(straight*.55,0,'accelerate',sequence,0);
  add(straight*.225,0,'lane-left',sequence,-1);
  add(straight*.225,0,'lane-right',sequence,0);
  // Positive yaw is the driver's left in the existing steering convention.
  add(leftRadius*leftAngle,1/leftRadius,'turn-left',sequence);
  add(50,0,'recover',sequence);
  add(rightRadius*rightAngle,-1/rightRadius,'turn-right',sequence);
 }
 const scale=length/total,startOffset=70;
 const rawSample=(s:number)=>{
  const d=mod(s+startOffset,length)/scale;
  const seg=segments.find(p=>d<p.start+p.length)??segments[segments.length-1],u=d-seg.start,k=seg.curvature,a=seg.yaw+k*u;
  return {x:(seg.x+(k?(Math.cos(seg.yaw)-Math.cos(a))/k:Math.sin(a)*u))*scale,
   z:(seg.z+(k?(Math.sin(a)-Math.sin(seg.yaw))/k:Math.cos(a)*u))*scale,tx:Math.sin(a),tz:Math.cos(a)};
 };
 const survey=Array.from({length:800},(_,i)=>rawSample(i*length/800));
 const cx=(Math.min(...survey.map(p=>p.x))+Math.max(...survey.map(p=>p.x)))/2,cz=(Math.min(...survey.map(p=>p.z))+Math.max(...survey.map(p=>p.z)))/2;
 const sections:RouteSection[]=[];
 for(const p of rawSections){
  const start=p.start*scale-startOffset,end=p.end*scale-startOffset;
  if(start<0){
   if(end>0)sections.push({...p,start:0,end});
   sections.push({...p,start:length+start,end:length+Math.min(0,end),action:'recover',lane:undefined});
  }else sections.push({...p,start,end});
 }
 sections.sort((a,b)=>a.start-b.start);
 return {sections,sample:(s:number)=>{const p=rawSample(s);return {...p,x:p.x-cx,z:p.z-cz};}};
}
