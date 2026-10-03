import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { selectProjects } from './content-policy.mjs';
import { storyMarkup, storyIllustration } from './reader-content.mjs';
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
// Keep the original public selection from build.mjs, including Sergey's exclusion.
const phrases=phraseSource.filter(phrase=>phrase!=='Перед показом заказчику не забудь написать боту хоть /start.');
for(const phrase of phrases) if(!phraseSource.includes(phrase)) throw Error(`Missing exact phrase: ${phrase}`);
writeFileSync(path.join(here,'phrases.js'),`window.sitePhrases = ${JSON.stringify(phrases)};\n`);
const icons={github:'<path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.87c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02A9.58 9.58 0 0 1 12 6.81c.85 0 1.71.12 2.51.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.58 4.94.36.31.68.92.68 1.85v2.76c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/>',x:'<path d="M18.9 2H22l-6.8 7.8L23 22h-6.1l-4.8-7.5L5.5 22H2.3l8.3-9.5L1 2h6.2l4.4 6.9L18.9 2Zm-1.1 18h1.7L6.3 3.9H4.5L17.8 20Z"/>',telegram:'<path d="m21.7 3.3-3.4 17c-.3 1.2-.9 1.5-1.9.9l-5.2-3.9-2.5 2.4c-.3.3-.5.5-1 .5l.4-5.3L17.8 5.5c.4-.4-.1-.6-.6-.3L5.2 12.8.1 11.2c-1.1-.3-1.1-1.1.2-1.6L20.5 1.8c.9-.3 1.7.2 1.2 1.5Z"/>'};
for(const [file,section] of [['index.html','work'],['games.html','games'],['stories.html','stories']]){
 const navIcons={work:'<path d="M4 17l5-5-5-5M12 19h8"/>',games:'<path d="M7 12h4M9 10v4M17.5 5.5h-11A4.5 4.5 0 0 0 2 10v5a4 4 0 0 0 7 2.6h6A4 4 0 0 0 22 15v-5a4.5 4.5 0 0 0-4.5-4.5z"/><circle cx="16" cy="11" r=".6"/><circle cx="18" cy="13.5" r=".6"/>',stories:'<path d="M4 20V6h6v14H4Zm6-2V4h7v14h-7Zm7 0V6h3v14h-3Z"/>'};
 const nav=[['index.html','Работа','work'],['games.html','Игры','games'],['stories.html','Рассказы','stories']].map(([f,label,s])=>`<a href="./${f}?v=20261003-8" ${s===section?'aria-current="page"':''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${navIcons[s]}</svg><span>${label}</span></a>`).join('');
 const social=[['github','GitHub','https://github.com/aka-gst'],['x','Twitter / X','https://x.com/aka_gst'],['telegram','Telegram','https://t.me/gostinka27']].map(([icon,label,href])=>`<a class="social" href="${href}" target="_blank" rel="noopener" aria-label="${label}"><svg viewBox="0 0 24 24" aria-hidden="true">${icons[icon]}</svg></a>`).join('');
 replace(file,'HEADER',`<header class="site-header"><div class="header-inner site-width"><a class="brand" href="./index.html?v=20261003-8" aria-label="aka-gst — главная"><img src="../../assets/mark-${section==='games'?'games':section}.svg" alt="" width="32" height="32">aka<span>-</span>gst</a><div class="phrase" aria-label="Фразы из рабочих заметок"><span class="phrase-label">ИИ:</span><span class="phrase-text" id="phrase-text">Проверено поломкой.</span><span class="phrase-cursor" aria-hidden="true"></span></div><nav class="main-nav" aria-label="Разделы сайта">${nav}</nav><div class="social-links"><a class="social language" href="https://aka-gst.ru/en/" aria-label="English version">EN</a>${social}</div></div></header>`);
}
const card=(p,section)=>{
 const q=p.id==='qa-quest', shot=p.shots?.[0], isGame=section==='games';
 const src=q&&!isGame?'./assets/quequest-warehouse-current.png':p.preview?`./assets/${p.preview}`:shot?`../../assets/shots/${shot.file}`:null;
 const symbols={"voki-toki": "<rect x=\"12\" y=\"20\" width=\"43\" height=\"35\" rx=\"9\"/><path d=\"m55 30 16-9v32l-16-9M26 67h28\"/>", "ai-router": "<path d=\"M15 40h24M39 40V18h26M39 40v22h26\"/><path d=\"m57 10 9 8-9 8m0 28 9 8-9 8\"/>", "ashennote": "<path d=\"M24 13h27l13 13v43H24zM51 13v16h13M33 43h22M33 53h15\"/>", "glubina": "<ellipse cx=\"40\" cy=\"20\" rx=\"28\" ry=\"10\"/><path d=\"M12 20v16c0 14 56 14 56 0V20M12 36v16c0 14 56 14 56 0V36M12 52v12c0 14 56 14 56 0V52\"/>"};
 const media=src?`<img src="${esc(src)}" alt="${esc(q&&!isGame?'Новая первая смена QueQuest':shot?.alt||`Экран ${p.title}`)}" loading="lazy">`:`<svg class="project-icon" viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${symbols[p.id]||'<path d="M18 40h44M40 18v44"/>'}</svg>`;
 const link=p.links?.find(l=>['play','demo','site','course','report'].includes(l.type))||p.links?.[0];
 const href=url(link?.url);
 const title=p.id==='puzzle-quest'?'Матч Квест':p.title;
 // Фраза Сергея на QueQuest — посимвольно из data/fraza-quequest.txt (правило 35а; её трижды подменяли).
 const description=q?fraza:p.tagline;
 const label=p.pending?'Запуск после проверки':q&&isGame?'Демо курса ↗':isGame?'Играть ↗':q?'Играть и учиться ↗':'Открыть ↗';
 const tag=p.pending?'article':'a';
 return `<${tag} class="project-card ${p.pending?'is-pending':''}" data-project="${esc(p.id)}" ${href?`href="${esc(href)}"`:''} ${href?.startsWith('http')?'target="_blank" rel="noopener"':''}><div class="project-image">${media}</div><div class="project-copy"><small>${esc(q&&!isGame?'Учебный продукт + игра · Python':p.kicker)}</small><h3>${esc(title)}</h3>${q&&!isGame?`<p class="tagline-lead">${esc(strokaQ)}</p>`:''}<p class="tagline">${esc(String(description??'').replace(/(?<!\.)\.$/,''))}</p><span class="card-action">${label}</span></div></${tag}>`;
};
const work=selectProjects(projects,'work');
const gateway=work.find(p=>p.id==='local-agent-gateway'), anigma=work.find(p=>p.id==='dharma-ai');
replace('index.html','FEATURES',`<article class="feature gateway-feature" data-project="local-agent-gateway"><a class="feature-image" href="https://aka-gst.github.io/local-agent-gateway/" target="_blank" rel="noopener"><img src="../../assets/shots/gateway-console.jpg" alt="${esc(gateway.shots[1].alt)}" fetchpriority="high" width="1200" height="750"></a><div class="feature-copy"><p class="eyebrow">Автор · архитектура и проверка AI</p><h2>Local Agent Gateway</h2><p>${esc(gateway.tagline)}</p><div class="feature-links"><a class="pill" href="https://aka-gst.github.io/local-agent-gateway/" target="_blank" rel="noopener">Проверки шлюза ↗</a><a class="text-link" href="https://github.com/aka-gst/local-agent-gateway" target="_blank" rel="noopener">Исходники ↗</a></div></div></article>
<article class="feature" id="anigma"><div class="feature-image"><img src="../../assets/shots/anigma-magazin.jpg" alt="Витрина магазина ANIGMA: корзина, фильтры и товары с ценами" width="1200" height="750"></div><div class="feature-copy"><p class="eyebrow">Магазин на ИИ-агентах · делаем вдвоём</p><h2>ANIGMA</h2><p>${esc(anigma.tagline)}</p></div></article>`);

