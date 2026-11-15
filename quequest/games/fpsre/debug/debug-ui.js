(() => {
  'use strict';
  const QQ=window.QQ,$=QQ.util.$;
  class DebugSystem{
    constructor(ctx){this.ctx=ctx;this.f3=false;this.f4=false;this.breakInfo=null;}
    get paused(){return this.f4||!!this.ctx.breakpoints?.paused;}
    openBreak(info){this.breakInfo=info;this.f4=true;$('replay').classList.remove('hidden');document.exitPointerLock?.();}
    toggleF3(){this.f3=!this.f3;this.ctx.twilight?.setActive?.(this.f3);this.ctx.emit('DEBUG_VIEW',{view:'TRUE_SIGHT',open:this.f3});this.ctx.ui.msg(this.f3?'СУМЕРЕЧНЫЙ СЛОЙ':'ОБЫЧНЫЙ ВЗГЛЯД');}
    toggleF4(){this.f4=!this.f4;$('replay').classList.toggle('hidden',!this.f4);if(this.f4){document.exitPointerLock?.();this.ctx.timeline.selectActiveWatch?.();}this.ctx.emit('DEBUG_VIEW',{view:'DEBUGGER',open:this.f4});}
    stateLines(state={}){const entries=Object.entries(state).slice(0,5);return entries.length?entries.map(([k,v])=>`${k.toUpperCase()}  ${typeof v==='number'?v.toFixed?.(2)??v:v}`).join('\n'):'Состояние пока не открыто';}
    updateDay(){const c=this.ctx,pack=c.debugInfo.compactTarget(),ev=c.evidence.recent(5),unk=c.debugInfo.unknowns().slice(0,4);if(pack){const t=pack.target;$('lensPlayer').textContent=`${t.label} // ${t.id}\n${t.kind.toUpperCase()} · ${t.distance.toFixed(1)}m\n\n${this.stateLines(t.state)}${t.writer?`\n\nWRITER\n${t.writer}`:''}${t.caller?`\nCALLER\n${t.caller}`:''}`;const ids=new Map(pack.chain.nodes.map(n=>[n.id,n.label]));$('lensBot').textContent=pack.chain.edges.length?pack.chain.edges.slice(0,6).map(e=>`${ids.get(e.from)||e.from}\n  ↓ ${e.relation}\n${ids.get(e.to)||e.to}`).join('\n\n'):'ПРИЧИННАЯ СВЯЗЬ ПОКА НЕ НАЙДЕНА';}else{$('lensPlayer').textContent='РЯДОМ НЕТ ЦЕЛИ\n\nПодойди к системе ближе.\nАнализ не раскрывает весь мир сразу.';$('lensBot').textContent='Показываются только ближайшие причинные связи.';}
      $('lensWorld').textContent=ev.length?ev.map(e=>`${e.status==='EVIDENCE'?'●':'◐'} ${e.title}\n  ${Math.round(e.confidence*100)}% · ${e.source}\n  ${e.detail}`).join('\n\n'):'ДОКАЗАТЕЛЬСТВ ПОКА НЕТ';
      const historyTarget=pack?.target?.id||null,history=historyTarget?c.fieldHistory?.compact?.(historyTarget,3):'';
      const watch=c.watch?.active?.(),bp=watch&&c.breakpoints?.has?.(watch.entity,watch.field);$('lensEvents').textContent=[unk.map(x=>`? ${x}`).join('\n\n'),history?`ИСТОРИЯ\n${history}`:'',watch?`НАБЛЮДЕНИЕ\n${watch.entity}.${watch.field} = ${c.fieldHistory.fmt(watch.value)}${bp?'\nОСТАНОВКА ПРИ ИЗМЕНЕНИИ ВКЛЮЧЕНА':''}`:'F7 — НАБЛЮДАТЬ БЛИЖАЙШЕЕ ПОЛЕ'].filter(Boolean).join('\n\n')||'СЕЙЧАС НЕТ ОТМЕЧЕННЫХ НЕИЗВЕСТНЫХ';
    }
    updateDream(){const c=this.ctx,p=c.player.state,s=c.dream.state,l=c.level;$('lensPlayer').textContent=`ANOMALY ENTITY\nPOSITION ${p.pos.map(v=>v.toFixed(2)).join('  ')}\nVELOCITY ${p.vel.map(v=>v.toFixed(2)).join('  ')}\nCHECKPOINT ${s.checkpoint}\nVOID ${s.tideY.toFixed(2)}`;$('lensBot').textContent=`WORLD ≠ RENDER\n\nIMPOSSIBLE ROOM\nCOLLISION  OFF\nALPHA      ${l.impossibleRoom.alpha.toFixed(2)}\nOBSERVED   ${s.roomSeen?'YES':'NO'}\n\nECHO_01\nCONTROLLER UNKNOWN`;$('lensWorld').textContent=c.evidence.debugText(5);$('lensEvents').textContent='? ENTITY ORIGIN\n? HOST BOUNDARY\n? WHY OBSERVATION CHANGES RENDER STATE';}
    update(){const ctx=this.ctx,log=ctx.logger.events;if(this.f3){if(ctx.world.realm==='dream')this.updateDream();else this.updateDay();}if(this.f4){$('watchText').textContent=ctx.watch.debugText();$('breakText').textContent=ctx.breakpoints.debugText()+(ctx.breakpoints.paused?'\n\nEXECUTION PAUSED\nENTER TO RESUME':'');$('timelineText').textContent=ctx.timeline.text();$('patchText').textContent=ctx.patchSession.statusText()+'\n\n'+ctx.causal.text();$('replayText').textContent=log.slice(-80).reverse().map(e=>`${String(e.t).padStart(8)} ms  ${String(e.type).padEnd(24)} ${this.format(e)}`).join('\n');}}
    format(e){return Object.entries(e).filter(([k])=>!['t','wall','type'].includes(k)).map(([k,v])=>`${k}=${typeof v==='object'?JSON.stringify(v):v}`).join(' ');}
  }
  QQ.DebugSystem=DebugSystem;
})();
