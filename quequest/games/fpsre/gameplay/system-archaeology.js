(() => {
  'use strict';
  const QQ=window.QQ,{rgb}=QQ.Math3D;
  class SystemArchaeologySystem{
    constructor(ctx){
      this.ctx=ctx;this.active=false;this.modelUnlocked=false;this.baitUses=0;this.lastBaitAt=0;
      this.observed=new Set();this.patterns=new Set();
      this.baitPos=[9.55,1.05,-3.45];
      this.bind();this.installInteraction();
    }
    bind(){const c=this.ctx;
      c.events.on('V13_ROUTE_STAGE',e=>{if(e.stage==='ENCOUNTER')this.begin();});
      c.events.on('AI_SEE_PLAYER',e=>{if(!this.active||this.ctx.ai?.bot?.defeated)return;this.observe('SENSE','ЗРЕНИЕ',`Q-Bot подтвердил твою позицию: ${e.pos.map(v=>Number(v).toFixed(1)).join(', ')}`);});
      c.events.on('AI_LOST_PLAYER',e=>{if(!this.active||this.ctx.ai?.bot?.defeated)return;this.observe('MEMORY','ПАМЯТЬ',`Контакт потерян, но последняя позиция ещё хранится · уверенность ${Math.round((e.confidence||0)*100)}%`);});
      c.events.on('AI_HEAR_NOISE',e=>{if(!this.active||this.ctx.ai?.bot?.defeated)return;this.observe('HEARING','СЛУХ',`Шум ${e.noiseType||'GENERIC'} принят как новый стимул · ${Math.round(e.effectiveDistance||0)} м`);});
      c.events.on('AI_STATE_CHANGE',e=>{if(!this.active||this.ctx.ai?.bot?.defeated)return;if(e.to==='INVESTIGATE_SOUND')this.observe('REPLAN','ПЕРЕПЛАНИРОВАНИЕ','После потери визуального контакта новый звук изменил действие Q-Bot.');});
      c.events.on('FRAG',()=>{if(!this.active)return;if(this.modelUnlocked)c.evidence?.add?.('EVIDENCE','Модель Q-Bot выдержала боевую проверку','Игрок использовал восстановленную причинную модель в том же encounter',1,'SYSTEM ARCHAEOLOGY');else c.evidence?.add?.('UNKNOWN','Q-Bot уничтожен до завершения модели','Encounter пройден силой; внутреннее правило осталось недоказанным',.35,'SYSTEM ARCHAEOLOGY');});
    }
    installInteraction(){
      this.ctx.interaction?.register?.('V13_ARCHAEOLOGY_CONSOLE',{range:2.35,priority:34,getPosition:()=>[-2.50,1.20,-1.20],condition:()=>this.active&&this.modelUnlocked&&!this.ctx.ai?.bot?.defeated,action:()=>this.triggerBait()});
    }
    begin(){if(this.active)return;this.active=true;this.ctx.emit('SYSTEM_ARCHAEOLOGY_START',{target:'Q-BOT',lesson:'PERCEPTION_MEMORY_REPLAN'});this.ctx.ui.objective('SYSTEM ARCHAEOLOGY // ЧЁРНЫЙ ЯЩИК','Не спеши стрелять. Дай Q-Bot увидеть тебя, спрячься за укрытием, затем создай шум из другой позиции. Смотри, что он делает.',7600);}
    observe(key,title,detail){
      if(this.observed.has(key))return;this.observed.add(key);
      this.ctx.evidence?.add?.('EVIDENCE',`Q-Bot // ${title}`,detail,.96,'SYSTEM ARCHAEOLOGY',{entity:'Q-BOT'});
      this.ctx.emit('ARCHAEOLOGY_OBSERVATION',{target:'Q-BOT',key,count:this.observed.size,detail});
      const count=this.observed.size;
      const next=key==='SENSE'?'Теперь разорви линию видимости.':key==='MEMORY'?'Теперь создай шум, не показываясь.':key==='HEARING'?'Смотри: изменится ли действие без нового визуального контакта.':'Правило почти восстановлено.';
      this.ctx.ui.objective(`НАБЛЮДЕНИЕ ${Math.min(count,4)}/4 // ${title}`,`${detail}. ${next}`,4300);
      if(['SENSE','MEMORY','HEARING','REPLAN'].every(k=>this.observed.has(k)))this.unlockModel();
    }
    unlockModel(){
      if(this.modelUnlocked)return;this.modelUnlocked=true;this.patterns.add('LAST_KNOWN_POSITION');this.patterns.add('STIMULUS_REPLAN');
      this.ctx.emit('ARCHAEOLOGY_MODEL_UNLOCKED',{target:'Q-BOT',model:['SENSE','MEMORY','GOAL','ACTION','REPLAN'],patterns:[...this.patterns]});
      this.ctx.evidence?.add?.('EVIDENCE','Восстановлена причинная модель Q-Bot','SENSE → MEMORY → GOAL → ACTION → REPLAN',1,'SYSTEM ARCHAEOLOGY',{entity:'Q-BOT'});
      const screen=this.ctx.world.byName?.('V13_ARCH_CONSOLE_SCREEN');if(screen){screen.color=rgb('#68f0c5');screen.emissive=1.25;}
      this.ctx.ui.objective('МОДЕЛЬ ВОССТАНОВЛЕНА','Q-Bot не «знает», где ты. Он обновляет память из стимулов и перепланирует действие. Подойди к зелёному терминалу у стола и нажми E: подай ложный сигнал в другой части зала.',9000);
    }
    triggerBait(){
      const now=performance.now();if(now-this.lastBaitAt<2200){this.ctx.ui.msg('СИГНАЛ ЕЩЁ ЗАТИХАЕТ');return false;}this.lastBaitAt=now;this.baitUses++;
      this.ctx.noise.emit(this.baitPos,26,'DECOY_SIGNAL',{source:'SYSTEM_ARCHAEOLOGY',synthetic:true,salience:2.8});
      this.ctx.fx.pulse(this.baitPos,rgb('#70e9e0'),.55);this.ctx.audio?.tone?.(510,.11,.028,'square');
      this.ctx.emit('ARCHAEOLOGY_EXPLOIT',{target:'Q-BOT',pattern:'STIMULUS_REPLAN',baitPos:[...this.baitPos],use:this.baitUses});
      this.ctx.evidence?.add?.('EVIDENCE','Модель использована против системы','Ложный стимул записан в слуховую память Q-Bot и заставляет его перепланировать действие',1,'SYSTEM ARCHAEOLOGY',{entity:'Q-BOT'});
      this.ctx.ui.objective('ИСПОЛЬЗУЙ ПРАВИЛО','Ложный сигнал отправлен. Не беги за маркером — наблюдай, куда Q-Bot сам решит идти. Теперь его поведение стало инструментом.',5600);return true;
    }
    debugText(){return `Q-BOT SYSTEM ARCHAEOLOGY\nACTIVE ${this.active}\nMODEL ${this.modelUnlocked?'PROVEN':'UNKNOWN'}\nOBSERVED ${[...this.observed].join(' → ')||'—'}\nPATTERNS ${[...this.patterns].join(', ')||'—'}\nBAIT USES ${this.baitUses}`;}
  }
  QQ.SystemArchaeologySystem=SystemArchaeologySystem;
})();
