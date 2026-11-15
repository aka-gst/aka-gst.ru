/* Explicit embedded demo checkpoints. Ordinary campaign storage is never remapped. */
(function(g,f){if(typeof module==='object'&&module.exports)module.exports=f();else g.PythonioDemoEntry=f();})(globalThis,function(){
    'use strict';
    function orderFromSearch(search,embedded){
        if(!embedded)return null;
        const value=new URLSearchParams(search).get('qq-demo-order');
        return /^(?:[1-9]|1\d|2[0-2])$/.test(value||'')?Number(value)-1:null;
    }
    function isolatedStorage(storage,requested,current=()=>requested){
        if(requested===null)return storage;
        const key=k=>'quequest-demo-order-'+((current()??requested)+1)+':'+k;
        return {getItem:k=>storage.getItem(key(k)),setItem:(k,v)=>storage.setItem(key(k),v)};
    }
    function initialState(E,D,index){
        const s=E.create();if(index===0)return s;
        s.chapter=index;s.unlocked=[...new Set(D.contracts.slice(0,index+1).flatMap(c=>c.unlock))];
        for(const n of s.nodes){n.queue=[];n.active=null;}
        // Equipment is supplied as this level's starting conditions, never a claimed prior order.
        const types=index===1?['router','photo']:['router','photo','writer'];
        s.coins+=types.reduce((sum,t)=>sum+D.machines[t].price,0);
        const positions={router:[550,450],photo:[900,450],writer:[750,650]},ids={};
        for(const type of types){const r=E.build(s,type,...positions[type]);if(!r.ok)throw Error(r.message);ids[type]=r.id;}
        for(const [a,b]of[['in',ids.router],[ids.router,ids.photo],[ids.photo,'out']])E.connect(s,a,b);
        E.rule(s,0,'image','photo');
        if(ids.writer){E.connect(s,ids.router,ids.writer);E.connect(s,ids.writer,'out');E.rule(s,1,'text','writer');}
        s.metrics.builds=0;s.metrics.rulesChanged=0;s.metrics.firstRule=null;s.log=[];
        E.note(s,'Начальные условия демоуровня: готовая предыдущая линия и стартовый запас монет. Заказы ещё не сданы.');
        return E.parseSave(E.serialize(s));
    }
    return {orderFromSearch,isolatedStorage,initialState};
});
