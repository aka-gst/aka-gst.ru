// Pure simulation rules. Coordinates are metres, angles radians, time seconds.
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function makeRng(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export function rayBox(o,d,b){let lo=0,hi=Infinity;for(let k=0;k<3;k++){const a=b[['x0','y0','z0'][k]],c=b[['x1','y1','z1'][k]];if(Math.abs(d[k])<1e-9){if(o[k]<a||o[k]>c)return Infinity;continue;}let t=(a-o[k])/d[k],u=(c-o[k])/d[k];if(t>u)[t,u]=[u,t];lo=Math.max(lo,t);hi=Math.min(hi,u);if(lo>hi)return Infinity;}return hi>=0?lo:Infinity;}
export function raySphere(o,d,p,r){const x=o[0]-p[0],y=o[1]-p[1],z=o[2]-p[2],b=x*d[0]+y*d[1]+z*d[2],c=x*x+y*y+z*z-r*r,h=b*b-c;if(h<0)return Infinity;const t=-b-Math.sqrt(h);return t>=0?t:(c<=0?0:Infinity);}
export function slideMove(p,dx,dz,boxes,r=.34,height=1.7,stepHeight=0){const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.14));dx/=steps;dz/=steps;const blocked=(x,z)=>boxes.some(b=>p.y+height>b.y0+.03&&p.y<b.y1-.08-stepHeight&&x+r>b.x0&&x-r<b.x1&&z+r>b.z0&&z-r<b.z1);for(let i=0;i<steps;i++){if(!blocked(p.x+dx,p.z))p.x+=dx;if(!blocked(p.x,p.z+dz))p.z+=dz;}return p;}
export function floorHeight(x,z,surfaces){let h=0;for(const s of surfaces)if(x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1){let y=s.y??0;if(s.ramp==='z')y=s.y0+(s.y1-s.y0)*clamp((z-s.z0)/(s.z1-s.z0),0,1);if(s.ramp==='x')y=s.y0+(s.y1-s.y0)*clamp((x-s.x0)/(s.x1-s.x0),0,1);h=Math.max(h,y);}return h;}
export const WEAPONS=[
 {name:'K-17 «ИМПУЛЬС»',short:'CARBINE',mag:30,reserve:210,damage:21,rate:.108,reload:1.55,pellets:1,spread:.009,range:100,recoil:.022,color:[.25,.86,1]},
 {name:'M-8 «РАЗЛОМ»',short:'BREACHER',mag:8,reserve:48,damage:17,rate:.7,reload:1.85,pellets:9,spread:.075,range:34,recoil:.075,color:[1,.43,.12]},
 {name:'R-9 «ПРИЗМА»',short:'RAIL LANCE',mag:5,reserve:25,damage:145,rate:1.05,reload:2.05,pellets:1,spread:.001,range:160,recoil:.05,color:[.67,.42,1]},
 {name:'R-40 «РЕАКТОР»',short:'ROCKET',mag:6,reserve:42,damage:110,rate:.64,reload:1.65,pellets:1,spread:0,range:160,recoil:.06,color:[1,.48,.12],kind:'rocket',speed:34},
 {name:'P-9 «ГЕЛИОС»',short:'PLASMA',mag:50,reserve:240,damage:24,rate:.088,reload:1.6,pellets:1,spread:.012,range:90,recoil:.012,color:[.12,.82,1],kind:'plasma',speed:49},
 {name:'L-6 «ДУГА»',short:'LIGHTNING',mag:100,reserve:260,damage:9,rate:.052,reload:1.8,pellets:1,spread:0,range:21,recoil:.003,color:[.55,.70,1],kind:'lightning'}
];
export class Inventory{
 constructor(){this.slots=WEAPONS.map(w=>({ammo:w.mag,reserve:w.reserve}));this.selected=0;this.nextShot=0;this.reloadEnd=0;}
 select(n){if(n<0||n>=WEAPONS.length||n===this.selected)return false;this.selected=n;this.reloadEnd=0;return true;}
 shoot(t){this.tick(t);const s=this.slots[this.selected];if(t<this.nextShot||this.reloadEnd||s.ammo<=0)return false;s.ammo--;this.nextShot=t+WEAPONS[this.selected].rate;return true;}
 reload(t){const s=this.slots[this.selected],w=WEAPONS[this.selected];if(this.reloadEnd||s.ammo===w.mag||s.reserve<=0)return false;this.reloadEnd=t+w.reload;return true;}
 tick(t){if(this.reloadEnd&&t>=this.reloadEnd){const s=this.slots[this.selected],w=WEAPONS[this.selected],n=Math.min(w.mag-s.ammo,s.reserve);s.ammo+=n;s.reserve-=n;this.reloadEnd=0;}}
 restock(){this.slots.forEach((s,i)=>s.reserve=Math.min(s.reserve+WEAPONS[i].mag*2,WEAPONS[i].reserve));}
}
export class Mission{
 constructor(){this.relays=[false,false,false];this.phase='relays';this.waveActive=false;this.kills=0;this.score=0;}
 activate(i){if(this.phase!=='relays'||this.waveActive||!Number.isInteger(i)||i<0||i>2||this.relays[i])return false;this.relays[i]=true;this.waveActive=true;if(this.relays.every(Boolean))this.phase='boss';return true;}
 clearWave(){if(!this.waveActive)return;this.waveActive=false;if(this.phase==='boss')this.phase='extract';}
 extract(){if(this.phase!=='extract')return false;this.phase='won';return true;}
}
