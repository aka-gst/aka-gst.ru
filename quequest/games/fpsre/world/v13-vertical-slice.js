(() => {
  'use strict';
  const QQ=window.QQ;

  function buildV13VerticalSlice(ctx){
    const w=ctx.world, made=[];
    const add=(name,pos,size,mat='paintedMetal',opt={})=>{
      const o=w.box(name,pos,size,mat,{...opt,solid:opt.solid!==false,meta:{...(opt.meta||{}),v13:true}});
      made.push(o);return o;
    };
    const mesh=(name,pos,size,id,ry=0,color='#394a50')=>add(name,pos,size,'paintedMetal',{ry,color,meta:{mesh:id}});
    const light=(name,pos,size,color='#8fdde0',emissive=1)=>add(name,pos,size,'screen',{solid:false,color,emissive,alpha:.96});

    // V13 freezes the giant V12 warehouse dressing as legacy presentation. Gameplay authority
    // remains in level.js; only non-authoritative decoration is replaced here.
    for(const o of ctx.setDressing?.props||[]){o.visible=false;o.solid=false;}
    for(const id of ['OBSERVATION_GLASS','MAINT_SAFETY_GLASS','GLASS_GATE','LOW_BLOCK','MID_WALL2']){
      const o=w.byName?.(id);if(o){o.visible=false;o.solid=false;}
    }
    // The old huge ceiling ribs / columns were authored as dressing, so removing them does
    // not change collision. Core level walls and puzzle objects stay untouched.

    // --- ARRIVAL CORRIDOR --------------------------------------------------
    // Tight proportions, layered wall panels and a low ceiling make the first frame read as
    // a facility corridor rather than a 38x38 test room.
    add('V13_ARRIVAL_FLOOR',[-8.75,.018,13.65],[5.55,.035,6.2],'paintedMetal',{walkable:true,color:'#1a262b',grid:1});
    add('V13_ARRIVAL_CEILING',[-8.75,3.16,13.65],[5.55,.20,6.2],'paintedMetal',{color:'#141f23'});
    for(const x of [-11.44,-6.06]){
      add(`V13_ARRIVAL_WALL_${x}`,[x,1.58,13.65],[.18,3.12,6.2],'paintedMetal',{color:'#26373c'});
      add(`V13_ARRIVAL_SKIRT_${x}`,[x+(x<0?.11:-.11),.39,13.65],[.045,.64,5.85],'rubber',{color:'#0d1417'});
    }
    for(const z of [15.9,14.1,12.3,10.7]){
      add(`V13_ARRIVAL_RIB_${z}`,[-8.75,2.97,z],[5.18,.24,.28],'paintedMetal',{color:'#304248'});
      light(`V13_ARRIVAL_LIGHT_${z}`,[-8.75,2.83,z+.02],[1.78,.04,.12],z===10.7?'#d7aa6b':'#8bdde0',z===10.7?.84:1);
    }
    // Door frame at the end of the corridor hides the old floating-door silhouette.
    add('V13_ARRIVAL_JAMB_L',[-11.22,1.55,10.53],[.28,3.1,.40],'paintedMetal',{color:'#34484e'});
    add('V13_ARRIVAL_JAMB_R',[-6.28,1.55,10.53],[.28,3.1,.40],'paintedMetal',{color:'#34484e'});
    add('V13_ARRIVAL_HEADER',[-8.75,3.00,10.53],[5.22,.30,.40],'paintedMetal',{color:'#34484e'});
    add('V13_ARRIVAL_THRESHOLD',[-8.75,.045,10.42],[4.45,.045,.28],'hazard',{color:'#7d6328'});
    light('V13_ARRIVAL_STATUS',[-8.75,2.72,10.30],[1.05,.05,.05],'#d4a05f',.78);
    mesh('V13_ARRIVAL_LOCKER_A',[-10.95,.95,14.7],[.82,1.9,.48],'LOCKER',Math.PI/2,'#34454b');
    mesh('V13_ARRIVAL_LOCKER_B',[-10.95,.95,13.0],[.82,1.9,.48],'LOCKER',Math.PI/2,'#34454b');
    mesh('V13_ARRIVAL_CASE',[-6.72,.28,14.95],[.74,.54,.88],'AMMO_BOX',-.12,'#45565b');

    // --- SECURITY CHECKPOINT ---------------------------------------------
    add('V13_SECURITY_FLOOR',[-6.5,.022,7.6],[8.4,.04,4.7],'paintedMetal',{walkable:true,color:'#202d31'});
    add('V13_SECURITY_CEILING',[-6.5,3.42,7.6],[8.4,.20,4.7],'paintedMetal',{color:'#152126'});
    add('V13_SECURITY_BACK',[-10.50,1.65,7.6],[.20,3.30,4.7],'paintedMetal',{color:'#2b3c42'});
    add('V13_SECURITY_BULKHEAD_L',[-9.40,1.60,5.38],[2.25,3.20,.30],'paintedMetal',{color:'#33464c'});
    add('V13_SECURITY_BULKHEAD_R',[-3.55,1.60,5.38],[3.15,3.20,.30],'paintedMetal',{color:'#33464c'});
    add('V13_SECURITY_HEADER',[-6.50,3.02,5.38],[8.55,.32,.30],'paintedMetal',{color:'#33464c'});
    add('V13_SECURITY_COUNTER',[-9.15,.58,7.65],[1.65,1.16,.72],'paintedMetal',{color:'#35474c'});
    add('V13_SECURITY_COUNTER_TOP',[-9.15,1.19,7.65],[1.82,.07,.84],'metal',{color:'#56666a'});
    light('V13_SECURITY_TERMINAL',[-8.78,1.43,7.27],[.48,.34,.035],'#72d6d8',1);
    light('V13_SECURITY_LIGHT',[-6.5,3.20,6.52],[2.7,.045,.13],'#d8ae73',.88);
    mesh('V13_SECURITY_CHAIR',[-10.0,.52,7.9],[.66,1.02,.66],'CHAIR',.08,'#344348');
    mesh('V13_SECURITY_CRATE',[-4.25,.45,8.05],[.92,.92,.92],'CRATE',.08,'#46575b');

    // --- SERVICE HALL / ENCOUNTER ----------------------------------------
    // One readable combat room: side masses, cover islands, overhead service bridge.
    add('V13_HALL_FLOOR',[3.65,.020,-.30],[17.0,.04,13.4],'paintedMetal',{walkable:true,color:'#1a272b'});
    add('V13_HALL_CEILING',[3.65,4.05,-.30],[17.0,.20,13.4],'paintedMetal',{color:'#101a1e'});
    add('V13_HALL_WEST_WALL',[-4.72,1.90,-.30],[.22,3.80,13.4],'paintedMetal',{color:'#26373c'});
    add('V13_HALL_EAST_WALL',[12.02,1.90,-.30],[.22,3.80,13.4],'paintedMetal',{color:'#26373c'});
    for(const z of [4.8,1.9,-1.0,-3.9,-6.5]){
      add(`V13_HALL_BEAM_${z}`,[3.65,3.82,z],[16.65,.28,.34],'paintedMetal',{color:'#34474d'});
      light(`V13_HALL_LIGHT_${z}`,[3.65,3.64,z+.05],[3.1,.045,.12],z===-3.9?'#d6a15f':'#82d3d6',z===-3.9?.82:.94);
    }
    // Re-authored glass checkpoint: the old 4.5 m cyan sheet is hidden above. Two narrower panes
    // and an opaque frame preserve the idea of a security divider without filling half the camera.
    add('V13_GLASS_FRAME_L',[-1.55,1.55,3.38],[.34,3.10,.24],'paintedMetal',{color:'#40555b'});
    add('V13_GLASS_FRAME_R',[-1.55,1.55,7.02],[.34,3.10,.24],'paintedMetal',{color:'#40555b'});
    add('V13_GLASS_FRAME_TOP',[-1.55,3.00,5.20],[.34,.28,3.88],'paintedMetal',{color:'#40555b'});
    add('V13_GLASS_PANE_A',[-1.55,1.53,4.30],[.10,2.70,1.55],'glass',{color:'#83b9c2',alpha:.18,emissive:.06});
    add('V13_GLASS_PANE_B',[-1.55,1.53,6.10],[.10,2.70,1.55],'glass',{color:'#83b9c2',alpha:.18,emissive:.06});
    light('V13_GLASS_GATE_STATUS',[-1.38,2.73,5.20],[.04,.16,.78],'#75d8dc',.68);
    // Service masses break the room into combat lanes without changing navigation authority.
    add('V13_COVER_A',[1.8,.54,.65],[2.65,1.08,1.35],'paintedMetal',{color:'#35464b'});
    add('V13_COVER_A_CAP',[1.8,1.11,.65],[2.83,.07,1.48],'metal',{color:'#5a696b'});
    add('V13_COVER_B',[7.1,.54,.5],[2.6,1.08,1.55],'paintedMetal',{color:'#34454a'});
    add('V13_COVER_B_CAP',[7.1,1.11,.5],[2.78,.07,1.68],'metal',{color:'#59686b'});
    add('V13_COVER_C',[4.2,.62,-4.7],[3.0,1.24,1.35],'paintedMetal',{color:'#304248'});
    light('V13_COVER_C_STRIP',[4.2,1.26,-4.05],[1.4,.05,.04],'#d39b5d',.72);
    mesh('V13_HALL_CRATE_A',[9.6,.46,2.3],[.92,.92,.92],'CRATE',.14,'#45575b');
    mesh('V13_HALL_CRATE_B',[10.4,.46,1.55],[.92,.92,.92],'CRATE',-.06,'#3b4c51');
    mesh('V13_HALL_SHELF',[-2.95,1.18,-3.3],[1.12,2.36,.56],'SHELF',Math.PI/2,'#304248');
    mesh('V13_HALL_DESK',[-2.65,.48,-1.15],[2.05,.96,.82],'DESK',Math.PI/2,'#35464a');
    // Functional dressing: ceiling service trunks, wall task lights and maintenance clutter.
    // These break up the large surfaces without narrowing the combat lanes.
    for(const x of [-2.9,3.6,10.1])add(`V14_HALL_DUCT_${x}`,[x,3.48,-.65],[.42,.28,10.6],'metal',{solid:false,color:'#42545a'});
    for(const z of [3.6,.2,-3.2]){
      light(`V14_HALL_WALL_LIGHT_W_${z}`,[-4.55,2.15,z],[.035,.72,.16],'#76d2d7',.80);
      light(`V14_HALL_WALL_LIGHT_E_${z}`,[11.85,2.15,z],[.035,.72,.16],z<0?'#d7a468':'#76d2d7',.76);
    }
    for(const x of [2.4,3.2,4.0,4.8,5.6])add(`V14_HALL_HAZARD_${x}`,[x,.052,-3.38],[.42,.015,1.05],'hazard',{solid:false,color:'#a87b2d',alpha:.58,ry:-.46});
    mesh('V14_HALL_BARREL_A',[10.85,.52,-4.55],[.62,1.04,.62],'BARREL',.05,'#4d5c60');
    mesh('V14_HALL_BARREL_B',[11.15,.52,-3.80],[.62,1.04,.62],'BARREL',-.10,'#59666a');
    add('V14_HALL_SIGN_BACK',[-4.54,2.72,-1.15],[.035,.62,1.60],'paintedMetal',{solid:false,color:'#1a2428'});
    light('V14_HALL_SIGN',[-4.50,2.72,-1.15],[.02,.42,1.25],'#7fd3d4',.42);
    // V14.02 authored wall/route dressing: imported lockers and service panels make the hall
    // read as an occupied facility instead of a black box while staying outside combat lanes.
    mesh('V14_HALL_LOCKER_E_A',[11.48,.95,3.35],[.76,1.90,.48],'LOCKER',-Math.PI/2,'#3d4f54');
    mesh('V14_HALL_LOCKER_E_B',[11.48,.95,2.25],[.76,1.90,.48],'LOCKER',-Math.PI/2,'#35474c');
    add('V14_HALL_PANEL_E_A',[11.87,1.65,.15],[.035,1.85,1.25],'paintedMetal',{solid:false,color:'#31464c'});
    add('V14_HALL_PANEL_E_B',[11.87,1.65,-1.55],[.035,1.85,1.25],'paintedMetal',{solid:false,color:'#2b3f45'});
    light('V14_HALL_PANEL_LED_A',[11.83,2.20,.15],[.025,.08,.76],'#7dd7d8',.46);
    light('V14_HALL_PANEL_LED_B',[11.83,2.20,-1.55],[.025,.08,.76],'#d0a060',.40);
    for(const z of [3.7,2.4,1.1,-.2,-1.5,-2.8])add(`V14_HALL_ROUTE_${z}`,[3.65,.055,z],[.16,.012,.72],'hazard',{solid:false,color:'#a67a2c',alpha:.50});
    // System Archaeology station: initially amber/unknown; turns green when the player proves the Q-Bot model.
    add('V13_ARCH_CONSOLE_BACK',[-2.50,1.28,-1.18],[.72,.72,.12],'paintedMetal',{solid:false,color:'#27383c'});
    light('V13_ARCH_CONSOLE_SCREEN',[-2.49,1.30,-1.10],[.54,.42,.035],'#d4a05f',.62);
    add('V13_ARCH_SPEAKER',[9.55,1.05,-3.45],[.32,.42,.18],'paintedMetal',{solid:false,color:'#36494e'});
    light('V13_ARCH_SPEAKER_LED',[9.55,1.08,-3.34],[.08,.05,.02],'#72dfe0',.60);
    // Mezzanine reads as built architecture rather than a floating slab.
    add('V13_MEZZ_FASCIA',[8.0,2.48,-10.18],[10.3,.42,.26],'paintedMetal',{color:'#34484e'});
    for(const x of [3.25,5.1,6.95,8.8,10.65,12.5]){
      add(`V13_MEZZ_RAIL_POST_${x}`,[x,3.25,-10.1],[.10,1.30,.10],'metal',{color:'#738285'});
    }
    add('V13_MEZZ_RAIL_TOP',[7.9,3.83,-10.1],[9.7,.10,.10],'metal',{color:'#738285'});
    add('V13_MEZZ_RAIL_MID',[7.9,3.28,-10.1],[9.7,.06,.08],'metal',{color:'#586a6e'});
    for(let i=0;i<6;i++){
      const x=2.72+i*.76,y=.14+i*.23;
      add(`V13_STAIR_TREAD_${i}`,[x,y+.07,-5.10],[.92,.13,2.05],'metal',{walkable:true,color:i%2?'#4b595c':'#3d4b4e'});
      light(`V13_STAIR_EDGE_${i}`,[x,y+.14,-4.12],[.62,.025,.03],'#c79b56',.40);
    }

    // --- A17 THRESHOLD ----------------------------------------------------
    add('V13_A17_FLOOR',[-5.2,.022,-9.55],[6.8,.04,4.0],'paintedMetal',{walkable:true,color:'#172428'});
    add('V13_A17_CEILING',[-5.2,3.45,-9.55],[6.8,.20,4.0],'paintedMetal',{color:'#111c20'});
    add('V13_A17_WALL_L',[-8.48,1.7,-9.55],[.20,3.40,4.0],'paintedMetal',{color:'#26383d'});
    add('V13_A17_WALL_R',[-1.92,1.7,-9.55],[.20,3.40,4.0],'paintedMetal',{color:'#26383d'});
    add('V13_A17_CANOPY',[-5.2,3.18,-10.83],[5.6,.22,.62],'paintedMetal',{color:'#34464b'});
    light('V13_A17_BAR',[-5.2,3.02,-10.66],[2.6,.045,.10],'#d39a59',.94);
    add('V13_A17_TERMINAL_BACK',[-2.23,1.10,-10.78],[.82,1.62,.18],'paintedMetal',{color:'#25363b'});
    add('V13_A17_TERMINAL_TRIM_TOP',[-2.23,1.92,-10.63],[.88,.08,.10],'metal',{color:'#657579'});
    add('V13_A17_TERMINAL_TRIM_BOTTOM',[-2.23,.28,-10.63],[.88,.08,.10],'metal',{color:'#657579'});
    mesh('V13_A17_SERVICE_CASE',[-7.35,.28,-9.10],[.74,.54,.88],'AMMO_BOX',.15,'#44565a');

    // --- BALLISTICS LAB ---------------------------------------------------
    // A real room around the existing three material panels.
    add('V13_BALL_FLOOR',[5.0,.018,-13.7],[8.2,.035,5.2],'paintedMetal',{walkable:true,color:'#19272b'});
    add('V13_BALL_CEILING',[5.0,3.36,-13.7],[8.2,.20,5.2],'paintedMetal',{color:'#111d21'});
    add('V13_BALL_WALL_L',[1.02,1.64,-13.7],[.20,3.28,5.2],'paintedMetal',{color:'#283a40'});
    add('V13_BALL_WALL_R',[8.98,1.64,-13.7],[.20,3.28,5.2],'paintedMetal',{color:'#283a40'});
    add('V13_BALL_BACK',[5.0,1.64,-16.26],[8.2,3.28,.20],'paintedMetal',{color:'#223238'});
    add('V13_BALL_ENTRY_L',[1.95,1.62,-11.15],[1.75,3.24,.24],'paintedMetal',{color:'#33464b'});
    add('V13_BALL_ENTRY_R',[8.05,1.62,-11.15],[1.75,3.24,.24],'paintedMetal',{color:'#33464b'});
    add('V13_BALL_ENTRY_HEADER',[5.0,3.04,-11.15],[8.2,.34,.24],'paintedMetal',{color:'#33464b'});
    for(const x of [3,5,7])light(`V13_BALL_TARGET_LIGHT_${x}`,[x,3.08,-15.45],[1.15,.04,.10],x===3?'#75ddef':x===5?'#d7b269':'#a6b0aa',.90);
    mesh('V13_BALL_SHELF',[8.25,1.18,-12.55],[1.12,2.36,.56],'SHELF',Math.PI/2,'#33464b');
    mesh('V13_BALL_CHAIR',[7.2,.55,-12.2],[.78,1.10,.78],'CHAIR',.18,'#344348');
    mesh('V13_BALL_CASE',[2.05,.28,-12.6],[.74,.54,.88],'AMMO_BOX',-.12,'#45575b');
    mesh('V13_BALL_MED',[7.75,.38,-13.6],[.24,.66,.24],'HEALTH_TUBE',0,'#76d2cf');
    add('V13_BALL_BENCH',[5.0,.54,-12.15],[2.20,1.08,.72],'paintedMetal',{color:'#304248'});
    add('V13_BALL_BENCH_TOP',[5.0,1.11,-12.15],[2.36,.08,.82],'metal',{color:'#56666a'});

    // Small authored floor seams: perspective cues without procedural wallpaper noise.
    for(const z of [15.2,13.4,11.6,8.4,6.2,3.0,0,-3,-6,-9.5,-12.2,-14.2]){
      add(`V13_FLOOR_SEAM_${z}`,[0,.048,z],[17.2,.012,.035],'metal',{solid:false,color:'#677477',alpha:.38});
    }

    return {objects:made,version:'V14_SYSTEM_ARCHAEOLOGY_02_VISUAL_POLISH'};
  }

  QQ.buildV13VerticalSlice=buildV13VerticalSlice;
})();
