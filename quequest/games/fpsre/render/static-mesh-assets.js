(() => {
  'use strict';
  const QQ=window.QQ;
  class StaticMeshAssets{
    constructor(ctx,gl){this.ctx=ctx;this.gl=gl;this.meshes={};this.ready=false;this.failed=false;this.load();}
    async load(){try{const r=await fetch('Assets/Facility/facility_props_v12.json');if(!r.ok)throw new Error(`HTTP ${r.status}`);const a=await r.json();for(const [id,m] of Object.entries(a.meshes||{}))this.meshes[id]=this.upload(m);this.ready=true;this.ctx.emit?.('FACILITY_MESH_ASSETS_READY',{asset:a.id,meshes:Object.keys(this.meshes),triangles:Object.values(a.meshes||{}).reduce((n,m)=>n+(m.triangles||0),0)});}catch(e){this.failed=true;this.ctx.emit?.('FACILITY_MESH_ASSETS_FAIL',{asset:'facility_props_v12',error:String(e)});}}
    upload(m){const gl=this.gl,b={count:(m.positions?.length||0)/3,triangles:m.triangles||0};for(const [k,data] of [['pos',m.positions],['normal',m.normals]]){const q=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,q);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);b[k]=q;}return b;}
    get(id){return this.meshes[id]||null;}
  }
  QQ.StaticMeshAssets=StaticMeshAssets;
})();
