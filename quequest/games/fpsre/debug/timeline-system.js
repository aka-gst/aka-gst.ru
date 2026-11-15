(() => {
  'use strict';
  const QQ=window.QQ;
  class TimelineSystem{
    constructor(ctx){this.ctx=ctx;this.entity=null;this.field=null;this.cursor=-1;}
    select(entity,field,where='latest'){this.entity=entity;this.field=field;const a=this.entries();this.cursor=where==='latest'?Math.max(0,a.length-1):Math.max(0,Math.min(Number(where)||0,a.length-1));this.ctx.emit('TIMELINE_SELECT',{entity,field,cursor:this.cursor,count:a.length});return this.current();}
    selectActiveWatch(){const w=this.ctx.watch?.active?.();if(!w)return null;return this.select(w.entity,w.field,'latest');}
    entries(){return this.entity&&this.field?(this.ctx.fieldHistory?.history?.(this.entity,this.field)||[]):[];}
    scrub(delta){const a=this.entries();if(!a.length)return null;this.cursor=Math.max(0,Math.min(a.length-1,(this.cursor<0?a.length-1:this.cursor)+delta));const cur=this.current();this.ctx.emit('TIMELINE_SCRUB',{entity:this.entity,field:this.field,cursor:this.cursor,count:a.length,entryId:cur?.id});return cur;}
    current(){const a=this.entries();return a.length?a[Math.max(0,Math.min(this.cursor<0?a.length-1:this.cursor,a.length-1))]:null;}
    text(){const a=this.entries();if(!a.length)return 'NO FIELD TIMELINE\n\nF7 WATCH a field, then F4 opens its history.';const cur=this.current();const lines=a.map((e,i)=>`${i===this.cursor?'▶':' '} ${String(i+1).padStart(2,'0')}  ${this.ctx.fieldHistory.fmt(e.before)} → ${this.ctx.fieldHistory.fmt(e.after)}  ${e.source}`);return `${this.entity}.${this.field}\nENTRY ${this.cursor+1}/${a.length}\n\n${lines.join('\n')}\n\nSELECTED\n${cur?`${cur.wall}\n${this.ctx.fieldHistory.fmt(cur.before)} → ${this.ctx.fieldHistory.fmt(cur.after)}\nsource=${cur.source}`:'—'}\n\n← / → SCRUB`;
    }
  }
  QQ.TimelineSystem=TimelineSystem;
})();
