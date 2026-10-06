import { createCareerPreview } from './career-previews.js';
import { CAREER_PITCH } from './career-sims.js';
import { getCampusRank } from './campus-profile.js';
import { GUILD_SKILLS, guildLedgerPoints } from './quest-guild.js';
import { GARAGE_DAYS, garageDay, simGarage } from './garage-night.js';
import { createGarageStage } from './garage-stage.js';
import { worldGate } from './progress-map.js';
import { levelOf, masteryEvent } from './mastery.js';
import { PYTHONIO_ORDERS, pythonioDone } from './pythonio-bridge.js';
import { MEGACORP, HACKER_QUESTS, ENGINEER_QUESTS, PROFESSIONS, FULL_MARK, TASTER_MARK, hackerStatus, engineerStatus, engineerOpen, questById, hackerQuestForDay } from './career-story.js';
import { TASTERS, tasterById, tasterStatus, tasterOpen, tasterProof, tasterFinished, nextDoor, TASTER_GATE, WAY_WORDS } from './career-tasters.js';
import { createTasterStage } from './taster-stage.js';
import { createTasterCanvas } from './taster-scene.js';

// 19.0 · professions are the revenge on «ТИСКИ» (canon §18). Two are full:
// ХАКЕР (the garage, three nights, career-story.js HACKER_QUESTS) and
// ИНЖЕНЕР (Pythonio orders, ENGINEER_QUESTS). The other five are ПРОБЫ
// (career-tasters.js): three short levels each — button, settings, code —
// that open after Витя's first night. Their old tiny sims and controls stay
// in the data (tested, used by the guild raid), the screen plays the taster.
const freeze=v=>Object.freeze(v);
const T=(id)=>tasterById(id);
export const CAREER_REALMS=freeze([
 freeze({id:'vehicle',glyph:'▰',role:'Хакер',title:'ГАРАЖ · МЕСТЬ «ТИСКАМ»',subtitle:'Хакер · три ночи, три человека',mechanic:'GATEWAY CODE',code:true,run:'▶ ПРОВЕРИТЬ НОЧЬЮ',gate:['print','if'],prompt:HACKER_QUESTS[0].story,controls:[],wins:[],skill:'vehicle',art:'car'}),
 freeze({id:'automation',glyph:'⟲',role:'Инженер',title:'МАСТЕРСКАЯ · ЗАКАЗЫ ЛЮДЕЙ',subtitle:'Инженер · свой цех вместо «ТИСКИ-Маркета»',mechanic:'PIPELINE',pythonio:true,after:HACKER_QUESTS[0].id,run:'▶ ЗАПУСТИТЬ ЛИНИЮ',gate:['print','if'],prompt:ENGINEER_QUESTS[0].story,controls:[['buffer','Поставить буфер','очередь'],['worker','Добавить рабочего','второй рабочий'],['drop','Сбрасывать лишнее','выброс']],wins:[['buffer','worker'],['buffer']],skill:'automation',art:'robot'}),
 freeze({id:'security',glyph:'⬡',role:T('security').name,title:T('security').title,subtitle:`${T('security').name} · проба: три уровня`,mechanic:'FORTIFY',taster:true,after:HACKER_QUESTS[0].id,run:'▶ ПРОВЕРИТЬ ЗАЩИТУ',gate:['print','if'],prompt:T('security').story,controls:[['roles','Поставить явные роли','роли'],['negative','Добавить проверки запретного','проверки'],['shutdown','Выключить сервер','выключить']],wins:[['roles','negative']],skill:'security',art:'shield'}),
 freeze({id:'web',glyph:'▦',role:T('web').name,title:T('web').title,subtitle:`${T('web').name} · проба: три уровня`,mechanic:'TYCOON',taster:true,after:HACKER_QUESTS[0].id,run:'▶ ОТКРЫТЬ ДЕНЬ',gate:['print','if'],prompt:T('web').story,controls:[['cache','Память для страниц · 1 жетон','память'],['queue','Очередь заказов · 1 жетон','очередь'],['banner','Анимация баннера · 1 жетон','украшение']],wins:[['cache','queue']],skill:'web',art:'web'}),
 freeze({id:'ai',glyph:'◇',role:T('ai').name,title:T('ai').title,subtitle:`${T('ai').name} · проба: три уровня`,mechanic:'TRAIN',taster:true,after:HACKER_QUESTS[0].id,run:'▶ ДАТЬ НОВЫЙ СЛУЧАЙ',gate:['print','if'],prompt:T('ai').story,controls:[['examples','Дать пример, где он не прав','пример'],['abstain','Научить говорить «не знаю»','«не знаю»'],['authority','Дать больше прав','права']],wins:[['examples','abstain']],skill:'ai',art:'ai'}),
 freeze({id:'systems',glyph:'⌬',role:T('systems').name,title:T('systems').title,subtitle:`${T('systems').name} · проба: три уровня`,mechanic:'GRAPH',taster:true,after:HACKER_QUESTS[0].id,run:'▶ ПРОВЕРИТЬ КАСКАД',gate:['print','if'],prompt:T('systems').story,controls:[['isolate','Отгородить общий узел','перегородка'],['fallback','Добавить запасной путь','запасной путь'],['retry','Все пусть повторяют быстрее','шторм повторов']],wins:[['isolate','fallback'],['isolate']],skill:'systems',art:'grid'}),
 freeze({id:'lowlevel',glyph:'01',role:T('lowlevel').name,title:T('lowlevel').title,subtitle:`${T('lowlevel').name} · проба: три уровня`,mechanic:'BITS',taster:true,after:HACKER_QUESTS[0].id,run:'ПРОВЕРИТЬ СИГНАЛ →',gate:['print','if'],prompt:T('lowlevel').story,controls:[['bit0','Переключить правый','правый'],['bit1','Переключить второй справа','второй'],['reset','Сбросить всё','сброс']],wins:[['bit0','bit1']],skill:'lowlevel',art:'low'}),
]);