replace('index.html','WORK',work.filter(p=>!['local-agent-gateway','dharma-ai','qa-quest'].includes(p.id)).map(p=>card(p,'work')).join('\n'));
replace('index.html','QUEST',card(work.find(p=>p.id==='qa-quest'),'work'));
const games=selectProjects(projects,'games');
replace('games.html','GAMES',games.map(p=>card(p,'games')).join('\n'));
replace('stories.html','BOOKS',stories['сборники'].map(c=>`<a class="book" href="#${esc(c.id)}" aria-label="Сборник «${esc(c.title)}»"><img src="../../assets/covers/${esc(c.cover)}" alt="Обложка ${esc(c.title)}"><span>${esc(c.title)}</span></a>`).join('\n'));
replace('stories.html','STORIES',stories['сборники'].map(c=>`<section class="collection" id="${esc(c.id)}"><div class="collection-heading"><span>${esc(c.year)} · ${c.stories.length} историй</span><h3>${esc(c.title)}</h3></div><div class="collection-links">${c.stories.map((s,i)=>`<a href="./reader/${encodeURIComponent(s.slug)}/?v=20261003-8"><img src="../../assets/covers/${esc(storyIllustration(s,c).file)}" alt="" loading="lazy"><span><strong>${esc(s.title)}</strong><small>${Math.max(1,Math.ceil(s.words/180))} мин</small></span><span aria-hidden="true">→</span></a>`).join('')}</div></section>`).join('\n'));
console.log(`Generated ${work.length} work entries, ${games.length} games, 3 collections, ${phrases.length} phrases.`);

