(() => {
  'use strict';
  const QQ=window.QQ;
  class SaveStore{
    constructor(ctx,prefix='fpsre'){this.ctx=ctx;this.prefix=prefix;}
    key(name){return `${this.prefix}_${name}`;}
    get(name,fallback=null){try{const raw=localStorage.getItem(this.key(name));return raw==null?fallback:JSON.parse(raw);}catch(err){this.ctx?.emit?.('SAVE_READ_ERROR',{name,error:String(err)});return fallback;}}
    set(name,value){try{localStorage.setItem(this.key(name),JSON.stringify(value));this.ctx?.emit?.('SAVE_WRITE',{name});return true;}catch(err){this.ctx?.emit?.('SAVE_WRITE_ERROR',{name,error:String(err)});return false;}}
    append(name,value,{limit=100}={}){const list=this.get(name,[]);const out=Array.isArray(list)?list:[];out.push(value);if(out.length>limit)out.splice(0,out.length-limit);this.set(name,out);return out;}
    remove(name){try{localStorage.removeItem(this.key(name));return true;}catch{return false;}}
  }
  QQ.SaveStore=SaveStore;
})();
