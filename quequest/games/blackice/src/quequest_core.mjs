// QueQuest host bridge, pure part (no DOM). QueQuest embeds this game as its
// «Лабиринт»: a ladder of floors, each one a mode + bot roster + mutators.
// Protocol 1, postMessage between same-origin windows only:
//   QueQuest -> game  {source:'quequest', type:'hello', protocol:1, player, floor}
//   game -> QueQuest  {source:'blackice', type:'ready', protocol:1, version}
//                     {source:'blackice', type:'floor-clear'|'match-end', protocol:1,
//                      floor, mode, won, kills, deaths, time, score, ghost?}
// The game never decides rewards: QueQuest pays by its own table, once per floor.
export const QQ_PROTOCOL=1;
export const QQ_VERSION='NIGHTFALL 3.0 + QQ bridge 1';
export const QQ_MODES=['arena','training','mission'];
export const QQ_ROLES=['rocketeer','striker','lancer'];
export const QQ_MUTATORS=['rockets','rail','glass','quad','haste'];
export const QQ_OBJECTIVES=['frags','rings','breach','mission'];
const qqNum=(v,lo,hi,d)=>Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):d;
const qqStr=(v,max)=>typeof v==='string'?v.replace(/[\u0000-\u001f<>]/g,'').slice(0,max):'';

// Anything odd in the host's floor falls back to the stock game's values.
export function sanitizeFloor(f){
 if(!f||typeof f!=='object'||!Number.isInteger(f.n)||f.n<1||f.n>99)return null;
 const mode=QQ_MODES.includes(f.mode)?f.mode:'arena';
 const roster=(Array.isArray(f.roster)?f.roster:[]).slice(0,6).map(r=>({name:qqStr(r?.name,16)||'BOT',role:QQ_ROLES.includes(r?.role)?r.role:'striker',hp:qqNum(r?.hp,.3,4,1),speed:qqNum(r?.speed,.5,1.6,1),taunt:qqStr(r?.taunt,90)}));
 const objective=QQ_OBJECTIVES.includes(f.objective)?f.objective:mode==='training'?'rings':mode==='mission'?'mission':'frags';
 const beats=(Array.isArray(f.beats)?f.beats:[]).slice(0,8).map(b=>({at:Math.round(qqNum(b?.at,0,99,0)),text:qqStr(b?.text,120)})).filter(b=>b.text);
 return{n:f.n,mode,objective,beats,intro:qqStr(f.intro,160),title:qqStr(f.title,40),brief:qqStr(f.brief,200),fragLimit:Math.round(qqNum(f.fragLimit,1,60,30)),duration:Math.round(qqNum(f.duration,30,600,300)),bots:Math.round(qqNum(f.bots,1,6,6)),botHp:qqNum(f.botHp,.3,4,1),botSpeed:qqNum(f.botSpeed,.5,1.6,1),damageTaken:qqNum(f.damageTaken,.2,3,1),mutators:(Array.isArray(f.mutators)?f.mutators:[]).filter(m=>QQ_MUTATORS.includes(m)),roster};
}
export function sanitizeHello(d){
 if(!d||typeof d!=='object'||d.source!=='quequest'||d.type!=='hello'||d.protocol!==QQ_PROTOCOL)return null;
 const floor=sanitizeFloor(d.floor);if(!floor)return null;
 let ghost=null;if(d.ghost&&typeof d.ghost==='object'&&typeof d.ghost.data==='string'){const samples=decodeGhost(d.ghost.data);if(samples&&samples.length>=8)ghost={name:qqStr(d.ghost.name,16)||'ПРИЗРАК',samples};}
 const level=d.level&&typeof d.level==='object'?d.level:null;
 return{player:qqStr(d.player,32),floor,ghost,level};
}

// ---------------------------------------------------------------- ghost
// The player's run as a compact timeline: 4 samples a second of position
// (decimetres), yaw (centiradians) and "fired since the last sample", delta
// coded in base 36. A 4-minute run is ~10-15 KB.
export const GHOST_HZ=4;
export const GHOST_MAX=GHOST_HZ*300;
const qqWrapYaw=a=>{let v=a;while(v>Math.PI)v-=Math.PI*2;while(v<-Math.PI)v+=Math.PI*2;return v;};
export class GhostRecorder{
 constructor(){this.samples=[];this.next=0;this.shot=false;}
 shoot(){this.shot=true;}
 tick(t,p){if(t<this.next||this.samples.length>=GHOST_MAX)return false;this.next=t+1/GHOST_HZ;this.samples.push([Math.round(p.x*10),Math.round(p.y*10),Math.round(p.z*10),Math.round(qqWrapYaw(p.yaw||0)*100),this.shot?1:0]);this.shot=false;return true;}
 encode(){return encodeGhost(this.samples);}
}
export function encodeGhost(samples){
 let prev=[0,0,0,0];const out=[];
 for(const s of samples){const d=[0,1,2,3].map(i=>(s[i]|0)-prev[i]);prev=s;out.push(d.map(v=>v.toString(36)).join(',')+(s[4]?'!':''));}
 return 'g1:'+out.join(';');
}
export function decodeGhost(text){
 if(typeof text!=='string'||!text.startsWith('g1:')||text.length>80000)return null;
 const body=text.slice(3);if(!body)return [];
 const out=[];let prev=[0,0,0,0];
 for(const part of body.split(';')){
  const shot=part.endsWith('!'),nums=(shot?part.slice(0,-1):part).split(',');
  if(nums.length!==4||out.length>=GHOST_MAX)return null;
  const d=nums.map(v=>/^-?[0-9a-z]{1,4}$/.test(v)?parseInt(v,36):NaN);if(d.some(v=>!Number.isFinite(v)))return null;
  const s=[prev[0]+d[0],prev[1]+d[1],prev[2]+d[2],prev[3]+d[3],shot?1:0];
  if(Math.abs(s[0])>600||Math.abs(s[2])>600||s[1]<-50||s[1]>400)return null;
  out.push(s);prev=s;
 }
 return out;
}
// Where the ghost is at game time t (loops once the recording ends).
export function ghostAt(samples,t){
 if(!samples?.length)return null;
 const len=samples.length,f=((t*GHOST_HZ)%len+len)%len,i=Math.floor(f),k=f-i,a=samples[i],b=samples[Math.min(len-1,i+1)];
 return{x:(a[0]+(b[0]-a[0])*k)/10,y:(a[1]+(b[1]-a[1])*k)/10,z:(a[2]+(b[2]-a[2])*k)/10,yaw:a[3]/100,shot:!!a[4],index:i};
}

// ------------------------------------------------------------- results
export function resultMessage(floor,r){
 const won=!!r.won;
 const msg={source:'blackice',type:won?'floor-clear':'match-end',protocol:QQ_PROTOCOL,floor:floor?.n??0,mode:r.mode,won,kills:Math.max(0,r.kills|0),deaths:Math.max(0,r.deaths|0),time:Math.round(Math.max(0,+r.time||0)*100)/100,score:Math.max(0,r.score|0)};
 if(won&&typeof r.ghost==='string')msg.ghost=r.ghost;
 return msg;
}
