import {clamp,makeRng} from './core.mjs';
export const ident=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
export function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
export function trs(x=0,y=0,z=0,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){const a=Math.sin(rx),b=Math.cos(rx),c=Math.sin(ry),d=Math.cos(ry),e=Math.sin(rz),f=Math.cos(rz);return new Float32Array([(d*f+c*a*e)*sx,b*e*sx,(-c*f+d*a*e)*sx,0,(-d*e+c*a*f)*sy,b*f*sy,(c*e+d*a*f)*sy,0,c*b*sz,-a*sz,d*b*sz,0,x,y,z,1]);}
export const norm=v=>{const d=Math.hypot(...v)||1;return v.map(x=>x/d);};
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function lookAt(eye,target){const z=norm(eye.map((v,i)=>v-target[i])),x=norm(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-x.reduce((s,v,i)=>s+v*eye[i],0),-y.reduce((s,v,i)=>s+v*eye[i],0),-z.reduce((s,v,i)=>s+v*eye[i],0),1]);}
export function perspective(fov,aspect,near=.055,far=260){const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);}
export function ortho(l,r,b,t,n,f){return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]);}
export function beamMatrix(a,b,r){const y=norm(b.map((v,i)=>v-a[i])),x=norm(cross(Math.abs(y[1])>.95?[1,0,0]:[0,1,0],y)),z=cross(x,y),len=Math.hypot(...b.map((v,i)=>v-a[i]));return new Float32Array([x[0]*r,x[1]*r,x[2]*r,0,y[0]*len,y[1]*len,y[2]*len,0,z[0]*r,z[1]*r,z[2]*r,0,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,1]);}

function geometry(kind){const out=[];const v=(p,n,u,w)=>out.push(...p,...n,u,w);const tri=(a,b,c,na,nb,nc,ua=[0,0],ub=[1,0],uc=[1,1])=>{v(a,na,...ua);v(b,nb,...ub);v(c,nc,...uc);};
 const face=(ps,n)=>{tri(ps[0],ps[1],ps[2],n,n,n);tri(ps[0],ps[2],ps[3],n,n,n,[0,0],[1,1],[0,1]);};
 if(kind==='box'||kind==='bevel'){
 const sides=[[[1,0,0],[0,0,-1],[0,1,0]],[[-1,0,0],[0,0,1],[0,1,0]],[[0,1,0],[1,0,0],[0,0,-1]],[[0,-1,0],[1,0,0],[0,0,1]],[[0,0,1],[1,0,0],[0,1,0]],[[0,0,-1],[-1,0,0],[0,1,0]]];
 for(const [n,u,w] of sides){const grid=kind==='box'?[-.5,.5]:[-.5,-.42,.42,.5];const pt=(a,b)=>{let p=n.map((q,k)=>q*.5+u[k]*a+w[k]*b),nn=n;if(kind==='bevel'){const c=p.map(q=>clamp(q,-.42,.42)),d=p.map((q,k)=>q-c[k]);nn=norm(d);p=c.map((q,k)=>q+nn[k]*.08);}return[p,nn,[a+.5,b+.5]];};for(let i=0;i<grid.length-1;i++)for(let j=0;j<grid.length-1;j++){const p=[pt(grid[i],grid[j]),pt(grid[i+1],grid[j]),pt(grid[i+1],grid[j+1]),pt(grid[i],grid[j+1])];for(const ids of [[0,1,2],[0,2,3]])ids.forEach(k=>v(p[k][0],p[k][1],...p[k][2]));}}
 }else if(kind==='cyl'||kind==='cone'){
 const seg=20,top=kind==='cone'?.04:.5;for(let i=0;i<seg;i++){const a=i/seg*Math.PI*2,b=(i+1)/seg*Math.PI*2;const p=[ [Math.sin(a)*.5,-.5,Math.cos(a)*.5],[Math.sin(b)*.5,-.5,Math.cos(b)*.5],[Math.sin(b)*top,.5,Math.cos(b)*top],[Math.sin(a)*top,.5,Math.cos(a)*top] ];const na=norm([Math.sin(a),kind==='cone'?.46:0,Math.cos(a)]),nb=norm([Math.sin(b),kind==='cone'?.46:0,Math.cos(b)]);tri(p[0],p[1],p[2],na,nb,nb,[i/seg,0],[(i+1)/seg,0],[(i+1)/seg,1]);tri(p[0],p[2],p[3],na,nb,na,[i/seg,0],[(i+1)/seg,1],[i/seg,1]);tri([0,-.5,0],p[1],p[0],[0,-1,0],[0,-1,0],[0,-1,0]);tri([0,.5,0],p[3],p[2],[0,1,0],[0,1,0],[0,1,0]);}
 }else if(kind==='sphere'||kind==='torus'||kind==='ring'){
 const nu=kind==='sphere'?16:32,nv=kind==='sphere'?10:8;const pt=(u,w)=>{const a=u*Math.PI*2,b=w*(kind==='sphere'?Math.PI:Math.PI*2);if(kind==='sphere'){const n=[Math.sin(b)*Math.sin(a),Math.cos(b),Math.sin(b)*Math.cos(a)];return[n.map(q=>q*.5),n,[u,w]];}const n=[Math.cos(a)*Math.cos(b),Math.sin(b),Math.sin(a)*Math.cos(b)],rr=kind==='ring'?.018:.065;return[[(.5+rr*Math.cos(b))*Math.cos(a),rr*Math.sin(b),(.5+rr*Math.cos(b))*Math.sin(a)],n,[u,w]];};for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const p=[pt(i/nu,j/nv),pt((i+1)/nu,j/nv),pt((i+1)/nu,(j+1)/nv),pt(i/nu,(j+1)/nv)];for(const ids of [[0,2,1],[0,3,2]])ids.forEach(k=>v(p[k][0],p[k][1],...p[k][2]));}
 }else if(kind==='ramp'){
 face([[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,-.5],[-.5,.5,-.5]],norm([0,1,1]));face([[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5],[.5,-.5,-.5]],[0,0,-1]);tri([.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[1,0,0],[1,0,0],[1,0,0]);tri([-.5,-.5,.5],[-.5,.5,-.5],[-.5,-.5,-.5],[-1,0,0],[-1,0,0],[-1,0,0]);
 }else if(kind==='quad'){face([[-.5,-.5,0],[.5,-.5,0],[.5,.5,0],[-.5,.5,0]],[0,0,1]);}
 return new Float32Array(out);
}

