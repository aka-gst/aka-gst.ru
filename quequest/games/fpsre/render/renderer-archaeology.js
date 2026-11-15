(() => {
  'use strict';
  const QQ=window.QQ;
  class RendererArchaeologySystem{
    constructor(ctx){
      this.ctx=ctx;
      this.modes=[
        {id:'FINAL',label:'ОБЫЧНЫЙ КАДР',code:0,help:'Так игру видит игрок.'},
        {id:'DEPTH',label:'ГЛУБИНА',code:1,help:'Светлое дальше, тёмное ближе.'},
        {id:'NORMALS',label:'НОРМАЛИ',code:2,help:'Направление поверхности.'},
        {id:'MATERIALS',label:'МАТЕРИАЛЫ',code:3,help:'Какой материал назначен поверхности.'},
        {id:'SHADOWS',label:'ТЕНИ',code:4,help:'Что попало в тень основного источника.'},
        {id:'LIGHT',label:'СВЕТ',code:5,help:'Сколько света реально получает поверхность.'},
        {id:'OVERDRAW',label:'НАЛОЖЕНИЕ',code:6,help:'Где движок рисует геометрию поверх геометрии.'}
      ];
      this.index=0;
      this.unlocked=!!ctx.save.get('rendererArchaeologyUnlocked',false);this.panelFixed=!!ctx.save.get('rendererCalibrationPanelFixed',false);if(this.panelFixed&&ctx.level.rendererBadPanel)ctx.level.rendererBadPanel.material='paintedMetal';
      this.ctx.interaction.register('RENDER_DIAGNOSTIC_CONSOLE',{
        realm:'day',range:3.0,priority:18,
        getPosition:()=>this.ctx.level.rendererConsole?.pos,
        condition:()=>!!this.ctx.level.rendererConsole,
        action:()=>this.unlock('CONSOLE')
      });
      this.ctx.interaction.register('RENDER_CALIBRATION_PANEL',{realm:'day',range:2.2,priority:17,getPosition:()=>this.ctx.level.rendererBadPanel?.pos,condition:()=>!!this.ctx.level.rendererBadPanel,action:()=>this.patchPanel()});
    }
    current(){return this.modes[this.index];}
    modeCode(){return this.current().code;}
    set(id){const i=this.modes.findIndex(x=>x.id===id);if(i<0)return false;this.index=i;this.ctx.emit('RENDER_LENS_CHANGED',{mode:this.current().id,label:this.current().label});return true;}
    unlock(source='DEBUG'){
      if(!this.unlocked){this.unlocked=true;this.ctx.save.set('rendererArchaeologyUnlocked',true);this.ctx.emit('RENDER_LENS_UNLOCKED',{source});}
      this.ctx.ui.msg('ЛИНЗЫ КАДРА ГОТОВЫ // F1');
      this.ctx.ui.objective('ДИАГНОСТИКА КАДРА','F1 переключает способы увидеть, как движок строит изображение.');
      return true;
    }
    cycle(dir=1){
      if(!this.unlocked){this.ctx.ui.msg('СНАЧАЛА НАСТРОЙ ДИАГНОСТИЧЕСКИЙ ТЕРМИНАЛ');return false;}
      this.index=(this.index+dir+this.modes.length)%this.modes.length;
      const m=this.current();
      this.ctx.ui.msg(`${m.label} // ${m.help}`);
      this.ctx.emit('RENDER_LENS_CHANGED',{mode:m.id,label:m.label});
      return true;
    }

    patchPanel(){
      const p=this.ctx.level.rendererBadPanel;if(!p)return false;
      if(this.panelFixed){this.ctx.ui.msg('ПАНЕЛЬ УЖЕ ИСПРАВЛЕНА');return true;}
      if(!this.unlocked){this.ctx.ui.msg('СНАЧАЛА НАСТРОЙ ДИАГНОСТИКУ КАДРА');return false;}
      if(this.current().id!=='MATERIALS'){this.ctx.ui.msg('НУЖНО ДОКАЗАТЬ ОШИБКУ МАТЕРИАЛА // F1');return false;}
      const before=p.material;p.material='paintedMetal';this.panelFixed=true;this.ctx.save.set('rendererCalibrationPanelFixed',true);
      this.ctx.emit('RENDER_MATERIAL_PATCH',{entity:p.name,field:'material',before,after:p.material});
      this.ctx.evidence?.add?.('EVIDENCE','Материал панели исправлен',`${p.name}: ${before} → ${p.material}`,1,'RENDER LENS',{entity:p.name});
      this.ctx.ui.msg('МАТЕРИАЛ ИСПРАВЛЕН');this.ctx.ui.objective('КАДР ИЗМЕНИЛСЯ','Вернись в обычный режим и сравни поверхность с соседними панелями.');return true;
    }
    debugText(){
      const m=this.current(),s=this.ctx.renderer?.frameStats||{};
      return [
        `РЕЖИМ: ${m.label}`,
        m.help,
        '',
        `ВЫЗОВЫ ОТРИСОВКИ: ${s.drawCalls??0}`,
        `ТРИЕУГОЛЬНИКИ: ${s.triangles??0}`,
        `ТЕНЕВОЙ ПРОХОД: ${s.shadowDraws??0}`,
        `ПРОХОДЫ ПОРТАЛОВ: ${s.portalPasses??0}`,
        `ПОВЕРХНОСТИ ПОРТАЛОВ: ${s.portalSurfaces??0}`,
        `АКТИВНЫЕ ОБЪЕКТЫ: ${s.activeObjects??0}`
      ].join('\n');
    }
  }
  QQ.RendererArchaeologySystem=RendererArchaeologySystem;
})();
