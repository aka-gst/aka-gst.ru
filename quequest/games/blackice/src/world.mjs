import {makeRng,clamp} from './core.mjs';
import {trs,mul,beamMatrix,ident} from './renderer.mjs';
export const MAT={
 concrete:{c:[.44,.43,.53,0],s:[1,.79,.12,2]},dark:{c:[.25,.27,.36,0],s:[0,.38,.65,1]},steel:{c:[.52,.57,.66,0],s:[0,.29,.79,1]},floor:{c:[.42,.47,.57,0],s:[2,.25,.54,1]},black:{c:[.09,.11,.17,0],s:[-1,.36,.64,1]},white:{c:[.78,.79,.85,0],s:[3,.35,.44,1]},red:{c:[.69,.085,.21,0],s:[3,.36,.5,1]},orange:{c:[.92,.34,.12,0],s:[-1,.32,.48,1]},cyan:{c:[.035,.88,1,2.4],s:[-1,.2,.2,1]},amber:{c:[1,.27,.045,2.8],s:[-1,.22,.1,1]},violet:{c:[.72,.085,1,3.2],s:[-1,.2,.1,1]},green:{c:[.13,1,.58,2.7],s:[-1,.2,.1,1]},ink:{c:[.07,.095,.13,0],s:[-1,.8,.1,1]}
};
export function part(list,g,m,mat=MAT.dark,parent=null){list.push({g,m:parent?mul(parent,m):m,c:mat.c,s:mat.s});}
export function boxPart(list,x,y,z,w,h,d,mat=MAT.dark,ry=0,parent=null,bevel=false){part(list,bevel?'bevel':'box',trs(x,y,z,w,h,d,0,ry,0),mat,parent);}
const SEGMENTS={A:[14,17,17,31,17,17,17],B:[30,17,17,30,17,17,30],C:[15,16,16,16,16,16,15],D:[30,17,17,17,17,17,30],E:[31,16,16,30,16,16,31],F:[31,16,16,30,16,16,16],G:[15,16,16,23,17,17,15],H:[17,17,17,31,17,17,17],I:[31,4,4,4,4,4,31],J:[7,2,2,2,18,18,12],K:[17,18,20,24,20,18,17],L:[16,16,16,16,16,16,31],M:[17,27,21,21,17,17,17],N:[17,25,25,21,19,19,17],O:[14,17,17,17,17,17,14],P:[30,17,17,30,16,16,16],Q:[14,17,17,17,21,18,13],R:[30,17,17,30,20,18,17],S:[15,16,16,14,1,1,30],T:[31,4,4,4,4,4,4],U:[17,17,17,17,17,17,14],V:[17,17,17,17,17,10,4],W:[17,17,17,21,21,21,10],X:[17,17,10,4,10,17,17],Y:[17,17,10,4,4,4,4],Z:[31,1,2,4,8,16,31],'0':[14,17,19,21,25,17,14],'1':[4,12,4,4,4,4,14],'2':[14,17,1,2,4,8,31],'3':[30,1,1,14,1,1,30],'4':[2,6,10,18,31,2,2],'5':[31,16,16,30,1,1,30],'6':[14,16,16,30,17,17,14],'7':[31,1,2,4,8,8,8],'8':[14,17,17,14,17,17,14],'9':[14,17,17,15,1,1,14],'-':[0,0,0,31,0,0,0]};
export function lettering(list,text,x,y,z,size=.13,mat=MAT.white,ry=0){const parent=trs(x,y,z,1,1,1,0,ry,0),offset=-(text.length*6-1)*size/2;[...text].forEach((ch,k)=>{const rows=SEGMENTS[ch];if(!rows)return;rows.forEach((bits,j)=>{for(let i=0;i<5;){if(!(bits&(16>>i))){i++;continue;}let n=1;while(i+n<5&&(bits&(16>>(i+n))))n++;part(list,'quad',trs(offset+(k*6+i+(n-1)*.5)*size,(3-j)*size,0,size*n*.93,size*.86,1),mat,parent);i+=n;}});});}
export function makeWorld(){const list=[],boxes=[],surfaces=[],rand=makeRng(202696);const add=(x,y,z,w,h,d,mat=MAT.concrete,solid=false,ry=0)=>{boxPart(list,x,y,z,w,h,d,mat,ry,null,(mat===MAT.concrete||mat===MAT.dark)&&Math.min(w,h,d)>.65);if(solid)boxes.push({x0:x-w/2,x1:x+w/2,y0:y-h/2,y1:y+h/2,z0:z-d/2,z1:z+d/2});};
 const deck=(x,z,w,d,h)=>{add(x,h/2-.12,z,w,h+.24,d,MAT.dark,true);add(x,h+.025,z,w,.06,d,{c:MAT.floor.c,s:[2,.31,.45,w/4]});surfaces.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,y:h});};
 const rail=(a,b)=>{part(list,'cyl',beamMatrix(a,b,.09),MAT.steel);part(list,'cyl',beamMatrix(a.map((v,i)=>v-(i===1?.55:0)),b.map((v,i)=>v-(i===1?.55:0)),.055),MAT.steel);const len=Math.hypot(...a.map((v,i)=>v-b[i])),n=Math.ceil(len/3);for(let j=0;j<=n;j++){const p=a.map((v,i)=>v+(b[i]-v)*j/n);add(p[0],p[1]-.55,p[2],.11,1.1,.11,MAT.steel);}};
 add(0,-.3,-3,64,.6,74,{c:MAT.floor.c,s:[2,.30,.5,16]});
 // Monolithic retaining walls and repeated structural bays.
 for(const side of [-1,1]){
  add(side*31,4,-3,2,8,74,MAT.concrete,true);add(side*29.85,1,-3,.22,1.8,73,MAT.dark);add(side*29.7,2.06,-3,.10,.075,72,MAT.amber);
  for(let z=-34;z<=27;z+=10){add(side*29.4,6,z,2.2,12,2.4,MAT.concrete,true);add(side*28.2,3.5,z,.3,6.3,1.9,MAT.dark);add(side*27.98,5,z,.12,5.1,.16,MAT.cyan);add(side*29.4,12,z,3.5,.5,3.4,MAT.steel);for(const s of [-1,1])add(side*28.04,2.8,z+s*.69,.14,.14,.14,MAT.steel);}
  for(let z=-29;z<26;z+=10){add(side*29.82,4,z,.13,3.2,6.3,MAT.dark);for(let k=0;k<5;k++)add(side*29.70,3.2+k*.42,z,.14,.16,5.5,MAT.steel);}
 }
 add(0,8,-37,64,16,2,MAT.concrete,true);add(0,15.4,-35.7,64,.7,.5,MAT.dark);add(0,14.9,-35.3,42,.08,.1,MAT.cyan);add(-21,4,33,22,8,2,MAT.concrete,true);add(21,4,33,22,8,2,MAT.concrete,true);boxes.push({x0:-40,x1:40,y0:-4,y1:30,z0:33,z1:40});
 lettering(list,'NIGHTFALL',0,12.3,-35.85,.38,MAT.cyan);lettering(list,'DISTRICT - 09',0,9.3,-35.8,.14,MAT.violet);
 // Walkable upper decks. Each ramp's visible slope and physical height agree.
 for(const s of [-1,1]){
  deck(s*20.5,-13,9,14,4);deck(s*20.5,-29,9,10,6);
  part(list,'ramp',trs(s*20.5,2,4,7,4,20),{c:MAT.floor.c,s:[2,.5,.4,4]});surfaces.push({x0:s*20.5-3.5,x1:s*20.5+3.5,z0:-6,z1:14,y0:4,y1:0,ramp:'z'});
  part(list,'ramp',trs(s*20.5,5,-22,7,2,4),{c:MAT.floor.c,s:[2,.5,.4,2]});surfaces.push({x0:s*20.5-3.5,x1:s*20.5+3.5,z0:-24,z1:-20,y0:6,y1:4,ramp:'z'});
  for(let j=0;j<25;j++){const z=13.6-j*.78,y=(14-z)*.2;add(s*20.5,y+.035,z,6.95,.045,.055,MAT.steel);}
  rail([s*25.1,5,-20],[s*25.1,5,-5.5]);rail([s*16,5,-19],[s*16,5,-7]);rail([s*24,1,14],[s*24,5,-6]);rail([s*17,1,14],[s*17,5,-6]);
  add(s*20.5,10,-15,11,.7,16,MAT.dark);for(let z=-21;z<=-9;z+=6){add(s*25.6,7,z,.55,6,.65,MAT.steel);add(s*20.5,9.5,z,9,.14,.15,MAT.amber);}
 }
 deck(0,-29,33,10,6);rail([-16,7,-24],[16,7,-24]);
 // Central machine and cathedral-like portal framing.
 add(0,1.2,-10,7.8,2.4,7.5,MAT.dark,true);surfaces.push({x0:-3.9,x1:3.9,z0:-13.75,z1:-6.25,y:2.4});
 for(let i=0;i<3;i++)part(list,'cyl',trs(0,2.5+i*.28,-10,8.8-i*.7,.22,8.8-i*.7),i===1?MAT.amber:MAT.steel);
 part(list,'cyl',trs(0,4,-10,3.4,3.2,3.4),MAT.dark);part(list,'cyl',trs(0,4.2,-10,2.7,3.5,2.7),MAT.cyan);
 for(let i=0;i<10;i++){const a=i*Math.PI/5;add(Math.sin(a)*1.8,4.1,-10+Math.cos(a)*1.8,.3,3.6,.34,MAT.steel);}
 for(const s of [-1,1]){
  add(s*6,6.5,-11,1.6,13,2.2,MAT.concrete,true);add(s*5.11,7.2,-9.95,.16,9.5,.1,MAT.cyan);add(s*6,13,-11,3.2,.65,3.1,MAT.steel);
  part(list,'box',beamMatrix([s*6,13,-11],[s*3.1,15.1,-11],.9),MAT.concrete);add(s*7.2,.5,-8.8,1.3,1,4.4,MAT.dark,true);
 }
 add(0,15.12,-11,6.8,.65,2.2,MAT.concrete);add(0,14.69,-9.85,5.2,.085,.10,MAT.amber);
 part(list,'torus',trs(0,8.5,-10,11.2,2.5,11.2,Math.PI/2),MAT.dark);part(list,'ring',trs(0,8.5,-9.95,9.3,.22,9.3,Math.PI/2),MAT.cyan);
 for(let i=0;i<16;i++){const a=i*Math.PI/8;part(list,'bevel',trs(Math.sin(a)*5.65,8.5+Math.cos(a)*5.65,-9.75,1.22,.95,1.05,0,0,-a),i%4===0?MAT.orange:MAT.steel);part(list,'box',trs(Math.sin(a)*5.62,8.5+Math.cos(a)*5.62,-9.16,.42,.12,.04,0,0,-a),MAT.white);}
 lettering(list,'KEEP CLEAR',0,.32,3.8,.12,MAT.orange,-Math.PI/2); // Small industrial markings and caution edging.
 // Low cover and cargo: useful in combat, not only decoration.
 for(const [x,z,w,d,h] of [[-8,7,4.5,2,1.2],[8,12,4.3,2,1.3],[-11,-7,3.6,2.4,1.7],[10,-17,4.2,2.2,1.4],[-10,22,2.5,2.5,2.1],[12,-1,2.8,2.8,1.3]]){
  add(x,h/2,z,w,h,d,MAT.dark,true);surfaces.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,y:h});add(x,h+.055,z,w+.08,.11,d+.08,MAT.steel);add(x,.18,z,w+.24,.28,d+.24,MAT.black);for(const side of [-1,1]){add(x,.7,z+side*(d/2+.015),w-.5,.24,.035,MAT.orange);for(let k=0;k<Math.floor(w/.55);k++)add(x-w/2+.4+k*.55,.7,z+side*(d/2+.04),.22,.25,.025,MAT.black);}for(const a of [-1,1])for(const b of [-1,1])add(x+a*(w/2-.13),h*.5,z+b*(d/2+.03),.15,h*.68,.05,MAT.steel);
 }
 // Recessed floor channels and guidance strips.
 for(const x of [-14,14]){add(x,.016,4,.52,.018,40,MAT.black);for(let z=-15;z<25;z+=2){add(x,.034,z,.17,.019,1.16,MAT.cyan);add(x-.2,.027,z,.04,.025,1.55,MAT.steel);add(x+.2,.027,z,.04,.025,1.55,MAT.steel);}}
 for(const z of [-4,19])for(const s of [-1,1])add(s*8,.045,z,7.6,.025,.1,MAT.orange);
 // Pipes, cable runs, overhead beams, ventilation and external silhouettes.
 for(const s of [-1,1]){
  for(let j=0;j<3;j++){part(list,'cyl',trs(s*(27.3+j*.5),2.4,-2,.27,61,.27,Math.PI/2),MAT.steel);for(let z=-29;z<28;z+=5)add(s*(27.3+j*.5),2.4,z,.39,.42,.19,MAT.dark);}
  for(let k=0;k<3;k++){const z=11-k*18;for(let j=0;j<6;j++){const x0=-28+j*9.33,x1=x0+9.33,y0=13-Math.sin(j/6*Math.PI)*2,y1=13-Math.sin((j+1)/6*Math.PI)*2;part(list,'cyl',beamMatrix([x0,y0,z],[x1,y1,z],.09),MAT.black);}}
  for(let j=0;j<6;j++){const x=s*(36+rand()*35),z=-52+rand()*90,h=14+rand()*42;add(x,h/2-5,z,5+rand()*7,h,7+rand()*6,MAT.dark);add(x,h-4,z,2,.6,2,MAT.orange);for(let k=0;k<5;k++)add(x-s*3,h*.25+k*3,z+4,.1,.12,1.3,MAT.amber);}
 }
 for(const s of [-1,1]){add(s*13,4.7,25,1.4,9.4,2.5,MAT.concrete,true);part(list,'box',beamMatrix([s*13,9,25],[s*8.5,12,25],1.0),MAT.concrete);add(s*10.7,10.3,24.1,4,.16,.2,MAT.amber, false,s*.55);}add(0,12,25,18,.7,2.5,MAT.dark);
 const relays=[{x:-20.5,y:0,z:18,name:'01 / ПОДАЧА'},{x:20.5,y:4,z:-12,name:'02 / ОХЛАЖДЕНИЕ'},{x:0,y:6,z:-30,name:'03 / ЯДРО'}];
 for(let i=0;i<3;i++){const p=relays[i];add(p.x,p.y+.6,p.z,1.2,1.2,.85,MAT.dark,true);part(list,'bevel',trs(p.x,p.y+1.3,p.z,.95,.62,.12,-.24),MAT.steel);add(p.x,p.y+1.28,p.z+.10,.76,.43,.045,MAT.black);lettering(list,'0'+(i+1),p.x,p.y+1.32,p.z+.14,.045,MAT.cyan);add(p.x,p.y+.04,p.z,2.4,.05,2.4,MAT.black);part(list,'torus',trs(p.x,p.y+.08,p.z,2.1,.18,2.1),MAT.amber);}
 const barrels=[{x:-11,y:0,z:4,hp:40},{x:12,y:0,z:6,hp:40},{x:-12,y:0,z:-18,hp:40},{x:21,y:4,z:-17,hp:40}];
 return{list,boxes,surfaces,relays,barrels};
}
export function reactorModel(t,mission){const a=[];part(a,'sphere',trs(0,8.5,-10,2.8,2.8,2.8,0,t*.35),mission.phase==='extract'?MAT.green:MAT.cyan);for(let i=0;i<3;i++)part(a,i===1?'ring':'torus',trs(0,8.5,-10,4+i*.7,.44,4+i*.7,Math.PI/2+i*.5,t*(i%2?-.2:.2),i*.7),i===1?MAT.amber:MAT.steel);return a;}
export function barrelModel(b){const a=[];if(b.dead)return a;part(a,'cyl',trs(b.x,b.y+.65,b.z,.87,1.25,.87),MAT.red);for(const y of [.12,.42,.95,1.17])part(a,'torus',trs(b.x,b.y+y,b.z,.9,.35,.9),y===.95?MAT.amber:MAT.steel);return a;}
export function enemyModel(e,t){const a=[],isDrone=e.type==='drone',boss=e.type==='archon',heavy=e.type==='warden';const base=trs(e.x,e.y,e.z,1,1,1,0,e.yaw);const put=(g,x,y,z,sx,sy,sz,mat,rx=0,ry=0,rz=0,parent=base)=>part(a,g,trs(x,y,z,sx,sy,sz,rx,ry,rz),mat,parent);const box=(x,y,z,w,h,d,m=MAT.dark,rx=0,rz=0,parent=base)=>put('bevel',x,y,z,w,h,d,m,rx,0,rz,parent);
 if(isDrone){
  put('sphere',0,.25,0,1.2,.7,1.0,MAT.steel);box(0,.35,0,1,.38,.76,MAT.dark);put('cyl',0,.28,.55,.38,.12,.38,MAT.black,Math.PI/2);put('sphere',0,.28,.62,.24,.20,.10,MAT.amber);
  for(const s of [-1,1])for(const z of [-.5,.5]){box(s*.65,.2,z,.62,.13,.22,MAT.white,0,s*.2);put('torus',s*.83,.25,z,.78,.4,.78,MAT.dark);put('ring',s*.83,.27,z,.6,.13,.6,MAT.cyan);box(s*.83,.26,z,.56,.025,.055,MAT.steel,0,0,mul(base,trs(0,0,0,1,1,1,0,Math.sin(t*18)*.09)));}
  for(const s of [-1,1]){put('cyl',s*.4,-.02,.7,.13,.58,.13,MAT.steel,Math.PI/2);put('cyl',s*.4,-.02,1.03,.10,.08,.10,e.flash>0?MAT.amber:MAT.cyan,Math.PI/2);}
 }else if(boss){
  box(0,2.7,0,2.9,1.7,1.8,MAT.dark);box(0,3.15,.95,2.1,.65,.28,MAT.red);box(0,2.35,1.01,1.6,.55,.3,MAT.white);put('sphere',0,2.85,1.1,.65,.65,.26,MAT.amber);box(0,3.95,.05,1.05,.73,.85,MAT.black);box(0,3.93,.52,.8,.11,.08,MAT.amber);
  for(const s of [-1,1])for(const z of [-1,1]){const step=Math.sin(e.walk+z)*.18,hip=[s*1.2,2.7,z*.6],knee=[s*2,1.25+step,z*1.2],foot=[s*1.8,.18,z*1.75];part(a,'cyl',beamMatrix(hip,knee,.5),MAT.steel,base);part(a,'bevel',beamMatrix(knee,foot,.5),MAT.red,base);put('sphere',...knee,.6,.6,.6,MAT.black);box(...foot,.85,.28,.9,MAT.dark);}
  for(const s of [-1,1]){box(s*1.9,2.7,0,1.1,1.15,1.25,MAT.red);put('cyl',s*1.85,2.5,1.05,.9,1.8,.9,MAT.dark,Math.PI/2);for(let j=0;j<6;j++){const angle=j*Math.PI/3+t*(e.flash>0?10:1);put('cyl',s*1.85+Math.cos(angle)*.26,2.5+Math.sin(angle)*.26,1.65,.17,1.5,.17,MAT.steel,Math.PI/2);}put('cyl',s*1.85,2.5,2.45,.58,.08,.58,e.flash>0?MAT.amber:MAT.black,Math.PI/2);}
 }else{
  const scale=heavy?1.34:1,parent=mul(base,trs(0,0,0,scale,scale,scale));const b=(x,y,z,w,h,d,m,rx=0,rz=0,p=parent)=>box(x,y,z,w,h,d,m,rx,rz,p);const p=(g,x,y,z,w,h,d,m,rx=0)=>put(g,x,y,z,w,h,d,m,rx,0,0,parent);
  const armor=heavy?MAT.red:MAT.white;
  b(0,1.27,0,.66,.60,.40,MAT.dark);b(0,1.34,.23,.62,.39,.16,armor);b(0,.95,0,.55,.25,.38,MAT.black);b(0,1.28,-.30,.5,.50,.22,MAT.steel);
  for(const s of [-1,1]){const hip=mul(parent,trs(s*.22,.97,0,1,1,1,Math.sin(e.walk+s)*.48*(e.moving?1:.12)));b(0,-.25,0,.25,.52,.26,armor,0,0,hip);b(0,-.65,.03,.21,.38,.23,MAT.dark,0,0,hip);b(0,-.84,.10,.27,.18,.45,MAT.black,0,0,hip);b(0,-.49,.14,.28,.17,.11,MAT.steel,0,0,hip);b(s*.44,1.48,0,.32,.29,.43,armor,0,s*.12);b(s*.48,1.25,.20,.20,.40,.24,MAT.dark,-.75);b(s*.39,1.08,.46,.19,.22,.42,armor,-.2);p('cyl',s*.16,1.31,-.45,.09,.35,.09,MAT.cyan);}
  p('sphere',0,1.65,0,.23,.20,.23,MAT.black);b(0,1.83,.025,.43,.35,.36,armor);b(0,1.85,.221,.34,.065,.03,MAT.amber);b(0,1.73,.22,.20,.06,.08,MAT.black);
  if(!heavy){b(.34,1.12,.66,.24,.22,.76,MAT.black);b(.34,1.23,.59,.29,.10,.46,MAT.steel);p('cyl',.34,1.13,1.13,.09,.39,.09,MAT.steel,Math.PI/2);b(.47,1.11,.6,.025,.055,.33,MAT.cyan);b(.34,.94,.56,.13,.29,.18,MAT.dark,.2);if(e.flash>0)p('sphere',.34,1.13,1.35,.30,.30,.45,MAT.amber);}
  else{b(-.65,1.13,.45,.71,1.09,.22,MAT.dark);b(-.65,1.13,.60,.58,.88,.07,armor);b(-.65,1.13,.65,.10,.74,.04,MAT.amber);p('cyl',.50,1.10,.80,.44,.95,.44,MAT.dark,Math.PI/2);for(let j=0;j<5;j++){const ang=j*1.256+t*2;p('cyl',.5+Math.cos(ang)*.13,1.10+Math.sin(ang)*.13,1.10,.10,.90,.10,MAT.steel,Math.PI/2);}if(e.flash>0)p('sphere',.50,1.10,1.62,.5,.5,.5,MAT.amber);}
 }
 return a;
}
export function weaponModel(index,t,recoil,reload,aim,moving,switchTime,aspect=1.6){const a=[],r=recoil,portrait=clamp((1.1-aspect)/.65,0,1),scale=1-portrait*.28,bob=Math.sin(t*9)*.010*moving,base=trs((.38-portrait*.24)*(1-aim*.88),-.36-portrait*.08+bob-reload*.30-switchTime*.45,-.69-portrait*.24+r*.11,scale,scale,scale,r*.16-reload*.6,.015,Math.sin(t*4)*.01-reload*.62);const p=(g,x,y,z,w,h,d,m,rx=0,ry=0,rz=0)=>part(a,g,trs(x,y,z,w,h,d,rx,ry,rz),m,base);const b=(x,y,z,w,h,d,m=MAT.dark,rx=0)=>p('bevel',x,y,z,w,h,d,m,rx);
 // Two gloved hands and forearm armour make the view model feel held, not floating.
 b(.07,-.25,.20,.17,.37,.18,MAT.black,-.32);b(.08,-.32,.35,.23,.24,.42,MAT.dark,-.45);b(.09,-.31,.29,.24,.12,.20,MAT.white,-.45);b(-.12,-.19,-.34,.19,.16,.24,MAT.black,-.1);b(-.24,-.29,-.13,.21,.22,.49,MAT.dark,-.5);b(-.25,-.22,-.27,.23,.13,.20,MAT.white,-.5);
 if(index===0){
  b(0,0,0,.24,.23,.65,MAT.black);b(0,.065,-.10,.26,.14,.44,MAT.white);b(0,-.09,.23,.15,.22,.28,MAT.dark,-.2);b(0,-.26,-.08,.13,.32,.24,MAT.dark,.15+reload*.4);b(0,-.26,-.071,.10,.26,.21,MAT.black,.15);b(0,.01,-.47,.19,.18,.37,MAT.dark);p('cyl',0,.02,-.76,.08,.38,.08,MAT.steel,Math.PI/2);p('cyl',0,.02,-.95,.11,.12,.11,MAT.black,Math.PI/2);for(let j=0;j<7;j++)b(0,.166,.17-j*.076,.21,.027,.034,MAT.steel);b(.135,.055,-.1,.017,.035,.27,MAT.cyan);for(let j=0;j<4;j++)b(.102,-.01,-.35-j*.062,.01,.04,.024,MAT.black);b(0,.19,.02,.14,.05,.16,MAT.black);p('torus',0,.258,-.01,.12,.4,.12,MAT.steel,Math.PI/2);b(0,.255,-.025,.014,.014,.01,MAT.amber);
 }else if(index===1){
  b(0,0,.02,.30,.27,.62,MAT.dark);b(0,.035,.0,.31,.15,.35,MAT.orange);b(0,-.095,.24,.16,.30,.22,MAT.black,-.26);for(const s of [-1,1]){p('cyl',s*.065,.042,-.53,.106,.95,.106,MAT.steel,Math.PI/2);p('cyl',s*.065,.042,-1.01,.115,.035,.115,MAT.black,Math.PI/2);}b(0,-.073,-.49+Math.sin(r*3)*.13,.24,.18,.33,MAT.black);for(let j=0;j<6;j++)b(0,-.077,-.38-j*.044,.255,.18,.019,MAT.steel);for(let j=0;j<4;j++)p('cyl',.172,.005,.18-j*.075,.045,.16,.045,MAT.orange);b(0,.198,-.17,.028,.09,.022,MAT.white);
 }else{
  b(0,0,0,.30,.26,.65,MAT.dark);b(0,.045,-.04,.25,.21,.48,MAT.white);b(0,-.18,.16,.14,.34,.20,MAT.black,-.24);p('cyl',0,0,-.57,.10,1.04,.10,MAT.violet,Math.PI/2);for(let j=0;j<6;j++)p('torus',0,0,-.32-j*.11,.24,.35,.24,j%2?MAT.steel:MAT.violet,Math.PI/2);for(const s of [-1,1])b(s*.18,0,-.59,.075,.13,.88,MAT.white);b(0,.21,.06,.19,.14,.25,MAT.black);p('cyl',0,.21,-.075,.12,.035,.12,MAT.violet,Math.PI/2);b(0,-.16,-.1,.19,.13,.29,MAT.violet);b(0,-.18,-.08,.22,.09,.32,MAT.dark);
 }
 if(r>.65){const mat=index===2?MAT.violet:index===1?MAT.amber:MAT.cyan;for(let j=0;j<3;j++)p('cone',Math.sin(t*190+j)*.03,.01,-1.03-j*.08,.2-j*.04,.28,.2-j*.04,mat,Math.PI/2);}
 return a;
}
