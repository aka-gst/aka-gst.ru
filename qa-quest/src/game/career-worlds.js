import { createCareerPreview } from './career-previews.js';
import { CAREER_PITCH } from './career-sims.js';
import { getCampusRank } from './campus-profile.js';
import { GUILD_SKILLS, guildLedgerPoints } from './quest-guild.js';

const freeze=v=>Object.freeze(v);
export const CAREER_REALMS=freeze([
 freeze({id:'automation',glyph:'⟲',title:'ЛИНИЯ 03',subtitle:'AUTO · ПРОИЗВОДСТВЕННАЯ ИГРА',mechanic:'PIPELINE',run:'▶ ЗАПУСТИТЬ ЛИНИЮ',gate:['print','if','for'],prompt:'Пятничный поток вырос вдвое. Собери линию, которая не выбрасывает работу.',controls:[['buffer','Поставить буфер','QUEUE'],['worker','Добавить worker','CONCURRENCY'],['drop','Сбрасывать лишнее','DROP']],wins:[['buffer','worker'],['buffer']],skill:'automation',art:'robot'}),
 freeze({id:'vehicle',glyph:'▰',title:'ГАРАЖ · СИНЯЯ МАШИНА',subtitle:'VEH · DETECTIVE GARAGE',mechanic:'INVESTIGATE',run:'СОБРАТЬ ДИАГНОЗ →',gate:['print','if'],prompt:'Своя машина принимает сервисную команду даже без владельца. Осмотри точки доверия и найди, где команда получила лишнее право.',controls:[['owner','Осмотреть ключ владельца','OWNER'],['gateway','Проверить шлюз команд','GATEWAY'],['radio','Проверить магнитолу','INFOTAINMENT']],wins:[['owner','gateway']],skill:'vehicle',art:'car'}),
 freeze({id:'security',glyph:'⬡',title:'СВОЙ СЕРВЕР · НОЧНОЙ ШТУРМ',subtitle:'SEC · BUILD / DEFEND / RED-TEAM',mechanic:'FORTIFY',run:'▶ ЗАПУСТИТЬ СВОЙ RED-TEAM',gate:['print','if','for'],prompt:'Синтетическая красная команда идёт на твой сервер. Построй защиту и проверь её, не закрыв дверь нормальным игрокам.',controls:[['roles','Поставить явные роли','AUTH'],['negative','Добавить негативные тесты','TESTS'],['shutdown','Выключить сервер','OFFLINE']],wins:[['roles','negative']],skill:'security',art:'shield'}),
 freeze({id:'web',glyph:'▦',title:'МИКРО-СЕРВИС · ДЕНЬ ПРОДАЖ',subtitle:'WEB · MINI TYCOON',mechanic:'TYCOON',run:'▶ ОТКРЫТЬ ДЕНЬ',gate:['print','if','for'],prompt:'У тебя только 2 жетона бюджета. Пользователи пришли быстрее, чем ожидалось: вложись перед открытием и проживи день.',controls:[['cache','Кэш чтения · 1 CR','CACHE'],['queue','Очередь заказов · 1 CR','QUEUE'],['banner','Анимация баннера · 1 CR','COSMETIC']],wins:[['cache','queue']],skill:'web',art:'web'}),
 freeze({id:'ai',glyph:'◇',title:'Q-BOT · ТРЕНИРОВОЧНАЯ КОМНАТА',subtitle:'AI · COMPANION TRAINING',mechanic:'TRAIN',run:'▶ ДАТЬ НЕИЗВЕСТНЫЙ СЛУЧАЙ',gate:['print','if','for','func'],prompt:'Q-Bot уверен в двух похожих случаях и хочет обобщить правило. Измени его опыт, а потом дай неизвестный пример.',controls:[['examples','Дать контрпример','DATA'],['abstain','Научить говорить «не знаю»','ABSTAIN'],['authority','Дать больше прав','AUTHORITY']],wins:[['examples','abstain']],skill:'ai',art:'ai'}),
 freeze({id:'systems',glyph:'⌬',title:'ГОРОДСКАЯ СХЕМА · КАСКАД',subtitle:'SYS · INCIDENT GRAPH',mechanic:'GRAPH',run:'▶ ПРОВЕРИТЬ КАСКАД',gate:['print','if','for','while'],prompt:'Один общий узел дрожит, а пять сервисов уже краснеют. Меняй связи, а не отдельные симптомы.',controls:[['isolate','Изолировать зависимость','BULKHEAD'],['fallback','Добавить запасной путь','FALLBACK'],['retry','Все пусть повторяют быстрее','RETRY STORM']],wins:[['isolate','fallback'],['isolate']],skill:'systems',art:'grid'}),
 freeze({id:'lowlevel',glyph:'01',title:'НЕИЗВЕСТНАЯ МАШИНА',subtitle:'LOW · SIGNAL / STATE PUZZLE',mechanic:'BITS',run:'ПРОВЕРИТЬ СИГНАЛ →',gate:['print','if','for','func'],prompt:'На панели четыре бита. Дверь ждёт состояние 0011. Никаких названий регистров — сначала просто пойми машину.',controls:[['bit0','Переключить младший бит','BIT 0'],['bit1','Переключить второй бит','BIT 1'],['reset','Сбросить состояние','RESET']],wins:[['bit0','bit1']],skill:'lowlevel',art:'low'}),
]);

