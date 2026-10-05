/* Optional code workshop. Failed checks never alter the live routing table. */
(function(g){
 'use strict';
 const P=g.WorkshopPython,esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const lessons=[
  {title:'1. Скажи машине, что делать',question:'return значит «верни ответ». Сейчас программа возвращает None — «решения нет». Верни строку "photo", чтобы фото пошло в распознаватель.',source:'def route(item):\n    return None',solution:'def route(item):\n    return "photo"',checks:[{item:{type:'image',ready:false,checked:false},want:'photo'}]},
  {title:'2. Раздели две дорожки',question:'Фото и текст нельзя обрабатывать одной машиной. Для image верни photo; иначе — writer. Исправь одну строку.',source:'def route(item):\n    if item["type"] == "image":\n        return "photo"\n    else:\n        return "photo"',solution:'def route(item):\n    if item["type"] == "image":\n        return "photo"\n    else:\n        return "writer"',checks:[{item:{type:'image',ready:false,checked:false},want:'photo'},{item:{type:'text',ready:false,checked:false},want:'writer'}]},
  {title:'3. Сначала убедись в результате',question:'Готовое, но непроверенное → check. Готовое и проверенное → out. Сырое фото → photo, сырой текст → writer. Выше стоит более важное условие.',source:'def route(item):\n    if item["ready"]:\n        return "out"\n    if item["type"] == "image":\n        return "photo"\n    return "writer"',solution:'def route(item):\n    if item["ready"] and not item["checked"]:\n        return "check"\n    if item["ready"]:\n        return "out"\n    if item["type"] == "image":\n        return "photo"\n    return "writer"',checks:[{item:{type:'image',ready:true,checked:false},want:'check'},{item:{type:'text',ready:true,checked:true},want:'out'},{item:{type:'image',ready:false,checked:false},want:'photo'},{item:{type:'text',ready:false,checked:false},want:'writer'}]}
 ];
 function fromRules(rules){const lines=['# Те же правила, только записанные текстом.','def route(item):'];let count=0;for(const r of rules){if(!r.condition||!r.action)continue;const c={image:'item["type"] == "image"',text:'item["type"] == "text"',ready:'item["ready"]',all:'True'}[r.condition];lines.push('    '+(count++?'elif':'if')+' '+c+':','        return "'+r.action+'"');}lines.push('    return None');return lines.join('\n');}
 function mount(host){
  function show(lesson=-1){
   const owner=host.state(),source=lesson<0?(owner.codeDraft||owner.program?.source||fromRules(owner.rules)):lessons[lesson].source;
   let checked=null,checkedSource='',sequence=0;
   host.open(`<div class="eyebrow">ДОПОЛНИТЕЛЬНАЯ МАСТЕРСКАЯ · ИСТОРИЮ МОЖНО ПРОЙТИ СЛОВАМИ</div>
    <h2>Теперь правило пишешь ты.</h2>
    <p class="code-intro">Это <b>исполняемый учебный Python</b>: небольшой интерпретатор условий, переменных и циклов, а не полный CPython. Код остаётся на устройстве.</p>
    <div class="code-lessons"><button class="${lesson<0?'primary':'secondary'}" data-lesson="-1">Мой сортировщик</button>${lessons.map((l,i)=>`<button class="${lesson===i?'primary':'secondary'}" data-lesson="${i}">${owner.discoveries.includes('lesson-'+i)?'✓ ':''}${i+1}. ${['Ответ','Две ветки','Проверка'][i]}</button>`).join('')}</div>
    <div class="code-task">${esc(lesson<0?'Измени правило и проверь все восемь состояний файла. Проверка исполнения не доказывает, что маршрут полезен: результат каждого случая виден ниже.':lessons[lesson].question)}</div>
    <label class="code-label" for="pythonSource">Функция route(item) · Tab — четыре пробела · Ctrl/⌘+Enter — проверить</label>
    <textarea id="pythonSource" class="python-editor" rows="11" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Редактор учебного Python">${esc(source)}</textarea>
    <div class="buttons code-buttons"><button id="runCode" class="primary">▶ Проверить программу</button><button id="deployCode" class="secondary" disabled>Установить в сортировщик</button><button id="exportPython" class="text-button">Скачать .py</button></div>
    <div id="codeResult" class="code-result" role="status" aria-live="polite">Пока ничего не установлено. Сначала проверь программу.</div>
    <div class="buttons"><button id="restoreWords" class="text-button">Взять код с доски</button>${lesson>=0?'<button id="codeSolution" class="text-button">Показать решение</button>':''}${owner.program?'<button id="disableCode" class="secondary">Вернуть управление словам</button>':''}</div>
    <details class="code-reference"><summary>Словарь и границы учебного Python</summary><p><code>item["type"]</code> — <code>"image"</code> (фото) или <code>"text"</code>.<br><code>item["ready"]</code> — файл обработан; <code>item["checked"]</code> — проверен.<br>Ответы: <code>photo</code>, <code>writer</code>, <code>check</code>, <code>out</code>, <code>cache</code>, <code>template</code>, <code>table</code> или <code>None</code> (остановиться).</p><p>Доступны <code>if/elif/else</code>, <code>for/while</code>, <code>return</code>, локальные переменные, списки, словари со строковыми ключами, <code>len/range/sum/print</code>. Нет импортов, файлов, классов, рекурсии и сетевых вызовов. Максимум 20 000 шагов и 256 элементов. Программа решает только маршрут, а машины по-прежнему делают настоящую работу внутри игровой модели.</p><p>Перед установкой функция исполняется на всех входных состояниях. Результаты становятся таблицей маршрутизации. Исходник и таблица сохраняются вместе; подмена таблицы при импорте отклоняется.</p></details>`);
   const $=id=>document.getElementById(id),input=$('pythonSource');
   function valid(){return host.state()===owner&&document.getElementById('pythonSource')===input;}
   function invalidate(){checked=null;checkedSource='';sequence++;$('deployCode').disabled=true;owner.codeDraft=input.value.slice(0,12000);host.save();}
   input.oninput=invalidate;
   input.onkeydown=e=>{if(e.key==='Tab'){e.preventDefault();const a=input.selectionStart,b=input.selectionEnd;input.setRangeText('    ',a,b,'end');invalidate();}if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();$('runCode').click();}};
   document.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=()=>show(+b.dataset.lesson));
   $('restoreWords').onclick=()=>{input.value=fromRules(owner.rules);invalidate();};
   if($('codeSolution'))$('codeSolution').onclick=()=>{input.value=lessons[lesson].solution;invalidate();$('codeResult').textContent='Прочитай решение и запусти проверку. Ничего не установлено автоматически.';};
   $('exportPython').onclick=()=>host.download('my_workshop_route.py',input.value+'\n','text/x-python');
   if($('disableCode'))$('disableCode').onclick=()=>{host.act(()=>{owner.program=null;return {ok:true,message:'Снова действуют слова на доске.'};});show();};
   $('runCode').onclick=async()=>{
    const text=input.value,run=++sequence;checked=null;$('deployCode').disabled=true;$('runCode').disabled=true;$('codeResult').textContent='Исполняю программу на восьми состояниях…';
    try{
     const result=await P.checkAsync(text);if(!valid()||run!==sequence)return;
     const tests=lesson<0?result.cases.map(c=>({item:c.item,want:c.result})):lessons[lesson].checks;
     const passed=tests.every(t=>result.table[P.key(t.item)]===t.want);
     checked=result;checkedSource=text;owner.codeDraft=text;host.save();
     if(lesson>=0&&passed){host.discovery('lesson-'+lesson);}
     const describe=item=>`${item.type==='image'?'Фото':'Текст'} · ${item.ready?'готовое':'сырое'} · ${item.checked?'проверено':'не проверено'}`;
     const name=v=>v===null?'Остановиться (None)':({photo:'Распознать',writer:'Оформить',check:'Проверить',out:'Выдать',cache:'Вспомнить',template:'Персонализировать',table:'В таблицу'}[v]||v);
     $('codeResult').innerHTML=`<strong class="${passed?'code-ok':'code-warning'}">${lesson<0?'Код выполнен. Проверь, подходят ли тебе эти решения.':passed?'Получилось! Все проверочные случаи совпали.':'Программа работает, но задача ещё не решена.'}</strong><div class="code-cases">${tests.map(t=>{const v=result.table[P.key(t.item)],ok=v===t.want;return `<div class="code-case ${ok?'':'wrong'}"><span>${esc(describe(t.item))}</span><b>${esc(name(v))}${!ok?' · нужно: '+esc(name(t.want)):''}</b></div>`;}).join('')}</div><p class="small">${lesson<0?'Нет синтаксических ошибок ≠ правильная фабрика. Проверь направления и линии.':passed?'Можешь установить это поведение или вернуться к словам.':'Исправь код и запусти снова. Фабрика не изменена.'}</p>`;
     $('deployCode').disabled=!passed||host.locked();
    }catch(e){if(!valid()||run!==sequence)return;$('codeResult').innerHTML=`<strong class="code-warning">Строка ${e.line||1}: ${esc(e.code||'Ошибка')}</strong><p>${esc(e.message)}</p><span class="small">Прежняя фабрика не изменена.</span>`;}
    finally{if(valid())$('runCode').disabled=false;}
   };
   $('deployCode').onclick=()=>{if(!checked||input.value!==checkedSource||!valid())return;const result=host.install(checkedSource);if(result?.ok){host.close();host.toast('Код управляет сортировщиками. Любое изменение слова вернёт доску.');}};
  }
  return {show};
 }
 g.WorkshopCodePanel={mount,fromRules,lessons};
})(globalThis);
