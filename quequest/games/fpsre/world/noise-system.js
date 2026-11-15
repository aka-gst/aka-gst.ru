(() => {
  'use strict';
  const QQ=window.QQ;
  class NoiseSystem{
    constructor(ctx){this.ctx=ctx;this.history=[];this.seq=0;}
    emit(pos,radius=8,type='GENERIC',extra={}){const e={id:++this.seq,pos:[...pos],radius,type,at:performance.now(),...extra};this.history.push(e);if(this.history.length>128)this.history.splice(0,32);this.ctx.emit('NOISE_EVENT',{id:e.id,pos:e.pos,radius:e.radius,noiseType:type,...extra});this.ctx.events.emit('noise:emitted',e);return e;}
    recent(maxAgeMs=3000){const now=performance.now();return this.history.filter(e=>now-e.at<=maxAgeMs);}
    audibility(pos,e){const direct=Math.hypot(pos[0]-e.pos[0],pos[1]-e.pos[1],pos[2]-e.pos[2]),best=this.ctx.topology?this.ctx.topology.shortestDistance(e.pos,pos,{knownOnly:false}):direct,via=best+0.05<direct?'TOPOLOGY_GRAPH':null;const gain=Math.max(0,1-best/Math.max(.001,e.radius));return{audible:best<=e.radius,distance:best,gain,via};}
    loudestNear(pos,maxAgeMs=2500){const now=performance.now();let best=null,score=-Infinity;for(const e of this.history){const age=now-e.at;if(age>maxAgeMs)continue;const d=Math.hypot(pos[0]-e.pos[0],pos[1]-e.pos[1],pos[2]-e.pos[2]);if(d>e.radius)continue;const s=(1-d/e.radius)*(1-age/maxAgeMs);if(s>score){score=s;best=e;}}return best;}
  }
  QQ.NoiseSystem=NoiseSystem;
})();
