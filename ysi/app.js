const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const screens=['overview','operations','assistant','practice','offer'];
function showScreen(id,push=true){
  if(!screens.includes(id))id='overview';
  const swap=()=>{$$('.screen').forEach(x=>x.classList.toggle('is-active',x.id===id));$$('.nav-button').forEach(x=>{const on=x.dataset.screen===id;x.classList.toggle('is-active',on);x.setAttribute('aria-current',on?'page':'false')})};
  if(!reduceMotion&&document.startViewTransition)document.startViewTransition(swap);else swap();
  if(push)history.replaceState(null,'',`#${id}`);
}
$$('[data-screen]').forEach(x=>x.addEventListener('click',()=>showScreen(x.dataset.screen)));
$$('[data-go]').forEach(x=>x.addEventListener('click',()=>showScreen(x.dataset.go)));
addEventListener('hashchange',()=>showScreen(location.hash.slice(1),false));

const storeKey='ysi-connected-demo-v2';
const state=Object.assign({events:[],task:null,update:null,practice:null},JSON.parse(localStorage.getItem(storeKey)||'{}'));
const saveState=()=>localStorage.setItem(storeKey,JSON.stringify(state));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,reduceMotion?0:ms));
function eventOnce(event){if(state.events.some(x=>x.id===event.id))return false;state.events.push(event);saveState();return true}

let opsMode='team';
$$('[data-ops-mode]').forEach(button=>button.addEventListener('click',()=>{
  opsMode=button.dataset.opsMode;
  $$('[data-ops-mode]').forEach(x=>x.classList.toggle('is-active',x===button));
  $$('.control-view').forEach(x=>x.classList.toggle('is-active',x.id===`${opsMode}-controls`));
  renderOperations();
}));
function setFlow(step,text){
  $$('.delivery-stage .surface').forEach(x=>x.classList.toggle('is-current',x.dataset.step===step));
  $('#flow-status').innerHTML=`<i></i>${text}`;
}
function renderOperations(){
  if(opsMode==='student')return renderStudentUpdate();
  $('#flow-title').textContent='Assignment delivery';
  const task=state.task;
  if(!task){
    $('#sofia-title').textContent='Prepare the next course page';$('#sofia-detail').innerHTML='Owner · Sergey<br>Due · Today, 18:00';$('#sofia-status').textContent='Draft';
    $('#phone-kicker').textContent='SERGEY · TELEGRAM';$('#phone-title').textContent='Waiting for an assignment';$('#phone-detail').textContent='The task will appear here with its owner and due time.';$('#complete-task').disabled=true;$('#complete-task').textContent='Submit work + proof';
    $('#review-title').textContent='Nothing to review yet';$('#review-detail').textContent='Completed work returns with evidence.';$('#review-status').textContent='Waiting';$('#proof-thumb').classList.remove('has-proof');
    $('#event-trace').textContent='No event created yet.';$('#retry-event').disabled=true;setFlow('created','Ready for Sofia');return;
  }
  $('#sofia-title').textContent=task.title;$('#sofia-detail').innerHTML=`Owner · ${task.owner}<br>Due · ${task.due}`;$('#sofia-status').textContent=task.status==='review'?'Needs review':'Delivered';
  $('#phone-kicker').textContent=`${task.owner.toUpperCase()} · TELEGRAM`;$('#phone-title').textContent=task.title;$('#phone-detail').textContent=`Due ${task.due}. ${task.note}`;$('#complete-task').disabled=task.status==='review';$('#complete-task').textContent=task.status==='review'?'Submitted ✓':'Submit work + proof';
  $('#review-title').textContent=task.status==='review'?task.title:'Nothing to review yet';$('#review-detail').textContent=task.status==='review'?'Text, screenshot and URL attached · completed just now':'Completed work returns with evidence.';$('#review-status').textContent=task.status==='review'?'Needs review':'Waiting';$('#proof-thumb').classList.toggle('has-proof',task.status==='review');
  $('#event-trace').textContent=task.status==='review'?'task.submitted → proof.attached → review.requested':`task.assigned → ${task.owner.toLowerCase()}.delivered`;$('#retry-event').disabled=false;
  setFlow(task.status==='review'?'review':'received',task.status==='review'?'Back with Sofia for review':'Delivered to Sergey');
}
async function animateTask(){
  const task={id:`task-${Date.now()}`,title:$('#task-title').value.trim()||'Prepare the next course page',owner:$('#task-owner').value,due:$('#task-due').value,note:$('#task-note').value.trim(),status:'assigned'};
  state.task=task;eventOnce({id:task.id,type:'task.assigned'});renderOperations();
  $('.delivery-stage').classList.add('is-delivering');await wait(720);$('.delivery-stage').classList.remove('is-delivering');
}
$('#assign-task').addEventListener('click',animateTask);
$('#complete-task').addEventListener('click',async()=>{
  if(!state.task)return;state.task.status='review';eventOnce({id:`${state.task.id}:submitted`,type:'task.submitted'});saveState();
  $('.proof-thumb').classList.add('proof-arriving');renderOperations();await wait(700);$('.proof-thumb').classList.remove('proof-arriving');
});
$('#retry-event').addEventListener('click',()=>{
  if(!state.task)return;const added=eventOnce({id:state.task.id,type:'task.assigned'});
  $('#event-trace').textContent=added?'Event accepted':'Duplicate event ignored · one task remains';
  $('#retry-event').classList.add('confirmed');setTimeout(()=>$('#retry-event').classList.remove('confirmed'),700);
});
function renderStudentUpdate(){
  $('#flow-title').textContent='Student programme delivery';const update=state.update;
  $('#sofia-title').textContent=update?.programme||'The Union of Day and Night';$('#sofia-detail').innerHTML='Audience · opted-in students<br>Access · enrolled members';$('#sofia-status').textContent=update?'Preview sent':'Draft';
  $('#phone-kicker').textContent='MAYA · TELEGRAM';$('#phone-title').textContent=update?.title||'Waiting for chosen updates';$('#phone-detail').textContent=update?`${update.programme} · Open the class from your member library.`:'Maya receives only programmes she selected.';$('#complete-task').disabled=true;$('#complete-task').textContent=update?'Open member access':'No update yet';
  $('#review-title').textContent=update?'Delivery receipt':'No delivery yet';$('#review-detail').textContent=update?'Maya · received · allowed course route shown':'An opted-out delivery never turns green.';$('#review-status').textContent=update?'Delivered':'Waiting';$('#proof-thumb').classList.toggle('has-proof',Boolean(update));
  $('#event-trace').textContent=update?'programme.updated → preference.checked → maya.delivered':'No event created yet.';$('#retry-event').disabled=!update;setFlow(update?'review':'created',update?'Delivered to opted-in participant':'Ready for a programme update');
}
$('#publish-update').addEventListener('click',async()=>{
  if(!$('#course-optin').checked){$('#event-trace').textContent='Delivery stopped · Maya did not opt in';setFlow('created','Not delivered — consent required');return}
  const update={id:`update-${Date.now()}`,programme:$('#programme').value,title:$('#update-title').value.trim()||'Class recording is ready'};state.update=update;eventOnce({id:update.id,type:'programme.updated'});renderStudentUpdate();$('.delivery-stage').classList.add('is-delivering');await wait(720);$('.delivery-stage').classList.remove('is-delivering');
});

