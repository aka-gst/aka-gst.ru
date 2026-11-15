(() => {
  'use strict';
  const QQ=window.QQ,{V3}=QQ.Math3D;
  class SpatialAudioSystem{
    constructor(ctx){
      this.ctx=ctx;this.nodes=new Map();this.lastZone=null;this.returnAltered=false;
      this.sources=[
        {id:'ARRIVAL_HUM',pos:[-8.8,2.2,13],freq:54,type:'sine',vol:.018,range:15},
        {id:'RELAY_HUM',pos:[15.2,1.2,10.6],freq:92,type:'sawtooth',vol:.014,range:13},
        {id:'SPATIAL_CORE',pos:[0,1.5,-25],freq:118,type:'sine',vol:.02,range:14},
        {id:'PORTAL_A',pos:[0,1.5,-30.65],freq:164,type:'triangle',vol:.014,range:9},
        {id:'PORTAL_B',pos:[-8.55,1.5,-24],freq:174,type:'triangle',vol:.014,range:9}
      ];
      ctx.events.on('ALTERED_RETURN_ACTIVATED',()=>{this.returnAltered=true;this.ctx.emit('AUDIO_WORLD_STATE',{state:'ALTERED_RETURN'});});
    }
    ensure(src){
      const c=this.ctx.audio.audioCtx;if(!c||this.nodes.has(src.id))return this.nodes.get(src.id)||null;
      const osc=c.createOscillator(),gain=c.createGain(),pan=c.createStereoPanner?c.createStereoPanner():null;
      osc.type=src.type;osc.frequency.value=src.freq;gain.gain.value=.00001;
      if(pan){osc.connect(gain).connect(pan).connect(c.destination);}else osc.connect(gain).connect(c.destination);
      osc.start();const n={osc,gain,pan};this.nodes.set(src.id,n);return n;
    }
    update(dt){
      const c=this.ctx.audio.audioCtx;if(!c||this.ctx.world.realm!=='day')return;
      const p=this.ctx.player.state.pos,yaw=this.ctx.player.state.yaw||0;let nearest=null,nearestD=Infinity;
      for(const src of this.sources){const n=this.ensure(src);if(!n)continue;const dx=src.pos[0]-p[0],dz=src.pos[2]-p[2],d=Math.hypot(dx,dz),fall=Math.max(0,1-d/src.range);let vol=src.vol*fall*fall;if(this.returnAltered&&src.id==='ARRIVAL_HUM')vol*=1.65;
        const t=c.currentTime;n.gain.gain.setTargetAtTime(Math.max(.00001,vol),t,.08);if(n.pan){const ang=Math.atan2(dx,-dz)-yaw;n.pan.pan.setTargetAtTime(Math.max(-1,Math.min(1,Math.sin(ang))),t,.06);}if(this.returnAltered&&src.id==='ARRIVAL_HUM')n.osc.frequency.setTargetAtTime(47,t,.15);
        if(d<nearestD){nearestD=d;nearest=src.id;}
      }
      if(nearest&&nearest!==this.lastZone&&nearestD<8){const before=this.lastZone;this.lastZone=nearest;this.ctx.emit('SPATIAL_AUDIO_ZONE',{before,zone:nearest,distance:+nearestD.toFixed(2)});}
    }
  }
  QQ.SpatialAudioSystem=SpatialAudioSystem;
})();
