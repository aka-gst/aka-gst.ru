const emotions = {
  joy: ['Удовлетворение','Покой','Радость','Энтузиазм','Веселье','Достоинство','Приподнятость','Жизнерадостность','Просветлённость','Восхищение','Упоение','Любовь','Восторг','Ликование'],
  anger: ['Задетость','Расстройство','Напряжение','Обида','Раздражение','Обманутость','Досада','Рассерженность','Безумие','Ожесточение','Омерзение','Бешенство','Злоба','Ярость'],
  confusion: ['Нерешительность','Неловкость','Суетливость','Разочарование','Скованность','Спутанность','Недоумение','Бессилие','Отверженность','Раздвоенность','Смятение','Смущение','Безвыходность','Обескураженность']
};
const transitions = {4:14,9:31,17:69,20:32,24:45,28:50,36:55,40:59,44:51,46:60,54:68,3:30,5:9,8:7,12:2,16:6,18:11,26:5,34:12,35:13,38:15,43:19,52:29,55:23,61:44,62:19,63:2,64:41,65:52,72:51};
const arrows = new Set([4,9,17,20,24,28,36,40,44,46,54]);
const cells = Array.isArray(window.LEELA_CELLS) ? window.LEELA_CELLS : [];
const dieFace = value => `<img class="die-face" src="assets/dice/dice-${value}.svg" alt="Выпало ${value}">`;
const rowOf = n => Math.floor((n - 1) / 9) + 1;
/* Значки вставляются разметкой, а не картинкой: currentColor берёт цвет от
   клетки только у встроенного SVG. Рисунок сплошной — контурный на 16
   пикселях не читался и поле выглядело бледнее прежних стрелок. */
const routeIcons = {ladder:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="currentColor" d="M3 1h3v14H3zM10 1h3v14h-3zM5 2h6v2H5zM5 7h6v2H5zM5 12h6v2H5z"/></svg>',snake:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="currentColor" d="M13 1c2 0 3 1 3 3 0 2-2 3-4 4l-4 1c-1 0-2 1-2 2s1 1 2 1c1 0 2-1 3-2l2 2c-2 2-3 3-6 3-3 0-5-2-5-4 0-3 2-4 5-5l4-1c1 0 1-1 1-1s0-1-1-1l-2 1-2-2c2-1 3-1 6-1z"/></svg>'};
const cellName = n => (cells[n-1] && cells[n-1].name) || `Клетка ${n}`;
/* Три мира — три прочтения одной клетки. Ведущая шкала решает, какой вопрос
   задаст игра: покой — саттва, гнев — раджас, растерянность — тамас. При
   равенстве берётся более тяжёлый: в смешанном состоянии человек ближе к нему. */
const WORLD_NAMES = {sattva:'Светлый мир',rajas:'Мир движения',tamas:'Тёмный мир'};
function worldFromScales(joy,anger,confusion){
  if(!joy&&!anger&&!confusion)return 'sattva';
  if(confusion>=anger&&confusion>=joy)return 'tamas';
  if(anger>=joy)return 'rajas';
  return 'sattva';
}
function worldNow(){
  return worldFromScales(Number($('joy').value),Number($('anger').value),Number($('confusion').value));
}
const cellAsk = (n,world) => (cells[n-1] && cells[n-1].ask && cells[n-1].ask[world]) || '';
const cellText = n => (cells[n-1] && cells[n-1].text) || 'Описание клетки не загрузилось. Обновите страницу.';
const STORE = 'leela-mvp-v1';
const characters = {
  traveler:{src:'assets/characters/traveler.png',label:'Путешественник'},
  totem:{src:'assets/characters/totem.png',label:'Тотем'},
  wooden:{src:'assets/characters/wooden.png',label:'Деревянный странник'},
  spirit:{src:'assets/characters/spirit.png',label:'Дух-сфера'}
};
function blankState(){return{position:0,entered:false,finished:false,extraRoll:false,history:[],pending:null,character:null};}
function readLocalState(){
  let stored=null;
  try{stored=JSON.parse(localStorage.getItem(STORE)||'null');}catch(error){stored=null;}
  const next={...blankState(),...(stored||{})};
  if(!Array.isArray(next.history))next.history=[];
  if(typeof next.entered!=='boolean')next.entered=next.history.some(h=>h.from===0&&h.roll===6&&h.landed===6);
  if(!next.entered){next.position=0;next.pending=null;}
  if(typeof next.finished!=='boolean')next.finished=next.position===68;
  if(typeof next.extraRoll!=='boolean')next.extraRoll=false;
  if(!characters[next.character])next.character=null;
  return next;
}
let state = readLocalState();
const $ = id => document.getElementById(id);
let serverAvailable=false;
let visualPosition=null,queuedMoveAnimation=null,movementRunning=false,previewRoute=null;
let characterIdleTimer=null;
let mobileView=state.pending?'cell':'turn';
// Дневник стёрт из панели аккаунта: убираем записи с экрана, не трогая партию.
// Очередь отправки тоже чистим — иначе повтор вернул бы на сервер запись,
// которую игрок только что удалил.
document.addEventListener('leela:history-wiped',()=>{state.history=[];outbox=[];writeOutbox();writeLocal();renderHistory();});
window.addEventListener('leela-descriptions-ready', () => {
    render();
});
/* Игра открывается и по адресу /leela, поэтому адреса API берутся относительно
   самого скрипта, а не от корня сайта. Общий вход — исключение: он один на весь
   сайт и всегда живёт на /api/auth. */
