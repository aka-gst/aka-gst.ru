(() => {
  'use strict';
  const QQ=window.QQ,$=QQ.util.$,{V3}=QQ.Math3D;
  class ScreenFXSystem{
    constructor(ctx){this.ctx=ctx;this.bloom=$('screenBloom');this.grain=$('filmGrain');this.edge=$('portalEdge');}
    update(){
      const c=this.ctx,v=c.visual,p=c.player.camera();
      let portalNear=0;for(const po of [c.level.portalA,c.level.portalB])if(po){const d=V3.len(V3.sub(p,po.pos));portalNear=Math.max(portalNear,Math.max(0,1-d/5));}
      const dream=c.world.realm==='dream'?1:0,alert=v?.alert||0,damage=c.player.damageFlash||0,twilight=c.debug?.f3?1:0,muzzle=Math.max(c.weapons?.muzzle||0,(c.weapons?.shotEnvelope||0)*.72);
      if(this.bloom)this.bloom.style.opacity=String(Math.min(.58,.055+alert*.12+portalNear*.18+dream*.09+twilight*.055+muzzle*.22));
      if(this.edge)this.edge.style.opacity=String(Math.min(.55,portalNear*.42+dream*.16+twilight*.08));
      if(this.grain)this.grain.style.opacity=String(.035+alert*.03+dream*.025+twilight*.018);
      const canvas=$('gl');if(canvas){const contrast=1.06+alert*.03+twilight*.04,sat=twilight?.46:(.94+portalNear*.12+muzzle*.05),bright=1.07-damage*.06-twilight*.13+muzzle*.025,hue=twilight?-7:0;canvas.style.filter=`contrast(${contrast.toFixed(3)}) saturate(${sat.toFixed(3)}) brightness(${bright.toFixed(3)}) hue-rotate(${hue}deg)`;}
      const weapon=$('weapon');if(weapon)weapon.style.filter=twilight?'saturate(.62) brightness(.78) contrast(1.05)':'none';
    }
  }
  QQ.ScreenFXSystem=ScreenFXSystem;
})();
