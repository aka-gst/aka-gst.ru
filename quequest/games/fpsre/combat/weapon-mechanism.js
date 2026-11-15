(() => {
  'use strict';
  const QQ=window.QQ,{V3}=QQ.Math3D;
  class WeaponMechanismSystem{
    constructor(ctx){
      this.ctx=ctx;
      const cfg=QQ.Config.weapons.SERVICE_PISTOL;
      this.state={
        magazine:cfg.magCapacity,
        reserve:cfg.reserve,
        chamber:1,
        slide:0,
        slideLocked:false,
        cycleTimer:0,
        cycleStage:'READY',
        springCompression:0,
        reloadTimer:0,
        reloadStage:'READY',
        inspectMode:'NORMAL',
        heat:0,
        shots:0,
        ejected:0
      };
      this.flags={ejected:false,magOut:false,magIn:false,racked:false};
    }
    cfg(){return QQ.Config.weapons.SERVICE_PISTOL;}
    busy(){return this.state.reloadTimer>0||this.state.inspectMode!=='NORMAL';}
    onWeaponSelected(name){if(name!=='SERVICE_PISTOL'&&this.state.inspectMode!=='NORMAL')this.state.inspectMode='NORMAL';}
    trigger(){
      const s=this.state;
      if(s.reloadTimer>0){this.ctx.ui.msg('ПЕРЕЗАРЯДКА');return false;}
      if(s.inspectMode!=='NORMAL'){this.ctx.ui.msg('ЗАКРОЙ ОСМОТР // I');return false;}
      if(s.chamber<=0){
        this.ctx.audio.mechanical?.('dry');
        this.ctx.emit('WEAPON_DRY_FIRE',{weapon:'SERVICE_PISTOL',magazine:s.magazine,chamber:s.chamber});
        if(s.magazine<=0)s.slideLocked=true;
        return false;
      }
      s.chamber=0;s.slideLocked=false;s.cycleTimer=.135;s.cycleStage='IGNITION';s.slide=0;s.springCompression=0;s.heat=Math.min(1,s.heat+.14);s.shots++;
      this.flags.ejected=false;
      this.ctx.audio.noise(.045,.035);this.ctx.audio.tone(185,.045,.026,'square');
      this.ctx.emit('WEAPON_MECHANISM',{weapon:'SERVICE_PISTOL',stage:'IGNITION',shots:s.shots});
      return true;
    }
    update(dt){
      const s=this.state;
      s.heat=Math.max(0,s.heat-dt*.085);
      if(s.cycleTimer>0){
        const before=s.cycleTimer;s.cycleTimer=Math.max(0,s.cycleTimer-dt);
        const progress=1-s.cycleTimer/.135;
        // slide travels rearward, then returns under spring tension
        s.slide=progress<.42?progress/.42:Math.max(0,1-(progress-.42)/.58);s.springCompression=Math.min(1,s.slide);s.cycleStage=progress<.18?'IGNITION':progress<.42?'RECOIL':progress<.56?'EXTRACT':'RETURN';
        if(!this.flags.ejected&&progress>.34){
          this.flags.ejected=true;s.ejected++;
          const cam=this.ctx.player.camera(),right=this.ctx.player.cameraRight(),forward=this.ctx.player.cameraForward();
          const casingPos=V3.add(cam,V3.add(V3.mul(right,.24),V3.mul(forward,.34)));
          this.ctx.fx.debris.push({kind:'casing',pos:casingPos,vel:V3.add(V3.add(V3.mul(right,2.55),V3.mul(forward,.22)),[0,1.9,0]),life:2.8,color:[.78,.58,.22],size:.038,rx:Math.random()*.8,ry:Math.random()*.8,rz:Math.random()*.8,spin:11+Math.random()*9,spinX:8+Math.random()*7,spinZ:6+Math.random()*8,groundHits:0});
          this.ctx.emit('WEAPON_MECHANISM',{weapon:'SERVICE_PISTOL',stage:'EXTRACT',ejected:s.ejected});
        }
        if(before>0&&s.cycleTimer===0){
          if(s.magazine>0){s.magazine--;s.chamber=1;s.slideLocked=false;s.cycleStage='FEED';s.springCompression=0;this.ctx.emit('WEAPON_MECHANISM',{weapon:'SERVICE_PISTOL',stage:'FEED',magazine:s.magazine,chamber:s.chamber});}
          else{s.chamber=0;s.slideLocked=true;s.slide=1;s.cycleStage='SLIDE_LOCK';s.springCompression=1;this.ctx.emit('WEAPON_MECHANISM',{weapon:'SERVICE_PISTOL',stage:'SLIDE_LOCK',magazine:0,chamber:0});}
        }
      }else if(s.slideLocked){s.slide=1;s.cycleStage='SLIDE_LOCK';s.springCompression=1;} else {s.slide=Math.max(0,s.slide-dt*10);s.springCompression=Math.max(0,s.springCompression-dt*9);if(s.reloadTimer<=0)s.cycleStage='READY';}
      this.updateReload(dt);
    }
    startReload(){
      const s=this.state,c=this.cfg();
      if(s.reloadTimer>0)return false;
      if(s.reserve<=0){this.ctx.ui.msg('НЕТ ЗАПАСА');this.ctx.emit('WEAPON_RELOAD_DENIED',{reason:'NO_RESERVE'});return false;}
      if(s.magazine>=c.magCapacity&&s.chamber>0){this.ctx.ui.msg('МАГАЗИН ПОЛОН');return false;}
      s.inspectMode='NORMAL';s.reloadTimer=1.0;s.reloadStage='START';
      this.flags.magOut=this.flags.magIn=this.flags.racked=false;
      this.ctx.audio.mechanical?.('click');
      this.ctx.emit('WEAPON_RELOAD_START',{weapon:'SERVICE_PISTOL',magazine:s.magazine,reserve:s.reserve,chamber:s.chamber});
      return true;
    }
    updateReload(dt){
      const s=this.state;if(s.reloadTimer<=0)return;
      s.reloadTimer=Math.max(0,s.reloadTimer-dt);const elapsed=1-s.reloadTimer;
      if(!this.flags.magOut&&elapsed>=.22){
        this.flags.magOut=true;s.reloadStage='MAG_OUT';s.reserve+=s.magazine;s.magazine=0;
        this.ctx.audio.mechanical?.('magOut');this.ctx.emit('WEAPON_MECHANISM',{weapon:'SERVICE_PISTOL',stage:'MAG_OUT'});
      }
      if(!this.flags.magIn&&elapsed>=.54){
        this.flags.magIn=true;s.reloadStage='MAG_IN';const take=Math.min(this.cfg().magCapacity,s.reserve);s.magazine=take;s.reserve-=take;
        this.ctx.audio.mechanical?.('magIn');this.ctx.emit('WEAPON_MECHANISM',{weapon:'SERVICE_PISTOL',stage:'MAG_IN',magazine:s.magazine,reserve:s.reserve});
      }
      if(!this.flags.racked&&elapsed>=.76&&s.chamber===0&&s.magazine>0){
        this.flags.racked=true;s.reloadStage='RACK';s.slide=.95;s.magazine--;s.chamber=1;s.slideLocked=false;
        this.ctx.audio.mechanical?.('rack');this.ctx.emit('WEAPON_MECHANISM',{weapon:'SERVICE_PISTOL',stage:'RACK_AND_FEED',magazine:s.magazine,chamber:s.chamber});
      }
      if(s.reloadTimer===0){s.reloadStage='READY';s.slide=s.slideLocked?1:0;this.ctx.audio.mechanical?.('click');this.ctx.emit('WEAPON_RELOAD_END',{weapon:'SERVICE_PISTOL',magazine:s.magazine,reserve:s.reserve,chamber:s.chamber});}
    }
    toggleInspect(exploded=false){
      const s=this.state;if(this.ctx.player.state.weapon!=='SERVICE_PISTOL'){this.ctx.ui.msg('ОСМОТР ДОСТУПЕН ДЛЯ SERVICE PISTOL');return false;}
      if(s.reloadTimer>0)return false;
      if(exploded)s.inspectMode=s.inspectMode==='EXPLODED'?'NORMAL':'EXPLODED';
      else s.inspectMode=s.inspectMode==='NORMAL'?'INSPECT':'NORMAL';
      this.ctx.audio.mechanical?.('inspect');this.ctx.emit('WEAPON_INSPECT_MODE',{weapon:'SERVICE_PISTOL',mode:s.inspectMode});
      this.ctx.ui.msg(s.inspectMode==='NORMAL'?'ОСМОТР ЗАКРЫТ':s.inspectMode==='INSPECT'?'ОСМОТР МЕХАНИЗМА':'РАЗОБРАННЫЙ ВИД');
      return true;
    }
    ammoText(){const s=this.state;return `${s.magazine}${s.chamber?'+1':''} / ${s.reserve}`;}
    debugText(){const s=this.state;return [
      'SERVICE PISTOL // МЕХАНИЗМ',
      `ПАТРОННИК  ${s.chamber?'ЗАРЯЖЕН':'ПУСТ'}`,
      `МАГАЗИН    ${s.magazine}/${this.cfg().magCapacity}`,
      `ЗАПАС      ${s.reserve}`,
      `ЗАТВОР     ${s.slideLocked?'ЗАДЕРЖКА':s.cycleTimer>0?s.cycleStage:'ВПЕРЁД'}`,
      `ПРУЖИНА    ${Math.round(s.springCompression*100)}%`,
      `НАГРЕВ     ${Math.round(s.heat*100)}%`,
      `РЕЖИМ      ${s.inspectMode}`,
      '',
      'МАГАЗИН → ПОДАЧА → ПАТРОННИК',
      'СПУСК → ВЫСТРЕЛ → ОТКАТ ЗАТВОРА',
      'ЭКСТРАКЦИЯ → ВОЗВРАТ → ПОДАЧА'
    ].join('\n');}
  }
  QQ.WeaponMechanismSystem=WeaponMechanismSystem;
})();
