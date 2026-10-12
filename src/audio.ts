import type {Race} from './race';
export class GameAudio {
 context:AudioContext|null=null;engine:AudioBufferSourceNode|null=null;drift:AudioBufferSourceNode|null=null;
 engineGain:GainNode|null=null;driftGain:GainNode|null=null;master:GainNode|null=null;
 music:HTMLAudioElement;finalMusic:HTMLAudioElement;musicVolume=.2;effectsVolume=.55;started=false;loading=false;lastLap=false;lastCount=0;
 constructor(base:string){this.music=new Audio(`${base}assets/audio/race.mp3`);this.finalMusic=new Audio(`${base}assets/audio/final.mp3`);for(const a of [this.music,this.finalMusic]){a.loop=true;a.preload='none';a.volume=0;}this.base=base;}
 base:string;
 start(){
  if(!this.context){this.context=new AudioContext();this.master=this.context.createGain();this.master.connect(this.context.destination);}
  void this.context.resume();this.started=true;
  this.music.volume=this.musicVolume;void this.music.play().catch(()=>{});
  // Unlock both HTML media elements during the explicit start interaction on iOS.
  this.finalMusic.volume=0;void this.finalMusic.play().catch(()=>{});
  if(!this.loading&&!this.engine){this.loading=true;void this.loadLoops();}
 }
 async loadLoops(){
  const ctx=this.context!;
  try{const buffers=await Promise.all(['engine','drift'].map(async n=>{const r=await fetch(`${this.base}assets/audio/${n}.wav`);return ctx.decodeAudioData(await r.arrayBuffer());}));
   [this.engine,this.drift]=buffers.map(buffer=>{const s=ctx.createBufferSource();s.buffer=buffer;s.loop=true;return s;});
   this.engineGain=ctx.createGain();this.driftGain=ctx.createGain();this.engineGain.gain.value=0;this.driftGain.gain.value=0;
   this.engine.connect(this.engineGain).connect(this.master!);this.drift.connect(this.driftGain).connect(this.master!);this.engine.start();this.drift.start();
  }catch{this.loading=false;}
 }
 tone(frequency:number,duration=.12,type:OscillatorType='sine',volume=.16){
  if(!this.context||!this.master)return;const c=this.context,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(frequency,c.currentTime);o.frequency.exponentialRampToValueAtTime(frequency*.65,c.currentTime+duration);g.gain.setValueAtTime(volume,c.currentTime);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+duration);o.connect(g).connect(this.master);o.onended=()=>{o.disconnect();g.disconnect();};o.start();o.stop(c.currentTime+duration);
 }
 whooshBuffer:AudioBuffer|null=null;
 whoosh(){
  if(!this.context||!this.master)return;const c=this.context;
  if(!this.whooshBuffer){this.whooshBuffer=c.createBuffer(1,Math.ceil(c.sampleRate*.4),c.sampleRate);const samples=this.whooshBuffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*(1-i/samples.length);}
  const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=this.whooshBuffer;filter.type='bandpass';filter.Q.value=.7;filter.frequency.setValueAtTime(650,c.currentTime);filter.frequency.exponentialRampToValueAtTime(2200,c.currentTime+.12);filter.frequency.exponentialRampToValueAtTime(350,c.currentTime+.4);gain.gain.setValueAtTime(.001,c.currentTime);gain.gain.linearRampToValueAtTime(.22,c.currentTime+.035);gain.gain.exponentialRampToValueAtTime(.001,c.currentTime+.4);source.connect(filter).connect(gain).connect(this.master);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};source.start();
 }
 overtake(){this.tone(1320,.17,'sine',.07);this.tone(1760,.23,'sine',.04);}
 update(race:Race,dt:number){
  if(!this.context||!this.master||!this.started)return;const playing=race.phase==='racing'||race.phase==='countdown',c=race.cars[0],last=c.lap===2;
  this.master.gain.setTargetAtTime(playing?this.effectsVolume:0,this.context.currentTime,.08);
  this.engine?.playbackRate.setTargetAtTime(.65+Math.max(0,c.speed)/40*1.4,this.context.currentTime,.1);
  this.engineGain?.gain.setTargetAtTime(playing?.11+Math.max(0,c.speed)/40*.15:0,this.context.currentTime,.08);
  this.driftGain?.gain.setTargetAtTime(playing&&c.drifting?Math.min(.4,Math.abs(c.slip)*1.5):0,this.context.currentTime,.06);
  const targetA=playing&&!last?this.musicVolume:0,targetB=playing&&last?this.musicVolume:0;
  this.music.volume+=(targetA-this.music.volume)*Math.min(1,dt*3);this.finalMusic.volume+=(targetB-this.finalMusic.volume)*Math.min(1,dt*3);
  const count=Math.ceil(race.countdown);if(race.phase==='countdown'&&count!==this.lastCount){this.tone(420,.12);this.lastCount=count;}
 }
 events(race:Race){for(const e of race.events){if(e.id!==0)continue;if(e.type==='nitro'){this.whoosh();this.tone(220,.25,'triangle',.07);}if(e.type==='mini')this.tone(750,.18,'sine',.13);if(e.type==='charge')this.tone(1100,.15);if(e.type==='hit')this.tone(75,.18,'triangle',.3);if(e.type==='go')this.tone(920,.35);if(e.type==='finish')this.tone(1250,.6);}}
 stop(){this.started=false;this.music.pause();this.finalMusic.pause();if(this.master&&this.context)this.master.gain.setValueAtTime(0,this.context.currentTime);}
}
