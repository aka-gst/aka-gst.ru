(() => {
  'use strict';
  const QQ=window.QQ,{V3}=QQ.Math3D;
  class DebugInfoSystem{
    constructor(ctx){this.ctx=ctx;this.providers=[];this.schema='EDI/1';this.installDefaults();}
    provider(name,fn){this.providers.push({name,fn});return this;}
    installDefaults(){
      const c=this.ctx;
      this.provider('A17',()=>{const l=c.level,t=c.re.target,d=c.re.analysisDepth||0;if(d<=0)return{nodes:[{id:'A17_TERMINAL',label:'ТЕРМИНАЛ',kind:'interface',pos:l.reTerminal.pos,state:{status:'ACCESS DENIED'}}],edges:[]};if(d===1)return{nodes:[{id:'SECURITY_DOOR_A17',label:'A17',kind:t.locked?'blocked':'state',pos:l.reDoor.pos,state:{locked:t.locked,powered:t.powered,motor:t.motor,address:t.address}}],edges:[]};const nodes=[{id:'A17_TERMINAL',label:'ТЕРМИНАЛ',kind:'interface',pos:l.reTerminal.pos,state:{credential:t.credentialPresented}},{id:'A17_CONTROLLER',label:'КОНТРОЛЛЕР',kind:'controller',pos:l.reController.pos,state:{rerouted:t.securityRerouted},...(d>=3?{writer:t.writer,caller:t.caller}:{})},{id:'SECURITY_DOOR_A17',label:'ЗАМОК',kind:t.locked?'blocked':'state',pos:l.reDoor.pos,state:{locked:t.locked,powered:t.powered,address:t.address}},{id:'A17_MOTOR',label:'ПРИВОД',kind:'actuator',pos:l.reMotor.pos,state:{motor:t.motor}}],edges=[['A17_TERMINAL','A17_CONTROLLER','input'],['A17_CONTROLLER','SECURITY_DOOR_A17',d>=3?'writes':'causes?'],['SECURITY_DOOR_A17','A17_MOTOR','drives']];if(d>=4){nodes.push({id:'A17_CALLER',label:'ВЫЗОВ',kind:'code',pos:[l.reController.pos[0],l.reController.pos[1]+1.7,l.reController.pos[2]],state:{symbol:t.caller}});edges.push(['A17_CALLER','A17_CONTROLLER','calls']);}if(d>=5){nodes.push({id:'A17_POLICY',label:'ПРАВИЛО',kind:'code',pos:[l.reController.pos[0]-1.8,l.reController.pos[1]+2.5,l.reController.pos[2]],state:{symbol:t.upstream}},{id:'A17_ROOT',label:'КОРЕНЬ',kind:'code',pos:[l.reController.pos[0]-3.4,l.reController.pos[1]+3.0,l.reController.pos[2]],state:{symbol:t.rootCause}});edges.push(['A17_ROOT','A17_POLICY','drives'],['A17_POLICY','A17_CALLER','calls']);}return{nodes,edges};});
      this.provider('TOPOLOGY',()=>{const nodes=[],edges=[];for(const p of c.portals.portals){nodes.push({id:`PORTAL_${p.portal.id}`,label:`P${p.portal.id}`,kind:'topology',pos:p.pos,state:{pair:p.portal.pair}});if(p.portal.id<p.portal.pair)edges.push([`PORTAL_${p.portal.id}`,`PORTAL_${p.portal.pair}`,'topology']);}const l=c.level;if(l.loopStart&&l.loopEnd){nodes.push({id:'LOOP_END',label:'КОНЕЦ ПЕТЛИ',kind:'hidden',pos:[l.loopEnd[0],1.05,l.loopEnd[2]]},{id:'LOOP_START',label:'НАЧАЛО ПЕТЛИ',kind:'hidden',pos:[l.loopStart[0],1.05,l.loopStart[2]]});edges.push(['LOOP_END','LOOP_START','hidden topology']);}return{nodes,edges};});
      this.provider('PROJECTION',()=>{const l=c.level,nodes=[];if(l.projectionFrame)nodes.push({id:'PROJECTION_FRAME',label:'ИЗОБРАЖЕНИЕ',kind:'representation',pos:l.projectionFrame.pos,state:{resolved:c.projection.resolved}},{id:'PROJECTION_CAPTURE',label:'ТОЧКА ВЗГЛЯДА',kind:'observer',pos:l.projectionCapture.pos});const edges=l.projectionFrame?[['PROJECTION_CAPTURE','PROJECTION_FRAME','alignment']]:[];if(c.projection.resolved){for(const o of l.projectionSteps.slice(0,3)){nodes.push({id:o.name,label:'ГЕОМЕТРИЯ',kind:'state',pos:o.pos,state:{collision:o.solid}});edges.push(['PROJECTION_FRAME',o.name,'commits']);}}return{nodes,edges};});
      this.provider('ROOM_PROJECTION',()=>{const l=c.level;if(!l.roomProjectionFrame)return{nodes:[],edges:[]};const nodes=[{id:'ROOM_PROJECTION_FRAME',label:'ИЗОБРАЖЕНИЕ',kind:'representation',pos:l.roomProjectionFrame.pos,state:{resolved:c.projectionRoom.resolved}},{id:'ROOM_PROJECTION_CAPTURE',label:'ТОЧКА ВЗГЛЯДА',kind:'observer',pos:l.roomProjectionCapture.pos}],edges=[['ROOM_PROJECTION_CAPTURE','ROOM_PROJECTION_FRAME','alignment']];if(c.projectionRoom.resolved){const term=l.projectedRoom.find(o=>o.name==='PROJECTED_ROOM_TERMINAL');if(term){nodes.push({id:'PROJECTED_ROOM_TERMINAL',label:'МЕСТО',kind:'state',pos:term.pos,state:{collision:'ON'}});edges.push(['ROOM_PROJECTION_FRAME','PROJECTED_ROOM_TERMINAL','instantiates']);}}return{nodes,edges};});
      this.provider('RENDERER',()=>{
        const l=c.level,ra=c.rendererArchaeology,st=c.renderer?.frameStats||{};
        if(!l.rendererConsole)return{nodes:[],edges:[]};
        const base=l.rendererConsole.pos,screen=l.rendererConsoleScreen?.pos||base;
        const nodes=[
          {id:'RENDER_DIAGNOSTIC_CONSOLE',label:'КАДР',kind:'interface',pos:base,state:{режим:ra?.current?.().label||'ОБЫЧНЫЙ КАДР',настроено:!!ra?.unlocked}},
          {id:'RENDER_SHADOW_PASS',label:'ТЕНИ',kind:'state',pos:[base[0]-1.5,base[1]+1.2,base[2]],state:{объекты:st.shadowDraws||0}},
          {id:'RENDER_PORTAL_PASS',label:'ПОРТАЛЫ',kind:'topology',pos:[base[0]+1.5,base[1]+1.2,base[2]],state:{проходы:st.portalPasses||0}},
          {id:'RENDER_FINAL_IMAGE',label:'КАДР',kind:'state',pos:[screen[0],screen[1]+1.45,screen[2]],state:{вызовы:st.drawCalls||0,треугольники:st.triangles||0}}
        ];
        const edges=[['RENDER_SHADOW_PASS','RENDER_FINAL_IMAGE','добавляет тени'],['RENDER_PORTAL_PASS','RENDER_FINAL_IMAGE','добавляет порталы'],['RENDER_DIAGNOSTIC_CONSOLE','RENDER_FINAL_IMAGE','переключает способ просмотра']];
        return{nodes,edges};
      });
      this.provider('WEAPON_MECHANISM',()=>{
        const m=c.weaponMechanism?.state;if(c.player.state.weapon!=='SERVICE_PISTOL'||!m||m.inspectMode==='NORMAL')return{nodes:[],edges:[]};
        const cam=c.player.camera(),f=c.player.cameraForward(),r=c.player.cameraRight(),base=V3.add(cam,V3.add(V3.mul(f,.85),V3.mul(r,.08)));
        const pos=(rx,uy,fz=0)=>V3.add(base,V3.add(V3.mul(r,rx),V3.add([0,uy,0],V3.mul(f,fz))));
        const nodes=[
          {id:'PISTOL_MAGAZINE',label:'МАГАЗИН',kind:'state',pos:pos(-.32,-.26),state:{патроны:m.magazine,запас:m.reserve}},
          {id:'PISTOL_CHAMBER',label:'ПАТРОННИК',kind:m.chamber?'state':'blocked',pos:pos(.02,.02),state:{заряжен:!!m.chamber}},
          {id:'PISTOL_TRIGGER',label:'СПУСК',kind:'interface',pos:pos(-.22,.15),state:{готов:!!m.chamber&&m.reloadTimer<=0}},
          {id:'PISTOL_SLIDE',label:'ЗАТВОР',kind:'actuator',pos:pos(.18,.24),state:{положение:+m.slide.toFixed(2),задержка:m.slideLocked,цикл:m.cycleStage}},
          {id:'PISTOL_EXTRACT',label:'ИЗВЛЕЧЕНИЕ',kind:'state',pos:pos(.42,.11),state:{гильз:m.ejected}}
        ];
        const edges=[
          ['PISTOL_MAGAZINE','PISTOL_CHAMBER','подаёт патрон'],
          ['PISTOL_CHAMBER','PISTOL_TRIGGER','разрешает выстрел'],
          ['PISTOL_TRIGGER','PISTOL_SLIDE','запускает цикл'],
          ['PISTOL_SLIDE','PISTOL_EXTRACT','извлекает'],
          ['PISTOL_EXTRACT','PISTOL_MAGAZINE','возвращает к подаче']
        ];
        return{nodes,edges};
      });
      this.provider('BALLISTICS',()=>{const shot=c.ballistics?.recent?.(QQ.Config.ballistics.traceSeconds*1000);if(!shot)return{nodes:[],edges:[]};const nodes=[{id:'BALLISTIC_LAST_SHOT',label:'ПУЛЯ',kind:'state',pos:shot.current,state:{скорость:Math.round(shot.speed),время:+shot.time.toFixed(2),энергия:Math.round((shot.energy||0)*100)+'%'}}],edges=[];const imp=shot.impacts?.[shot.impacts.length-1];if(imp){nodes.push({id:'BALLISTIC_IMPACT',label:imp.label,kind:imp.outcome==='STOP'?'blocked':'state',pos:imp.pos,state:{результат:imp.outcome}});edges.push(['BALLISTIC_LAST_SHOT','BALLISTIC_IMPACT','попадание']);}return{nodes,edges};});
      this.provider('AI',()=>{const b=c.ai.bot,m=c.ai.perception.memory,r=c.topology?.routeFor?.(b),a=c.archaeology,base=[b.pos[0],b.pos[1]+1.2,b.pos[2]],nodes=[{id:'QBOT',label:'Q-BOT',kind:'agent',pos:base,state:{state:b.state,confidence:m.confidence,model:a?.modelUnlocked?'PROVEN':`${a?.observed?.size||0}/4`}}],edges=[];if(a?.active){const seen=a.observed||new Set(),yaw=b.visual?.yaw||0,rx=Math.cos(yaw),rz=-Math.sin(yaw),fx=-Math.sin(yaw),fz=-Math.cos(yaw),off=(rgt,up,fwd)=>[base[0]+rx*rgt+fx*fwd,base[1]+up,base[2]+rz*rgt+fz*fwd];if(seen.has('SENSE')||a.modelUnlocked)nodes.push({id:'QBOT_SENSOR',label:'ВОСПРИЯТИЕ',kind:'interface',pos:off(-.85,.72,.05),state:{видит:!!c.ai.perception.visible}}),edges.push(['QBOT_SENSOR','QBOT','обновляет']);if(seen.has('MEMORY')||a.modelUnlocked)nodes.push({id:'QBOT_MEMORY',label:'ПАМЯТЬ',kind:'state',pos:off(-.55,1.25,.10),state:{уверенность:+m.confidence.toFixed(2),позиция:m.playerLastSeen?'есть':'нет'}}),edges.push(['QBOT_SENSOR','QBOT_MEMORY','пишет']);if(a.modelUnlocked){nodes.push({id:'QBOT_GOAL',label:'ЦЕЛЬ',kind:'state',pos:off(.15,1.55,.08),state:{goal:b.state==='ENGAGE'?'устранить угрозу':b.state==='INVESTIGATE_SOUND'?'проверить стимул':'искать ресурс'}},{id:'QBOT_ACTION',label:'ДЕЙСТВИЕ',kind:'actuator',pos:off(.75,1.08,.06),state:{action:b.state}},{id:'QBOT_REPLAN',label:'REPLAN',kind:'controller',pos:off(.95,.42,.04),state:{последний_стимул:m.lastHeard?'звук':'память'}});edges.push(['QBOT_MEMORY','QBOT_GOAL','информирует'],['QBOT_GOAL','QBOT_ACTION','выбирает'],['QBOT_ACTION','QBOT_REPLAN','проверяет'],['QBOT_REPLAN','QBOT_MEMORY','обновляет']);}}if(r?.usesTopology){let last='QBOT';r.steps.slice(1,-1).forEach((s,i)=>{const id=`QBOT_ROUTE_${i}`;nodes.push({id,label:s.via?.type==='portal'?'PORTAL ROUTE':'NAV',kind:'topology',pos:s.pos,state:{via:s.via?.type||'walk'}});edges.push([last,id,s.via?.type||'walk']);last=id;});}return{nodes,edges};});
    }
    snapshot(){const nodes=[],edges=[];for(const p of this.providers){try{const q=p.fn()||{};for(const n of q.nodes||[])nodes.push({...n,provider:p.name});for(const e of q.edges||[])edges.push({from:e[0],to:e[1],relation:e[2]||'link',provider:p.name});}catch(err){console.warn('[EDI provider]',p.name,err);}}return{schema:this.schema,nodes,edges};}
    nearest(pos,max=7){let best=null,bd=max;for(const n of this.snapshot().nodes){if(!n.pos)continue;const d=V3.len(V3.sub(n.pos,pos));if(d<bd){bd=d;best={...n,distance:d};}}return best;}
    node(id){return this.snapshot().nodes.find(n=>n.id===id)||null;}
    chainAround(id){const s=this.snapshot(),seen=new Set([id]),out=[];for(let pass=0;pass<3;pass++)for(const e of s.edges){if(seen.has(e.from)||seen.has(e.to)){out.push(e);seen.add(e.from);seen.add(e.to);}}return{nodes:s.nodes.filter(n=>seen.has(n.id)),edges:[...new Map(out.map(e=>[`${e.from}>${e.to}>${e.relation}`,e])).values()]};}
    unknowns(){const c=this.ctx,u=[];if((c.re.analysisDepth||0)<3)u.push('A17: кто записывает поле и кто вызывает код — ещё не доказано');if(!c.portals.discovered)u.push('Связь пространства ещё не подтверждена наблюдением');if(!c.portals.stackObserved)u.push('Связь комнат одна над другой ещё не пройдена');if(c.impossibleGeometry.loopCount<1)u.push('Для скрытой петли ещё нет доказательства маршрута');if(!c.projection.resolved)u.push('Проекция ещё не доказала настоящую геометрию столкновением');if(!c.projectionRoom.resolved)u.push('Связь изображения и настоящего места ещё не доказана');u.push('Граница хоста и источник создания мира остаются неизвестны');return u;}
    compactTarget(){const n=this.nearest(this.ctx.player.camera(),8);if(!n)return null;const chain=this.chainAround(n.id);return{target:n,chain};}
  }
  QQ.DebugInfoSystem=DebugInfoSystem;
})();