// 17.0 · a branch level gives the next day of the profession: a heavier
// day, a new part, better pay. Day 1 is the realm itself.
export const REALM_DAYS=freeze({
 // 17.1 → 19.0 · the garage nights 2 and 3: Дина's radio, Санин master key.
 vehicle:freeze(GARAGE_DAYS.filter(d=>d.day>1).map(d=>freeze({day:d.day,title:`ГАРАЖ · ${d.title}`,prompt:d.brief,controls:[],pick:0,pay:d.pay}))),
 automation:freeze([freeze({day:2,title:'ЛИНИЯ · РАСПРОДАЖА',prompt:'Распродажа: волны по 12 ящиков, втрое больше пятницы. Буфера и второго рабочего уже мало. Тебе дали новую деталь — робота-упаковщика.',controls:[['buffer','Поставить буфер','очередь'],['worker','Добавить рабочего','второй рабочий'],['robot','Робот-упаковщик','третья станция'],['drop','Сбрасывать лишнее','выброс']],wins:[['buffer','worker','robot']],pick:3,pay:600})]),
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
// 19.0 · can the player go in? Learning gate, the story gate (ИНЖЕНЕР after
// Витя's night) and «скоро». reason: 'soon' | 'story' | 'learning' | null.
export function realmAvailability(realm,profile={},learning={}){
 if(!realm)return {ok:false,reason:'unknown',text:''};
 const f=foundationStatus(learning,realm);
 if(!f.ok)return {ok:false,reason:'learning',text:worldGate(f.missing)};
 if(realm.taster&&!tasterOpen(heldRealmDay(profile,'vehicle')))return {ok:false,reason:'story',text:TASTER_GATE};
 if(realm.after&&!engineerOpen(heldRealmDay(profile,'vehicle')))return {ok:false,reason:'story',text:`Сначала помоги Вите в гараже — он подскажет, к кому идти.`};
 return {ok:true,reason:null,text:''};
}
// The quests of a profession with done / active / locked.
export function professionQuests(id,profile={}){
 const held=heldRealmDay(profile,'vehicle');
 if(id==='vehicle')return hackerStatus(held);
 if(id==='automation')return engineerStatus(held,pythonioDone(profile),(i)=>PYTHONIO_ORDERS[i]?.pay??0);
 const t=tasterById(id);
 if(t){const open=tasterOpen(held);return tasterStatus(profile,id).map((l)=>({id:`${id}:l${l.index+1}`,title:`${l.index+1} · ${l.title}`,story:`${WAY_WORDS[l.way]}: ${l.goal}`,status:open?l.status:'locked'}));}
 return [];
}

export function createCareerSession(realmId,day=1){
 const realm=CAREER_REALMS.find(r=>r.id===realmId);
 return {realmId,day:realm?realmDay(realm,day).day:1,selected:[],events:[],budget:2,bits:[0,0,0,0],confidence:92,turns:0};
}

export function stepCareerSession(session,action){
 const s={...session,selected:[...(session.selected??[])],events:[...(session.events??[])],bits:[...(session.bits??[0,0,0,0])]};
 const realm=CAREER_REALMS.find(r=>r.id===session.realmId); if(!realm)return s;
 if(realm.id==='lowlevel'){
   if(action==='reset'){s.bits=[0,0,0,0];s.selected=[];s.events.push('Всё сброшено.');return s;}
   if(action==='bit0'){s.bits[3]=s.bits[3]?0:1;}
   if(action==='bit1'){s.bits[2]=s.bits[2]?0:1;}
   s.selected=['bit0','bit1'].filter((_,i)=>s.bits[i?2:3]);
   s.events.push(`Панель: ${s.bits.join('')}`); return s;
 }
 if(realm.id==='web'){
   if(s.selected.includes(action)){s.selected=s.selected.filter(x=>x!==action);s.budget=Math.min(2,s.budget+1);return s;}
   if(s.budget<=0){s.events.push('Бюджет кончился. Сними одно вложение.');return s;}
   s.selected.push(action);s.budget-=1;s.events.push(`Вложение сделано. Осталось жетонов: ${s.budget}.`);return s;
 }
 if(realm.id==='ai'){
   if(!s.selected.includes(action))s.selected=[...s.selected,action].slice(-2);
   if(action==='examples')s.confidence=Math.max(55,s.confidence-18);
   if(action==='abstain')s.confidence=Math.max(45,s.confidence-12);
   if(action==='authority')s.confidence=Math.min(99,s.confidence+6);
   s.events.push(action==='authority'?'Права выросли. Знаний больше не стало.':'Опыт Q-Bot изменился.'); return s;
 }
 if(s.selected.includes(action))s.selected=s.selected.filter(x=>x!==action);else s.selected=[...s.selected,action].slice(-realmDay(realm,s.day).pick);
 const lines={vehicle:{owner:'Ключ хозяина настоящий.',gateway:'Сторож пускает сервисную команду без ключа.',radio:'Музыка работает. Причина не здесь.'},security:{roles:'Появилась граница ролей.',negative:'Добавлены проверки запретного поведения.',shutdown:'Сервер выключен вместе с угрозой и своими людьми.'},automation:{buffer:'Поток получил место ждать.',worker:'Появился второй рабочий.',drop:'Лишняя работа исчезает — вместе с заказами.',robot:'Робот встал третьей станцией.'},systems:{isolate:'Общий узел перестал тянуть всех за собой.',fallback:'Важный поток получил запасной путь.',retry:'Повторы умножили давление на больной узел.'}};
 s.events.push(lines[realm.id]?.[action]??'Выбрано.');return s;
}

export function evaluateCareerRealm(realmId,selected=[],session=null){
 const base=CAREER_REALMS.find(r=>r.id===realmId); if(!base)return {ok:false,reason:'unknown-realm'};
 const realm=realmDay(base,session?.day??1);
 const set=[...new Set(session?.selected??selected)];
 if(realm.code){
   // 17.1 · the garage is judged by running the player's rule through the night.
   const day=session?.day??1,sim=simGarage({rule:session?.rule??garageDay(day).starter,day,picklock:session?.picklock??null});
   return {ok:sim.ok,score:sim.ok?100:Math.max(10,40-sim.dayLeaks*5-sim.dayDenied*5),skill:realm.skill,tech:sim.ok?(day>1?['if','elif','else']:['if','else']):[]};
 }
 if(realmId==='lowlevel' && session?.bits){const ok=session.bits.join('')==='0011';return {ok,score:ok?100:20,skill:realm.skill,tech:ok?['биты']:[]};}
 const forbidden=['drop','shutdown','banner','authority','retry'];
 const win=realm.wins.some(combo=>combo.every(x=>set.includes(x)) && !forbidden.some(x=>set.includes(x)));
 return {ok:win,score:win?Math.max(55,100-(set.length-realm.wins[0].length)*8):25,skill:realm.skill,tech:realm.controls.filter(c=>set.includes(c[0])).map(c=>c[2])};
}

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
// Branch names for ordinary people: who you become, what that person does,
// and what levelling up gives -- in the game and in real life.
export const SKILL_ROLES=freeze({
 automation:freeze({name:'Инженер',does:'собирает людям свой цех: линии, машины, правила — чтобы рутина работала сама, без платформы «ТИСКОВ»',gives:'в игре — заказы Лиды, Марка, Аси и дальше вся мастерская Питонио; в жизни — скрипты, которые экономят часы'}),
 vehicle:freeze({name:'Хакер',does:'видит, как машина слушается команд, вскрывает приёмы «ТИСКОВ» и закрывает им дорогу',gives:'в игре — три ночи: Витя, Дина, Саня; в жизни — диагностика и безопасность машин'}),
 security:freeze({name:'Сетевик',does:'держит свой сервер для своих и не пускает туда ботов',gives:'в игре — проба: сервер Тимура; в жизни — сети и безопасность серверов'}),
 web:freeze({name:'Создатель сайтов',does:'делает понятные быстрые странички, которые люди находят сами',gives:'в игре — проба: пироги Нины Петровны; в жизни — веб-разработка'}),
 ai:freeze({name:'Тренер ИИ',does:'учит робота-помощника отличать правду от подделок и не ошибаться уверенно',gives:'в игре — проба: отзывы Зарины; в жизни — работа с нейросетями'}),
 systems:freeze({name:'Спасатель города',does:'не даёт одной поломке погасить весь район',gives:'в игре — проба: свет на Заречной; в жизни — надёжность больших систем'}),
 lowlevel:freeze({name:'Знаток железа',does:'понимает машину до проводка и сигнала, без инструкции',gives:'в игре — проба: радио деда Миши; в жизни — электроника и микроконтроллеры'}),
});

// Сергей, 29.09: professions are skills -- you level yourself up with
// knowledge and get paid for it. One pure summary of the player: rank and
// XP, money, learned moves, and a level per branch (2 points per level).
// The first held day of each profession pays like 15 crates carried by hand.
export const REALM_DAY_PAY=300;
// 19.0 · the campus rank shown here must not read like a profession
// («ИНЖЕНЕР» is a profession now) and must be Russian. Display names only;
// campus-profile.js RANKS stay the stored ladder.
export const RANK_PLAIN=freeze({'ИНЖЕНЕР':'МАСТЕР ЦЕХА','АВТОМАТИЗАТОР':'НАЛАДЧИК','AI-МЕХАНИК':'МЕХАНИК УМНЫХ МАШИН','BOT-АРХИТЕКТОР':'СТРОИТЕЛЬ РОБОТОВ','AI FACTORY MASTER':'ХОЗЯИН УМНОГО ЦЕХА','INTEGRATION ARCHITECT':'СВЯЗНОЙ СИСТЕМ','SYSTEM OPERATOR':'ДИСПЕТЧЕР СИСТЕМ','FACTORY ARCHITECT':'ЗОДЧИЙ ЗАВОДОВ','AUTONOMOUS SYSTEMS':'ВЛАСТЕЛИН АВТОМАТОВ','WORLD ARCHITECT':'ЗОДЧИЙ МИРА'});
export function plainRank(name){return RANK_PLAIN[name]??name;}
const MOVES=[['print','PRINT','сказать'],['if','IF','выбрать'],['for','FOR','повторить'],['while','WHILE','ждать, пока'],['func','DEF','свой навык']];
export function characterSheet(profile={},learning={},wallet=0){
 const xp=Math.max(0,Number(profile.xp)||0),rank=getCampusRank(xp),points=guildLedgerPoints(profile),wins=new Set(profile.labs?.guild?.realmWins??[]);
 return {
  rank:plainRank(rank.name),next:rank.next?plainRank(rank.next.name):null,toNext:rank.next?Math.max(0,rank.next.xp-xp):0,progress:rank.progress,xp,money:Math.max(0,Number(wallet)||0),
  moves:MOVES.map(([key,label,human])=>({key,label,human,on:Boolean(learning[`${key}Unlocked`])})),
  skills:GUILD_SKILLS.map(s=>({id:s.id,short:s.short,name:SKILL_ROLES[s.id]?.name??s.name,does:SKILL_ROLES[s.id]?.does??'',gives:SKILL_ROLES[s.id]?.gives??'',points:points[s.id]??0,level:levelOf(points[s.id]??0).level,won:wins.has(s.id)})),
 };
}

// Kenney sprites the live scenes use (career-previews.js draws them).
export const CAR_SPRITE='assets/kenney16/garage/car_blue_3.png';
export const ROBOT_SPRITE='assets/kenney16/robot/robot_yellowBody.png';
const SUCCESS_COPY={automation:'✓ Ни один заказ не исчез. Линия выдержала поток.',vehicle:'✓ Замок держит.',security:'✓ Чужие не прошли, а свои остались внутри.',web:'✓ День прожит: покупатели дождались, заказы не потерялись.',ai:'✓ На новом случае Q-Bot умеет сомневаться вместо уверенной выдумки.',systems:'✓ Поломка осталась на месте и не уронила город.',lowlevel:'✓ Машина увидела 0011 и открыла дверь.'};
// ИНЖЕНЕР → мастерская Pythonio (pythonio-bridge.js).
const DEEPER={automation:'ДАЛЬШЕ — МАСТЕРСКАЯ → ПИТОНИО'};
const simCfg=(session)=>({selected:[...(session?.selected??[])],bits:[...(session?.bits??[0,0,0,0])],day:session?.day??1});
const CSS_HREF=new URL('./career-worlds.css',import.meta.url).href;

// The one instance main.js created: other modules (the factory hand-off at
// the end of the first week) can call enterGarageQuest without a handle.
let current=null;
// 19.0 · ENTRY API for the story: walk into the 3D garage for one hacker
// quest. id: 'q-garage-vitya' | 'q-garage-dina' | 'q-garage-master'.
// Витя meets you at the door with that night's line; the laptop on the bench
// dives into the quest. Returns false if the professions screen is not built.
export function enterGarageQuest(id='q-garage-vitya'){return current?current.enterGarageQuest(id):false;}

// 16.8 → 19.0: a class-select screen. Left, the two real professions and the
// five «скоро»; right, the picked one: its story line and its quests.
// Inside the garage the same live scene answers every edit of the rule.
export function createCareerWorlds(root,{getProfile=()=>({}),getLearning=()=>({}),getWallet=()=>0,onProfile=()=>{},onSound=()=>{},onClose=()=>{},world=null,onDeeper=null}={}){
 if(!root)return{open(){},close(){},enterGarageQuest(){return false;}};
 const doc=root.ownerDocument;
 if(doc&&!doc.querySelector('link[data-career-css]')){const l=doc.createElement('link');l.rel='stylesheet';l.href=CSS_HREF;l.dataset.careerCss='';doc.head.append(l);}
 let active=null,session=null,picked=CAREER_REALMS[0].id,running=false,pendingDay=null,paused=false;
 const grid=root.querySelector('#careerRealmGrid'),stage=root.querySelector('#careerStage'),list=root.querySelector('#careerRealmList');
 const reduceMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
 const sprites={car:CAR_SPRITE,robot:ROBOT_SPRITE};
 const preview=createCareerPreview(root.querySelector('#careerPreview'),{reduceMotion,sprites});
 // 19.0 C · the engineer's card shows a tiny Pythonio workshop and every
 // taster its own scene; the garage keeps its own demo. One canvas, one owner.
 const tasterDemo=createTasterCanvas(root.querySelector('#careerPreview'),{reduceMotion});
 const showcase={demo(id){if(id==='vehicle'){tasterDemo.stop();preview.demo(id);}else{preview.stop();tasterDemo.demo(id);}},stop(){preview.stop();tasterDemo.stop();}};
 const live=createCareerPreview(root.querySelector('#careerLive'),{reduceMotion,sprites});
 // 17.1 · the garage plays on the same canvas, driven by the player's Python.
 const garage=createGarageStage({canvas:root.querySelector('#careerLive'),visual:root.querySelector('#careerVisual'),controls:root.querySelector('#careerControls'),runButton:root.querySelector('#careerRun'),result:root.querySelector('#careerResult'),reduceMotion,onSound:(n)=>onSound(n),onDayResult:(r)=>{if(!active?.code)return;lastResult={ok:Boolean(r.ok)};session={...session,rule:r.rule,picklock:r.picklock,turns:session.turns+1};const res=evaluateCareerRealm(active.id,[],session);const paid=finishDay(active,session,res);const next=nextRealmDay(getProfile(),active.id);if(res.ok&&next>(session.day??1)){garageNext=true;$('#careerRun').textContent=`СЛЕДУЮЩАЯ НОЧЬ: ${hackerQuestForDay(next).title.toUpperCase()} →`;}return paid;}});
 let garageNext=false;
 // 19.0 C · the five tasters play on the same stage nodes as the garage.
 const tasters=createTasterStage({canvas:root.querySelector('#careerLive'),controls:root.querySelector('#careerControls'),runButton:root.querySelector('#careerRun'),result:root.querySelector('#careerResult'),head:{subtitle:root.querySelector('#careerRealmSubtitle'),title:root.querySelector('#careerRealmTitle'),prompt:root.querySelector('#careerRealmPrompt')},reduceMotion,getProfile:()=>getProfile(),onSound:(n)=>onSound(n),onWin:(id,index,hints)=>tasterWin(id,index,hints),onBack:()=>back()});
 // A won taster level: a §13 proof on its floor (idempotent by key) and,
 // the first time, a little money.
 function tasterWin(id,index,hints=0){
  const proof=tasterProof(id,index);if(!proof)return 0;
  const r=masteryEvent(getProfile(),{...proof,hints});
  if(!r.first)return 0;
  const pay=tasterById(id).pay[index]??0;
  onProfile({type:'replace',profile:r.profile,pay});
  lastResult={ok:true};renderSheet();
  return pay;
 }
 // 17.3 · the garage is a place (fp-world.js): entering the profession
 // drops you into the 3D garage; the laptop dives you into this stage, and
 // «ВЫНЫРНУТЬ» surfaces you back at the laptop. 19.0: Esc pauses, never leaves.
 let diving=false,lastResult=null,openedForDive=false;
 const $=(sel)=>root.querySelector(sel);
 // Esc = pause inside the dive: one strip, two explicit buttons.
 const pauseEl=doc?.createElement('div');
 if(pauseEl&&stage){pauseEl.className='career-pause';pauseEl.hidden=true;pauseEl.setAttribute('role','dialog');pauseEl.setAttribute('aria-label','Пауза');pauseEl.innerHTML='<b>ПАУЗА</b><span>Ты внутри ноутбука. Ночь стоит.</span><button type="button" data-pause="resume">ПРОДОЛЖИТЬ · Esc</button><button type="button" data-pause="surface">↑ ВЫНЫРНУТЬ В ГАРАЖ</button>';stage.append(pauseEl);
  pauseEl.addEventListener('click',(e)=>{const b=e.target.closest?.('[data-pause]');if(!b)return;if(b.dataset.pause==='surface'){setPause(false);surface();}else setPause(false);});}
 function setPause(on){paused=Boolean(on)&&diving;if(pauseEl)pauseEl.hidden=!paused;root.dataset.paused=String(paused);garage.pause(paused);if(paused)pauseEl?.querySelector('[data-pause="resume"]')?.focus({preventScroll:true});onSound('ui-click');}
 function wins(){return new Set(getProfile().labs?.guild?.realmWins??[]);}
 function gateOf(realm){return realmAvailability(realm,getProfile(),getLearning());}
 function renderSheet(){
  const box=root.querySelector('.career-foundation');if(!box)return;
  const c=characterSheet(getProfile(),getLearning(),getWallet());
  box.classList.add('career-sheet');
  const mine=PROFESSIONS.filter(p=>p.full||p.id===picked).map(p=>c.skills.find(s=>s.id===p.id)).filter(Boolean);
  box.innerHTML=`<div class="career-sheet__me"><small>ТЫ · РАНГ</small><strong>${esc(c.rank)}</strong><i><b style="width:${Math.round(c.progress*100)}%"></b></i><em>${c.next?`${c.xp} XP · до «${esc(c.next)}» ${c.toNext}`:`${c.xp} XP · высший ранг`}</em></div>`
   +`<div class="career-sheet__money"><small>ЗАРАБОТАНО</small><strong>${c.money.toLocaleString('ru-RU')} ₽</strong></div>`
   +`<div class="career-sheet__skills"><small>КЕМ ТЫ СТАНОВИШЬСЯ</small><span>${mine.map(s=>`<b data-skill="${s.id}" data-level="${s.level}" data-picked="${s.id===picked}" title="${esc(s.does)}">${esc(s.name)}<i>ур. ${s.level}</i></b>`).join('')}</span></div>`
   +`<div class="career-sheet__enemy"><small>ПРОТИВ КОГО</small><strong>${esc(MEGACORP.quoted)}</strong><em>«${esc(MEGACORP.motto)}»</em></div>`;
 }
 function renderGrid(){
  grid.innerHTML='';const profile=getProfile();
  const next=doorNext(profile);
  for(const p of PROFESSIONS){
   const realm=CAREER_REALMS.find(r=>r.id===p.id),gate=gateOf(realm),qs=professionQuests(p.id,profile),done=qs.filter(q=>q.status==='done').length;
   const b=doc.createElement('button');
   b.type='button';b.dataset.realm=p.id;b.dataset.locked=String(!gate.ok);b.dataset.kind=p.taster?'taster':'full';b.dataset.next=String(p.id===next);b.setAttribute('role','option');b.setAttribute('aria-selected',String(p.id===picked));
   const unit=p.taster?'уровни':'квесты',all=p.taster?`✓ все ${qs.length} уровня`:`✓ все ${qs.length} квеста`;
   const status=gate.ok?(done===qs.length?all:`${unit}: ${done} из ${qs.length}`):(gate.reason==='story'?'откроется после Вити':gate.text);
   b.innerHTML=`<b>${realm.glyph}</b><span><strong>${esc(p.name)}</strong><em><i class="career-kind">${p.taster?TASTER_MARK:FULL_MARK}</i> ${p.id===next?'▶ сюда дальше':esc(status)}</em></span>`;
   b.title=p.title;
   b.addEventListener('click',()=>{if(picked===p.id&&!list.hidden)enter(p.id);else pick(p.id,{sound:true});});
   grid.append(b);
  }
 }
 function doorNext(profile){return nextDoor({heldDay:heldRealmDay(profile,'vehicle'),ordersDone:pythonioDone(profile),profile});}
 function questRow(q){
  const mark=q.status==='done'?'✓':q.status==='active'?'▶':'·';
  return `<li data-status="${q.status}" data-quest="${esc(q.id)}"><b>${mark}</b><span><strong>${esc(q.title)}</strong><em>${esc(q.status==='locked'?'откроется после предыдущего':q.story)}</em></span></li>`;
 }
 function pick(id,{sound=false,focus=false}={}){
  const prof=PROFESSIONS.find(p=>p.id===id);if(!prof)return;
  picked=id;const realm=CAREER_REALMS.find(r=>r.id===id),gate=gateOf(realm),pitch=CAREER_PITCH[id],qs=professionQuests(id,getProfile());
  for(const b of grid.querySelectorAll('[data-realm]')){b.setAttribute('aria-selected',String(b.dataset.realm===id));if(focus&&b.dataset.realm===id)b.focus({preventScroll:true});}
  root.dataset.picked=id;
  $('#careerPickSub').textContent=`${prof.taster?`${TASTER_MARK}: три коротких уровня`:`${FULL_MARK} целиком`} · месть ${MEGACORP.of}`;
  $('#careerPickLabel')?.replaceChildren(prof.taster?`${tasterById(id).victim.toUpperCase()} · УРОВНИ ПРОБЫ`:'КОМУ ПОМОЧЬ');renderSheet();$('#careerPickTitle').textContent=prof.title;$('#careerPickFantasy').textContent=prof.line;
  $('#careerPickVerbs').innerHTML=qs.map(questRow).join('');
  $('#careerPickLife').textContent=pitch.life;$('#careerPickDeep').textContent=gate.ok?'':gate.text;
  const enterBtn=$('#careerEnter');enterBtn.dataset.locked=String(!gate.ok);
  const all=qs.every(q=>q.status==='done');
  enterBtn.textContent=gate.ok?(all?`${prof.enter.replace(' →','')} · ЕЩЁ РАЗ →`:prof.enter):gate.reason==='story'?'СНАЧАЛА — ГАРАЖ ВИТИ':'ПОКА ЗАКРЫТО';
  $('#careerPickLife').textContent=pitch.life;
  showcase.demo(id);
  if(sound)onSound('ui-click');
 }
 function enter(id){
  const realm=CAREER_REALMS.find(r=>r.id===id),gate=gateOf(realm);
  if(!gate.ok){onSound('blocked');$('#careerPickDeep').textContent=gate.text;return;}
  if(realm.pythonio&&onDeeper){showcase.stop();onDeeper(id);return;}
  if(realm.taster){openTaster(id);return;}
  if(realm.code&&world&&!diving){const q=professionQuests('vehicle',getProfile()).find(x=>x.status==='active')??HACKER_QUESTS.at(-1);enterQuest(q.id);return;}
  openRealm(id);
 }
 // Walk in: the 3D garage, Витя at the door with this night's line.
 function enterQuest(id){
  const q=questById(id);if(!q||!HACKER_QUESTS.includes(q)||!world)return false;
  pendingDay=q.day;showcase.stop();live.stop();garage.stop();
  world.open('garage',{arrive:true,say:{who:'neighbor',text:arrivalLine(q)}});onSound('door');
  return true;
 }
 function arrivalLine(q){
  if(q.id==='q-garage-vitya')return 'Сосед! Ночью мою машину опять открывали — «ТИСКИ», по воздуху. Ноутбук на верстаке, глянь, а?';
  if(q.id==='q-garage-dina')return 'Дина пригнала машину: магнитола от «ТИСКОВ» сама что-то шлёт. Садись за ноутбук.';
  return 'Саня зовёт: у «ТИСКОВ» в прошивке мастер-ключ. Ноутбук на верстаке — покажи ему дыру.';
 }
 function openTaster(id){
  const realm=CAREER_REALMS.find(r=>r.id===id);
  showcase.stop();live.stop();garage.stop();running=false;
  active={...realm,day:1};session=null;stage.hidden=false;list.hidden=true;
  root.dataset.realm=id;root.dataset.mechanic=realm.mechanic;root.dataset.inside=id;root.dataset.taster='true';delete root.dataset.day;
  const visual=$('#careerVisual');visual.dataset.mechanic=realm.mechanic;delete visual.dataset.result;
  tasters.open(id);
  $('#careerRun').focus({preventScroll:true});
 }
 function renderControls(){for(const b of root.querySelectorAll('[data-career-control]'))b.dataset.on=String(session?.selected.includes(b.dataset.careerControl));}
 function act(id){if(!active||!session||running)return;session=stepCareerSession(session,id);renderControls();const out=$('#careerResult');const line=session.events.at(-1)??'Мир изменился.';out.textContent=line;out.dataset.ok='false';live.setConfig(simCfg(session),'');onSound('ui-click');}
 function openRealm(id,{direct=false}={}){
  const base=CAREER_REALMS.find(r=>r.id===id);let day=nextRealmDay(getProfile(),id);
  if(base?.code&&world&&!direct&&!diving){showcase.stop();live.stop();garage.stop();world.open('garage',{day});onSound('door');return;}
  if(base?.code&&pendingDay){day=Math.min(pendingDay,day);pendingDay=null;}
  tasters.stop();delete root.dataset.taster;
  active=realmDay(base,day);session=createCareerSession(active.id,day);running=false;showcase.stop();root.dataset.day=String(day);
  garageNext=false;
  root.dataset.inside=active.id;
  if(active.code){
   const q=hackerQuestForDay(day);
   live.stop();stage.hidden=false;list.hidden=true;root.dataset.realm=active.id;root.dataset.mechanic=active.mechanic;
   $('#careerRealmTitle').textContent=q.title.toUpperCase();$('#careerRealmSubtitle').textContent=`ХАКЕР · НОЧЬ ${day} ИЗ ${realmDayCount(active.id)} · ${active.pay??REALM_DAY_PAY} ₽ за первую победу`;$('#careerRealmPrompt').textContent='Всё учебное и выдуманное: никаких настоящих команд и чужих машин.';
   const visual=$('#careerVisual');visual.dataset.mechanic=active.mechanic;delete visual.dataset.result;
   $('#careerRun').removeAttribute('aria-disabled');garage.open(day);
   return;
  }
  garage.stop();
  stage.hidden=false;list.hidden=true;root.dataset.realm=active.id;root.dataset.mechanic=active.mechanic;
  $('#careerRealmTitle').textContent=active.title;$('#careerRealmSubtitle').textContent=`${active.subtitle}${realmDayCount(active.id)>1?` · ДЕНЬ ${day} ИЗ ${realmDayCount(active.id)}`:''}`;$('#careerRealmPrompt').textContent=active.prompt;
  const visual=$('#careerVisual');visual.dataset.mechanic=active.mechanic;delete visual.dataset.result;
  const controls=$('#careerControls');controls.innerHTML='';
  for(const [cid,human,tech] of active.controls){const b=doc.createElement('button');b.type='button';b.dataset.careerControl=cid;b.innerHTML=`<strong>${esc(human)}</strong><small>${esc(tech)}</small>`;b.addEventListener('click',()=>act(cid));controls.append(b);}
  $('#careerRun').textContent=active.run;$('#careerRun').removeAttribute('aria-disabled');
  $('#careerResult').textContent=day>1?`Ветка «${SKILL_ROLES[active.id]?.name??active.title}» ур. ${day-1} открыла день ${day}: поток сильнее, новая деталь, плата ${active.pay} ₽. Можно поставить ${active.pick} решения.`:active.id==='web'?'Выбери максимум два вложения: бюджет настоящий.':'Меняй схему — сцена сразу покажет, что будет.';
  $('#careerResult').dataset.ok='false';
  live.live(active.id,simCfg(session),'');renderControls();
  $('#careerRun').focus({preventScroll:true});
 }
 $('#careerRun').addEventListener('click',()=>{
  if(paused)return;
  if(active?.code){if(garageNext){garageNext=false;openRealm(active.id);return;}garage.run();return;}
  if(active?.taster){if($('#careerRun').getAttribute('aria-disabled')!=='true')tasters.run();return;}
  if(!active||!session||running)return;running=true;session={...session,turns:session.turns+1};
  const realm=active,snap=session,out=$('#careerResult');$('#careerRun').setAttribute('aria-disabled','true');out.dataset.ok='false';out.textContent='День идёт — смотри на сцену.';onSound('ui-click');
  live.run(()=>{
   running=false;$('#careerRun').removeAttribute('aria-disabled');if(active!==realm)return;
   const result=evaluateCareerRealm(realm.id,snap.selected,snap);
   lastResult={ok:Boolean(result.ok)};finishDay(realm,snap,result);
  });
 });
 // §13: a won night is a proof of `if` written as code (stage grows with the
 // night), night 3 also a proof for locks. Idempotent by key.
 function recordMastery(day){
  let p=getProfile(),changed=false;
  const q=hackerQuestForDay(day);
  for(const ev of [{skill:'if',way:'code',stage:Math.min(4,day+1),key:`qq:garage:${q.id}`},...(day===3?[{skill:'lock',way:'code',stage:2,key:`qq:garage:${q.id}:lock`}]:[])]){
   const r=masteryEvent(p,{...ev,source:'garage'});if(r.first){p=r.profile;changed=true;}
  }
  if(changed)onProfile({type:'replace',profile:p});
 }
 // The day's verdict: copy, sound, profile, money. Shared by every profession.
 function finishDay(realm,snap,result){
   const out=$('#careerResult');
   const q=realm.code?hackerQuestForDay(snap.day??1):null;
   out.textContent=result.ok?(q?`✓ ${q.win}`:`${SUCCESS_COPY[realm.id]} ${result.tech.length?`Потом это назовут: ${result.tech.join(' + ')}.`:''}`):realm.code?`${garageFailCopy(snap)} Прогресс не отнимается — поправь правило и проверь снова.`:'Не вышло: посмотри на сцену — где копится или ломается? Поменяй решение и запусти снова, прогресс не отнимается.';
   out.dataset.ok=String(result.ok);$('#careerVisual').dataset.result=result.ok?'pass':'counterexample';onSound(result.ok?'reward':'blocked');
   if(result.ok){
    const day=snap.day??1,firstWin=heldRealmDay(getProfile(),realm.id)<day,pay=realm.pay??REALM_DAY_PAY;
    onProfile({type:'guild-realm',id:realm.id,day,score:result.score,skill:result.skill,skillGain:2,xp:170,pay:firstWin?pay:0});
    if(realm.code)recordMastery(day);
    if(firstWin){const lvl=characterSheet(getProfile()).skills.find(k=>k.id===realm.id)?.level;out.textContent+=` +${pay} ₽, ветка «${SKILL_ROLES[realm.id]?.name??realm.title}» выросла${lvl?` до ур. ${lvl}`:''}.`;}
    if(q)out.textContent+=` ${q.next}`;
    renderSheet();
    if(onDeeper&&DEEPER[realm.id]){const b=doc.createElement('button');b.type='button';b.className='career-deeper';b.dataset.careerDeeper=realm.id;b.textContent=DEEPER[realm.id];b.addEventListener('click',()=>onDeeper(realm.id));out.append(' ',b);}
    return firstWin?pay:0;
   }
   return 0;
 }
 function garageFailCopy(snap){
  const sim=simGarage({rule:snap.rule??'',day:snap.day??1,picklock:snap.picklock??null});
  if(!sim.night.ok)return 'Правило не запустилось.';
  if(sim.nightLeaks)return `Команда «ТИСКОВ» прошла сторожа ${sim.nightLeaks} раз(а).`;
  if(sim.dayDenied)return 'Сторож не пустил своих: защита, которая не пускает хозяина, — поломка.';
  if(sim.redLeaks)return 'Ночь выдержана, но утром «ТИСКИ» вошли трюком, которого ночью не было: правило подогнано под одну ночь, а не под смысл «пускать только хозяина».';
  return 'Сторож сломался на одной из команд.';
 }
 // Into the program from a computer in the 3D world.
 function dive(program){
  diving=true;lastResult=null;openedForDive=root.hidden;root.hidden=false;root.dataset.dive='true';$('#careerSurface').hidden=false;$('#careerSurface').textContent='↑ ВЫНЫРНУТЬ В ГАРАЖ';setPause(false);
  const id=program==='garage'?'vehicle':program;const realm=CAREER_REALMS.find(r=>r.id===id);
  if(!realm){surface();return;}
  const gate=gateOf(realm);
  // ИНЖЕНЕР from the laptop: the workshop takes the dive over.
  if(gate.ok&&realm.pythonio&&onDeeper){onDeeper(id);return;}
  if(gate.ok)openRealm(id,{direct:true});
  else{stage.hidden=true;list.hidden=false;renderSheet();renderGrid();pick(PROFESSIONS.some(p=>p.id===id)?id:picked);$('#careerPickDeep').textContent=gate.text;}
 }
 function surface(){
  if(!release({keep:true}))return false;
  if(openedForDive)root.hidden=true;else{renderSheet();renderGrid();}
  onSound('whoosh');world?.surface(lastResult);return true;
 }
 // Leave the dive without surfacing the 3D world: another program (Pythonio)
 // takes the screen over and surfaces it later itself.
 function release({keep=false}={}){
  if(!diving)return false;
  diving=false;paused=false;if(pauseEl)pauseEl.hidden=true;delete root.dataset.paused;delete root.dataset.dive;$('#careerSurface').hidden=true;live.stop();garage.stop();tasters.stop();running=false;stage.hidden=true;list.hidden=false;active=null;session=null;delete root.dataset.inside;delete root.dataset.taster;
  if(!keep)root.hidden=true;
  return true;
 }
 function back(){if(diving){surface();return;}delete root.dataset.inside;delete root.dataset.taster;tasters.stop();live.stop();garage.stop();running=false;stage.hidden=true;list.hidden=false;active=null;session=null;renderSheet();renderGrid();pick(picked,{focus:true});}
 function close(){showcase.stop();live.stop();garage.stop();tasters.stop();delete root.dataset.taster;running=false;root.hidden=true;onClose();}
 $('#careerBack').addEventListener('click',back);
 $('#careerSurface')?.addEventListener('click',surface);
 $('#careerClose').addEventListener('click',close);
 $('#careerEnter').addEventListener('click',()=>enter(picked));
 root.addEventListener('keydown',(e)=>{
  if(root.hidden)return;
  if(e.key==='Escape'&&e.target?.closest?.('textarea')){e.target.blur();return;}
  // 19.0: inside the laptop Esc pauses (and Esc again resumes); leaving is
  // the explicit «ВЫНЫРНУТЬ» button, never a silent key.
  if(e.key==='Escape'&&diving)return; // the window handler below owns it
  if(e.key==='Escape'){e.preventDefault();if(!stage.hidden)back();else close();return;}
  if(list.hidden)return;
  const ids=PROFESSIONS.map(p=>p.id),i=Math.max(0,ids.indexOf(picked));
  if(e.key==='ArrowDown'||e.key==='ArrowRight'){e.preventDefault();pick(ids[(i+1)%ids.length],{sound:true,focus:true});}
  else if(e.key==='ArrowUp'||e.key==='ArrowLeft'){e.preventDefault();pick(ids[(i+ids.length-1)%ids.length],{sound:true,focus:true});}
  else if(e.key==='Enter'&&e.target?.closest?.('#careerRealmGrid')){e.preventDefault();enter(picked);}
 });
 // Esc inside the laptop works wherever the focus is (after the editor lost
 // it, it sits on <body>, outside this screen).
 globalThis.addEventListener?.('keydown',(e)=>{
  if(e.key!=='Escape'||root.hidden||!diving||e.defaultPrevented)return;
  if(e.target?.closest?.('textarea')){e.target.blur();e.preventDefault();return;}
  e.preventDefault();setPause(!paused);
 });
 function retitle(){
  const h=root.querySelector('.career-head');if(!h)return;
  const p=h.querySelector('div > p:not(.ending__eyebrow)');if(p)p.textContent=MEGACORP.line;
 }
 const api={
  open(){root.hidden=false;stage.hidden=true;list.hidden=false;delete root.dataset.inside;delete root.dataset.taster;tasters.stop();retitle();renderSheet();renderGrid();const n=doorNext(getProfile());const firstOpen=n?PROFESSIONS.find(p=>p.id===n):PROFESSIONS.find(p=>gateOf(CAREER_REALMS.find(r=>r.id===p.id)).ok&&professionQuests(p.id,getProfile()).some(q=>q.status==='active'));pick(firstOpen?.id??picked,{focus:true});},
  close(){showcase.stop();live.stop();garage.stop();tasters.stop();root.hidden=true;},
  // 19.0 C · straight into a taster (tests, links): id = security|web|ai|systems|lowlevel.
  openTaster(id){if(!tasterById(id))return false;const gate=gateOf(CAREER_REALMS.find(r=>r.id===id));if(!gate.ok)return false;root.hidden=false;openTaster(id);return true;},
  get taster(){return tasters.state;},
  dive,surface,release,get diving(){return diving;},get lastResult(){return lastResult;},get paused(){return paused;},
  // 19.0 · the story's way in (see the exported enterGarageQuest above).
  enterGarageQuest(id='q-garage-vitya'){if(!root.hidden&&!diving){showcase.stop();root.hidden=true;}return enterQuest(id);},
  quests:(id)=>professionQuests(id,getProfile()),
  // Back from the 3D world without diving: the professions list again.
  fromWorld(){pendingDay=null;if(root.hidden)return;delete root.dataset.inside;stage.hidden=true;list.hidden=false;active=null;session=null;renderSheet();renderGrid();pick(picked,{focus:true});},
  refresh(){renderGrid();if(!list.hidden)pick(picked);},
  // 17.4 · a night run from the AR headset counts like one run in the laptop:
  // same evaluation, same first-win pay and XP. Returns rubles paid.
  creditGarage({day=1,rule='',picklock=null,ok=false}={}){
   const realm=CAREER_REALMS.find(r=>r.id==='vehicle');if(!realm||!ok||!foundationStatus(getLearning(),realm).ok)return 0;
   const res=evaluateCareerRealm('vehicle',[],{day,rule,picklock,turns:1});if(!res.ok)return 0;
   const firstWin=heldRealmDay(getProfile(),'vehicle')<day,pay=realmDay(realm,day).pay??REALM_DAY_PAY;
   onProfile({type:'guild-realm',id:'vehicle',day,score:res.score,skill:res.skill,skillGain:2,xp:170,pay:firstWin?pay:0});
   recordMastery(day);
   return firstWin?pay:0;
  },
 };
 current=api;
 return api;
}
