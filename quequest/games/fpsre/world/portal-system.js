(() => {
  'use strict';
  const QQ=window.QQ,{V3}=QQ.Math3D;
  class PortalSystem{
    constructor(ctx){
      this.ctx=ctx;this.cooldown=0;this.transits=0;this.discovered=false;this.stackObserved=false;
      this.portals=(ctx.level.portals||[ctx.level.portalA,ctx.level.portalB]).filter(Boolean);this.lastSide=new Map();
    }
    rotateXZ(v,a){const c=Math.cos(a),s=Math.sin(a);return [v[0]*c-v[2]*s,v[1],v[0]*s+v[2]*c];}
    insidePortal(p,pos){const rel=V3.sub(pos,p.pos),n=p.portal.normal,plane=Math.abs(V3.dot(rel,n)),vertical=Math.abs(rel[1]);const lateral=Math.abs(Math.abs(n[2])>.5?rel[0]:rel[2]);return plane<.5&&vertical<p.portal.half[1]&&lateral<p.portal.half[0];}
    pairOf(p){return this.portals.find(q=>q.portal.id===p.portal.pair);}
    update(dt){
      if(this.ctx.world.realm!=='day')return;this.cooldown=Math.max(0,this.cooldown-dt);
      const player=this.ctx.player.state,cam=this.ctx.player.camera();
      for(const p of this.portals){
        const rel=V3.sub(cam,p.pos),side=V3.dot(rel,p.portal.normal),prev=this.lastSide.get(p.portal.id)??side;this.lastSide.set(p.portal.id,side);
        if(!this.discovered&&V3.len(rel)<5){this.discovered=true;this.ctx.emit('PORTAL_DISCOVERED',{portal:p.portal.id});this.ctx.ui.objective('ЛАБОРАТОРИЯ ПРОСТРАНСТВА','Проёмы связаны. Скорость и направление сохраняются при переходе.');}
        if(this.cooldown>0||!this.insidePortal(p,cam))continue;
        const toward=V3.dot(player.vel,p.portal.normal)<-.08||V3.dot(this.ctx.player.cameraForward(),p.portal.normal)<-.2;
        const crossed=prev>.02&&side<=.02;if(toward||crossed){this.transit(p);break;}
      }
    }

    transformEntity(entity,src,{kind='ENTITY',offset=.82}={}){const dst=this.pairOf(src);if(!dst)return false;const rightSrc=this.rightOf(src),rightDst=this.rightOf(dst),rel=V3.sub(entity.pos,src.pos),lx=V3.dot(rel,rightSrc),ly=rel[1],delta=dst.portal.yaw-src.portal.yaw,out=dst.portal.normal,before=[...(entity.vel||[0,0,0])],after=this.rotateXZ(before,delta);entity.pos=[dst.pos[0]+rightDst[0]*lx+out[0]*offset,dst.pos[1]+ly,dst.pos[2]+rightDst[2]*lx+out[2]*offset];entity.vel=after;if(Number.isFinite(entity.yaw))entity.yaw+=delta;this.ctx.emit('TOPOLOGY_ENTITY_TRANSIT',{kind,from:src.portal.id,to:dst.portal.id,velocityBefore:before.map(v=>+v.toFixed(2)),velocityAfter:after.map(v=>+v.toFixed(2)),position:entity.pos.map(v=>+v.toFixed(2))});return {dst,delta,before,after};}
    transit(src){
      const dst=this.pairOf(src);if(!dst)return;const p=this.ctx.player.state;
      const result=this.transformEntity(p,src,{kind:'PLAYER',offset:1.0});if(!result)return;const beforeVel=result.before,newVel=result.after,delta=result.delta;this.cooldown=.5;this.transits++;
      this.ctx.fx.pulse(src.pos,src.color||[.3,.9,1],.35);this.ctx.fx.pulse(dst.pos,dst.color||[.7,.4,1],.35);
      this.ctx.audio?.tone?.(240,.08,.035,'sine');setTimeout(()=>this.ctx.audio?.tone?.(520,.10,.025,'triangle'),45);
      this.ctx.emit('PORTAL_TRANSIT',{from:src.portal.id,to:dst.portal.id,deltaYaw:+delta.toFixed(3),velocityBefore:beforeVel.map(v=>+v.toFixed(2)),velocityAfter:newVel.map(v=>+v.toFixed(2)),transits:this.transits});if(['C','D'].includes(src.portal.id)){this.stackObserved=true;this.ctx.emit('ROOM_OVER_ROOM_OBSERVED',{from:src.portal.id,to:dst.portal.id,verticalDelta:+(dst.pos[1]-src.pos[1]).toFixed(2),sameXZ:Math.hypot(dst.pos[0]-src.pos[0],dst.pos[2]-src.pos[2])<.2});this.ctx.ui.objective('КОМНАТА НАД КОМНАТОЙ','Одни координаты плана, но другое помещение. Их разделяет связь пространства.');}this.ctx.ui.msg(`PORTAL ${src.portal.id} → ${dst.portal.id}`);
    }

    rightOf(p){const n=p.portal.normal;return [n[2],0,-n[0]];}
    rayPortalHit(ro,rd,maxD){
      let best=null;
      for(const p of this.portals){const n=p.portal.normal,den=V3.dot(rd,n);if(den>=-.0005)continue;const t=V3.dot(V3.sub(p.pos,ro),n)/den;if(t<=.02||t>maxD)continue;const hp=V3.add(ro,V3.mul(rd,t)),rel=V3.sub(hp,p.pos),right=this.rightOf(p),lx=V3.dot(rel,right),ly=rel[1];if(Math.abs(lx)<=p.portal.half[0]&&Math.abs(ly)<=p.portal.half[1]&&(!best||t<best.t))best={portal:p,t,p:hp,lx,ly};}
      return best;
    }

    transformSegment(ro,to,vel,kind='PROJECTILE'){
      const deltaPos=V3.sub(to,ro),dist=V3.len(deltaPos);if(dist<1e-5)return null;const rd=V3.mul(deltaPos,1/dist),ph=this.rayPortalHit(ro,rd,dist);if(!ph)return null;
      const src=ph.portal,dst=this.pairOf(src),delta=dst.portal.yaw-src.portal.yaw,right=this.rightOf(dst),out=dst.portal.normal,newVel=this.rotateXZ(vel,delta);
      const exit=[dst.pos[0]+right[0]*ph.lx+out[0]*.12,dst.pos[1]+ph.ly,dst.pos[2]+right[2]*ph.lx+out[2]*.12],dir=V3.norm(newVel),pos=V3.add(exit,V3.mul(dir,.08));
      this.ctx.emit('PORTAL_PROJECTILE_TRANSFORM',{kind,from:src.portal.id,to:dst.portal.id,velocityBefore:vel.map(v=>+v.toFixed(2)),velocityAfter:newVel.map(v=>+v.toFixed(2))});
      this.ctx.fx.pulse(ph.p,src.color||[.3,.9,1],.18);this.ctx.fx.pulse(exit,dst.color||[.7,.4,1],.18);
      return {pos,vel:newVel,from:src.portal.id,to:dst.portal.id};
    }
    traceRay(ro,rd,maxD,opt={}){
      const first=this.ctx.world.raycast(ro,rd,maxD,opt),ph=this.rayPortalHit(ro,rd,maxD);
      if(!ph||first.t<=ph.t)return {...first,segments:[[ro,first.p]],throughPortal:false};
      const src=ph.portal,dst=this.pairOf(src),delta=dst.portal.yaw-src.portal.yaw,right=this.rightOf(dst),out=dst.portal.normal;
      const exit=[dst.pos[0]+right[0]*ph.lx+out[0]*.08,dst.pos[1]+ph.ly,dst.pos[2]+right[2]*ph.lx+out[2]*.08],rd2=V3.norm(this.rotateXZ(rd,delta)),remaining=Math.max(.01,maxD-ph.t-.08),second=this.ctx.world.raycast(exit,rd2,remaining,opt);
      const end=second.p,total=ph.t+second.t;this.ctx.emit('PORTAL_RAY_TRANSFORM',{from:src.portal.id,to:dst.portal.id,entry:ph.p.map(v=>+v.toFixed(2)),exit:exit.map(v=>+v.toFixed(2)),deltaYaw:+delta.toFixed(3)});
      return {...second,t:total,segments:[[ro,ph.p],[exit,end]],throughPortal:true,portalFrom:src.portal.id,portalTo:dst.portal.id,exitOrigin:exit,exitDirection:rd2};
    }
    debugText(){const links=this.portals.filter(p=>p.portal.id<p.portal.pair).map(p=>`${p.portal.id} ↔ ${p.portal.pair}`).join(' · ');return `PORTAL LINKS\n${links}\ntransits = ${this.transits}\ntransform = position + orientation + velocity\nportal view depth = 2\nclip plane = DESTINATION\ncollision surface = OFF\ntopology edge = ON`;}
  }
  QQ.PortalSystem=PortalSystem;
})();