const APP_BASE=new URL('.',(document.currentScript&&document.currentScript.src)||location.href).href;
const apiUrl=path=>new URL(path,APP_BASE).href;
let account=null,knownAccountId=null,booted=false,saveQueue=Promise.resolve();
let karma=0,practicesToday=[],nextRollCost=0;
function renderKarma(){
  const box=$('karmaValue'),hint=$('rollCost');
  if(box)box.textContent=karma;
  if(hint)hint.textContent=nextRollCost?`Следующий бросок сегодня — ${nextRollCost} кармы`:'Бросок сегодня бесплатный';
  document.querySelectorAll('[data-practice]').forEach(button=>{
    const done=practicesToday.includes(button.dataset.practice);
    button.classList.toggle('done',done);
    button.disabled=done;
    button.setAttribute('aria-pressed',String(done));
  });
}
/* Запись дневника ценнее позиции на поле, поэтому она не теряется при обрыве
   связи: неотправленные записи ждут в очереди и уходят при первой возможности.
   Сеть на телефоне моргает постоянно, и одна неудача не должна уводить игру в
   локальный режим до конца сессии. */
const OUTBOX='leela-outbox-v1';
let outbox=readOutbox(),retryTimer=null,retryDelay=2000;
function readOutbox(){try{const stored=JSON.parse(localStorage.getItem(OUTBOX)||'[]');return Array.isArray(stored)?stored:[];}catch(error){return [];}}
function writeOutbox(){try{localStorage.setItem(OUTBOX,JSON.stringify(outbox));}catch(error){/* приватный режим */}}
function markOnline(){serverAvailable=true;retryDelay=2000;updateServerStatus();}
function markOffline(){serverAvailable=false;updateServerStatus();scheduleRetry();}
function scheduleRetry(){
  if(retryTimer)return;
  retryTimer=setTimeout(()=>{retryTimer=null;retryDelay=Math.min(retryDelay*2,30000);void syncAll();},retryDelay);
}
/* Ответ сервера не выбрасываем: в нём приходит начисленная карма и новая
   цена броска — иначе на экране они отстают на один ход. */
function absorbProgress(remote){
  if(!remote)return;
  if(typeof remote.karma==='number')karma=remote.karma;
  if(Array.isArray(remote.practices))practicesToday=remote.practices;
  if(typeof remote.next_roll_cost==='number')nextRollCost=remote.next_roll_cost;
  renderKarma();
}
async function syncAll(){
  try{
    while(outbox.length){
      absorbProgress(await postJson(apiUrl('api/progress/entry'),{entry:outbox[0],state:stateForServer()}));
      outbox.shift();writeOutbox();
    }
    absorbProgress(await postJson(apiUrl('api/progress'),{state:stateForServer()}));
    markOnline();
    return true;
  }catch(error){
    markOffline();
    return false;
  }
}
function writeLocal(){try{localStorage.setItem(STORE,JSON.stringify(state));}catch(error){/* приватный режим */}}
function stateForServer(){return{position:state.position,entered:state.entered,finished:state.finished,extraRoll:state.extraRoll,character:state.character,pending:state.pending};}
async function api(path,options){
  const response=await fetch(path,{credentials:'same-origin',...(options||{})});
  if(!response.ok){const error=new Error('request_failed');error.status=response.status;try{error.payload=await response.json();}catch(ignored){error.payload=null;}throw error;}
  return response.json();
}
function postJson(path,body){return api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});}
function updateServerStatus(){
  const status=$('serverStatus');
  if(!status)return;
  if(!serverAvailable){
    status.textContent=outbox.length
      ?`Нет связи с сервером · ${outbox.length} ${outbox.length===1?'запись ждёт':'записей ждут'} отправки, не закрывайте вкладку`
      :'Нет связи с сервером · пробуем ещё раз';
    return;
  }
  if(account){status.textContent=`Таймер отключён · аккаунт ${account.nickname}, прогресс на сервере`;return;}
  status.textContent='Таймер отключён · гостевая игра, войдите чтобы продолжить с другого устройства';
}
/* Попытка делается всегда, даже когда связи только что не было: иначе одна
   сетевая осечка отключает сохранение до перезагрузки страницы. */
