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

const storeKey='ysi-connected-demo-v3';
const defaultProfiles=()=>({'The Union of Day and Night':{count:0,names:[]},'Lady Niguma Foundation I':{count:0,names:[]}});
const state=Object.assign({events:[],tasks:[],currentTaskId:null,update:null,practices:{},profiles:defaultProfiles()},JSON.parse(localStorage.getItem(storeKey)||'{}'));
if(!state.profiles||!Object.keys(state.profiles).length)state.profiles=defaultProfiles();
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

// ---- Team task scenario: several tasks at once, with an archive ----
const activeTasks=()=>state.tasks.filter(t=>t.status!=='archived');
const archivedTasks=()=>state.tasks.filter(t=>t.status==='archived');
function currentTask(){
  const found=state.tasks.find(t=>t.id===state.currentTaskId);
  if(found&&found.status!=='archived')return found;
  const list=activeTasks();return list[list.length-1]||null;
}
const taskStatusLabel=t=>t.status==='review'?'Needs review':t.status==='rework'?'Sent back for rework':'In progress';
function renderTaskList(){
  const list=$('#task-list');if(!list)return;
  const tasks=[...activeTasks()].reverse(),current=currentTask();
  list.innerHTML=tasks.length?tasks.map(t=>`<button type="button" class="task-row${current&&t.id===current.id?' is-active':''}" data-task-id="${t.id}"><b>${t.title}</b><span>${t.owner} · Due ${t.due} · ${taskStatusLabel(t)}</span></button>`).join(''):'<p class="task-list-empty">No active tasks yet — assign one below.</p>';
  $$('.task-row',list).forEach(x=>x.addEventListener('click',()=>{state.currentTaskId=x.dataset.taskId;saveState();renderOperations()}));
  const archived=[...archivedTasks()].reverse();$('#archive-count').textContent=`(${archived.length})`;
  $('#archive-list').innerHTML=archived.length?archived.map(t=>`<div class="archive-row-item"><b>${t.title}</b><span>${t.owner} · Due ${t.due}</span></div>`).join(''):'<p class="task-list-empty">Nothing archived yet.</p>';
}
function renderOperations(){
  if(opsMode==='student')return renderStudentUpdate();
  $('#flow-title').textContent='Assignment delivery';
  $('#rework-box').hidden=true;
  renderTaskList();
  const task=currentTask();
  if(!task){
    $('#sofia-title').textContent='Prepare the next course page';$('#sofia-detail').innerHTML='Owner · Sergey<br>Due · Today, 18:00';$('#sofia-status').textContent='Draft';$('#sofia-status').classList.remove('status-success');
    $('#phone-kicker').textContent='✈ SERGEY · TELEGRAM';$('#phone-title').textContent='Waiting for an assignment';$('#phone-detail').textContent='The task will appear here with its owner and due time.';$('#complete-task').disabled=true;$('#complete-task').textContent='Submit work + proof';
    $('#review-title').textContent='Nothing to review yet';$('#review-detail').textContent='Completed work returns with evidence.';$('#review-status').textContent='Waiting';$('#proof-thumb').classList.remove('has-proof');$('#review-actions').hidden=true;
    $('#event-trace').textContent='No event created yet.';$('#retry-event').disabled=true;setFlow('created','Ready for Sofia');return;
  }
  const isRework=task.status==='rework';
  $('#sofia-title').textContent=task.title;$('#sofia-detail').innerHTML=`Owner · ${task.owner}<br>Due · ${task.due}`;$('#sofia-status').textContent=task.status==='review'?'Needs review':isRework?'Sent back':'Delivered';$('#sofia-status').classList.remove('status-success');
  $('#phone-kicker').textContent=`✈ ${task.owner.toUpperCase()} · TELEGRAM`;$('#phone-title').textContent=task.title;$('#phone-detail').textContent=isRework?`Sofia asked for a rework: “${task.reworkNote||'see notes'}”. Resubmit when ready.`:`Due ${task.due}. ${task.note}`;$('#complete-task').disabled=task.status==='review';$('#complete-task').textContent=task.status==='review'?'Submitted ✓':isRework?'Resubmit work + proof':'Submit work + proof';
  $('#review-title').textContent=task.status==='review'?task.title:'Nothing to review yet';$('#review-detail').textContent=task.status==='review'?'Text, screenshot and URL attached · completed just now':isRework?'Waiting for a resubmit after rework.':'Completed work returns with evidence.';$('#review-status').textContent=task.status==='review'?'Needs review':isRework?'Rework requested':'Waiting';$('#proof-thumb').classList.toggle('has-proof',task.status==='review');
  $('#review-actions').hidden=task.status!=='review';$('#rework-task').hidden=false;$('#confirm-task').hidden=false;$('#confirm-task').textContent='Confirm ✓';
  $('#event-trace').textContent=task.status==='review'?'task.submitted → proof.attached → review.requested':isRework?'review.reworked → owner.notified':`task.assigned → ${task.owner.toLowerCase()}.delivered`;$('#retry-event').disabled=false;
  setFlow(task.status==='review'?'review':'received',task.status==='review'?'Back with Sofia for review':isRework?'Sent back for rework':'Delivered to Sergey');
}
async function animateTask(){
  const task={id:`task-${Date.now()}`,title:$('#task-title').value.trim()||'Prepare the next course page',owner:$('#task-owner').value,due:$('#task-due').value,note:$('#task-note').value.trim(),status:'assigned'};
  state.tasks.push(task);state.currentTaskId=task.id;eventOnce({id:task.id,type:'task.assigned'});saveState();renderOperations();
  $('.delivery-stage').classList.add('is-delivering');await wait(720);$('.delivery-stage').classList.remove('is-delivering');
}
$('#assign-task').addEventListener('click',animateTask);
const updateAssignLabel=()=>{$('#assign-task').innerHTML=`Assign to ${$('#task-owner').value} <span>→</span>`};
$('#task-owner').addEventListener('change',updateAssignLabel);
updateAssignLabel();
$('#complete-task').addEventListener('click',async()=>{
  if(opsMode==='student')return;
  const task=currentTask();if(!task)return;task.status='review';eventOnce({id:`${task.id}:submitted`,type:'task.submitted'});saveState();
  $('.proof-thumb').classList.add('proof-arriving');renderOperations();await wait(700);$('.proof-thumb').classList.remove('proof-arriving');
});
$('#retry-event').addEventListener('click',()=>{
  if(opsMode==='student'){if(!state.update)return;const added=eventOnce({id:state.update.id,type:'offer.sent'});$('#event-trace').textContent=added?'Event accepted':'Duplicate event ignored · one offer remains';$('#retry-event').classList.add('confirmed');setTimeout(()=>$('#retry-event').classList.remove('confirmed'),700);return}
  const task=currentTask();if(!task)return;const added=eventOnce({id:task.id,type:'task.assigned'});
  $('#event-trace').textContent=added?'Event accepted':'Duplicate event ignored · one task remains';
  $('#retry-event').classList.add('confirmed');setTimeout(()=>$('#retry-event').classList.remove('confirmed'),700);
});
$('#confirm-task').addEventListener('click',()=>{
  if(opsMode==='student'){
    if(!state.update||state.update.status==='paid')return;
    state.update.status='paid';eventOnce({id:`${state.update.id}:paid`,type:'payment.confirmed'});
    const p=state.profiles[state.update.programme];if(p){p.count++;p.names.push(state.update.buyer)}
    saveState();renderStudentUpdate();return;
  }
  const task=currentTask();if(!task||task.status!=='review')return;
  task.status='archived';eventOnce({id:`${task.id}:accepted`,type:'task.accepted'});
  state.currentTaskId=activeTasks()[activeTasks().length-1]?.id||null;saveState();renderOperations();
});
$('#rework-task').addEventListener('click',()=>{
  const task=currentTask();if(!task||task.status!=='review')return;
  $('#review-actions').hidden=true;$('#rework-box').hidden=false;$('#rework-note').value='';$('#rework-note').focus();
});
$('#send-rework').addEventListener('click',()=>{
  const task=currentTask();if(!task)return;
  task.status='rework';task.reworkNote=$('#rework-note').value.trim()||'Please redo this one.';
  eventOnce({id:`${task.id}:reworked`,type:'review.reworked'});$('#rework-box').hidden=true;saveState();renderOperations();
});
$('#toggle-archive').addEventListener('click',()=>{
  const el=$('#archive-list');el.hidden=!el.hidden;$('#toggle-archive').classList.toggle('is-active',!el.hidden);
});

