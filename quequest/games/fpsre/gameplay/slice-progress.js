(() => {
  'use strict';
  const QQ=window.QQ,{rgb}=QQ.Math3D;
  class SliceProgressSystem{
    constructor(ctx){
      this.ctx=ctx;this.v13=!!ctx.v13;
      this.stages=this.v13?['ARRIVAL','SECURITY','ENCOUNTER','KEYCARD','A17','BALLISTICS','COMPLETE']:['ARRIVAL','INCIDENT','A17','SPATIAL_LAB','LIMINAL_LOOP','ROOM_OVER_ROOM','PROJECTION_ROOM','RETURN'];
      this.index=0;this.stage=this.stages[0];this.visited=new Set([this.stage]);this.ballisticPanels=new Set();
      this.bind();if(!this.v13)this.installReturnTrigger();this.applyVisualState();
    }
    bind(){const c=this.ctx;
      if(this.v13){
        c.events.on('V13_ROUTE_STAGE',e=>{
          if(e.stage==='SECURITY')this.advance('SECURITY','Пост охраны впереди. Service Hall начинается за рамкой прохода.');
          else if(e.stage==='ENCOUNTER')this.advance('ENCOUNTER','Q-Bot держит зал. Убери угрозу и проверь, что он нёс.');
          else if(e.stage==='A17'&&this.index<this.stages.indexOf('KEYCARD'))c.ui.objective('A17 // НЕТ ДОСТУПА','Сначала зачисти Service Hall. Нужная сервисная карта находится у охраны.',3600);
        });
        c.events.on('FRAG',e=>this.advance('KEYCARD','Q-Bot отключён. Забери выпавшую сервисную карту.'));
        c.events.on('RE_CREDENTIAL_PICKUP',()=>this.advance('A17','Сервисная карта у тебя. Иди к терминалу A17 и разберись с блокировкой.'));
        c.events.on('RE_SOLVED',()=>this.advance('BALLISTICS','A17 открыт. Финальная проверка: стекло, металл и бетон в Ballistics Lab.'));
        c.events.on('BALLISTIC_IMPACT',e=>this.onBallisticImpact(e));
        return;
      }
      c.events.on('DIRECTOR_SEQUENCE_START',()=>this.advance('INCIDENT','Начинается авария. Смотри, что после неё продолжает жить по собственным правилам.'));
      c.events.on('RE_TARGET_NEAR',()=>this.advance('A17','Механизм исправен, но что-то выше по цепочке не даёт ему сработать.'));
      c.events.on('RE_SOLVED',()=>this.advance('SPATIAL_LAB','Дверь открыта. Теперь странно ведёт себя уже само пространство.'));
      c.events.on('GEOMETRY_LOOP',()=>this.advance('LIMINAL_LOOP','Пройденное расстояние больше не совпадает с картой.'));
      c.events.on('ROOM_OVER_ROOM_OBSERVED',()=>this.advance('ROOM_OVER_ROOM','Две комнаты занимают одно и то же место на плане.'));
      c.events.on('PROJECTION_ROOM_COMMIT',()=>{this.advance('PROJECTION_ROOM','Изображение стало настоящим местом. Вернись туда, откуда пришёл.');c.triggers.setEnabled('SLICE_RETURN_TRIGGER',true);});
    }
    onBallisticImpact(e){
      if(!this.v13||this.index<this.stages.indexOf('BALLISTICS'))return;
      const map={BALLISTIC_GLASS_PANEL:'стекло',BALLISTIC_METAL_PANEL:'металл',BALLISTIC_CONCRETE_PANEL:'бетон'},label=map[e.object];
      if(!label)return;
      this.ballisticPanels.add(e.object);
      const n=this.ballisticPanels.size;
      this.ctx.emit('V13_CALIBRATION_PROGRESS',{count:n,total:3,object:e.object,material:e.material,outcome:e.outcome});
      if(n>=3){this.advance('COMPLETE','Маршрут завершён: угроза снята, A17 открыт, три материала откалиброваны.');return;}
      const left=Object.entries(map).filter(([id])=>!this.ballisticPanels.has(id)).map(([,name])=>name).join(', ');
      this.ctx.ui.objective(`КАЛИБРОВКА ${n}/3`,`Подтверждено: ${label}. Осталось: ${left}.`,3200);
      this.applyVisualState();
    }
    installReturnTrigger(){const c=this.ctx,l=c.level;c.triggers.sphere('SLICE_RETURN_TRIGGER',l.arrivalDoor.pos,5.2,{enabled:false,once:true,tags:['slice','return'],onEnter:()=>{if(this.index>=this.stages.indexOf('PROJECTION_ROOM'))this.advance('RETURN','Путь знакомый, но мир уже не совпадает с тем, каким был раньше.');}});}
    advance(stage,note=''){
      const next=this.stages.indexOf(stage);if(next<0||next<=this.index)return false;const before=this.stage;this.index=next;this.stage=stage;this.visited.add(stage);this.applyVisualState();this.ctx.emit('SLICE_STAGE',{before,stage,index:this.index,note,v13:this.v13});
      const titles=this.v13?{SECURITY:'КПП',ENCOUNTER:'КОНТАКТ',KEYCARD:'СЕРВИСНАЯ КАРТА',A17:'СЕКТОР A17',BALLISTICS:'ФИНАЛЬНАЯ КАЛИБРОВКА',COMPLETE:'VERTICAL SLICE COMPLETE'}:{INCIDENT:'АВАРИЯ',A17:'A17 // ПРИЧИНА',SPATIAL_LAB:'ЛАБОРАТОРИЯ ПРОСТРАНСТВА',LIMINAL_LOOP:'АНОМАЛИЯ РАССТОЯНИЯ',ROOM_OVER_ROOM:'КОМНАТА НАД КОМНАТОЙ',PROJECTION_ROOM:'ИЗОБРАЖЕНИЕ → МЕСТО',RETURN:'ВОЗВРАЩЕНИЕ // ЧТО-ТО ИЗМЕНИЛОСЬ'};
      this.ctx.ui.objective(titles[stage]||stage,note||'Продолжай.',stage==='COMPLETE'?9000:4600);return true;
    }
    applyVisualState(){const l=this.ctx.level,s=this.stage;
      if(this.v13){
        const w=this.ctx.world,green=rgb('#5dffac'),amber=rgb('#d39a59'),cyan=rgb('#75d8dc');
        const arrival=w.byName?.('V13_ARRIVAL_STATUS');if(arrival){arrival.color=this.index>=1?green:amber;arrival.emissive=this.index>=1?1:.78;}
        const gate=w.byName?.('V13_GLASS_GATE_STATUS');if(gate){gate.color=this.index>=3?green:cyan;gate.emissive=this.index>=3?1:.68;}
        const a17=w.byName?.('V13_A17_BAR');if(a17){a17.color=this.index>=5?green:amber;a17.emissive=this.index>=5?1:.94;}
        const ids=['BALLISTIC_GLASS_PANEL','BALLISTIC_METAL_PANEL','BALLISTIC_CONCRETE_PANEL'];
        ids.forEach((id,i)=>{if(!this.ballisticPanels.has(id))return;const light=w.byName?.(`V13_BALL_TARGET_LIGHT_${[3,5,7][i]}`),accent=w.byName?.(`BALLISTIC_ACCENT_${i}`),floor=w.byName?.(`BALLISTIC_FLOOR_MARK_${i}`);if(light){light.color=green;light.emissive=1.25;}if(accent){accent.color=green;accent.emissive=1.18;}if(floor){floor.color=green;floor.emissive=.72;}});
        return;
      }
      if(l.returnSeam){const on=s==='RETURN';l.returnSeam.visible=on;l.returnSeam.alpha=on?.52:0;l.returnSeam.emissive=on?1:0;}
      if(l.returnMarker){const on=this.index>=this.stages.indexOf('PROJECTION_ROOM');l.returnMarker.visible=on;l.returnMarker.emissive=on?.9:0;l.returnMarker.color=rgb(s==='RETURN'?'#d685ff':'#5ee7ff');}
    }
    progress(){return{stage:this.stage,index:this.index,total:this.stages.length,visited:[...this.visited],ballisticPanels:[...this.ballisticPanels],complete:this.stage==='COMPLETE'};}
    debugText(){return this.stages.map((s,i)=>`${i<this.index?'✓':i===this.index?'▶':'·'} ${s}`).join('\n');}
  }
  QQ.SliceProgressSystem=SliceProgressSystem;
})();
