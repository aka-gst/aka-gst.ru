(() => {
  'use strict';
  const QQ = window.QQ;
  class AudioSystem{
    constructor(ctx){
      this.ctx=ctx;this.audioCtx=null;this.sampleRaw={};this.sampleBuffers={};this.decoding=null;this.lastCasingAt=0;
      this.sampleUrls={
        click:'Assets/Audio/Weapons/mech_click.wav',
        magazine:'Assets/Audio/Weapons/magazine_action.wav',
        slide:'Assets/Audio/Weapons/slide_action.wav',
        spring:'Assets/Audio/Weapons/spring_action.wav',
        casing:'Assets/Audio/Weapons/casing_ping.wav',
        impactMetal:'Assets/Audio/Weapons/impact_metal.wav',
        impactConcrete:'Assets/Audio/Weapons/impact_concrete.wav',
        impactGlass:'Assets/Audio/Weapons/impact_glass.wav',
        impactWood:'Assets/Audio/Weapons/impact_wood.wav'
      };
      this.preloadSamples();
    }
    async preloadSamples(){
      const loaded=[];
      await Promise.all(Object.entries(this.sampleUrls).map(async([id,url])=>{try{const r=await fetch(url);if(!r.ok)throw new Error(`HTTP ${r.status}`);this.sampleRaw[id]=await r.arrayBuffer();loaded.push(id);}catch(e){this.ctx.emit?.('AUDIO_ASSET_FAIL',{id,url,error:String(e)});}}));
      this.ctx.emit?.('AUDIO_ASSETS_FETCHED',{loaded,expected:Object.keys(this.sampleUrls)});
      if(this.audioCtx)this.decodeSamples();
    }
    enable(){try{this.audioCtx=this.audioCtx||new (window.AudioContext||window.webkitAudioContext)();this.audioCtx.resume?.();this.decodeSamples();}catch{}}
    async decodeSamples(){if(!this.audioCtx||this.decoding)return this.decoding;const c=this.audioCtx;this.decoding=Promise.all(Object.entries(this.sampleRaw).map(async([id,raw])=>{if(this.sampleBuffers[id])return;try{this.sampleBuffers[id]=await c.decodeAudioData(raw.slice(0));}catch(e){this.ctx.emit?.('AUDIO_ASSET_FAIL',{id,error:`decode: ${String(e)}`});}})).then(()=>{this.ctx.emit?.('AUDIO_ASSETS_READY',{loaded:Object.keys(this.sampleBuffers)});return this.sampleBuffers;});return this.decoding;}
    tone(freq=220,dur=.08,vol=.035,type='sawtooth'){const c=this.audioCtx;if(!c)return;const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,c.currentTime);g.gain.setValueAtTime(vol,c.currentTime);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+dur);o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+dur);}
    noise(dur=.16,vol=.04){const c=this.audioCtx;if(!c)return;const n=Math.max(1,Math.floor(c.sampleRate*dur)),b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);const src=c.createBufferSource(),g=c.createGain();src.buffer=b;g.gain.value=vol;src.connect(g).connect(c.destination);src.start();}
    sample(id,vol=.16,rate=1,delay=0){const c=this.audioCtx,b=this.sampleBuffers[id];if(!c||!b)return false;const src=c.createBufferSource(),g=c.createGain();src.buffer=b;src.playbackRate.value=rate;g.gain.value=vol;src.connect(g).connect(c.destination);src.start(c.currentTime+Math.max(0,delay));return true;}
    mechanicalFallback(kind='click'){const table={click:[[680,.012,.018,'square'],[320,.026,.010,'triangle']],magOut:[[420,.018,.016,'square'],[180,.038,.012,'triangle']],magIn:[[210,.022,.020,'square'],[520,.012,.011,'triangle']],rack:[[150,.045,.015,'sawtooth'],[780,.018,.010,'triangle']],dry:[[110,.018,.014,'square'],[760,.006,.006,'triangle']],inspect:[[360,.016,.010,'triangle'],[520,.018,.008,'triangle']]};for(const [f,d,v,t] of table[kind]||table.click)this.tone(f,d,v,t);if(kind==='rack'||kind==='magIn')this.noise(kind==='rack'?.045:.018,kind==='rack'?.016:.010);}
    mechanical(kind='click'){
      if(!this.audioCtx)return;
      let ok=false;
      if(kind==='click')ok=this.sample('click',.15,1.02);
      else if(kind==='dry')ok=this.sample('click',.13,.82);
      else if(kind==='magOut')ok=this.sample('magazine',.15,.92);
      else if(kind==='magIn'){ok=this.sample('magazine',.19,1.08);this.sample('click',.07,1.08,.055);}
      else if(kind==='rack'){ok=this.sample('slide',.20,1.0);this.sample('spring',.085,1.05,.035);}
      else if(kind==='inspect'){ok=this.sample('slide',.10,.76);this.sample('click',.045,.94,.045);}
      if(!ok)this.mechanicalFallback(kind);
    }
    materialFallback(material='concrete',energy=1,outcome='STOP'){
      const e=Math.max(.2,Math.min(1.2,energy));
      const table={
        metal:[920,.028,.015,'triangle',.016,.016],paintedMetal:[840,.028,.014,'triangle',.016,.016],hazard:[820,.028,.014,'triangle',.016,.016],
        glass:[1450,.038,.013,'sine',.030,.020],screen:[1180,.036,.013,'sine',.025,.018],wood:[230,.045,.016,'sine',.030,.025],
        rubber:[95,.040,.012,'sine',.018,.015],energy:[680,.035,.014,'triangle',.014,.010],concrete:[150,.042,.017,'sine',.030,.028]
      },p=table[material]||table.concrete;
      this.tone(p[0]*(outcome==='DEFLECT'?1.12:1),p[1],p[2]*e,p[3]);this.noise(p[4],p[5]*e);
    }
    surfaceImpact(material='concrete',energy=1,outcome='STOP'){
      if(!this.audioCtx)return;
      const id=(material==='metal'||material==='paintedMetal'||material==='hazard')?'impactMetal':(material==='glass'||material==='screen')?'impactGlass':material==='wood'?'impactWood':material==='rubber'?'impactConcrete':material==='energy'?null:'impactConcrete';
      const e=Math.max(.2,Math.min(1.2,energy)),rate=(outcome==='DEFLECT'?1.08:1)*(0.94+Math.random()*.12),vol=.07+.08*Math.min(1,e);
      const ok=id?this.sample(id,vol,rate):false;
      if(outcome==='DEFLECT')this.sample('casing',.035+.025*e,1.18+Math.random()*.18,.012);
      if(!ok)this.materialFallback(material,e,outcome);
    }
    casingBounce(intensity=.6){
      if(!this.audioCtx)return;
      const now=performance.now();if(now-this.lastCasingAt<28)return;this.lastCasingAt=now;
      const e=Math.max(.15,Math.min(1,intensity)),ok=this.sample('casing',.025+.065*e,.88+Math.random()*.36);
      if(!ok){this.tone(1380+Math.random()*620,.026,.006+.010*e,'triangle');this.noise(.014,.004+.006*e);}
    }
  }
  QQ.AudioSystem=AudioSystem;
})();
