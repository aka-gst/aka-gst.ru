// QueQuest «Лабиринт» levels: a compact level description (a few KB of JSON,
// loaded by the host only when that level is entered) becomes a full world for
// the same engine — collision boxes, walkable surfaces, ramps, launch pads,
// rift gates, pickups, spawns, a ring course — drawn with the game's own
// procedural parts and materials. No new assets.
//
// Grid: up to 14 x 16 cells of 4 m, centred on the stock arena footprint.
//   .  floor           #  wall (7 m)          o  pillar
//   1-5 deck, 1.2 m per step (1 = one jump, 2 = double jump, 3+ = pad/ramp/rocket)
//   c  crate (1.2 m cover you can stand on)
//   ^ v  ramp rising to the north (-z) / south (+z), between its two neighbours
//   N S E W  launch pad throwing you that way
// Lists (cells, may be fractional): spawns [[c,r]], start [c,r,yawQuarter],
// items [[kind,c,r]], course [[c,r,tip]], gates [[c,r,yawQuarter,to]],
// barrels [[c,r]], theme {wall,deck,accent}, sign 'TEXT'.
import {MAT,part,boxPart,lettering} from './world.mjs';
import {trs} from './renderer.mjs';
import {ARENA_MAT} from './arena_world.mjs';
import {floorHeight} from './core.mjs';
export const LEVEL_CELL=4,LEVEL_STEP=1.2,LEVEL_WALL=7,LEVEL_MAX_COLS=14,LEVEL_MAX_ROWS=16;
const LEVEL_CHARS='.#o12345c^vNSEW';
const ITEM_KINDS={health:'HEALTH',mega:'MEGA +100',armor:'ARMOR +100',quad:'QUAD x4',haste:'HASTE',carbine:'CARBINE',shotgun:'BREACHER',rail:'RAIL',rocket:'ROCKET',plasma:'PLASMA',lightning:'LIGHTNING'};
const AMMO_SLOT={carbine:0,shotgun:1,rail:2,rocket:3,plasma:4,lightning:5};
const qqMat=name=>MAT[name]||ARENA_MAT[name]||null;

// Shape check only: the host sends trusted files, but a bad one must not
// take the game down. Returns an error string or null.
export function levelError(d){
 if(!d||typeof d!=='object')return 'нет описания';
 const g=d.grid;if(!Array.isArray(g)||g.length<3||g.length>LEVEL_MAX_ROWS)return 'сетка: строк 3..'+LEVEL_MAX_ROWS;
 const w=g[0]?.length;if(!(w>=3&&w<=LEVEL_MAX_COLS))return 'сетка: столбцов 3..'+LEVEL_MAX_COLS;
 for(const row of g){if(typeof row!=='string'||row.length!==w)return 'сетка: строки разной длины';for(const ch of row)if(!LEVEL_CHARS.includes(ch))return 'сетка: неизвестный знак '+ch;}
 const cell=v=>Array.isArray(v)&&Number.isFinite(v[0])&&Number.isFinite(v[1])&&v[0]>=0&&v[0]<=w-1&&v[1]>=0&&v[1]<=g.length-1;
 if(!Array.isArray(d.spawns)||d.spawns.length<2||!d.spawns.every(cell))return 'нужно хотя бы 2 точки появления';
 if(!cell(d.start))return 'нет старта';
 for(const key of ['items','course','gates','barrels'])if(d[key]!==undefined&&!(Array.isArray(d[key])&&d[key].length<=40))return key+': не список';
 for(const it of d.items||[])if(!ITEM_KINDS[it?.[0]]||!cell(it.slice(1)))return 'items: '+it?.[0];
 for(const c of d.course||[])if(!cell(c))return 'course: точка вне сетки';
 for(const c of d.barrels||[])if(!cell(c))return 'barrels: точка вне сетки';
 if((d.gates||[]).length%2)return 'gates: нужны пары';
 for(const c of d.gates||[])if(!cell(c)||!Number.isInteger(c[3])||c[3]<0||c[3]>=d.gates.length)return 'gates: неверный выход';
 const at=(c,r)=>g[Math.round(r)]?.[Math.round(c)];
 if(at(...d.start)==='#'||at(...d.start)==='o')return 'старт в стене';
 for(const s of d.spawns)if(at(...s)==='#'||at(...s)==='o')return 'появление в стене';
 for(const c of d.course||[])if(at(c[0],c[1])==='#'||at(c[0],c[1])==='o')return 'кольцо в стене';
 for(const it of d.items||[])if(at(it[1],it[2])==='#'||at(it[1],it[2])==='o')return 'предмет в стене';
 return null;
}

