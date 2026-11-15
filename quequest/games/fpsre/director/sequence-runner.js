(() => {
  'use strict';
  const QQ=window.QQ;
  class SequenceRunner{
    constructor(ctx){this.ctx=ctx;this.active=new Map();}
    start(name,steps,{onEnd=null}={}){if(this.active.has(name))return this.active.get(name);const seq={name,steps,index:-1,t:0,done:false,onEnd};this.active.set(name,seq);this.ctx.emit('SEQUENCE_START',{sequence:name,steps:steps.map(s=>s.name)});this.advance(seq);return seq;}
    advance(seq){seq.index++;seq.t=0;if(seq.index>=seq.steps.length){seq.done=true;this.active.delete(seq.name);this.ctx.emit('SEQUENCE_END',{sequence:seq.name});seq.onEnd?.(seq,this.ctx);return;}const step=seq.steps[seq.index];this.ctx.emit('SEQUENCE_STEP',{sequence:seq.name,step:step.name,index:seq.index});step.enter?.(seq,this.ctx);}
    update(dt){for(const seq of [...this.active.values()]){const step=seq.steps[seq.index];if(!step)continue;seq.t+=dt;step.update?.(dt,seq,this.ctx);const finished=step.until?!!step.until(seq,this.ctx):seq.t>=(step.duration??0);if(finished){step.exit?.(seq,this.ctx);this.advance(seq);}}}
    isRunning(name){return this.active.has(name)}
    get(name){return this.active.get(name)}
  }
  QQ.SequenceRunner=SequenceRunner;
})();
