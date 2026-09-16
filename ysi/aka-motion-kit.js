(function(){
  const reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const point=element=>{const rect=element.getBoundingClientRect();return{x:rect.left+rect.width/2,y:rect.top+rect.height/2}};
  const pulse=element=>{
    element.classList.remove('aka-arrived');
    requestAnimationFrame(()=>element.classList.add('aka-arrived'));
    setTimeout(()=>element.classList.remove('aka-arrived'),760);
  };
  async function send({source,stops,label,kind,onArrive}){
    if(reduceMotion()){
      stops.forEach((stop,index)=>{onArrive(index);pulse(stop)});
      return;
    }
    let from=point(source);
    for(let index=0;index<stops.length;index+=1){
      const stop=stops[index];
      const to=point(stop);
      const dx=to.x-from.x;
      const dy=to.y-from.y;
      const distance=Math.hypot(dx,dy);
      const angle=Math.atan2(dy,dx)*180/Math.PI;
      const beam=document.createElement('span');
      const packet=document.createElement('span');
      beam.className=`aka-sync-beam is-${kind}`;
      packet.className=`aka-sync-packet is-${kind}`;
      packet.textContent=label;
      beam.style.cssText=`left:${from.x}px;top:${from.y}px;width:${distance}px;transform:rotate(${angle}deg) scaleX(0)`;
      packet.style.cssText=`left:${from.x}px;top:${from.y}px`;
      document.body.append(beam,packet);
      const beamMotion=beam.animate([
        {opacity:0,transform:`rotate(${angle}deg) scaleX(0)`},
        {opacity:.9,offset:.28,transform:`rotate(${angle}deg) scaleX(1)`},
        {opacity:0,transform:`rotate(${angle}deg) scaleX(1)`}
      ],{duration:520,easing:'cubic-bezier(.22,.8,.24,1)',fill:'forwards'});
      const packetMotion=packet.animate([
        {opacity:0,filter:'blur(4px)',transform:'translate3d(-50%,-50%,0) scale(.72)'},
        {opacity:1,filter:'blur(0)',offset:.18,transform:'translate3d(-50%,-50%,0) scale(1)'},
        {opacity:1,filter:'blur(0)',offset:.8,transform:`translate3d(calc(-50% + ${dx}px),calc(-50% + ${dy}px),0) scale(1)`},
        {opacity:0,filter:'blur(3px)',transform:`translate3d(calc(-50% + ${dx}px),calc(-50% + ${dy}px),0) scale(.72)`}
      ],{duration:520,easing:'cubic-bezier(.22,.8,.24,1)',fill:'forwards'});
      await packetMotion.finished;
      onArrive(index);
      pulse(stop);
      await beamMotion.finished;
      beam.remove();
      packet.remove();
      from=to;
    }
  }
  window.AkaMotion={send,pulse};
}());
