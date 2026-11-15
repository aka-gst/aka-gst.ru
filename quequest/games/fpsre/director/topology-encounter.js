(() => {
  'use strict';
  const QQ=window.QQ;
  class TopologyEncounterSystem{
    constructor(ctx){this.ctx=ctx;this.started=false;this.completed=false;this.transitSeen=false;
      ctx.events.on('PORTAL_DISCOVERED',e=>{if(!this.started&&['A','B'].includes(e.portal))this.start();});
      ctx.events.on('AI_TOPOLOGY_TRANSIT',e=>{if(this.started&&!this.completed&&e.agent==='Q-BOT'){this.transitSeen=true;this.completed=true;ctx.emit('TOPOLOGY_ENCOUNTER_PROOF',{agent:'Q-BOT',edge:e.edge});ctx.ui.objective('SYSTEMIC TOPOLOGY','Q-Bot used the same topology graph as you. The portal is world structure, not a player-only trick.');}});
    }
    start(){this.started=true;const b=this.ctx.ai.bot;b.pos=[-7.45,0,-23.25];b.vel=[0,0,0];b.decision=.1;this.ctx.noise.emit(this.ctx.player.camera(),26,'SPATIAL_CONTACT',{source:'PLAYER'});this.ctx.emit('TOPOLOGY_ENCOUNTER_START',{botPos:b.pos,playerPos:[...this.ctx.player.state.pos]});this.ctx.ui.objective('SPATIAL LAB // CONTACT','Something heard you from the other side. Watch where it comes from.');}
    update(){}
  }
  QQ.TopologyEncounterSystem=TopologyEncounterSystem;
})();
