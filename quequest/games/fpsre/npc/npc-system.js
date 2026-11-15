(() => {
  'use strict';
  const QQ=window.QQ;
  class NPCSystem{
    constructor(ctx){this.ctx=ctx;this.agents=new Map();}
    register(id,opt={}){const npc={id,name:id,pos:[0,0,0],yaw:0,visible:true,state:'IDLE',controller:'SCRIPT/AI',lookAt:null,...opt};this.agents.set(id,npc);this.ctx.emit('NPC_REGISTER',{npc:id,state:npc.state,controller:npc.controller});return npc;}
    get(id){return this.agents.get(id)}
    setState(id,state,extra={}){const n=this.get(id);if(!n)return;const from=n.state;n.state=state;Object.assign(n,extra);if(from!==state)this.ctx.emit('NPC_STATE',{npc:id,from,to:state});}
    say(id,line,{objective=null}={}){const n=this.get(id);if(!n)return;n.lastLine=line;this.ctx.emit('NPC_DIALOGUE',{npc:id,line});if(objective)this.ctx.ui.objective(objective.title,objective.text);}
    update(dt){for(const n of this.agents.values()){if(!n.visible)continue;if(n.state==='BACK_AWAY')n.pos[2]+=dt*.6;if(n.state==='COVER')n.pos[0]-=dt*.45;}}
  }
  QQ.NPCSystem=NPCSystem;
})();
