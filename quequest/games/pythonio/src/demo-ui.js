/* Existing controls, presented as bounded panels only in the three embedded demo orders. */
(function(g){'use strict';g.PythonioDemoUI={create(doc){
 const html=doc.documentElement,workspace=doc.querySelector('.workspace'),moves=[],created=[];let active=true,current='task';
 const move=(node,parent)=>{if(!node)return;moves.push([node,node.parentNode,node.nextSibling]);parent.append(node)};
 const box=(cls,parent)=>{const e=doc.createElement('section');e.className=cls;parent.append(e);created.push(e);return e};
 const nav=doc.createElement('nav');nav.className='qq-demo-tabs';nav.setAttribute('aria-label','Панели демозаказа');workspace.before(nav);created.push(nav);
 const panels={};for(const[id,label]of[['task','ЦЕЛЬ'],['map','ПОЛЕ'],['tools','ЦЕХ'],['rule','КОД'],['selected','УЗЕЛ']]){
  const b=doc.createElement('button');b.type='button';b.dataset.qqPanel=id;b.textContent=label;nav.append(b);b.addEventListener('click',()=>show(id));panels[id]=box('qq-demo-panel',workspace);panels[id].dataset.qqPane=id;
 }
 move(doc.querySelector('#saveState'),nav);
 move(doc.querySelector('#menuButton'),nav);
 const left=doc.querySelector('.left-panel'),center=doc.querySelector('.center-panel');move(left,panels.task);move(center,panels.map);
 const story=box('qq-demo-story',left),actions=box('qq-demo-actions',left),guide=box('qq-demo-guide',left);
 for(const sel of ['#chapterLabel','.letter-header','#letter'])move(doc.querySelector(sel),story);
 const manual=doc.querySelector('#manual'),manualNote=manual.nextElementSibling;
 for(const node of [doc.querySelector('#goals'),doc.querySelector('#claim'),manual,manualNote,doc.querySelector('#reward')])move(node,actions);
 for(const sel of ['#coach','#pythonConcept','#guideAction'])move(doc.querySelector(sel),guide);
 for(const sel of ['.scorebar','.tools-title','#buildTools'])move(doc.querySelector(sel),panels.tools);
 move(doc.querySelector('#ruleDock'),panels.rule);const nodeBar=box('qq-demo-nodebar',panels.selected);move(doc.querySelector('.tool-modes'),nodeBar);move(doc.querySelector('#pulseList'),nodeBar);move(doc.querySelector('#inspector'),panels.selected);
 move(doc.querySelector('.zoom'),doc.querySelector('.command-bar'));
 move(doc.querySelector('#toast'),center);
 function show(id){if(!active||!panels[id])return;current=id;html.dataset.qqDemoPane=id;for(const[k,p]of Object.entries(panels))p.hidden=k!==id;for(const b of nav.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.qqPanel===id));}
 function destroy(){if(!active)return;active=false;for(const[node,parent,next]of moves.reverse())parent.insertBefore(node,next?.parentNode===parent?next:null);for(const node of created.reverse())node.remove();delete html.dataset.qqDemoUi;delete html.dataset.qqDemoPane;delete html.dataset.qqDemoOrder;}
 html.dataset.qqDemoUi='true';show(current);
 return{show,get active(){return active},refresh(chapter){if(!active)return;html.dataset.qqDemoOrder=String(chapter+1);if(chapter>2)destroy()}};
}};})(globalThis);
