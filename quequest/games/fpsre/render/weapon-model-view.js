(() => {
  'use strict';
  const QQ=window.QQ,{mul,perspective,translate,scale,rotX,rotY,lerp,V3}=QQ.Math3D;
  // QueQuest 20.0: two hands, centred, aimed at the crosshair (Сергей's refs: CS:GO, RE Requiem); was x .35 y -.30 z -1.42 yaw .25 (one hand, held sideways)
  const BASE_POSE=Object.freeze({x:.30,y:-.36,z:-1.30,yaw:.0425,pitch:.025,roll:.05,scale:.67});
  const POSES=Object.freeze({
    NORMAL:BASE_POSE,
    // QueQuest 20.0 · aim down sights (RMB): the rear notch (slide top, y .426) and the front post (frame top, y .434, z −.726)
    // on the screen centre — the crosshair; x 0, y = −post height × scale, close to the eye
    AIM:{x:0,y:-.434*.67,z:-.95,yaw:0,pitch:-.0065,roll:0,scale:.67},
    RELOAD:{x:-.05,y:-.37,z:-.74,yaw:.08,pitch:.25,roll:.016,scale:.67},
    INSPECT:{x:.04,y:-.12,z:-1.28,yaw:-.04,pitch:.012,roll:.05,scale:.72},
    EXPLODED:{x:.01,y:-.02,z:-1.22,yaw:.01,pitch:.01,roll:0,scale:.75}
  });
  function rotZ(a){const m=QQ.Math3D.identity(),c=Math.cos(a),s=Math.sin(a);m[0]=c;m[1]=s;m[4]=-s;m[5]=c;return m;}
  const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  class WeaponModelViewRenderer{
    constructor(ctx,canvas){
      this.ctx=ctx;this.canvas=canvas;this.gl=canvas?.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:true})||null;
      this.ready=false;this.failed=false;this.parts={};this.muzzle=[0,.32,-.85];this.pose={...BASE_POSE};this.lastT=performance.now();this.explodeBlend=0;this.wallBlend=0;this.wallSide=0;this.lookLag={yaw:0,pitch:0,lastYaw:null,lastPitch:null};
      if(!this.gl){this.failed=true;return;}this.initGL();this.initArms();this.load();
    }
    shader(type,src){const gl=this.gl,s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
    program(vs,fs){const gl=this.gl,p=gl.createProgram();gl.attachShader(p,this.shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,this.shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
    initGL(){const gl=this.gl;
      this.p=this.program(`attribute vec3 aPos;attribute vec3 aNormal;attribute vec3 aColor;uniform mat4 uM;uniform mat4 uP;varying vec3 vN;varying vec3 vP;varying vec3 vC;void main(){vec4 q=uM*vec4(aPos,1.0);vP=q.xyz;vN=normalize(mat3(uM)*aNormal);vC=aColor;gl_Position=uP*q;}`,`precision mediump float;varying vec3 vN;varying vec3 vP;varying vec3 vC;uniform float uTwilight;uniform float uHeat;uniform float uRoughness;uniform float uSkin;void main(){vec3 n=normalize(vN),v=normalize(-vP);vec3 l1=normalize(vec3(-.35,.82,.45)),l2=normalize(vec3(.65,.25,.72));float d1=max(0.0,dot(n,l1)),d2=max(0.0,dot(n,l2));vec3 h=normalize(l1+v);float specPow=mix(58.0,18.0,clamp(uRoughness,0.0,1.0));float spec=pow(max(0.0,dot(n,h)),specPow);float rim=pow(1.0-max(0.0,dot(n,v)),2.6);float specStrength=mix(.50,.12,clamp(uRoughness,0.0,1.0));vec3 c=vC*(.22+d1*.68+d2*.26)+vec3(.72,.86,.88)*spec*specStrength+vC*rim*.30;if(uSkin>.5){vec3 ls=normalize(vec3(.80,.50,.25));float nl=dot(n,ls),w=clamp((nl+.4)/1.4,0.0,1.0),hard=max(0.0,nl);vec3 sss=mix(vec3(.95,.28,.16),vec3(1.0),smoothstep(0.0,.55,w));float hemi=n.y*.5+.5;vec3 amb=mix(vec3(.16,.11,.09),vec3(.13,.19,.21),hemi);float fr=pow(1.0-max(0.0,dot(n,v)),3.0);vec3 hs=normalize(ls+v);float sh=pow(max(0.0,dot(n,hs)),22.0);c=vec3(dot(vC,vec3(.3,.59,.11)))*.18+vC*.82;c=c*(amb*1.0+sss*(w*w*.45+hard*.75)*vec3(1.0,.92,.82)+vec3(.10,.14,.16)*max(0.0,dot(n,l2)))+vec3(.30,.52,.58)*fr*.45*(.4+.6*hemi)+vec3(.9,.85,.8)*sh*.07*(1.0-uRoughness*.5);}c+=vec3(.34,.055,.015)*uHeat*max(0.0,n.y)*.30;if(uTwilight>.5)c=mix(c,vec3(dot(c,vec3(.28,.60,.12)))*vec3(.62,.82,.84),.42);c=vec3(1.0)-exp(-c*1.45);gl_FragColor=vec4(c,1.0);}`);
      const A=n=>gl.getAttribLocation(this.p,n),U=n=>gl.getUniformLocation(this.p,n);this.loc={pos:A('aPos'),normal:A('aNormal'),color:A('aColor'),m:U('uM'),p:U('uP'),twilight:U('uTwilight'),heat:U('uHeat'),roughness:U('uRoughness'),skin:U('uSkin')};
      this.flashP=this.program(`attribute vec3 aPos;uniform mat4 uM;uniform mat4 uP;void main(){gl_Position=uP*uM*vec4(aPos,1.0);}`,`precision mediump float;uniform float uA;void main(){gl_FragColor=vec4(1.0,.66,.22,uA);}`);
      this.flashLoc={pos:gl.getAttribLocation(this.flashP,'aPos'),m:gl.getUniformLocation(this.flashP,'uM'),p:gl.getUniformLocation(this.flashP,'uP'),a:gl.getUniformLocation(this.flashP,'uA')};
      this.flashB=gl.createBuffer();
    }
    async loadRealArm(){
      try{const r=await fetch('Assets/Viewmodels/fps_arm_v20.json');if(!r.ok)throw new Error(`HTTP ${r.status}`);const a=await r.json();this.realArm=this.upload(a.parts.arm);this.ctx.emit?.('VIEWMODEL_ARM_READY',{asset:a.id,triangles:a.parts.arm.triangles});}
      catch(e){this.realArm=null;this.ctx.emit?.('VIEWMODEL_ARM_FAIL',{asset:'fps_arm_v20',error:String(e)});}
    }
    async load(){this.loadRealArm();
      try{const r=await fetch('Assets/Viewmodels/service_pistol_v12.json');if(!r.ok)throw new Error(`HTTP ${r.status}`);const a=await r.json();this.muzzle=a.muzzle||this.muzzle;for(const [name,p] of Object.entries(a.parts||{}))this.parts[name]=this.upload(p);this.ready=!!(this.parts.body&&this.parts.slide);this.ctx.emit?.('VIEWMODEL_ASSET_READY',{asset:a.id,parts:Object.keys(this.parts),triangles:Object.values(a.parts||{}).reduce((n,p)=>n+(p.triangles||0),0)});}catch(e){this.failed=true;this.ctx.emit?.('VIEWMODEL_ASSET_FAIL',{asset:'service_pistol_v12',error:String(e)});}}
    upload(part){const gl=this.gl,b={count:(part.positions?.length||0)/3};for(const [k,data] of [['pos',part.positions],['normal',part.normals],['color',part.colors]]){const q=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,q);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);b[k]=q;}return b;}
    makeBoxPart(color=[.12,.15,.16]){const p=[],n=[],c=[];const faces=[[[1,0,0],[[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[.5,-.5,.5]]],[[-1,0,0],[[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[-.5,-.5,-.5]]],[[0,1,0],[[-.5,.5,-.5],[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5]]],[[0,-1,0],[[-.5,-.5,.5],[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5]]],[[0,0,1],[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]],[[0,0,-1],[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]]];for(const [normal,v] of faces){for(const i of [0,1,2,0,2,3]){p.push(...v[i]);n.push(...normal);c.push(...color);}}return this.upload({positions:p,normals:n,colors:c});}
    makeTaperedPart(color=[.12,.15,.16],segments=10,rBottom=.56,rTop=.44){const p=[],n=[],c=[];const y0=-.5,y1=.5;for(let i=0;i<segments;i++){const a0=i/segments*Math.PI*2,a1=(i+1)/segments*Math.PI*2,x00=Math.cos(a0)*rBottom,z00=Math.sin(a0)*rBottom,x01=Math.cos(a1)*rBottom,z01=Math.sin(a1)*rBottom,x10=Math.cos(a0)*rTop,z10=Math.sin(a0)*rTop,x11=Math.cos(a1)*rTop,z11=Math.sin(a1)*rTop;const verts=[[x00,y0,z00],[x01,y0,z01],[x11,y1,z11],[x10,y1,z10]],norms=[[Math.cos(a0),.08,Math.sin(a0)],[Math.cos(a1),.08,Math.sin(a1)],[Math.cos(a1),.08,Math.sin(a1)],[Math.cos(a0),.08,Math.sin(a0)]];for(const j of [0,1,2,0,2,3]){p.push(...verts[j]);n.push(...norms[j]);c.push(...color);}}for(const [yy,rr,ny,rev] of [[y0,rBottom,-1,true],[y1,rTop,1,false]]){for(let i=0;i<segments;i++){const a0=i/segments*Math.PI*2,a1=(i+1)/segments*Math.PI*2,v0=[Math.cos(a0)*rr,yy,Math.sin(a0)*rr],v1=[Math.cos(a1)*rr,yy,Math.sin(a1)*rr],tri=rev?[[0,yy,0],v1,v0]:[[0,yy,0],v0,v1];for(const v of tri){p.push(...v);n.push(0,ny,0);c.push(...color);}}}return this.upload({positions:p,normals:n,colors:c});}
    makeArmPart(color=[.11,.13,.14]){
      const rings=[
        {y:-.62,w:.17,d:.16},
        {y:-.30,w:.155,d:.15},
        {y:-.06,w:.125,d:.125},
        {y:.15,w:.16,d:.13},
        {y:.33,w:.15,d:.11}
      ],p=[],n=[],c=[];
      const ring=r=>[[-r.w,r.y,-r.d],[r.w,r.y,-r.d],[r.w,r.y,r.d],[-r.w,r.y,r.d]];
      const vs=rings.map(ring),faces=[[0,1,[0,0,-1]],[1,2,[1,0,0]],[2,3,[0,0,1]],[3,0,[-1,0,0]]];
      for(let k=0;k<vs.length-1;k++)for(const [a,b,nn] of faces){const q=[vs[k][a],vs[k][b],vs[k+1][b],vs[k+1][a]];for(const i of [0,1,2,0,2,3]){p.push(...q[i]);n.push(...nn);c.push(...color);}}
      for(const [idx,ny,rev] of [[0,-1,true],[vs.length-1,1,false]]){const q=vs[idx],tri=rev?[0,3,2,0,2,1]:[0,1,2,0,2,3];for(const i of tri){p.push(...q[i]);n.push(0,ny,0);c.push(...color);}}
      return this.upload({positions:p,normals:n,colors:c});
    }
    makeEllipsoidPart(color=[.10,.12,.13],segments=12,rings=7){const p=[],n=[],c=[];const V=(a,b)=>{const cb=Math.cos(b),x=cb*Math.cos(a),y=Math.sin(b),z=cb*Math.sin(a);return [[x,y,z],[x,y,z]];};for(let j=0;j<rings;j++){const b0=-Math.PI/2+j/rings*Math.PI,b1=-Math.PI/2+(j+1)/rings*Math.PI;for(let i=0;i<segments;i++){const a0=i/segments*Math.PI*2,a1=(i+1)/segments*Math.PI*2,q=[V(a0,b0),V(a1,b0),V(a1,b1),V(a0,b1)];for(const k of [0,1,2,0,2,3]){p.push(...q[k][0]);n.push(...q[k][1]);c.push(...color);}}}return this.upload({positions:p,normals:n,colors:c});}
    initArms(){this.armParts={sleeve:this.makeTaperedPart([.12,.155,.165],12,.46,.30),hand:this.makeEllipsoidPart([.14,.175,.185],12,7)};}
    drawPart(part,P,M,roughness=.25,skin=0){const gl=this.gl;this.bindPart(part);gl.uniformMatrix4fv(this.loc.p,false,P);gl.uniformMatrix4fv(this.loc.m,false,M);gl.uniform1f(this.loc.heat,0);gl.uniform1f(this.loc.roughness,roughness);gl.uniform1f(this.loc.skin,skin);gl.drawArrays(gl.TRIANGLES,0,part.count);gl.uniform1f(this.loc.skin,0);}
    drawArms(P,base){
      const gl=this.gl;if(!this.armParts)return;const m=this.ctx.weaponMechanism.state;
      if(m.inspectMode==='EXPLODED')return;
      // QueQuest 20.0: a real CC0 hand (Quaternius, offline-posed on the grip) instead of the sleeve + ellipsoid.
      if(this.realArm&&m.inspectMode==='INSPECT')return; // inspect brings the gun to the centre: the forearm would cover the screen
      if(this.realArm){gl.useProgram(this.p);this.drawPart(this.realArm,P,this.partMatrix('body',base),.82,1);return;}
      const re=m.reloadTimer>0?1-m.reloadTimer:0,rel=m.reloadTimer>0?Math.sin(Math.PI*Math.min(1,re/.82)):0;
      // Firing arm: broad sleeve from lower-right into the pistol grip.
      const sleeve=mul(base,mul(translate(.195,-.285,.175),mul(rotZ(-.31-.03*rel),mul(rotX(-.10),scale(.32,.58,.32)))));
      // Compact glove around the rear of the grip. Depth testing lets the real gun occlude it.
      const hand=mul(base,mul(translate(.065,-.025,.135),mul(rotZ(-.14),mul(rotX(-.07),scale(.082,.135,.072)))));
      gl.useProgram(this.p);this.drawPart(this.armParts.sleeve,P,sleeve,.88);this.drawPart(this.armParts.hand,P,hand,.96);
    }
    use3D(){return !!(this.ready&&this.ctx.world?.realm!=='dream'&&this.ctx.player?.state?.weapon==='SERVICE_PISTOL');}
    resize(){const d=Math.min(devicePixelRatio||1,1.75),w=Math.floor(innerWidth*d),h=Math.floor(innerHeight*d);if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}this.gl.viewport(0,0,w,h);return w/h;}
    targetPose(){const m=this.ctx.weaponMechanism?.state;if(!m)return POSES.NORMAL;if(m.inspectMode==='EXPLODED')return POSES.EXPLODED;if(m.inspectMode==='INSPECT')return POSES.INSPECT;if(m.reloadTimer>0)return POSES.RELOAD;if(this.ctx.player?.state?.aiming)return POSES.AIM;return POSES.NORMAL;}
    updateVisualState(){const now=performance.now(),dt=Math.min(.05,Math.max(.001,(now-this.lastT)/1000));this.lastT=now;const target=this.targetPose(),k=1-Math.exp(-dt*10);for(const key of ['x','y','z','yaw','pitch','roll','scale'])this.pose[key]=lerp(this.pose[key],target[key],k);const ex=this.ctx.weaponMechanism?.state?.inspectMode==='EXPLODED'?1:0;this.explodeBlend=lerp(this.explodeBlend,ex,1-Math.exp(-dt*8));const p=this.ctx.player?.state,m=this.ctx.weaponMechanism?.state;if(p){if(this.lookLag.lastYaw===null){this.lookLag.lastYaw=p.yaw;this.lookLag.lastPitch=p.pitch;}let dy=p.yaw-this.lookLag.lastYaw;if(dy>Math.PI)dy-=Math.PI*2;else if(dy<-Math.PI)dy+=Math.PI*2;const dp=p.pitch-this.lookLag.lastPitch,ky=1-Math.exp(-dt*18),targetYaw=Math.max(-.085,Math.min(.085,dy*3.0)),targetPitch=Math.max(-.07,Math.min(.07,dp*3.1));this.lookLag.yaw=lerp(this.lookLag.yaw,targetYaw,ky);this.lookLag.pitch=lerp(this.lookLag.pitch,targetPitch,ky);this.lookLag.lastYaw=p.yaw;this.lookLag.lastPitch=p.pitch;let wallTarget=0,wallSideTarget=0;if(m?.inspectMode==='NORMAL'&&!(m.reloadTimer>0)){const ro=this.ctx.player.camera(),rd=this.ctx.player.cameraForward(),h=this.ctx.world?.raycast?.(ro,rd,1.08,{includeBot:false});if(h?.type==='object'&&!h.o?.walkable){wallTarget=Math.max(0,Math.min(1,(1.02-h.t)/.60));const right=this.ctx.player.cameraRight?.()||[1,0,0];wallSideTarget=Math.max(-1,Math.min(1,V3.dot(h.n||[0,0,0],right)));}}this.wallBlend=lerp(this.wallBlend,wallTarget,1-Math.exp(-dt*(wallTarget>this.wallBlend?16:10)));this.wallSide=lerp(this.wallSide,wallSideTarget,1-Math.exp(-dt*12));}}
    viewportTuning(){const aspect=this.canvas.width/Math.max(1,this.canvas.height),base=16/9,narrow=Math.max(0,Math.min(1,(base-aspect)/(base-4/3))),wide=Math.max(0,Math.min(1,(aspect-base)/(21/9-base)));return{x:-.055*narrow+.052*wide,y:.018*narrow-.008*wide,z:-.085*narrow-.018*wide,scale:1-.085*narrow-.018*wide};}
    baseMatrix(){const p=this.ctx.player.state,w=this.ctx.weapons,m=this.ctx.weaponMechanism.state,t=performance.now()*.001,speed=Math.min(1,Math.hypot(p.vel[0],p.vel[2])/QQ.Config.player.runSpeed)*(1-.9*(this.aimBlend=lerp(this.aimBlend||0,p.aiming&&m.inspectMode==='NORMAL'&&!(m.reloadTimer>0)?1:0,.18))),active=m.inspectMode==='NORMAL',vp=this.viewportTuning();
      const bobX=active?Math.sin(t*8.4)*.008*speed:0,bobY=active?Math.abs(Math.cos(t*8.4))*.006*speed:0,stepRoll=active?Math.sin(t*8.4)*.010*speed:0,breath=active?Math.sin(t*1.45)*.004*(1-.75*this.aimBlend):0,recoil=active?(w.recoil||0):0,shot=active?(w.shotEnvelope||0):0,shotKick=Math.pow(Math.max(0,Math.min(1,shot)),1.55),shotSettle=active&&shot>0?Math.sin(Math.PI*(1-shot))*Math.min(1,shot*2.4):0,cycleKick=active?Math.max(0,m.slide||0)*.012:0,lag=active?this.lookLag:{yaw:0,pitch:0},wall=active?this.wallBlend:0,wallSide=active?this.wallSide:0;
      const re=m.reloadTimer>0?1-m.reloadTimer:0,reloadArc=m.reloadTimer>0?Math.sin(Math.PI*Math.min(1,re)):0,reloadSettle=m.reloadTimer>0&&re>.52?Math.sin(Math.min(1,(re-.52)/.48)*Math.PI)*.5:0;
      const inspectTurn=m.inspectMode==='INSPECT'?Math.sin(t*.72)*.045:0,T=translate(this.pose.x+vp.x+bobX+lag.yaw*.22-.018*reloadArc+.045*wall-.026*wall*wallSide,this.pose.y+vp.y+bobY+breath+recoil*.028+cycleKick+shotKick*.010-shotSettle*.006-lag.pitch*.18-.025*reloadArc-.115*wall,this.pose.z+vp.z+recoil*.085+shotKick*.034-shotSettle*.018+.018*reloadSettle+.055*wall),R=mul(rotZ(this.pose.roll-recoil*.11-shotKick*.018+shotSettle*.008-stepRoll-lag.yaw*.12+.045*reloadArc+.035*wall+.026*wall*wallSide),mul(rotY(this.pose.yaw+inspectTurn-lag.yaw*.48-.055*reloadArc-.085*wall-.048*wall*wallSide),rotX(this.pose.pitch+recoil*.27+shotKick*.060-shotSettle*.025-lag.pitch*.42+.035*reloadSettle+.115*wall)));
      const sc=this.pose.scale*vp.scale;return mul(T,mul(R,scale(sc,sc,sc)));
    }
    reloadOffsets(){const m=this.ctx.weaponMechanism.state;if(!(m.reloadTimer>0))return{magX:0,magY:0,magZ:0,magPitch:0,magYaw:0,magRoll:0,rack:0};const e=1-m.reloadTimer;let d=0;if(e>=.18&&e<.36)d=ease((e-.18)/.18);else if(e>=.36&&e<.56)d=1;else if(e>=.56&&e<.74)d=1-ease((e-.56)/.18);const rack=e>.72&&e<.96?Math.sin(((e-.72)/.24)*Math.PI):0;return{magX:-.88*d,magY:-.58*d,magZ:.27*d,magPitch:-.36*d,magYaw:.50*d,magRoll:-.31*d,rack};}
    partMatrix(name,base){const m=this.ctx.weaponMechanism.state,r=this.reloadOffsets(),e=this.explodeBlend;let local=QQ.Math3D.identity();
      if(name==='slide'){const z=.062*Math.max(m.slide||0,r.rack);local=translate(0,.205*e,z+.025*e);}
      else if(name==='magazine'){local=mul(translate(r.magX,r.magY-.36*e,r.magZ+.08*e),mul(rotZ(r.magRoll),mul(rotY(r.magYaw),rotX(r.magPitch))));}
      else if(name==='barrel'){local=mul(translate(.155*e,.02*e,.015*e),rotY(-.08*e));}
      else if(name==='spring'){local=mul(translate(-.13*e,-.025*e,.035*e),rotY(.06*e));}
      else if(name==='body'){local=translate(0,-.025*e,.055*e);}
      return mul(base,local);
    }
    bindPart(part){const gl=this.gl,L=this.loc;gl.bindBuffer(gl.ARRAY_BUFFER,part.pos);gl.enableVertexAttribArray(L.pos);gl.vertexAttribPointer(L.pos,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,part.normal);gl.enableVertexAttribArray(L.normal);gl.vertexAttribPointer(L.normal,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,part.color);gl.enableVertexAttribArray(L.color);gl.vertexAttribPointer(L.color,3,gl.FLOAT,false,0,0);}
    drawFlash(P,M){const a=Math.max(this.ctx.weapons?.muzzle||0,(this.ctx.weapons?.shotEnvelope||0)*.78);if(a<=0)return;const gl=this.gl,L=this.flashLoc,m=this.muzzle,r=.045+.055*a,z=m[2]-.035,c=[m[0],m[1],z],q=r*.72,tip=z-.20;const verts=[
        ...c,m[0]-r,m[1],z,m[0],m[1]+r*1.45,z, ...c,m[0],m[1]+r*1.45,z,m[0]+r,m[1],z,
        ...c,m[0]+r,m[1],z,m[0],m[1]-r*.85,z, ...c,m[0],m[1]-r*.85,z,m[0]-r,m[1],z,
        m[0]-q,m[1],z,m[0]+q,m[1],z,m[0],m[1],tip, m[0],m[1]-q,z,m[0],m[1]+q,z,m[0],m[1],tip
      ];gl.useProgram(this.flashP);gl.bindBuffer(gl.ARRAY_BUFFER,this.flashB);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(L.pos);gl.vertexAttribPointer(L.pos,3,gl.FLOAT,false,0,0);gl.uniformMatrix4fv(L.m,false,M);gl.uniformMatrix4fv(L.p,false,P);gl.uniform1f(L.a,Math.min(1,a));gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.disable(gl.CULL_FACE);gl.drawArrays(gl.TRIANGLES,0,verts.length/3);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);}
    draw(){const gl=this.gl;if(!gl)return;const aspect=this.resize();gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(!this.use3D())return;this.updateVisualState();gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);const P=perspective(60*Math.PI/180,aspect,.05,5)/*QueQuest 20.0: viewmodel FOV 60 like CS (54-68); 42 flattened the forearms*/,base=this.baseMatrix(),m=this.ctx.weaponMechanism.state;gl.useProgram(this.p);gl.uniformMatrix4fv(this.loc.p,false,P);gl.uniform1f(this.loc.twilight,this.ctx.debug?.f3?1:0);gl.uniform1f(this.loc.heat,m.heat||0);gl.uniform1f(this.loc.roughness,.24);this.drawArms(P,base);
      const exploded=this.explodeBlend>.01,heat=Math.max(0,Math.min(1,m.heat||0)),heatByPart={body:.08,magazine:0,barrel:1.0,spring:.22,slide:.72};for(const name of ['body','magazine','barrel','spring','slide']){if((name==='magazine'||name==='barrel'||name==='spring')&&!exploded)continue;const part=this.parts[name];if(!part)continue;this.bindPart(part);gl.uniform1f(this.loc.roughness,name==='magazine'?.38:name==='body'?.30:.18);gl.uniform1f(this.loc.heat,heat*(heatByPart[name]??0));gl.uniformMatrix4fv(this.loc.m,false,this.partMatrix(name,base));gl.drawArrays(gl.TRIANGLES,0,part.count);}gl.uniform1f(this.loc.heat,0);if(m.inspectMode==='NORMAL'&&!(m.reloadTimer>0))this.drawFlash(P,this.partMatrix('slide',base));}
  }
  QQ.WeaponModelViewRenderer=WeaponModelViewRenderer;
})();