// ---- Student scenario: offer a course to a prospective buyer, Sofia confirms payment, access opens ----
function renderProfiles(){
  const row=$('#profile-row');if(!row)return;
  row.innerHTML=Object.entries(state.profiles).map(([name,p])=>`<button type="button" class="profile-chip" data-programme="${name}"><b>${name}</b><span>+${p.count} subscriber${p.count===1?'':'s'}</span></button>`).join('');
  $$('.profile-chip',row).forEach(x=>x.addEventListener('click',()=>{
    const existing=x.querySelector('.profile-names');if(existing){existing.remove();return}
    $$('.profile-names',row).forEach(n=>n.remove());
    const p=state.profiles[x.dataset.programme],el=document.createElement('div');el.className='profile-names';el.textContent=p.names.length?p.names.join(', '):'No subscribers yet';x.append(el);
  }));
}
function renderStudentUpdate(){
  $('#flow-title').textContent='Course offer & access';const update=state.update;
  $('#rework-box').hidden=true;
  $('#sofia-title').textContent=update?update.programme:'Offer a course';$('#sofia-detail').innerHTML=update?`Buyer · ${update.buyer}<br>Price · ${update.price}`:'Choose a programme and a prospective buyer.';$('#sofia-status').textContent=update?(update.status==='paid'?'✓ Access granted':'Awaiting payment'):'Draft';$('#sofia-status').classList.toggle('status-success',update?.status==='paid');
  $('#phone-kicker').textContent=update?`✈ ${update.buyer.toUpperCase()} · TELEGRAM`:'✈ TELEGRAM';$('#phone-title').textContent=update?`${update.programme} — ${update.price}`:'Waiting for an offer';$('#phone-detail').textContent=update?(update.status==='paid'?'Access granted — open the class from your member library.':'Awaiting payment confirmation from Sofia.'):'A course offer will appear here for the prospective buyer.';$('#complete-task').disabled=true;$('#complete-task').textContent=update?(update.status==='paid'?'Access open':'Awaiting payment'):'No offer yet';
  $('#review-title').textContent=update?(update.status==='paid'?'Payment confirmed':'Confirm payment received'):'No offer yet';$('#review-detail').textContent=update?(update.status==='paid'?'Sofia confirmed the payment manually — never automatic, never assumed.':`(${update.buyer} says she paid — check the real payment, then confirm here.)`):'An offer will appear here for confirmation.';$('#review-status').textContent=update?(update.status==='paid'?'✓ Done':'Needs confirmation'):'Waiting';$('#review-status').classList.toggle('status-success',update?.status==='paid');$('#proof-thumb').classList.toggle('has-proof',update?.status==='paid');
  $('#review-actions').hidden=!(update&&update.status!=='paid');$('#rework-task').hidden=true;$('#confirm-task').hidden=false;$('#confirm-task').textContent='Confirm payment received';
  $('#event-trace').textContent=update?(update.status==='paid'?'offer.sent → payment.confirmed → access.opened':'offer.sent → buyer.notified'):'No event created yet.';$('#retry-event').disabled=!update;
  setFlow(update?(update.status==='paid'?'review':'received'):'created',update?(update.status==='paid'?'Access granted':'Awaiting payment confirmation'):'Ready to send an offer');
  renderProfiles();
}
$('#publish-update').addEventListener('click',async()=>{
  const update={id:`update-${Date.now()}`,programme:$('#programme').value,buyer:$('#buyer-name').value.trim()||'Maya',price:$('#programme-price').value.trim()||'$220',status:'pending'};
  state.update=update;eventOnce({id:update.id,type:'offer.sent'});saveState();renderStudentUpdate();
  $('.delivery-stage').classList.add('is-delivering');await wait(720);$('.delivery-stage').classList.remove('is-delivering');
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

// ---- Practice: meditation / yoga / Buddhist diary can all be saved at once, all visible in the web profile ----
const practiceSchemas={
  meditation:{icon:'◌',kicker:'PLAN A MEDITATION',title:'Make room for silence.',button:'Schedule meditation',boundary:'Saved in this browser. The reminder contains time and title, never a private reflection.',fields:[['Title','text','Ten quiet minutes'],['Duration','select','10 minutes|20 minutes|40 minutes'],['When','select','Today · 19:30|Tomorrow · 07:30'],['Guiding text','text','Return gently to the breath.']],label:'MEDITATION'},
  yoga:{icon:'⌁',kicker:'PLAN YOGA',title:'Meet the body where it is.',button:'Schedule yoga',boundary:'The reminder carries the practice and time. Body notes remain private.',fields:[['Practice','select','Shavasana|Lady Niguma sequence|Morning grounding'],['Duration','select','40 minutes|20 minutes|60 minutes'],['When','select','Today · 19:30|Tomorrow · 07:30'],['Reminder','select','1 hour before|15 minutes before|At start']],label:'YOGA'},
  buddhist:{icon:'✦',kicker:'BUDDHIST DIARY',title:'Reflect on one chosen vow.',button:'Save private check-in',boundary:'Private by default. Telegram confirms the save but never copies Plus / Minus text.',fields:[['Vow','select','Speak with care|Give freely|Rejoice in others'],['Plus · what helped','text','I paused before replying.'],['Minus · what was difficult','text','I rushed one answer.'],['Next intention','text','Take one breath before I speak.']],label:'BUDDHIST DIARY'}
};
let practiceMode='meditation';
function renderPracticeForm(){
  const s=practiceSchemas[practiceMode];$('#practice-icon').textContent=s.icon;$('#practice-kicker').textContent=s.kicker;$('#practice-form-title').textContent=s.title;$('#save-practice').innerHTML=`${s.button} <span>→</span>`;$('#practice-boundary').textContent=s.boundary;
  $('#practice-fields').innerHTML=s.fields.map(([label,type,value],i)=>`<label><span>${label}</span>${type==='select'?`<select data-practice-field="${i}">${value.split('|').map(x=>`<option>${x}</option>`).join('')}</select>`:`<input data-practice-field="${i}" value="${value}">`}</label>`).join('');
  if(state.practices[practiceMode]){$$('[data-practice-field]').forEach((field,i)=>{field.value=state.practices[practiceMode].values[i]??field.value})}
  $$('.practice-tabs button').forEach(x=>{const on=x.dataset.practice===practiceMode;x.classList.toggle('is-active',on);x.setAttribute('aria-selected',on?'true':'false')});
}
function practiceValues(){return{mode:practiceMode,values:$$('[data-practice-field]').map(x=>x.value.trim()),id:`practice-${Date.now()}`}}
function renderWebPracticeList(){
  const list=$('#web-practice-list');if(!list)return;
  const saved=['meditation','yoga','buddhist'].filter(m=>state.practices[m]);
  list.innerHTML=saved.length?saved.map(m=>{
    const e=state.practices[m],[a,b,c]=e.values,s=practiceSchemas[m];
    const detail=m==='buddhist'?`Plus · ${b}`:`${b} · ${c}`;
    return `<div class="web-practice-entry" data-mode="${m}"><small>${s.label}</small><b>${a}</b><span>${detail}</span></div>`;
  }).join(''):'<p class="task-list-empty">Nothing saved yet — schedule a practice to see it here.</p>';
}
function renderPracticeSurfaces(entry){
  renderWebPracticeList();
  if(!entry)return;const [a,b,c,d]=entry.values;
  if(entry.mode==='buddhist'){
    $('#mobile-label').textContent='PRIVATE CHECK-IN';$('#mobile-practice-title').textContent=a;$('#mobile-practice-detail').innerHTML='Reflection saved<br>Only you can open it';$('#telegram-label').textContent='TELEGRAM · PRIVATE CONFIRMATION';$('#telegram-practice-title').textContent='Check-in saved';$('#telegram-practice-detail').textContent='Your private reflection is available in your diary.';
  }else if(entry.mode==='yoga'){
    $('#mobile-label').textContent='TODAY’S YOGA';$('#mobile-practice-title').textContent=a;$('#mobile-practice-detail').innerHTML=`${b}<br>${c}<br>Reminder · ${d}`;$('#telegram-label').textContent='TELEGRAM · OPT-IN PREVIEW';$('#telegram-practice-title').textContent=`${a} reminder`;$('#telegram-practice-detail').textContent=`${b} · ${c} · ${d}.`;
  }else{
    $('#mobile-label').textContent='TODAY’S MEDITATION';$('#mobile-practice-title').textContent=a;$('#mobile-practice-detail').innerHTML=`${b}<br>${c}`;$('#telegram-label').textContent='TELEGRAM · OPT-IN PREVIEW';$('#telegram-practice-title').textContent='Meditation reminder';$('#telegram-practice-detail').textContent=`${a} · ${b} · ${c}.`;
  }
  $$('.practice-surface').forEach(x=>x.dataset.mode=entry.mode);
}
$$('[data-practice]').forEach(x=>x.addEventListener('click',()=>{practiceMode=x.dataset.practice;renderPracticeForm()}));
$('#practice-form').addEventListener('submit',async e=>{
  e.preventDefault();const entry=practiceValues();state.practices[practiceMode]=entry;eventOnce({id:entry.id,type:`practice.${entry.mode}.saved`});saveState();
  const packet=$('#sync-packet');packet.classList.add('is-moving');await wait(540);renderPracticeSurfaces(entry);
  $$('.practice-surface').forEach((card,i)=>setTimeout(()=>card.classList.add('just-arrived'),reduceMotion?0:i*90));await wait(540);
  packet.classList.remove('is-moving');$$('.practice-surface').forEach(x=>x.classList.remove('just-arrived'));$('#practice-toast').classList.add('is-visible');setTimeout(()=>$('#practice-toast').classList.remove('is-visible'),2200);
});

$('#copy-brief').addEventListener('click',async()=>{
  const text='YSI connected system — meeting brief\n\n1. YSI Operations: internal assignment → delivery → proof → review → archive, plus a course-offer → payment-confirmed → access flow for prospective buyers.\n2. Site Companion: natural-language public-site help with approved sources and safe handoff.\n3. Practice Companion: distinct meditation, yoga and Buddhist diary forms with one notification layer, all visible together in one profile.\n\nPrivate demo: no YSI/Kajabi account connection, payment or production sync. Live @ysi_flow_bot acceptance is tracked separately.\n\nFull connected system: from $35,000. Fixed first-build quote follows one workflow review.';
  try{await navigator.clipboard.writeText(text);$('#copy-status').textContent='Copied · nothing was sent.'}catch{$('#copy-status').textContent='Copy is blocked in this browser.'}
});
window.__YSI_GUIDE_TEST__={eventSourceFresh,loadEventSource,getEventSource:()=>eventSource,answerQuestion};
renderPracticeForm();renderPracticeSurfaces(state.practices[practiceMode]);renderOperations();loadEventSource();showScreen(location.hash.slice(1)||'overview',false);
