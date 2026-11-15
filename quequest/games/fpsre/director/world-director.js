(() => {
  'use strict';
  const QQ=window.QQ,{rgb}=QQ.Math3D;
  class WorldDirector{
    constructor(ctx){
      this.ctx=ctx;
      this.steamTimer=0;
      this.scene={state:'IDLE',t:0,started:false,completed:false,sequence:'MAINTENANCE_FAILURE'};
      this.flicker=0;
      this.installTriggers();
    }
    installTriggers(){
      const c=this.ctx,l=c.level;
      c.triggers.sphere('ANOMALY_TERMINAL_NEAR',l.sleepPod.pos,3.2,{tags:['interaction','anomaly'],onEnter:()=>{c.dream.state.prompted=true;c.ui.objective('ANOMALY LAB // ACCESS','Press E to enter the impossible-geometry sandbox.');c.emit('ANOMALY_TERMINAL_NEAR');},onExit:()=>{if(c.dream)c.dream.state.prompted=false;}});
      c.triggers.sphere('BLAST_DOOR_PROXIMITY',l.blastDoor.pos,4.5,{tags:['door'],onEnter:()=>c.doors.open('BLAST_DOOR','PROXIMITY_TRIGGER'),onExit:()=>c.doors.close('BLAST_DOOR','PROXIMITY_TRIGGER')});
      c.triggers.sphere('ARRIVAL_DOOR_PROXIMITY',l.arrivalDoor.pos,4.2,{tags:['door'],onEnter:()=>c.doors.open('ARRIVAL_DOOR','PROXIMITY_TRIGGER'),onExit:()=>{if(c.player.state.pos[2]>11.5)c.doors.close('ARRIVAL_DOOR','PROXIMITY_TRIGGER')}});
      c.triggers.box('MAINTENANCE_SCENE_TRIGGER',[11.2,-2,8.2],[18,5,17],{once:true,tags:['director','scene'],onEnter:()=>this.startMaintenanceScene()});
    }
    setState(state){this.scene.state=state;this.scene.t=0;this.ctx.emit('DIRECTOR_STATE',{sequence:this.scene.sequence,state});}
    startMaintenanceScene(){
      if(this.scene.started)return;
      const c=this.ctx,l=c.level,C=QQ.Config.director;
      this.scene.started=true;
      c.emit('DIRECTOR_SEQUENCE_START',{sequence:this.scene.sequence,owner:'WorldDirector',releasePolicy:'scripted setup -> systemic consequences'});
      c.sequences.start(this.scene.sequence,[
        {name:'WARNING',duration:C.warningSeconds,enter:()=>{
          this.setState('WARNING');c.npcs.setState('TECH_01','NOTICE_PLAYER');
          c.npcs.say('TECH_01','Hold there. The relay is cycling wrong.',{objective:{title:'TECH // MAINTENANCE',text:'Hold there. The relay is cycling wrong.'}});
          c.audio.tone(180,.18,.02,'sine');
        }},
        {name:'FAILURE',duration:C.failureSeconds,enter:()=>{
          this.setState('FAILURE');c.npcs.setState('TECH_01','BACK_AWAY');
          c.npcs.say('TECH_01','No— back up. BACK UP.',{objective:{title:'POWER RELAY // FAILURE',text:'The scene is still directed. Watch what systems are being armed.'}});
          c.audio.tone(108,.55,.035,'sawtooth');c.noise.emit([15.2,1,10.6],8,'ALARM',{source:'POWER_RELAY'});
        },update:(dt)=>{this.flicker+=dt*16;l.sequenceLamp.visible=Math.sin(this.flicker)>-.15;l.sequenceLamp.color=rgb(Math.sin(this.flicker)>0?'#ff5b42':'#ffb14a');}},
        {name:'BREACH',duration:C.breachSeconds,enter:()=>{
          this.setState('BREACH');c.visual.pulse();l.sequenceLamp.visible=true;c.emit('WORLD_EVENT',{event:'RELAY_ARC'});c.fx.particlesBurst([15.2,1.3,10.6],rgb('#77ddff'),44,7,.8);c.audio.noise(.28,.055);c.audio.tone(62,.32,.05,'square');c.noise.emit([15.2,1.3,10.6],10,'ELECTRICAL_ARC',{source:'POWER_RELAY'});
        }},
        {name:'SYSTEMIC_COMBAT',duration:C.releaseSeconds,enter:()=>{
          this.setState('SYSTEMIC_COMBAT');c.visual.pulse();
          c.emit('SCRIPT_RELEASE',{sequence:this.scene.sequence,note:'Director stops owning consequences. Damage, Noise, AI Memory, Doors and Physics continue independently.'});
          c.damage.explode([...l.accidentBarrel.pos],'DIRECTOR_ACCIDENT');
          c.damage.object(l.relay,72,[15.2,1.0,10.6],'ELECTRICAL_FAILURE');
          c.damage.object(l.maintGlass,90,[12.1,1.5,8.15],'PRESSURE_WAVE');
          c.doors.open('MAINT_SECURITY_DOOR','SCRIPT_RELEASE');
          c.npcs.setState('TECH_01','COVER');
          c.ui.objective('SCRIPT RELEASED → SYSTEMIC WORLD','Explosion is now noise, damage, impulse and world state. AI reacts through perception/memory.');
          c.npcs.say('TECH_01','It heard that. Move!');
        }}
      ],{onEnd:()=>{this.scene.completed=true;c.emit('DIRECTOR_SEQUENCE_END',{sequence:this.scene.sequence,state:this.scene.state});}});
    }
    update(dt){
      if(this.ctx.world.realm!=='day')return;
      this.scene.t+=dt;
      this.steamTimer-=dt;
      if(this.steamTimer<=0){this.steamTimer=.085+Math.random()*.08;for(let i=0;i<2;i++)this.ctx.fx.particles.push({pos:[14+(Math.random()-.5)*.15,.8,-2+(Math.random()-.5)*.15],vel:[(Math.random()-.5)*.25,1.2+Math.random()*1.2,(Math.random()-.5)*.25],life:.7+Math.random()*.7,max:1.2,color:[.55,.68,.72,.38],size:22});}
    }
  }
  QQ.WorldDirector=WorldDirector;
})();
