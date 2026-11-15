(() => {
  'use strict';
  const QQ=window.QQ,{V3}=QQ.Math3D;
  class WorldSystem{
    constructor(ctx){this.ctx=ctx;this.realm='day';this.nextId=1;this.objects=[];this.dynamic={bot:null,marker:null,projectiles:[]};}
    box(name,pos,size,material='concrete',opt={}){const o={id:this.nextId++,name,pos:[...pos],size:[...size],material,realm:opt.realm??'day',solid:opt.solid!==false,walkable:!!opt.walkable,destructible:!!opt.destructible,integrity:opt.integrity??100,maxIntegrity:opt.integrity??100,state:'intact',emissive:opt.emissive??0,grid:opt.grid??0,color:opt.color?QQ.Math3D.rgb(opt.color):null,alpha:opt.alpha??1,visible:opt.visible!==false,dreamBlock:!!opt.dreamBlock,checkpoint:opt.checkpoint??0,impossible:!!opt.impossible,ry:opt.ry??0,crumble:0,tags:new Set(opt.tags||[]),meta:{...(opt.meta||{})}};this.objects.push(o);return o;}
    active(o){return o.realm===this.realm||o.realm==='both';}
    top(o){return o.pos[1]+o.size[1]/2;}
    bottom(o){return o.pos[1]-o.size[1]/2;}
    localXZ(o,x,z){const dx=x-o.pos[0],dz=z-o.pos[2],a=o.ry||0,c=Math.cos(a),s=Math.sin(a);return[dx*c-dz*s,dx*s+dz*c];}
    withinXZ(o,x,z,pad=0){const q=this.localXZ(o,x,z);return Math.abs(q[0])<o.size[0]/2+pad&&Math.abs(q[1])<o.size[2]/2+pad;}
    floorAt(x,z,feetY){let f=this.realm==='dream'?-999:0;for(const o of this.objects){if(!this.active(o)||!o.walkable||!o.solid)continue;const t=this.top(o);if(this.withinXZ(o,x,z,.18)&&t<=feetY+.55&&t>f)f=t;}return f;}
    collidesXZ(x,z,feetY,ignore=null){const r=.34;for(const o of this.objects){if(o===ignore||!this.active(o)||!o.solid)continue;if(o.walkable&&this.top(o)<=feetY+.45)continue;if(this.top(o)<feetY+.15||this.bottom(o)>feetY+1.65)continue;const q=this.localXZ(o,x,z);if(Math.abs(q[0])<o.size[0]/2+r&&Math.abs(q[1])<o.size[2]/2+r)return o;}return null;}
    ceilingAt(x,z,feetY,nextFeetY,height=1.72){if(nextFeetY<=feetY)return null;const head0=feetY+height,head1=nextFeetY+height;let best=null,bestY=Infinity;for(const o of this.objects){if(!this.active(o)||!o.solid||!this.withinXZ(o,x,z,.28))continue;const b=this.bottom(o);if(b>=head0-.02&&b<=head1+.02&&b<bestY){best=o;bestY=b;}}return best?{object:best,feetY:bestY-height-.01}:null;}
    rayAABB(ro,rd,o,maxD=100){if(!o.solid)return null;const a=o.ry||0,c=Math.cos(a),s=Math.sin(a),dx=ro[0]-o.pos[0],dz=ro[2]-o.pos[2];const lro=[dx*c-dz*s,ro[1]-o.pos[1],dx*s+dz*c],lrd=[rd[0]*c-rd[2]*s,rd[1],rd[0]*s+rd[2]*c],mn=[-o.size[0]/2,-o.size[1]/2,-o.size[2]/2],mx=[o.size[0]/2,o.size[1]/2,o.size[2]/2];let tmin=0,tmax=maxD,axis=0,sign=0;for(let i=0;i<3;i++){if(Math.abs(lrd[i])<1e-6){if(lro[i]<mn[i]||lro[i]>mx[i])return null;continue}let t1=(mn[i]-lro[i])/lrd[i],t2=(mx[i]-lro[i])/lrd[i],sg=-1;if(t1>t2){[t1,t2]=[t2,t1];sg=1}if(t1>tmin){tmin=t1;axis=i;sign=sg}tmax=Math.min(tmax,t2);if(tmin>tmax)return null;}const p=V3.add(ro,V3.mul(rd,tmin)),ln=[0,0,0];ln[axis]=sign;let n;if(axis===1)n=ln;else n=[c*ln[0]+s*ln[2],0,-s*ln[0]+c*ln[2]];return{t:tmin,p,n,o};}
    raySphere(ro,rd,c,r,maxD=100){const oc=V3.sub(ro,c),b=V3.dot(oc,rd),cc=V3.dot(oc,oc)-r*r,h=b*b-cc;if(h<0)return null;const t=-b-Math.sqrt(h);if(t<0||t>maxD)return null;return{t,p:V3.add(ro,V3.mul(rd,t)),n:V3.norm(V3.sub(V3.add(ro,V3.mul(rd,t)),c))};}
    raycast(ro,rd,maxD=100,opt={}){let best={t:maxD,p:V3.add(ro,V3.mul(rd,maxD)),type:'world'};for(const o of this.objects){if(!this.active(o)||o.id===opt.ignoreObjectId)continue;const h=this.rayAABB(ro,rd,o,maxD);if(h&&h.t<best.t)best={...h,type:'object'};}
      const ctx=this.ctx, includeBot=opt.includeBot!==false;
      if(this.realm==='day'&&includeBot&&ctx.ai?.bot&&!ctx.ai.bot.defeated&&ctx.ai.bot.respawn<=0){const b=ctx.ai.bot,c=[b.pos[0],b.pos[1]+1,b.pos[2]],h=this.raySphere(ro,rd,c,.55,maxD);if(h&&h.t<best.t)best={...h,type:'bot'};}
      const marker=ctx.weapons?.marker;if(marker){const h=this.raySphere(ro,rd,marker.pos,.22,maxD);if(h&&h.t<best.t)best={...h,type:'marker'};}
      for(const p of ctx.weapons?.projectiles||[]){if(p.kind==='shock'&&p.alive){const h=this.raySphere(ro,rd,p.pos,.28,maxD);if(h&&h.t<best.t)best={...h,type:'shock',proj:p};}}
      return best;
    }
    byName(name){return this.objects.find(o=>o.name===name);}
  }
  QQ.WorldSystem=WorldSystem;
})();
