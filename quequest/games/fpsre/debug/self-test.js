(() => {
  'use strict';
  const QQ=window.QQ;
  QQ.runSelfTest=function(ctx){
    const required={
      audio:['tone'],spatialAudio:['update'],save:['get','set'],noise:['emit','recent'],world:['raycast','floorAt'],textures:['tileRect','upload'],setDressing:[],triggers:['update','sphere'],doors:['update','command'],portals:['update','transformEntity'],topology:['shortestRoute','nextInstruction','pressureImages'],impossibleGeometry:['update'],alteredReturn:['update'],projection:['update'],projectionRoom:['update'],fx:['update'],ambientFx:['update'],player:['update','camera'],interaction:['use'],archaeology:['begin','observe','unlockModel','triggerBait'],ui:['update'],twilight:['update','setActive'],damage:['explode','object'],materialImpact:['resolve','profile'],ballistics:['update','firePistol','recent'],props:['update','radialImpulse'],items:['update'],weaponMechanism:['update','trigger','startReload','toggleInspect','ammoText'],weapons:['update','fire'],npcs:['get','setState'],sequences:['start','update'],navigation:['stepAgent','path'],ai:['update'],director:['update'],topologyEncounter:['update'],dream:['update','enter'],re:['update','togglePatch','deepen'],evidence:['recent'],fieldHistory:['history','recentForEntity'],debugInfo:['snapshot','nearest'],watch:['watch','toggleNearest','active'],timeline:['select','scrub','current'],breakpoints:['toggle','resume'],patchSession:['previewOrCommit','rollback'],causal:['step','current'],slice:['advance','progress'],debug:['update'],rendererArchaeology:['cycle','modeCode','unlock','patchPanel'],visual:['update'],screenFx:['update'],renderer:['render'],input:[],telemetry:['update'],loop:['start','stop']
    };
    const failures=[];
    for(const [name,methods] of Object.entries(required)){const sys=ctx.get(name);if(!sys){failures.push(`${name}:missing`);continue;}for(const method of methods)if(typeof sys[method]!=='function')failures.push(`${name}.${method}:missing`);}
    if(!ctx.level?.relay)failures.push('level.relay:missing');
    if(!ctx.level?.dreamBlocks?.length)failures.push('level.dreamBlocks:missing');
    if(!ctx.level?.reDoor||!ctx.level?.reTerminal)failures.push('level.RE lab:missing');
    if(!ctx.level?.portalA||!ctx.level?.portalB)failures.push('level.portal lab:missing');
    if(!ctx.level?.portalC||!ctx.level?.portalD||!ctx.level?.stackFloor)failures.push('level.room-over-room:missing');
    if(!ctx.level?.loopStart||!ctx.level?.loopEnd)failures.push('level.liminal loop:missing');
    if(!ctx.level?.projectionFrame||!ctx.level?.projectionSteps?.length)failures.push('level.projection puzzle:missing');
    if(!ctx.level?.roomProjectionFrame||!ctx.level?.projectedRoom?.length)failures.push('level.room projection:missing');
    if(!ctx.level?.returnSeam||!ctx.level?.returnMarker||!ctx.level?.returnPartition||!ctx.level?.returnLight)failures.push('level.return anomaly:missing');
    if(!ctx.level?.ballisticPanels?.length||ctx.level.ballisticPanels.length<3)failures.push('level.ballistic lab:missing');
    const data={systems:ctx.list().map(x=>x.name),failures,pass:failures.length===0};
    ctx.emit(failures.length?'SELF_TEST_FAIL':'SELF_TEST_PASS',data);
    if(failures.length)console.error('[FPS-RE SelfTest]',failures);else console.info('[FPS-RE SelfTest] PASS',data.systems);
    return data;
  };
})();
