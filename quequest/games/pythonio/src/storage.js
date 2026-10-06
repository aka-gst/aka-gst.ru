/* Storage adapter. A broken main slot never destroys the backup on load. */
(function(g,f){if(typeof module==='object'&&module.exports)module.exports=f();else g.WorkshopStorage=f();})(globalThis,function(){
    'use strict';
    function create(storage,E){
        const key='zhivoy-tsekh-v10',backup=key+'-backup';
        function load(){let foundBad=false,unusable=false;
            for(const k of [key,backup,'zhivoy-tsekh-v07','zhivoy-tsekh-v07-backup','zhivoy-tsekh-v06','zhivoy-tsekh-v06-backup']){
                let raw;try{raw=storage.getItem(k);}catch(_){unusable=true;break;}
                if(!raw)continue;try{return {state:E.parseSave(raw),loaded:true,usable:true,source:k,warning:k===backup?'Восстановлена резервная копия.':k!==key?'Перенесено сохранение предыдущей версии.':''};}catch(_){foundBad=true;}
            }
            return {state:E.create(),loaded:false,usable:!unusable,warning:unusable?'Браузер запретил автосохранение. Переноси мастерскую через JSON.':foundBad?'Сохранение повреждено. Оно не удалено; новую игру начни отдельно или загрузи JSON.':''};
        }
        function save(state){
            if(!state.started)return {ok:true,skipped:true};
            try{
                const text=E.serialize(state);E.parseSave(text);
                let previous;try{previous=storage.getItem(key);if(previous)E.parseSave(previous);}catch(_){previous=null;}
                if(previous)try{storage.setItem(backup,previous);}catch(_){}
                storage.setItem(key,text);return {ok:true};
            }catch(error){return {ok:false,message:'Автосохранение недоступно. Скачай сохранение JSON через меню.',detail:error.message};}
        }
        return {key,backup,load,save};
    }
    return {create};
});
