import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../public/pose/worker.js',import.meta.url),'utf8');
function worker(failCPU=false,failDetect=false){
 const loads:string[]=[],messages:any[]=[];
 const self:any={location:{href:'http://localhost/pose/worker.js'},postMessage:(m:any)=>messages.push(m)};
 const context=vm.createContext({self,URL,performance,importScripts:()=>{},OffscreenCanvas:class{},Vision:{
  FilesetResolver:{forVisionTasks:async()=>({})},
  PoseLandmarker:{createFromOptions:async(_:unknown,options:any)=>{
   const delegate=options.baseOptions.delegate;loads.push(delegate);if(failCPU&&delegate==='CPU')throw Error('CPU unsupported');
   return {close:()=>{},detectForVideo:()=>{if(failDetect)throw Error('frame failure');return {landmarks:[[{x:.5,y:.5}]]};}};
  }}
 }});
 vm.runInContext(source,context);
 return {loads,messages,send:(data:any)=>self.onmessage({data})};
}
test('pose inference prefers the independent CPU and reports its actual processing time',async()=>{
 const w=worker();await w.send({type:'load'});assert.deepEqual(w.loads,['CPU']);assert.equal(w.messages[0].backend,'CPU');
 let closed=0;await w.send({type:'frame',time:123,bitmap:{close:()=>closed++}});
 const r=w.messages[1];assert.equal(r.type,'result');assert.equal(r.time,123);assert.ok(r.processingMs>=0);assert.equal(r.landmarks.length,1);assert.equal(closed,1);
});
test('the GPU is only used when CPU model creation fails',async()=>{
 const w=worker(true);await w.send({type:'load'});assert.deepEqual(w.loads,['CPU','GPU']);assert.equal(w.messages[0].backend,'GPU');
});
test('rejected or failing frames always release their transferred bitmap',async()=>{
 const w=worker(false,true);let closed=0;const bitmap={close:()=>closed++};
 await w.send({type:'frame',time:1,bitmap});assert.equal(closed,1);
 await w.send({type:'load'});await w.send({type:'frame',time:2,bitmap});assert.equal(closed,2);assert.equal(w.messages.at(-1).type,'error');
});
