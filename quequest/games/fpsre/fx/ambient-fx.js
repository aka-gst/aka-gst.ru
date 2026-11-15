(() => {
  'use strict';
  const QQ=window.QQ,{rgb}=QQ.Math3D;
  class AmbientFXSystem{
    constructor(ctx){this.ctx=ctx;this.steamT=0;this.dustT=0;this.sparkT=0;}
    spawn(pos,vel,color,life=1.5,size=22,gravity=0,drag=.22){this.ctx.fx.particles.push({pos:[...pos],vel:[...vel],life,max:life,color:[...color,1],size,gravity,drag});}
    update(dt){
      if(this.ctx.world.realm!=='day')return;this.steamT-=dt;this.dustT-=dt;this.sparkT-=dt;
      if(this.steamT<=0){this.steamT=.065+Math.random()*.08;const b=[14,.9,-2];this.spawn([b[0]+(Math.random()-.5)*.22,b[1],b[2]+(Math.random()-.5)*.22],[(Math.random()-.5)*.3,1.2+Math.random()*.8,(Math.random()-.5)*.3],rgb('#9dbbc0'),1.3+Math.random()*.7,30,-.35,.55);}
      if(this.dustT<=0){this.dustT=.12;const p=this.ctx.player.state.pos;for(let i=0;i<2;i++)this.spawn([p[0]+(Math.random()-.5)*12,.4+Math.random()*2.8,p[2]+(Math.random()-.5)*12],[(Math.random()-.5)*.08,.02+Math.random()*.06,(Math.random()-.5)*.08],rgb('#8aa1a5'),4+Math.random()*3,7+Math.random()*6,0,.12);}
      const state=this.ctx.director?.scene?.state;if((state==='FAILURE'||state==='BREACH')&&this.sparkT<=0){this.sparkT=.08+Math.random()*.12;const r=this.ctx.level.relay.pos;this.spawn([r[0]+(Math.random()-.5)*.5,r[1]+.4+Math.random()*1.2,r[2]+(Math.random()-.5)*.4],[(Math.random()-.5)*2,1+Math.random()*2,(Math.random()-.5)*2],rgb('#ffbd70'),.35+Math.random()*.35,20,7,.35);}
      for(const po of [this.ctx.level.portalA,this.ctx.level.portalB])if(po&&Math.random()<dt*14){const n=po.portal.normal;this.spawn([po.pos[0]+(Math.random()-.5)*(Math.abs(n[2])?3:.08),po.pos[1]+(Math.random()-.5)*2.4,po.pos[2]+(Math.random()-.5)*(Math.abs(n[0])?3:.08)],[n[0]*.18,n[1]*.18,n[2]*.18],po.color||rgb('#87eaff'),.8+Math.random()*.7,14,0,.08);}
    }
  }
  QQ.AmbientFXSystem=AmbientFXSystem;
})();