export function buildLevel(d){
 const err=levelError(d);if(err)throw new Error('уровень: '+err);
 const g=d.grid,rows=g.length,cols=g[0].length,C=LEVEL_CELL;
 const ox=-(cols-1)/2*C,oz=-3-(rows-1)/2*C;
 const X=c=>ox+c*C,Z=r=>oz+r*C;
 const list=[],boxes=[],surfaces=[];
 const theme=d.theme||{},wallMat=qqMat(theme.wall)||MAT.concrete,deckMat=qqMat(theme.deck)||MAT.dark,accent=qqMat(theme.accent)||MAT.cyan;
 const add=(x,y,z,w,h,dd,mat,solid,bevel=false)=>{boxPart(list,x,y,z,w,h,dd,mat,0,null,bevel);if(solid)boxes.push({x0:x-w/2,x1:x+w/2,y0:y-h/2,y1:y+h/2,z0:z-dd/2,z1:z+dd/2});};
 const H=ch=>ch>='1'&&ch<='5'?(ch.charCodeAt(0)-48)*LEVEL_STEP:ch==='c'?LEVEL_STEP:0;
 const heightAt=(c,r)=>{const ch=g[r]?.[c];return ch===undefined||ch==='#'||ch==='o'?null:H(ch);};
 // Ground slab under everything (plus a margin, like the stock arena).
 add(0,-.3,oz+(rows-1)/2*C,cols*C+8,.6,rows*C+8,{c:MAT.floor.c,s:[2,.30,.5,16]},false);
 for(let r=0;r<rows;r++){
  let c=0;
  while(c<cols){
   const ch=g[r][c];let n=1;while(c+n<cols&&g[r][c+n]===ch&&'#12345c'.includes(ch))n++;
   const x=X(c+(n-1)/2),z=Z(r),w=n*C;
   if(ch==='#'){add(x,LEVEL_WALL/2,z,w,LEVEL_WALL,C,wallMat,true,true);surfaces.push({x0:x-w/2,x1:x+w/2,z0:z-C/2,z1:z+C/2,y:LEVEL_WALL});add(x,LEVEL_WALL+.04,z,w-.4,.08,.18,accent,false);}
   else if(ch==='o'){add(x,LEVEL_WALL/2,z,1.3,LEVEL_WALL,1.3,MAT.steel,true,true);add(x,2.2,z,1.36,.12,1.36,accent,false);}
   else if(ch>='1'&&ch<='5'){const h=H(ch);add(x,h/2-.12,z,w,h+.24,C,deckMat,true,true);add(x,h+.025,z,w,.06,C,{c:MAT.floor.c,s:[2,.31,.45,w/4]},false);surfaces.push({x0:x-w/2,x1:x+w/2,z0:z-C/2,z1:z+C/2,y:h});add(x,h-.2,z+C/2+.01,w,.07,.04,MAT.amber,false);add(x,h-.2,z-C/2-.01,w,.07,.04,MAT.amber,false);}
   else if(ch==='c'){const h=LEVEL_STEP;for(let k=0;k<n;k++){const cx=X(c+k);add(cx,h/2,z,C*.8,h,C*.8,MAT.dark,true,true);surfaces.push({x0:cx-C*.4,x1:cx+C*.4,z0:z-C*.4,z1:z+C*.4,y:h});add(cx,h+.05,z,C*.82,.1,C*.82,MAT.steel,false);add(cx,.7,z+C*.41,C*.6,.22,.03,MAT.orange,false);}}
   else if(ch==='^'||ch==='v'){
    const nH=heightAt(c,r-1)??0,sH=heightAt(c,r+1)??0,lo=ch==='^'?sH:nH;let top=ch==='^'?nH:sH;if(top<=lo)top=lo+LEVEL_STEP;
    const rise=top-lo;part(list,'ramp',trs(x,lo+rise/2,z,C,rise,C,0,ch==='^'?0:Math.PI,0),{c:MAT.floor.c,s:[2,.5,.4,2]});
    if(lo>0)add(x,lo/2-.12,z,C,lo+.24,C,deckMat,true);
    surfaces.push(ch==='^'?{x0:x-C/2,x1:x+C/2,z0:z-C/2,z1:z+C/2,y0:top,y1:lo,ramp:'z'}:{x0:x-C/2,x1:x+C/2,z0:z-C/2,z1:z+C/2,y0:lo,y1:top,ramp:'z'});
   }
   c+=n;
  }
 }
 // Outer walls so nothing leaves the grid.
 const W=cols*C,D=rows*C,cz=oz+(rows-1)/2*C;
 for(const s of [-1,1]){add(s*(W/2+1),LEVEL_WALL/2,cz,2,LEVEL_WALL,D+4,wallMat,true);add(0,LEVEL_WALL/2,cz+s*(D/2+1),W+4,LEVEL_WALL,2,wallMat,true);}
 const groundAt=(c,r)=>floorHeight(X(c),Z(r),surfaces);
 // Launch pads: up and over toward their letter.
 const pads=[];const dir={N:[0,-1],S:[0,1],E:[1,0],W:[-1,0]};
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const ch=g[r][c];if(!dir[ch])continue;const [dx,dz]=dir[ch];pads.push({x:X(c),y:0,z:Z(r),vx:dx*8,vy:16,vz:dz*8,name:'LIFT'});}
 for(const p of pads){part(list,'cyl',trs(p.x,p.y+.08,p.z,2.65,.16,2.65),MAT.black);part(list,'cyl',trs(p.x,p.y+.18,p.z,2.35,.12,2.35),ARENA_MAT.grate);part(list,'torus',trs(p.x,p.y+.27,p.z,2.18,.34,2.18),MAT.amber);}
 const gates=(d.gates||[]).map(([c,r,q,to])=>({x:X(c),y:groundAt(c,r),z:Z(r),yaw:q*Math.PI/2,to}));
 for(const p of gates){const parent=trs(p.x,p.y,p.z,1,1,1,0,p.yaw);part(list,'torus',trs(0,1.65,0,3.05,1.1,3.05,Math.PI/2),ARENA_MAT.gold,parent);part(list,'torus',trs(0,1.65,.07,2.72,.35,2.72,Math.PI/2),MAT.violet,parent);}
 const stations=(d.items||[]).map(([kind,c,r])=>{const s={kind:AMMO_SLOT[kind]!==undefined?'ammo':kind,x:X(c),y:groundAt(c,r),z:Z(r),label:ITEM_KINDS[kind],ready:0};if(AMMO_SLOT[kind]!==undefined)s.weapon=AMMO_SLOT[kind];return s;});
 for(const s of stations){part(list,'cyl',trs(s.x,s.y+.04,s.z,1.65,.08,1.65),MAT.black);part(list,'torus',trs(s.x,s.y+.095,s.z,1.35,.22,1.35),MAT.steel);}
 if(typeof d.sign==='string'&&d.sign)lettering(list,d.sign.toUpperCase().replace(/[^A-Z0-9 -]/g,'').slice(0,18),0,LEVEL_WALL-1.2,oz-C/2-.05,.32,accent);
 const spawns=d.spawns.map(([c,r])=>[X(c),groundAt(c,r),Z(r)]);
 const course=(d.course||[]).map(([c,r,tip])=>({x:X(c),y:groundAt(c,r),z:Z(r),tip:String(tip||'').slice(0,80)}));
 const barrels=(d.barrels||[]).map(([c,r])=>({x:X(c),y:groundAt(c,r),z:Z(r),hp:40}));
 const [sc,sr,sq=0]=d.start;
 return{list,boxes,surfaces,relays:[],barrels,pads,gates,stations,spawns,course,bounds:{x0:-W/2,x1:W/2,z0:cz-D/2,z1:cz+D/2},start:{x:X(sc),y:groundAt(sc,sr),z:Z(sr),yaw:sq*Math.PI/2},qqLevel:true};
}
