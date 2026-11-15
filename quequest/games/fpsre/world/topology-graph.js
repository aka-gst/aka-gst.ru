(() => {
  'use strict';
  const QQ=window.QQ,{V3}=QQ.Math3D;
  class TopologyGraphSystem{
    constructor(ctx){
      this.ctx=ctx;this.known=new Set();this.agentCooldown=new WeakMap();this.lastRoutes=new Map();
      ctx.events.on('PORTAL_DISCOVERED',e=>{this.known.add(`P:${e.portal}`);const p=(ctx.portals?.portals||[]).find(x=>x.portal.id===e.portal);if(p)this.known.add(`P:${p.portal.pair}`);});
      ctx.events.on('PORTAL_TRANSIT',e=>{this.known.add(`P:${e.from}`);this.known.add(`P:${e.to}`);});
      ctx.events.on('ROOM_OVER_ROOM_OBSERVED',e=>{this.known.add(`P:${e.from}`);this.known.add(`P:${e.to}`);});
      ctx.events.on('GEOMETRY_LOOP',()=>this.known.add('L:LOOP'));
    }
    dist(a,b){return V3.len(V3.sub(a,b));}
    portalEdges({knownOnly=false}={}){
      const out=[];
      for(const src of this.ctx.portals?.portals||[]){const dst=this.ctx.portals.pairOf(src);if(!dst)continue;const known=!knownOnly||this.known.has(`P:${src.portal.id}`)||this.ctx.portals.discovered;if(!known)continue;out.push({id:`PORTAL_${src.portal.id}_${dst.portal.id}`,type:'portal',srcId:src.portal.id,dstId:dst.portal.id,from:[...src.pos],to:[...dst.pos],cost:.45,transmission:.84});}
      return out;
    }
    loopEdges({knownOnly=false}={}){const l=this.ctx.level;if(!l?.loopStart||!l?.loopEnd)return[];if(knownOnly&&!this.known.has('L:LOOP')&&this.ctx.impossibleGeometry?.loopCount<1)return[];return[
      {id:'LOOP_END_START',type:'loop',from:[...l.loopEnd],to:[...l.loopStart],cost:.35,transmission:.68},
      {id:'LOOP_START_END',type:'loop',from:[...l.loopStart],to:[...l.loopEnd],cost:.55,transmission:.58}
    ];}
    edges(opt={}){return [...this.portalEdges(opt),...this.loopEdges(opt)];}
    shortestRoute(from,to,{knownOnly=false}={}){
      const edges=this.edges({knownOnly});
      const nodes=[{id:'START',pos:[...from]},{id:'GOAL',pos:[...to]}];
      const nodeMap=new Map(nodes.map(n=>[n.id,n]));
      const topoLinks=[];
      for(const e of edges){const a=`${e.id}:A`,b=`${e.id}:B`;if(!nodeMap.has(a)){const n={id:a,pos:e.from};nodes.push(n);nodeMap.set(a,n);}if(!nodeMap.has(b)){const n={id:b,pos:e.to};nodes.push(n);nodeMap.set(b,n);}topoLinks.push({a,b,cost:e.cost,edge:e});}
      const adj=new Map(nodes.map(n=>[n.id,[]]));
      const add=(a,b,cost,meta)=>{adj.get(a).push({to:b,cost,meta});};
      // Walking is deliberately approximate; the physical mover still collides with world geometry.
      for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
        const a=nodes[i],b=nodes[j];if(a.id.includes(':A')&&b.id.includes(':B')&&a.id.split(':')[0]===b.id.split(':')[0])continue;
        const d=this.dist(a.pos,b.pos);add(a.id,b.id,d,{type:'walk'});add(b.id,a.id,d,{type:'walk'});
      }
      for(const l of topoLinks)add(l.a,l.b,l.cost,{type:l.edge.type,edge:l.edge});
      const q=new Set(nodes.map(n=>n.id)),D=new Map(nodes.map(n=>[n.id,Infinity])),P=new Map();D.set('START',0);
      while(q.size){let u=null,bd=Infinity;for(const id of q){const d=D.get(id);if(d<bd){bd=d;u=id;}}if(u===null||u==='GOAL')break;q.delete(u);for(const a of adj.get(u)||[]){const nd=bd+a.cost;if(nd<D.get(a.to)){D.set(a.to,nd);P.set(a.to,{from:u,meta:a.meta});}}}
      const path=[];let cur='GOAL';while(cur){path.push(cur);if(cur==='START')break;cur=P.get(cur)?.from;}path.reverse();
      const steps=[];for(let i=0;i<path.length;i++){const id=path[i],n=nodeMap.get(id),prev=i?P.get(id):null;steps.push({id,pos:[...n.pos],via:prev?.meta||null});}
      const result={distance:D.get('GOAL'),direct:this.dist(from,to),steps,usesTopology:steps.some(s=>s.via&&s.via.type!=='walk')};return result;
    }
    nextInstruction(from,to,{knownOnly=true}={}){
      const r=this.shortestRoute(from,to,{knownOnly});let waypoint=to,edge=null;
      for(let i=1;i<r.steps.length;i++){
        const step=r.steps[i];if(step.via?.type==='portal'||step.via?.type==='loop'){edge=step.via.edge;waypoint=edge.from;break;}waypoint=step.pos;if(i===1&&!r.usesTopology)break;
      }
      return {route:r,waypoint:[...waypoint],edge};
    }
    maybeTransitAgent(agent,instruction,kind='AI'){
      const edge=instruction?.edge;if(!edge)return false;const now=performance.now(),cd=this.agentCooldown.get(agent)||0;if(now<cd)return false;if(Math.hypot(agent.pos[0]-edge.from[0],agent.pos[2]-edge.from[2])>1.25)return false;
      if(edge.type==='portal'){
        const src=(this.ctx.portals.portals||[]).find(p=>p.portal.id===edge.srcId);if(!src)return false;this.ctx.portals.transformEntity(agent,src,{kind,offset:.78});
      }else if(edge.type==='loop'){
        const dx=agent.pos[0]-edge.from[0],dy=agent.pos[1]-edge.from[1],dz=agent.pos[2]-edge.from[2];agent.pos=[edge.to[0]+dx,edge.to[1]+dy,edge.to[2]+dz];
        this.ctx.emit('TOPOLOGY_ENTITY_TRANSIT',{kind,edge:edge.id,type:'LOOP',position:agent.pos.map(v=>+v.toFixed(2))});
      }
      this.agentCooldown.set(agent,now+650);return true;
    }
    shortestDistance(a,b,{knownOnly=false}={}){return this.shortestRoute(a,b,{knownOnly}).distance;}
    pressureImages(origin,radius){
      const out=[];for(const e of this.edges({knownOnly:false})){
        const d=this.dist(origin,e.from);if(d>=radius)continue;const remain=(radius-d)*e.transmission;if(remain<.35)continue;
        out.push({origin:[e.to[0],e.to[1]+.1,e.to[2]],radius:remain,transmission:e.transmission,edge:e});
      }return out;
    }
    recordRoute(agent,route){this.lastRoutes.set(agent,route);}
    routeFor(agent){return this.lastRoutes.get(agent)||null;}
    debugText(){const edges=this.edges({knownOnly:true});return `TOPOLOGY GRAPH\nknown edges = ${edges.length}\n${edges.map(e=>`${e.id}  ${e.type.toUpperCase()}`).join('\n')||'no discovered topology'}\n\nAI / SOUND / PRESSURE / PROPS\nshare this graph`;}
  }
  QQ.TopologyGraphSystem=TopologyGraphSystem;
})();