function save(){
  writeLocal();
  saveQueue=saveQueue.then(()=>syncAll()).catch(()=>{});
  return saveQueue;
}
function adoptRemote(remote){
  const incoming=remote.state||{};
  account=remote.account||null;
  if(typeof remote.karma==='number')karma=remote.karma;
  if(Array.isArray(remote.practices))practicesToday=remote.practices;
  if(typeof remote.next_roll_cost==='number')nextRollCost=remote.next_roll_cost;
  state.entered=Boolean(incoming.entered);
  state.position=state.entered?incoming.position:0;
  state.finished=Boolean(incoming.finished);
  state.extraRoll=Boolean(incoming.extraRoll);
  state.pending=incoming.pending||null;
  const remoteHistory=Array.isArray(remote.history)?remote.history:[];
  // Неотправленные записи не должны исчезнуть под серверным ответом.
  const known=new Set(remoteHistory.map(entry=>entry.at));
  state.history=remoteHistory.concat(outbox.filter(entry=>!known.has(entry.at)));
  if(characters[incoming.character])state.character=incoming.character;
  visualPosition=null;queuedMoveAnimation=null;
  mobileView=state.pending?'cell':mobileView;
  writeLocal();
  if(state.character)closeCharacterChoice();
  render();renderKarma();
  $('adoptButton').hidden=!remote.guest_progress_available;
  updateServerStatus();
}
async function importLocalPath(){
  try{
    const remote=await postJson(apiUrl('api/progress/import'),{state:stateForServer(),history:state.history});
    outbox=[];writeOutbox();
    adoptRemote(remote);
  }catch(error){
    if(error.status===409)adoptRemote(await api(apiUrl('api/progress')));
    else await save();
  }
}
async function connectServer(){
  try{
    const remote=await api(apiUrl('api/progress'));
    serverAvailable=true;
    if(remote.state.entered||remote.history.length){adoptRemote(remote);await syncAll();}
    else if(state.entered||state.history.length)await importLocalPath();
    else{adoptRemote(remote);await save();}
  }catch(error){
    markOffline();
  }
}
/* Вход или выход сменил игрока: берём то, что лежит на сервере под новой
   учётной записью, и никогда не переносим туда чужой локальный путь. */
async function reloadForIdentity(){
  try{
    const remote=await api(apiUrl('api/progress'));
    serverAvailable=true;
    if(!remote.state.entered&&!remote.history.length){state={...blankState(),character:state.character};outbox=[];writeOutbox();}
    adoptRemote(remote);
    if(state.character)scheduleCharacterIdle(true);else openCharacterChoice();
  }catch(error){
    markOffline();
  }
}
function options(){Object.entries(emotions).forEach(([key,list])=>{const el=$(key),output=$(`${key}Value`);const paint=()=>{const level=Number(el.value);output.textContent=level?list[level-1]:'Не выбрано';if(level)Object.keys(emotions).forEach(otherKey=>{$(otherKey).closest('.scale').classList.remove('scale-empty');$(otherKey).removeAttribute('aria-invalid');});};el.addEventListener('input',paint);paint();});}
function validateEmotionScales(){const valid=Object.keys(emotions).some(key=>Number($(key).value)>0);Object.keys(emotions).forEach(key=>{$(key).closest('.scale').classList.toggle('scale-empty',!valid);if(valid)$(key).removeAttribute('aria-invalid');else $(key).setAttribute('aria-invalid','true');});if(!valid)$('turnHint').textContent='Перед броском выберите состояние хотя бы на одной шкале.';return valid;}
function resetEmotionScales(){Object.keys(emotions).forEach(key=>{const el=$(key);el.value='0';el.dispatchEvent(new Event('input'));});}
function renderBoard(){const board=$('board'),tpl=$('cellTemplate'),actualPosition=state.entered?state.position:1;board.innerHTML='';for(let topRow=0;topRow<8;topRow++){const boardRow=7-topRow;for(let col=0;col<9;col++){const n=boardRow%2===0?boardRow*9+col+1:boardRow*9+9-col;const node=tpl.content.cloneNode(true),cell=node.querySelector('.cell');cell.dataset.n=n;cell.querySelector('.cell-number').textContent=n;cell.querySelector('.cell-name').textContent=n===68?`${cellName(n)} · Финал`:cellName(n);if(n===68)cell.classList.add('final-cell');if(transitions[n]){const isArrow=arrows.has(n),badge=document.createElement('span');cell.classList.add(isArrow?'arrow-start':'snake-start');badge.className=`route-badge ${isArrow?'route-badge-arrow':'route-badge-snake'}`;badge.innerHTML=isArrow?routeIcons.ladder:routeIcons.snake;badge.title=`${isArrow?'Лестница':'Змея'}: ${n} → ${transitions[n]}`;cell.append(badge);cell.onmouseenter=()=>setRoutePreview(n);cell.onmouseleave=()=>{if(!movementRunning)setRoutePreview(null);};}cell.onclick=()=>{showCell(n,'',n!==actualPosition);setRoutePreview(transitions[n]?n:null);setMobileView('cell');};board.append(node);}}requestAnimationFrame(()=>{drawPaths();positionPlayer(visualPosition??actualPosition,false);});}
function pieceTransform(x,y){return `translate(${x}px,${y}px) translate(-50%,-72%)`;}
function positionPlayer(position,animate=true){const piece=$('playerPiece'),cell=document.querySelector(`.cell[data-n="${position}"]`);if(!piece||!cell||!state.character)return;piece.classList.toggle('no-transition',!animate);piece.style.transform=pieceTransform(cell.offsetLeft+cell.offsetWidth/2,cell.offsetTop+cell.offsetHeight/2);if(!animate)requestAnimationFrame(()=>piece.classList.remove('no-transition'));}
function renderCharacter(){const piece=$('playerPiece'),image=$('playerPieceImage');if(!piece||!image)return;piece.hidden=!state.character;if(!state.character)return;piece.dataset.character=state.character;image.src=characters[state.character].src;image.alt=characters[state.character].label;positionPlayer(visualPosition??(state.entered?state.position:1),false);}
function setVisualPosition(position){visualPosition=position;positionPlayer(position,true);centreBoardOnPlayer(true);}
const movementDelay=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
/* Поле на телефоне показывается крупно, а не целиком: 72 клетки в ширину
   экрана нечитаемы. Масштаб 1 — поле влезает полностью, дальше приближение. */
