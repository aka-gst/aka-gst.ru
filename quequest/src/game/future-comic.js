export const FUTURE_SCENES = Object.freeze([
  { id: 'testing', image: 'tier-testing.jpg', title: 'ЛАБОРАТОРИЯ · ПРОВЕРЯЙ ГИПОТЕЗЫ', line: 'QA Quest остаётся необязательной поздней лабораторией: настоящий Python, воспроизводимые ошибки, тесты и разбор того, почему система сломалась.' },
  { id: 'pythonio', image: 'tier-llm.jpg', title: 'PYTHONIO · РЕАЛЬНЫЙ ГРУЗ', line: 'Файлы, фото, таблицы, email и API становятся теми же потоками, которые ты уже научился читать: вход → функция → развилка → очередь → результат → журнал.' },
  { id: 'systems', image: 'art/future-shop.jpg', title: 'ДАЛЬШЕ ТЫ СТРОИШЬ СИСТЕМЫ', line: 'QueQuest заканчивается не новым списком синтаксиса, а инженерным вопросом: что автоматизировать, где узкое место, что хранить в состоянии, как восстановиться после сбоя и когда безопасно распараллелить работу.' },
]);

export function createFutureComic(root, { onSound = () => {} } = {}) {
  let current = 0;
  function show(index) {
    current = index;
    const scene = FUTURE_SCENES[current];
    root.hidden = false;
    root.dataset.scene = scene.id;
    root.querySelector('#comicArt').style.backgroundImage = `url("${scene.image}")`;
    root.querySelector('#comicNumber').textContent = `ПОСЛЕ QUEQUEST · ${index + 1} / ${FUTURE_SCENES.length}`;
    root.querySelector('#comicTitle').textContent = scene.title;
    root.querySelector('#comicLine').textContent = scene.line;
    root.querySelector('#nextComic').textContent = index < FUTURE_SCENES.length - 1 ? 'СЛЕДУЮЩИЙ ГОРИЗОНТ →' : 'ЕЩЁ РАЗ ↺';
    onSound(index === 0 ? 'wake' : (index === 1 ? 'impact' : 'cash'));
    root.querySelector('#nextComic').focus({ preventScroll: true });
  }
  root.querySelector('#nextComic').addEventListener('click', () => show((current + 1) % FUTURE_SCENES.length));
  return { show, reset() { current = 0; root.hidden = true; } };
}
