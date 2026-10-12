import './gesture-test.css';
import {CameraController} from './pose';
import {clamp} from './config';
import {loadSettings} from './settings';
import {GestureAssessment,type Gesture} from './gesture-assessment';
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const labels:Record<string,string>={left:'Left lane',right:'Right lane',turnLeft:'Turn left',turnRight:'Turn right',boost:'SHRUG BOOST',neutral:'No gesture'};
const settings=loadSettings();
document.getElementById('app')!.innerHTML=`<main>
 <header><a href="./?track=meadow&mode=pose" class="brand">SUNNY KART <span>Gesture practice</span></a><a class="back" href="./?track=meadow&mode=pose">Start motion driving</a></header>
 <div class="intro"><span class="eyebrow">TRY A MOVE. THEN TAKE A RIDE.</span><h1>Your moves, recognized.</h1><p>Try a head tilt, a shoulder tilt, then a shrug. Return to neutral after each move; no need to keep holding it.</p></div>
 <div class="workspace"><section class="camera-card"><div class="video-wrap"><video id="camera-video" autoplay playsinline muted></video><canvas id="pose-overlay"></canvas><span class="camera-badge" id="camera-state">Camera offline</span></div><div class="camera-tools"><select id="camera-select" aria-label="Choose a camera"><option value="">Default camera</option></select><button id="connect" class="primary">Open camera</button><button id="stop" hidden>Close</button></div><p id="status" role="status">Keep your head and shoulders in view. No raised-hand calibration needed.</p></section>
 <section class="result-card"><div class="eyebrow">YOUR RECOGNIZED MOVE</div><div id="result" role="status" aria-live="polite">Waiting for your move</div><p id="result-detail">Your recognized move will appear here.</p><div class="readiness"><span id="neck-ready">Head tilt waiting</span><span id="shoulder-ready">Shoulder tilt waiting</span><span id="shrug-ready">Shrug waiting</span></div>
 <div class="feedback-actions"><button id="correct" disabled>Correct</button><button id="wrong" disabled>Incorrect</button><button id="missed">Missed it</button></div><div id="correction" hidden><p>What did you actually do?</p><div class="correction-options">${Object.entries(labels).map(([key,label])=>`<button data-actual="${key}">${label}</button>`).join('')}</div></div><p id="feedback-status">Mark a wrong or missed move here to record your feedback.</p>
 <div class="sensitivity"><label for="practice-sensitivity">Motion sensitivity</label><input id="practice-sensitivity" type="range" min=".6" max="1.8" step=".05"><span>More sensitive</span></div><button id="refit" class="refit">Refit posture</button></section></div>
 <section class="history-card"><div class="history-head"><h2>RECENT MOVES</h2><span id="camera-meta">Waiting for camera</span></div><ol id="history"><li class="empty">No moves recorded yet.</li></ol></section>
 <section class="history-card assessment"><div class="history-head"><h2>OPTIONAL ACCURACY CHECK</h2><button id="export-assessment">Download results</button></div><p>Choose a move, relax first, then do it once while the timer runs. This does not change your controls.</p><div class="assessment-controls"><select id="expected-gesture" aria-label="Move to test">${Object.entries(labels).map(([key,label])=>`<option value="${key}">${key==='neutral'?'Stay relaxed · 60 seconds':label}</option>`).join('')}</select><button id="begin-trial">Test one move</button><button id="cancel-trial" hidden>Cancel check</button></div><p id="trial-status" role="status">Open the camera to start. Results stay on this device.</p><div id="assessment-results"></div><p id="pipeline-stats">Processing timings will appear here.</p><small>Processing time excludes camera exposure and screen display. Physical-to-screen delay still needs a separate measurement.</small></section>
 <footer>Video is processed locally and never recorded. Feedback stores only gesture types and angles for this session.</footer>
</main>`;
const camera=new CameraController($<HTMLVideoElement>('camera-video'),import.meta.env.BASE_URL);
const assessment=new GestureAssessment();
camera.processor.sensitivity=clamp(Number(settings.sensitivity)||1,.6,1.8);
$<HTMLInputElement>('practice-sensitivity').value=String(camera.processor.sensitivity);
type Reading={id:number;at:number;action:string;neck:number;shoulder:number;lift:number[];actual?:string};
const readings:Reading[]=[],corrections:Reading[]=[];let sequence=0,lastShown=0,target:Reading|null=null;let connecting=false;
try{const saved=JSON.parse(sessionStorage.getItem('sunny-gesture-session')||'null');if(saved){readings.push(...saved.readings.slice(-40));corrections.push(...saved.corrections.slice(-40));sequence=Math.max(0,...readings.map(r=>r.id));}}catch{}
function save(){try{sessionStorage.setItem('sunny-gesture-session',JSON.stringify({readings,corrections}));}catch{}}
function snapshot(action:string):Reading{const p=camera.processor;return {id:++sequence,at:Date.now(),action,neck:+p.headTilt.toFixed(2),shoulder:+p.shoulderTilt.toFixed(2),lift:p.vertical.slice(1).map(v=>+v.toFixed(3))};}
function history(){const list=$('history');list.replaceChildren();if(!readings.length){list.innerHTML='<li class="empty">No moves recorded yet.</li>';return;}for(const r of readings.slice(-6).reverse()){const li=document.createElement('li'),label=document.createElement('strong'),time=document.createElement('span');label.textContent=labels[r.action]||'Unrecognized';time.textContent=r.actual?`You marked: ${labels[r.actual]}`:new Date(r.at).toLocaleTimeString('en-US',{hour12:false});li.append(label,time);list.append(li);}}
function record(action:string){const r=snapshot(action);readings.push(r);if(readings.length>40)readings.shift();save();lastShown=performance.now();$('result').textContent=labels[action];$('result').dataset.action=action;$('result-detail').textContent='Return to neutral to try again.';$<HTMLButtonElement>('correct').disabled=false;$<HTMLButtonElement>('wrong').disabled=false;history();}
function draw(){const video=$<HTMLVideoElement>('camera-video'),canvas=$<HTMLCanvasElement>('pose-overlay'),ctx=canvas.getContext('2d')!;canvas.width=video.videoWidth||640;canvas.height=video.videoHeight||480;ctx.clearRect(0,0,canvas.width,canvas.height);const l=camera.landmarks;ctx.strokeStyle='#dcf5a8';ctx.fillStyle='#efffc7';ctx.lineWidth=3;for(const [a,b] of [[2,5],[11,12]]){if(!l[a]||!l[b]||(l[a].visibility??1)<.45||(l[b].visibility??1)<.45)continue;ctx.beginPath();ctx.moveTo((1-l[a].x)*canvas.width,l[a].y*canvas.height);ctx.lineTo((1-l[b].x)*canvas.width,l[b].y*canvas.height);ctx.stroke();}for(const i of [0,2,5,11,12]){if(!l[i]||(l[i].visibility??1)<.45)continue;ctx.beginPath();ctx.arc((1-l[i].x)*canvas.width,l[i].y*canvas.height,5,0,Math.PI*2);ctx.fill();}}
function update(){const p=camera.processor,now=performance.now();const f=p.read(now);
 const actions:Exclude<Gesture,'neutral'>[]=[];
 if(f.directionAction){const a=f.directionAction<0?'left':'right';record(a);actions.push(a);}if(f.turnAction){const a=f.turnAction<0?'turnLeft':'turnRight';record(a);actions.push(a);}if(f.boost){record('boost');actions.push('boost');}
 const needsFace=assessment.active?.expected==='left'||assessment.active?.expected==='right';assessment.observe(now,camera.running&&p.ready&&now-p.lastGood<150&&(!needsFace||p.faceVisible),actions);updateAssessment(now);
 const missing=camera.running&&now-p.lastGood>500;
 $('status').textContent=camera.error||(!camera.running?'Keep your head and shoulders in view. No raised-hand calibration needed.':missing?'Head and shoulders unclear. Move back into view.':p.message);
 $('camera-state').textContent=camera.running?(p.ready&&!missing?'Recognizing':'Looking for head and shoulders'):connecting?'Connecting':'Camera offline';
 $('camera-meta').textContent=camera.running?`${Math.round(camera.fps)} FPS · LOCAL PROCESSING`:'Waiting for camera';
 $('camera-meta').dataset.metrics=JSON.stringify({processingMs:Math.round(camera.inferenceMs),neck:+p.headTilt.toFixed(2),shoulder:+p.shoulderTilt.toFixed(2),armed:p.shrugArmed,rise:p.vertical.slice(1).map((v,i)=>+(v-p.shrugRestLift[i]).toFixed(3)),close:p.vertical.slice(1).map((v,i)=>+(v-p.vertical[0]-p.shrugRestClose[i]).toFixed(3))});
 for(const [id,ready,name] of [['neck-ready',p.directionArmed,'Head tilt'],['shoulder-ready',p.turnArmed,'Shoulder tilt'],['shrug-ready',p.shrugArmed,'Shrug']] as const){$(id).textContent=`${name}${camera.running&&ready?' ready':' waiting'}`;$(id).classList.toggle('ready',camera.running&&ready);}
 if(camera.running&&p.ready&&!missing&&now-lastShown>2200){$('result').textContent='Ready for your next move';$('result').dataset.action='';$('result-detail').textContent=Math.abs(p.headTilt)>=4&&Math.abs(p.shoulderTilt)>=5&&!p.directionCandidate&&!p.turnCandidate?'Both head and shoulders are tilted. Try a clearer move.':'Try a gentle head tilt, shoulder tilt or shrug.';}
 if(camera.error){$('result').textContent='Camera is not connected';$('result-detail').textContent=camera.error;}
 if(missing){$('result').textContent='Move back into view to try again';$('result-detail').textContent='No action is sent when tracking is unclear.';}
 draw();
}
function updateAssessment(now:number){
 const a=assessment.active,choice=$<HTMLSelectElement>('expected-gesture').value as Gesture,p=camera.processor;
 const armed=choice==='neutral'||choice==='boost'?p.shrugArmed:choice==='left'||choice==='right'?p.directionArmed:p.turnArmed;
 $<HTMLButtonElement>('begin-trial').disabled=!!a||!camera.running||!p.ready||!armed||now-p.lastGood>150;$('cancel-trial').hidden=!a;$<HTMLSelectElement>('expected-gesture').disabled=!!a;
 $('trial-status').textContent=a?`${labels[a.expected]} · ${Math.max(0,(a.durationMs-(now-a.start))/1000).toFixed(1)}s remaining`:assessment.trials.length?'Check complete. Relax before the next move.':'Open the camera and relax to start.';
 $('assessment-results').replaceChildren();for(const r of assessment.summary().rows){if(!r.attempts)continue;const line=document.createElement('p');line.textContent=`${labels[r.expected]}: ${r.correct}/${r.valid} correct · ${r.missed} missed · ${r.wrong} wrong · ${r.repeated} repeated · ${r.excluded} excluded`; $('assessment-results').append(line);}
 const d=camera.diagnostics();$('pipeline-stats').textContent=d.samples?`Processing round trip · P50 ${Math.round(d.roundTripP50Ms!)}ms · P95 ${Math.round(d.roundTripP95Ms!)}ms · ${d.samples} recent frames`:'Processing timings will appear here.';
}
$('begin-trial').onclick=()=>{assessment.begin($<HTMLSelectElement>('expected-gesture').value as Gesture,performance.now());update();};
$('cancel-trial').onclick=()=>{assessment.cancel();update();};
$<HTMLSelectElement>('expected-gesture').onchange=()=>update();
$('export-assessment').onclick=()=>{const data={version:1,at:new Date().toISOString(),entry:[...document.scripts].map(s=>s.src).filter(Boolean),camera:camera.diagnostics(),sensitivity:camera.processor.sensitivity,summary:assessment.summary(),trials:assessment.trials,corrections,physicalToScreenLatency:'not measured',videoRecorded:false};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='sunny-kart-gesture-results.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
camera.onStatus=update;
async function devices(){const select=$<HTMLSelectElement>('camera-select'),current=select.value||settings.cameraId||'';try{const all=await camera.devices();select.replaceChildren(new Option('Default camera',''));all.forEach((d,i)=>select.add(new Option(d.label||`Camera ${i+1}`,d.deviceId)));if([...select.options].some(o=>o.value===current))select.value=current;}catch{}}
async function connect(){if(connecting)return;connecting=true;$<HTMLButtonElement>('connect').disabled=true;update();await devices();const device=$<HTMLSelectElement>('camera-select').value;await camera.start(device||undefined);await devices();connecting=false;$<HTMLButtonElement>('connect').disabled=false;$('connect').textContent='Reconnect';$('stop').hidden=!camera.running;lastShown=performance.now();update();}
function stop(){assessment.cancel();camera.stop();$('stop').hidden=true;$('connect').textContent='Open camera';$('result').textContent='Camera closed';update();}
$('connect').onclick=()=>void connect();$('stop').onclick=stop;
$<HTMLSelectElement>('camera-select').onchange=()=>{settings.cameraId=$<HTMLSelectElement>('camera-select').value;try{localStorage.setItem('sunny-kart-settings',JSON.stringify(settings));}catch{}void connect();};
$('refit').onclick=()=>{if(camera.running){camera.processor.calibrate();lastShown=performance.now();$('result').textContent='Look at the screen and relax your shoulders';update();}};
$<HTMLInputElement>('practice-sensitivity').oninput=e=>{camera.processor.sensitivity=settings.sensitivity=Number((e.target as HTMLInputElement).value);try{localStorage.setItem('sunny-kart-settings',JSON.stringify(settings));}catch{}};
function feedback(actual:string){if(!target)return;target.actual=actual;corrections.push({...target});if(corrections.length>40)corrections.shift();save();$('correction').hidden=true;$('feedback-status').textContent=`Recorded your move: ${labels[actual]}.`;history();target=null;}
$('correct').onclick=()=>{target=readings.at(-1)||null;if(target)feedback(target.action);};
$('wrong').onclick=()=>{target=readings.at(-1)||null;$('correction').hidden=!target;};
$('missed').onclick=()=>{target=snapshot('missed');readings.push(target);if(readings.length>40)readings.shift();save();$('correction').hidden=false;history();};
document.querySelectorAll<HTMLButtonElement>('[data-actual]').forEach(b=>b.onclick=()=>feedback(b.dataset.actual!));
function frame(now:number){void camera.frame(now);if(now-lastUI>80){update();lastUI=now;}requestAnimationFrame(frame);}let lastUI=0;requestAnimationFrame(frame);
addEventListener('pagehide',()=>camera.stop());document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
history();const hooks=window as unknown as Record<string,any>;hooks.render_game_to_text=()=>JSON.stringify({mode:'gesture-test',running:camera.running,ready:camera.processor.ready,fps:Math.round(camera.fps),processingMs:Math.round(camera.inferenceMs),error:camera.error,readings,corrections});
if(new URLSearchParams(location.search).has('test'))hooks.__gestureTest={camera,update,readings,corrections,assessment};
if(new URLSearchParams(location.search).get('camera')==='1')void connect();
