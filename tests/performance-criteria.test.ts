import test from 'node:test';import assert from 'node:assert/strict';
import {assessPerformance} from '../scripts/performance-criteria.mjs';
const fixture=()=>({durationMs:30000,errors:[],samples:[15000,20000,25000,30000].map(elapsedMs=>({elapsedMs,phase:'racing',fpsMean:60,fpsP05:59,cameraRunning:true,cameraFps:30,cameraResultAgeMs:20,resources:{geometries:100,textures:23},programs:30,sceneObjects:212}))});
test('performance acceptance fails low FPS even if resource counts and error logs are clean',()=>{const r=fixture();r.samples[2].fpsMean=40;assert.equal(assessPerformance(r,{durationMs:30000}).passed,false);});
test('stale inference, insufficient time, missing samples and resource growth fail acceptance',()=>{
 for(const change of [(r:any)=>r.samples[0].cameraResultAgeMs=900,(r:any)=>r.durationMs=10000,(r:any)=>r.samples=[],(r:any)=>r.samples[3].resources.textures++]){const r=fixture();change(r);assert.equal(assessPerformance(r,{durationMs:30000}).passed,false);}
});
test('only sufficient healthy measurements pass and empty results have no fake numeric minima',()=>{assert.equal(assessPerformance(fixture(),{durationMs:30000}).passed,true);const s=assessPerformance({durationMs:30000,samples:[],errors:[]},{durationMs:30000});assert.equal(s.passed,false);assert.equal(s.minMeanFps,null);});
test('five-minute scope requires the full five minutes plus a frozen pause and completed ride/restart',()=>{
 const r:any=fixture();r.durationMs=300000;r.samples=Array.from({length:58},(_,i)=>({...fixture().samples[0],elapsedMs:15000+i*5000}));
 assert.equal(assessPerformance(r,{durationMs:300000,requirePauseAndRestart:true}).passed,false);
 r.workflow={pauseChecked:true,pauseFrozen:true,restarts:1};r.completedRaces=1;
 assert.equal(assessPerformance(r,{durationMs:300000,requirePauseAndRestart:true}).passed,true);
 r.durationMs=290000;assert.equal(assessPerformance(r,{durationMs:300000,requirePauseAndRestart:true}).passed,false);
});
