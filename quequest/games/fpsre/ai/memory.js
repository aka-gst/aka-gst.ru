(() => {
  'use strict';
  const QQ=window.QQ;
  class AIMemory{
    constructor(){this.playerLastSeen=null;this.playerLastSeenAt=0;this.lastHeard=null;this.lastHeardAt=0;this.confidence=0;this.facts=new Map();}
    seePlayer(pos,now=performance.now()){this.playerLastSeen=[...pos];this.playerLastSeenAt=now;this.confidence=1;}
    hear(pos,now=performance.now(),meta={}){this.lastHeard=pos?[...pos]:null;this.lastHeardAt=now;this.facts.set('lastNoise',{pos:this.lastHeard,at:now,...meta});}
    decay(now=performance.now(),seconds=QQ.Config.ai.memorySeconds){const age=(now-this.playerLastSeenAt)/1000;this.confidence=Math.max(0,1-age/seconds);return this.confidence;}
    remember(key,value){this.facts.set(key,{value,at:performance.now()});}
    recall(key){return this.facts.get(key)||null;}
  }
  QQ.AIMemory=AIMemory;
})();