// 17.0 · a branch level gives the next day of the profession: a heavier
// day, a new part, better pay. Day 1 is the realm itself.
export const REALM_DAYS=freeze({
 automation:freeze([freeze({day:2,title:'ЛИНИЯ 03 · РАСПРОДАЖА',prompt:'Распродажа: волны по 12 ящиков, втрое больше пятницы. Буфера и второго рабочего уже мало. Тебе дали новую деталь — робота-упаковщика.',controls:[['buffer','Поставить буфер','QUEUE'],['worker','Добавить worker','CONCURRENCY'],['robot','Робот-упаковщик','SCALE OUT'],['drop','Сбрасывать лишнее','DROP']],wins:[['buffer','worker','robot']],pick:3,pay:600})]),
});
export function realmDay(realm,day=1){
 const extra=(REALM_DAYS[realm?.id]??[]).find(d=>d.day===day);
 return extra?{...realm,...extra}:{...realm,day:1,pick:2,pay:REALM_DAY_PAY};
}
export function realmDayCount(id){return 1+(REALM_DAYS[id]?.length??0);}
// Highest day held: 0 never, 1 the realm, N when realm:<id>:dN is in the ledger.
export function heldRealmDay(profile={},id){
 const g=profile.labs?.guild??{};if(!(g.realmWins??[]).includes(id))return 0;
 let held=1;for(const d of REALM_DAYS[id]??[])if(g.skillLedger?.[`realm:${id}:d${d.day}`])held=Math.max(held,d.day);
 return held;
}
export function nextRealmDay(profile,id){return Math.min(heldRealmDay(profile,id)+1,realmDayCount(id));}

export function foundationStatus(learning={},realm){
 const keys={print:'printUnlocked',if:'ifUnlocked',for:'forUnlocked',while:'whileUnlocked',func:'funcUnlocked'};
 const missing=(realm.gate??[]).filter(k=>!learning[keys[k]]);
 return {ok:missing.length===0,missing};
}

export function createCareerSession(realmId,day=1){
 const realm=CAREER_REALMS.find(r=>r.id===realmId);
 return {realmId,day:realm?realmDay(realm,day).day:1,selected:[],events:[],budget:2,bits:[0,0,0,0],confidence:92,turns:0};
}

