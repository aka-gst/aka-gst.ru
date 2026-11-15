(() => {
  'use strict';
  const QQ = window.QQ;
  const V3 = {
    add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],
    sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
    mul:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
    len:a=>Math.hypot(a[0],a[1],a[2]),
    norm:a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l]},
    dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
    cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
  };
  const m4=()=>new Float32Array(16);
  function identity(){const m=m4();m[0]=m[5]=m[10]=m[15]=1;return m}
  function mul(a,b){const o=m4();for(let r=0;r<4;r++)for(let c=0;c<4;c++)o[c*4+r]=a[0*4+r]*b[c*4+0]+a[1*4+r]*b[c*4+1]+a[2*4+r]*b[c*4+2]+a[3*4+r]*b[c*4+3];return o}
  function perspective(fov,asp,n,f){const t=1/Math.tan(fov/2),o=m4();o[0]=t/asp;o[5]=t;o[10]=(f+n)/(n-f);o[11]=-1;o[14]=2*f*n/(n-f);return o}
  function translate(x,y,z){const m=identity();m[12]=x;m[13]=y;m[14]=z;return m}
  function scale(x,y,z){const m=identity();m[0]=x;m[5]=y;m[10]=z;return m}
  function rotY(a){const m=identity(),c=Math.cos(a),s=Math.sin(a);m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m}
  function rotX(a){const m=identity(),c=Math.cos(a),s=Math.sin(a);m[5]=c;m[6]=s;m[9]=-s;m[10]=c;return m}
  function model(pos,sc,ry=0){return mul(translate(...pos),mul(rotY(ry),scale(...sc)))}
  function viewMatrix(pos,yaw,pitch){return mul(rotX(-pitch),mul(rotY(-yaw),translate(-pos[0],-pos[1],-pos[2])))}
  function ortho(l,r,b,t,n,f){const o=identity();o[0]=2/(r-l);o[5]=2/(t-b);o[10]=-2/(f-n);o[12]=-(r+l)/(r-l);o[13]=-(t+b)/(t-b);o[14]=-(f+n)/(f-n);return o}
  function lookAt(eye,target,up=[0,1,0]){const z=V3.norm(V3.sub(eye,target)),x=V3.norm(V3.cross(up,z)),y=V3.cross(z,x),o=identity();o[0]=x[0];o[1]=y[0];o[2]=z[0];o[4]=x[1];o[5]=y[1];o[6]=z[1];o[8]=x[2];o[9]=y[2];o[10]=z[2];o[12]=-V3.dot(x,eye);o[13]=-V3.dot(y,eye);o[14]=-V3.dot(z,eye);return o}
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  function rgb(hex){hex=hex.replace('#','');return[parseInt(hex.slice(0,2),16)/255,parseInt(hex.slice(2,4),16)/255,parseInt(hex.slice(4,6),16)/255]}
  QQ.Math3D={V3,m4,identity,mul,perspective,ortho,lookAt,translate,scale,rotY,rotX,model,viewMatrix,clamp,lerp,rgb};
})();
