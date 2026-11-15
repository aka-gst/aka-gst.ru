(() => {
  'use strict';
  const QQ=window.QQ;
  class SetDressingSystem{
    constructor(ctx){this.ctx=ctx;this.props=[];this.build();}
    box(name,pos,size,mat,opt={}){const o=this.ctx.world.box(name,pos,size,mat,{solid:opt.solid??false,...opt});this.props.push(o);return o;}
    build(){
      // Ceiling ribs and light channels: strong perspective rhythm from spawn into the lab.
      for(let z=16;z>=-15;z-=4){this.box(`CEILING_RIB_${z}`,[0,3.65,z],[35,.22,.32],'paintedMetal',{color:'#28373d'});this.box(`CEILING_STRIP_${z}`,[0,3.53,z+.12],[20,.055,.09],'screen',{color:z%8===0?'#6fdcff':'#405e69',emissive:z%8===0?1:.25});}
      // Industrial columns split the giant room into readable bays.
      for(const x of [-16,-11,-6,6,11,16])for(const z of [-13,-5,3,11]){this.box(`COLUMN_${x}_${z}`,[x,1.75,z],[.48,3.5,.48],'paintedMetal',{color:'#2b3b42'});this.box(`COLUMN_BAND_${x}_${z}`,[x,1.05,z],[.56,.3,.56],'hazard',{color:'#c29324'});}
      // Pipes around maintenance and RE wings.
      for(let i=0;i<5;i++){this.box(`PIPE_M_${i}`,[11.3+i*1.15,3.05,13.0],[.18,.18,5.5],'metal',{color:i%2?'#52656b':'#394c53'});this.box(`PIPE_RE_${i}`,[-12+i*.72,2.95,-14.9],[.22,.22,5.4],'metal',{color:'#42565e'});}
      // Cable trays and wall panels create scale without expensive meshes.
      for(let i=0;i<8;i++){this.box(`WALL_PANEL_N_${i}`,[-14+i*4,1.7,-17.64],[3.5,2.7,.08],'paintedMetal',{color:i%2?'#26353a':'#2c3d43'});this.box(`WALL_PANEL_S_${i}`,[-14+i*4,1.7,17.64],[3.5,2.7,.08],'paintedMetal',{color:i%2?'#26353a':'#2c3d43'});}
      this.box('CABLE_TRAY_A',[5.5,3.1,-2.0],[10.5,.16,.65],'rubber',{color:'#141d20'});
      this.box('CABLE_TRAY_B',[-10.2,2.8,7.0],[.55,.16,12.0],'rubber',{color:'#13191b'});
      // Observation/liminal glass corridor.
      this.box('OBS_FRAME_TOP',[-8.75,3.18,13.1],[6.1,.18,.18],'paintedMetal',{color:'#2e4148'});
      this.box('OBS_FRAME_BOT',[-8.75,.35,13.1],[6.1,.18,.18],'paintedMetal',{color:'#2e4148'});
      for(const x of [-11.5,-9.7,-7.9,-6.1])this.box(`OBS_MULLION_${x}`,[x,1.75,13.1],[.12,2.9,.12],'metal',{color:'#4b5f66'});
      // Low floor guidance and hazard language; readable even without text.
      for(let z=14;z>-10;z-=2.3)this.box(`GUIDE_${z}`,[-8.75,.015,z],[.08,.025,1.15],'screen',{color:'#36bfe4',emissive:.75});
      for(let x=-6.8;x<=-3.2;x+=.7)this.box(`A17_HAZARD_${x}`,[x,.02,-10.88],[.38,.025,.48],'hazard',{color:'#c89624'});
      // V12 external-prop art pass: authored silhouettes from the bundled CC0 Sci-Fi Essentials kit.
      // Collision stays box-based; render meshes are visual replacements only.
      for(const [i,z] of [15.55,13.75].entries())this.box(`ARRIVAL_LOCKER_${i}`,[-11.55,.95,z],[.82,1.90,.48],'paintedMetal',{solid:false,ry:Math.PI/2,color:'#3a494d',meta:{mesh:'LOCKER'}});
      this.box('MAINT_WORK_DESK',[15.15,.48,12.28],[2.05,.96,.82],'paintedMetal',{solid:false,ry:Math.PI,color:'#37464a',meta:{mesh:'DESK'}});
      this.box('MAINT_SERVICE_CRATE',[12.55,.46,9.25],[.92,.92,.92],'paintedMetal',{solid:true,color:'#46565a',meta:{mesh:'CRATE'}});
      this.box('SPATIAL_SERVICE_CRATE',[-5.85,.43,-22.15],[.86,.86,.86],'paintedMetal',{solid:true,color:'#35474d',meta:{mesh:'CRATE'}});
      // Functional clusters: each prop explains the room instead of decorating it at random.
      this.box('MAINT_WORK_CHAIR',[14.55,.55,11.35],[.78,1.10,.78],'paintedMetal',{solid:false,ry:-Math.PI/2,color:'#344348',meta:{mesh:'CHAIR'}});
      this.box('MAINT_PARTS_SHELF',[16.55,1.20,10.55],[1.18,2.40,.58],'paintedMetal',{solid:false,ry:Math.PI/2,color:'#324248',meta:{mesh:'SHELF'}});
      this.box('BALLISTICS_AMMO_CASE',[6.25,.25,-12.55],[.72,.50,.86],'paintedMetal',{solid:false,ry:.18,color:'#46575b',meta:{mesh:'AMMO_BOX'}});
      this.box('BALLISTICS_MED_TUBE',[7.20,.38,-12.95],[.24,.66,.24],'screen',{solid:false,color:'#78d7d2',emissive:.20,meta:{mesh:'HEALTH_TUBE'}});
      this.box('BALLISTICS_TOOL_SHELF',[8.05,1.18,-13.18],[1.12,2.36,.56],'paintedMetal',{solid:false,ry:Math.PI/2,color:'#33464b',meta:{mesh:'SHELF'}});
      this.box('BALLISTICS_SPARE_CASE',[2.05,.25,-13.22],[.72,.50,.86],'paintedMetal',{solid:false,ry:-.16,color:'#48595c',meta:{mesh:'AMMO_BOX'}});
      this.box('BALLISTICS_WORK_CHAIR',[7.42,.55,-13.12],[.78,1.10,.78],'paintedMetal',{solid:false,ry:.35,color:'#344348',meta:{mesh:'CHAIR'}});
      this.box('SPATIAL_SENSOR_DISH',[6.15,1.30,-28.75],[1.45,2.60,1.55],'paintedMetal',{solid:false,ry:-.55,color:'#3d5057',meta:{mesh:'SAT_DISH'}});
      this.box('SPATIAL_MED_TUBE',[-6.35,.38,-21.05],[.24,.66,.24],'screen',{solid:false,color:'#76d2cf',emissive:.16,meta:{mesh:'HEALTH_TUBE'}});
      this.box('SPATIAL_CALIBRATION_CASE',[-6.18,.25,-22.08],[.72,.50,.86],'paintedMetal',{solid:false,ry:.22,color:'#394b50',meta:{mesh:'AMMO_BOX'}});
      this.box('MAINT_SPARE_AMMO_CASE',[12.10,.25,11.65],[.72,.50,.86],'paintedMetal',{solid:false,ry:-.12,color:'#45565a',meta:{mesh:'AMMO_BOX'}});
      this.box('ARRIVAL_SERVICE_SHELF',[-12.05,1.14,11.95],[1.10,2.28,.54],'paintedMetal',{solid:false,ry:Math.PI/2,color:'#304148',meta:{mesh:'SHELF'}});
      // Art Pass 05: visible task fixtures line up with real local lights in the renderer.
      this.box('BALLISTICS_TASK_CANOPY',[6.65,3.18,-12.55],[3.25,.11,.68],'paintedMetal',{solid:false,color:'#29383c'});
      this.box('BALLISTICS_TASK_TUBE',[6.65,3.06,-12.55],[2.25,.035,.13],'screen',{solid:false,color:'#e2bd7b',emissive:1});
      this.box('BALLISTICS_CASE_CATCH',[5.18,.18,-13.42],[1.65,.36,.72],'paintedMetal',{solid:false,color:'#303f43'});
      this.box('BALLISTICS_CASE_CATCH_LIP',[5.18,.42,-13.72],[1.72,.16,.10],'hazard',{solid:false,color:'#a47a24'});
      this.box('BALLISTICS_SAFETY_STRIP_L',[1.72,.045,-14.88],[.10,.035,2.25],'hazard',{solid:false,color:'#c29324',emissive:.05});
      this.box('BALLISTICS_SAFETY_STRIP_R',[8.28,.045,-14.88],[.10,.035,2.25],'hazard',{solid:false,color:'#c29324',emissive:.05});
      this.box('SPATIAL_SERVICE_CANOPY',[-6.05,3.12,-21.55],[2.75,.10,.62],'paintedMetal',{solid:false,color:'#28383d'});
      this.box('SPATIAL_SERVICE_TUBE',[-6.05,3.01,-21.55],[1.92,.035,.12],'screen',{solid:false,color:'#70dfe0',emissive:1});
      // Art Pass 07: RE forensics bench groups evidence work into one authored silhouette.
      this.box('RE_FORENSICS_DESK',[-2.15,.48,-13.28],[2.05,.96,.82],'paintedMetal',{solid:false,ry:Math.PI,color:'#35464b',meta:{mesh:'DESK'}});
      this.box('RE_FORENSICS_CHAIR',[-1.35,.55,-12.45],[.78,1.10,.78],'paintedMetal',{solid:false,ry:-.32,color:'#344348',meta:{mesh:'CHAIR'}});
      this.box('RE_ARCHIVE_LOCKER',[-3.55,.95,-13.38],[.82,1.90,.48],'paintedMetal',{solid:false,ry:Math.PI/2,color:'#37484d',meta:{mesh:'LOCKER'}});
      this.box('RE_EVIDENCE_SHELF',[-4.55,1.18,-13.20],[1.12,2.36,.56],'paintedMetal',{solid:false,ry:Math.PI/2,color:'#304248',meta:{mesh:'SHELF'}});
      this.box('RE_CALIBRATION_CASE',[-2.92,.25,-12.58],[.72,.50,.86],'paintedMetal',{solid:false,ry:.20,color:'#405158',meta:{mesh:'AMMO_BOX'}});
      this.box('RE_TASK_CANOPY',[-2.20,3.12,-13.00],[2.85,.10,.62],'paintedMetal',{solid:false,color:'#28383d'});
      this.box('RE_TASK_TUBE',[-2.20,3.01,-13.00],[1.95,.035,.12],'screen',{solid:false,color:'#80d7d4',emissive:1});
      // Art Pass 08: A17 threshold reads as a controlled service boundary, not an unlit blockout doorway.
      this.box('A17_THRESHOLD_TOP',[-5.20,3.08,-10.86],[4.55,.045,.10],'screen',{solid:false,color:'#d39a59',emissive:.88});
      this.box('A17_THRESHOLD_L',[-7.58,1.92,-10.86],[.07,2.15,.10],'screen',{solid:false,color:'#d39a59',emissive:.78});
      this.box('A17_THRESHOLD_R',[-2.82,1.92,-10.86],[.07,2.15,.10],'screen',{solid:false,color:'#d39a59',emissive:.78});
      this.box('A17_SERVICE_CASE',[-7.10,.25,-9.72],[.72,.50,.86],'paintedMetal',{solid:false,ry:.12,color:'#43545a',meta:{mesh:'AMMO_BOX'}});
      // Maintenance machinery silhouette.
      this.box('GENERATOR_BODY',[13.7,.85,8.8],[2.4,1.7,1.6],'paintedMetal',{color:'#304147'});
      this.box('GENERATOR_CORE',[13.7,1.02,7.95],[1.25,.68,.14],'screen',{color:'#6de4ff',emissive:1});
      this.box('GENERATOR_RAIL',[13.7,1.9,8.8],[2.7,.15,1.9],'hazard',{color:'#a27a22'});
      // Small crates/props for parallax and combat readability.
      for(const p of [[-13,.38,-2],[-12.2,.28,-2.6],[2.2,.35,11.9],[3.1,.28,12.3],[9.3,.35,1.4]])this.box(`PROP_${p.join('_')}`,p,[.7,.7,.7],'paintedMetal',{color:'#34464d',solid:true,meta:{mesh:'CRATE'}});
      // Spatial lab: repeated floor bands, cables and asymmetric service details help the player notice teleport discontinuities.
      for(let z=-20;z>=-30;z-=1.6)this.box(`SPATIAL_FLOOR_BAND_${z}`,[0,.018,z],[15,.025,.055],'screen',{color:z<-25?'#8d65c8':'#2d9fb6',emissive:.34});
      this.box('SPATIAL_CABLE_A',[7.85,2.75,-25],[.22,.22,10.5],'rubber',{color:'#11171a'});
      this.box('SPATIAL_CABLE_B',[-7.85,.62,-27.4],[.16,.16,5.4],'rubber',{color:'#171c20'});
      for(const p of [[5.9,.32,-22.2],[6.7,.32,-22.6],[-5.8,.28,-27.8]])this.box(`SPATIAL_CASE_${p.join('_')}`,p,[.9,.64,.65],'paintedMetal',{color:'#2c3a40',solid:true,meta:{mesh:'AMMO_BOX'}});
      this.box('SPATIAL_WARNING_BAR',[0,2.25,-19.2],[5.6,.16,.12],'hazard',{color:'#a87924'});
      // V09 environment-art pass: readable machinery bays, ducts and floor detail instead of one large box.
      for(const z of [-21.1,-24.0,-26.9,-29.8]){
        this.box(`SPATIAL_ARCH_TOP_${z}`,[0,3.45,z],[16.1,.34,.28],'paintedMetal',{color:'#34484f'});
        this.box(`SPATIAL_ARCH_L_${z}`,[-7.6,1.75,z],[.38,3.45,.38],'paintedMetal',{color:'#31444a'});
        this.box(`SPATIAL_ARCH_R_${z}`,[7.6,1.75,z],[.38,3.45,.38],'paintedMetal',{color:'#31444a'});
        this.box(`SPATIAL_ARCH_LIGHT_${z}`,[0,3.25,z+.08],[5.3,.05,.08],'screen',{color:z<-25?'#b181ff':'#69e7ff',emissive:1});
      }
      for(let x=-6;x<=6;x+=2){this.box(`SPATIAL_GRATE_${x}`,[x,.027,-24.8],[1.55,.028,4.8],'rubber',{color:'#10181b'});}
      this.box('SPATIAL_DUCT_MAIN',[0,3.72,-26.0],[10.5,.42,1.15],'paintedMetal',{color:'#26373c'});
      this.box('SPATIAL_DUCT_BRANCH',[5.2,3.38,-23.2],[.78,.72,6.2],'paintedMetal',{color:'#2b3d43'});
      for(let z=-22;z>=-29;z-=1.4){this.box(`SPATIAL_CABLE_DROP_${z}`,[-6.95,1.85,z],[.11,2.5,.11],'rubber',{color:'#12191d'});}
      for(const p of [[-6.1,.68,-21.2],[-6.1,.68,-28.7],[6.0,.68,-23.1],[6.0,.68,-27.9]]){
        this.box(`SERVICE_CAB_${p.join('_')}`,p,[1.35,1.35,.72],'paintedMetal',{color:'#2b3b41'});
        this.box(`SERVICE_LED_${p.join('_')}`,[p[0],p[1]+.25,p[2]-.38],[.42,.08,.035],'screen',{color:p[0]<0?'#63e8ff':'#c388ff',emissive:1});
      }
      for(const z of [-20.0,-23.5,-27.0,-30.3]){
        this.box(`FLOOR_EDGE_L_${z}`,[-7.25,.04,z],[2.3,.04,.07],'hazard',{color:'#977425'});
        this.box(`FLOOR_EDGE_R_${z}`,[7.25,.04,z],[2.3,.04,.07],'hazard',{color:'#977425'});
      }

      // V10 art/UX pass: readable light pools and environmental labels instead of HUD labels.
      for(const [x,z,warm] of [[-8.75,11.1,false],[-8.75,6.3,true],[-3.8,-8.7,false],[13.8,8.7,true],[0,-19.6,false],[0,-27.9,false]]){
        this.box(`LIGHT_CANOPY_${x}_${z}`,[x,3.25,z],[2.6,.10,.62],'paintedMetal',{color:'#2a3436'});
        this.box(`LIGHT_TUBE_${x}_${z}`,[x,3.13,z],[1.85,.035,.14],'screen',{color:warm?'#dfb06f':'#8ad7d5',emissive:warm?.92:1});
      }
      // Large in-world wayfinding marks. Shapes, not text, so they work in every language.
      this.box('WAYFIND_A17_BAR',[-5.2,2.75,-10.88],[2.7,.06,.04],'screen',{solid:false,color:'#86c8c4',emissive:.72});
      this.box('WAYFIND_SPATIAL_BAR',[0,2.86,-18.55],[4.4,.06,.04],'screen',{solid:false,color:'#6bc1c0',emissive:.75});
      this.box('WAYFIND_RETURN_BAR',[-8.75,2.62,10.92],[2.2,.05,.04],'screen',{solid:false,color:'#c89f6a',emissive:.52});
      // A few bright edge catches help the eye read depth in the otherwise dark industrial space.
      for(const x of [-15.5,-10.5,-5.5,5.5,10.5,15.5]){
        this.box(`FLOOR_EDGE_CATCH_${x}`,[x,.035,4.2],[1.35,.02,.035],'metal',{solid:false,color:'#718185'});
      }

    }
  }
  QQ.SetDressingSystem=SetDressingSystem;
})();