const BOARD_ZOOM_MIN=1,BOARD_ZOOM_MAX=5;
let boardZoom=2.6;
const onNarrowScreen=()=>matchMedia('(max-width: 900px)').matches;
function applyBoardZoom(){
  document.documentElement.style.setProperty('--board-zoom',boardZoom.toFixed(2));
  // Два кадра: в первом браузер пересчитывает раскладку под новый масштаб,
  // и только во втором у клеток верные размеры. По одному кадру фишка
  // встаёт по старым координатам и оказывается за краем поля.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    drawPaths();
    positionPlayer(visualPosition??(state.entered?state.position:1),false);
  }));
}
function setBoardZoom(value,keepCentre=true){
  const wrap=document.querySelector('.board-wrap');
  const next=Math.min(BOARD_ZOOM_MAX,Math.max(BOARD_ZOOM_MIN,value));
  if(!wrap||Math.abs(next-boardZoom)<0.01)return;
  // Точка, которая была в центре экрана, должна там и остаться.
  const ratio=next/boardZoom;
  const cx=wrap.scrollLeft+wrap.clientWidth/2,cy=wrap.scrollTop+wrap.clientHeight/2;
  boardZoom=next;
  applyBoardZoom();
  if(keepCentre)requestAnimationFrame(()=>{
    wrap.scrollLeft=cx*ratio-wrap.clientWidth/2;
    wrap.scrollTop=cy*ratio-wrap.clientHeight/2;
  });
}
function centreBoardOnPlayer(smooth=false){
  if(!onNarrowScreen())return;
  const wrap=document.querySelector('.board-wrap');
  const target=visualPosition??(state.entered?state.position:1);
  const cell=document.querySelector(`.cell[data-n="${target}"]`);
  if(!wrap||!cell)return;
  wrap.scrollTo({
    left:cell.offsetLeft+cell.offsetWidth/2-wrap.clientWidth/2,
    top:cell.offsetTop+cell.offsetHeight/2-wrap.clientHeight/2,
    behavior:smooth&&!matchMedia('(prefers-reduced-motion: reduce)').matches?'smooth':'auto'
  });
}
async function animateQueuedMove(){if(movementRunning||!queuedMoveAnimation)return;movementRunning=true;clearTimeout(characterIdleTimer);const piece=$('playerPiece'),move=queuedMoveAnimation;queuedMoveAnimation=null;piece?.classList.add('walking');for(let position=move.from+1;position<=move.landed;position+=1){await movementDelay(240);setVisualPosition(position);}piece?.classList.remove('walking');if(move.destination!==move.landed){await movementDelay(220);await animateTransitionRoute(move.landed);setVisualPosition(move.destination);await movementDelay(280);}visualPosition=null;setVisualPosition(state.entered?state.position:1);visualPosition=null;setRoutePreview(null);movementRunning=false;scheduleCharacterIdle();}
function setRoutePreview(from){previewRoute=from;document.querySelectorAll('.route-path').forEach(group=>group.classList.toggle('route-visible',Number(group.dataset.from)===from));document.querySelectorAll('.cell.route-preview,.cell.route-endpoint').forEach(cell=>cell.classList.remove('route-preview','route-endpoint'));if(from){document.querySelector(`.cell[data-n="${from}"]`)?.classList.add('route-preview','route-endpoint');document.querySelector(`.cell[data-n="${transitions[from]}"]`)?.classList.add('route-endpoint');}}
function animateTransitionRoute(from){return new Promise(resolve=>{setRoutePreview(from);const path=document.querySelector(`.route-path[data-from="${from}"] .motion-path`),runner=$('playerPiece'),stage=document.querySelector('.board-stage');if(!path||!runner||matchMedia('(prefers-reduced-motion: reduce)').matches){resolve();return;}const length=path.getTotalLength(),duration=1100,start=performance.now();stage.classList.add('route-moving');runner.classList.add('route-riding','no-transition');const frame=now=>{const progress=Math.min(1,(now-start)/duration),eased=progress<.5?2*progress*progress:1-Math.pow(-2*progress+2,2)/2,point=path.getPointAtLength(length*eased);runner.style.transform=pieceTransform(point.x,point.y);if(progress<1)requestAnimationFrame(frame);else{runner.classList.remove('route-riding','no-transition');stage.classList.remove('route-moving');resolve();}};requestAnimationFrame(frame);});}
function drawPaths(){const board=$('board'),svg=$('boardPaths');if(!board||!svg)return;const width=board.clientWidth,height=board.clientHeight;svg.setAttribute('viewBox',`0 0 ${width} ${height}`);const center=n=>{const cell=board.querySelector(`[data-n="${n}"]`);return{x:cell.offsetLeft+cell.offsetWidth/2,y:cell.offsetTop+cell.offsetHeight/2};};let markup='<defs><marker id="pathArrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="8" markerHeight="8" orient="auto"><path d="M 1 1 L 11 6 L 1 11 L 4 6 z"/></marker></defs>';Object.entries(transitions).forEach(([fromValue,toValue])=>{const from=Number(fromValue),to=Number(toValue),a=center(from),b=center(to),dx=b.x-a.x,dy=b.y-a.y,length=Math.max(1,Math.hypot(dx,dy)),nx=-dy/length,ny=dx/length,isArrow=arrows.has(from),bend=isArrow?0:(from%2?1:-1)*Math.min(72,length*.2),path=isArrow?`M ${a.x} ${a.y} L ${b.x} ${b.y}`:`M ${a.x} ${a.y} C ${a.x+dx*.3+nx*bend} ${a.y+dy*.3+ny*bend}, ${a.x+dx*.7-nx*bend} ${a.y+dy*.7-ny*bend}, ${b.x} ${b.y}`;markup+=`<g class="route-path ${isArrow?'ladder':'snake'}" data-from="${from}"><path class="route-halo" d="${path}"/><path class="motion-path route-line" d="${path}"${isArrow?' marker-end="url(#pathArrow)"':''}/><circle class="route-end" cx="${b.x}" cy="${b.y}" r="5"/><text class="route-label" x="${(a.x+b.x)/2}" y="${(a.y+b.y)/2}">${from} → ${to}</text></g>`;});svg.innerHTML=markup;setRoutePreview(previewRoute);}
function updateCellMoreHint(){const text=$('cellText'),hint=$('cellMoreHint');if(!text||!hint)return;const hasMore=text.scrollHeight>text.clientHeight+1&&text.scrollTop<text.scrollHeight-text.clientHeight-2;hint.classList.toggle('has-more',hasMore);}
function showCell(n,from='',preview=false){const title=$('cellTitleText'),text=$('cellText'),label=$('cellContextLabel'),mark=$('rowMark'),art=$('cellArt');label.hidden=preview;text.scrollTop=0;
  if(mark){mark.hidden=!n;if(n)mark.style.setProperty('--row-icon',`url(assets/rows/row-${rowOf(n)}.svg)`);}
  if(art){art.hidden=n!==68;if(n===68)art.src='assets/final.png';}
  if(!n){title.textContent='Порог игры';text.textContent='Бросьте кубик и начните путь. В Лилу можно войти только на шестёрке.';requestAnimationFrame(updateCellMoreHint);return;}title.textContent=`${n}. ${cellName(n)}${n===68?' · Финал':''}`;text.textContent=cellText(n);
  const ask=$('cellAsk'),worldTag=$('worldMark');
  if(ask){
    const world=(state.pending&&state.pending.destination===n&&state.pending.world)||worldNow();
    ask.textContent=cellAsk(n,world);
    ask.hidden=!ask.textContent;
    if(worldTag){worldTag.textContent=WORLD_NAMES[world];worldTag.dataset.world=world;worldTag.hidden=ask.hidden;}
  }text.scrollTop=0;const tr=$('transition');tr.hidden=!from;tr.textContent=from;requestAnimationFrame(updateCellMoreHint);}
