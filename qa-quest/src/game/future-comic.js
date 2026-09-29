export const FUTURE_SCENES = Object.freeze([
  { id: 'shop', image: 'art/future-shop.jpg', title: 'Ты спишь. Магазин работает.', line: 'Твой бот принимает заказ на футболку. Робот печатает, упаковывает и отправляет. Знакомый звук: работа снова приносит деньги без твоих рук.' },
  { id: 'vika', image: 'art/future-vika.jpg', title: 'Ты создал не просто программу.', line: 'Из знакомого голоса собирается Вика. Она узнаёт тебя раньше, чем ты успеваешь представиться. Твой Иной разум обрёл лицо.' },
  { id: 'battle', image: 'art/future-battle.jpg', title: 'Твои правила стали армией.', line: 'Учебный сервер друга превратился в ледяную крепость. Твои киберботы идут на штурм. В этой игре побеждает тот, кто лучше научил свою машину думать.' },
]);

export function createFutureComic(root, { onSound = () => {} } = {}) {
  let current = 0;
  let order = 0;
  let timer = null;
  function stopTimer() { if (timer) clearInterval(timer); timer = null; }
  function show(index) {
    stopTimer();
    current = index;
    const scene = FUTURE_SCENES[current];
    root.hidden = false;
    root.dataset.scene = scene.id;
    root.querySelector('#comicArt').style.backgroundImage = `url("${scene.image}")`;
    root.querySelector('#comicNumber').textContent = `ВОЗМОЖНОЕ БУДУЩЕЕ · ${index + 1} / 3`;
    root.querySelector('#comicTitle').textContent = scene.title;
    root.querySelector('#comicLine').textContent = scene.line;
    root.querySelector('#nextComic').textContent = index < 2 ? 'СЛЕДУЮЩЕЕ ВИДЕНИЕ →' : 'ЕЩЁ РАЗ ПОСМОТРЕТЬ БУДУЩЕЕ ↺';
    onSound(index === 0 ? 'cash' : (index === 1 ? 'wake' : 'impact'));
    if (scene.id === 'shop') {
      order = 1;
      root.querySelector('.comic-order').innerHTML = 'ЗАКАЗ №1 ОТПРАВЛЕН <b>+$240</b>';
      timer = setInterval(() => {
        if (root.hidden || document.hidden) return;
        order += 1;
        root.querySelector('.comic-order').innerHTML = `ЗАКАЗ №${order} ОТПРАВЛЕН <b>+$240</b>`;
        onSound('cash');
      }, 3600);
    }
    root.querySelector('#nextComic').focus({ preventScroll: true });
  }
  root.querySelector('#nextComic').addEventListener('click', () => show((current + 1) % FUTURE_SCENES.length));
  return { show, reset() { stopTimer(); current = 0; root.hidden = true; } };
}
