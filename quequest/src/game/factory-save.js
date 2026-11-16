export const FACTORY_COUNT=60;
export function validFactory(s){
  if(!s||s.factory?.version!==1||typeof s.factory.paid!=='boolean'||!Array.isArray(s.nodes)||s.nodes.length<3||s.nodes.length>12||!Array.isArray(s.links)||s.links.length>30||!Array.isArray(s.transit)||!Array.isArray(s.factory.done)||!Array.isArray(s.factory.errors)||!Array.isArray(s.rules)||s.rules.length!==4)return false;
  if(!s.nodes.every(n=>['in','photo','writer','router'].includes(n.type)&&typeof n.id==='string'&&Number.isFinite(n.x)&&n.x>=70&&n.x<=1310&&Number.isFinite(n.y)&&n.y>=325&&n.y<=730&&Array.isArray(n.queue)))return false;
  if(!Number.isFinite(s.time)||!Number.isFinite(s.coins)||!Number.isInteger(s.nextNode)||!s.metrics||!Number.isFinite(s.metrics.builds)||!Number.isFinite(s.metrics.rulesChanged)||!Array.isArray(s.unlocked)||!Array.isArray(s.log)||!Array.isArray(s.discoveries)||!s.rules.every(r=>r&&[null,'image','text','all','ready'].includes(r.condition)&&[null,'photo','writer'].includes(r.action)))return false;
  const ids=new Set(s.nodes.map(n=>n.id));if(ids.size!==s.nodes.length||!['in','left','right'].every(id=>ids.has(id))||!s.links.every(l=>ids.has(l.from)&&ids.has(l.to))||!s.transit.every(t=>ids.has(t.from)&&ids.has(t.to)&&Number.isFinite(t.left)&&t.left>0&&t.left<=t.duration))return false;
  const jobs=[...s.nodes.flatMap(n=>n.queue),...s.transit.map(t=>t.job),...s.factory.done,...s.factory.errors];
  if(jobs.length!==FACTORY_COUNT||new Set(jobs.map(j=>j?.id)).size!==FACTORY_COUNT||!jobs.every(j=>Number.isInteger(j.id)&&j.id>=1&&j.id<=FACTORY_COUNT&&j.color===(j.id%2?'white':'red')&&j.type===(j.color==='white'?'image':'text')))return false;
  if(!s.factory.done.every(j=>j.exit===(j.color==='white'?'left':'right'))||s.factory.paid&&s.factory.done.length!==FACTORY_COUNT)return false;
  return true;
}
