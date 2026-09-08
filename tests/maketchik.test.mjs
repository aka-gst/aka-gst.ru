import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBlock, minHeightForLabel, parseScheme, snapshot, wrapLabel } from '../maketchik/core.mjs';

test('подпись сохраняется буквально, вместе с пробелами и пустым значением', () => {
  const state = { title:'x', blocks:[{id:'a',type:'screen',label:'Главная страница сайта',x:0,y:0,w:280,h:132}] };
  assert.equal(parseScheme(snapshot(state)).blocks[0].label, 'Главная страница сайта');
  state.blocks[0].label = 'Главная  страница сайта ';
  assert.equal(parseScheme(snapshot(state)).blocks[0].label, 'Главная  страница сайта ');
  state.blocks[0].label = '';
  assert.equal(parseScheme(snapshot(state)).blocks[0].label, '');
});

test('новый блок создаётся внутри видимой части схемы', () => {
  const b = createBlock('block', 4, {x:400,y:200,width:500,height:300});
  assert.ok(b.x >= 400 && b.y >= 200 && b.x + b.w <= 900 && b.y + b.h <= 500);
});

test('длинная подпись и длинное слово полностью помещаются в экспортную высоту', () => {
  const label = `${'Оченьдлинноесловобезпробелов'.repeat(3)} ${'текст '.repeat(10)}`.slice(0,120);
  const block = {id:'long',type:'block',label,x:10,y:10,w:260,h:92};
  const lines = wrapLabel(label, 20);
  assert.equal(lines.join('').replaceAll(' ',''), label.replaceAll(' ',''));
  assert.ok(minHeightForLabel(block) >= 56 + lines.length * 24);
});

test('повреждённый импорт отклоняется до замены текущей схемы', () => {
  assert.throws(() => parseScheme('{bad json'));
  assert.throws(() => parseScheme({blocks:[{id:'a',type:'block',label:'x',x:'no',y:0,w:10,h:10}]}), /координаты/);
});

test('страница содержит понятную передачу, удаление, отмену и безопасное сохранение', () => {
  const html=readFileSync(new URL('../maketchik/index.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('../maketchik/app.js',import.meta.url),'utf8');
  assert.match(html,/Скачать картинку для просмотра/);
  assert.match(html,/Скачать схему для дальнейших правок/);
  assert.match(html,/автоматически ничего не отправляется/);
  assert.match(html,/Удалить блок/);
  assert.match(html,/Вернуть удалённый блок/);
  assert.match(app,/pointercancel/);
  assert.match(app,/localStorage\.setItem/);
  assert.ok(app.indexOf('localStorage.setItem') < app.indexOf("Сохранено на этом устройстве"));
});

test('публичный путь включён в обе белые выкладки и витрину', () => {
  const deploy=readFileSync(new URL('../deploy.sh',import.meta.url),'utf8');
  const partial=readFileSync(new URL('../tools/vylozhit.sh',import.meta.url),'utf8');
  const data=JSON.parse(readFileSync(new URL('../data/projects.json',import.meta.url),'utf8'));
  assert.match(deploy,/\nmaketchik\n/);
  assert.match(partial,/\bmaketchik\b/);
  assert.ok(data.projects.some((p)=>p.id==='maketchik'&&p.links.some((l)=>l.url==='/maketchik/')));
});
