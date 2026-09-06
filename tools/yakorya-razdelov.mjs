#!/usr/bin/env node
// Якорь на раздел внутри вкладки: ссылка вида /#masterskaya обязана открыть
// свою вкладку и довезти до раздела — даже если у человека запомнена другая.
//
// Написан из дефекта 6 сентября 2026: Сергей открыл /#masterskaya и увидел
// «Игры» — вкладку с прошлого захода. Раздел лежал в скрытой панели, и он
// решил, что Мастерской нет вовсе.
//
// Ловушка, на которой я сам сначала получил зелёное на сломанном: переход
// с / на /#masterskaya — это НЕ загрузка, а смена хеша. Страница не
// перезагружается, вкладка остаётся от прошлого захода, и проверка врёт.
// Поэтому у каждого захода здесь свой ?z=<время>.
//
// Вторая ловушка: у свёрнутого сборника рассказов мерить прокрутку нельзя —
// вся вкладка «Рассказы» ростом в экран, и scrollY 0 там правильный ответ.
// Меряется видимость нужного блока, а не то, что страница уехала.
//
//   node tools/yakorya-razdelov.mjs                  проверить бой
//   node tools/yakorya-razdelov.mjs http://localhost:4180
import { запуститьChrome, подключиться, sleep } from './igrat.mjs';
const база = process.argv[2] || 'https://aka-gst.ru';
const ПОРТ = 9456;
const chrome = запуститьChrome(ПОРТ, '1280,900');
let плохо = 0;
try {
  const send = await подключиться(ПОРТ);
  await send('Page.enable');
  const о = async (e) => (await send('Runtime.evaluate', { returnByValue: true, expression: e })).result.value;
  const загрузить = async (запомнено, хеш) => {
    await send('Page.navigate', { url: база + '/' });
    await sleep(1200);
    await о(`localStorage.setItem('aka-gst:track', ${JSON.stringify(запомнено)})`);
    await send('Page.navigate', { url: `${база}/?z=${Date.now()}${хеш}` });
    await sleep(2200);
  };
  const снять = async () => JSON.parse(await о(`(() => {
    const id = location.hash.slice(1);
    const ц = id ? document.getElementById(id) : null;
    const r = ц && ц.getBoundingClientRect();
    return JSON.stringify({ трек: document.documentElement.dataset.track,
      видно: ц ? !!ц.offsetParent : null,
      наЭкране: r ? (r.top < innerHeight && r.bottom > 0) : null,
      scrollY: Math.round(scrollY) });
  })()`));
  const ждём = async (подпись, запомнено, хеш, трек, видно) => {
    await загрузить(запомнено, хеш);
    const s = await снять();
    const ок = s.трек === трек && (видно === null || s.видно === видно) && (видно !== true || s.наЭкране === true);
    if (!ок) плохо += 1;
    console.log(`  ${ок ? 'ok  ' : 'ПЛОХО'} ${подпись}: трек ${s.трек}, видно ${s.видно}, на экране ${s.наЭкране}, scrollY ${s.scrollY}`);
  };

  console.log('== загрузка по ссылке ==');
  await ждём('запомнена «Игры» + #masterskaya → Работа и раздел виден', 'play', '#masterskaya', 'work', true);
  await ждём('запомнена «Рассказы» + #masterskaya → Работа', 'stories', '#masterskaya', 'work', true);
  await ждём('запомнена «Игры» + #games → остаются Игры', 'play', '#games', 'play', null);
  await ждём('запомнена «Работа» + #games → Игры', 'work', '#games', 'play', null);
  await ждём('запомнена «Игры» + #stories → Рассказы', 'play', '#stories', 'stories', null);
  await загрузить('play', '#story-collection-solyanochka');
  {
    const s = await снять();
    const блок = JSON.parse(await о(`(() => {
      const b = document.querySelector('.story-collections');
      if (!b) return JSON.stringify({ есть: false });
      const r = b.getBoundingClientRect();
      return JSON.stringify({ есть: true, наЭкране: r.top < innerHeight && r.bottom > 0 });
    })()`));
    const ок = s.трек === 'stories' && блок.есть && блок.наЭкране;
    if (!ок) плохо += 1;
    console.log(`  ${ок ? 'ok  ' : 'ПЛОХО'} якорь на СВЁРНУТЫЙ сборник: трек ${s.трек}, полка сборников на экране ${блок.наЭкране}`);
  }
  await ждём('запомнена «Игры» + чепуха в якоре → вкладка не сломалась', 'play', '#takogo-net-12345', 'play', null);

  console.log('== смена хеша без перезагрузки ==');
  await загрузить('play', '#games');
  await о(`location.hash = '#masterskaya'`);
  await sleep(1800);
  const s = await снять();
  const ок = s.трек === 'work' && s.видно === true && s.наЭкране === true;
  if (!ок) плохо += 1;
  console.log(`  ${ок ? 'ok  ' : 'ПЛОХО'} с «Игр» сменили хеш на #masterskaya: трек ${s.трек}, видно ${s.видно}, на экране ${s.наЭкране}`);
  await о(`location.hash = '#games'`);
  await sleep(1200);
  const s2 = JSON.parse(await о(`JSON.stringify({ трек: document.documentElement.dataset.track })`));
  const ок2 = s2.трек === 'play';
  if (!ок2) плохо += 1;
  console.log(`  ${ок2 ? 'ok  ' : 'ПЛОХО'} и обратно на #games: трек ${s2.трек}`);
  send.закрыть();
} finally { chrome.kill(); }
console.log(плохо ? `ПЛОХО: ${плохо}` : 'все исходы сошлись');
process.exitCode = плохо ? 1 : 0;
