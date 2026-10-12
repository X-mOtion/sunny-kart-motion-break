const focusables='button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';
export class ModalFocus {
 active:HTMLElement|null=null;
 private returns=new WeakMap<HTMLElement,HTMLElement>();
 constructor(private dialogs:HTMLElement[],private app:HTMLElement){
  for(const d of dialogs){
   d.setAttribute('role','dialog');d.tabIndex=-1;
   const title=d.querySelector<HTMLElement>('h2');if(title){title.id ||= `${d.id}-title`;d.setAttribute('aria-labelledby',title.id);}
   new MutationObserver(()=>this.sync()).observe(d,{attributes:true,attributeFilter:['hidden']});
  }
  document.addEventListener('keydown',e=>{
   if(e.key!=='Tab'||!this.active)return;
   const items=this.items(this.active),current=document.activeElement,index=items.indexOf(current as HTMLElement);
   if(!items.length){e.preventDefault();this.active.focus();}
   else if(e.shiftKey&&(index<=0)||!e.shiftKey&&(index<0||index===items.length-1)){e.preventDefault();items[e.shiftKey?items.length-1:0].focus();}
  });
  document.addEventListener('focusin',e=>{if(this.active&&!this.active.contains(e.target as Node))this.focus(this.active);});
 }
 private items(d:HTMLElement){return [...d.querySelectorAll<HTMLElement>(focusables)].filter(e=>!e.closest('[hidden],[inert]')&&e.getClientRects().length>0);}
 private focus(d:HTMLElement){(this.items(d)[0]||d).focus({preventScroll:true});}
 sync(){
  const fatal=document.querySelector<HTMLElement>('.fatal');
  const next=fatal||this.dialogs.find(d=>!d.hidden&&d.getClientRects().length>0)||null;
  if(next===this.active)return;
  const old=this.active,focused=document.activeElement;
  if(next&&(!old||!old.contains(next)))this.returns.set(next,focused instanceof HTMLElement?focused:this.app);
  this.active=next;
  for(const child of [...this.app.children])if(child instanceof HTMLElement)child.inert=!!next&&child!==next;
  for(const d of this.dialogs)d.setAttribute('aria-modal',String(d===next));
  const restore=old&&this.returns.get(old);
  if(restore?.isConnected&&!restore.closest('[hidden],[inert]')&&(!next||next.contains(restore)))restore.focus({preventScroll:true});
  else if(next)this.focus(next);
  else document.getElementById('game')?.focus({preventScroll:true});
 }
}
