// One saved batch, two views. All routing and Python execution live in Pythonio.
import '../../games/pythonio/src/data.js';
import '../../games/pythonio/src/python-mini.js';
import '../../games/pythonio/src/memories.js';
import '../../games/pythonio/src/engine.js?v=20.2.0';
import '../../games/pythonio/src/view.js';
import {createBody,moveBody,stepBody,jump,carryBySurface} from './fp-body.js?v=20.2.0';
import {createDragLook} from './drag-look.js';
import {createRenderer, bakeLightmap} from './raycaster.js';
import {buildFactoryMap, LAMPS, WORKER_SPOTS, viewIndex} from './first-shift-map.js';
import {loadAtlas} from './first-shift-atlas.js';
import {dressHall} from './fp-overlay.js';
import {tint, paintTerminal, buildArmSprites} from './arm-art.js';
const E=globalThis.WorkshopEngine;
const CONTRACT_WORKERS={welder:{...WORKER_SPOTS.welder,x:3.2,z:4.1},fitter:{...WORKER_SPOTS.fitter,x:12.8,z:4.1},electrician:{...WORKER_SPOTS.electrician,x:13.5,z:8.5},lunch:{...WORKER_SPOTS.lunch,x:2.2,z:9.8}};
export const FACTORY_PAY=60*60;
export const FACTORY_CODE='def route(item):\n    if item["color"] == "white":\n        return "left"\n    return "right"';
const label=n=>({in:'ВХОД · 60 ЯЩИКОВ',left:'ЛЕВЫЙ · БЕЛЫЕ',right:'ПРАВЫЙ · КРАСНЫЕ'}[n.id]||'РАЗВИЛКА');
export function factorySettlement(s){if(s.factory.done.length!==60||s.factory.paid)return 0;s.factory.paid=true;return FACTORY_PAY;}
class FactoryPlan extends globalThis.WorkshopView {
  resize(){super.resize();this.fitScale=Math.min(this.w/1380,this.h/550);}
  origin(){return {x:(this.w-1380*this.scale())/2,y:(this.h-550*this.scale())/2-250*this.scale()};}
  packet(p,x,y){this.rect(x-10,y-10,20,20,p.color==='red'?'#ef6b62':'#f8f4e9',2,'#273446');}
  drawNode(n,s){super.drawNode(n,s);const hit=this.hits[this.hits.length-1],min=44/this.scale();hit.x=n.x-Math.max(79,min/2);hit.y=n.y-Math.max(64,min/2);hit.w=Math.max(158,min);hit.h=Math.max(154,min);this.rect(n.x-72,n.y+22,144,32,'#102030');this.text(label(n),n.x,n.y+42,13,'#ffffff',700,'center');}
  drawFactory(s){this.rect(30,270,1320,510,'#152a3c',10,'#52708a');for(const l of s.links){const a=E.get(s,l.from),b=E.get(s,l.to);this.line([[a.x,a.y],[b.x,b.y]],'#cfa553',12);this.text('→',(a.x+b.x)/2,(a.y+b.y)/2,24,'#ffffff');}for(const n of s.nodes)this.drawNode(n,s);for(const t of s.transit){const a=E.get(s,t.from),b=E.get(s,t.to),k=1-t.left/t.duration;this.packet(t.job,a.x+(b.x-a.x)*k,a.y+(b.y-a.y)*k);}if(this.moveGhost){const n=E.get(s,this.moveGhost.id);this.drawNode({...n,...this.moveGhost},s);}}
}
export function createFactoryContract({getSaved,save,trained,onTrain,onHome,onSound=()=>{}}){
  const root=document.createElement('section');root.id='factoryContract';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-label','Контракт: перестроить сортировку');
  root.innerHTML=`<header><b>СКЛАД 07 · ПОДРЯД 3×</b><button data-action="home">ДОМОЙ</button></header><div class="fc-gate" hidden><h2>Одно условие — два выхода</h2><p>Ты: «Белые и красные можно разложить так же, как фото и текст». Сначала попробуй развилку у Марка: заказ №2 Питонио. Затем возвращайся сюда — договор и партия подождут.</p><button data-action="train">К МАРКУ · ФОТО / ТЕКСТ</button></div><div class="fc-work"><p class="fc-brief">60 ящиков · 60 ₽ за верный ящик вместо 20 ₽ · 3600 ₽ за всю принятую партию, один раз. Белые налево, красные направо.</p><div class="fc-tabs"><button data-action="plan">ВИД СВЕРХУ</button><button data-action="world">3D ЦЕХ</button><button data-action="pause">ПУСК / ПАУЗА</button></div><div class="fc-view"><canvas aria-label="План размещения машин"></canvas><canvas class="fc-world" aria-label="Живой завод с двумя выходами" hidden></canvas></div><div class="fc-walk" hidden><button data-walk="turn-left">↶</button><button data-walk="forward">ВПЕРЁД</button><button data-walk="backward">НАЗАД</button><button data-walk="turn-right">↷</button><button data-action="jump">ПРЫЖОК</button><button data-action="talk">ГОВОРИТЬ</button></div><output class="fc-status" aria-live="polite"></output><div class="fc-controls"><div class="fc-edit"><button data-action="build">+ РАЗВИЛКА</button><button data-action="link">СОЕДИНИТЬ</button><button data-action="move">ПЕРЕСТАВИТЬ</button><button data-action="clear">УБРАТЬ СВЯЗИ</button></div><div class="fc-manual"><span>Рукой следующий ящик:</span><button data-action="left">← ЛЕВЫЙ</button><button data-action="right">ПРАВЫЙ →</button></div><div class="fc-rules"><label>Белый <select data-color="white"><option value="">— выход —</option><option value="left">Налево</option><option value="right">Направо</option></select></label><label>Красный <select data-color="red"><option value="">— выход —</option><option value="left">Налево</option><option value="right">Направо</option></select></label><button data-action="code">РУКОПИСНЫЙ КОД</button><button data-action="retry">ВЕРНУТЬ ОШИБКИ</button></div></div><div class="fc-code" hidden><label>Та же развилка на Python (color: white/red, выход: left/right)<textarea spellcheck="false" aria-label="Программа сортировки"></textarea></label><button data-action="apply">УСТАНОВИТЬ КОД</button><button data-action="code">ЗАКРЫТЬ КОД</button></div><p class="fc-hint">Поставь развилку. «Соединить»: вход → развилка → оба выхода. «Переставить»: перетащи машину. Можно сначала разложить рукой — это та же партия.</p></div>`;
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./factory-contract.css?v=20.2.0',import.meta.url).href;document.head.append(css);document.body.append(root);
  const canvas=root.querySelector('canvas'),worldCanvas=root.querySelector('.fc-world'),status=root.querySelector('output');
  const view=new FactoryPlan(canvas,{click:click,move:p=>act(()=>E.move(s,p.id,p.x,p.y)),connect:(a,b)=>act(()=>E.connect(s,a,b))});
  let s=null,active=false,world=false,from=null,changed=false,last=0,lastSave=0,message='',map=null,atlas=null,red=null,white=null,terminal=null,arm=null,lightmap=null;
  let body=createBody(8,11.3),yaw=0,lookPitch=0,speech='',speechUntil=0;const walking=new Set();
  const ray=createRenderer(640,360);worldCanvas.width=640;worldCanvas.height=360;
  loadAtlas().then(a=>{atlas=a;white=tint(a.crate3q,[1.7,1.9,2.2]);red=tint(a.crate3q,[1.4,.45,.4]);terminal=paintTerminal(true);arm=buildArmSprites();map=buildFactoryMap();dressHall(map,a);lightmap=bakeLightmap(map,LAMPS,{ambient:[.4,.4,.45]});}).catch(()=>{message='Текстуры цеха не загрузились. Обнови страницу.';});
  function persist(){if(!s)return;const reward=factorySettlement(s);save(JSON.parse(JSON.stringify(s)),reward);if(reward){message='Начальник: «Работает. Даже без моего крика. 3600 ₽ перевёл». Договор выполнен.';onSound('cash');}changed=false;}
  function act(fn){const r=fn();message=r?.message||'Планировка изменена.';changed=true;persist();sync();return r;}
  function click(hit,p){if(!active||!s)return;if(view.tool==='build:router'){act(()=>E.build(s,'router',p.x,p.y));view.tool='select';return;}if(hit?.kind==='node'){view.selected=hit.id;if(view.tool==='link'){if(from){act(()=>E.connect(s,from,hit.id));from=null;}else {from=hit.id;message=`${label(E.get(s,from))}: теперь выбери следующую машину.`;}}else message=E.get(s,hit.id).status;sync();}}
  function sync(){if(!s)return;const f=s.factory;status.textContent=`${f.done.length}/60 верно · ${f.errors.length} ошибок · ${s.paused?'ПАУЗА':'ЛИНИЯ ИДЁТ'} · ${s.program?'КОД':'ПРАВИЛА / РУКА'}${f.paid?' · 3600 ₽ получены':''}. ${message}`;for(const el of root.querySelectorAll('[data-color]')){const color=el.dataset.color;const r=s.program?{action:s.program.table[(color==='white'?'image':'text')+':0:0']}:s.rules[color==='white'?0:1];el.value=r.action==='photo'?'left':r.action==='writer'?'right':'';}}
  root.addEventListener('change',ev=>{if(ev.target.dataset.color)act(()=>E.factoryRule(s,ev.target.dataset.color,ev.target.value));});
  root.addEventListener('click',ev=>{const a=ev.target.closest('[data-action]')?.dataset.action;if(!a)return;onSound('ui-click');if(a==='home'){close();onHome();return;}if(a==='train'){close();onTrain();return;}if(!s)return;
    if(a==='plan'||a==='world'){world=a==='world';root.querySelector('.fc-walk').hidden=!world;canvas.hidden=world;worldCanvas.hidden=!world;view.resize();}
    if(a==='jump')jump(body);
    if(a==='talk'){let nearest=null;for(const [id,w] of Object.entries(CONTRACT_WORKERS)){const d=Math.hypot(w.x-body.x,w.z-body.z);if(d<2.8&&(!nearest||d<nearest.d))nearest={id,d};}speech=nearest?colleagueLine(nearest.id,s.factory.day):'Подойди к коллеге у станка. WASD — ходьба, стрелки — поворот, Space — прыжок, E — разговор.';speechUntil=performance.now()+6000;}
    if(a==='pause')act(()=>{s.paused=!s.paused;return {message:s.paused?'Линия остановлена. Можно менять схему.':'Линия запущена.'};});
    if(a==='build'&&world){world=false;worldCanvas.hidden=true;canvas.hidden=false;root.querySelector('.fc-walk').hidden=true;view.resize();}
    if(a==='build'){view.tool='build:router';message='Коснись свободного пола: там появится развилка.';}
    if(a==='link'){view.tool='link';from=null;message='Коснись источника, затем получателя. Нужны три связи.';}
    if(a==='move'){view.tool='move';message='Перетащи машину в свободное место.';}
    if(a==='clear')act(()=>{s.links=[];return {message:'Связи убраны. Ящики в пути доедут.'};});
    if(a==='left'||a==='right')act(()=>E.factoryManual(s,a));
    if(a==='retry')act(()=>E.factoryRetry(s));
    if(a==='code'){if(!root.querySelector('textarea').value)root.querySelector('textarea').value=s.codeDraft||FACTORY_CODE;const panel=root.querySelector('.fc-code');panel.hidden=!panel.hidden;s.paused=true;}
    if(a==='apply'){const draft=root.querySelector('textarea').value;act(()=>E.factoryProgram(s,draft));}
    sync();
  });
  function point(n){return {x:2+(n.x-70)/1240*11,z:3+(n.y-325)/405*6};}
  function drawWorld(){if(!map||!atlas)return;const sprites=[];const add=(img,p,y=0,ppm=40)=>sprites.push({img,...p,y,ppm,fullbright:true});
    // Clear the old shift's movable cargo and mark the *saved* line on its floor.
    for(const c of map.cells)if(c.x>=2&&c.x<=14&&c.z>=3&&c.z<=11){c.floor=0;c.kind='.';c.ftex='FLOOR0_5';delete c.surfaceVelocity;}
    for(const l of s.links){const a=point(E.get(s,l.from)),b=point(E.get(s,l.to));for(let k=0;k<=1;k+=.03){const x=Math.floor(a.x+(b.x-a.x)*k),z=Math.floor(a.z+(b.z-a.z)*k),c=map.cells[z*map.w+x];if(c&&!c.solid){c.ftex='BELT_TOP';c.wall='BELT_SIDE';c.floor=.88;c.kind='=';const length=Math.hypot(b.x-a.x,b.z-a.z)||1;c.surfaceVelocity={x:(b.x-a.x)/length*.55,z:(b.z-a.z)/length*.55};}}}
    for(const n of s.nodes){const p=point(n);add(n.type==='router'?(arm['arm07_'+(n.queue.length||s.transit.some(t=>t.from===n.id)?['reach','lift','lift','drop'][Math.floor(s.time*5)%4]:'idle')+'_0']||terminal):atlas.crate3q,p,0,n.type==='router'?28:55);for(let i=0;i<n.queue.length;i++)add(n.queue[i].color==='red'?red:white,{x:p.x+(i%5-2)*.32,z:p.z+(Math.floor(i/5)%4)*.32},.35+Math.floor(i/20)*.35,85);}
    for(const j of [...s.factory.done,...s.factory.errors]){const p=point(E.get(s,j.exit)),i=j.id-1;add(j.color==='red'?red:white,{x:p.x+(i%5-2)*.32,z:p.z+.6+(Math.floor(i/5)%3)*.32},.35+Math.floor(i/15)*.35,85);}
    for(const t of s.transit){const a=point(E.get(s,t.from)),b=point(E.get(s,t.to)),k=1-t.left/t.duration;add(t.job.color==='red'?red:white,{x:a.x+(b.x-a.x)*k,z:a.z+(b.z-a.z)*k},.6,60);}
    for(const [id,w] of Object.entries(CONTRACT_WORKERS)){const name={welder:'welder',fitter:'fitter',electrician:'electrician',lunch:'lunch'}[id];const face=viewIndex(w.facing,body.x,body.z,w.x,w.z);const img=atlas[`${name}_work0_r${face}`]||atlas[`${name}_eat0_r${face}`]||atlas[`${name}_r${face}`];if(img)add(img,w,0,40);}
    ray.render({map,cam:{x:body.x,z:body.z,yaw,eye:body.y+1.6,pitch:lookPitch},lightmap,sprites,fov:95,fog:.035,time:s.time});worldCanvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(ray.buf.buffer),640,360),0,0);
    const ctx=worldCanvas.getContext('2d');ctx.fillStyle='#081421e8';ctx.fillRect(0,0,640,32);ctx.fillStyle='#fff';ctx.font='bold 18px sans-serif';ctx.fillText('БЕЛЫЕ ←       ДЕНЬ '+s.factory.day+'       → КРАСНЫЕ',16,23);if(performance.now()<speechUntil){ctx.fillStyle='#081421ed';ctx.fillRect(0,285,640,75);ctx.fillStyle='#fff';ctx.font='16px sans-serif';const words=speech.split(' ');let line='',y=309;for(const w of words){if(ctx.measureText(line+w).width>610){ctx.fillText(line,14,y);y+=20;line='';}line+=w+' ';}ctx.fillText(line,14,y);}
  }
  function frame(now){requestAnimationFrame(frame);if(!active||!s)return;const dt=Math.min(.1,(now-(last||now))/1000);last=now;if(!s.paused){E.tick(s,dt);changed=true;}if(world){if(walking.has('turn-left'))yaw-=dt*1.8;if(walking.has('turn-right'))yaw+=dt*1.8;const f=(walking.has('forward')?1:0)-(walking.has('backward')?1:0),side=(walking.has('right')?1:0)-(walking.has('left')?1:0);if(map){moveBody(map,body,(Math.sin(yaw)*f+Math.cos(yaw)*side)*dt*2.7,(-Math.cos(yaw)*f+Math.sin(yaw)*side)*dt*2.7);carryBySurface(map,body,dt);stepBody(map,body,dt);}drawWorld();}else view.draw(s);if(now-lastSave>600){if(changed)persist();lastSave=now;sync();}}
  const keyMap={KeyW:'forward',ArrowUp:'forward',KeyS:'backward',ArrowDown:'backward',KeyA:'left',KeyD:'right',ArrowLeft:'turn-left',ArrowRight:'turn-right'};
  window.addEventListener('keydown',ev=>{if(!active||!world||ev.target.tagName==='TEXTAREA')return;if(keyMap[ev.code]){walking.add(keyMap[ev.code]);ev.preventDefault();}if(ev.code==='Space'){jump(body);ev.preventDefault();}if(ev.code==='KeyE')root.querySelector('[data-action="talk"]').click();});
  window.addEventListener('keyup',ev=>walking.delete(keyMap[ev.code]));window.addEventListener('blur',()=>walking.clear());
  for(const b of root.querySelectorAll('[data-walk]')){b.addEventListener('pointerdown',ev=>{walking.add(b.dataset.walk);b.setPointerCapture(ev.pointerId);});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>walking.delete(b.dataset.walk));}
  createDragLook(worldCanvas,{active:()=>active&&world,onLook:(dx,dy)=>{yaw+=dx*.004;lookPitch=Math.max(-150,Math.min(150,lookPitch-dy*.5));}});
  requestAnimationFrame(frame);
  function open(){s=getSaved()||E.createFactory();active=true;last=0;root.hidden=false;root.querySelector('textarea').value=s.codeDraft||FACTORY_CODE;root.querySelector('.fc-gate').hidden=trained();root.querySelector('.fc-work').hidden=!trained();if(!trained()){s.paused=true;}else {s.paused=true;message=s.factory.paid?'Продолжаем: построенная линия и результаты сохранены.':'Ты: «Предлагаю развилку: белые налево, красные направо». Начальник: «Ставь. У меня из автоматизации пока только чайник». Начни рукой или собери линию.';}persist();view.resize();sync();return true;}
  function close(){if(active){s.paused=true;persist();}active=false;walking.clear();root.hidden=true;}
  window.addEventListener('pagehide',()=>{if(active)persist();});
  window.addEventListener('keydown',ev=>{if(active&&ev.key==='Escape'&&ev.target.tagName!=='TEXTAREA'){close();onHome();}});
  return {open,close,get active(){return active;},get state(){return s;},observe:()=>({body:{...body},yaw,day:s?.factory.day,speech,workers:CONTRACT_WORKERS}),root};
}

export function colleagueLine(id,day){const lines={welder:['Сварщик: Вчера начальник кричал «не трогай». Сегодня просит «перестрой». Прогресс.', 'Сварщик: Белые налево. Искры — куда захотят. Не путай наши технологии.'],fitter:['Слесарь: Я свой станок в угол оттащил. Тут теперь твоя развилка, не споткнись.', 'Слесарь: Развилку сохранил? А то я вчера чертёж на бутерброде унес.'],electrician:['Электрик: За три ставки согласился? Ладно. Я пока за три розетки отвечаю.', 'Электрик: Провод вижу. Ток вижу. Начальника не вижу — лучший режим работы.'],lunch:['Грузчик: Автоматизация хороша: ящик едет, бутерброд остаётся со мной.', 'Грузчик: Вчера красные сюда шли. Сегодня уже умнее. Ящики, я имею в виду.']};return (lines[id]||lines.fitter)[Math.abs((day||6)-6)%2];}
