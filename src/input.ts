import {emptyInput,type ControlMode,type InputFrame} from './config';
export class Inputs {
 mode:ControlMode='keyboard';keys=new Set<string>();boost=false;touchSteer=0;driftPointers=new Set<number>();brakePointers=new Set<number>();turnPointer:number|null=null;
 onCommand:(command:string)=>void=()=>{};
 canDrive:()=>boolean=()=>true;
 constructor(){
  addEventListener('keydown',e=>{if(e.defaultPrevented)return;if(e.code==='Escape'){if(!e.repeat){e.preventDefault();this.onCommand('pause');}return;}
   if(e.target instanceof Element&&(e.target.closest('input,select,textarea,[contenteditable="true"]')||e.target.closest('button,a')&&['Space','Enter'].includes(e.code))||!this.canDrive())return;
   if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight'].includes(e.code))e.preventDefault();
   if(e.repeat)return;this.keys.add(e.code);if(e.code==='Space')this.boost=true;
   if(e.code==='KeyR')this.onCommand('reset');if(e.code==='KeyF')this.onCommand('fullscreen');
  });
  addEventListener('keyup',e=>this.keys.delete(e.code));addEventListener('blur',()=>{this.clear();this.onCommand('blur');});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){this.clear();this.onCommand('blur');}});
 }
 clear(){this.keys.clear();this.boost=false;this.touchSteer=0;this.driftPointers.clear();this.brakePointers.clear();this.turnPointer=null;}
 bindTouch(turn:HTMLElement,drift:HTMLElement,brake:HTMLElement,boost:HTMLElement){
  const steer=(e:PointerEvent)=>{const r=turn.getBoundingClientRect();this.touchSteer=Math.max(-1,Math.min(1,(e.clientX-r.left-r.width/2)/(r.width*.36)));turn.style.setProperty('--thumb',`${(this.touchSteer+1)*40+10}%`);};
  turn.onpointerdown=e=>{e.preventDefault();if(this.turnPointer!==null)return;this.turnPointer=e.pointerId;turn.setPointerCapture(e.pointerId);steer(e);};
  turn.onpointermove=e=>{if(e.pointerId===this.turnPointer)steer(e);};
  const clearTurn=(e:PointerEvent)=>{if(e.pointerId===this.turnPointer){this.turnPointer=null;this.touchSteer=0;turn.style.setProperty('--thumb','50%');}};
  turn.onpointerup=clearTurn;turn.onpointercancel=clearTurn;turn.onlostpointercapture=clearTurn;
  for(const [button,set] of [[drift,this.driftPointers],[brake,this.brakePointers]] as const){
   button.onpointerdown=e=>{e.preventDefault();set.add(e.pointerId);button.setPointerCapture(e.pointerId);button.classList.add('pressed');};
   const release=(e:PointerEvent)=>{set.delete(e.pointerId);if(!set.size)button.classList.remove('pressed');};
   button.onpointerup=release;button.onpointercancel=release;button.onlostpointercapture=release;
   button.onpointermove=e=>{const r=button.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)release(e);};
  }
  boost.onpointerdown=e=>{e.preventDefault();this.boost=true;};
 }
 read():InputFrame {
  const out=emptyInput();out.actionControl=false;
  if(this.mode==='keyboard'){out.steer=(this.keys.has('KeyD')||this.keys.has('ArrowRight')?1:0)-(this.keys.has('KeyA')||this.keys.has('ArrowLeft')?1:0);out.throttle=this.keys.has('KeyW')||this.keys.has('ArrowUp')?1:0;out.brake=this.keys.has('KeyS')||this.keys.has('ArrowDown')?1:0;out.drift=this.keys.has('ShiftLeft')||this.keys.has('ShiftRight');}
  if(this.mode==='touch'){out.steer=this.touchSteer;out.throttle=this.brakePointers.size?0:1;out.brake=this.brakePointers.size?1:0;out.drift=this.driftPointers.size>0;}
  out.boost=this.boost;this.boost=false;return out;
 }
}
