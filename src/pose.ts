import {PoseInput,type Landmark} from './pose-input';
import {CONFIG} from './config';
export {PoseInput,type Landmark} from './pose-input';
export class CameraController {
 processor=new PoseInput();worker:Worker|null=null;stream:MediaStream|null=null;busy=false;loaded=false;running=false;
 generation=0;lastFrame=-1;lastSend=0;inferenceMs=0;processingMs=0;backend='';fps=0;frames=0;fpsAt=0;landmarks:Landmark[]=[];error='';
 onStatus:()=>void=()=>{};
 lastResultAt=0;timingSamples:number[]=[];private cancelLoad:(()=>void)|null=null;
 constructor(public video:HTMLVideoElement,public base:string){}
 async devices(){const devices=await navigator.mediaDevices.enumerateDevices();return devices.filter(d=>d.kind==='videoinput'&&!/desk view|桌上视角/i.test(d.label));}
 async start(deviceId?:string){
  this.stop();const generation=this.generation;this.error='';this.processor.message='Connecting camera…';this.onStatus();
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access requires localhost on your Mac or an HTTPS page');
   const stream=await navigator.mediaDevices.getUserMedia({video:{deviceId:deviceId?{exact:deviceId}:undefined,width:{ideal:640},height:{ideal:480},frameRate:{ideal:30,max:30}},audio:false});
   if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
   this.stream=stream;this.video.srcObject=stream;await this.video.play();
   if(generation!==this.generation)return;
   stream.getVideoTracks()[0].addEventListener('ended',()=>{if(this.running){this.error='Camera disconnected. Please reconnect.';this.stop();this.onStatus();}});
   this.processor.message='Loading local motion recognition…';this.onStatus();
   // The runtime script is public/cached rather than a hashed Vite asset. Bump this
   // revision when its backend changes so an existing game loads the new Worker.
   const worker=new Worker(`${this.base}pose/worker.js?rev=cpu-1`);this.worker=worker;
   await new Promise<void>((resolve,reject)=>{
    const finish=(error?:Error)=>{clearTimeout(timeout);this.cancelLoad=null;error?reject(error):resolve();};
    const timeout=setTimeout(()=>finish(new Error('Motion model timed out. Please try again.')),45000);
    this.cancelLoad=()=>finish(new Error('Camera connection cancelled'));
    worker.onerror=e=>finish(new Error(e.message));
    worker.onmessage=({data})=>{if(data.type==='ready'){this.backend=data.backend??'';finish();}if(data.type==='error')finish(new Error(data.message));};
    worker.postMessage({type:'load'});
   });
   if(generation!==this.generation){worker.terminate();return;}
   this.loaded=true;this.running=true;this.processor.calibrate();
   worker.onmessage=({data})=>{
    if(generation!==this.generation)return;this.busy=false;
    if(data.type==='error'){this.error=data.message;this.stop();this.onStatus();return;}
    if(data.type==='result'){this.inferenceMs=performance.now()-data.time;this.timingSamples.push(this.inferenceMs);if(this.timingSamples.length>180)this.timingSamples.shift();this.processingMs=data.processingMs??this.inferenceMs;this.landmarks=data.landmarks;this.lastResultAt=performance.now();this.processor.consume(data.landmarks,this.lastResultAt,this.video.videoWidth/this.video.videoHeight);this.frames++;const now=performance.now();if(now-this.fpsAt>=1000){this.fps=this.frames*1000/(now-this.fpsAt);this.frames=0;this.fpsAt=now;}this.onStatus();}
   };worker.onerror=e=>{this.error=e.message;this.stop();this.onStatus();};this.fpsAt=performance.now();this.onStatus();
  }catch(e){if(generation!==this.generation)return;const name=e instanceof Error?e.name:'';this.error=name==='NotAllowedError'?'Camera permission is blocked. Allow camera access in your browser site settings, then reconnect.':name==='NotFoundError'?'No camera found. Connect a camera or enable iPhone Continuity Camera on your Mac.':name==='NotReadableError'?'Camera is busy. Close other apps using it, then reconnect.':e instanceof Error?e.message:String(e);this.stop();this.onStatus();}
 }
 async frame(now:number){
  if(this.running&&this.worker&&this.busy&&now-this.lastSend>3000){this.error='Motion recognition stopped responding. Please reconnect.';this.stop();this.onStatus();return;}
  if(!this.running||this.busy||!this.worker||this.video.readyState<2||this.video.currentTime===this.lastFrame||now-this.lastSend<CONFIG.pose.frameIntervalMs)return;
  this.busy=true;this.lastFrame=this.video.currentTime;this.lastSend=now;const generation=this.generation;
  try{const bitmap=await createImageBitmap(this.video);if(generation!==this.generation||!this.worker){bitmap.close();return;}this.worker.postMessage({type:'frame',bitmap,time:now},[bitmap]);}catch(e){if(generation!==this.generation)return;this.error=String(e);this.stop();this.onStatus();}
 }
 diagnostics(){const a=[...this.timingSamples].sort((a,b)=>a-b);return {backend:this.backend,fps:this.fps,samples:a.length,roundTripP50Ms:a.length?a[Math.floor(a.length*.5)]:null,roundTripP95Ms:a.length?a[Math.min(a.length-1,Math.floor(a.length*.95))]:null,note:'Frame send to recognition result only; excludes camera exposure, motion onset and display presentation.'};}
 stop(){this.generation++;this.cancelLoad?.();this.cancelLoad=null;this.running=false;this.loaded=false;this.busy=false;this.worker?.terminate();this.worker=null;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.video.srcObject=null;this.processor.reset();this.processor.valid=false;this.processor.calibrated=false;this.processor.calibrating=false;this.processor.lastGood=-Infinity;this.landmarks=[];this.lastFrame=-1;this.lastSend=0;this.lastResultAt=0;this.frames=0;this.fps=0;this.backend='';this.timingSamples=[];}
}
