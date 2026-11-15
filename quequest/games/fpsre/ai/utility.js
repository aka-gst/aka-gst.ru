(() => {
  'use strict';
  const QQ=window.QQ,{V3}=QQ.Math3D;
  QQ.UtilityScorer={
    resource(agentPos,item,now){const d=V3.len(V3.sub([item.pos[0],0,item.pos[2]],[agentPos[0],0,agentPos[2]])),wait=item.state==='up'?0:Math.max(0,(item.next-now)/1000),denial=item.state==='up'?item.value*.35:0;return {score:item.value-d*2.2-wait*7+denial,distance:d,wait,denial};},
    chooseResource(agentPos,items,now){let best=null,bestScore=-Infinity,detail=null;for(const item of items){const u=this.resource(agentPos,item,now);if(u.score>bestScore){best=item;bestScore=u.score;detail=u;}}return {item:best,score:bestScore,detail};}
  };
})();