// The preview reader is generated from the same original texts and covers.
const storyList=stories['сборники'].flatMap(collection=>collection.stories.map(story=>({...story,collection})));
for(const [index,story] of storyList.entries()) {
 const illustration=storyIllustration(story,story.collection);
 const original=readFileSync(path.join(root,'stories',`${story.collection.id}--${story.slug}.txt`),'utf8');
 const previous=storyList[index-1], next=storyList[index+1];
 const readerPath=path.join(here,'reader',story.slug);
 mkdirSync(readerPath,{recursive:true});
 const adjacent=item=>item?`<a href="../${esc(item.slug)}/?v=20261003-8">${esc(item.title)} →</a>`:'<span></span>';
 writeFileSync(path.join(readerPath,'index.html'),`<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#000000"><meta name="description" content="${esc(story.lead)}"><title>${esc(story.title)} — Сергей Гостов</title><link rel="icon" href="../../../../favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="../../site.css?v=20261003-8"></head>
<body class="page-reader"><a class="skip-link" href="#story">К тексту</a><header class="reader-header"><a class="reader-brand" href="../../index.html?v=20261003-8">aka-gst</a><a href="../../stories.html?v=20261003-8#${esc(story.collection.id)}">← Все рассказы</a></header><main class="reader-main"><article id="story" class="reader-story" data-story="${esc(story.slug)}"><p class="eyebrow">${esc(story.collection.title)} · ${esc(story.collection.year)}</p><h1>${esc(story.title)}</h1><p class="reader-meta">${esc(stories['автор'])} · ${Math.max(1,Math.ceil(story.words/180))} мин</p><figure class="reader-cover ${illustration.own?'':'reader-cover-book'}"><img src="../../../../assets/covers/${esc(illustration.file)}" alt="${esc(illustration.alt)}"><figcaption>${esc(story.coverBy||story.collection.coverBy||'')}</figcaption></figure><div class="reader-text">${storyMarkup(original)}</div></article><nav class="reader-adjacent" aria-label="Другие рассказы">${adjacent(previous)}<a href="../../stories.html?v=20261003-8">Оглавление</a>${adjacent(next)}</nav></main></body></html>`);
}
console.log(`Generated ${storyList.length} local readers from original texts.`);
