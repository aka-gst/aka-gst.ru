(() => {
  'use strict';
  const QQ=window.QQ,{rgb,V3}=QQ.Math3D;
  class VisualSystem{
    constructor(ctx){
      this.ctx=ctx;this.fogColor=rgb('#11252b');this.fogNear=18;this.fogFar=60;this.exposure=1.64;this.ambient=.275;this.alert=0;this.incidentPulse=0;
      this.lightRig=[
        {id:'arrivalCool',pos:[-10,3.0,12],color:rgb('#89d8dd'),intensity:3.6,range:12},
        {id:'arrivalWarm',pos:[-6.0,2.45,9.0],color:rgb('#d2a36a'),intensity:2.0,range:6.5},
        {id:'re',pos:[-3,2.9,-9],color:rgb('#5ccbd2'),intensity:3.1,range:10},
        {id:'maint',pos:[14,2.7,10],color:rgb('#e0a35f'),intensity:3.3,range:10},
        {id:'upper',pos:[8,3.5,-7],color:rgb('#768ebc'),intensity:2.4,range:12},
        {id:'portalA',pos:[0,2.1,-29.7],color:rgb('#65d8d4'),intensity:3.6,range:9},
        {id:'portalB',pos:[-7.8,2.1,-24],color:rgb('#8f70b8'),intensity:3.4,range:9},
        {id:'portalCore',pos:[0,2.0,-25],color:rgb('#806db1'),intensity:2.8,range:8},
        {id:'security',pos:[-5.2,2.8,-12.4],color:rgb('#6fc0c5'),intensity:2.6,range:8},
        {id:'projection',pos:[0,2.4,-20.8],color:rgb('#79cdb5'),intensity:2.9,range:7},
        {id:'spatialFillL',pos:[-5.8,2.55,-22.0],color:rgb('#62c5ca'),intensity:3.4,range:8},
        {id:'spatialFillR',pos:[5.9,2.45,-27.2],color:rgb('#8a71ae'),intensity:3.45,range:8},
        {id:'rendererLab',pos:[4.3,2.25,-20.7],color:rgb('#72c8ad'),intensity:3.0,range:6},
        {id:'ballisticsTask',pos:[6.65,2.15,-12.55],color:rgb('#d5ae72'),intensity:2.7,range:6.3},
        {id:'spatialService',pos:[-6.05,2.15,-21.55],color:rgb('#65cfd0'),intensity:2.8,range:6.1},
        {id:'reForensics',pos:[-2.20,2.18,-13.00],color:rgb('#79c8c5'),intensity:2.55,range:5.8},
        {id:'a17Threshold',pos:[-5.20,2.55,-10.55],color:rgb('#d39a59'),intensity:3.05,range:6.4},
        {id:'v13Security',pos:[-6.5,2.85,7.0],color:rgb('#d5ad74'),intensity:3.05,range:7.0},
        {id:'v13HallCool',pos:[1.5,3.3,1.7],color:rgb('#79cfd2'),intensity:3.35,range:9.5},
        {id:'v13HallWarm',pos:[6.2,2.85,-3.9],color:rgb('#d39b61'),intensity:3.1,range:8.0},
        {id:'v13Ballistics',pos:[5.0,2.65,-14.1],color:rgb('#99cfd2'),intensity:3.5,range:7.8}
      ];this.lights=this.lightRig.slice(0,4);
    }
    update(dt){
      const s=this.ctx.director?.scene?.state||'IDLE',danger=s==='FAILURE'||s==='BREACH'||s==='SYSTEMIC_COMBAT';
      this.alert+=((danger?1:0)-this.alert)*Math.min(1,dt*4);this.incidentPulse=Math.max(0,this.incidentPulse-dt*1.7);
      const p=this.ctx.player.state.pos,t=performance.now()*.001;
      for(const l of this.lightRig){
        if(l.id==='maint'){l.color=danger?rgb('#ff5944'):rgb('#e0a35f');l.intensity=danger?4.9:3.3;}
        if(l.id==='portalA')l.intensity=3.45+.28*Math.sin(t*3.6);
        if(l.id==='portalB')l.intensity=3.25+.28*Math.sin(t*3.6+1.6);
        if(l.id==='arrivalWarm')l.intensity=1.8+.12*Math.sin(t*.9);
        if(l.id==='a17Threshold'){const door=this.ctx.level?.reDoor,open=!!door&&door.pos[1]>(door.closedY+.72);l.color=open?rgb('#75d8c8'):rgb('#d39a59');l.intensity=open?3.35:3.05;}
      }
      const a17Door=this.ctx.level?.reDoor,a17Open=!!a17Door&&a17Door.pos[1]>(a17Door.closedY+.72),a17Color=a17Open?rgb('#75d8c8'):rgb('#d39a59');for(const id of ['A17_THRESHOLD_TOP','A17_THRESHOLD_L','A17_THRESHOLD_R']){const o=this.ctx.world?.byName?.(id);if(o){o.color=a17Color;o.emissive=a17Open?1:.78;}}
      const impact=this.ctx.materialImpact?.lastImpact,impactAge=impact?performance.now()-impact.time:9999,activeBallistic=impactAge<520&&/^BALLISTIC_(GLASS|METAL|CONCRETE)_PANEL$/.test(impact.object||''),hitIndex=activeBallistic?(impact.object.includes('GLASS')?0:impact.object.includes('METAL')?1:2):-1,hitPulse=activeBallistic?Math.max(0,1-impactAge/520):0;for(let i=0;i<3;i++){const accent=this.ctx.world?.byName?.(`BALLISTIC_ACCENT_${i}`),floor=this.ctx.world?.byName?.(`BALLISTIC_FLOOR_MARK_${i}`),boost=i===hitIndex?hitPulse:0;if(accent)accent.emissive=.72+boost*.72;if(floor)floor.emissive=.35+boost*.48;}
      const candidates=[...this.lightRig];
      const card=this.ctx.level?.reCredential;if(this.ctx.v13&&card?.visible&&!this.ctx.re?.inventory?.credential){candidates.push({id:'keycardDrop',pos:[card.pos[0],card.pos[1]+.28,card.pos[2]],color:rgb('#66dcff'),intensity:2.15+.18*Math.sin(t*5.2),range:4.0});}
      const shot=this.ctx.weapons?.shotEnvelope||0,muzzle=Math.max(this.ctx.weapons?.muzzle||0,shot*.78);
      if(muzzle>.015&&this.ctx.player?.state?.weapon==='SERVICE_PISTOL'&&this.ctx.world?.realm==='day'){
        const cam=this.ctx.player.camera(),forward=this.ctx.player.cameraForward(),right=this.ctx.player.cameraRight();
        candidates.push({id:'muzzleFlash',pos:V3.add(cam,V3.add(V3.mul(forward,.72),V3.mul(right,.18))),color:rgb('#ffb45f'),intensity:7.4*muzzle,range:7.2});
      }
      const bot=this.ctx.ai?.bot,bv=bot?.visual,botFire=bv?.fire||0;if(bot&&!bot.defeated&&bot.respawn<=0&&botFire>.015&&this.ctx.world?.realm==='day'){
        const yaw=bv.yaw||0,c=Math.cos(yaw),sn=Math.sin(yaw),x=.27,z=-.94;
        candidates.push({id:'qbotMuzzle',pos:[bot.pos[0]+x*c+z*sn,bot.pos[1]+1.12,bot.pos[2]-x*sn+z*c],color:rgb('#ff664b'),intensity:5.6*botFire,range:5.4});
      }
      for(const f of this.ctx.fx?.impactLights||[]){const life=Math.max(0,Math.min(1,f.life/Math.max(.001,f.max||f.life)));candidates.push({id:'impactFlash',pos:f.pos,color:f.color,intensity:f.intensity*life,range:f.range});}
      this.lights=candidates.sort((a,b)=>V3.len(V3.sub(a.pos,p))-V3.len(V3.sub(b.pos,p))).slice(0,4);
      const inSpatial=p[2]<-18,inV13Hall=p[0]>-4.8&&p[0]<12.1&&p[2]>-7.1&&p[2]<6.8,twilight=this.ctx.debug?.f3;
      if(twilight){this.fogColor=rgb('#08171b');this.fogNear=12;this.fogFar=44;this.exposure=1.32;this.ambient=.175;}
      else if(inSpatial){this.fogColor=rgb('#0e1d26');this.fogNear=15;this.fogFar=50;this.exposure=1.60;this.ambient=.265;}
      else if(inV13Hall){this.fogColor=rgb('#13282e');this.fogNear=18;this.fogFar=62;this.exposure=1.74+(danger?.05:0);this.ambient=.315;}
      else{this.fogColor=rgb('#11252b');this.fogNear=18;this.fogFar=60;this.exposure=1.64+(danger?.06:0);this.ambient=.275;}
    }
    pulse(){this.incidentPulse=1;}
  }
  QQ.VisualSystem=VisualSystem;
})();
