(() => {
  'use strict';
  const QQ=window.QQ,{V3}=QQ.Math3D;
  class PhysicsPropSystem{
    constructor(ctx){this.ctx=ctx;this.props=[];this.spawnDefaults();}
    spawn(name,pos,size,material='metal',opt={}){const o=this.ctx.world.box(name,pos,size,material,{...opt,destructible:opt.destructible??true,integrity:opt.integrity??85});o.meta.physicsProp=true;o.vel=[...(opt.vel||[0,0,0])];o.mass=opt.mass||1;this.props.push(o);return o;}
    spawnDefaults(){
      this.spawn('TOPOLOGY_TEST_CUBE',[2.4,.48,-27.1],[.9,.9,.9],'paintedMetal',{color:'#4e6871',mass:1.2,integrity:100});
      this.spawn('PRESSURE_CANISTER',[4.9,.58,-24.0],[.74,1.16,.74],'metal',{color:'#7c4b3c',mass:.85,integrity:48});
      this.spawn('UPPER_ROOM_PROP',[-4.2,5.0,-26.0],[.82,.82,.82],'concrete',{color:'#647073',mass:1.5,integrity:120});
    }
    radialImpulse(pos,radius,impulse,source='EXPLOSION'){
      for(const o of this.props){if(!o.solid||!this.ctx.world.active(o))continue;const d=V3.len(V3.sub(o.pos,pos));if(d>=radius)continue;const f=Math.max(0,1-d/radius),dir=V3.norm(V3.sub(o.pos,pos));o.vel[0]+=dir[0]*impulse*f/o.mass;o.vel[1]+=Math.max(1.4,Math.abs(dir[1])*impulse*.7)*f/o.mass;o.vel[2]+=dir[2]*impulse*f/o.mass;this.ctx.emit('RIGID_PROP_IMPULSE',{object:o.name,source,falloff:+f.toFixed(2),velocity:o.vel.map(v=>+v.toFixed(2))});}
    }
    update(dt){if(this.ctx.world.realm!=='day')return;for(const o of this.props){if(!o.solid)continue;const old=[...o.pos];o.vel[1]-=QQ.Config.player.gravity*dt*.72;let next=V3.add(o.pos,V3.mul(o.vel,dt));const tp=this.ctx.portals.transformSegment(old,next,o.vel,'RIGID_PROP');if(tp){o.pos=tp.pos;o.vel=tp.vel;this.ctx.emit('RIGID_PROP_PORTAL',{object:o.name,pos:o.pos.map(v=>+v.toFixed(2))});continue;}
        const feet=next[1]-o.size[1]/2,hit=this.ctx.world.collidesXZ(next[0],next[2],feet,o);if(hit){o.vel[0]*=-.22;o.vel[2]*=-.22;next[0]=o.pos[0];next[2]=o.pos[2];}
        const floor=this.ctx.world.floorAt(next[0],next[2],feet+.9);if(floor>-900&&next[1]-o.size[1]/2<floor){next[1]=floor+o.size[1]/2;if(o.vel[1]<0)o.vel[1]*=-.22;o.vel[0]*=.91;o.vel[2]*=.91;if(Math.abs(o.vel[1])<.18)o.vel[1]=0;}
        o.pos=next;o.vel[0]*=Math.pow(.985,dt*60);o.vel[2]*=Math.pow(.985,dt*60);
      }}
    debugText(){return `RIGID PROPS\n${this.props.map(o=>`${o.name}  v=${o.vel.map(v=>v.toFixed(1)).join(',')}`).join('\n')}`;}
  }
  QQ.PhysicsPropSystem=PhysicsPropSystem;
})();