const guideTopics=[
  {tests:[/start|begin|new|first|where.*course|which.*course/i],answer:'Start with a free introduction, then choose one live or self-paced programme that matches the time you actually have.',label:'Explore current YSI courses',url:'https://www.yogastudiesinstitute.org/'},
  {tests:[/russian|рус|language|translation/i],answer:'YSI lists programmes in several languages, including Russian options. I can point to the current distributor or registration route.',label:'See current language routes',url:'https://www.yogastudiesinstitute.org/'},
  {tests:[/join|register|sign.?up|enrol|distributor/i],answer:'Choose the programme first, then use its current distributor link. If the route is unclear, I hand it to the YSI team instead of guessing.',label:'See how to join',url:'https://www.yogastudiesinstitute.org/contact-faq'},
  {tests:[/member|billing|cancel|payment|refund|account/i],answer:'Account and billing questions need the official help route. This guide does not inspect an account or promise a refund.',label:'Open contact and FAQ',url:'https://www.yogastudiesinstitute.org/contact-faq'},
  {tests:[/anxiety|diagnos|medical|therapy|crisis|depress/i],answer:'I cannot diagnose or replace a health professional. I can only help you find public YSI learning information.',label:'Contact YSI',url:'https://www.yogastudiesinstitute.org/contact-faq'}
];
const eventSourceUrl='data/ysi-public-events-2026-09-09.json';
const eventQuestion=/event|upcoming|retreat|schedule|when|what.*coming/i;
let eventSource={status:'loading',snapshot:null,error:null};
function eventSourceFresh(snapshot,now=Date.now()){
  const observed=Date.parse(snapshot?.observed_at||'');
  const hours=Number(snapshot?.fresh_for_hours);
  return Boolean(snapshot&&Number.isFinite(observed)&&Number.isFinite(hours)&&hours>0&&Array.isArray(snapshot.events)&&snapshot.events.length&&now-observed<=hours*3600000&&now>=observed-300000);
}
function renderEventSource(){
  const list=$('#public-event-list'),status=$('#events-source-state');if(!list||!status)return;
  if(eventSource.status!=='fresh'){
    status.className='events-source-state is-error';status.innerHTML='<i></i>Current data could not be refreshed';
    list.innerHTML='<article class="event-source-error"><b>Current events unavailable</b><span>The guide will not repeat an old or missing date.</span></article>';return;
  }
  const snapshot=eventSource.snapshot;const observed=new Date(snapshot.observed_at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  status.className='events-source-state is-fresh';status.innerHTML=`<i></i>Observed ${observed}`;
  list.innerHTML='';snapshot.events.slice(0,4).forEach((event,index)=>{
    const a=document.createElement('a');a.className='public-event-card';a.href=event.url;a.target='_blank';a.rel='noreferrer';
    const number=document.createElement('small');number.textContent=String(index+1).padStart(2,'0');const title=document.createElement('b');title.textContent=event.title;const date=document.createElement('span');date.textContent=event.date;const arrow=document.createElement('i');arrow.textContent='↗';
    a.append(number,title,date,arrow);list.append(a);
  });
  if(snapshot.events.length>4){const more=document.createElement('p');more.className='events-more';more.textContent=`Ask YSI for all ${snapshot.events.length} current listings`;list.append(more)}
}
async function loadEventSource(){
  try{
    const response=await fetch(eventSourceUrl,{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const snapshot=await response.json();if(!eventSourceFresh(snapshot))throw new Error('stale or invalid snapshot');
    eventSource={status:'fresh',snapshot,error:null};
  }catch(error){eventSource={status:'unavailable',snapshot:null,error:String(error)}}
  renderEventSource();return eventSource;
}
let lastAnswer='';
function addBubble(text,type,link){
  const article=document.createElement('article');article.className=`bubble ${type}`;article.innerHTML=`<small>${type==='user'?'VISITOR':'YSI GUIDE'}</small><p></p>`;article.querySelector('p').textContent=text;
  if(link){const a=document.createElement('a');a.href=link.url;a.target='_blank';a.rel='noreferrer';a.textContent=`${link.label} ↗`;article.append(a)}
  $('#chat-log').append(article);$('#chat-log').scrollTop=$('#chat-log').scrollHeight;
}
function addEventAnswer(){
  if(eventSource.status!=='fresh'){
    const answer='I could not refresh the current YSI event source, so I will not invent or repeat dates. Please open the live YSI site.';
    addBubble(answer,'guide',{label:'Open the live YSI site',url:'https://www.yogastudiesinstitute.org/#section-1711984190106'});lastAnswer=answer;return;
  }
  const snapshot=eventSource.snapshot,article=document.createElement('article');article.className='bubble guide event-answer';article.innerHTML='<small>YSI GUIDE · CURRENT SOURCE</small><p></p><ol></ol>';
  article.querySelector('p').textContent=`I found ${snapshot.events.length} public listings observed ${new Date(snapshot.observed_at).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}:`;
  const list=article.querySelector('ol');snapshot.events.forEach(event=>{const li=document.createElement('li'),a=document.createElement('a'),span=document.createElement('span');a.href=event.url;a.target='_blank';a.rel='noreferrer';a.textContent=event.title;span.textContent=event.date;li.append(a,span);list.append(li)});
  $('#chat-log').append(article);$('#chat-log').scrollTop=$('#chat-log').scrollHeight;
  lastAnswer=snapshot.events.map(event=>`${event.title}, ${event.date}`).join('. ');
}
async function answerQuestion(raw){
  const text=raw.trim();if(!text)return;addBubble(text,'user');const topic=guideTopics.find(x=>x.tests.some(test=>test.test(text)));
  await wait(260);
  if(eventQuestion.test(text)){addEventAnswer()}else{
    const answer=topic?.answer||'I do not have an approved source for that question in this demo. I would ask one clarifying question or hand it to the YSI team — never invent an answer.';
    addBubble(answer,'guide',topic);lastAnswer=answer;
  }
  $('#speak-answer').disabled=!('speechSynthesis'in window);$('#stop-answer').disabled=!('speechSynthesis'in window);
}
$('#guide-form').addEventListener('submit',e=>{e.preventDefault();answerQuestion($('#guide-input').value);$('#guide-input').value=''});
$$('[data-prompt]').forEach(x=>x.addEventListener('click',()=>answerQuestion(x.dataset.prompt)));
const openGuide=()=>{$('#assistant-drawer').classList.add('is-open');$('#open-guide').classList.add('is-hidden');$('#open-guide').setAttribute('aria-expanded','true');setTimeout(()=>$('#guide-input').focus(),reduceMotion?0:280)};
const closeGuide=()=>{$('#assistant-drawer').classList.remove('is-open');$('#open-guide').classList.remove('is-hidden');$('#open-guide').setAttribute('aria-expanded','false')};
$('#open-guide').addEventListener('click',openGuide);$('#close-guide').addEventListener('click',closeGuide);
const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
$('#listen-question').addEventListener('click',()=>{
  if(!Recognition){$('#voice-state').textContent='Voice input is unavailable in this browser';return}
  const r=new Recognition();r.lang='en-US';r.interimResults=false;$('#voice-state').textContent='Listening…';
  r.onresult=e=>{$('#guide-input').value=e.results[0][0].transcript;$('#voice-state').textContent='Voice captured locally'};
  r.onerror=()=>$('#voice-state').textContent='Voice input was not captured';r.onend=()=>{if($('#voice-state').textContent==='Listening…')$('#voice-state').textContent='Listening stopped'};r.start();
});
$('#speak-answer').addEventListener('click',()=>{if(!lastAnswer||!speechSynthesis)return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(lastAnswer);u.lang='en-US';u.rate=.88;u.pitch=.96;speechSynthesis.speak(u);$('#voice-state').textContent='Playing browser voice · press Stop any time'});
$('#stop-answer').addEventListener('click',()=>{if(speechSynthesis)speechSynthesis.cancel();$('#voice-state').textContent='Stopped'});

const practiceSchemas={
  meditation:{icon:'◌',kicker:'PLAN A MEDITATION',title:'Make room for silence.',button:'Schedule meditation',boundary:'Saved in this browser. The reminder contains time and title, never a private reflection.',fields:[['Title','text','Ten quiet minutes'],['Duration','select','10 minutes|20 minutes|40 minutes'],['When','select','Today · 19:30|Tomorrow · 07:30'],['Guiding text','text','Return gently to the breath.']]},
  yoga:{icon:'⌁',kicker:'PLAN YOGA',title:'Meet the body where it is.',button:'Schedule yoga',boundary:'The reminder carries the practice and time. Body notes remain private.',fields:[['Practice','select','Shavasana|Lady Niguma sequence|Morning grounding'],['Duration','select','40 minutes|20 minutes|60 minutes'],['When','select','Today · 19:30|Tomorrow · 07:30'],['Reminder','select','1 hour before|15 minutes before|At start']]},
  buddhist:{icon:'✦',kicker:'BUDDHIST DIARY',title:'Reflect on one chosen vow.',button:'Save private check-in',boundary:'Private by default. Telegram confirms the save but never copies Plus / Minus text.',fields:[['Vow','select','Speak with care|Give freely|Rejoice in others'],['Plus · what helped','text','I paused before replying.'],['Minus · what was difficult','text','I rushed one answer.'],['Next intention','text','Take one breath before I speak.']]}
};
let practiceMode=state.practice?.mode||'meditation';
function renderPracticeForm(){
  const s=practiceSchemas[practiceMode];$('#practice-icon').textContent=s.icon;$('#practice-kicker').textContent=s.kicker;$('#practice-form-title').textContent=s.title;$('#save-practice').innerHTML=`${s.button} <span>→</span>`;$('#practice-boundary').textContent=s.boundary;
  $('#practice-fields').innerHTML=s.fields.map(([label,type,value],i)=>`<label><span>${label}</span>${type==='select'?`<select data-practice-field="${i}">${value.split('|').map(x=>`<option>${x}</option>`).join('')}</select>`:`<input data-practice-field="${i}" value="${value}">`}</label>`).join('');
  if(state.practice?.mode===practiceMode){$$('[data-practice-field]').forEach((field,i)=>{field.value=state.practice.values[i]??field.value})}
  $$('.practice-tabs button').forEach(x=>{const on=x.dataset.practice===practiceMode;x.classList.toggle('is-active',on);x.setAttribute('aria-selected',on?'true':'false')});
}
function practiceValues(){return{mode:practiceMode,values:$$('[data-practice-field]').map(x=>x.value.trim()),id:`practice-${Date.now()}`}}
function renderPracticeSurfaces(entry=state.practice){
  if(!entry)return;const [a,b,c,d]=entry.values;
  if(entry.mode==='buddhist'){
    $('#web-label').textContent='BUDDHIST DIARY · PRIVATE';$('#web-practice-title').textContent=a;$('#web-practice-detail').innerHTML=`Plus · ${b}<br>Minus · ${c}<br>Next · ${d}`;$('#mobile-label').textContent='PRIVATE CHECK-IN';$('#mobile-practice-title').textContent=a;$('#mobile-practice-detail').innerHTML='Reflection saved<br>Only you can open it';$('#telegram-label').textContent='TELEGRAM · PRIVATE CONFIRMATION';$('#telegram-practice-title').textContent='Check-in saved';$('#telegram-practice-detail').textContent='Your private reflection is available in your diary.';
  }else if(entry.mode==='yoga'){
    $('#web-label').textContent='YOGA · PLANNED';$('#web-practice-title').textContent=a;$('#web-practice-detail').innerHTML=`${b} · ${c}<br>Reminder · ${d}`;$('#mobile-label').textContent='TODAY’S YOGA';$('#mobile-practice-title').textContent=a;$('#mobile-practice-detail').innerHTML=`${b}<br>${c}<br>Reminder · ${d}`;$('#telegram-label').textContent='TELEGRAM · OPT-IN PREVIEW';$('#telegram-practice-title').textContent=`${a} reminder`;$('#telegram-practice-detail').textContent=`${b} · ${c} · ${d}.`;
  }else{
    $('#web-label').textContent='MEDITATION · PLANNED';$('#web-practice-title').textContent=a;$('#web-practice-detail').innerHTML=`${b} · ${c}<br>${d}`;$('#mobile-label').textContent='TODAY’S MEDITATION';$('#mobile-practice-title').textContent=a;$('#mobile-practice-detail').innerHTML=`${b}<br>${c}`;$('#telegram-label').textContent='TELEGRAM · OPT-IN PREVIEW';$('#telegram-practice-title').textContent='Meditation reminder';$('#telegram-practice-detail').textContent=`${a} · ${b} · ${c}.`;
  }
  $$('.practice-surface').forEach(x=>x.dataset.mode=entry.mode);
}
$$('[data-practice]').forEach(x=>x.addEventListener('click',()=>{practiceMode=x.dataset.practice;renderPracticeForm()}));
$('#practice-form').addEventListener('submit',async e=>{
  e.preventDefault();const entry=practiceValues();state.practice=entry;eventOnce({id:entry.id,type:`practice.${entry.mode}.saved`});saveState();
  const packet=$('#sync-packet');packet.classList.add('is-moving');await wait(540);renderPracticeSurfaces(entry);
  $$('.practice-surface').forEach((card,i)=>setTimeout(()=>card.classList.add('just-arrived'),reduceMotion?0:i*90));await wait(540);
  packet.classList.remove('is-moving');$$('.practice-surface').forEach(x=>x.classList.remove('just-arrived'));$('#practice-toast').classList.add('is-visible');setTimeout(()=>$('#practice-toast').classList.remove('is-visible'),2200);
});

$$('[data-scale]').forEach(button=>button.addEventListener('click',()=>{
  $$('[data-scale]').forEach(x=>x.classList.toggle('is-active',x===button));
  $('#scale-copy').textContent=button.dataset.scale==='pilot'?'Sofia · Sergey · one course participant. Real @ysi_flow_bot delivery is accepted separately.':'Planned: 20 total team seats plus 20 course participants. Kajabi remains a separate API and permissions decision.';
}));
$('#copy-brief').addEventListener('click',async()=>{
  const text='YSI connected system — meeting brief\n\n1. YSI Operations: internal assignment → delivery → proof → review, plus opted-in student programme updates.\n2. Site Companion: natural-language public-site help with approved sources and safe handoff.\n3. Practice Companion: distinct meditation, yoga and Buddhist diary forms with one notification layer.\n\nPrivate demo: no YSI/Kajabi account connection, payment or production sync. Live @ysi_flow_bot acceptance is tracked separately.\n\nFull connected system: from $35,000. Fixed first-build quote follows one workflow review.';
  try{await navigator.clipboard.writeText(text);$('#copy-status').textContent='Copied · nothing was sent.'}catch{$('#copy-status').textContent='Copy is blocked in this browser.'}
});
window.__YSI_GUIDE_TEST__={eventSourceFresh,loadEventSource,getEventSource:()=>eventSource,answerQuestion};
renderPracticeForm();renderPracticeSurfaces();renderOperations();loadEventSource();showScreen(location.hash.slice(1)||'overview',false);
