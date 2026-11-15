(() => {
  'use strict';
  const QQ=window.QQ;
  class ImpossibleGeometrySystem{
    constructor(ctx){this.ctx=ctx;this.loopCount=0;this.cooldown=0;this.discovered=false;}
    update(dt){
      if(this.ctx.world.realm!=='day')return;this.cooldown=Math.max(0,this.cooldown-dt);const p=this.ctx.player.state,l=this.ctx.level;
      const inCorridor=p.pos[0]>4.65&&p.pos[0]<7.55&&p.pos[2]<-20.6&&p.pos[2]>-31.2;
      if(inCorridor&&!this.discovered&&p.pos[2]<-27){this.discovered=true;this.ctx.emit('LIMINAL_CORRIDOR_NOTICED',{position:p.pos.map(v=>+v.toFixed(2))});}
      if(this.cooldown<=0&&inCorridor&&p.pos[2]<l.loopEnd[2]&&p.vel[2]<-.05){
        const overshoot=p.pos[2]-l.loopEnd[2];p.pos[2]=l.loopStart[2]+overshoot;p.vel[2]=Math.min(p.vel[2],-.1);this.cooldown=.18;this.loopCount++;
        const m=l.loopWitness;if(m){m.emissive=Math.min(1,.25+this.loopCount*.18);m.color=QQ.Math3D.rgb(this.loopCount%2?'#6dd7e8':'#a87cff');}
        this.ctx.emit('GEOMETRY_LOOP',{loop:this.loopCount,from:[+p.pos[0].toFixed(2),0,+l.loopEnd[2].toFixed(2)],to:[+p.pos[0].toFixed(2),0,+p.pos[2].toFixed(2)],velocityPreserved:true});
        this.ctx.audio?.tone?.(95,.08,.018,'sine');
        if(this.loopCount===2)this.ctx.ui.objective('РАССТОЯНИЕ ВЕДЁТ СЕБЯ НЕПРАВИЛЬНО','Ты уже проходил этот участок. F3 покажет скрытую связь, если захочешь проверить.');
      }
    }
    debugText(){return `LIMINAL LOOP\nworld segment = 8.70 m\ntopology edge = LOOP_END → LOOP_START\nvelocity = PRESERVED\nloops observed = ${this.loopCount}\nvisible portal = NO`;}
  }
  QQ.ImpossibleGeometrySystem=ImpossibleGeometrySystem;
})();
