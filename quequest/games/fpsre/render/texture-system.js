(() => {
  'use strict';
  const QQ=window.QQ;
  class TextureSystem{
    constructor(ctx){this.ctx=ctx;this.size=512;this.grid=4;this.tile=this.size/this.grid;this.canvas=this.buildAtlas();this.normalCanvas=this.buildNormalAtlas(this.canvas);this._glTex=null;this._glNormalTex=null;}
    rng(seed){let s=seed>>>0;return()=>((s=(s*1664525+1013904223)>>>0)/4294967296);}
    tileCtx(g,index){const x=(index%this.grid)*this.tile,y=Math.floor(index/this.grid)*this.tile;g.save();g.translate(x,y);g.beginPath();g.rect(0,0,this.tile,this.tile);g.clip();return()=>g.restore();}
    noise(g,seed,base='#a9adaf',amount=.18){const R=this.rng(seed),n=48,s=this.tile/n;g.fillStyle=base;g.fillRect(0,0,this.tile,this.tile);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const v=Math.floor(128+(R()-.5)*255*amount);g.fillStyle=`rgba(${v},${v},${v},${.22+R()*.18})`;g.fillRect(x*s,y*s,s+1,s+1)}}
    buildAtlas(){const c=document.createElement('canvas');c.width=c.height=this.size;const g=c.getContext('2d');
      // 0 concrete
      let done=this.tileCtx(g,0);this.noise(g,11,'#b6bab9',.22);g.strokeStyle='rgba(55,60,60,.35)';g.lineWidth=2;for(let i=1;i<4;i++){g.beginPath();g.moveTo(i*this.tile/4,0);g.lineTo(i*this.tile/4,this.tile);g.stroke()}for(let i=1;i<3;i++){g.beginPath();g.moveTo(0,i*this.tile/3);g.lineTo(this.tile,i*this.tile/3);g.stroke()}done();
      // 1 bare metal
      done=this.tileCtx(g,1);g.fillStyle='#a7afb2';g.fillRect(0,0,this.tile,this.tile);for(let x=0;x<this.tile;x+=3){const q=145+(x%17);g.fillStyle=`rgb(${q},${q+4},${q+7})`;g.fillRect(x,0,1,this.tile)}g.strokeStyle='rgba(35,45,50,.5)';g.strokeRect(5,5,this.tile-10,this.tile-10);done();
      // 2 glass / micro scratches
      done=this.tileCtx(g,2);g.fillStyle='#d9f6f8';g.fillRect(0,0,this.tile,this.tile);g.strokeStyle='rgba(80,140,150,.15)';for(let i=0;i<18;i++){g.beginPath();g.moveTo((i*37)%this.tile,0);g.lineTo(((i*37)+45)%this.tile,this.tile);g.stroke()}done();
      // 3 wood
      done=this.tileCtx(g,3);g.fillStyle='#c19a70';g.fillRect(0,0,this.tile,this.tile);for(let y=8;y<this.tile;y+=13){g.strokeStyle=`rgba(70,42,20,${.15+(y%3)*.05})`;g.beginPath();g.moveTo(0,y);for(let x=0;x<=this.tile;x+=8)g.lineTo(x,y+Math.sin(x*.12+y)*2);g.stroke()}done();
      // 4 energy neutral
      done=this.tileCtx(g,4);const gr=g.createRadialGradient(this.tile*.5,this.tile*.5,2,this.tile*.5,this.tile*.5,this.tile*.7);gr.addColorStop(0,'#ffffff');gr.addColorStop(.4,'#9fd9ff');gr.addColorStop(1,'#29315a');g.fillStyle=gr;g.fillRect(0,0,this.tile,this.tile);done();
      // 5 painted metal panels
      done=this.tileCtx(g,5);this.noise(g,25,'#909b9e',.12);g.strokeStyle='rgba(25,35,38,.72)';g.lineWidth=3;g.strokeRect(4,4,this.tile-8,this.tile-8);g.strokeRect(this.tile*.5,4,1,this.tile-8);for(const [x,y] of [[10,10],[this.tile-10,10],[10,this.tile-10],[this.tile-10,this.tile-10]]){g.fillStyle='#41494b';g.beginPath();g.arc(x,y,2.5,0,Math.PI*2);g.fill()}done();
      // 6 rubber
      done=this.tileCtx(g,6);g.fillStyle='#777c7c';g.fillRect(0,0,this.tile,this.tile);for(let y=4;y<this.tile;y+=8)for(let x=4;x<this.tile;x+=8){g.fillStyle='rgba(30,30,30,.18)';g.beginPath();g.arc(x+(y%16?2:0),y,1.3,0,Math.PI*2);g.fill()}done();
      // 7 hazard diagonal
      done=this.tileCtx(g,7);g.fillStyle='#d2ab38';g.fillRect(0,0,this.tile,this.tile);g.save();g.rotate(-Math.PI/4);g.fillStyle='#252728';for(let x=-this.tile;x<this.tile*2;x+=28)g.fillRect(x,-this.tile,14,this.tile*3);g.restore();done();
      // 8 screen
      done=this.tileCtx(g,8);g.fillStyle='#7beaf3';g.fillRect(0,0,this.tile,this.tile);g.strokeStyle='rgba(10,55,65,.28)';g.lineWidth=1;for(let x=0;x<this.tile;x+=8){g.beginPath();g.moveTo(x,0);g.lineTo(x,this.tile);g.stroke()}for(let y=0;y<this.tile;y+=8){g.beginPath();g.moveTo(0,y);g.lineTo(this.tile,y);g.stroke()}done();
      // 9 portal fallback texture
      done=this.tileCtx(g,9);g.fillStyle='#8adfff';g.fillRect(0,0,this.tile,this.tile);for(let i=0;i<16;i++){g.strokeStyle=`rgba(140,70,255,${.08+i*.015})`;g.beginPath();g.arc(this.tile*.5,this.tile*.5,6+i*5,0,Math.PI*2);g.stroke()}done();
      // remaining neutral industrial tiles
      for(let i=10;i<16;i++){done=this.tileCtx(g,i);this.noise(g,100+i,i%2?'#a2a8a7':'#8f9798',.1);done();}
      return c;
    }

    buildNormalAtlas(srcCanvas){const src=srcCanvas.getContext('2d').getImageData(0,0,this.size,this.size),out=document.createElement('canvas');out.width=out.height=this.size;const g=out.getContext('2d'),dst=g.createImageData(this.size,this.size),S=src.data,D=dst.data,ts=this.tile;const lum=(x,y,bx,by)=>{x=Math.max(bx,Math.min(bx+ts-1,x));y=Math.max(by,Math.min(by+ts-1,y));const i=(y*this.size+x)*4;return(S[i]*.2126+S[i+1]*.7152+S[i+2]*.0722)/255;};for(let y=0;y<this.size;y++){for(let x=0;x<this.size;x++){const bx=Math.floor(x/ts)*ts,by=Math.floor(y/ts)*ts;const dx=lum(x+1,y,bx,by)-lum(x-1,y,bx,by),dy=lum(x,y+1,bx,by)-lum(x,y-1,bx,by),strength=2.8;let nx=-dx*strength,ny=-dy*strength,nz=1,l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;const i=(y*this.size+x)*4;D[i]=Math.round((nx*.5+.5)*255);D[i+1]=Math.round((ny*.5+.5)*255);D[i+2]=Math.round((nz*.5+.5)*255);D[i+3]=255;}}g.putImageData(dst,0,0);return out;}
    tileRect(index){const x=index%this.grid,row=Math.floor(index/this.grid),y=this.grid-1-row;return[x/this.grid,y/this.grid,1/this.grid,1/this.grid];}
    upload(gl){if(this._glTex)return this._glTex;const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.canvas);gl.generateMipmap(gl.TEXTURE_2D);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);this._glTex=t;return t;}
    uploadNormal(gl){if(this._glNormalTex)return this._glNormalTex;const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.normalCanvas);gl.generateMipmap(gl.TEXTURE_2D);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);this._glNormalTex=t;return t;}
    debugText(){return `PROCEDURAL MATERIAL ATLAS\nALBEDO ${this.size}×${this.size} · NORMAL ${this.size}×${this.size}\n${this.grid}×${this.grid} tiles · runtime generated\nexternal proprietary textures = NONE`;}
  }
  QQ.TextureSystem=TextureSystem;
})();
