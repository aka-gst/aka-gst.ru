(() => {
  'use strict';
  const QQ=window.QQ;
  class WatchSystem{
    constructor(ctx){
      this.ctx=ctx;this.watches=new Map();this.activeKey=null;this.max=6;
      ctx.events.on('FIELD_HISTORY_RECORD',e=>this.onFieldChange(e));
    }
    key(entity,field){return `${entity}.${field}`;}
    watch(entity,field,label=null){
      if(!entity||!field)return null;
      const key=this.key(entity,field),history=this.ctx.fieldHistory?.history?.(entity,field)||[],last=history.at(-1);
      if(!this.watches.has(key)&&this.watches.size>=this.max){const oldest=[...this.watches.keys()][0];this.watches.delete(oldest);}
      const w={key,entity,field,label:label||`${entity}.${field}`,value:last?.after,hits:0,createdAt:performance.now()};
      this.watches.set(key,w);this.activeKey=key;
      this.ctx.emit('WATCH_ADD',{entity,field,label:w.label,value:w.value});
      this.ctx.ui.msg(`WATCH // ${field.toUpperCase()}`);
      return w;
    }
    unwatch(entity,field){const key=this.key(entity,field);if(!this.watches.has(key))return false;this.watches.delete(key);if(this.activeKey===key)this.activeKey=this.watches.size?[...this.watches.keys()].at(-1):null;this.ctx.emit('WATCH_REMOVE',{entity,field});return true;}
    toggle(entity,field,label=null){const key=this.key(entity,field);return this.watches.has(key)?(this.unwatch(entity,field),null):this.watch(entity,field,label);}
    recommendation(){
      const pack=this.ctx.debugInfo?.compactTarget?.(),t=pack?.target;if(!t)return null;
      const state=t.state||{};let field=null;
      for(const preferred of ['locked','state','powered','motor','collision','resolved','visible','target'])if(Object.prototype.hasOwnProperty.call(state,preferred)){field=preferred;break;}
      field ||= Object.keys(state)[0];
      if(!field)return null;
      return {entity:t.id,field,label:`${t.label||t.id} // ${field.toUpperCase()}`};
    }
    toggleNearest(){const r=this.recommendation();if(!r){this.ctx.ui.msg('NO WATCHABLE FIELD');return false;}this.toggle(r.entity,r.field,r.label);return true;}
    active(){return this.activeKey?this.watches.get(this.activeKey)||null:null;}
    setActive(key){if(this.watches.has(key)){this.activeKey=key;return this.watches.get(key);}return null;}
    list(){return [...this.watches.values()];}
    onFieldChange(e){const key=this.key(e.entity,e.field),w=this.watches.get(key);if(!w)return;w.value=e.after;w.hits++;w.lastChange=e;this.activeKey=key;this.ctx.emit('WATCH_HIT',{entity:e.entity,field:e.field,before:e.before,after:e.after,source:e.source,hits:w.hits});}
    debugText(){const a=this.list();if(!a.length)return 'NO WATCHES\n\nF7 watches a field on the nearest inspectable target.';return a.map(w=>`${w.key===this.activeKey?'▶':' '} ${w.label}\n  value=${this.ctx.fieldHistory?.fmt?.(w.value)??String(w.value)} · hits=${w.hits}`).join('\n\n');}
  }
  QQ.WatchSystem=WatchSystem;
})();
