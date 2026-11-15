(() => {
  'use strict';
  const QQ=window.QQ,{lerp}=QQ.Math3D;
  class NavigationSystem{
    constructor(ctx){this.ctx=ctx;}
    desiredXZ(from,to,speed){const dx=to[0]-from[0],dz=to[2]-from[2],l=Math.hypot(dx,dz)||1;return [dx/l*speed,0,dz/l*speed];}
    stepAgent(agent,target,dt,{speed=QQ.Config.ai.resourceSpeed,turn=3}={}){const desired=this.desiredXZ(agent.pos,target,speed);agent.vel[0]=lerp(agent.vel[0],desired[0],dt*turn);agent.vel[2]=lerp(agent.vel[2],desired[2],dt*turn);const w=this.ctx.world,nx=agent.pos[0]+agent.vel[0]*dt,nz=agent.pos[2]+agent.vel[2]*dt;if(!w.collidesXZ(nx,agent.pos[2],agent.pos[1]))agent.pos[0]=nx;else agent.vel[0]*=-.2;if(!w.collidesXZ(agent.pos[0],nz,agent.pos[1]))agent.pos[2]=nz;else agent.vel[2]*=-.2;agent.pos[1]=w.floorAt(agent.pos[0],agent.pos[2],agent.pos[1]+.2);return agent;}
    plan(from,to){return this.ctx.topology?this.ctx.topology.nextInstruction(from,to,{knownOnly:true}):{route:{distance:Math.hypot(to[0]-from[0],to[2]-from[2]),direct:Math.hypot(to[0]-from[0],to[2]-from[2]),steps:[],usesTopology:false},waypoint:[...to],edge:null};}
    stepTopologyAgent(agent,target,dt,opt={}){const plan=this.plan(agent.pos,target);this.ctx.topology?.recordRoute(agent,plan.route);this.stepAgent(agent,plan.waypoint,dt,opt);const transited=this.ctx.topology?.maybeTransitAgent(agent,plan,opt.kind||'AI');if(transited)this.ctx.emit('AI_TOPOLOGY_TRANSIT',{agent:opt.kind||'AI',edge:plan.edge?.id,routeDistance:+plan.route.distance.toFixed(2),directDistance:+plan.route.direct.toFixed(2)});return {agent,plan,transited};}
    path(from,to){const p=this.plan(from,to);return p.route.steps.map(s=>s.pos);}
  }
  QQ.NavigationSystem=NavigationSystem;
})();
