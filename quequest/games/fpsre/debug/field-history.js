(() => {
  'use strict';
  const QQ=window.QQ;
  class FieldHistorySystem{
    constructor(ctx){
      this.ctx=ctx;this.maxPerField=24;this.fields=new Map();this.seq=0;
      ctx.events.on('game:event',e=>this.ingest(e));
      this.seedExisting();
    }
    key(entity,field){return `${entity}.${field}`;}

    seedExisting(){
      const c=this.ctx;
      if(c.doors?.doors)for(const [name,d] of c.doors.doors){this.seed(name,'state',d.state,'BOOT_SNAPSHOT');this.seed(name,'target',d.target,'BOOT_SNAPSHOT');}
      const t=c.re?.target;if(t){for(const field of ['locked','powered','motor','credentialRequired','credentialPresented','securityRerouted'])this.seed(t.id,field,t[field],'BOOT_SNAPSHOT');}
    }
    record(entity,field,before,after,source='RUNTIME',meta={}){
      if(entity==null||field==null)return null;
      const key=this.key(entity,field),list=this.fields.get(key)||[];
      if((before===undefined||before===null)&&list.length)before=list[list.length-1].after;
      const entry={id:++this.seq,entity,field,before,after,source,t:+performance.now().toFixed(1),wall:new Date().toISOString(),meta};
      list.push(entry);if(list.length>this.maxPerField)list.splice(0,list.length-this.maxPerField);this.fields.set(key,list);
      this.ctx.emit('FIELD_HISTORY_RECORD',{entity,field,before,after,source,historyDepth:list.length});
      return entry;
    }
    ingest(e){
      switch(e.type){
        case 'RE_INSPECT':
          if(e.state)for(const [field,value] of Object.entries(e.state))this.seed(e.entity,field,value,'STATE_SNAPSHOT');
          break;
        case 'RE_PATCH': this.record(e.entity,e.field,e.before,e.after,e.source||'PATCH',{writer:e.writer,caller:e.caller});break;
        case 'RE_SOLVED': this.record(e.entity,'solution',null,e.solution,'WORLD_RESPONSE');break;
        case 'DOOR_COMMAND': this.record(e.door,'target',null,String(e.action||'').toLowerCase(),e.source||'DOOR_COMMAND');break;
        case 'DOOR_STATE': this.record(e.door,'state',null,e.state,'DOOR_SYSTEM');break;
        case 'DIRECTOR_STATE': this.record(e.sequence||'WORLD_DIRECTOR','state',null,e.state,'DIRECTOR');break;
        case 'PROJECTION_GEOMETRY_COMMIT': this.record(e.representation||'PROJECTION','collision','OFF',e.collision||'ON','GEOMETRY_COMMIT');break;
        case 'PROJECTION_ROOM_COMMIT': this.record(e.representation||'ROOM_02','collision','OFF',e.collision||'ON','GEOMETRY_COMMIT',{worldBoundaryOpened:!!e.worldBoundaryOpened});break;
        case 'ROOM_OVER_ROOM_OBSERVED': this.record('WORLD_TOPOLOGY','roomOverRoom','UNKNOWN','PROVEN','PLAYER_TRANSIT',{verticalDelta:e.verticalDelta,sameXZ:e.sameXZ});break;
      }
    }
    seed(entity,field,value,source='SNAPSHOT'){
      const key=this.key(entity,field);if(this.fields.has(key))return;this.fields.set(key,[{id:++this.seq,entity,field,before:undefined,after:value,source,t:+performance.now().toFixed(1),wall:new Date().toISOString(),meta:{seed:true}}]);
    }
    history(entity,field){return [...(this.fields.get(this.key(entity,field))||[])];}
    recentForEntity(entity,limit=5){
      const out=[];for(const list of this.fields.values())for(const e of list)if(e.entity===entity)out.push(e);
      return out.sort((a,b)=>b.id-a.id).slice(0,limit);
    }
    recent(limit=8){const out=[];for(const list of this.fields.values())out.push(...list);return out.sort((a,b)=>b.id-a.id).slice(0,limit);}
    compact(entity,limit=4){return this.recentForEntity(entity,limit).map(e=>`${e.field.toUpperCase()}  ${this.fmt(e.before)} → ${this.fmt(e.after)}\n  ${e.source}`).join('\n\n');}
    fmt(v){if(v===undefined)return '∅';if(v===null)return '—';if(typeof v==='object')return JSON.stringify(v);return String(v);}
  }
  QQ.FieldHistorySystem=FieldHistorySystem;
})();
