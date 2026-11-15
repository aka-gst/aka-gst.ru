(() => {
  'use strict';
  const QQ=window.QQ,$=QQ.util.$;
  class HUDSystem{
    constructor(ctx){this.ctx=ctx;this.msgTimer=null;this.objectiveTimer=null;}
    msg(text){const e=$('pickupText');if(!e)return;e.textContent=text;e.style.opacity='';e.classList.add('show');clearTimeout(this.msgTimer);this.msgTimer=setTimeout(()=>e.classList.remove('show'),1250);}
    objective(title,text,hold=4200){const e=$('objective');$('objectiveTitle').textContent=title;$('objectiveText').textContent=text;e.classList.add('visible');clearTimeout(this.objectiveTimer);this.objectiveTimer=setTimeout(()=>e.classList.remove('visible'),hold);}
    setWeapon(name,desc){$('weaponName').textContent=name;$('weaponDesc').textContent=desc;}
    setDreamUI(on){$('dreamHud').classList.toggle('hidden',!on);$('itemTimers').classList.toggle('hidden',on);}
    update(now,fps){const p=this.ctx.player.state;$('damageFlash').style.background=`rgba(255,30,18,${this.ctx.player.damageFlash*.28})`;
      if(this.ctx.world.realm==='day')$('itemTimers').innerHTML=this.ctx.items.items.map(it=>{const left=it.state==='up'?0:Math.max(0,(it.next-now)/1000);return `<div class="timer ${it.state}"><b>${it.type}</b><span>${it.state==='up'?'UP':left.toFixed(1)+'s'}</span></div>`}).join('');
      else{$('dreamDepth').textContent=`DEPTH ${String(Math.max(1,Math.floor(p.pos[1]+1))).padStart(2,'0')}`;$('dreamCheckpoint').textContent=`NODE ${this.ctx.dream.state.checkpoint} · VOID ${this.ctx.dream.state.tideY.toFixed(1)}`;}
      if(p.weapon==='SERVICE_PISTOL')$('weaponDesc').textContent=this.ctx.weaponMechanism.ammoText();
    }
  }
  QQ.HUDSystem=HUDSystem;
})();
