/* Optional host bridge (protocol 1). Pythonio works exactly as before when it
   is opened on its own. When a same-origin host page (QueQuest) embeds it in
   an iframe, the two exchange two small messages via postMessage:

   host → Pythonio  {source:'quequest', type:'hello', protocol:1, player, known:[...], story?:[...]}
                    story (QueQuest 19.0) = [{index, client, place, letter, thanks}]:
                    who asks for an order and why; the order itself is unchanged.
                    known = Python moves the player has already learned there
                    (print, if, for, while, list, def, dict, try, log, queue, lock).
                    Pythonio then does not re-introduce them as new: the
                    welcome and the PYTHON-СМЫСЛ card say «уже знаешь».
   Pythonio → host  {source:'pythonio', type:'ready', protocol:1, version}
                    {source:'pythonio', type:'order-complete', protocol:1,
                     id:'order-NN', index, name, reward, rep, finale}
                    sent once per real (not demo/puzzle) claimed campaign order;
                    the host must treat `id` as an idempotency key. */
(function(g,f){if(typeof module==='object'&&module.exports)module.exports=f();else g.PythonioHost=f();})(globalThis,function(){
    'use strict';
    const PROTOCOL=1;
    const MOVES=['print','if','for','while','list','def','dict','try','log','queue','lock'];
    // Which already-known Python moves each order's PYTHON-СМЫСЛ is built on.
    const CONCEPT_MOVES=[['def'],['if'],['queue'],['if'],['dict'],['def'],[],['for'],[],['dict'],['if'],['for'],['for','dict'],['def'],[],[],[],[],[],['try'],[],['log']];
    const orderId=index=>'order-'+String(index+1).padStart(2,'0');
    function normalizeHello(data){
        if(!data||typeof data!=='object'||data.source!=='quequest'||data.type!=='hello'||data.protocol!==PROTOCOL)return null;
        const known=Array.isArray(data.known)?[...new Set(data.known.filter(k=>MOVES.includes(k)))]:[];
        const player=typeof data.player==='string'?data.player.replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,32):'';
        // QueQuest 19.0: optional story frames for the first orders
        // ({index, client, place, letter, thanks}); plain text, length-capped.
        const clean=(v,n)=>typeof v==='string'?v.replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,n):'';
        const story=Array.isArray(data.story)?data.story.filter(x=>x&&Number.isInteger(x.index)&&x.index>=0&&x.index<64).slice(0,8).map(x=>({index:x.index,client:clean(x.client,32),place:clean(x.place,48),letter:clean(x.letter,600),thanks:clean(x.thanks,400)})):[];
        return {player,known,story};
    }
    // Rewrites who asks and why for the given orders; the order itself
    // (its name, goals and reward) never changes.
    function applyStory(story,data){
        const contracts=data&&data.contracts;if(!Array.isArray(contracts))return 0;let n=0;
        for(const s of story||[]){const c=contracts[s.index];if(!c)continue;for(const k of ['client','place','letter','thanks'])if(s[k])c[k]=s[k];n++;}
        return n;
    }
    function knownFor(chapter,known){const need=CONCEPT_MOVES[chapter]||[];return need.length>0&&need.every(m=>known.includes(m))?need:[];}
    function orderMessage(chapter,contract){
        return {source:'pythonio',type:'order-complete',protocol:PROTOCOL,id:orderId(chapter),index:chapter,name:String(contract?.name||''),reward:Math.max(0,Number(contract?.reward)||0),rep:Math.max(0,Number(contract?.rep)||0),finale:Boolean(contract?.finale)};
    }
    const api={PROTOCOL,MOVES,CONCEPT_MOVES,orderId,normalizeHello,applyStory,knownFor,orderMessage,host:null,listeners:[],
        embedded(){try{return typeof window!=='undefined'&&window.parent&&window.parent!==window;}catch(_){return false;}},
        post(msg){if(!api.embedded())return false;try{window.parent.postMessage(msg,window.location.origin);return true;}catch(_){return false;}},
        orderDone(chapter,contract){return api.post(orderMessage(chapter,contract));},
        onHello(fn){api.listeners.push(fn);if(api.host)fn(api.host);},
        start(){
            if(typeof window==='undefined'||!api.embedded())return false;
            window.addEventListener('message',e=>{
                if(e.source!==window.parent||e.origin!==window.location.origin)return;
                const hello=normalizeHello(e.data);if(!hello)return;
                api.host=hello;document.documentElement.dataset.host='quequest';applyStory(hello.story,globalThis.WorkshopData);
                for(const fn of api.listeners)try{fn(hello);}catch(_){}
            });
            api.post({source:'pythonio',type:'ready',protocol:PROTOCOL,version:'1.9.0'});
            return true;
        }};
    return api;
});