export function stepCareerSession(session,action){
 const s={...session,selected:[...(session.selected??[])],events:[...(session.events??[])],bits:[...(session.bits??[0,0,0,0])]};
 const realm=CAREER_REALMS.find(r=>r.id===session.realmId); if(!realm)return s;
 if(realm.id==='lowlevel'){
   if(action==='reset'){s.bits=[0,0,0,0];s.selected=[];s.events.push('Состояние очищено.');return s;}
   if(action==='bit0'){s.bits[3]=s.bits[3]?0:1;}
   if(action==='bit1'){s.bits[2]=s.bits[2]?0:1;}
   s.selected=['bit0','bit1'].filter((_,i)=>s.bits[i?2:3]);
   s.events.push(`Панель: ${s.bits.join('')}`); return s;
 }
 if(realm.id==='web'){
   if(s.selected.includes(action)){s.selected=s.selected.filter(x=>x!==action);s.budget=Math.min(2,s.budget+1);return s;}
   if(s.budget<=0){s.events.push('Бюджет кончился. Сними одно вложение.');return s;}
   s.selected.push(action);s.budget-=1;s.events.push(`Вложение: ${action}. Осталось ${s.budget} CR.`);return s;
 }
 if(realm.id==='ai'){
   if(!s.selected.includes(action))s.selected=[...s.selected,action].slice(-2);
   if(action==='examples')s.confidence=Math.max(55,s.confidence-18);
   if(action==='abstain')s.confidence=Math.max(45,s.confidence-12);
   if(action==='authority')s.confidence=Math.min(99,s.confidence+6);
   s.events.push(action==='authority'?'Права выросли. Знаний больше не стало.':'Опыт Q-Bot изменился.'); return s;
 }
 if(s.selected.includes(action))s.selected=s.selected.filter(x=>x!==action);else s.selected=[...s.selected,action].slice(-realmDay(realm,s.day).pick);
 const lines={vehicle:{owner:'Ключ владельца валиден.',gateway:'Шлюз принимает сервисную команду без проверки владельца.',radio:'Музыка работает. Причина не здесь.'},security:{roles:'Появилась граница ролей.',negative:'Добавлены проверки запретного поведения.',shutdown:'Сервис выключен вместе с угрозой и нормальными игроками.'},automation:{buffer:'Поток получил место ждать.',worker:'Появился второй исполнитель.',drop:'Лишняя работа исчезает — вместе с заказами.',robot:'Робот встал третьей станцией.'},systems:{isolate:'Общий узел перестал тянуть весь граф.',fallback:'Критичный поток получил запасной путь.',retry:'Повторы умножили давление на больной узел.'}};
 s.events.push(lines[realm.id]?.[action]??`Выбрано: ${action}`);return s;
}

export function evaluateCareerRealm(realmId,selected=[],session=null){
 const base=CAREER_REALMS.find(r=>r.id===realmId); if(!base)return {ok:false,reason:'unknown-realm'};
 const realm=realmDay(base,session?.day??1);
 const set=[...new Set(session?.selected??selected)];
 if(realmId==='lowlevel' && session?.bits){const ok=session.bits.join('')==='0011';return {ok,score:ok?100:20,skill:realm.skill,tech:ok?['BIT 0','BIT 1']:[]};}
 const forbidden=['drop','shutdown','banner','authority','retry'];
 const win=realm.wins.some(combo=>combo.every(x=>set.includes(x)) && !forbidden.some(x=>set.includes(x)));
 return {ok:win,score:win?Math.max(55,100-(set.length-realm.wins[0].length)*8):25,skill:realm.skill,tech:realm.controls.filter(c=>set.includes(c[0])).map(c=>c[2])};
}

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
// Branch names for ordinary people: who you become, what that person does,
// and what levelling up gives -- in the game and in real life.
export const SKILL_ROLES=freeze({
 automation:freeze({name:'Автоматизатор',does:'делает так, чтобы рутина работала сама: линии, роботы, скрипты',gives:'в игре — линия берёт больше работы без тебя; в жизни — скрипты, которые экономят часы'}),
 vehicle:freeze({name:'Автохакер',does:'разбирается, как машина слушается команд, и находит дыры в своей учебной машине',gives:'в игре — новые узлы машины: брелок, приложение, сервисный порт; в жизни — диагностика и безопасность авто'}),
 security:freeze({name:'Защитник',does:'строит защиту своего сервера и сам проверяет её на прочность',gives:'в игре — ночные штурмы сложнее, награда выше; в жизни — кибербезопасность'}),
 web:freeze({name:'Создатель сайтов',does:'делает сайты и магазины, которые не падают, когда приходит толпа',gives:'в игре — дни продаж больше и доходнее; в жизни — веб-разработка'}),
 ai:freeze({name:'Тренер ИИ',does:'учит робота-помощника отвечать честно и не ошибаться уверенно',gives:'в игре — Q-Bot умнеет и берёт задачи сам; в жизни — работа с нейросетями'}),
 systems:freeze({name:'Спасатель систем',does:'не даёт одной поломке уронить весь город сервисов',gives:'в игре — город больше, аварии хитрее; в жизни — надёжность больших систем'}),
 lowlevel:freeze({name:'Знаток железа',does:'понимает машину на уровне битов и сигналов, без инструкции',gives:'в игре — двери и устройства сложнее; в жизни — электроника и микроконтроллеры'}),
});

