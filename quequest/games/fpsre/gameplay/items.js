(() => {
  'use strict';
  const QQ=window.QQ,{V3}=QQ.Math3D;
  class ItemSystem{
    constructor(ctx){this.ctx=ctx;this.items=[{type:'MEGA',pos:[-10,.55,9],respawn:10,state:'up',next:0,value:100,color:QQ.Math3D.rgb('#67e8ff')},{type:'ARMOR',pos:[9,3.15,-7],respawn:14,state:'up',next:0,value:75,color:QQ.Math3D.rgb('#72d99a')},{type:'POWER',pos:[11,.55,10],respawn:18,state:'up',next:0,value:130,color:QQ.Math3D.rgb('#b184ff')}];}
    update(now){if(this.ctx.world.realm!=='day')return;const p=this.ctx.player.state,bot=this.ctx.ai.bot;for(const it of this.items){if(it.state!=='up'){const left=(it.next-now)/1000;if(left<=.85&&left>0)it.state='materializing';if(left<=0){it.state='up';this.ctx.fx.particlesBurst(it.pos,it.color,28,4,.7);this.ctx.fx.pulse(it.pos,it.color,.5);this.ctx.emit('ITEM_SPAWN',{item:it.type});}}const pp=[p.pos[0],0,p.pos[2]],ip=[it.pos[0],0,it.pos[2]];if(it.state==='up'&&V3.len(V3.sub(pp,ip))<1)this.pickup(it,'PLAYER',now);const bp=[bot.pos[0],0,bot.pos[2]];if(!bot.defeated&&bot.respawn<=0&&it.state==='up'&&V3.len(V3.sub(bp,ip))<.8)this.pickup(it,'Q-BOT',now);}}
    pickup(it,who,now){it.state='future';it.next=now+it.respawn*1000;this.ctx.fx.particlesBurst(it.pos,it.color,16,3,.45);this.ctx.emit('ITEM_PICKUP',{item:it.type,by:who,nextIn:it.respawn});if(who==='PLAYER'){const p=this.ctx.player.state;if(it.type==='MEGA')p.hp=Math.min(200,p.hp+100);if(it.type==='ARMOR')p.armor=Math.min(200,p.armor+100);if(it.type==='POWER')p.powerUntil=now+8000;this.ctx.ui.msg(`${it.type} ACQUIRED`);this.ctx.ui.objective('FUTURE MAP',`${it.type} is no longer "gone". It is now a future event: respawn in ${it.respawn}s.`);}else{this.ctx.ui.msg(`Q-BOT DENIAL: ${it.type}`);this.ctx.emit('DENIAL',{item:it.type,by:'Q-BOT'});}}
  }
  QQ.ItemSystem=ItemSystem;
})();
