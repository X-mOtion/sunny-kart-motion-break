import type {ControlMode} from './config';
export class ControlSession {
 private modes=new Set<ControlMode>();
 started:ControlMode='keyboard';
 begin(mode:ControlMode){this.started=mode;this.modes.clear();this.modes.add(mode);}
 note(mode:ControlMode){this.modes.add(mode);}
 get category():ControlMode|'mixed'{return this.modes.size>1?'mixed':this.started;}
 snapshot(){return {started:this.started,used:[...this.modes],category:this.category};}
}
