(() => {
  'use strict';
  const QQ=window.QQ;
  class TriggerSystem{
    constructor(ctx){this.ctx=ctx;this.triggers=new Map();}
    sphere(name,center,radius,opt={}){return this.register(name,{shape:'sphere',center:[...center],radius,...opt});}
    box(name,min,max,opt={}){return this.register(name,{shape:'box',min:[...min],max:[...max],...opt});}
    register(name,t){const trigger={name,enabled:t.enabled!==false,once:!!t.once,inside:false,fired:false,tags:t.tags||[],...t};this.triggers.set(name,trigger);this.ctx.emit('TRIGGER_REGISTER',{trigger:name,shape:trigger.shape,once:trigger.once});return trigger;}
    setEnabled(name,enabled){const t=this.triggers.get(name);if(t)t.enabled=!!enabled;}
    contains(t,p){if(t.shape==='sphere')return Math.hypot(p[0]-t.center[0],p[1]-t.center[1],p[2]-t.center[2])<=t.radius;return p[0]>=t.min[0]&&p[0]<=t.max[0]&&p[1]>=t.min[1]&&p[1]<=t.max[1]&&p[2]>=t.min[2]&&p[2]<=t.max[2];}
    update(){const p=this.ctx.player?.state?.pos;if(!p||this.ctx.world.realm!=='day')return;for(const t of this.triggers.values()){if(!t.enabled||(t.once&&t.fired))continue;const inside=this.contains(t,p);if(inside&&!t.inside){t.inside=true;t.fired=true;this.ctx.emit('TRIGGER_ENTER',{trigger:t.name,tags:t.tags});try{t.onEnter?.(t,this.ctx);}catch(e){this.ctx.emit('TRIGGER_ERROR',{trigger:t.name,error:String(e)})}}else if(!inside&&t.inside){t.inside=false;this.ctx.emit('TRIGGER_EXIT',{trigger:t.name,tags:t.tags});try{t.onExit?.(t,this.ctx);}catch(e){this.ctx.emit('TRIGGER_ERROR',{trigger:t.name,error:String(e)})}}}}
    list(){return [...this.triggers.values()];}
  }
  QQ.TriggerSystem=TriggerSystem;
})();
