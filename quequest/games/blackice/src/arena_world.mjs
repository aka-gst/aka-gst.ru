import {part,boxPart,MAT,lettering} from './world.mjs';
import {trs,beamMatrix} from './renderer.mjs';
export const ARENA_MAT={stone:{c:[.43,.39,.51,0],s:[4,.63,.17,1]},grate:{c:[.38,.44,.53,0],s:[5,.30,.75,2]},gold:{c:[.45,.28,.39,0],s:[0,.3,.76,1]}};
export function addArenaFeatures(w){
 const a=w.list,box=(x,y,z,sx,sy,sz,mat=MAT.dark,solid=false)=>{boxPart(a,x,y,z,sx,sy,sz,mat,0,null,Math.min(sx,sy,sz)>.35);if(solid)w.boxes.push({x0:x-sx/2,x1:x+sx/2,y0:y-sy/2,y1:y+sy/2,z0:z-sz/2,z1:z+sz/2});};
 w.bounds={x0:-29.5,x1:29.5,z0:-35.4,z1:31.4};
 // A real overhead bridge: slab collider, top support, empty traversable space below.
 box(0,4.23,-3.6,40,.34,3.6,ARENA_MAT.grate,true);w.surfaces.push({x0:-20,x1:20,z0:-5.4,z1:-1.8,y:4.4});
 for(const side of [-1,1]){
  box(side*20.5,4.12,-5.5,5,.26,4.2,MAT.steel,true);w.surfaces.push({x0:side*20.5-2.5,x1:side*20.5+2.5,z0:-7.6,z1:-3.4,y:4.25});
  // Long flat wall faces are deliberately unobstructed for running and kicking off.
  box(side*26,3.7,5,.5,7.4,27,ARENA_MAT.stone,true);
  box(side*25.72,2.1,5,.07,.09,26,MAT.cyan);box(side*25.72,5.4,5,.07,.08,26,MAT.amber);
  for(let z=-6;z<17;z+=4){box(side*25.68,3.65,z,.04,.15,1.7,MAT.white);box(side*25.67,3.95,z,.04,.07,.7,MAT.orange);}
  for(const z of [-5.34,-1.86]){box(side*11,4.55,z,15,.05,.06,MAT.amber);for(let x=5;x<19;x+=3){box(side*x,4.88,z,.07,.94,.07,MAT.steel);}box(side*11,5.31,z,15,.07,.07,MAT.steel);}
  box(side*13.5,2,-3.6,.6,4,1.3,ARENA_MAT.stone,true);
  part(a,'bevel',beamMatrix([side*13.5,1.2,-3.6],[side*8.5,4.1,-3.6],.31),MAT.steel);
  // Warm stone/brass bays and inset panels add contrast against the blue machine.
  for(let z=-28;z<=22;z+=10){box(side*29.55,6.6,z, .12,1.8,5.4,ARENA_MAT.stone);box(side*29.46,7.65,z,.14,.16,6.1,ARENA_MAT.gold);}
 }
 lettering(a,'OVERDRIVE',0,3.52,-1.76,.14,MAT.white);lettering(a,'ARENA 09',0,2.99,-1.75,.075,MAT.amber);
 // Three launch pads. Their impulses are real and feed the same player controller.
 w.pads=[{x:-10,y:0,z:16,vx:-9,vy:16,vz:-15,name:'SKYLINE'}, {x:10,y:0,z:16,vx:9,vy:16,vz:-15,name:'SKYLINE'}, {x:0,y:0,z:-21,vx:0,vy:17,vz:-9,name:'CROWN'}];
 for(const p of w.pads){part(a,'cyl',trs(p.x,p.y+.08,p.z,2.65,.16,2.65),MAT.black);part(a,'cyl',trs(p.x,p.y+.18,p.z,2.35,.12,2.35),ARENA_MAT.grate);part(a,'torus',trs(p.x,p.y+.27,p.z,2.18,.34,2.18),MAT.amber);for(let i=0;i<3;i++){const z=p.z+.4-i*.5;for(const side of [-1,1])part(a,'bevel',beamMatrix([p.x+side*.55,p.y+.26,z+.22],[p.x,p.y+.26,z-.14],.1),MAT.cyan);}lettering(a,'LAUNCH',p.x,p.y+.35,p.z+1.39,.045,MAT.white);}
 // Gate exit is offset in its forward direction. Cooldown prevents ping-pong.
 w.gates=[{x:-24,y:0,z:25,yaw:0,to:1},{x:20.5,y:6,z:-30,yaw:Math.PI,to:0}];
 for(const p of w.gates){const parent=trs(p.x,p.y,p.z,1,1,1,0,p.yaw);part(a,'torus',trs(0,1.65,0,3.05,1.1,3.05,Math.PI/2),ARENA_MAT.gold,parent);part(a,'torus',trs(0,1.65,.07,2.72,.35,2.72,Math.PI/2),MAT.violet,parent);boxPart(a,p.x,p.y+.10,p.z,3.4,.2,1.7,ARENA_MAT.stone);for(let j=0;j<8;j++){const angle=j*Math.PI/4;part(a,'bevel',trs(Math.sin(angle)*1.66,1.65+Math.cos(angle)*1.66,0,.39,.45,.5,0,0,-angle),ARENA_MAT.stone,parent);}lettering(a,'RIFT',p.x,p.y+3.7,p.z,.075,MAT.violet,p.yaw);}
 w.stations=[{kind:'quad',x:0,y:4.4,z:-3.6,label:'QUAD x4'}, {kind:'mega',x:0,y:6,z:-32.3,label:'MEGA +100'}, {kind:'armor',x:-20.5,y:4,z:-14,label:'ARMOR +100'}, {kind:'haste',x:20.5,y:4,z:-11,label:'HASTE'}, {kind:'ammo',weapon:3,x:0,y:0,z:18,label:'ROCKET'}, {kind:'ammo',weapon:2,x:-20.5,y:6,z:-28,label:'RAIL'}, {kind:'ammo',weapon:4,x:12,y:0,z:-12,label:'PLASMA'}, {kind:'ammo',weapon:5,x:-11,y:0,z:-22,label:'LIGHTNING'}, {kind:'health',x:-4,y:0,z:27,label:'HEALTH'}, {kind:'health',x:24,y:0,z:25,label:'HEALTH'}];
 for(const s of w.stations){s.ready=0;part(a,'cyl',trs(s.x,s.y+.04,s.z,1.65,.08,1.65),MAT.black);part(a,'torus',trs(s.x,s.y+.095,s.z,1.35,.22,1.35),MAT.steel);lettering(a,s.label.toUpperCase().replace(' X4',' 4'),s.x,s.y+.16,s.z+.87,.039,MAT.white);}
 w.spawns=[[-8,0,18],[10,0,5],[-12,0,-18],[0,6,-28],[20.5,4,-14],[-20.5,4,-14],[20.5,6,-29],[-20.5,6,-29],[4,0,25],[-20,0,20]];
 w.course=[{x:0,y:0,z:18,tip:'WASD: разгон. Space: держи для баннихопа.'},{x:-10,y:0,z:16,tip:'Встань на оранжевый джамп-пад.'},{x:-20.5,y:4,z:-12,tip:'Приземлись на верхнюю левую площадку.'},{x:-20.5,y:6,z:-28,tip:'Заберись выше: второй прыжок — ещё раз Space.'},{x:0,y:6,z:-30,tip:'По верхней галерее — к MEGA.'},{x:20.5,y:6,z:-29,tip:'Портал вернёт тебя в переднюю часть арены.'},{x:-24,y:0,z:25,tip:'Дальше разгон + подкат: C или Ctrl.'},{x:0,y:4.4,z:-3.6,tip:'На мост: двойной прыжок или рокет-джамп X.'},{x:0,y:0,z:25,tip:'Финиш. Сохраняй скорость до последнего кольца.'}];
 return w;
}
export function arenaDecor(w,t,mode,courseIndex=0){const a=[];
 for(const p of w.pads){part(a,'ring',trs(p.x,p.y+.31,p.z,1.75,.13,1.75,0,t),MAT.cyan);for(let j=0;j<3;j++){const phase=(t*.75+j/3)%1;part(a,'ring',trs(p.x,p.y+.35+phase*.85,p.z,1.35-phase*.6,.10,1.35-phase*.6),{c:[.18,.63,1,(1-phase)*1.5],s:[-1,.6,0,1]});}}
 for(const p of w.gates){for(let j=0;j<3;j++)part(a,'ring',trs(p.x,p.y+1.65,p.z,.55+j*.75,.15,.55+j*.75,Math.PI/2,t*.24,Math.sin(t+j)*.05),MAT.violet);for(let j=0;j<12;j++){const ang=t*1.8+j*Math.PI/6;part(a,'sphere',trs(p.x+Math.sin(ang)*1.15,p.y+1.65+Math.cos(ang)*1.15,p.z,.06,.06,.06),MAT.cyan);}}
 if(mode!=='mission')for(const s of w.stations){const waiting=s.ready>t,y=s.y+1.0+Math.sin(t*2+s.x)*.12,mat=s.kind==='quad'?MAT.violet:s.kind==='mega'||s.kind==='health'?MAT.cyan:s.kind==='haste'?MAT.green:MAT.amber;
  part(a,'ring',trs(s.x,s.y+.13,s.z,1.43,.18,1.43,0,t*.2),waiting?MAT.dark:mat);if(waiting)continue;
  if(s.kind==='quad'){for(const d of [-1,1]){part(a,'bevel',trs(s.x+d*.2,y,s.z,.15,.8,.2,0,t,d*.24),mat);part(a,'bevel',trs(s.x,y-.16,s.z,.6,.16,.2,0,t),mat);}part(a,'torus',trs(s.x,y,s.z,1.15,.20,1.15,Math.PI/2,t),MAT.steel);}
  else if(s.kind==='mega'||s.kind==='health'){part(a,'bevel',trs(s.x,y,s.z,.64,.24,.21,0,t),mat);part(a,'bevel',trs(s.x,y,s.z,.23,.68,.21,0,t),mat);}
  else if(s.kind==='armor'){part(a,'bevel',trs(s.x,y,s.z,.72,.83,.28,0,t),ARENA_MAT.gold);part(a,'bevel',trs(s.x,y+.03,s.z,.15,.64,.33,0,t),MAT.amber);}
  else if(s.kind==='haste'){for(const d of [-1,1])part(a,'bevel',trs(s.x+d*.09,y+d*.20,s.z,.22,.56,.15,0,t,-.4),mat);}
  else{part(a,'bevel',trs(s.x,y,s.z,.58,.38,.43,0,t),MAT.dark);for(const d of [-1,0,1])part(a,'cyl',trs(s.x+d*.14,y+.06,s.z,.10,.5,.10,0,t),mat);}
 }
 if(mode==='training'){const q=w.course[courseIndex];if(q){part(a,'torus',trs(q.x,q.y+1.4,q.z,2.3,.3,2.3,Math.PI/2,0,t*.16),MAT.green);part(a,'ring',trs(q.x,q.y+1.4,q.z,2.65,.1,2.65,Math.PI/2),MAT.white);}}
 return a;}