// Сергей, 29.09: professions are skills -- you level yourself up with
// knowledge and get paid for it. One pure summary of the player: rank and
// XP, money, learned moves, and a level per branch (2 points per level).
// The first held day of each profession pays like 15 crates carried by hand.
export const REALM_DAY_PAY=300;
const MOVES=[['print','PRINT','сказать'],['if','IF','выбрать'],['for','FOR','повторить'],['while','WHILE','ждать, пока'],['func','DEF','свой навык']];
export function characterSheet(profile={},learning={},wallet=0){
 const xp=Math.max(0,Number(profile.xp)||0),rank=getCampusRank(xp),points=guildLedgerPoints(profile),wins=new Set(profile.labs?.guild?.realmWins??[]);
 return {
  rank:rank.name,next:rank.next?.name??null,toNext:rank.next?Math.max(0,rank.next.xp-xp):0,progress:rank.progress,xp,money:Math.max(0,Number(wallet)||0),
  moves:MOVES.map(([key,label,human])=>({key,label,human,on:Boolean(learning[`${key}Unlocked`])})),
  skills:GUILD_SKILLS.map(s=>({id:s.id,short:s.short,name:SKILL_ROLES[s.id]?.name??s.name,does:SKILL_ROLES[s.id]?.does??'',gives:SKILL_ROLES[s.id]?.gives??'',points:points[s.id]??0,level:Math.min(10,Math.floor((points[s.id]??0)/2)),won:wins.has(s.id)})),
 };
}

// Kenney sprites the live scenes use (career-previews.js draws them).
export const CAR_SPRITE='assets/kenney16/garage/car_blue_3.png';
export const ROBOT_SPRITE='assets/kenney16/robot/robot_yellowBody.png';
const KEY_NAMES={print:'PRINT',if:'IF',for:'FOR',while:'WHILE',func:'DEF'};
const SUCCESS_COPY={automation:'✓ Ни один заказ не исчез. Линия выдержала поток.',vehicle:'✓ Причина доказана двумя точками: команда должна пройти границу владельца до gateway.',security:'✓ Свой red-team не прошёл, а нормальный игрок остался внутри.',web:'✓ День прожит: пользователи дождались, заказы не потерялись, CR пришли.',ai:'✓ На новом случае Q-Bot умеет сомневаться вместо уверенной выдумки.',systems:'✓ Отказ остался локальным вместо городского каскада.',lowlevel:'✓ Машина увидела 0011 и открыла дверь.'};
const simCfg=(session)=>({selected:[...(session?.selected??[])],bits:[...(session?.bits??[0,0,0,0])],day:session?.day??1});