$('cellText').addEventListener('scroll',updateCellMoreHint,{passive:true});
function renderHistory(){const list=$('history');if(!state.history.length){list.innerHTML='<li class="empty">Здесь появятся ваши ходы и записи Дневника.</li>';return;}list.innerHTML=[...state.history].reverse().map(h=>{const influence=h.influence?` (базовый ${h.baseRoll}, влияние ${h.influence>0?'+':''}${h.influence})`:'';return`<li><time>${new Date(h.at).toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'})}</time><div><b>${h.roll===6&&h.from===0?'Вход в игру':`Кубик: ${h.roll}`}${influence} · ${h.from||'вне поля'} → ${h.landed}${h.destination!==h.landed?` → ${h.destination}`:''}</b><br>${h.emotions.joy||'Счастье: не выбрано'} · ${h.emotions.anger||'Гнев: не выбрано'} · ${h.emotions.confusion||'Растерянность: не выбрано'}${h.note?`<em>${escapeHtml(h.note)}</em>`:''}</div></li>`;}).join('');}
function escapeHtml(s){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function updateRollButton(){const button=$('rollButton'),wrap=$('rollWrap'),reason=state.pending?'Сначала заполните Дневник':state.finished?'Игра уже завершена':'';button.disabled=Boolean(reason);wrap.dataset.tooltip=reason;wrap.classList.toggle('has-tooltip',Boolean(reason));}
function setMobileView(view,scroll=false){mobileView=view;const panels={turn:document.querySelector('.controls'),board:document.querySelector('.board-wrap'),cell:document.querySelector('.reflection')};Object.entries(panels).forEach(([key,panel])=>panel?.classList.toggle('mobile-active',key===view));document.body.classList.remove('mobile-view-turn','mobile-view-board','mobile-view-cell');document.body.classList.add(`mobile-view-${view}`);document.querySelectorAll('[data-mobile-view]').forEach(button=>{const active=button.dataset.mobileView===view;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});if(scroll&&matchMedia('(max-width: 900px)').matches)panels[view]?.scrollIntoView({behavior:'smooth',block:'start'});if(view==='board')requestAnimationFrame(()=>{drawPaths();positionPlayer(visualPosition??(state.entered?state.position:1),false);centreBoardOnPlayer();});if(view==='cell')requestAnimationFrame(updateCellMoreHint);}
function render(){const shownPosition=state.entered?state.position:1;$('position').textContent=state.finished?'Финал · 68':`Клетка ${shownPosition}`;$('turnHint').textContent=state.finished&&!state.pending?'Игра завершена на клетке 68.':state.pending?'Ход ждёт обязательного заполнения Дневника.':state.extraRoll?'Шестёрка: после заполнения шкалы можно бросить снова без ожидания.':state.entered?'Отметьте состояние и бросьте кубик.':'Сначала выкиньте 6';$('journalForm').hidden=!state.pending;updateRollButton();renderBoard();renderCharacter();showCell(shownPosition,state.finished?'Финал игры':state.entered?'':'Сначала выкиньте 6');renderHistory();setMobileView(mobileView);}
function scheduleCharacterIdle(soon=false){clearTimeout(characterIdleTimer);if(!state.character||movementRunning)return;characterIdleTimer=setTimeout(()=>{const piece=$('playerPiece');if(!piece||movementRunning)return;piece.classList.add('performing');setTimeout(()=>{piece.classList.remove('performing');scheduleCharacterIdle();},1500);},soon?1200:6500+Math.floor(Math.random()*5500));}
function closeCharacterChoice(){const dialog=$('characterDialog');if(!dialog.open)return;if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');}
function openCharacterChoice(){const dialog=$('characterDialog');if(dialog.open)return;if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}
document.querySelectorAll('.character-option').forEach(button=>button.onclick=()=>{state.character=button.dataset.character;save();const dialog=$('characterDialog');if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');renderCharacter();scheduleCharacterIdle(true);});
$('characterDialog').addEventListener('cancel',event=>event.preventDefault());
function emotionContext(){return Object.fromEntries(Object.entries(emotions).map(([key,list])=>[key,$(key).value==='0'?'':`${key==='joy'?'Счастье':key==='anger'?'Гнев':'Растерянность'}: ${list[Number($(key).value)-1]}`]));}
function secureIndex(size){const limit=Math.floor(4294967296/size)*size;let value;do{value=crypto.getRandomValues(new Uint32Array(1))[0];}while(value>=limit);return value%size;}
function fairRoll(){return secureIndex(6)+1;}
function randomUnit(){return crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;}
function applyEmotionInfluence(baseRoll){const values=['joy','anger','confusion'].map(key=>Number($(key).value)),levels=values.filter(Boolean);if(!levels.length)return{roll:baseRoll,delta:0};const digits=Array.from({length:4},()=>secureIndex(10)),intensity=levels.reduce((sum,level)=>sum+level,0)/(levels.length*14),changeChance=.75+.2*intensity;let signature=(2166136261^baseRoll)>>>0;[...values,...digits].forEach(value=>{signature=Math.imul(signature^value,16777619)>>>0;});if(randomUnit()>=changeChance)return{roll:baseRoll,delta:0};const alternatives=[1,2,3,4,5,6].filter(value=>value!==baseRoll),roll=alternatives[(secureIndex(5)+(signature%5))%5];return{roll,delta:roll-baseRoll};}
function animateDie(result){return new Promise(resolve=>{const die=$('die');die.classList.add('rolling','has-face');let frame=0;const timer=setInterval(()=>{die.innerHTML=dieFace(1+Math.floor(Math.random()*6));frame+=1;if(frame>=12){clearInterval(timer);die.innerHTML=dieFace(result);die.classList.remove('rolling');resolve();}},85);});}
function showMoveDialog({roll,landed,destination,failedEntry=false,enteredNow=false}){const dialog=$('moveDialog');const art=$('dialogArt');if(art){art.hidden=destination!==68||failedEntry;if(!art.hidden)art.src='assets/finale.png';}$('dialogDie').innerHTML=dieFace(roll);$('moveDialogTitle').textContent=`На кубике выпало ${roll}`;$('moveDialogCell').textContent=failedEntry?'Вы остались на клетке 1. Рождение (джанма).':destination!==landed?`Вы попали на клетку ${landed}, затем перешли на клетку ${destination}. ${cellName(destination)}.`:`Вы перешли на клетку ${destination}. ${cellName(destination)}.`;const baseMessage=failedEntry?'Вы не можете войти в игру, пока не выкинете "6". Но у вас есть еще попытки кинуть кубик. Используйте их прямо сейчас.':enteredNow?'Вы вошли в игру. Прочитайте описание клетки 6 и обязательно заполните Дневник.':destination===68?'Вы достигли финала. Прочитайте описание и обязательно заполните Дневник.':'Прочитайте описание новой клетки и обязательно заполните Дневник.';const sixMessage=roll===6&&!failedEntry?' Выпала шестёрка: после обязательного заполнения Дневника можно сразу бросить кубик ещё раз, не ожидая 24 часа.':'';$('moveDialogMessage').textContent=baseMessage+sixMessage;if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}
function closeMoveDialog(){const dialog=$('moveDialog');if(typeof dialog.close==='function')dialog.close();else{dialog.removeAttribute('open');void revealBoardThenAnimate();}}
$('moveDialogClose').onclick=$('moveDialogContinue').onclick=closeMoveDialog;
async function revealBoardThenAnimate(){if(!queuedMoveAnimation)return;if(matchMedia('(max-width: 900px)').matches){setMobileView('board',true);await movementDelay(550);}await animateQueuedMove();if(matchMedia('(max-width: 900px)').matches)setMobileView('cell',true);}
$('moveDialog').addEventListener('close',()=>void revealBoardThenAnimate());
$('rulesButton').onclick=()=>{const dialog=$('rulesDialog');if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');};
function closeRules(){const dialog=$('rulesDialog');if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');}
$('rulesClose').onclick=$('rulesContinue').onclick=closeRules;
$('rulesDialog').addEventListener('click',e=>{if(e.target===$('rulesDialog'))closeRules();});
$('emotionForm').onsubmit=async e=>{
  e.preventDefault();
  if(state.finished)return;
  if(!validateEmotionScales())return;
  const button=$('rollButton'),from=state.entered?state.position:0,enteredNow=!state.entered;
  const world=worldNow();
  if(serverAvailable){
    button.disabled=true;
    try{
      const paid=await postJson(apiUrl('api/turn/spend'),{});
      karma=paid.karma;nextRollCost=paid.next_roll_cost;practicesToday=paid.practices||practicesToday;
      renderKarma();
    }catch(error){
      button.disabled=false;
      if(error.status===402){
        const need=(error.payload&&error.payload.cost)||0;
        $('turnHint').textContent=`Сегодня бросок стоит ${need} кармы, а её ${(error.payload&&error.payload.karma)||0}. Отметьте практику — карма появится.`;
        return;
      }
      markOffline();
    }
  }
  const baseRoll=fairRoll(),influenced=applyEmotionInfluence(baseRoll),roll=influenced.roll,context=emotionContext();
  button.disabled=true;
  $('turnHint').textContent='Кубик катится…';
  await animateDie(roll);
  if(!state.entered&&roll!==6){
    queuedMoveAnimation=null;
    state.extraRoll=false;
    state.history.push({at:Date.now(),from:1,roll,baseRoll,influence:influenced.delta,landed:1,destination:1,emotions:context,world,note:''});
    save();renderHistory();showCell(1,'Сначала выкиньте 6');
    $('turnHint').textContent='Сначала выкиньте 6';
    button.disabled=false;
    showMoveDialog({roll,landed:1,destination:1,failedEntry:true});
    return;
  }
  if(!state.entered)state.entered=true;
  const landed=from?Math.min(72,from+roll):6,destination=transitions[landed]||landed;
  visualPosition=from||1;
  queuedMoveAnimation={from:from||1,landed,destination};
  state.position=destination;
  state.finished=destination===68;
  state.extraRoll=roll===6&&!state.finished;
  state.pending={at:Date.now(),from:from||1,roll,baseRoll,influence:influenced.delta,landed,destination,emotions:context,world};
  save();
  $('journalForm').hidden=false;
  $('journalEntry').value='';
  $('journalEntry').setCustomValidity('');
  const influenceText=influenced.delta?` Состояние изменило бросок: ${baseRoll} → ${roll}.`:'';
  const msg=(state.finished?'Финал игры. Вы достигли клетки 68 — Космического Сознания. Прочитайте описание и обязательно оставьте финальную запись.':destination!==landed?`${arrows.has(landed)?'Лестница':'Змея'}: ${landed} → ${destination}. Прочитайте новую клетку и обязательно оставьте запись.`:from?'Новая клетка. Прочитайте её и обязательно оставьте запись.':'Шестёрка открыла вход в игру. Вы начинаете с клетки 6. Прочитайте описание и обязательно оставьте запись.')+influenceText;
  renderBoard();showCell(destination,msg);
  $('position').textContent=state.finished?'Финал · 68':`Клетка ${destination}`;
  $('turnHint').textContent=state.finished?'Финальный ход ждёт обязательной записи.':'Ход ждёт обязательной записи.';
  updateRollButton();
  showMoveDialog({roll,landed,destination,enteredNow});
};
$('journalForm').onsubmit=async e=>{
  e.preventDefault();
  if(!state.pending)return;
  const input=$('journalEntry'),note=input.value.trim();
  if(!note){input.setCustomValidity('После каждого хода необходимо оставить запись.');input.reportValidity();return;}
  input.setCustomValidity('');
  const entry={...state.pending,note};
  state.history.push(entry);state.pending=null;mobileView='turn';
  outbox.push(entry);writeOutbox();
  resetEmotionScales();writeLocal();render();setMobileView('turn',true);
  await syncAll();
};
$('journalEntry').addEventListener('input',()=>$('journalEntry').setCustomValidity(''));
$('clearHistoryButton').onclick=async()=>{
  if(!state.history.length)return;
  if(!confirm('Удалить историю ходов и дневниковые записи? Текущая позиция на поле сохранится.'))return;
  state.history=[];outbox=[];writeOutbox();writeLocal();renderHistory();
  try{await api(apiUrl('api/progress/history'),{method:'DELETE'});markOnline();}
  catch(error){markOffline();}
};
$('closeHistoryButton').onclick=e=>{e.preventDefault();e.stopPropagation();document.querySelector('.history-section').open=false;};
$('restartButton').onclick=async()=>{
  if(!confirm('Начать новый путь? История ходов и записи Дневника этой игры будут удалены.'))return;
  state=blankState();visualPosition=null;queuedMoveAnimation=null;mobileView='turn';
  outbox=[];writeOutbox();resetEmotionScales();writeLocal();
  $('journalForm').hidden=true;$('rollButton').disabled=false;
  $('die').classList.remove('has-face');$('die').textContent='—';
  render();openCharacterChoice();
  try{await api(apiUrl('api/progress/history'),{method:'DELETE'});await save();}
  catch(error){markOffline();}
};
$('boardZoomIn').onclick=()=>setBoardZoom(boardZoom*1.35);
$('boardZoomOut').onclick=()=>setBoardZoom(boardZoom/1.35);
$('boardZoomFit').onclick=()=>{setBoardZoom(BOARD_ZOOM_MIN,false);requestAnimationFrame(()=>centreBoardOnPlayer());};
(()=>{
  const wrap=document.querySelector('.board-wrap');
  if(!wrap)return;
  const spread=touches=>Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);
  let pinch=null;
  wrap.addEventListener('touchstart',event=>{
    if(event.touches.length===2)pinch={distance:spread(event.touches),zoom:boardZoom};
  },{passive:true});
  wrap.addEventListener('touchmove',event=>{
    if(!pinch||event.touches.length!==2)return;
    event.preventDefault();
    setBoardZoom(pinch.zoom*spread(event.touches)/pinch.distance);
  },{passive:false});
  const release=()=>{pinch=null;};
  wrap.addEventListener('touchend',release);
  wrap.addEventListener('touchcancel',release);
})();
document.querySelectorAll('[data-practice]').forEach(button=>{
  button.onclick=async()=>{
    if(button.disabled)return;
    button.disabled=true;
    try{
      const result=await postJson(apiUrl('api/practice'),{kind:button.dataset.practice});
      karma=result.karma;practicesToday=result.practices||practicesToday;nextRollCost=result.next_roll_cost;
      renderKarma();markOnline();
    }catch(error){button.disabled=false;markOffline();}
  };
});
/* Вопрос меняется прямо под рукой, пока игрок двигает шкалы: так три мира
   видно до броска, а не только после. */
['joy','anger','confusion'].forEach(key=>$(key).addEventListener('input',()=>{
  if(!state.pending)showCell(state.entered?state.position:1,'',false);
}));
$('adoptButton').onclick=async()=>{
  try{adoptRemote(await postJson(apiUrl('api/progress/adopt'),{}));}
  catch(error){alert('Не удалось перенести игру: сервер ответил «'+((error.payload&&error.payload.error)||'нет связи')+'».');}
};
document.querySelectorAll('[data-mobile-view]').forEach(button=>button.onclick=()=>setMobileView(button.dataset.mobileView,true));
window.addEventListener('resize',()=>requestAnimationFrame(()=>{drawPaths();positionPlayer(visualPosition??(state.entered?state.position:1),false);updateCellMoreHint();}));
window.addEventListener('online',()=>{if(!serverAvailable)void syncAll();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!serverAvailable)void syncAll();});
options();applyBoardZoom();render();renderKarma();if(!state.character)openCharacterChoice();else scheduleCharacterIdle(true);
if(window.ZakrivaAccount){
  ZakrivaAccount.mount($('accountButton'));
  ZakrivaAccount.subscribe(next=>{
    const id=next?next.account_id:null;
    account=next;
    if(booted&&id!==knownAccountId){knownAccountId=id;void reloadForIdentity();return;}
    knownAccountId=id;
    updateServerStatus();
  });
  void ZakrivaAccount.refresh().then(()=>connectServer()).then(()=>{booted=true;});
}else{
  void connectServer().then(()=>{booted=true;});
}
