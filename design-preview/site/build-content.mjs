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
  const filename = path.join(here, file);
  const source = readFileSync(filename, 'utf8');
  const start = `<!-- GENERATED:${key} -->`;
  const end = `<!-- /GENERATED:${key} -->`;
  if (source.split(start).length !== 2 || source.split(end).length !== 2) throw Error(`${file}: ${key} markers must occur once`);
  writeFileSync(filename, source.replace(new RegExp(`${start}[\\s\\S]*?${end}`), `${start}\n${html}\n${end}`));
};

const projects = read('projects.json').projects;
const site = read('site.json');
const stories = read('stories.json');
const phraseSource = read('frazy.json').frazy;
const phraseSelection = [
  'Это роли, а не задачи.',
  'Когнитивный экзоскелет.',
  'У жалобы есть число. Найди его.',
  'Проверено поломкой.',
  'Починили механизмом, а не обещанием.',
  'Оно сильное, потому что честное.'
];
const phrases = phraseSelection.map(phrase => {
  if (!phraseSource.includes(phrase)) throw Error(`Missing exact phrase: ${phrase}`);
  return phrase;
});
writeFileSync(path.join(here, 'phrases.js'), `window.sitePhrases = ${JSON.stringify(phrases)};\n`);

const work = selectProjects(projects, 'work');
const workHtml = work.map((project, index) => {
  const isQuest = project.id === 'qa-quest';
  const link = isQuest ? {url:'#quequest'} : project.links?.find(item => ['demo', 'site', 'course', 'report'].includes(item.type)) || project.links?.[0];
  const shot = isQuest ? {file:'quequest-warehouse-current.png', alt:'Первая смена QueQuest на складе'} : project.shots?.[0];
  const image = shot ? `<img src="../../assets/shots/${esc(shot.file)}" alt="${esc(shot.alt)}" loading="lazy">` : '<span class="catalog-monogram" aria-hidden="true">◎</span>';
  return `<a class="catalog-row" href="${esc(url(link?.url || '#all-work'))}" ${link?.url?.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}><span class="catalog-num">${String(index + 1).padStart(2,'0')}</span><span class="catalog-thumbnail">${isQuest ? '<img src="./assets/quequest-warehouse-current.png" alt="Первая смена QueQuest на складе" loading="lazy">' : image}</span><span class="catalog-title"><small>${esc(project.kicker)}</small><strong>${esc(project.title)}</strong><span>${esc(isQuest ? 'Сначала работа руками, затем автоматизация: Python появляется, когда он нужен игроку.' : project.tagline)}</span></span><span class="catalog-status">${isQuest ? 'В разработке' : 'Кейс'} </span><span class="catalog-arrow" aria-hidden="true">↗</span></a>`;
}).join('\n');
replace('index.html', 'WORK', workHtml);

const exp = site.profile.experience.filter(item => item.show);
replace('index.html', 'RESUME', exp.map(item => `<article class="resume-item"><span>${esc(item.period)}</span><div><h4>${esc(item.org)}</h4><p>${esc(item.role)}</p>${item.org.includes('Инди-студия') ? '<a href="./game-design/">Открыть кейс VitalSchool ↗</a>' : ''}</div></article>`).join('\n'));
replace('index.html', 'SKILLS', site.profile.skills.map(group => `<div class="skill-group"><h4>${esc(group.group)}</h4><p>${group.items.map(esc).join(' · ')}</p></div>`).join('\n'));

const games = selectProjects(projects, 'games');
replace('games.html', 'GAMES', games.map((project, index) => {
  const link = project.links?.find(item => ['play', 'demo'].includes(item.type)) || project.links?.[0];
  const shot = project.shots?.[0];
  const media = shot ? `<img src="../../assets/shots/${esc(shot.file)}" alt="${esc(shot.alt)}" loading="lazy">` : '';
  return `<a class="game-tile" href="${esc(url(link?.url || '#play'))}"><span class="game-tile-image">${media}<span class="game-tile-number">${String(index + 1).padStart(2,'0')}</span></span><span class="game-tile-copy"><small>${esc(project.kicker)} · демо</small><strong>${esc(project.id === 'puzzle-quest' ? 'Матч Квест' : project.title)}</strong><span>${esc(project.tagline)}</span><b>${project.id === 'qa-quest' ? 'Открыть демо курса' : 'Играть'} ↗</b></span></a>`;
}).join('\n'));

replace('stories.html', 'STORIES', stories['сборники'].map(collection => `<section class="collection"><div class="collection-heading"><img src="../../assets/covers/${esc(collection.cover)}" alt="Обложка сборника «${esc(collection.title)}»" loading="lazy"><div><span>${esc(collection.year)} / ${collection.stories.length} историй</span><h3>${esc(collection.title)}</h3><p>${esc(typeof collection['фокус'] === 'string' ? collection['фокус'] : 'Истории из сборника')}</p></div></div><div class="collection-links">${collection.stories.map((story,index) => `<a href="https://aka-gst.ru/rasskazy/${encodeURIComponent(story.slug)}/"><span>${String(index+1).padStart(2,'0')}</span><strong>${esc(story.title)}</strong><span>Читать ↗</span></a>`).join('')}</div></section>`).join('\n'));

console.log(`Generated ${work.length} work entries, ${games.length} games, ${stories['сборники'].reduce((n,collection) => n + collection.stories.length,0)} stories, ${phrases.length} phrases.`);
