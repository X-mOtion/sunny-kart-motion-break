/* Local MediaPipe runtime; a single in-flight bitmap, no camera frames are uploaded. */
const root=new URL('.',self.location.href).href;
importScripts(root+'vision_bundle.js');
let pose,backend;
async function load(delegate){
 const files=await Vision.FilesetResolver.forVisionTasks(root+'wasm');
 pose=await Vision.PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:root+'pose_landmarker_lite.task',delegate},canvas:new OffscreenCanvas(640,480),runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.55,minPosePresenceConfidence:.55,minTrackingConfidence:.5});
 backend=delegate;
}
self.onmessage=async({data})=>{
 // Keep inference on the Worker's CPU so it does not compete with the 3D renderer.
 // GPU remains a compatibility fallback; the gesture model and sampling cap are unchanged.
 if(data.type==='load'){try{try{await load('CPU');}catch(_){pose?.close();await load('GPU');}self.postMessage({type:'ready',backend});}catch(e){self.postMessage({type:'error',message:String(e)});}return;}
 if(data.type!=='frame'||!pose){data.bitmap?.close();return;}
 try{const start=performance.now(),r=pose.detectForVideo(data.bitmap,data.time);self.postMessage({type:'result',time:data.time,processingMs:performance.now()-start,landmarks:r.landmarks[0]||[]});}
 catch(e){self.postMessage({type:'error',message:String(e)});}
 finally{data.bitmap.close();}
};
