import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { selectProjects } from './content-policy.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = name => JSON.parse(readFileSync(path.join(root, 'data', name), 'utf8'));
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const url = value => value?.startsWith('/') ? `https://aka-gst.ru${value}` : value;
const replace = (file, key, html) => {
 const filename = path.join(here,file), source = readFileSync(filename,'utf8');
 const start = `<!-- GENERATED:${key} -->`, end = `<!-- /GENERATED:${key} -->`;
 if (source.split(start).length!==2 || source.split(end).length!==2) throw Error(`${file}: ${key} markers must occur once`);
 writeFileSync(filename,source.replace(new RegExp(`${start}[\\s\\S]*?${end}`),`${start}\n${html}\n${end}`));
};
const projects = [...read('projects.json').projects,...JSON.parse(readFileSync(path.join(here,'catalog-additions.json'),'utf8'))];
const fraza=readFileSync(path.join(root,'data','fraza-quequest.txt'),'utf8').trim();
// Строка Сергея перед фразой на «Работе» (02.10.2026: «программируешь роботов чтобы они зарабатывали тебе деньги») — посимвольно из файла.
const strokaQ=readFileSync(path.join(root,'data','stroka-quequest-rabota.txt'),'utf8').trim();
if(!strokaQ) throw Error('пустая строка QueQuest для «Работы»');
const site=read('site.json'), stories=read('stories.json'), phraseSource=read('frazy.json').frazy;
const phrases=['Это роли, а не задачи.','Когнитивный экзоскелет.','У жалобы есть число. Найди его.','Проверено поломкой.','Починили механизмом, а не обещанием.','Оно сильное, потому что честное.'];
for(const phrase of phrases) if(!phraseSource.includes(phrase)) throw Error(`Missing exact phrase: ${phrase}`);
writeFileSync(path.join(here,'phrases.js'),`window.sitePhrases = ${JSON.stringify(phrases)};\n`);
const icons={github:'<path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.87c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02A9.58 9.58 0 0 1 12 6.81c.85 0 1.71.12 2.51.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.58 4.94.36.31.68.92.68 1.85v2.76c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/>',x:'<path d="M18.9 2H22l-6.8 7.8L23 22h-6.1l-4.8-7.5L5.5 22H2.3l8.3-9.5L1 2h6.2l4.4 6.9L18.9 2Zm-1.1 18h1.7L6.3 3.9H4.5L17.8 20Z"/>',telegram:'<path d="m21.7 3.3-3.4 17c-.3 1.2-.9 1.5-1.9.9l-5.2-3.9-2.5 2.4c-.3.3-.5.5-1 .5l.4-5.3L17.8 5.5c.4-.4-.1-.6-.6-.3L5.2 12.8.1 11.2c-1.1-.3-1.1-1.1.2-1.6L20.5 1.8c.9-.3 1.7.2 1.2 1.5Z"/>'};
for(const [file,section] of [['index.html','work'],['games.html','games'],['stories.html','stories']]){
 const nav=[['index.html','Работа','work'],['games.html','Игры','games'],['stories.html','Рассказы','stories']].map(([f,label,s])=>`<a href="./${f}?v=20261001-6" ${s===section?'aria-current="page"':''}>${label}</a>`).join('');
 const social=[['github','GitHub','https://github.com/aka-gst'],['x','Twitter / X','https://x.com/aka_gst'],['telegram','Telegram','https://t.me/gostinka27']].map(([icon,label,href])=>`<a class="social" href="${href}" target="_blank" rel="noopener" aria-label="${label}"><svg viewBox="0 0 24 24" aria-hidden="true">${icons[icon]}</svg></a>`).join('');
 replace(file,'HEADER',`<header class="site-header"><div class="header-inner site-width"><a class="brand" href="./index.html?v=20261001-6" aria-label="aka-gst — главная"><img src="../../assets/mark-${section==='games'?'games':section}.svg" alt="" width="32" height="32">aka<span>-</span>gst</a><div class="phrase" aria-label="Фразы из рабочих заметок"><span class="phrase-label">ИИ:</span><span class="phrase-text" id="phrase-text">Проверено поломкой.</span><button class="phrase-toggle" type="button" aria-label="Остановить ленту фраз" aria-pressed="false">Ⅱ</button></div><nav class="main-nav" aria-label="Разделы сайта">${nav}</nav><div class="social-links"><a class="social language" href="https://aka-gst.ru/en/" aria-label="English version">EN</a>${social}</div><a class="pill header-contact" href="https://t.me/gostinka27" target="_blank" rel="noopener">Обсудить проект ↗</a></div></header>`);
}
const card=(p,section)=>{
 const q=p.id==='qa-quest', shot=p.shots?.[0], isGame=section==='games';
 const src=q&&!isGame?'./assets/quequest-warehouse-current.png':p.preview?`./assets/${p.preview}`:shot?`../../assets/shots/${shot.file}`:null;
 const media=src?`<img src="${esc(src)}" alt="${esc(q&&!isGame?'Новая первая смена QueQuest':shot?.alt||`Экран ${p.title}`)}" loading="lazy">`:`<span class="project-symbol" aria-hidden="true">${esc(p.monogram||'↔')}</span><span class="image-label">${p.pending?'Проект в разработке':'Свой сервер'}</span>`;
 const link=p.links?.find(l=>['play','demo','site','course','report'].includes(l.type))||p.links?.[0];
 const href=url(link?.url);
 const title=p.id==='puzzle-quest'?'Матч Квест':p.title;
 // Фраза Сергея на QueQuest — посимвольно из data/fraza-quequest.txt (правило 35а; её трижды подменяли).
 const description=q?fraza:p.tagline;
 const label=p.pending?'Запуск после проверки':q&&isGame?'Демо курса ↗':isGame?'Играть ↗':'Открыть ↗';
 const tag=p.pending?'article':'a';
 return `<${tag} class="project-card ${p.pending?'is-pending':''}" data-project="${esc(p.id)}" ${href?`href="${esc(href)}"`:''} ${href?.startsWith('http')?'target="_blank" rel="noopener"':''}><div class="project-image">${media}</div><div class="project-copy"><small>${esc(p.kicker)}</small><h3>${esc(title)}</h3>${q&&!isGame?`<p class="tagline-lead">${esc(strokaQ)}</p>`:''}<p class="tagline">${esc(String(description??'').replace(/(?<!\.)\.$/,''))}</p><span class="card-action">${label}</span></div></${tag}>`;
};
const work=selectProjects(projects,'work');
replace('index.html','WORK',work.filter(p=>!['local-agent-gateway','dharma-ai'].includes(p.id)).map(p=>card(p,'work')).join('\n'));
replace('index.html','RESUME',site.profile.experience.filter(i=>i.show).map(i=>`<article class="resume-item"><span>${esc(i.period)}</span><div><h3>${esc(i.org)}</h3><p>${esc(i.role)}</p>${i.org.includes('Инди-студия')?'<a class="pill" href="./game-design/">Кейс VitalSchool · геймдизайн ↗</a>':''}</div></article>`).join('\n'));
replace('index.html','SKILLS',site.profile.skills.map(g=>`<div class="skill-group"><h4>${esc(g.group)}</h4><p>${g.items.map(esc).join(' · ')}</p></div>`).join('\n'));
const games=selectProjects(projects,'games');
replace('games.html','GAMES',games.map(p=>card(p,'games')).join('\n'));
replace('stories.html','BOOKS',stories['сборники'].map(c=>`<a class="book" href="#${esc(c.id)}" aria-label="Сборник «${esc(c.title)}»"><img src="../../assets/covers/${esc(c.cover)}" alt="Обложка ${esc(c.title)}"><span>${esc(c.title)}</span></a>`).join('\n'));
replace('stories.html','STORIES',stories['сборники'].map(c=>`<section class="collection" id="${esc(c.id)}"><div class="collection-heading"><span>${esc(c.year)} · ${c.stories.length} историй</span><h3>${esc(c.title)}</h3></div><div class="collection-links">${c.stories.map((s,i)=>`<a href="https://aka-gst.ru/rasskazy/${encodeURIComponent(s.slug)}/"><span>${String(i+1).padStart(2,'0')}</span><strong>${esc(s.title)}</strong><span aria-hidden="true">↗</span></a>`).join('')}</div></section>`).join('\n'));
console.log(`Generated ${work.length} work entries, ${games.length} games, 3 collections, ${phrases.length} phrases.`);
