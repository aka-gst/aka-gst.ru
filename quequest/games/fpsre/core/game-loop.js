(() => {
  'use strict';
  const QQ=window.QQ;
  class GameLoopSystem{
    constructor(ctx){this.ctx=ctx;this.running=false;this.last=performance.now();this.frameCount=0;this.fpsAccum=0;this.fps=60;this.demoTimer=0;this.demo=new URLSearchParams(location.search).get('demo')==='1';this.bound=this.frame.bind(this);}
    start(){if(this.running)return;this.running=true;this.last=performance.now();requestAnimationFrame(this.bound);this.ctx.emit('GAME_LOOP_START');}
    stop(){this.running=false;this.ctx.emit('GAME_LOOP_STOP');}
    dayUpdate(dt,now){const c=this.ctx;c.triggers.update();c.doors.update(dt);c.sequences.update(dt);c.npcs.update(dt);c.director.update(dt);c.topologyEncounter.update(dt);c.re.update(dt);c.portals.update(dt);c.impossibleGeometry.update(dt);c.projection.update(dt);c.projectionRoom.update(dt);c.weapons.update(dt);c.ballistics.update(dt);c.props.update(dt);c.ai.update(dt,now);c.items.update(now);}
    dreamUpdate(dt){const c=this.ctx;c.dream.update(dt);c.weapons.update(dt);}
    demoUpdate(dt,now){if(!this.demo)return;const c=this.ctx;c.player.state.yaw+=dt*(c.world.realm==='dream'?.055:.11);if(c.world.realm==='day'){this.demoTimer-=dt;if(this.demoTimer<=0){this.demoTimer=1.8;const seq=['RAIL','ROCKET','SHOCK'];c.weapons.setWeapon(seq[Math.floor(now/1800)%seq.length]);c.weapons.fire();}}}
    frame(now){if(!this.running)return;const c=this.ctx,dt=Math.max(0,Math.min(QQ.Config.physics.maxDt,(now-this.last)/1000||.016));this.last=now;this.frameCount++;this.fpsAccum+=dt;if(this.fpsAccum>=.5){this.fps=Math.round(this.frameCount/this.fpsAccum);this.frameCount=0;this.fpsAccum=0;}
      if(!c.debug.paused){c.player.update(dt);if(c.world.realm==='day')this.dayUpdate(dt,now);else this.dreamUpdate(dt);c.ambientFx.update(dt);c.fx.update(dt);c.spatialAudio.update(dt);c.alteredReturn.update(dt);c.visual.update(dt);c.screenFx.update(dt);}
      this.demoUpdate(dt,now);c.renderer.render();c.twilight.update(dt);c.ui.update(now,this.fps);c.debug.update();c.telemetry.update(dt,now,this.fps);requestAnimationFrame(this.bound);
    }
  }
  QQ.GameLoopSystem=GameLoopSystem;
})();
