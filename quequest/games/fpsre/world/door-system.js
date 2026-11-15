(() => {
  'use strict';
  const QQ=window.QQ,{lerp}=QQ.Math3D;
  class DoorSystem{
    constructor(ctx){this.ctx=ctx;this.doors=new Map();}
    register(name,entity,{axis='y',closed,open,speed=3,initial='closed'}={}){const idx=axis==='x'?0:axis==='z'?2:1;const d={name,entity,axis,idx,closed:closed??entity.pos[idx],open:open??entity.pos[idx]+3,speed,target:initial==='open'?'open':'closed',state:initial};entity.door=true;this.doors.set(name,d);this.ctx.emit('DOOR_REGISTER',{door:name,axis,closed:d.closed,open:d.open});return d;}
    command(name,action,source='SYSTEM'){const d=this.doors.get(name);if(!d)return false;const target=String(action).toLowerCase()==='open'?'open':'closed';if(d.target===target)return true;d.target=target;this.ctx.emit('DOOR_COMMAND',{door:name,action:target.toUpperCase(),source});return true;}
    open(name,source){return this.command(name,'open',source)}
    close(name,source){return this.command(name,'close',source)}
    update(dt){for(const d of this.doors.values()){const value=d.target==='open'?d.open:d.closed;const prev=d.entity.pos[d.idx];d.entity.pos[d.idx]=lerp(prev,value,Math.min(1,dt*d.speed));const arrived=Math.abs(d.entity.pos[d.idx]-value)<.025;if(arrived&&d.state!==d.target){d.state=d.target;this.ctx.emit('DOOR_STATE',{door:d.name,state:d.state});}}}
    get(name){return this.doors.get(name)}
  }
  QQ.DoorSystem=DoorSystem;
})();