const INST_VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;layout(location=1) in vec3 aNormal;layout(location=2) in vec2 aUV;
layout(location=3) in mat4 aModel;layout(location=7) in vec4 aColor;layout(location=8) in vec4 aSurface;
uniform mat4 uVP;uniform mat4 uLightVP;
out vec3 vP;out vec3 vN;out vec2 vUV;out vec4 vColor;out vec4 vSurface;out vec4 vShadow;
void main(){vec4 p=aModel*vec4(aPosition,1.);mat3 m=mat3(aModel);vec3 ss=vec3(dot(m[0],m[0]),dot(m[1],m[1]),dot(m[2],m[2]));vN=normalize(m*(aNormal/max(ss,vec3(.00001))));vP=p.xyz;vUV=aUV*aSurface.w;vColor=aColor;vSurface=aSurface;vShadow=uLightVP*p;gl_Position=uVP*p;}`;
const MAIN_FS=`#version 300 es
precision highp float;precision highp sampler2DArray;precision highp sampler2DShadow;
in vec3 vP;in vec3 vN;in vec2 vUV;in vec4 vColor;in vec4 vSurface;in vec4 vShadow;
uniform sampler2DArray uAlbedo;uniform sampler2DArray uNormals;uniform sampler2DShadow uShadow;uniform sampler2D uReflection;
uniform vec3 uEye;uniform vec3 uSun;uniform vec4 uLights[6];uniform vec4 uLightColors[6];uniform float uShadowTexel;uniform float uGun;uniform float uTime;uniform float uMirror;uniform float uHasReflection;uniform mat4 uReflectVP;
out vec4 frag;
const float PI=3.14159265;
float hsh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float nse(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x),mix(hsh(i+vec2(0,1)),hsh(i+1.),f.x),f.y);}
vec3 sky(vec3 d){float h=clamp(d.y,0.,1.);vec3 c=mix(vec3(.025,.12,.19),vec3(.065,.043,.17),h);return c+vec3(.23,.13,.42)*pow(max(dot(d,uSun),0.),24.);}
float visibility(vec3 n){vec3 p=vShadow.xyz/vShadow.w*.5+.5;if(uGun>.5||p.x<0.||p.x>1.||p.y<0.||p.y>1.||p.z>1.)return 1.;float s=0.;float b=max(.00035,.0018*(1.-dot(n,uSun)));for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)s+=texture(uShadow,vec3(p.xy+vec2(float(x),float(y))*uShadowTexel,p.z-b));return s/9.;}
vec3 brdf(vec3 n,vec3 v,vec3 l,vec3 a,float r,float m){vec3 h=normalize(l+v);float nl=max(dot(n,l),0.),nv=max(dot(n,v),.001),nh=max(dot(n,h),0.),hv=max(dot(h,v),0.);vec3 f0=mix(vec3(.04),a,m),f=f0+(1.-f0)*pow(1.-hv,5.);float aa=r*r;aa*=aa;float den=nh*nh*(aa-1.)+1.;float D=aa/(PI*den*den+.00001),k=(r+1.)*(r+1.)/8.;float G=nv/(nv*(1.-k)+k)*nl/(nl*(1.-k)+k);return ((1.-f)*a*(1.-m)/PI+D*G*f/(4.*nv*max(nl,.001)+.0001))*nl;}
void main(){
 if(uMirror>.5&&vP.y<.055)discard;
 vec3 n=normalize(vN),tex=vec3(1.);float ao=1.,r=max(.19,vSurface.y),m=vSurface.z;
 vec2 uv=vUV;vec3 an=abs(n);
 if(vSurface.x>3.5)uv=(an.y>.65?vP.xz:an.x>.65?vP.zy:vP.xy)*.62;
 if(vSurface.x>-.5){vec4 al=texture(uAlbedo,vec3(uv,vSurface.x));vec4 nr=texture(uNormals,vec3(uv,vSurface.x));tex=al.rgb;ao=mix(.68,1.,al.a);r=clamp(r*(.65+nr.a*.8),.19,1.);vec3 q1=dFdx(vP),q2=dFdy(vP);vec2 st1=dFdx(uv),st2=dFdy(uv);vec3 T=q1*st2.y-q2*st1.y;T=normalize(T-n*dot(T,n)+vec3(.000001));vec3 B=normalize(cross(n,T))*sign(st1.x*st2.y-st1.y*st2.x);vec3 tn=nr.xyz*2.-1.;n=normalize(T*tn.x*.45+B*tn.y*.45+n*tn.z);}
 float wet=0.;
 if(uGun<.5&&vSurface.x>1.5&&vSurface.x<2.5&&vP.y<.09&&an.y>.9){
  wet=.32+.68*smoothstep(.30,.72,nse(vP.xz*.31)+nse(vP.xz*1.5)*.12);
  vec3 rainN=normalize(vec3(sin(vP.x*5.+vP.z*7.+uTime*2.8)*.024,1.,cos(vP.z*8.-vP.x*3.+uTime*2.)*.018));
  n=normalize(mix(n,rainN,wet*.75));r=mix(r,.20,wet*.75);
 }
 vec3 a=pow(max(tex*vColor.rgb,vec3(.001)),vec3(2.2)),v=normalize(uEye-vP);float nv=max(dot(n,v),0.),sh=visibility(n);
 vec3 c=brdf(n,v,uSun,a,r,m)*vec3(1.75,1.65,2.8)*sh;
 vec3 ambient=mix(vec3(.065,.035,.11),vec3(.25,.29,.43),clamp(n.y*.5+.5,0.,1.));c+=a*ambient*ao*(1.-m*.48)*mix(.82,1.,sh);
 vec3 f0=mix(vec3(.04),a,m);c+=sky(reflect(-v,n))*mix(f0,vec3(1.),pow(1.-nv,5.))*(1.5-r)*ao;
 for(int i=0;i<6;i++){vec3 d=uLights[i].xyz-vP;float d2=max(dot(d,d),.0001),atten=pow(clamp(1.-sqrt(d2)/max(uLights[i].w,.01),0.,1.),2.);c+=brdf(n,v,d*inversesqrt(d2),a,r,m)*uLightColors[i].rgb*uLightColors[i].w*atten/(1.+d2*.045);}
 // Hostile armour has an unobstructed Fresnel identification rim, never an X-ray outline.
 if(vColor.a<0.)c+=a*.20+vec3(.80,.025,.14)*pow(1.-nv,2.5)*.55;
 if(uGun>.5)c+=a*.23+brdf(n,v,normalize(vec3(-.4,.8,.5)),a,r,m)*vec3(.9,1.2,1.8);
 if(wet>0.){
  // Cheap local neon reflection cues survive in Eco / Balanced.
  float lane=exp(-abs(abs(vP.x)-14.)*2.3),pink=exp(-abs(vP.z+24.)*.65);
  c+=(vec3(.01,.32,.48)*lane+vec3(.3,.005,.10)*pink)*wet*(.12+pow(1.-nv,2.)*.7);
  if(uHasReflection>.5&&uMirror<.5){vec4 rp=uReflectVP*vec4(vP,1.);vec2 ru=rp.xy/max(rp.w,.001)*.5+.5;ru+=n.xz*.009;
   if(rp.w>0.&&ru.x>.003&&ru.y>.003&&ru.x<.997&&ru.y<.997){vec3 reflection=texture(uReflection,ru).rgb*4.;float fres=.12+.64*pow(1.-nv,3.);c=mix(c,reflection,wet*fres*.83);}
  }
 }
 // Procedural skyline windows: no image assets, no extra per-window draw calls.
 if(vSurface.x>5.5&&an.y<.5){vec2 grid=uv*vec2(1.0,.48),cell=floor(grid),f=fract(grid);float on=step(.72,hsh(cell+floor(vP.xz*.04)));float pane=step(.18,f.x)*step(f.x,.79)*step(.17,f.y)*step(f.y,.65)*on;float hue=hsh(floor(vP.xz*.04)+floor(cell.y*.21));vec3 glow=hue>.88?vec3(.60,.018,.22):hue>.70?vec3(.36,.17,.08):vec3(.025,.24,.40);c+=glow*pane*(.28+hsh(cell+2.)*.55);}
 c+=pow(max(vColor.rgb,vec3(0.)),vec3(1.6))*max(vColor.a,0.);
 if(uGun<.5){float dist=length(vP-uEye),density=.0055+.005*exp(-max(vP.y,0.)*.16);float fog=1.-exp(-dist*density);vec3 mist=mix(vec3(.038,.045,.093),vec3(.065,.022,.11),clamp(vP.x*.015+.5,0.,1.));c=mix(c,mist,fog);}
 frag=vec4(c*.25,1.);
}`;
const SHADOW_VS=`#version 300 es
precision highp float;layout(location=0)in vec3 aPosition;layout(location=3)in mat4 aModel;uniform mat4 uVP;void main(){gl_Position=uVP*aModel*vec4(aPosition,1.);}`;
const SHADOW_FS=`#version 300 es
precision highp float;void main(){}`;
const FULL_VS=`#version 300 es
precision highp float;out vec2 vUV;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));vUV=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
const SKY_FS=`#version 300 es
precision highp float;in vec2 vUV;out vec4 frag;uniform vec3 uForward;uniform vec3 uRight;uniform vec3 uUp;uniform vec3 uSun;uniform vec2 uAspect;uniform float uTime;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}float fbm(vec2 p){return noise(p)*.5+noise(p*2.03)*.25+noise(p*4.01)*.125+noise(p*8.03)*.0625;}
void main(){vec2 uv=vUV*2.-1.;vec3 rd=normalize(uForward+uRight*uv.x*uAspect.x+uUp*uv.y*uAspect.y);float h=max(rd.y,0.);vec3 c=mix(vec3(.038,.018,.085),vec3(.006,.012,.033),pow(h,.5));c+=vec3(.008,.049,.074)*pow(1.-h,4.);
 if(rd.y>.018){vec2 cp=rd.xz/(rd.y+.17)*1.6+vec2(uTime*.0017,0.);float cloud=smoothstep(.30,.71,fbm(cp));c+=mix(vec3(.012,.009,.035),vec3(.035,.043,.08),h)*cloud*.7;}
 vec3 axis=normalize(vec3(-.40,.59,-.9));float front=step(0.,dot(rd,axis)),d=length(cross(rd,axis)),radius=.158;
 float halo=exp(-abs(d-radius)*29.)*front; c+=vec3(.27,.015,.17)*halo*.25;
 if(front>.5&&d<radius)c=vec3(.005,.008,.02)+vec3(.010,.012,.026)*pow(d/radius,3.);
 c+=vec3(.60,.14,.62)*exp(-abs(d-radius)*850.)*front*.85;
 float star=step(.9986,hash(floor(vec2(atan(rd.x,rd.z),asin(clamp(rd.y,-1.,1.)))*1000.)));c+=vec3(.4,.6,1.)*star*smoothstep(.08,.48,h)*.18;
 // A quiet horizontal aurora rather than flickering lightning.
 float ribbon=exp(-abs(rd.y-.24-sin(rd.x*7.)*.024)*75.)*smoothstep(.10,.3,rd.y);c+=vec3(.006,.022,.037)*ribbon;
 frag=vec4(c*.25,1.);
}`;
const BLUR_FS=`#version 300 es
precision highp float;in vec2 vUV;out vec4 frag;uniform sampler2D uTex;uniform vec2 uStep;uniform float uExtract;
vec3 get(vec2 uv){vec3 c=texture(uTex,uv).rgb;if(uExtract>.5){float b=max(max(c.r,c.g),c.b);c*=smoothstep(.23,.6,b);}return c;}
void main(){vec3 c=get(vUV)*.227027;c+=(get(vUV+uStep*1.384615)+get(vUV-uStep*1.384615))*.316216;c+=(get(vUV+uStep*3.230769)+get(vUV-uStep*3.230769))*.070270;frag=vec4(c,1.);}`;
const POST_FS=`#version 300 es
precision highp float;in vec2 vUV;out vec4 frag;uniform sampler2D uTex;uniform sampler2D uBloom;uniform vec2 uPixel;uniform vec4 uFx;uniform float uBloomAmount;uniform float uExposure;uniform float uAtmosphere;uniform float uFlow;
float lum(vec3 c){return dot(c,vec3(.299,.587,.114));}vec3 tone(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){vec2 uv=vUV;vec3 c=texture(uTex,uv).rgb;vec3 n=texture(uTex,uv+vec2(0,uPixel.y)).rgb,s=texture(uTex,uv-vec2(0,uPixel.y)).rgb,e=texture(uTex,uv+vec2(uPixel.x,0)).rgb,w=texture(uTex,uv-vec2(uPixel.x,0)).rgb;float lc=lum(c),mn=min(lc,min(min(lum(n),lum(s)),min(lum(e),lum(w)))),mx=max(lc,max(max(lum(n),lum(s)),max(lum(e),lum(w))));c=mix(c,(n+s+e+w+c*4.)/8.,smoothstep(.025,.14,mx-mn)*.34);
 vec3 bloom=texture(uBloom,uv).rgb;vec3 streak=(texture(uBloom,uv+vec2(uPixel.x*14.,0)).rgb+texture(uBloom,uv-vec2(uPixel.x*14.,0)).rgb)*.09*uAtmosphere;
 c=(c+(bloom+streak)*uBloomAmount)*4.;c=tone(c*uExposure);c=pow(c,vec3(1./2.2));
 c*=vec3(.98,.995,1.035);float vig=clamp(1.-dot(uv-.5,uv-.5)*.73,.60,1.);c*=vig;
 c+=((fract(sin(dot(uv+uFx.y,vec2(12.9898,78.233)))*43758.5453))-.5)*.004*uAtmosphere;
 c=mix(c,vec3(.70,.015,.11),uFx.x*(1.-vig)*1.8);c+=vec3(.008,.09,.12)*uFx.z*(1.-vig);c+=vec3(.15,.008,.23)*uFx.w*pow(1.-vig,1.2);c+=vec3(.035,.16,.12)*uFlow*pow(1.-vig,1.5);frag=vec4(c,1.);
}`;
const POINT_VS=`#version 300 es
precision highp float;layout(location=0)in vec3 aP;layout(location=1)in vec4 aC;layout(location=2)in float aSize;uniform mat4 uVP;uniform float uHeight;out vec4 vC;out float vRain;
void main(){gl_Position=uVP*vec4(aP,1.);vRain=aSize<0.?1.:0.;gl_PointSize=clamp(abs(aSize)*uHeight/max(gl_Position.w,.1)*(vRain>.5?2.8:1.),1.,96.);vC=aC;}`;
const POINT_FS=`#version 300 es
precision highp float;in vec4 vC;in float vRain;out vec4 frag;
void main(){vec2 p=gl_PointCoord-.5;float a;if(vRain>.5){float d=abs(p.x+p.y*.21);a=(1.-smoothstep(.008,.047,d))*smoothstep(0.,.15,.5-abs(p.y))*vC.a;if(a<.001)discard;}else{float d=length(p)*2.;if(d>1.)discard;a=pow(1.-d,2.)*vC.a;}frag=vec4(vC.rgb*a*.7,a);}`;

