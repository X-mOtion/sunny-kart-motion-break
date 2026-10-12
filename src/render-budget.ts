import type {Quality} from './config';

// Only visual resolution and shadows change; physics and camera sampling stay independent.
export class RenderBudget {
 quality:Quality='auto';pose=false;stage=0;
 private warmup=2000;private cooldown=0;private slowWindows=0;private window:number[]=[];private elapsed=0;
 constructor(public coarse=false){}
 setQuality(quality:Quality){this.quality=quality;this.reset();}
 setPose(pose:boolean){if(this.pose===pose)return false;this.pose=pose;this.reset();return true;}
 private reset(){this.stage=0;this.warmup=2000;this.cooldown=0;this.slowWindows=0;this.window=[];this.elapsed=0;}
 observe(ms:number,active:boolean){
  if(this.quality!=='auto'||!active||ms<=0||ms>200){this.window=[];this.elapsed=0;return false;}
  if(this.warmup>0){this.warmup-=ms;return false;}
  this.cooldown=Math.max(0,this.cooldown-ms);this.window.push(ms);this.elapsed+=ms;
  if(this.elapsed<1000)return false;
  const meanFps=this.window.length*1000/this.elapsed,sorted=this.window.sort((a,b)=>a-b),p90=sorted[Math.floor(sorted.length*.9)];
  this.window=[];this.elapsed=0;
  this.slowWindows=meanFps<52||p90>26?this.slowWindows+1:0;
  if(this.slowWindows<2||this.cooldown>0||this.stage>=3)return false;
  this.stage++;this.slowWindows=0;this.cooldown=5000;return true;
 }
 settings(width:number,height:number,dpr:number){
  const low=this.quality==='low'||this.quality==='auto'&&(this.coarse||this.pose||this.stage>0);
  const pixels=this.quality==='high'?4_000_000:this.quality==='low'?1_350_000:this.pose?1_800_000:2_600_000;
  const scale=[1,.88,.76,.66][this.stage],cap=this.quality==='high'?1.6:low?1.2:1.6;
  return {ratio:Math.min(dpr,cap,Math.sqrt(pixels/Math.max(1,width*height)))*scale,low,shadowSize:low?1024:2048};
 }
 snapshot(){return {quality:this.quality,pose:this.pose,stage:this.stage,scale:[1,.88,.76,.66][this.stage]};}
}
