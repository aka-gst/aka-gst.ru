(() => {
  'use strict';
  const QQ=window.QQ,$=QQ.util.$;
  const ctx=new QQ.GameContext();

  // Composition root: construction order is explicit; gameplay logic lives in systems.
  ctx.register('audio',new QQ.AudioSystem(ctx));
  ctx.register('spatialAudio',new QQ.SpatialAudioSystem(ctx));
  ctx.register('save',new QQ.SaveStore(ctx));
  ctx.register('noise',new QQ.NoiseSystem(ctx));
  ctx.register('world',new QQ.WorldSystem(ctx));
  ctx.register('textures',new QQ.TextureSystem(ctx));
  ctx.level=QQ.buildLevel(ctx);
  ctx.register('setDressing',new QQ.SetDressingSystem(ctx));
  ctx.v13=QQ.buildV13VerticalSlice?.(ctx)||null;
  ctx.register('triggers',new QQ.TriggerSystem(ctx));
  ctx.triggers.sphere('BALLISTIC_LAB_NEAR',[5,0,-13.8],3.9,{once:true,tags:['ballistics','materials'],onEnter:()=>{
    if(ctx.slice?.v13){const n=ctx.slice.ballisticPanels?.size||0;ctx.ui.objective(`ФИНАЛЬНАЯ КАЛИБРОВКА ${n}/3`,'Попади по стеклу, металлу и бетону хотя бы по одному разу.',5200);}else ctx.ui.objective('ТРИ ПОВЕРХНОСТИ','Стекло, металл, бетон. Возьми служебный пистолет [5] и сначала просто послушай попадания.',5200);
    ctx.emit('BALLISTIC_LAB_DISCOVERED');
  }});
  ctx.register('doors',new QQ.DoorSystem(ctx));
  ctx.doors.register('ARRIVAL_DOOR',ctx.level.arrivalDoor,{axis:'y',closed:ctx.level.arrivalDoor.closedY,open:ctx.level.arrivalDoor.openY,speed:3.6});
  ctx.doors.register('BLAST_DOOR',ctx.level.blastDoor,{axis:'y',closed:ctx.level.blastDoor.closedY,open:ctx.level.blastDoor.openY,speed:3.2});
  ctx.doors.register('MAINT_SECURITY_DOOR',ctx.level.sequenceDoor,{axis:'x',closed:ctx.level.sequenceDoor.closedX,open:ctx.level.sequenceDoor.openX,speed:2.8});
  ctx.doors.register('RE_SECURITY_DOOR',ctx.level.reDoor,{axis:'y',closed:ctx.level.reDoor.closedY,open:ctx.level.reDoor.openY,speed:3.4});

  ctx.register('portals',new QQ.PortalSystem(ctx));
  ctx.register('topology',new QQ.TopologyGraphSystem(ctx));
  ctx.register('impossibleGeometry',new QQ.ImpossibleGeometrySystem(ctx));
  ctx.register('alteredReturn',new QQ.AlteredReturnSystem(ctx));
  ctx.register('fx',new QQ.VFXSystem(ctx));
  ctx.register('ambientFx',new QQ.AmbientFXSystem(ctx));
  ctx.register('player',new QQ.PlayerSystem(ctx));
  ctx.register('ui',new QQ.HUDSystem(ctx));
  // V13 route markers emit concrete world progress; SliceProgressSystem owns the mini-game state.
  ctx.triggers.sphere('V13_SECURITY_ROUTE',[-7.0,0,7.4],3.0,{once:true,tags:['v13','route'],onEnter:()=>ctx.emit('V13_ROUTE_STAGE',{stage:'SECURITY'})});
  ctx.triggers.sphere('V13_HALL_ROUTE',[3.3,0,.2],5.0,{once:true,tags:['v13','encounter'],onEnter:()=>ctx.emit('V13_ROUTE_STAGE',{stage:'ENCOUNTER'})});
  ctx.triggers.sphere('V13_A17_ROUTE',[-5.2,0,-8.6],3.1,{once:true,tags:['v13','a17'],onEnter:()=>ctx.emit('V13_ROUTE_STAGE',{stage:'A17'})});
  ctx.register('twilight',new QQ.TwilightUXSystem(ctx));
  ctx.register('damage',new QQ.DamageSystem(ctx));
  ctx.register('materialImpact',new QQ.MaterialImpactSystem(ctx));
  ctx.register('ballistics',new QQ.BallisticsSystem(ctx));
  ctx.register('props',new QQ.PhysicsPropSystem(ctx));
  ctx.register('items',new QQ.ItemSystem(ctx));
  ctx.register('weaponMechanism',new QQ.WeaponMechanismSystem(ctx));
  ctx.register('weapons',new QQ.WeaponSystem(ctx));
  ctx.register('npcs',new QQ.NPCSystem(ctx));
  ctx.npcs.register('TECH_01',{pos:[13.2,0,11.7],yaw:-1.6,visible:true,state:'WORKING',controller:'WORLD_DIRECTOR'});
  ctx.register('sequences',new QQ.SequenceRunner(ctx));
  ctx.register('navigation',new QQ.NavigationSystem(ctx));
  ctx.register('ai',new QQ.QBotSystem(ctx));
  ctx.register('dream',new QQ.DreamSystem(ctx));
  ctx.register('interaction',new QQ.InteractionSystem(ctx));
  ctx.register('archaeology',new QQ.SystemArchaeologySystem(ctx));
  ctx.register('projection',new QQ.ProjectionSystem(ctx));
  ctx.register('projectionRoom',new QQ.ProjectionRoomSystem(ctx));
  ctx.register('re',new QQ.ReverseEngineeringSystem(ctx));
  ctx.register('director',new QQ.WorldDirector(ctx));
  ctx.register('topologyEncounter',new QQ.TopologyEncounterSystem(ctx));
  ctx.register('evidence',new QQ.EvidenceSystem(ctx));
  ctx.register('fieldHistory',new QQ.FieldHistorySystem(ctx));
  ctx.register('debugInfo',new QQ.DebugInfoSystem(ctx));
  ctx.register('watch',new QQ.WatchSystem(ctx));
  ctx.register('timeline',new QQ.TimelineSystem(ctx));
  ctx.register('breakpoints',new QQ.BreakpointSystem(ctx));
  ctx.register('patchSession',new QQ.PatchSessionSystem(ctx));
  ctx.register('causal',new QQ.CausalNavigatorSystem(ctx));
  ctx.register('slice',new QQ.SliceProgressSystem(ctx));

  ctx.register('debug',new QQ.DebugSystem(ctx));
  ctx.register('rendererArchaeology',new QQ.RendererArchaeologySystem(ctx));
  ctx.register('visual',new QQ.VisualSystem(ctx));
  ctx.register('screenFx',new QQ.ScreenFXSystem(ctx));
  ctx.register('renderer',new QQ.RendererSystem(ctx));
  ctx.register('input',new QQ.InputSystem(ctx));
  ctx.register('telemetry',new QQ.TelemetrySystem(ctx));
  ctx.register('loop',new QQ.GameLoopSystem(ctx));

  $('logStatus').textContent=ctx.logger.server?'AUTOLOG: SERVER → ~/Downloads/FPS_RE_EngineLab_logs/':'AUTOLOG: RECOVERY ACTIVE · F8 EXPORT';
  ctx.weapons.setWeapon('SERVICE_PISTOL');
  ctx.ui.objective('V14 // ПРИБЫТИЕ','Пройди коридор, пост охраны и Service Hall. Сначала смотри на мир; F3 — только когда понадобится причина.',5600);
  ctx.emit('SYSTEM_BOOT',{systems:ctx.list().map(x=>x.name),architecture:'GameContext + EventBus + service systems + composition root'});
  const selfTest=QQ.runSelfTest(ctx);

  window.FPS_RE_DEBUG={ctx,selfTest,v13:ctx.v13,systems:()=>ctx.list(),logger:ctx.logger,player:ctx.player.state,anomaly:ctx.dream.state,objects:ctx.world.objects,items:ctx.items.items,bot:ctx.ai.bot,director:ctx.director,re:ctx.re,portals:ctx.portals,impossibleGeometry:ctx.impossibleGeometry,projection:ctx.projection,projectionRoom:ctx.projectionRoom,evidence:ctx.evidence,fieldHistory:ctx.fieldHistory,debugInfo:ctx.debugInfo,watch:ctx.watch,timeline:ctx.timeline,breakpoints:ctx.breakpoints,patchSession:ctx.patchSession,topology:ctx.topology,props:ctx.props,ballistics:ctx.ballistics,materialImpact:ctx.materialImpact,weaponMechanism:ctx.weaponMechanism,causal:ctx.causal,slice:ctx.slice,archaeology:ctx.archaeology,rendererArchaeology:ctx.rendererArchaeology,enterDream:s=>ctx.dream.enter(s),wakeDream:(a,b)=>ctx.dream.wake(a,b),interact:()=>ctx.interaction.use(),setPlayer(pos){ctx.player.state.pos=[...pos];ctx.player.state.vel=[0,0,0]},startDirector:()=>ctx.director.startMaintenanceScene(),patchDoor:()=>ctx.re.togglePatch(),replaceSystem:(name,instance)=>ctx.replace(name,instance),get realm(){return ctx.world.realm}};

  const q=new URLSearchParams(location.search);
  if(q.get('anomaly')==='1'||q.get('dream')==='1')setTimeout(()=>ctx.dream.enter('QUERY_DEMO'),80);
  if(q.get('director')==='1')setTimeout(()=>ctx.director.startMaintenanceScene(),250);
  if(ctx.loop.demo){ctx.ui.objective('FPS-RE // ENGINE LAB','DEMO CAMERA // normal launch: WASD + mouse. F3 opens systems only when requested.');}
  if(ctx.logger.recovered){ctx.ui.objective('RECOVERED PREVIOUS SESSION',`Unclosed session ${ctx.logger.recovered.id} found. Recovery log preserved; F8 exports current log.`);ctx.emit('RECOVERY_NOTICE',{previous:ctx.logger.recovered.id});}
  ctx.loop.start();
})();
