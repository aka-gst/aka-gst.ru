(() => {
  'use strict';
  const QQ=window.QQ;
  function buildLevel(ctx){
    const w=ctx.world;
    const h={dreamBlocks:[]};
    // DAY: arrival / arena / maintenance shell
    w.box('FLOOR',[0,-.25,0],[38,.5,38],'metal',{walkable:true,grid:1,color:'#1d2a31'});
    w.box('NORTH_L',[-12.275,2,-32],[13.45,4,.6],'concrete');w.box('NORTH_R',[7.725,2,-32],[22.55,4,.6],'concrete');w.box('SOUTH',[0,2,18],[38,4,.6],'concrete');w.box('WEST',[-18,2,0],[.6,4,38],'concrete');w.box('EAST',[18,2,0],[.6,4,38],'concrete');
    // arrival corridor and observation booth
    h.arrivalWallL=w.box('ARRIVAL_WALL_L',[-12,1.7,14],[.6,3.4,7],'concrete');
    h.arrivalWallR=w.box('ARRIVAL_WALL_R',[-5.5,1.7,14],[.6,3.4,7],'concrete');
    w.box('ARRIVAL_CEILING',[-8.75,3.35,14],[7.1,.35,7],'metal',{color:'#26353d'});
    h.arrivalDoor=w.box('ARRIVAL_DOOR',[-8.75,1.55,10.8],[4.8,3.1,.45],'metal',{color:'#405861',emissive:.04});
    h.arrivalDoor.closedY=1.55;h.arrivalDoor.openY=4.65;h.arrivalDoor.triggered=false;h.arrivalDoor.door=true;
    h.returnSeam=w.box('RETURN_SEAM',[-11.45,1.65,12.0],[.08,2.4,2.8],'energy',{solid:false,visible:false,color:'#d685ff',emissive:0,alpha:0,impossible:true});
    h.returnMarker=w.box('RETURN_MARKER',[-8.75,2.95,12.05],[1.25,.08,.18],'screen',{solid:false,visible:false,color:'#5ee7ff',emissive:0,alpha:.92});
    h.observationGlass=w.box('OBSERVATION_GLASS',[-4.9,1.7,13.6],[.18,2.8,3.5],'glass',{destructible:true,integrity:54,alpha:.28,emissive:.12});
    h.returnPartition=w.box('RETURN_PARTITION',[-9.65,1.55,13.65],[3.5,3.1,.28],'paintedMetal',{visible:false,solid:false,color:'#26202f',emissive:0});
    h.returnLight=w.box('RETURN_LIGHT',[-11.4,2.9,12.6],[.75,.08,.18],'screen',{solid:false,visible:false,color:'#d685ff',emissive:0});
    h.returnSign=w.box('RETURN_SIGN',[-8.2,2.35,11.15],[1.55,.55,.08],'screen',{solid:false,visible:false,color:'#ffbd63',emissive:0});
    // central industrial structures
    w.box('MID_WALL',[-2,1.5,-2],[.8,3,11],'concrete');w.box('MID_WALL2',[5,1.25,4],[8,2.5,.8],'metal');
    h.blastDoor=w.box('BLAST_DOOR',[0,1.55,8.2],[5.2,3.1,.45],'metal',{color:'#405861',emissive:.04});
    h.blastDoor.closedY=1.55;h.blastDoor.openY=4.65;h.blastDoor.triggered=false;h.blastDoor.door=true;
    w.box('LOW_BLOCK',[-9,.75,6],[6,1.5,5],'concrete',{walkable:true});
    w.box('HIGH_PLATFORM',[8,2.6,-7],[10,.5,7],'metal',{walkable:true,grid:1});w.box('HIGH_RAIL_A',[3,3.35,-10.2],[.25,1.5,6.5],'metal');w.box('HIGH_RAIL_B',[13,3.35,-10.2],[.25,1.5,6.5],'metal');
    for(let i=0;i<6;i++)w.box('STAIR_'+i,[2.7+i*.75,(i+1)*.22,-5.1],[.85,(i+1)*.44,2.2],'metal',{walkable:true});
    // maintenance wing for first World Director sequence
    w.box('MAINT_WALL_A',[14,1.5,7.8],[7,.5,.5],'metal');
    w.box('MAINT_BACK',[14,1.5,13.3],[7,3,.5],'concrete');
    w.box('MAINT_SIDE',[17.2,1.5,10.5],[.5,3,6],'concrete');
    h.sequenceDoor=w.box('MAINT_SECURITY_DOOR',[10.8,1.55,10.7],[.45,3.1,4.2],'metal',{color:'#354951',emissive:.05});
    h.sequenceDoor.closedX=10.8;h.sequenceDoor.openX=13.8;h.sequenceDoor.door=true;
    h.sequenceLamp=w.box('MAINT_WARNING_LIGHT',[14.5,2.7,10.4],[.65,.12,.65],'energy',{solid:false,color:'#70e9ff',emissive:1});
    h.relay=w.box('POWER_RELAY',[15.2,1.0,10.6],[1.5,2.0,1.1],'metal',{destructible:true,integrity:80,color:'#40545a',emissive:.15,tags:['relay']});
    h.maintGlass=w.box('MAINT_SAFETY_GLASS',[12.1,1.55,8.15],[2.2,2.7,.16],'glass',{destructible:true,integrity:28,alpha:.24,emissive:.08});
    // reverse-engineering lab: visible world object backed by inspectable state
    h.reDoor=w.box('RE_SECURITY_DOOR',[-5.2,1.55,-11.2],[5.0,3.1,.45],'metal',{color:'#25343b',emissive:.04});
    h.reDoor.closedY=1.55;h.reDoor.openY=4.65;h.reDoor.door=true;
    h.reTerminal=w.box('RE_TERMINAL',[-2.25,1.05,-10.72],[.55,1.35,.28],'screen',{solid:false,color:'#ff6b5d',emissive:1});
    h.reController=w.box('SECURITY_CONTROLLER',[-1.65,1.3,-9.72],[.72,.9,.42],'paintedMetal',{solid:false,color:'#263a42',emissive:.05});
    h.reControllerLight=w.box('SECURITY_CONTROLLER_LIGHT',[-1.65,1.48,-9.47],[.32,.12,.08],'screen',{solid:false,color:'#ff6b5d',emissive:1});
    h.reMotor=w.box('A17_MOTOR',[-5.2,3.25,-11.05],[1.15,.48,.42],'metal',{solid:false,color:'#47575e',emissive:.02});
    h.rePower=w.box('A17_POWER_REROUTE',[-8.65,.85,-9.4],[.8,1.25,.45],'paintedMetal',{solid:false,color:'#2b3a3f',emissive:.04});
    h.rePowerLight=w.box('A17_POWER_LIGHT',[-8.65,1.13,-9.15],[.34,.13,.08],'screen',{solid:false,color:'#ffb240',emissive:1});
    h.reCredential=w.box('A17_CREDENTIAL',[-10.65,.76,-5.2],[.38,.68,.07],'screen',{solid:false,color:'#66dcff',emissive:1,alpha:.92,ry:Math.PI/2,meta:{mesh:'KEYCARD'}});
    h.reCredentialPedestal=w.box('A17_CREDENTIAL_PEDESTAL',[-10.65,.35,-5.2],[.82,.7,.82],'paintedMetal',{color:'#2a3b42'});
    w.box('RE_FRAME_L',[-7.8,1.7,-11.2],[.4,3.4,.7],'concrete');
    w.box('RE_FRAME_R',[-2.6,1.7,-11.2],[.4,3.4,.7],'concrete');
    w.box('RE_HEADER',[-5.2,3.35,-11.2],[5.6,.42,.7],'hazard',{color:'#a77d21'});
    // SPATIAL LAB // impossible geometry and portal transform laboratory behind A17.
    h.portalFloor=w.box('SPATIAL_LAB_FLOOR',[0,-.25,-25],[18,.5,14],'metal',{walkable:true,grid:1,color:'#17252b'});
    w.box('SPATIAL_LAB_WEST',[-9,2,-25],[.5,4,14],'concrete',{color:'#38474b'});
    w.box('SPATIAL_LAB_EAST',[9,2,-25],[.5,4,14],'concrete',{color:'#38474b'});
    w.box('SPATIAL_LAB_CEILING',[0,4.15,-25],[18,.3,14],'paintedMetal',{color:'#202f35'});
    // Repeated bays make the teleport spatially legible while still feeling liminal.
    for(let z=-19.5;z>=-30;z-=2.6){
      w.box(`SPATIAL_RIB_L_${z}`,[-8.15,2,z],[.28,4,.32],'paintedMetal',{color:'#2b4147'});
      w.box(`SPATIAL_RIB_R_${z}`,[8.15,2,z],[.28,4,.32],'paintedMetal',{color:'#2b4147'});
      w.box(`SPATIAL_LIGHT_${z}`,[0,3.92,z],[3.8,.06,.1],'screen',{solid:false,color:z<-25?'#a97cff':'#5bdcff',emissive:1});
    }
    w.box('SPATIAL_CENTER_PLINTH',[0,.45,-25],[3.6,.9,3.6],'concrete',{walkable:true,color:'#435257'});
    w.box('SPATIAL_CENTER_CORE',[0,1.42,-25],[.55,1.15,.55],'energy',{solid:false,color:'#9b7cff',emissive:1,alpha:.72});
    // Portal A faces south from the north wall; Portal B faces east from the west wall.
    h.portalA=w.box('PORTAL_A',[0,1.5,-30.65],[3.5,2.9,.08],'portal',{solid:false,color:'#61e9ff',emissive:1,alpha:.74,impossible:true});
    h.portalB=w.box('PORTAL_B',[-8.65,1.5,-24],[.08,2.9,3.5],'portal',{solid:false,color:'#b77cff',emissive:1,alpha:.74,impossible:true});
    h.portalA.portal={id:'A',pair:'B',yaw:0,normal:[0,0,1],half:[1.75,1.45]};
    h.portalB.portal={id:'B',pair:'A',yaw:Math.PI/2,normal:[1,0,0],half:[1.75,1.45]};
    // ROOM-OVER-ROOM TEST // same XZ footprint, different elevation, reachable only through topology.
    w.box('STACK_LOWER_BACK',[-6.95,1.75,-27],[.34,3.5,5.4],'paintedMetal',{color:'#26383e'});
    h.portalC=w.box('PORTAL_C',[-6.58,1.5,-27],[.08,2.9,3.2],'portal',{solid:false,color:'#70ffbd',emissive:1,alpha:.78,impossible:true});
    h.portalC.portal={id:'C',pair:'D',yaw:Math.PI/2,normal:[1,0,0],half:[1.6,1.45]};
    h.stackFloor=w.box('STACK_UPPER_FLOOR',[-4.55,4.48,-27],[4.8,.28,6.0],'metal',{walkable:true,color:'#1c2a30',grid:1});
    w.box('STACK_UPPER_WEST',[-6.95,6.0,-27],[.34,3.0,6.0],'paintedMetal',{color:'#2d4147'});
    w.box('STACK_UPPER_EAST',[-2.15,6.0,-27],[.34,3.0,6.0],'paintedMetal',{color:'#2d4147'});
    w.box('STACK_UPPER_NORTH_L',[-6.05,6.0,-30],[1.8,3.0,.34],'concrete',{color:'#3b484c'});
    w.box('STACK_UPPER_NORTH_R',[-3.05,6.0,-30],[1.8,3.0,.34],'concrete',{color:'#3b484c'});
    h.roomProjectionBarrier=w.box('ROOM_PROJECTION_BARRIER',[-4.55,6.0,-30],[1.2,2.7,.28],'rubber',{color:'#06090b',emissive:.01});
    h.roomProjectionFrame=w.box('ROOM_PROJECTION_FRAME',[-4.55,6.0,-29.82],[1.05,2.45,.08],'screen',{solid:false,color:'#6fe8ff',emissive:.75,alpha:.92,meta:{projection:'ROOM_02'}});
    h.roomProjectionCapture=w.box('ROOM_PROJECTION_CAPTURE',[-4.55,4.64,-26.35],[1.2,.05,1.2],'hazard',{solid:false,color:'#655f2d',emissive:.02,alpha:.62});
    w.box('STACK_UPPER_SOUTH',[-4.55,6.0,-24],[4.8,3.0,.34],'concrete',{color:'#3b484c'});
    w.box('STACK_UPPER_CEILING',[-4.55,7.52,-27],[4.8,.24,6.0],'paintedMetal',{color:'#18252a'});
    h.portalD=w.box('PORTAL_D',[-6.58,5.95,-27],[.08,2.9,3.2],'portal',{solid:false,color:'#ff7fc8',emissive:1,alpha:.78,impossible:true});
    h.portalD.portal={id:'D',pair:'C',yaw:Math.PI/2,normal:[1,0,0],half:[1.6,1.45]};
    w.box('STACK_UPPER_WINDOW',[-2.31,6.0,-27],[.08,1.5,2.7],'glass',{solid:false,alpha:.18,emissive:.08,color:'#7bd6e8'});
    w.box('STACK_UPPER_BEACON',[-4.55,5.15,-28.7],[.42,.42,.42],'screen',{solid:false,color:'#ff85d0',emissive:1});
    // ROOM PROJECTION 02 // a flat doorway image can instantiate an actual room beyond the north boundary.
    h.projectedRoom=[];
    const pr=(name,pos,size,material,opt={})=>{const o=w.box(name,pos,size,material,{...opt,visible:false,alpha:.01,meta:{...(opt.meta||{}),projectedRoom:true}});o.solid=false;h.projectedRoom.push(o);return o;};
    pr('PROJECTED_ROOM_FLOOR',[-4.55,4.48,-33.0],[4.8,.28,6.0],'metal',{walkable:true,color:'#263940',grid:1});
    pr('PROJECTED_ROOM_WEST',[-6.95,6.0,-33.0],[.34,3.0,6.0],'paintedMetal',{color:'#30464d'});
    pr('PROJECTED_ROOM_EAST',[-2.15,6.0,-33.0],[.34,3.0,6.0],'paintedMetal',{color:'#30464d'});
    pr('PROJECTED_ROOM_NORTH',[-4.55,6.0,-36.0],[4.8,3.0,.34],'concrete',{color:'#465559'});
    pr('PROJECTED_ROOM_CEILING',[-4.55,7.52,-33.0],[4.8,.24,6.0],'paintedMetal',{color:'#18272c'});
    pr('PROJECTED_ROOM_TERMINAL',[-4.55,5.35,-35.55],[.7,1.0,.35],'screen',{solid:false,color:'#c592ff',emissive:1});
    h.portals=[h.portalA,h.portalB,h.portalC,h.portalD];
    // Heavy frames make the openings feel physical instead of magical HUD rectangles.
    for(const x of [-2.0,2.0])w.box(`PORTAL_A_FRAME_${x}`,[x,1.6,-30.54],[.28,3.35,.34],'paintedMetal',{color:'#33494f'});
    w.box('PORTAL_A_HEADER',[0,3.33,-30.54],[4.3,.28,.34],'hazard',{color:'#8a7028'});
    for(const z of [-26.0,-22.0])w.box(`PORTAL_B_FRAME_${z}`,[-8.54,1.6,z],[.34,3.35,.28],'paintedMetal',{color:'#33494f'});
    w.box('PORTAL_B_HEADER',[-8.54,3.33,-24],[.34,.28,4.3],'hazard',{color:'#6f4f8f'});

    // V08 authored readability pass: colored wayfinding and stronger spatial silhouettes.
    w.box('SPATIAL_WAYFIND_CYAN',[0,.035,-18.7],[2.4,.05,4.6],'screen',{solid:false,color:'#4ee6ff',emissive:.75,alpha:.72});
    w.box('SPATIAL_WAYFIND_VIOLET',[-7.9,1.35,-24],[.06,1.7,2.5],'screen',{solid:false,color:'#b673ff',emissive:.9,alpha:.8});
    w.box('SPATIAL_CORE_RING_A',[0,2.15,-25],[2.8,.06,.08],'screen',{solid:false,color:'#8e76ff',emissive:1});
    w.box('SPATIAL_CORE_RING_B',[0,.72,-25],[.08,.06,2.8],'screen',{solid:false,color:'#59eaff',emissive:1});
    h.portalConsole=w.box('SPATIAL_CONSOLE',[5.9,1.0,-28.5],[1.25,1.7,.55],'paintedMetal',{color:'#263a40'});
    h.portalConsoleScreen=w.box('SPATIAL_CONSOLE_SCREEN',[5.58,1.28,-28.5],[.06,.72,.82],'screen',{solid:false,color:'#8ceaff',emissive:1});
    h.rendererConsole=w.box('RENDER_DIAGNOSTIC_CONSOLE',[4.85,.95,-20.55],[1.45,1.8,.72],'paintedMetal',{color:'#26373d'});
    h.rendererConsoleScreen=w.box('RENDER_DIAGNOSTIC_SCREEN',[4.47,1.23,-20.55],[.07,.82,.92],'screen',{solid:false,color:'#77f3c8',emissive:1});
    w.box('RENDER_DIAGNOSTIC_PLINTH',[4.85,.28,-20.55],[1.8,.56,1.05],'hazard',{color:'#665a2a'});
    h.rendererPanels=[
      w.box('RENDER_CALIBRATION_PANEL_01',[-8.62,1.0,-20.9],[.12,1.35,1.2],'paintedMetal',{solid:false,color:'#34464d'}),
      w.box('RENDER_CALIBRATION_PANEL_02',[-8.62,1.0,-22.4],[.12,1.35,1.2],'paintedMetal',{solid:false,color:'#34464d'}),
      w.box('RENDER_CALIBRATION_PANEL_03',[-8.62,1.0,-23.9],[.12,1.35,1.2],'rubber',{solid:false,color:'#34464d'})
    ];
    h.rendererBadPanel=h.rendererPanels[2];
    // BALLISTIC MATERIAL LAB // a small firing bay. The targets read first by material, not by text.
    // Kept off the main A17 route so the player can choose to stop and experiment.
    const ballisticZ=-15.82;
    const ballisticXs=[3.0,5.0,7.0];
    h.ballisticPanels=[
      w.box('BALLISTIC_GLASS_PANEL',[ballisticXs[0],1.32,ballisticZ],[1.30,2.28,.16],'glass',{destructible:true,integrity:90,alpha:.38,emissive:.11,color:'#9ddfed'}),
      w.box('BALLISTIC_METAL_PANEL',[ballisticXs[1],1.32,ballisticZ],[1.30,2.28,.18],'metal',{destructible:true,integrity:145,color:'#87969b',emissive:.025}),
      w.box('BALLISTIC_CONCRETE_PANEL',[ballisticXs[2],1.32,ballisticZ],[1.30,2.28,.20],'concrete',{destructible:true,integrity:180,color:'#78817d'})
    ];
    // Shared floor pad and a restrained frame give the bay a deliberate silhouette without labelling answers.
    w.box('BALLISTIC_BAY_PAD',[5.0,.035,-14.86],[6.7,.05,1.55],'paintedMetal',{solid:false,color:'#25363a',emissive:.02,alpha:.95});
    for(let i=0;i<ballisticXs.length;i++){
      const x=ballisticXs[i];
      const accent=i===0?'#71e3ff':i===1?'#d6b668':'#9da9a3';
      w.box(`BALLISTIC_FRAME_L_${i}`,[x-.78,1.34,ballisticZ+.02],[.12,2.62,.22],'paintedMetal',{color:'#2f4449'});
      w.box(`BALLISTIC_FRAME_R_${i}`,[x+.78,1.34,ballisticZ+.02],[.12,2.62,.22],'paintedMetal',{color:'#2f4449'});
      w.box(`BALLISTIC_FRAME_TOP_${i}`,[x,2.67,ballisticZ+.02],[1.68,.12,.22],'paintedMetal',{color:'#2f4449'});
      w.box(`BALLISTIC_ACCENT_${i}`,[x,2.59,ballisticZ+.15],[.82,.045,.05],'screen',{solid:false,color:accent,emissive:.72,alpha:.82});
      w.box(`BALLISTIC_FLOOR_MARK_${i}`,[x,.065,-14.55],[1.05,.035,.13],'screen',{solid:false,color:accent,emissive:.35,alpha:.62});
    }
    // A narrow service light separates the experiment from the darker Spatial Lab behind it.
    w.box('BALLISTIC_BAY_LIGHT',[5.0,3.18,-15.0],[5.9,.055,.11],'screen',{solid:false,color:'#91cbd2',emissive:.78,alpha:.78});
    h.portalAnchor=w.box('TOPOLOGY_ANCHOR',[6.2,.7,-21],[1.1,1.4,1.1],'paintedMetal',{color:'#3a4650',destructible:true,integrity:120});
    w.box('TOPOLOGY_ANCHOR_CORE',[6.2,1.05,-21],[.5,.5,.5],'energy',{solid:false,color:'#ba7cff',emissive:1,alpha:.86});
    // Liminal loop corridor: visually continuous, topologically shorter than its world-space length.
    w.box('LOOP_WALL_L',[4.45,1.8,-25.7],[.32,3.6,10.8],'paintedMetal',{color:'#25363b'});
    w.box('LOOP_WALL_R',[7.75,1.8,-25.7],[.32,3.6,10.8],'paintedMetal',{color:'#25363b'});
    w.box('LOOP_CEILING',[6.1,3.55,-25.7],[3.6,.22,10.8],'paintedMetal',{color:'#1d2b30'});
    for(let z=-21.4;z>=-29.8;z-=2.1){w.box(`LOOP_LIGHT_${z}`,[6.1,3.38,z],[1.55,.055,.08],'screen',{solid:false,color:'#8aaab8',emissive:.72});w.box(`LOOP_NOTCH_${z}`,[4.7,1.05,z],[.12,.7,.45],'hazard',{solid:false,color:'#7d672e',emissive:.02});}
    h.loopStart=[6.1,0,-21.35];h.loopEnd=[6.1,0,-30.05];
    h.loopWitness=w.box('LOOP_WITNESS_MARK',[7.52,1.35,-24.8],[.08,.7,.5],'screen',{solid:false,color:'#4d7782',emissive:.25});
    // PROJECTION FRAME // a flat representation can be committed into collision geometry.
    h.projectionFrame=w.box('PROJECTION_FRAME',[0,1.55,-20.85],[3.8,2.25,.12],'screen',{solid:false,color:'#75ddeb',emissive:.72,alpha:.9,meta:{projection:'STAIR_01'}});
    h.projectionFrameBacking=w.box('PROJECTION_FRAME_BACKING',[0,1.55,-20.98],[4.35,2.75,.22],'paintedMetal',{color:'#293d43'});
    h.projectionCapture=w.box('PROJECTION_CAPTURE_MARK',[0,.025,-18.35],[1.45,.05,1.45],'hazard',{solid:false,color:'#71682e',emissive:.03,alpha:.68});
    h.projectionSteps=[];
    for(let i=0;i<5;i++){const height=.34*(i+1),o=w.box(`PROJECTED_STEP_${i+1}`,[1.55+i*.72,height/2,-22.35],[.82,height,1.45],i%2?'paintedMetal':'concrete',{walkable:true,visible:false,alpha:.01,color:i%2?'#475960':'#59686b',meta:{projected:true}});o.solid=false;h.projectionSteps.push(o);}
    h.projectionLedge=w.box('PROJECTED_LEDGE',[5.05,1.92,-22.35],[2.55,.34,2.15],'metal',{walkable:true,visible:false,alpha:.01,color:'#41545b',meta:{projected:true}});h.projectionLedge.solid=false;h.projectionSteps.push(h.projectionLedge);
    h.projectionArchive=w.box('PROJECTION_ARCHIVE',[6.05,2.72,-22.35],[.65,.95,.42],'screen',{solid:false,visible:false,alpha:.01,color:'#d59cff',emissive:1,meta:{projected:true}});
    // destructibles
    h.glassGate=w.box('GLASS_GATE',[-1.55,1.5,5.2],[.22,3,4.5],'glass',{destructible:true,integrity:42,alpha:.30,emissive:.22});
    h.crate=w.box('WOOD_CRATE',[-8,.65,-7],[1.3,1.3,1.3],'wood',{destructible:true,integrity:62,meta:{mesh:'CRATE'}});
    h.panel=w.box('METAL_PANEL',[13.4,1.25,2],[.35,2.5,3],'metal',{destructible:true,integrity:110,emissive:.08});
    h.cover=w.box('CONCRETE_COVER',[7,.65,8],[4,1.3,1.1],'concrete',{destructible:true,integrity:150});
    h.barrelA=w.box('EXPLOSIVE_BARREL_A',[-4,.62,1.5],[.78,1.24,.78],'metal',{destructible:true,integrity:34,color:'#8e4036',meta:{mesh:'BARREL'}});h.barrelA.explosive=true;
    h.barrelB=w.box('EXPLOSIVE_BARREL_B',[10,.62,5.8],[.78,1.24,.78],'metal',{destructible:true,integrity:34,color:'#8e4036',meta:{mesh:'BARREL'}});h.barrelB.explosive=true;
    h.accidentBarrel=w.box('ACCIDENT_CANISTER',[15.6,.65,12.0],[.82,1.3,.82],'metal',{destructible:true,integrity:26,color:'#9d4b36',meta:{mesh:'BARREL'}});h.accidentBarrel.explosive=true;
    w.box('STEAM_PIPE',[14,.5,-2],[.55,1,.55],'metal',{color:'#445a63'});
    for(const p of [[-14,3,-14],[0,3.2,-14],[14,3,-14],[-14,3,14],[0,3.2,14],[14,3,14],[-8.7,3.0,14]])w.box('LAMP',p,[.8,.12,.18],'energy',{solid:false,color:'#74e8ff',emissive:1});
    h.jumpPad={x:-11,z:-5,r:1.1};
    h.sleepPod=w.box('ANOMALY_TERMINAL',[-14,.55,10.5],[2.8,1.1,4.2],'metal',{color:'#314852',emissive:.08});
    w.box('ANOMALY_TERMINAL_LIGHT',[-14,1.25,9],[1.9,.08,.12],'energy',{solid:false,color:'#8d68ff',emissive:1});
    h.foldSeam=w.box('ANOMALY_SEAM',[17.55,1.55,-8],[.08,2.7,4.2],'energy',{solid:false,color:'#bd7cff',emissive:1,alpha:.46,visible:false});
    // Dream realm
    const dreamBox=(name,pos,size,opt={})=>{const o=w.box(name,pos,size,opt.material||'metal',{...opt,realm:'dream'});o.baseColor=o.color?[...o.color]:null;if(o.dreamBlock)h.dreamBlocks.push(o);return o};
    dreamBox('DREAM_BASE',[0,-.25,10],[8,.5,8],{walkable:true,color:'#23182f',grid:1});
    const path=[[0,.35,5.8],[-2.7,.85,3.2],[1,1.35,.5],[3.3,1.85,-2.2],[.8,2.35,-4.9],[-2.4,2.85,-7.5],[-.4,3.35,-10.2],[2.7,3.85,-12.8],[.2,4.35,-15.5],[-2.8,4.85,-18.1],[0,5.35,-20.8],[2.8,5.85,-23.4],[0,6.35,-26.1]];
    path.forEach((p,i)=>dreamBox(`FOLD_STEP_${String(i+1).padStart(2,'0')}`,p,[3.25,.55,3.25],{walkable:true,dreamBlock:true,checkpoint:(i===3?1:i===7?2:i===10?3:0),color:i%2?'#3a2450':'#2a394d',emissive:i%3===0?.12:.04}));
    dreamBox('CHECKPOINT_RING_1',[3.3,2.23,-2.2],[4.2,.08,4.2],{solid:false,color:'#7445a6',emissive:.7,alpha:.32});
    dreamBox('CHECKPOINT_RING_2',[2.7,4.23,-12.8],[4.2,.08,4.2],{solid:false,color:'#7445a6',emissive:.7,alpha:.32});
    dreamBox('CHECKPOINT_RING_3',[0,5.73,-20.8],[4.2,.08,4.2],{solid:false,color:'#7445a6',emissive:.7,alpha:.32});
    h.impossibleRoom=dreamBox('IMPOSSIBLE_ROOM_ABOVE_ROOM',[6.2,7.2,-12],[5.5,2.8,5.5],{solid:false,impossible:true,color:'#442a5d',emissive:.15,alpha:.42});
    dreamBox('IMPOSSIBLE_ROOM_LIGHT',[6.2,7.25,-12],[2.4,.08,.15],{solid:false,impossible:true,color:'#df8cff',emissive:1});
    h.dreamExit={pos:[0,7.35,-29.4],r:1.45};
    dreamBox('ANOMALY_EXIT',[0,7.15,-29.4],[3.4,4.6,.35],{solid:false,color:'#7650a2',emissive:.8,alpha:.48,impossible:true});
    for(let i=0;i<8;i++)dreamBox('VOID_MONOLITH_'+i,[(-1)**i*(7+i%3*1.7),2+i*.75,7-i*5.2],[.65,4+i*.35,.65],{solid:false,color:i%2?'#191322':'#251432',emissive:.05,impossible:true});
    return h;
  }
  QQ.buildLevel=buildLevel;
})();
