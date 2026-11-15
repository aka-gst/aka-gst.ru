(() => {
  'use strict';
  const QQ=window.QQ;
  class WeaponViewRenderer{
    constructor(ctx,canvas){this.ctx=ctx;this.canvas=canvas;this.g=canvas.getContext('2d');}
    draw(){
      const c=this.g,W=this.canvas.width,H=this.canvas.height;c.clearRect(0,0,W,H);if(this.ctx.world.realm==='dream')return;
      const p=this.ctx.player.state,w=this.ctx.weapons,s=Math.min(W/1440,H/900),speed=Math.min(1,Math.hypot(p.vel[0],p.vel[2])/QQ.Config.player.runSpeed),t=performance.now()*.001;
      const inspect=this.ctx.weaponMechanism?.state?.inspectMode||'NORMAL',pistol=p.weapon==='SERVICE_PISTOL',exploded=pistol&&inspect==='EXPLODED',inspection=pistol&&inspect==='INSPECT',reload=pistol&&(this.ctx.weaponMechanism?.state?.reloadTimer||0)>0,model3D=pistol&&this.ctx.weaponModelView?.use3D?.();
      const bobX=exploded?0:Math.sin(t*9.2)*6*s*speed,bobY=exploded?0:Math.abs(Math.cos(t*9.2))*4*s*speed,breath=exploded?0:Math.sin(t*1.7)*1.8*s;
      const cx=exploded?W*.50:inspection&&!model3D?W*.56:model3D?W*.68:pistol?W*.62:W*.59;
      const baseY=exploded?H*.54:inspection&&!model3D?H*.72:reload&&!model3D?H*.84:model3D?H*.94:pistol?H*.90:H*.98;
      c.save();c.translate(cx+bobX,baseY+w.recoil*18*s+bobY+breath);
      const rot=p.weapon==='RAIL'?.025:p.weapon==='ROCKET'?.005:pistol?((inspection&&!model3D)?.10:exploded?0:model3D?.01:-.045):-.018;c.rotate(rot);
      if(!exploded&&!model3D)this.drawArm(s*(pistol?1.04:1));
      if(pistol&&!model3D)this.drawServicePistol(s,w);else if(!pistol)this.drawSciFiWeapon(p.weapon,s,w);
      c.restore();
    }
    drawArm(s){const c=this.g;let arm=c.createLinearGradient(-210*s,-85*s,-20*s,35*s);arm.addColorStop(0,'#0a0f11');arm.addColorStop(.55,'#182124');arm.addColorStop(1,'#303b3d');c.fillStyle=arm;c.beginPath();c.moveTo(-255*s,38*s);c.lineTo(-172*s,-92*s);c.lineTo(-74*s,-69*s);c.lineTo(-34*s,44*s);c.closePath();c.fill();c.strokeStyle='rgba(133,153,154,.18)';c.stroke();}
    drawModelArm(s){const c=this.g;
      // V14: the real 3D Pistol 2 remains foreground. The hand is intentionally understated:
      // a broad sleeve enters from lower-right and a compact glove disappears behind the grip.
      c.save();
      let sleeve=c.createLinearGradient(280*s,35*s,-8*s,-92*s);
      sleeve.addColorStop(0,'#070c0e');sleeve.addColorStop(.55,'#10191c');sleeve.addColorStop(1,'#1c292c');
      c.fillStyle=sleeve;c.strokeStyle='rgba(125,150,152,.12)';c.lineWidth=1*s;
      c.beginPath();
      c.moveTo(292*s,44*s);c.lineTo(120*s,43*s);
      c.quadraticCurveTo(55*s,-8*s,-14*s,-66*s);
      c.lineTo(20*s,-101*s);
      c.quadraticCurveTo(106*s,-36*s,205*s,20*s);
      c.closePath();c.fill();c.stroke();

      // Small cuff at the grip base.
      c.fillStyle='#0c1315';c.beginPath();
      c.moveTo(-18*s,-82*s);c.lineTo(19*s,-105*s);c.lineTo(34*s,-80*s);c.lineTo(-3*s,-57*s);c.closePath();c.fill();

      // Compact glove hidden by the 3D grip; only knuckle/palm edges should remain visible.
      c.fillStyle='#121b1e';c.strokeStyle='rgba(148,169,170,.14)';c.beginPath();
      c.moveTo(-20*s,-137*s);c.quadraticCurveTo(-31*s,-128*s,-28*s,-110*s);
      c.lineTo(-23*s,-88*s);c.quadraticCurveTo(-17*s,-76*s,-4*s,-75*s);
      c.quadraticCurveTo(11*s,-75*s,15*s,-90*s);c.lineTo(19*s,-116*s);
      c.quadraticCurveTo(19*s,-131*s,6*s,-138*s);c.quadraticCurveTo(-7*s,-144*s,-20*s,-137*s);c.closePath();c.fill();c.stroke();
      c.strokeStyle='rgba(150,173,175,.10)';c.beginPath();c.moveTo(-16*s,-105*s);c.lineTo(12*s,-104*s);c.stroke();
      c.restore();
    }
    drawSciFiWeapon(name,s,w){const c=this.g;let grad=c.createLinearGradient(-150*s,-210*s,250*s,-40*s);grad.addColorStop(0,'#0d1519');grad.addColorStop(.28,'#26343a');grad.addColorStop(.58,'#53636a');grad.addColorStop(1,'#11191d');c.fillStyle=grad;c.strokeStyle='#7b9098';c.lineWidth=1.6*s;
      if(name==='RAIL'){this.poly([[-170,-118],[-100,-191],[105,-184],[238,-126],[226,-65],[-88,-54]],s);this.panel(12,-176,116,7,'#5be4ff',s);this.panel(-92,-145,54,18,'#23373f',s);}
      else if(name==='ROCKET'){this.poly([[-142,-108],[-70,-210],[122,-202],[246,-143],[232,-63],[-80,-52]],s);this.panel(88,-191,58,18,'#d9783f',s);this.panel(-76,-151,48,12,'#8e3c28',s);}
      else if(name==='SHOCK'){this.poly([[-158,-112],[-82,-184],[100,-211],[240,-133],[220,-63],[-90,-53]],s);c.fillStyle='#8d67ff';c.beginPath();c.arc(78*s,-176*s,23*s,0,Math.PI*2);c.fill();c.strokeStyle='#c8b3ff';c.stroke();this.panel(-80,-145,62,10,'#44346e',s);}
      else{this.poly([[-132,-101],[-68,-164],[76,-178],[185,-108],[164,-59],[-74,-53]],s);this.panel(42,-166,56,7,'#55e5f1',s);this.panel(-65,-132,48,12,'#274349',s);}
      this.drawStatusStrips(name,s);this.drawMuzzle(238*s,-127*s,name,w,s);
    }
    drawServicePistol(s,w){
      const c=this.g,m=this.ctx.weaponMechanism.state,exploded=m.inspectMode==='EXPLODED',inspect=m.inspectMode==='INSPECT';s*=exploded?1.10:inspect?1.24:1.30;
      const elapsed=m.reloadTimer>0?1-m.reloadTimer:0;let magDrop=0;if(m.reloadTimer>0){if(elapsed<.18)magDrop=0;else if(elapsed<.36)magDrop=120*this.easeOut((elapsed-.18)/.18);else if(elapsed<.56)magDrop=120;else if(elapsed<.74)magDrop=120*(1-this.easeInOut((elapsed-.56)/.18));}
      const rack=m.reloadTimer>0&&elapsed>.72&&elapsed<.96?Math.sin(((elapsed-.72)/.24)*Math.PI):0,slide=Math.max(m.slide,rack),slideBack=exploded?0:34*slide;
      const off=exploded?{slide:[0,-116],barrel:[12,-48],spring:[-8,-10],frame:[0,48],mag:[-18,152]}:{slide:[-slideBack,0],barrel:[0,0],spring:[0,0],frame:[0,0],mag:[0,magDrop]};
      if(exploded){this.drawPistolGhost(s,m);this.drawAssemblyAxis(s);}
      this.drawPistolFrame(s,off.frame[0],off.frame[1]);
      this.drawPistolMagazine(s,off.mag[0],off.mag[1],m);
      this.drawPistolBarrel(s,off.barrel[0],off.barrel[1]);
      this.drawPistolSpring(s,off.spring[0],off.spring[1]);
      this.drawPistolSlide(s,off.slide[0],off.slide[1],m);
      if(!exploded)this.drawPistolIndicators(s,m);
      if(exploded&&this.ctx.debug?.f3)this.drawAssemblyNumbers(s);
      this.drawMuzzle(152*s,exploded?-96*s:-132*s,'SERVICE_PISTOL',w,s);
    }
    drawPistolFrame(s,ox=0,oy=0){const c=this.g;c.save();c.translate(ox*s,oy*s);c.lineWidth=1.6*s;c.strokeStyle='#849497';let g=c.createLinearGradient(-100*s,-95*s,80*s,36*s);g.addColorStop(0,'#1b2426');g.addColorStop(.62,'#263235');g.addColorStop(1,'#111819');c.fillStyle=g;this.poly([[-112,-86],[64,-92],[89,-66],[66,-43],[-10,-43],[2,-18],[-18,14],[-31,73],[-82,66],[-92,9],[-71,-41],[-112,-50]],s);
      c.fillStyle='#0b1112';this.poly([[-48,-36],[-2,-35],[-10,11],[-31,57],[-67,53],[-70,2]],s);c.strokeStyle='rgba(185,204,204,.22)';for(let y=2;y<46;y+=8){c.beginPath();c.moveTo(-60*s,y*s);c.lineTo(-26*s,(y+4)*s);c.stroke();}
      // trigger guard + trigger make the silhouette immediately read as a pistol
      c.strokeStyle='#7f9093';c.lineWidth=4*s;c.beginPath();c.ellipse(4*s,-30*s,28*s,22*s,0,0,Math.PI*2);c.stroke();c.strokeStyle='#c6d0cf';c.lineWidth=2*s;c.beginPath();c.moveTo(4*s,-41*s);c.quadraticCurveTo(15*s,-29*s,7*s,-17*s);c.stroke();
      c.restore();}
    drawPistolSlide(s,ox,oy,m){const c=this.g;c.save();c.translate(ox*s,oy*s);let g=c.createLinearGradient(-140*s,-160*s,145*s,-92*s);g.addColorStop(0,'#202a2c');g.addColorStop(.42,'#667174');g.addColorStop(.72,'#3a4649');g.addColorStop(1,'#151d1f');c.fillStyle=g;c.strokeStyle='#a6b1b2';c.lineWidth=1.7*s;this.poly([[-140,-151],[117,-151],[151,-133],[143,-98],[-128,-98]],s);c.fillStyle='#0a0f10';c.fillRect(116*s,-140*s,26*s,24*s);for(let i=0;i<7;i++)c.fillRect((-111+i*8)*s,-146*s,3*s,42*s);c.fillStyle='#899496';c.fillRect(-126*s,-100*s,264*s,3*s);if(m.slideLocked){c.fillStyle='#c88955';c.fillRect(-8*s,-95*s,30*s,4*s);}c.restore();}
    drawPistolBarrel(s,ox,oy){const c=this.g;c.save();c.translate(ox*s,oy*s);c.fillStyle='#697579';c.strokeStyle='#afb8b8';c.lineWidth=1.2*s;c.beginPath();c.roundRect(-72*s,-132*s,188*s,18*s,7*s);c.fill();c.stroke();c.fillStyle='#0a0f10';c.beginPath();c.ellipse(116*s,-123*s,13*s,9*s,0,0,Math.PI*2);c.fill();c.restore();}
    drawPistolSpring(s,ox,oy){const c=this.g;c.save();c.translate(ox*s,oy*s);c.strokeStyle='#b7c0c0';c.lineWidth=2*s;c.beginPath();for(let i=0;i<23;i++){const x=(-66+i*7.5)*s,y=(-102+(i%2?4:-4))*s;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();c.strokeStyle='#596567';c.beginPath();c.moveTo(-70*s,-102*s);c.lineTo(104*s,-102*s);c.stroke();c.restore();}
    drawPistolMagazine(s,ox,oy,m){const c=this.g;c.save();c.translate(ox*s,oy*s);c.fillStyle='#273235';c.strokeStyle='#8b999b';c.lineWidth=1.4*s;c.beginPath();c.roundRect(-52*s,-30*s,34*s,98*s,5*s);c.fill();c.stroke();c.fillStyle='#111819';c.fillRect(-47*s,-22*s,24*s,79*s);for(let i=0;i<Math.min(12,m.magazine);i++){c.fillStyle=i<6?'#d2ab62':'#aa874b';c.fillRect((-44+(i%2)*11)*s,(-15+Math.floor(i/2)*10)*s,7*s,4*s);}c.fillStyle='#829194';c.fillRect(-56*s,-31*s,42*s,6*s);c.restore();}
    drawPistolIndicators(s,m){const c=this.g;c.fillStyle=m.chamber?'#e0c17b':'#3d4748';c.beginPath();c.arc(66*s,-112*s,5*s,0,Math.PI*2);c.fill();if(m.heat>.02){c.globalAlpha=.22+.45*m.heat;c.fillStyle='#ff7c42';c.beginPath();c.arc(66*s,-112*s,(8+14*m.heat)*s,0,Math.PI*2);c.fill();c.globalAlpha=1;}c.fillStyle='rgba(3,8,9,.75)';c.beginPath();c.roundRect(-106*s,-86*s,70*s,18*s,3*s);c.fill();c.fillStyle='#bed0d0';c.font=`${9*s}px ui-monospace,monospace`;c.fillText(`${m.magazine}${m.chamber?'+1':''}`,-97*s,-73*s);if(m.reloadTimer>0){c.fillStyle='rgba(83,193,190,.75)';c.fillRect(-106*s,-64*s,70*s*(1-m.reloadTimer),3*s);}}
    drawPistolGhost(s,m){const c=this.g;c.save();c.globalAlpha=.11;c.filter='saturate(.65) brightness(1.35)';this.drawPistolFrame(s,0,0);this.drawPistolMagazine(s,0,0,m);this.drawPistolBarrel(s,0,0);this.drawPistolSpring(s,0,0);this.drawPistolSlide(s,0,0,m);c.filter='none';c.globalAlpha=1;c.restore();}
    drawAssemblyAxis(s){const c=this.g;c.save();c.setLineDash([5*s,8*s]);c.strokeStyle='rgba(105,183,180,.22)';c.lineWidth=1*s;c.beginPath();c.moveTo(-150*s,-123*s);c.lineTo(170*s,-123*s);c.moveTo(-36*s,-220*s);c.lineTo(-36*s,220*s);c.stroke();c.setLineDash([]);c.restore();}
    drawAssemblyNumbers(s){const c=this.g,pts=[[-136,-184,'1'],[130,-104,'2'],[-126,-37,'3'],[96,81,'4'],[-77,214,'5']];c.save();c.font=`600 ${10*s}px -apple-system,Segoe UI,sans-serif`;for(const [x,y,n] of pts){c.fillStyle='rgba(6,13,14,.75)';c.strokeStyle='rgba(116,209,204,.62)';c.lineWidth=1*s;c.beginPath();c.arc(x*s,y*s,11*s,0,Math.PI*2);c.fill();c.stroke();c.fillStyle='#bde3df';c.textAlign='center';c.textBaseline='middle';c.fillText(n,x*s,y*s);}c.restore();}
    easeOut(t){t=Math.max(0,Math.min(1,t));return 1-Math.pow(1-t,3)} easeInOut(t){t=Math.max(0,Math.min(1,t));return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}
    drawStatusStrips(name,s){const c=this.g,p=this.ctx.player.state,hp=Math.max(0,Math.min(1,p.hp/100)),armor=Math.max(0,Math.min(1,p.armor/100));c.fillStyle='#071014';c.fillRect(-54*s,-104*s,96*s,19*s);c.fillStyle=hp>.35?'#61e6a2':'#ff6255';c.fillRect(-49*s,-100*s,82*s*hp,5*s);c.fillStyle='#65c8ff';c.fillRect(-49*s,-91*s,82*s*armor,3*s);c.fillStyle='#8398a1';c.font=`${9*s}px ui-monospace,monospace`;c.fillText(name,-45*s,-110*s);}
    drawMuzzle(x,y,name,w,s){const c=this.g;if(w.muzzle<=0)return;c.globalAlpha=Math.min(1,w.muzzle);const r=(23+30*w.muzzle)*s;let mg=c.createRadialGradient(x,y,0,x,y,r);mg.addColorStop(0,'rgba(255,255,238,1)');mg.addColorStop(.25,name==='SHOCK'?'rgba(174,130,255,.9)':'rgba(255,194,95,.95)');mg.addColorStop(1,'rgba(255,120,40,0)');c.fillStyle=mg;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();c.globalAlpha=1;}
    panel(x,y,w,h,color,s){const c=this.g;c.fillStyle=color;c.fillRect(x*s,y*s,w*s,h*s);c.fillStyle='rgba(255,255,255,.22)';c.fillRect(x*s,y*s,w*s,1*s);}
    poly(pts,s){const c=this.g;c.beginPath();pts.forEach((p,i)=>(i?c.lineTo(p[0]*s,p[1]*s):c.moveTo(p[0]*s,p[1]*s)));c.closePath();c.fill();c.stroke();}
  }
  QQ.WeaponViewRenderer=WeaponViewRenderer;
})();