// 16.8: a class-select screen. Left, the seven professions; right, the
// picked one playing its own game (career-previews.js) with a short pitch.
// Inside a profession the same live scene answers every choice, and
// "прожить решение" plays the day before the verdict.
export function createCareerWorlds(root,{getProfile=()=>({}),getLearning=()=>({}),getWallet=()=>0,onProfile=()=>{},onSound=()=>{},onClose=()=>{}}={}){
 if(!root)return{open(){},close(){}};
 let active=null,session=null,picked=CAREER_REALMS[0].id,running=false;
 const grid=root.querySelector('#careerRealmGrid'),stage=root.querySelector('#careerStage'),list=root.querySelector('#careerRealmList');
 const reduceMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
 const sprites={car:CAR_SPRITE,robot:ROBOT_SPRITE};
 const showcase=createCareerPreview(root.querySelector('#careerPreview'),{reduceMotion,sprites});
 const live=createCareerPreview(root.querySelector('#careerLive'),{reduceMotion,sprites});
 const $=(sel)=>root.querySelector(sel);
 function wins(){return new Set(getProfile().labs?.guild?.realmWins??[]);}
 function gateOf(realm){return foundationStatus(getLearning(),realm);}
 function dayStatus(id,open,won){
  if(!won)return open?'ОТКРЫТО':'ЗАКРЫТО · ДЕМО';
  const held=heldRealmDay(getProfile(),id),max=realmDayCount(id);
  return held<max?`✓ ДЕНЬ ${held} · ОТКРЫТ ДЕНЬ ${held+1}`:max>1?`✓ ВСЕ ${max} ДНЯ`:'✓ ПРОЙДЕНО';
 }
 function renderSheet(){
  const box=root.querySelector('.career-foundation');if(!box)return;
  const c=characterSheet(getProfile(),getLearning(),getWallet());
  box.classList.add('career-sheet');
  box.innerHTML=`<div class="career-sheet__me"><small>ТЫ · РАНГ</small><strong>${esc(c.rank)}</strong><i><b style="width:${Math.round(c.progress*100)}%"></b></i><em>${c.next?`${c.xp} XP · до «${esc(c.next)}» ${c.toNext}`:`${c.xp} XP · высший ранг`}</em></div>`
   +`<div class="career-sheet__money"><small>ЗАРАБОТАНО</small><strong>${c.money.toLocaleString('ru-RU')} ₽</strong></div>`
   +`<div class="career-sheet__moves"><small>ЧТО УМЕЕШЬ · команды Python</small><span>${c.moves.map(m=>`<b data-on="${m.on}" title="${m.on?'уже знаешь':'откроется в основной игре'}">${esc(m.human)}<i>${m.label.toLowerCase()}</i></b>`).join('')}</span></div>`
   +`<div class="career-sheet__skills"><small>КЕМ ТЫ СТАНОВИШЬСЯ · уровень растёт от выигранных дней</small><span>${c.skills.map(s=>`<b data-skill="${s.id}" data-level="${s.level}" data-picked="${s.id===picked}" title="${esc(s.does)}">${esc(s.name)}<i>ур. ${s.level}</i></b>`).join('')}</span><p class="career-sheet__about">${(()=>{const k=c.skills.find(x=>x.id===picked);return k?`<strong>${esc(k.name)}</strong> — ${esc(k.does)}. <em>Прокачка: ${esc(k.gives)}.</em>`:'';})()}</p></div>`;
 }
 function renderGrid(){
  grid.innerHTML='';const done=wins();
  for(const realm of CAREER_REALMS){
   const gate=gateOf(realm),b=document.createElement('button');
   b.type='button';b.dataset.realm=realm.id;b.dataset.locked=String(!gate.ok);b.setAttribute('role','option');b.setAttribute('aria-selected',String(realm.id===picked));
   b.innerHTML=`<b>${realm.glyph}</b><span><small>${esc(SKILL_ROLES[realm.id]?.name??realm.subtitle)}</small><strong>${esc(realm.title)}</strong><em>${dayStatus(realm.id,gate.ok,done.has(realm.id))}</em></span>`;
   b.addEventListener('click',()=>{if(picked===realm.id&&!list.hidden)enter(realm.id);else pick(realm.id,{sound:true});});
   grid.append(b);
  }
 }
 function pick(id,{sound=false,focus=false}={}){
  picked=id;const realm=CAREER_REALMS.find(r=>r.id===id),gate=gateOf(realm),pitch=CAREER_PITCH[id];
  for(const b of grid.querySelectorAll('[data-realm]')){b.setAttribute('aria-selected',String(b.dataset.realm===id));if(focus&&b.dataset.realm===id)b.focus({preventScroll:true});}
  root.dataset.picked=id;
  $('#careerPickSub').textContent=`${SKILL_ROLES[id]?.name??''} · ${realm.subtitle}`;renderSheet();$('#careerPickTitle').textContent=realm.title;$('#careerPickFantasy').textContent=pitch.fantasy;
  $('#careerPickVerbs').innerHTML=pitch.verbs.map(v=>`<li>${esc(v)}</li>`).join('');
  $('#careerPickLife').textContent=pitch.life;$('#careerPickDeep').textContent=pitch.deep;
  const enterBtn=$('#careerEnter');enterBtn.dataset.locked=String(!gate.ok);
  const day=nextRealmDay(getProfile(),id);
  enterBtn.textContent=gate.ok?`ВОЙТИ: ${realm.title}${realmDayCount(id)>1?` · ДЕНЬ ${day}`:''} →`:`ЗАКРЫТО · НУЖНО: ${gate.missing.map(k=>KEY_NAMES[k]??k.toUpperCase()).join(' + ')}`;
  showcase.demo(id);
  if(sound)onSound('ui-click');
 }
 function enter(id){const realm=CAREER_REALMS.find(r=>r.id===id);if(!gateOf(realm).ok){onSound('blocked');return;}openRealm(id);}
 function renderControls(){for(const b of root.querySelectorAll('[data-career-control]'))b.dataset.on=String(session?.selected.includes(b.dataset.careerControl));}
 function act(id){if(!active||!session||running)return;session=stepCareerSession(session,id);renderControls();const out=$('#careerResult');const line=session.events.at(-1)??'Мир изменился.';out.textContent=line;out.dataset.ok='false';live.setConfig(simCfg(session),'');onSound('ui-click');}
 function openRealm(id){
  const base=CAREER_REALMS.find(r=>r.id===id),day=nextRealmDay(getProfile(),id);
  active=realmDay(base,day);session=createCareerSession(active.id,day);running=false;showcase.stop();root.dataset.day=String(day);
  stage.hidden=false;list.hidden=true;root.dataset.realm=active.id;root.dataset.mechanic=active.mechanic;
  $('#careerRealmTitle').textContent=active.title;$('#careerRealmSubtitle').textContent=`${active.subtitle} · ${active.mechanic}${realmDayCount(active.id)>1?` · ДЕНЬ ${day} ИЗ ${realmDayCount(active.id)}`:''}`;$('#careerRealmPrompt').textContent=active.prompt;
  const visual=$('#careerVisual');visual.dataset.mechanic=active.mechanic;delete visual.dataset.result;
  const controls=$('#careerControls');controls.innerHTML='';
  for(const [cid,human,tech] of active.controls){const b=document.createElement('button');b.type='button';b.dataset.careerControl=cid;b.innerHTML=`<strong>${esc(human)}</strong><small>${esc(tech)}</small>`;b.addEventListener('click',()=>act(cid));controls.append(b);}
  $('#careerRun').textContent=active.run;$('#careerRun').removeAttribute('aria-disabled');
  $('#careerResult').textContent=day>1?`Ветка «${SKILL_ROLES[active.id]?.name??active.title}» ур. ${day-1} открыла день ${day}: поток сильнее, новая деталь, плата ${active.pay} ₽. Можно поставить ${active.pick} решения.`:active.id==='web'?'Выбери максимум два вложения: бюджет настоящий.':active.id==='vehicle'?'Сначала осмотри машину. Не угадывай fix по названию.':'Меняй схему — сцена сразу покажет, что будет.';
  $('#careerResult').dataset.ok='false';
  live.live(active.id,simCfg(session),'');renderControls();
  $('#careerRun').focus({preventScroll:true});
 }
 $('#careerRun').addEventListener('click',()=>{
  if(!active||!session||running)return;running=true;session={...session,turns:session.turns+1};
  const realm=active,snap=session,out=$('#careerResult');$('#careerRun').setAttribute('aria-disabled','true');out.dataset.ok='false';out.textContent='День идёт — смотри на сцену.';onSound('ui-click');
  live.run(()=>{
   running=false;$('#careerRun').removeAttribute('aria-disabled');if(active!==realm)return;
   const result=evaluateCareerRealm(realm.id,snap.selected,snap);
   out.textContent=result.ok?`${SUCCESS_COPY[realm.id]} ${result.tech.length?`Потом это назовут: ${result.tech.join(' + ')}.`:''}`:'Мир показал контрпример. Поменяй систему и повтори — прогресс не отнимается.';
   out.dataset.ok=String(result.ok);$('#careerVisual').dataset.result=result.ok?'pass':'counterexample';onSound(result.ok?'reward':'blocked');
   if(result.ok){
    const day=snap.day??1,firstWin=heldRealmDay(getProfile(),realm.id)<day,pay=realm.pay??REALM_DAY_PAY;
    onProfile({type:'guild-realm',id:realm.id,day,score:result.score,skill:result.skill,skillGain:2,xp:170,pay:firstWin?pay:0});
    if(firstWin){const lvl=characterSheet(getProfile()).skills.find(k=>k.id===realm.id)?.level;out.textContent+=` +${pay} ₽ за первый выдержанный ${day>1?`день ${day}`:'день'}, ветка «${SKILL_ROLES[realm.id]?.name??realm.title}» выросла${lvl?` до ур. ${lvl}`:''}.${day<realmDayCount(realm.id)?` Открыт день ${day+1}.`:''}`;}
    renderSheet();
   }
  });
 });
 function back(){live.stop();running=false;stage.hidden=true;list.hidden=false;active=null;session=null;renderSheet();renderGrid();pick(picked,{focus:true});}
 function close(){showcase.stop();live.stop();running=false;root.hidden=true;onClose();}
 $('#careerBack').addEventListener('click',back);
 $('#careerClose').addEventListener('click',close);
 $('#careerEnter').addEventListener('click',()=>enter(picked));
 root.addEventListener('keydown',(e)=>{
  if(root.hidden)return;
  if(e.key==='Escape'){e.preventDefault();if(!stage.hidden)back();else close();return;}
  if(list.hidden)return;
  const ids=CAREER_REALMS.map(r=>r.id),i=ids.indexOf(picked);
  if(e.key==='ArrowDown'||e.key==='ArrowRight'){e.preventDefault();pick(ids[(i+1)%ids.length],{sound:true,focus:true});}
  else if(e.key==='ArrowUp'||e.key==='ArrowLeft'){e.preventDefault();pick(ids[(i+ids.length-1)%ids.length],{sound:true,focus:true});}
  else if(e.key==='Enter'&&e.target?.closest?.('#careerRealmGrid')){e.preventDefault();enter(picked);}
 });
 return {
  open(){root.hidden=false;stage.hidden=true;list.hidden=false;renderSheet();renderGrid();const firstOpen=CAREER_REALMS.find(r=>gateOf(r).ok);pick(firstOpen?.id??picked,{focus:true});},
  close(){showcase.stop();live.stop();root.hidden=true;},
  refresh(){renderGrid();if(!list.hidden)pick(picked);},
 };
}
