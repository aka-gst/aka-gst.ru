(() => {
  'use strict';
  const QQ=window.QQ,{V3}=QQ.Math3D;
  class PerceptionSystem{
    constructor(ctx){this.ctx=ctx;this.memory=new QQ.AIMemory();this.hearingQueue=[];this.visible=false;ctx.events.on('noise:emitted',e=>this.hearingQueue.push(e));}
    canSee(observerPos,targetPos,max=QQ.Config.ai.visionRange){const d=V3.len(V3.sub(targetPos,observerPos));if(d>max)return false;const rd=V3.norm(V3.sub(targetPos,observerPos)),h=this.ctx.world.raycast(observerPos,rd,d,{includeBot:false});return h.type==='world'||h.t>=d-.2;}
    update(observerPos,targetPos){const now=performance.now(),canSee=this.canSee(observerPos,targetPos);if(canSee){this.memory.seePlayer(targetPos,now);if(!this.visible)this.ctx.emit('AI_ACQUIRE_PLAYER',{pos:targetPos.map(v=>+v.toFixed(2))});this.ctx.emit('AI_SEE_PLAYER',{pos:targetPos.map(v=>+v.toFixed(2))});}else{const confidence=this.memory.decay(now);if(this.visible)this.ctx.emit('AI_LOST_PLAYER',{lastSeen:this.memory.playerLastSeen?[...this.memory.playerLastSeen]:null,confidence:+confidence.toFixed(3),age:+((now-this.memory.playerLastSeenAt)/1000).toFixed(2)});}this.visible=canSee;
      let heard=null,score=-1;for(const e of this.hearingQueue){const age=now-e.at;if(age>2600)continue;const a=this.ctx.noise.audibility(observerPos,e),s=a.gain*(1-age/2600)*(e.salience||1);if(a.audible&&s>score){score=s;heard={e,a};}}
      if(heard){const {e,a}=heard;this.memory.hear(e.pos,e.at,{type:e.type,radius:e.radius,viaTopology:a.via,effectiveDistance:+a.distance.toFixed(2)});this.ctx.emit('AI_HEAR_NOISE',{noiseType:e.type,pos:e.pos.map(v=>+v.toFixed(2)),viaTopology:a.via||'DIRECT',effectiveDistance:+a.distance.toFixed(2),gain:+a.gain.toFixed(3)});}
      this.hearingQueue=this.hearingQueue.filter(e=>now-e.at<3000);return this.memory;
    }
  }
  QQ.PerceptionSystem=PerceptionSystem;
})();
