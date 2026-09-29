#!/usr/bin/env node
// Заглушка карточки годится: она есть, её размер совпадает с кадром петли,
// и она не чёрная.
//
// Почему не стык по PSNR, как было раньше. Мой прежний порог 14 дБ был
// слишком мягким, и Глаза это показали числом: разъехавшаяся арена давала
// 37.8 дБ и проходила, тогда как настоящее совпадение — от 40. То есть мера
// говорила «стык не виден» там, где он был виден человеку. Мои же числа это
// подтверждают задним числом: у заглушек, снятых отдельным кадром, выходило
// 15.8–19.2, а у вырезанной из первого кадра петли — 25.5.
//
// Раз заглушка теперь ВЫРЕЗАЕТСЯ из первого кадра по построению, совпадение
// проверять незачем: его обеспечивает способ изготовления. Проверять надо
// то, что этот способ может испортить, — пустой файл, чёрный кадр, съехавший
// размер.
//
//   node tools/zaglushka-godna.mjs                 все петли витрины
//   node tools/zaglushka-godna.mjs tetcolor mgs    только названные
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const корень = new URL('..', import.meta.url).pathname;
const ПОРОГ_ЯРКОСТИ = 8;     // ниже — кадр практически чёрный

const кадрПетли = (файл) => {
  const из = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0', файл]).toString().trim();
  const [ш, в] = из.split(',').map(Number);
  return { ш, в };
};

const заглушка = (файл) => {
  const из = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0', файл]).toString().trim();
  const [ш, в] = из.split(',').map(Number);
  // Средняя яркость — через ffmpeg signalstats, без гадания по размеру файла.
  let вывод = '';
  try {
    execFileSync('ffmpeg', ['-v', 'info', '-i', файл, '-vf',
      'signalstats,metadata=print:key=lavfi.signalstats.YAVG', '-f', 'null', '-'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { вывод = (e.stderr || '') + (e.stdout || ''); }
  if (!вывод) {
    // ffmpeg пишет метаданные в stderr даже при удачном выходе.
    вывод = execFileSync('sh', ['-c',
      `ffmpeg -v info -i ${JSON.stringify(файл)} -vf signalstats,metadata=print:key=lavfi.signalstats.YAVG -f null - 2>&1`],
      { encoding: 'utf8' });
  }
  const m = (вывод + '').match(/YAVG=([\d.]+)/);
  return { ш, в, яркость: m ? Number(m[1]) : null, байт: statSync(файл).size };
};

const имена = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(join(корень, 'assets/clips'))
      .filter((f) => f.startsWith('clip-') && f.endsWith('.mp4'))
      .map((f) => f.slice(5, -4));

let плохо = 0;
for (const имя of имена) {
  const петля = join(корень, `assets/clips/clip-${имя}.mp4`);
  const кадр = join(корень, `assets/shots/game-${имя}.jpg`);
  if (!existsSync(петля)) { console.log(`  —     ${имя}: петли нет, пропускаю`); continue; }
  if (!existsSync(кадр)) { console.log(`  —     ${имя}: не игровая карточка (нет game-${имя}.jpg), проверяю только игровые`); continue; }
  const п = кадрПетли(петля);
  const з = заглушка(кадр);
  const размерСошёлся = Math.abs(п.ш - з.ш) <= 1 && Math.abs(п.в - з.в) <= 1;
  const светлая = з.яркость !== null && з.яркость >= ПОРОГ_ЯРКОСТИ;
  const ок = размерСошёлся && светлая && з.байт > 2000;
  if (!ок) плохо += 1;
  console.log(`  ${ок ? 'ok  ' : 'ПЛОХО'} ${имя}: петля ${п.ш}x${п.в}, заглушка ${з.ш}x${з.в}` +
    `${размерСошёлся ? '' : ' ← РАЗМЕР НЕ ТОТ'}, яркость ${з.яркость}${светлая ? '' : ` ← ниже ${ПОРОГ_ЯРКОСТИ}, кадр чёрный`}, ${з.байт} байт`);
}
console.log(плохо ? `ПЛОХО: ${плохо}` : 'все заглушки годны');
process.exitCode = плохо ? 1 : 0;
