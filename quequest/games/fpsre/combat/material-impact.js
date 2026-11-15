(() => {
  'use strict';
  const QQ=window.QQ,{V3}=QQ.Math3D;
  const PROFILES={
    concrete:{label:'БЕТОН',color:'#a9b2ad',decal:[.08,.075,.065],particles:15,speed:3.2,tone:150,noise:.032,loss:1,mode:'STOP'},
    metal:{label:'МЕТАЛЛ',color:'#ffd28b',decal:[.055,.075,.08],particles:12,speed:6.5,tone:920,noise:.012,loss:.62,mode:'DEFLECT'},
    glass:{label:'СТЕКЛО',color:'#8eeeff',decal:[.12,.23,.25],particles:22,speed:4.4,tone:1450,noise:.02,loss:.42,mode:'PASS'},
    wood:{label:'ДЕРЕВО',color:'#c8965b',decal:[.11,.075,.04],particles:16,speed:3.4,tone:230,noise:.026,loss:.88,mode:'STOP'},
    rubber:{label:'РЕЗИНА',color:'#657477',decal:[.035,.04,.04],particles:7,speed:1.8,tone:95,noise:.012,loss:1,mode:'STOP'},
    screen:{label:'ЭКРАН',color:'#84ebff',decal:[.09,.2,.22],particles:18,speed:4.0,tone:1180,noise:.016,loss:.52,mode:'PASS'},
    paintedMetal:{label:'КРАШЕНЫЙ МЕТАЛЛ',color:'#ffd28b',decal:[.05,.065,.07],particles:12,speed:5.8,tone:840,noise:.014,loss:.68,mode:'DEFLECT'},
    hazard:{label:'МЕТАЛЛ',color:'#ffd28b',decal:[.07,.065,.04],particles:13,speed:5.6,tone:820,noise:.014,loss:.68,mode:'DEFLECT'},
    energy:{label:'ЭНЕРГИЯ',color:'#ba8cff',decal:[.12,.06,.18],particles:18,speed:5.0,tone:680,noise:.008,loss:1,mode:'STOP'}
  };
  class MaterialImpactSystem{
    constructor(ctx){this.ctx=ctx;this.lastImpact=null;}
    profile(material){return PROFILES[material]||PROFILES.concrete;}
    feedback(material,hit,energy,outcome){const p=this.profile(material),col=QQ.Math3D.rgb(p.color),e=Math.max(.2,Math.min(1.2,energy)),metal=['metal','paintedMetal','hazard'].includes(material),glass=material==='glass'||material==='screen',wood=material==='wood';this.ctx.fx.impactBurst?.(hit.p,hit.n,col,Math.max(4,Math.round(p.particles*e)),p.speed*(.65+.35*e),.42+.22*e,{size:metal?6.5:glass?7.5:10.5,gravity:metal?8:glass?5.5:6.2,drag:glass?.65:1.15});if(metal)this.ctx.fx.sparkStreaks?.(hit.p,hit.n,[1,.72,.28,.88],Math.max(3,Math.round(4*e)),6.5+2.2*e,.10+.035*e);const aspect=metal?[1.0,.46]:glass?[.72,.72]:wood?[1.18,.58]:[1.0,.82],alpha=glass?.42:metal?.76:.68;this.ctx.fx.decal(hit.p,hit.n,p.decal,.10+.08*e,36,{aspect,alpha,kind:material});this.ctx.fx.impactDebris?.(hit.p,hit.n,material,e);if(material==='concrete')this.ctx.fx.decal(hit.p,hit.n,[.15,.145,.13],.16+.055*e,18,{aspect:[1.28,.46],alpha:.20,kind:'spall'});if(glass)this.ctx.fx.decal(hit.p,hit.n,[.22,.56,.60],.15+.045*e,14,{aspect:[.26,1.42],alpha:.22,kind:'glass-crack'});if(metal&&outcome==='DEFLECT')this.ctx.fx.decal(hit.p,hit.n,[.34,.16,.035],.055+.025*e,.42,{aspect:[1.35,.32],alpha:.82,emissive:.18,kind:'hot-scratch'});if(material==='concrete'||wood)this.ctx.fx.smokePuff?.(V3.add(hit.p,V3.mul(hit.n,.025)),hit.n,3);if(metal)this.ctx.fx.impactLight?.(V3.add(hit.p,V3.mul(hit.n,.06)),[1,.48,.14],3.0+2.2*e,4.1,.085);if(glass)this.ctx.fx.impactLight?.(V3.add(hit.p,V3.mul(hit.n,.05)),[.35,.82,1],1.8+1.2*e,3.4,.07);if(glass)this.ctx.fx.pulse(hit.p,col,.22);if(outcome==='DEFLECT')this.ctx.fx.pulse(hit.p,QQ.Math3D.rgb('#ffc76a'),.14);if(this.ctx.audio.surfaceImpact)this.ctx.audio.surfaceImpact(material,e,outcome);else{this.ctx.audio.tone(p.tone,.025+.018*e,.012+.01*e,metal?'triangle':'sine');this.ctx.audio.noise(.018+.02*e,p.noise);}}
    resolve(bullet,hit){const material=hit.o?.material||'concrete',p=this.profile(material),dir=V3.norm(bullet.vel),headOn=Math.max(0,Math.min(1,-V3.dot(dir,hit.n))),before=bullet.energy;let outcome='STOP',after=0,nextVel=null,nextPos=null,ignoreObjectId=null;
      if(hit.o?.destructible)this.ctx.damage.object(hit.o,Math.max(4,QQ.Config.weapons.SERVICE_PISTOL.objectDamage*before),hit.p,'BALLISTIC');
      if((material==='glass'||material==='screen')&&before>.28&&bullet.passCount<1){outcome='PASS';after=before*(1-p.loss);bullet.passCount++;nextVel=V3.mul(bullet.vel,.78);nextPos=V3.add(hit.p,V3.mul(dir,.16));ignoreObjectId=hit.o?.id??null;}
      else if(['metal','paintedMetal','hazard'].includes(material)&&headOn<.34&&before>.44&&bullet.bounces<1){outcome='DEFLECT';after=before*(1-p.loss);bullet.bounces++;const dot=V3.dot(dir,hit.n),ref=V3.norm(V3.sub(dir,V3.mul(hit.n,2*dot))),speed=V3.len(bullet.vel)*.56;nextVel=V3.mul(ref,speed);nextPos=V3.add(hit.p,V3.mul(ref,.08));}
      this.feedback(material,hit,before,outcome);this.lastImpact={time:performance.now(),material,label:p.label,pos:[...hit.p],normal:[...hit.n],outcome,energyBefore:before,energyAfter:after,headOn,object:hit.o?.name||null};this.ctx.emit('BALLISTIC_IMPACT',{weapon:'SERVICE_PISTOL',material,label:p.label,outcome,energyBefore:+before.toFixed(3),energyAfter:+after.toFixed(3),angleFactor:+headOn.toFixed(3),object:hit.o?.name||null,position:hit.p.map(v=>+v.toFixed(2))});return{stop:outcome==='STOP',outcome,energy:after,vel:nextVel,pos:nextPos,ignoreObjectId};}
    debugText(){const x=this.lastImpact;if(!x)return'ПОПАДАНИЙ ПОКА НЕТ';return `${x.label}\nрезультат: ${x.outcome}\nэнергия: ${Math.round(x.energyBefore*100)}% → ${Math.round(x.energyAfter*100)}%`;}
  }
  QQ.MaterialImpactProfiles=PROFILES;
  QQ.MaterialImpactSystem=MaterialImpactSystem;
})();
