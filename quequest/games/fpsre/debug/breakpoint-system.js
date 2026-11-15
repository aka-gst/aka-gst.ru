(() => {
  'use strict';
  const QQ=window.QQ;
  class BreakpointSystem{
    constructor(ctx){this.ctx=ctx;this.rules=new Map();this.paused=false;this.lastBreak=null;ctx.events.on('FIELD_HISTORY_RECORD',e=>this.onFieldChange(e));}
    key(entity,field){return `${entity}.${field}`;}
    toggle(entity,field){const key=this.key(entity,field);if(this.rules.has(key)){this.rules.delete(key);this.ctx.emit('BREAKPOINT_REMOVE',{entity,field});this.ctx.ui.msg('BREAK ON WRITE // OFF');return false;}this.rules.set(key,{entity,field,key,hits:0});this.ctx.emit('BREAKPOINT_ADD',{entity,field});this.ctx.ui.msg('BREAK ON WRITE // ARMED');return true;}
    toggleActiveWatch(){const w=this.ctx.watch?.active?.();if(!w){this.ctx.ui.msg('NO ACTIVE WATCH');return false;}return this.toggle(w.entity,w.field);}
    has(entity,field){return this.rules.has(this.key(entity,field));}
    onFieldChange(e){const rule=this.rules.get(this.key(e.entity,e.field));if(!rule)return;rule.hits++;this.paused=true;this.lastBreak={...e,ruleHits:rule.hits};this.ctx.emit('DEBUG_BREAK',{entity:e.entity,field:e.field,before:e.before,after:e.after,source:e.source,hits:rule.hits});this.ctx.timeline?.select?.(e.entity,e.field,'latest');this.ctx.debug?.openBreak?.(this.lastBreak);this.ctx.ui.msg(`BREAK // ${e.entity}.${e.field}`);}
    resume(){if(!this.paused)return false;const b=this.lastBreak;this.paused=false;if(this.ctx.debug?.f4){this.ctx.debug.f4=false;document.getElementById('replay')?.classList.add('hidden');}this.ctx.emit('DEBUG_RESUME',{entity:b?.entity,field:b?.field});this.ctx.ui.msg('EXECUTION RESUMED');return true;}
    debugText(){if(!this.rules.size)return 'NO BREAKPOINTS\n\nSHIFT+F7 arms break-on-write for the active watch.';return [...this.rules.values()].map(r=>`${this.paused&&this.lastBreak?.entity===r.entity&&this.lastBreak?.field===r.field?'■':'●'} ${r.entity}.${r.field}\n  hits=${r.hits}`).join('\n\n');}
  }
  QQ.BreakpointSystem=BreakpointSystem;
})();
