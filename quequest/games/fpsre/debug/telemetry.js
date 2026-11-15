(() => {
  'use strict';
  const QQ=window.QQ;
  class TelemetrySystem{
    constructor(ctx){this.ctx=ctx;this.timer=0;this.lowFpsTimer=0;this.lastSnapshot=null;}
    update(dt,now,fps){this.timer+=dt;if(fps<28)this.lowFpsTimer+=dt;else this.lowFpsTimer=0;if(this.lowFpsTimer>2){this.lowFpsTimer=-999;this.ctx.emit('PERFORMANCE_WARNING',{fps,particles:this.ctx.fx.particles.length,debris:this.ctx.fx.debris.length});}
      if(this.timer<2)return;this.timer=0;const p=this.ctx.player.state,s=this.ctx.director.scene;this.lastSnapshot={fps,pos:p.pos.map(v=>+v.toFixed(2)),hp:+p.hp.toFixed(1),armor:+p.armor.toFixed(1),weapon:p.weapon,particles:this.ctx.fx.particles.length,debris:this.ctx.fx.debris.length,projectiles:this.ctx.weapons.projectiles.length,realm:this.ctx.world.realm,botGoal:this.ctx.world.realm==='day'?(this.ctx.ai.bot.target?.type||null):null,botState:this.ctx.ai.bot.state,directorState:s.state,dreamCheckpoint:this.ctx.dream.state.checkpoint,dreamTide:+this.ctx.dream.state.tideY.toFixed(2),systems:this.ctx.systems.size};this.ctx.logger.snapshot(this.lastSnapshot);}
  }
  QQ.TelemetrySystem=TelemetrySystem;
})();
