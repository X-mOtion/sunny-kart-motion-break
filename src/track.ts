import { CatmullRomCurve3, Vector3 } from 'three';
import { mod } from './config';
import {makeRelaxationRoute,type RouteSection} from './relaxation-route';
export const TRACKS = {
  meadow: {name:'Meadow Cruise', english:'Meadow Cruise', number:'02', length:1600, width:18, laneRange:4.6, description:'Relaxed · Boost, left lane, right lane, left bend, right bend', menuSubtitle:'Relaxed · Three easy sequences', tagline:'Build speed. Find your rhythm.', scenery:'Meadow / three sequences'},
  lakeside: {name:'Lakeside Flow', english:'Lakeside Flow', number:'03', length:1900, width:18, laneRange:4.6, description:'Relaxed · Boost, left lane, right lane, left bend, right bend', menuSubtitle:'Relaxed · Four flowing sequences', tagline:'A gentle rhythm around the water.', scenery:'Lakeside / four sequences'},
  city: {name:'Sunny City Circuit', english:'Sunny City Circuit', number:'01', length:1100, width:12, laneRange:2.6, description:'Classic · City streets · Winding corners', menuSubtitle:'Classic · City corners', tagline:'Colorful streets. Scenic corners.', scenery:'City / park'},
} as const;
export type TrackId = keyof typeof TRACKS;
export function validTrackId(value:unknown): value is TrackId { return value==='meadow'||value==='city'||value==='lakeside'; }
// Migrate bookmarks and saved preferences; retired maps are not available as tracks.
export function resolveTrackId(value:unknown):TrackId|undefined {
  return validTrackId(value)?value:value==='boulevard'?'meadow':value==='garden'?'lakeside':undefined;
}
export interface TrackPoint {x:number; z:number; tx:number; tz:number; nx:number; nz:number; yaw:number; width:number; s:number}
export class Track {
  readonly count: number;
  readonly length: number;
  readonly definition: typeof TRACKS[TrackId];
  readonly points: TrackPoint[];
  readonly sections:RouteSection[];
  readonly step: number;
  readonly bounds: {minX:number;maxX:number;minZ:number;maxZ:number};
  get wideRoad(){return this.definition.width>=16;}
  constructor(readonly id:TrackId='city') {
    this.definition=TRACKS[id];this.length=this.definition.length;this.count=this.length*2;this.step=.5;
    if(id!=='city'){
      const route=makeRelaxationRoute(id,this.length);this.sections=route.sections;
      this.points=Array.from({length:this.count},(_,i)=>{
        const s=i*this.step,{x,z,tx,tz}=route.sample(s);
        return {x,z,tx,tz,nx:-tz,nz:tx,yaw:Math.atan2(tx,tz),width:this.definition.width,s};
      });
    }else{
    this.sections=[];
    const raw = [[-75,110],[-10,110],[75,110],[126,90],[144,50],[140,12],[115,-5],[70,-5],[50,-22],[54,-43],[83,-50],[120,-57],[141,-85],[130,-126],[93,-147],[38,-147],[5,-126],[12,-99],[36,-89],[33,-65],[6,-55],[-29,-65],[-59,-102],[-103,-132],[-149,-111],[-160,-61],[-160,-6],[-142,25],[-110,43],[-104,70],[-130,91],[-143,110]];
    const curve = new CatmullRomCurve3(raw.map(([x,z])=>new Vector3(x,0,z)), true, 'centripetal');
    curve.arcLengthDivisions = 6000;
    const scale = this.length / curve.getLength();
    this.points = Array.from({length:this.count}, (_,i)=>{
      const p=curve.getPointAt(i/this.count).multiplyScalar(scale), t=curve.getTangentAt(i/this.count).normalize();
      const s=i*this.step;
      return {x:p.x,z:p.z,tx:t.x,tz:t.z,nx:-t.z,nz:t.x,yaw:Math.atan2(t.x,t.z),width:s<145||s>1060?14:12,s};
    });
    }
    this.bounds={minX:Math.min(...this.points.map(p=>p.x)),maxX:Math.max(...this.points.map(p=>p.x)),minZ:Math.min(...this.points.map(p=>p.z)),maxZ:Math.max(...this.points.map(p=>p.z))};
  }
  at(s:number):TrackPoint {
    const f=mod(s,this.length)/this.step, i=Math.floor(f), a=this.points[i], b=this.points[(i+1)%this.count], t=f-i;
    const tx=a.tx+(b.tx-a.tx)*t,tz=a.tz+(b.tz-a.tz)*t,n=Math.hypot(tx,tz);
    return {...a,x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,tx:tx/n,tz:tz/n,nx:-tz/n,nz:tx/n,yaw:Math.atan2(tx,tz),s:mod(s,this.length)};
  }
  nearest(x:number,z:number,hint?:number) {
    let best=Infinity,idx=0;
    const from=hint===undefined?0:Math.round(mod(hint,this.length)/this.step)-70, size=hint===undefined?this.count:141;
    for(let j=0;j<size;j++){const k=mod(from+j,this.count),p=this.points[k],d=(p.x-x)**2+(p.z-z)**2;if(d<best){best=d;idx=k;}}
    const p=this.points[idx], along=(x-p.x)*p.tx+(z-p.z)*p.tz;
    const q=this.at(p.s+Math.max(-this.step,Math.min(this.step,along)));
    return {...q,lateral:(x-q.x)*q.nx+(z-q.z)*q.nz,distance:Math.hypot(x-q.x,z-q.z)};
  }
  curvature(s:number) {const a=this.at(s-3),b=this.at(s+3);return Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw))/6;}
}