export class Renderer{
 constructor(canvas,quality='balanced'){
  this.canvas=canvas;const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:true,powerPreference:'high-performance',preserveDrawingBuffer:false});if(!gl)throw Error('WebGL2 недоступен. Нажмите SAFE — предыдущая версия работает без него.');this.gl=gl;this.hdr=!!gl.getExtension('EXT_color_buffer_float');this.quality=quality;this.look='noir';this.exposure=1.0;this.reflectionFrames=0;this.reflectionError='';this.frames=0;this.fence=null;this.drawCalls=0;
  this.programs={main:this.program(INST_VS,MAIN_FS,'материалы'),shadow:this.program(SHADOW_VS,SHADOW_FS,'тени'),sky:this.program(FULL_VS,SKY_FS,'небо'),blur:this.program(FULL_VS,BLUR_FS,'свечение'),post:this.program(FULL_VS,POST_FS,'постобработка'),points:this.program(POINT_VS,POINT_FS,'частицы')};
  this.geos={};for(const name of ['box','bevel','cyl','cone','sphere','torus','ring','ramp','quad']){const data=geometry(name),buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);this.geos[name]={buffer,count:data.length/8};}
  this.emptyVAO=gl.createVertexArray();this.staticBatches={};this.dynamicBatches={};this.gunBatches={};this.textures();this.shadowSize=quality==='high'?2048:quality==='low'?512:1024;this.makeShadow();this.lightVP=mul(ortho(-48,48,-48,48,1,150),lookAt([-30,55,-35],[0,0,-4]));this.sun=norm([-30,55,-31]);this.lightPos=new Float32Array(24);this.lightColors=new Float32Array(24);
  this.pointsVAO=gl.createVertexArray();this.pointsBuffer=gl.createBuffer();gl.bindVertexArray(this.pointsVAO);gl.bindBuffer(gl.ARRAY_BUFFER,this.pointsBuffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,32,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,32,12);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.FLOAT,false,32,28);gl.bindVertexArray(null);this.resize(true);
 }
 program(vs,fs,name){const g=this.gl;const compile=(type,src)=>{const s=g.createShader(type);g.shaderSource(s,src);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS)){const log=g.getShaderInfoLog(s);g.deleteShader(s);throw Error(name+': '+log);}return s;};const v=compile(g.VERTEX_SHADER,vs),f=compile(g.FRAGMENT_SHADER,fs),p=g.createProgram();g.attachShader(p,v);g.attachShader(p,f);g.linkProgram(p);g.deleteShader(v);g.deleteShader(f);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error(name+': '+g.getProgramInfoLog(p));return {p,u:{}};}
 uniform(p,name){return p.u[name]??(p.u[name]=this.gl.getUniformLocation(p.p,name));}
 texture2D(w,h,hdr=false){const g=this.gl,t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);g.texImage2D(g.TEXTURE_2D,0,hdr?g.RGBA16F:g.RGBA8,w,h,0,g.RGBA,hdr?g.HALF_FLOAT:g.UNSIGNED_BYTE,null);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);return t;}
 target(w,h,depth=false){const g=this.gl,tex=this.texture2D(w,h,depth&&this.hdr),fbo=g.createFramebuffer();g.bindFramebuffer(g.FRAMEBUFFER,fbo);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,tex,0);let rb=null;if(depth){rb=g.createRenderbuffer();g.bindRenderbuffer(g.RENDERBUFFER,rb);g.renderbufferStorage(g.RENDERBUFFER,g.DEPTH_COMPONENT24,w,h);g.framebufferRenderbuffer(g.FRAMEBUFFER,g.DEPTH_ATTACHMENT,g.RENDERBUFFER,rb);}if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Не удалось создать графический буфер '+w+'×'+h);return{w,h,tex,fbo,rb};}
 resize(force=false){let w=innerWidth,h=innerHeight;const cap=this.quality==='high'?2073600:this.quality==='low'?360000:960000,dpr=Math.min(devicePixelRatio||1,this.quality==='high'?1.5:1.15),scale=Math.min(dpr,Math.sqrt(cap/(w*h)));w=Math.max(240,Math.round(w*scale));h=Math.max(180,Math.round(h*scale));if(!force&&w===this.w&&h===this.h)return;const g=this.gl;for(const rt of [this.rt,this.bloomA,this.bloomB,this.mirror])if(rt){g.deleteTexture(rt.tex);g.deleteFramebuffer(rt.fbo);if(rt.rb)g.deleteRenderbuffer(rt.rb);}this.w=w;this.h=h;this.canvas.width=w;this.canvas.height=h;this.rt=this.target(w,h,true);this.bloomA=this.target(Math.max(64,w>>2),Math.max(48,h>>2));this.bloomB=this.target(this.bloomA.w,this.bloomA.h);this.mirror=null;if(this.quality==='high'){try{this.mirror=this.target(Math.max(120,w>>1),Math.max(90,h>>1),true);}catch(e){this.reflectionError=String(e);}}g.bindFramebuffer(g.FRAMEBUFFER,null);}
 setQuality(q){this.quality=q;const size=q==='high'?2048:q==='low'?512:1024;if(size!==this.shadowSize){this.gl.deleteTexture(this.shadow);this.gl.deleteFramebuffer(this.shadowFBO);this.gl.deleteTexture(this.staticShadow);this.gl.deleteFramebuffer(this.staticShadowFBO);this.shadowSize=size;this.makeShadow();}this.resize(true);}
 makeShadow(){const g=this.gl,size=this.shadowSize;
 const make=()=>{const tex=g.createTexture();g.bindTexture(g.TEXTURE_2D,tex);g.texImage2D(g.TEXTURE_2D,0,g.DEPTH_COMPONENT24,size,size,0,g.DEPTH_COMPONENT,g.UNSIGNED_INT,null);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_COMPARE_MODE,g.COMPARE_REF_TO_TEXTURE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_COMPARE_FUNC,g.LEQUAL);const fb=g.createFramebuffer();g.bindFramebuffer(g.FRAMEBUFFER,fb);g.framebufferTexture2D(g.FRAMEBUFFER,g.DEPTH_ATTACHMENT,g.TEXTURE_2D,tex,0);g.drawBuffers([g.NONE]);g.readBuffer(g.NONE);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Буфер теней не поддерживается');return{tex,fb};};
 const live=make(),cached=make();this.shadow=live.tex;this.shadowFBO=live.fb;this.staticShadow=cached.tex;this.staticShadowFBO=cached.fb;this.shadowDirty=true;g.bindFramebuffer(g.FRAMEBUFFER,null);}

 textures(){const g=this.gl,N=512,L=7,rand=makeRng(960031),pixels=N*N,al=new Uint8Array(pixels*4*L),nm=new Uint8Array(pixels*4*L),heights=new Float32Array(pixels);
 for(let layer=0;layer<L;layer++){
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=y*N+x,off=(layer*pixels+i)*4,noise=(rand()-.5),cloud=Math.sin(x*.047+Math.sin(y*.017)*3)*Math.sin(y*.031)+Math.cos(x*.013-y*.021),gx=Math.min(x%128,127-x%128),gy=Math.min(y%128,127-y%128),edge=Math.min(gx,gy);let c=180+noise*22+cloud*8,h=.6+noise*.035,r=1,b=1;
   if(layer===0){const e=Math.min(Math.min(x,511-x),Math.min(y,511-y));c=194+noise*18+cloud*5;if(e<6){c=54+e*12;h=.15+e*.07;}if(y>22&&y<29||y>480&&y<487){c=85;h=.25;}if(x>445&&y>80&&y<430&&(y%19)<5){c=38;h=.2;}if(y>449&&y<464&&x>45&&x<420){const k=(x+y)%48<24;c=k?195:38;r=k?1.12:1;b=k?.4:1;}if(Math.sin(y*2.2+x*.13)>.994&&rand()>.55){c+=40;h+=.13;}}
   if(layer===1){c=170+noise*27+cloud*17+Math.sin(x*.45)*3;h=.52+noise*.10;const seam=Math.min(x,511-x);if(seam<3){c=63;h=.1;}if(y>470)c-=Math.pow((y-470)/42,2)*35;if(rand()<.006){c-=55;h-=.15;}}
   if(layer===2){c=156+noise*20+cloud*9;h=.66+noise*.02;if(edge<4){c=40+edge*18;h=.1+edge*.11;}if(edge>=4&&edge<6){c+=25;h=.72;}const dx=(x%128)-12,dy=(y%128)-12;if(dx*dx+dy*dy<14){c=65;h=.23;}if(dx*dx+dy*dy<4){c=35;h=.1;}if((x%128)>114&&gy>23&&gy<100){c-=35;h-=.09;}if(Math.sin(x*.023+y*.02)+Math.sin(y*.012-x*.02)>1.4)c-=14;}
   if(layer===3){c=217+noise*12+cloud*4;h=.66+noise*.012;if(Math.min(x,511-x)<15||Math.min(y,511-y)<15){c=70;h=.2;}if(x>365&&x<401){c=93;h=.3;}if(y>330&&y<400&&x<130){c=180;r=1.2;b=.38;}if(rand()<.018){c=100+rand()*90;h=.5;}}
   if(layer===4){const row=Math.floor(y/128),xx=(x+(row%2)*128)%256,yy=y%128,seam=Math.min(xx,255-xx,yy,127-yy);c=159+cloud*19+noise*29;h=.61+noise*.07;if(seam<6){c=38+seam*9;h=.12+seam*.062;}if(seam>=6&&seam<10){c+=17;h+=.07;}const crack=Math.abs(Math.sin(x*.081+Math.sin(y*.039)*5));if(crack<.025&&cloud<0){c-=35;h-=.12;}r=1.045;b=.9;}
   if(layer===5){const u=(x+y)%64,v=(x-y+512)%64,plate=(u>26&&u<35&&v>12&&v<43)||(v>26&&v<35&&u>12&&u<43);c=142+noise*14+cloud*10;h=.48+noise*.016;if(plate){c+=55;h+=.17;}if(edge<3){c=46+edge*19;h=.16+edge*.10;}if(cloud<-.55){c*=.7;h-=.025;}r=.98;b=1.04;}
   if(layer===6){const row=y%64,col=x%64; c=110+cloud*7+noise*10;h=.55+noise*.01;if(row<5||col<4){c=38;h=.28;}r=.93;b=1.08;}
   al[off]=clamp(c*r,0,255);al[off+1]=clamp(c,0,255);al[off+2]=clamp(c*b,0,255);al[off+3]=clamp(h*255,0,255);heights[i]=h;
  }
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=y*N+x,off=(layer*pixels+i)*4,dx=(heights[y*N+(x+1)%N]-heights[y*N+(x+N-1)%N])*3,dy=(heights[((y+1)%N)*N+x]-heights[((y+N-1)%N)*N+x])*3,n=norm([-dx,-dy,1]);nm[off]=128+n[0]*127;nm[off+1]=128+n[1]*127;nm[off+2]=128+n[2]*127;nm[off+3]=clamp((layer===2?.45:.7)*255+(rand()-.5)*45,0,255);}
 }
 const upload=(data)=>{const t=g.createTexture();g.bindTexture(g.TEXTURE_2D_ARRAY,t);g.texImage3D(g.TEXTURE_2D_ARRAY,0,g.RGBA8,N,N,L,0,g.RGBA,g.UNSIGNED_BYTE,data);g.texParameteri(g.TEXTURE_2D_ARRAY,g.TEXTURE_WRAP_S,g.REPEAT);g.texParameteri(g.TEXTURE_2D_ARRAY,g.TEXTURE_WRAP_T,g.REPEAT);g.texParameteri(g.TEXTURE_2D_ARRAY,g.TEXTURE_MIN_FILTER,g.LINEAR_MIPMAP_LINEAR);g.texParameteri(g.TEXTURE_2D_ARRAY,g.TEXTURE_MAG_FILTER,g.LINEAR);g.generateMipmap(g.TEXTURE_2D_ARRAY);const ext=g.getExtension('EXT_texture_filter_anisotropic');if(ext)g.texParameterf(g.TEXTURE_2D_ARRAY,ext.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(4,g.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));return t;};this.albedo=upload(al);this.normals=upload(nm);
 }
 upload(instances,store,isStatic=false){const g=this.gl,groups={};for(const obj of instances)(groups[obj.g]??=[]).push(obj);for(const name in store)store[name].count=0;for(const [name,objects] of Object.entries(groups)){let b=store[name];if(!b){const vao=g.createVertexArray(),buffer=g.createBuffer();g.bindVertexArray(vao);g.bindBuffer(g.ARRAY_BUFFER,this.geos[name].buffer);for(let k=0;k<3;k++){g.enableVertexAttribArray(k);g.vertexAttribPointer(k,k===2?2:3,g.FLOAT,false,32,k===0?0:k===1?12:24);}g.bindBuffer(g.ARRAY_BUFFER,buffer);for(let k=0;k<6;k++){g.enableVertexAttribArray(3+k);g.vertexAttribPointer(3+k,4,g.FLOAT,false,96,k*16);g.vertexAttribDivisor(3+k,1);}b=store[name]={vao,buffer,count:0};}const data=new Float32Array(objects.length*24);objects.forEach((obj,i)=>{data.set(obj.m,i*24);data.set(obj.c,i*24+16);data.set(obj.s,i*24+20);});g.bindBuffer(g.ARRAY_BUFFER,b.buffer);g.bufferData(g.ARRAY_BUFFER,data,isStatic?g.STATIC_DRAW:g.DYNAMIC_DRAW);b.count=objects.length;}g.bindVertexArray(null);}
 setWorld(instances){this.shadowDirty=true;this.instanceCount=instances.length;this.upload(instances,this.staticBatches,true);}
 batches(store){const g=this.gl;for(const [name,b] of Object.entries(store))if(b.count){g.bindVertexArray(b.vao);g.drawArraysInstanced(g.TRIANGLES,0,this.geos[name].count,b.count);this.drawCalls++;}}
 bindTex(p,name,tex,unit,array=false){const g=this.gl;g.activeTexture(g.TEXTURE0+unit);g.bindTexture(array?g.TEXTURE_2D_ARRAY:g.TEXTURE_2D,tex);g.uniform1i(this.uniform(p,name),unit);}
 full(p,target){const g=this.gl;g.bindFramebuffer(g.FRAMEBUFFER,target?target.fbo:null);g.viewport(0,0,target?target.w:this.w,target?target.h:this.h);g.useProgram(p.p);g.bindVertexArray(this.emptyVAO);}
 draw(cam,instances,guns,particles,time,fx={}){const g=this.gl;if(g.isContextLost())return false;if(this.fence){const status=g.clientWaitSync(this.fence,0,0);if(status===g.TIMEOUT_EXPIRED)return false;g.deleteSync(this.fence);this.fence=null;}this.resize();this.drawCalls=0;this.upload(instances,this.dynamicBatches);this.upload(guns,this.gunBatches);const forward=[Math.sin(cam.yaw)*Math.cos(cam.pitch),Math.sin(cam.pitch),-Math.cos(cam.yaw)*Math.cos(cam.pitch)],r0=[Math.cos(cam.yaw),0,Math.sin(cam.yaw)],u0=cross(r0,forward),roll=cam.roll||0,right=r0.map((v,i)=>v*Math.cos(roll)+u0[i]*Math.sin(roll)),up=u0.map((v,i)=>v*Math.cos(roll)-r0[i]*Math.sin(roll)),eye=[cam.x,cam.y,cam.z],view=mul(trs(0,0,0,1,1,1,0,0,-roll),lookAt(eye,eye.map((v,i)=>v+forward[i]))),proj=perspective(cam.fov||1.25,this.w/this.h),vp=mul(proj,view);
 g.enable(g.DEPTH_TEST);g.depthMask(true);g.enable(g.CULL_FACE);g.cullFace(g.BACK);g.disable(g.BLEND);g.bindFramebuffer(g.FRAMEBUFFER,this.shadowFBO);g.viewport(0,0,this.shadowSize,this.shadowSize);const sp=this.programs.shadow;g.useProgram(sp.p);g.uniformMatrix4fv(this.uniform(sp,'uVP'),false,this.lightVP);g.enable(g.POLYGON_OFFSET_FILL);g.polygonOffset(1.3,2);
 if(this.shadowDirty){g.bindFramebuffer(g.FRAMEBUFFER,this.staticShadowFBO);g.clear(g.DEPTH_BUFFER_BIT);this.batches(this.staticBatches);this.shadowDirty=false;}
 g.bindFramebuffer(g.READ_FRAMEBUFFER,this.staticShadowFBO);g.bindFramebuffer(g.DRAW_FRAMEBUFFER,this.shadowFBO);g.blitFramebuffer(0,0,this.shadowSize,this.shadowSize,0,0,this.shadowSize,this.shadowSize,g.DEPTH_BUFFER_BIT,g.NEAREST);g.bindFramebuffer(g.FRAMEBUFFER,this.shadowFBO);this.batches(this.dynamicBatches);g.disable(g.POLYGON_OFFSET_FILL);
 g.bindFramebuffer(g.FRAMEBUFFER,this.rt.fbo);g.viewport(0,0,this.w,this.h);g.clearColor(.02,.04,.06,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.disable(g.DEPTH_TEST);g.disable(g.CULL_FACE);const sk=this.programs.sky;this.full(sk,this.rt);g.uniform3fv(this.uniform(sk,'uForward'),forward);g.uniform3fv(this.uniform(sk,'uRight'),right);g.uniform3fv(this.uniform(sk,'uUp'),up);g.uniform3fv(this.uniform(sk,'uSun'),this.sun);g.uniform2f(this.uniform(sk,'uAspect'),Math.tan((cam.fov||1.25)/2)*this.w/this.h,Math.tan((cam.fov||1.25)/2));g.uniform1f(this.uniform(sk,'uTime'),time);g.drawArrays(g.TRIANGLES,0,3);
 const mp=this.programs.main;g.useProgram(mp.p);g.enable(g.DEPTH_TEST);g.enable(g.CULL_FACE);g.uniformMatrix4fv(this.uniform(mp,'uVP'),false,vp);g.uniformMatrix4fv(this.uniform(mp,'uLightVP'),false,this.lightVP);g.uniform3fv(this.uniform(mp,'uEye'),eye);g.uniform3fv(this.uniform(mp,'uSun'),this.sun);g.uniform1f(this.uniform(mp,'uShadowTexel'),1/this.shadowSize);g.uniform1f(this.uniform(mp,'uGun'),0);g.uniform1f(this.uniform(mp,'uTime'),time);g.uniform1f(this.uniform(mp,'uMirror'),0);g.uniform1f(this.uniform(mp,'uHasReflection'),0);g.uniformMatrix4fv(this.uniform(mp,'uReflectVP'),false,vp);this.bindTex(mp,'uReflection',this.bloomB.tex,3);this.bindTex(mp,'uAlbedo',this.albedo,0,true);this.bindTex(mp,'uNormals',this.normals,1,true);this.bindTex(mp,'uShadow',this.shadow,2);
 const lights=fx.lights||[];for(let i=0;i<6;i++){const l=lights[i]||{p:[0,0,0],c:[0,0,0],r:1,power:0};this.lightPos.set([...l.p,l.r],i*4);this.lightColors.set([...l.c,l.power],i*4);}g.uniform4fv(this.uniform(mp,'uLights[0]'),this.lightPos);g.uniform4fv(this.uniform(mp,'uLightColors[0]'),this.lightColors);
 if(this.mirror){
  // Mirror world about y=0, reverse face culling, clip the floor. No recursive sampling.
  const rt=this.mirror;g.bindFramebuffer(g.FRAMEBUFFER,rt.fbo);g.viewport(0,0,rt.w,rt.h);g.clearColor(.004,.006,.012,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.disable(g.DEPTH_TEST);g.disable(g.CULL_FACE);
  this.full(sk,rt);g.uniform3fv(this.uniform(sk,'uForward'),[forward[0],-forward[1],forward[2]]);g.uniform3fv(this.uniform(sk,'uRight'),[right[0],-right[1],right[2]]);g.uniform3fv(this.uniform(sk,'uUp'),[up[0],-up[1],up[2]]);g.drawArrays(g.TRIANGLES,0,3);
  g.useProgram(mp.p);g.enable(g.DEPTH_TEST);g.enable(g.CULL_FACE);g.cullFace(g.FRONT);g.uniformMatrix4fv(this.uniform(mp,'uVP'),false,mul(vp,trs(0,0,0,1,-1,1)));g.uniform3fv(this.uniform(mp,'uEye'),[eye[0],-eye[1],eye[2]]);g.uniform1f(this.uniform(mp,'uMirror'),1);this.bindTex(mp,'uReflection',this.rt.tex,3);this.batches(this.staticBatches);this.batches(this.dynamicBatches);this.reflectionFrames++;
  g.bindFramebuffer(g.FRAMEBUFFER,this.rt.fbo);g.viewport(0,0,this.w,this.h);g.cullFace(g.BACK);g.uniformMatrix4fv(this.uniform(mp,'uVP'),false,vp);g.uniform3fv(this.uniform(mp,'uEye'),eye);g.uniform1f(this.uniform(mp,'uMirror'),0);g.uniform1f(this.uniform(mp,'uHasReflection'),1);this.bindTex(mp,'uReflection',rt.tex,3);
 }
 this.batches(this.staticBatches);this.batches(this.dynamicBatches);
 if(particles.length){const pp=this.programs.points;g.useProgram(pp.p);g.bindVertexArray(this.pointsVAO);g.bindBuffer(g.ARRAY_BUFFER,this.pointsBuffer);g.bufferData(g.ARRAY_BUFFER,new Float32Array(particles),g.DYNAMIC_DRAW);g.uniformMatrix4fv(this.uniform(pp,'uVP'),false,vp);g.uniform1f(this.uniform(pp,'uHeight'),this.h);g.enable(g.BLEND);g.blendFunc(g.ONE,g.ONE);g.depthMask(false);g.drawArrays(g.POINTS,0,particles.length/8);g.depthMask(true);g.disable(g.BLEND);}
 if(guns.length){g.clear(g.DEPTH_BUFFER_BIT);g.useProgram(mp.p);g.uniformMatrix4fv(this.uniform(mp,'uVP'),false,perspective(1.07,this.w/this.h,.03,30));g.uniform3f(this.uniform(mp,'uEye'),0,0,0);g.uniform3f(this.uniform(mp,'uSun'),-.32,.68,.66);g.uniform1f(this.uniform(mp,'uGun'),1);this.batches(this.gunBatches);}
 g.disable(g.DEPTH_TEST);g.disable(g.CULL_FACE);const bp=this.programs.blur;
 if(this.quality!=='low'){this.full(bp,this.bloomA);this.bindTex(bp,'uTex',this.rt.tex,0);g.uniform2f(this.uniform(bp,'uStep'),1/this.w,0);g.uniform1f(this.uniform(bp,'uExtract'),1);g.drawArrays(g.TRIANGLES,0,3);this.full(bp,this.bloomB);this.bindTex(bp,'uTex',this.bloomA.tex,0);g.uniform2f(this.uniform(bp,'uStep'),1/this.bloomA.w,0);g.uniform1f(this.uniform(bp,'uExtract'),0);g.drawArrays(g.TRIANGLES,0,3);this.full(bp,this.bloomA);this.bindTex(bp,'uTex',this.bloomB.tex,0);g.uniform2f(this.uniform(bp,'uStep'),0,1/this.bloomA.h);g.drawArrays(g.TRIANGLES,0,3);}
 const pp=this.programs.post;this.full(pp,null);this.bindTex(pp,'uTex',this.rt.tex,0);this.bindTex(pp,'uBloom',this.bloomA.tex,1);g.uniform2f(this.uniform(pp,'uPixel'),1/this.w,1/this.h);g.uniform4f(this.uniform(pp,'uFx'),fx.hit||0,time,fx.dash||0,fx.quad||0);g.uniform1f(this.uniform(pp,'uBloomAmount'),this.quality==='low'?0:this.look==='clean'?.17:.43);g.uniform1f(this.uniform(pp,'uExposure'),this.exposure);g.uniform1f(this.uniform(pp,'uAtmosphere'),this.look==='clean'?0:1);g.uniform1f(this.uniform(pp,'uFlow'),fx.flow||0);g.drawArrays(g.TRIANGLES,0,3);this.frames++;this.fence=g.fenceSync(g.SYNC_GPU_COMMANDS_COMPLETE,0);g.flush();return true;
 }
}
