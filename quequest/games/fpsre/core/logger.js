(() => {
  'use strict';
  const QQ = window.QQ;
  class SessionLogger{
    constructor(){
      this.id=`${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      this.started=new Date().toISOString();
      this.events=[];this.batch=[];this.closed=false;const cfg=QQ.Config?.logging||{};
      this.server=location.protocol.startsWith('http');
      try{const old=localStorage.getItem('fpsre_active_session');if(old){const prev=JSON.parse(old);if(prev&&!prev.closed)this.recovered=prev;}}catch{}
      this.capture('SESSION_START',{ua:navigator.userAgent,url:location.href,version:QQ.version,recovered:!!this.recovered});
      window.addEventListener('error',e=>this.capture('JS_ERROR',{message:e.message,src:e.filename,line:e.lineno,col:e.colno,stack:e.error?.stack||''}));
      window.addEventListener('unhandledrejection',e=>this.capture('UNHANDLED_REJECTION',{reason:String(e.reason),stack:e.reason?.stack||''}));
      addEventListener('pagehide',()=>this.close('pagehide'));
      addEventListener('beforeunload',()=>this.close('beforeunload'));
      this.persistTimer=setInterval(()=>this.persist(),cfg.persistMs||1500);
      this.flushTimer=setInterval(()=>this.flush(),cfg.flushMs||2200);
    }
    capture(type,data={}){const e={t:+performance.now().toFixed(1),wall:new Date().toISOString(),type,...data};this.events.push(e);this.batch.push(e);const max=QQ.Config?.logging?.maxEvents||5000;if(this.events.length>max)this.events.splice(0,Math.max(500,Math.floor(max*.14)));return e;}
    snapshot(extra={}){this.capture('PERF_SNAPSHOT',extra)}
    persist(){try{localStorage.setItem('fpsre_active_session',JSON.stringify({id:this.id,started:this.started,closed:this.closed,last:new Date().toISOString(),events:this.events.slice(-(QQ.Config?.logging?.recoveryTail||800))}));}catch{}}
    flush(){if(!this.server||!this.batch.length)return;const events=this.batch.splice(0);fetch('/api/log',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session:this.id,started:this.started,version:QQ.version,events})}).catch(()=>this.batch.unshift(...events));}
    close(reason){if(this.closed)return;this.closed=true;this.capture('SESSION_CLOSE',{reason});this.persist();if(this.server){const payload=JSON.stringify({session:this.id,started:this.started,version:QQ.version,reason,events:this.events.slice(-700)});try{navigator.sendBeacon('/api/close',new Blob([payload],{type:'application/json'}));}catch{}}}
    readable(){let out=`FPS-RE ENGINE LAB // SESSION LOG\nVERSION: ${QQ.version}\nSESSION: ${this.id}\nSTART: ${this.started}\nGENERATED: ${new Date().toISOString()}\nURL: ${location.href}\n\n`;for(const e of this.events){out+=`[${String(e.t).padStart(8)} ms] ${e.type}`;const rest={...e};delete rest.t;delete rest.wall;delete rest.type;if(Object.keys(rest).length)out+=' '+JSON.stringify(rest);out+='\n';}return out;}
    download(){const blob=new Blob([this.readable()],{type:'text/plain'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`FPS_RE_session_${this.id}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);this.capture('MANUAL_LOG_EXPORT');}
  }
  QQ.SessionLogger=SessionLogger;
})();
