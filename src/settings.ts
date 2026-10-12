import {clamp,type ControlMode,type Difficulty,type Quality} from './config';
import {resolveTrackId,type TrackId} from './track';

export interface Settings {mode:ControlMode;difficulty:Difficulty;quality:Quality;music:number;effects:number;sensitivity:number;cameraId:string;trackId:TrackId;casualVersion:1}
const member=<T extends string>(value:unknown,values:readonly T[],fallback:T):T=>values.includes(value as T)?value as T:fallback;
const number=(value:unknown,fallback:number,min:number,max:number)=>typeof value==='number'&&Number.isFinite(value)?clamp(value,min,max):fallback;
export function normalizeSettings(value:unknown,coarse=false):Settings {
 const raw=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
 return {mode:member(raw.mode,['keyboard','touch','pose'],coarse?'touch':'pose'),
  difficulty:raw.casualVersion===1?member(raw.difficulty,['easy','normal','hard'],'easy'):'easy',
  quality:member(raw.quality,['auto','high','low'],'auto'),music:number(raw.music,.2,0,1),effects:number(raw.effects,.55,0,1),sensitivity:number(raw.sensitivity,1,.6,1.8),
  cameraId:typeof raw.cameraId==='string'?raw.cameraId:'',trackId:resolveTrackId(raw.trackId)??'meadow',casualVersion:1};
}
export function loadSettings(coarse=false):Settings {
 try{return normalizeSettings(JSON.parse(localStorage.getItem('sunny-kart-settings')||'null'),coarse);}catch{return normalizeSettings(null,coarse);}
}
