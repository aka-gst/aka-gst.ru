(() => {
  'use strict';
  const QQ=window.QQ,{V3,lerp}=QQ.Math3D,C=QQ.Config.player;
  class PlayerSystem{
    constructor(ctx){this.ctx=ctx;this.state={pos:[-8.75,0,15.6],vel:[0,0,0],yaw:0/*QueQuest 20.0: face the corridor (forward = −z at yaw 0); π faced the wall behind*/,pitch:0,hp:100,armor:0,weapon:'RAIL',score:0,onGround:true,powerUntil:0};this.keys=new Set();this.damageFlash=0;}
    cameraForward(){const p=this.state,cp=Math.cos(p.pitch),sp=Math.sin(p.pitch),sy=Math.sin(p.yaw),cy=Math.cos(p.yaw);return V3.norm([sy*cp,sp,-cy*cp]);}
    cameraRight(){const p=this.state;return[Math.cos(p.yaw),0,Math.sin(p.yaw)];}
    camera(){const p=this.state;return[p.pos[0],p.pos[1]+C.eyeHeight,p.pos[2]];}
    damage(amount,kind){const p=this.state;let left=amount;if(p.armor>0){const a=Math.min(p.armor,left*.55);p.armor-=a;left-=a}p.hp-=left;this.damageFlash=.65;this.ctx.emit('DAMAGE',{target:'PLAYER',amount:+left.toFixed(1),kind,hp:+p.hp.toFixed(1)});if(p.hp<=0){p.hp=100;p.armor=0;p.pos=this.ctx.world.realm==='day'?[-8.75,0,15.6]:[0,0,10];p.vel=[0,0,0];this.ctx.ui.msg('RESPAWN');this.ctx.emit('PLAYER_RESPAWN');}}
    update(dt){const p=this.state,w=this.ctx.world;if(this.ctx.debug.paused)return;const f=this.cameraForward(),r=this.cameraRight();let mx=0,mz=0;if(this.keys.has('KeyW')){mx+=f[0];mz+=f[2]}if(this.keys.has('KeyS')){mx-=f[0];mz-=f[2]}if(this.keys.has('KeyD')){mx+=r[0];mz+=r[2]}if(this.keys.has('KeyA')){mx-=r[0];mz-=r[2]}const ml=Math.hypot(mx,mz)||1,moving=Math.hypot(mx,mz)>0.01,speed=this.keys.has('ShiftLeft')?C.runSpeed:C.walkSpeed;mx=mx/ml*speed;mz=mz/ml*speed;p.vel[0]=lerp(p.vel[0],moving?mx:0,dt*(p.onGround?10:2.2));p.vel[2]=lerp(p.vel[2],moving?mz:0,dt*(p.onGround?10:2.2));p.vel[1]-=C.gravity*dt;let nx=p.pos[0]+p.vel[0]*dt,nz=p.pos[2]+p.vel[2]*dt;if(!w.collidesXZ(nx,p.pos[2],p.pos[1]))p.pos[0]=nx;else p.vel[0]=0;if(!w.collidesXZ(p.pos[0],nz,p.pos[1]))p.pos[2]=nz;else p.vel[2]=0;const nextY=p.pos[1]+p.vel[1]*dt;if(p.vel[1]>0){const ceil=w.ceilingAt?.(p.pos[0],p.pos[2],p.pos[1],nextY);if(ceil){p.pos[1]=ceil.feetY;p.vel[1]=0;}else p.pos[1]=nextY;}else p.pos[1]=nextY;const fl=w.floorAt(p.pos[0],p.pos[2],p.pos[1]+.3);if(p.pos[1]<=fl){p.pos[1]=fl;p.vel[1]=0;p.onGround=true}else p.onGround=false;const jp=this.ctx.level.jumpPad;if(w.realm==='day'&&Math.hypot(p.pos[0]-jp.x,p.pos[2]-jp.z)<jp.r&&p.pos[1]<.35){p.vel[1]=10.5;p.onGround=false;this.ctx.emit('JUMP_PAD_IMPULSE',{vy:10.5});this.ctx.ui.msg('JUMP PAD // IMPULSE');}this.damageFlash=Math.max(0,this.damageFlash-dt*3.5);}
    jump(){const p=this.state;if(p.onGround&&!this.ctx.debug.paused){p.vel[1]=C.jumpSpeed;p.onGround=false;this.ctx.emit('JUMP');}}
  }
  QQ.PlayerSystem=PlayerSystem;
})();
