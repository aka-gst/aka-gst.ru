(() => {
  'use strict';
  const QQ=window.QQ;
  class CausalNavigatorSystem{
    constructor(ctx){this.ctx=ctx;this.index=0;this.chain=[];this.refresh();}
    refresh(){const t=this.ctx.re?.target;if(!t)return[];this.chain=[
      {kind:'FIELD',label:'SECURITY_DOOR_A17.locked',detail:`address ${t.address}`},
      {kind:'WRITER',label:t.writer,detail:'writes lock state'},
      {kind:'CALLER',label:t.caller,detail:'invokes writer during security tick'},
      {kind:'POLICY',label:'IncidentPolicy::evaluateLockdown()',detail:'decides whether A17 should remain locked'},
      {kind:'ROOT',label:'WorldDirector::incident_03()',detail:'upstream scene state / lockdown source'}
    ];return this.chain;}
    current(){this.refresh();return this.chain[Math.max(0,Math.min(this.index,this.chain.length-1))]||null;}
    step(delta=1){if((this.ctx.re.analysisDepth||0)<3){this.ctx.ui.msg('CODE TRACE REQUIRED // F6');return null;}this.refresh();this.index=Math.max(0,Math.min(this.chain.length-1,this.index+delta));const c=this.current();this.ctx.emit('CAUSE_NAVIGATE',{index:this.index,kind:c.kind,label:c.label});this.ctx.ui.msg(`${c.kind} // ${c.label}`);return c;}
    reset(){this.index=0;}
    text(){const c=this.current();return `UPSTREAM TRACE ${this.index+1}/${this.chain.length}\n${c?.kind||'—'}\n${c?.label||'—'}\n${c?.detail||''}\n\n[ / ] NAVIGATE`;}
  }
  QQ.CausalNavigatorSystem=CausalNavigatorSystem;
})();
