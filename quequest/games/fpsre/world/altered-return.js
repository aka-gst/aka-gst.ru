(() => {
  'use strict';
  const QQ=window.QQ,{rgb}=QQ.Math3D;
  class AlteredReturnSystem{
    constructor(ctx){this.ctx=ctx;this.active=false;ctx.events.on('SLICE_STAGE',e=>{if(e.stage==='RETURN')this.activate();});}
    activate(){if(this.active)return;this.active=true;const l=this.ctx.level;
      if(l.arrivalWallL){l.arrivalWallL.visible=false;l.arrivalWallL.solid=false;}
      if(l.returnPartition){l.returnPartition.visible=true;l.returnPartition.solid=true;l.returnPartition.emissive=.05;}
      if(l.returnLight){l.returnLight.visible=true;l.returnLight.emissive=1;l.returnLight.color=rgb('#d685ff');}
      if(l.returnSign){l.returnSign.visible=true;l.returnSign.emissive=1;l.returnSign.color=rgb('#ffbd63');}
      if(l.observationGlass){l.observationGlass.color=rgb('#7d6cff');l.observationGlass.emissive=.24;}
      this.ctx.visual.fogColor=rgb('#0b0a15');this.ctx.visual.incidentPulse=1;
      this.ctx.fx.pulse([-10.8,1.6,12.1],rgb('#d685ff'),1.1);
      this.ctx.emit('ALTERED_RETURN_ACTIVATED',{changes:['ARRIVAL_WALL_OPENED','RETURN_PARTITION_PRESENT','RETURN_LIGHT_VIOLET','OBSERVATION_GLASS_SHIFTED','ARRIVAL_AUDIO_DETUNED']});
      this.ctx.ui.objective('ВОЗВРАЩЕНИЕ','Знакомое место изменилось. Старому плану больше нельзя полностью доверять.');
    }
    update(){/* event-driven; kept as a system contract for future temporal morphs */}
    debugText(){return `ALTERED RETURN\n${this.active?'ACTIVE':'DORMANT'}\ngeometry ${this.active?'MUTATED':'BASELINE'}\naudio ${this.active?'DETUNED':'BASELINE'}`;}
  }
  QQ.AlteredReturnSystem=AlteredReturnSystem;
})();
