(() => {
  'use strict';
  const QQ=window.QQ;
  class GameContext{
    constructor(){
      this.systems=new Map();
      this.events=new QQ.EventBus();
      this.logger=new QQ.SessionLogger();
      this.events.on('system:replaced',e=>this.emit('SYSTEM_REPLACED',e));
    }
    emit(type,data={}){const event=this.logger.capture(type,data);this.events.emit('game:event',event);this.events.emit(type,event);return event;}
    register(name,instance,{log=true}={}){if(this.systems.has(name))throw new Error(`System already registered: ${name}`);this.systems.set(name,instance);this[name]=instance;if(log)this.emit('SYSTEM_REGISTER',{name,className:instance?.constructor?.name||'unknown'});return instance;}
    replace(name,instance){const previous=this.systems.get(name);this.systems.set(name,instance);this[name]=instance;this.events.emit('system:replaced',{name,from:previous?.constructor?.name||null,to:instance?.constructor?.name||'unknown'});return instance;}
    get(name){return this.systems.get(name);}
    list(){return [...this.systems.entries()].map(([name,instance])=>({name,className:instance?.constructor?.name||'unknown'}));}
  }
  QQ.GameContext=GameContext;
})();
