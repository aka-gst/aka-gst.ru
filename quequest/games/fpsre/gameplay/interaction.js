(() => {
  'use strict';
  const QQ=window.QQ,{V3}=QQ.Math3D;
  class InteractionSystem{
    constructor(ctx){this.ctx=ctx;this.entries=new Map();this.installDefaults();}
    register(name,opt){const e={name,range:3,realm:'day',priority:0,...opt};this.entries.set(name,e);this.ctx.emit('INTERACTION_REGISTER',{interaction:name,realm:e.realm,range:e.range});return e;}
    installDefaults(){
      this.register('ANOMALY_TERMINAL',{realm:'day',range:3.2,priority:10,getPosition:()=>this.ctx.level.sleepPod.pos,action:()=>this.ctx.dream.enter('ANOMALY_TERMINAL')});
      this.register('ANOMALY_EXIT',{realm:'dream',range:3,priority:10,getPosition:()=>this.ctx.level.dreamExit.pos,action:()=>this.ctx.dream.wake(true,'ANOMALY_EXIT')});
    }
    candidates(){const c=this.ctx,realm=c.world.realm,p=c.player.camera(),out=[];for(const e of this.entries.values()){if(e.realm!=='any'&&e.realm!==realm)continue;if(e.condition&&!e.condition(c))continue;const pos=e.getPosition?.(c);if(!pos)continue;const d=V3.len(V3.sub(p,pos));if(d<=e.range)out.push({e,d});}return out.sort((a,b)=>(b.e.priority-a.e.priority)||(a.d-b.d));}
    use(){const hit=this.candidates()[0];if(!hit){this.ctx.ui.msg(this.ctx.world.realm==='dream'?'KEEP CLIMBING':'NOTHING TO INTERACT WITH');this.ctx.emit('INTERACTION_MISS',{realm:this.ctx.world.realm});return false;}this.ctx.emit('INTERACTION_USE',{interaction:hit.e.name,distance:+hit.d.toFixed(2)});hit.e.action?.(this.ctx,hit);return true;}
  }
  QQ.InteractionSystem=InteractionSystem;
})();
