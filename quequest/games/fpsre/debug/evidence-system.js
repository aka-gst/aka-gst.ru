(() => {
  'use strict';
  const QQ=window.QQ;
  class EvidenceSystem{
    constructor(ctx){
      this.ctx=ctx;this.entries=[];this.seq=0;
      ctx.events.on('game:event',e=>this.ingest(e));
      this.add('UNKNOWN','WHO WRITES THE WORLD?','No host boundary observed yet.',.0,'BOOT');
    }
    add(status,title,detail='',confidence=1,source='RUNTIME',meta={}){
      const e={id:++this.seq,status,title,detail,confidence,source,at:performance.now(),meta};
      this.entries.push(e);if(this.entries.length>160)this.entries.splice(0,32);return e;
    }
    ingest(e){
      switch(e.type){
        case 'RE_INSPECT': this.add('EVIDENCE','A17 state captured',`locked=${e.state?.locked} · writer=${e.state?.writer||'?'}`,1,'STATE SNAPSHOT',{entity:e.entity});break;
        case 'RE_PATCH': this.add('EVIDENCE','State mutation changed world',`${e.field}: ${e.before} → ${e.after}`,.99,'PATCH',{entity:e.entity});break;
        case 'RE_SOLVED': this.add('EVIDENCE','Door cause resolved',`solution=${e.solution}`,1,'WORLD RESPONSE',{entity:e.entity});break;
        case 'PORTAL_TRANSIT': this.add('EVIDENCE','Topology preserves motion',`${e.from} → ${e.to} · velocity transformed`,1,'PLAYER TRANSIT');break;
        case 'ROOM_OVER_ROOM_OBSERVED': this.add('EVIDENCE','Two rooms share world footprint',`vertical Δ=${e.verticalDelta}m · same XZ=${e.sameXZ}`,1,'PLAYER TRANSIT');break;
        case 'PORTAL_RAY_TRANSFORM': this.add('EVIDENCE','Ray crossed topology edge',`${e.from} → ${e.to}`,.98,'HITSCAN TRACE');break;
        case 'PORTAL_PROJECTILE_TRANSFORM': this.add('EVIDENCE','Entity crossed topology edge',`${e.kind} · ${e.from} → ${e.to}`,.98,'PROJECTILE TRACE');break;
        case 'GEOMETRY_LOOP': this.add('EVIDENCE','Distance is not Euclidean',`loop #${e.loop} returned to earlier world-space`,1,'PLAYER PATH');break;
        case 'PROJECTION_GEOMETRY_COMMIT': this.add('EVIDENCE','Representation became collision',`${e.representation} · collision=${e.collision}`,1,'GEOMETRY COMMIT');break;
        case 'PROJECTION_ROOM_COMMIT': this.add('EVIDENCE','Representation became a location',`${e.representation} · world boundary replaced`,1,'GEOMETRY COMMIT');break;
        case 'AI_SEE_PLAYER': this.add('EVIDENCE','Agent perception updated',`player visible at ${JSON.stringify(e.pos)}`,.95,'AI SENSOR');break;
        case 'AI_DECISION': this.add('INFERENCE','Agent selected a goal',`${e.state||e.goal||'decision'} · utility=${e.utility??'?'}`,.72,'AI MODEL');break;
        case 'RENDER_LENS_UNLOCKED': this.add('EVIDENCE','Открыт анализ кадра','Диагностический терминал откалиброван',1,'RENDER CONSOLE');break;
        case 'RENDER_MATERIAL_PATCH': this.add('EVIDENCE','Материал изменил вид мира',`${e.entity}: ${e.before} → ${e.after}`,1,'RENDER LENS',{entity:e.entity});break;
        case 'GEOMETRY_ANOMALY': this.add('INFERENCE','Renderer and collision disagree',`${e.entity||'geometry anomaly'}`,.8,'CROSS-SYSTEM');break;
      }
    }
    recent(limit=6,status=null){const a=status?this.entries.filter(e=>e.status===status):this.entries;return a.slice(-limit).reverse();}
    unresolved(limit=4){return this.entries.filter(e=>e.status==='UNKNOWN').slice(-limit).reverse();}
    debugText(limit=6){return this.recent(limit).map(e=>`${e.status.padEnd(9)} ${Math.round(e.confidence*100).toString().padStart(3)}%  ${e.title}\n${e.detail}`).join('\n\n');}
  }
  QQ.EvidenceSystem=EvidenceSystem;
})();
