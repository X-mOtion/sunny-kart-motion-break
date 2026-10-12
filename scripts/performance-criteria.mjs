export function assessPerformance(report,{durationMs,minMeanFps=55,minCameraFps=15,requirePauseAndRestart=false}={}){
 const failures=[],samples=report.samples||[];
 const active=samples.filter(s=>s.elapsedMs>10000&&s.phase==='racing');
 const required=Math.max(2,Math.floor((durationMs-10000)/5000*.65));
 if(!(report.durationMs>=durationMs))failures.push('Requested real-time duration was not completed');
 if(active.length<required)failures.push(`Not enough active samples: ${active.length}/${required}`);
 for(const s of active){
  if(!Number.isFinite(s.fpsMean)||s.fpsMean<minMeanFps)failures.push(`Frame rate below ${minMeanFps} FPS at ${s.elapsedMs} ms`);
  if(!s.cameraRunning||!Number.isFinite(s.cameraFps)||s.cameraFps<minCameraFps||!Number.isFinite(s.cameraResultAgeMs)||s.cameraResultAgeMs>500)failures.push(`Motion processing missing or stale at ${s.elapsedMs} ms`);
 }
 const first=samples[0];
 for(const s of samples){if(first&&(JSON.stringify(s.resources)!==JSON.stringify(first.resources)||s.programs!==first.programs||s.sceneObjects!==first.sceneObjects))failures.push(`Resource growth at ${s.elapsedMs} ms`);}
 if(report.errors?.length)failures.push(...report.errors);
 if(requirePauseAndRestart&&(!report.workflow?.pauseChecked||!report.workflow?.pauseFrozen||report.workflow?.restarts<1||report.completedRaces<1))failures.push('Pause/resume or a completed ride and restart were not verified');
 const min=key=>active.length?Math.min(...active.map(s=>s[key])):null;
 return {passed:failures.length===0,failures,activeSamples:active.length,requiredSamples:required,minMeanFps:min('fpsMean'),minCameraFps:min('cameraFps'),minP05Fps:min('fpsP05')};
}
