/* Мир Zoo: 4 × 4 клетки.

   Мир захватил гриб. Он растёт по камню и по живому, тянет из мира тепло:
   там, где он взялся, стоит сырость, туман и холод, а жители уходят.
   Существа под ним не злые — на них наросло. Бой снимает наросшее и
   возвращает существо себе. Убить тоже можно: быстрее и выгоднее золотом,
   но стоит кармы.

   Тон при этом не ужас: существо должно вызывать желание помочь, а не
   отвращение. Берётся механика захвата, а не боди-хоррор. */

window.ZOO_ELEMENTS = {
  water: { name: 'Вода', beats: 'fire' },
  wind:  { name: 'Ветер', beats: 'water' },
  fire:  { name: 'Огонь', beats: 'wind' },
};

/* Намерение существа видно перед каждым раундом. На каждое есть точный ответ:
   он копит Покой. Неточный сбивает Силу, но покоя не даёт — так и получается
   развилка между «очистить» и «развеять», без единого выбора в меню. */
window.ZOO_INTENTS = {
  strike: { name: 'бросок', answer: 'guard', hint: 'готовится ударить' },
  flee:   { name: 'уход',   answer: 'word',  hint: 'хочет ускользнуть' },
  grow:   { name: 'рост',   answer: 'hit',   hint: 'набирает силу' },
};
window.ZOO_ACTIONS = {
  hit:   { name: 'Удар',   note: 'сбивает Силу' },
  guard: { name: 'Заслон', note: 'держит удар' },
  word:  { name: 'Слово',  note: 'копит Покой' },
};

window.ZOO_ITEMS = {
  lamp:    { name: 'Тусклая лампа', text: 'Горит ровно настолько, чтобы видеть шаг вперёд.' },
  root:    { name: 'Горький корень', text: 'Житель сказал, что от него проясняется в голове.' },
  bell:    { name: 'Треснувший колокольчик', text: 'Звучит глухо, но существа его слышат.' },
  key:     { name: 'Ключ без замка', text: 'Кто-то потерял его раньше, чем нашёл дверь.' },
  water:   { name: 'Чистая вода', text: 'Набрана там, где источник ещё не тронут.' },
  thread:  { name: 'Красная нить', text: 'Ею отмечают путь, чтобы вернуться.' },
};

const creature = (id, name, element, power, text) => ({ id, name, element, power, text });

window.ZOO_WORLD = {
  columns: 4,
  rows: 4,
  start: 1,
  cells: [
    { id: 1, name: 'Порог', element: 'water', clean: true,
      art: { clean: 'assets/place-01-clean.jpg' },
      text: 'Здесь вы очнулись. Единственное место, куда грибница ещё не добралась.',
      npcs: [{ id: 'mauri', name: 'Маури', element: 'wind',
        line: 'Первую жизнь живёшь, что ли? Отсюда не выйти, пока не наберёшь кармы. Иди помогай — другого пути нет.',
        quest: 'q-first' }],
      creatures: [] },

    { id: 2, name: 'Мокрая тропа', element: 'water',
      art: { clean: 'assets/place-02-clean.jpg', infected: 'assets/place-02-infected.jpg' },
      text: 'Тропа уходит в воду. Под ней что-то шевелится и дышит.',
      creatures: [creature('c-toad', 'Раздутая жаба', 'water', 4, 'Кожа под белым пухом. Она была здешней и безобидной.')],
      items: ['water'] },

    { id: 3, name: 'Сухие столбы', element: 'fire',
      art: { clean: 'assets/place-03-clean.jpg', infected: 'assets/place-03-infected.jpg' },
      text: 'Каменные столбы потрескались от жара, которого здесь быть не должно.',
      creatures: [creature('c-ember', 'Уголёк', 'fire', 3, 'Из спины растут сухие рыжие пластины. Мелкое и очень напуганное.')],
      items: ['root'] },

    { id: 4, name: 'Ветреный край', element: 'wind',
      art: { clean: 'assets/place-04-clean.jpg', infected: 'assets/place-04-infected.jpg' },
      text: 'Край обрыва. Ветер несёт обрывки чужих разговоров.',
      creatures: [creature('c-gust', 'Сквозняк', 'wind', 4, 'Раньше разносил семена, теперь разносит споры и сам этого не знает.')],
      npcs: [{ id: 'zina', name: 'Зина', element: 'water',
        line: 'Ходить-то куда? Я привыкла. Но если найдёшь чистую воду — принеси, огород совсем сохнет.',
        quest: 'q-water' }] },

    { id: 5, name: 'Заросшие ступени', element: 'wind',
      art: { clean: 'assets/place-05-clean.jpg', infected: 'assets/place-05-infected.jpg' },
      text: 'Ступени ведут наверх и обрываются в пустоту. У костра сидел житель — теперь его нет.',
      creatures: [Object.assign(creature('c-moth', 'Слепой мотылёк', 'wind', 3, 'Крылья затянуты серой плёнкой. Летит на любой свет, даже на больной.'), { art: { corrupted: 'assets/beast-moth-corrupted.png', calm: 'assets/beast-moth-calm.png' } })],
      items: ['lamp'] },

    { id: 6, name: 'Старый очаг', element: 'fire',
      art: { clean: 'assets/place-06-clean.jpg', infected: 'assets/place-06-infected.jpg' },
      text: 'Очаг давно погас, но камни вокруг тёплые.',
      creatures: [creature('c-cinder', 'Пепельник', 'fire', 5, 'Гриб пророс сквозь угли и держит жар, который его же и сжигает.')],
      npcs: [{ id: 'smith', name: 'Молчаливый кузнец', element: 'fire',
        line: 'Говорить не буду. Принесёшь колокольчик — починю, и он снова будет слышен.',
        quest: 'q-bell' }] },

    { id: 7, name: 'Стоячий пруд', element: 'water',
      art: { clean: 'assets/place-07-clean.jpg', infected: 'assets/place-07-infected.jpg' },
      text: 'Вода не движется совсем. В ней отражается не то небо.',
      creatures: [creature('c-leech', 'Пиявка тумана', 'water', 4, 'Мягкое, набухшее от воды. Тянет не кровь, а решимость.')],
      items: ['bell'] },

    { id: 8, name: 'Пустая площадь', element: 'wind',
      art: { clean: 'assets/place-08-clean.jpg', infected: 'assets/place-08-infected.jpg' },
      text: 'Здесь была ярмарка. Остались только следы от прилавков.',
      creatures: [creature('c-echo', 'Эхо толпы', 'wind', 5, 'Грибница разрослась по всей площади и повторяет то, что здесь кричали.')],
      npcs: [{ id: 'child', name: 'Потерявшийся', element: 'wind',
        line: 'Я не помню дороги домой. У меня была красная нить, но она порвалась.',
        quest: 'q-thread' }] },

    { id: 9, name: 'Корни', element: 'water',
      art: { clean: 'assets/place-09-clean.jpg', infected: 'assets/place-09-infected.jpg' },
      text: 'Корни огромного дерева выходят из земли и уходят обратно.',
      creatures: [creature('c-knot', 'Узел', 'water', 5, 'Корни и белые нити срослись так, что уже не разобрать, где чьё.')],
      items: ['thread'] },

    { id: 10, name: 'Горелый склон', element: 'fire',
      art: { clean: 'assets/place-10-clean.jpg', infected: 'assets/place-10-infected.jpg' },
      text: 'Склон выжжен ровными полосами, будто кто-то писал.',
      creatures: [creature('c-scorch', 'Ожог', 'fire', 6, 'Обугленная шляпка вместо головы. Помнит только боль и повторяет её.')] },

    { id: 11, name: 'Колодец', element: 'water',
      art: { clean: 'assets/place-11-clean.jpg', infected: 'assets/place-11-infected.jpg' },
      text: 'Глубокий колодец. Снизу тянет холодом и тихим гулом.',
      creatures: [creature('c-well', 'Голос из колодца', 'water', 6, 'Со стенок свисает бахрома. Зовёт по имени, которого вы не называли.')],
      items: ['key'] },

    { id: 12, name: 'Смотровая', element: 'wind',
      art: { clean: 'assets/place-12-clean.jpg', infected: 'assets/place-12-infected.jpg' },
      text: 'Отсюда виден весь этот мир. Он меньше, чем казался.',
      creatures: [creature('c-watcher', 'Смотрящий', 'wind', 6, 'Оброс наростами по всей спине. Следит за всеми и оттого ослеп.')],
      npcs: [{ id: 'keeper', name: 'Хранитель вида', element: 'wind',
        line: 'Я считаю очищенные места. Когда их станет довольно — покажу, где выход.',
        quest: 'q-clean' }] },

    { id: 13, name: 'Тихий двор', element: 'water',
      art: { clean: 'assets/place-13-clean.jpg', infected: 'assets/place-13-infected.jpg' },
      text: 'Двор, где ничего не случилось. Именно это и странно.',
      creatures: [creature('c-hollow', 'Пустота двора', 'water', 6, 'Плесень затянула двор ровным слоем. Отсутствие стало присутствием.')] },

    { id: 14, name: 'Кузня', element: 'fire',
      art: { clean: 'assets/place-14-clean.jpg', infected: 'assets/place-14-infected.jpg' },
      text: 'Горн холодный, но инструменты разложены так, будто мастер вышел на минуту.',
      creatures: [creature('c-anvil', 'Наковальня без кузнеца', 'fire', 7, 'Гриб держит молот. Бьёт сама себя, потому что привыкла.')] },

    { id: 15, name: 'Мост', element: 'wind',
      art: { clean: 'assets/place-15-clean.jpg', infected: 'assets/place-15-infected.jpg' },
      text: 'Мост через то, чего не видно. Идти по нему придётся на слух.',
      creatures: [creature('c-doubt', 'Сомнение', 'wind', 7, 'Нити тянутся с обоих концов моста. Право ровно наполовину, и в этом беда.')] },

    { id: 16, name: 'Ворота', element: 'fire',
      art: { clean: 'assets/place-16-clean.jpg', infected: 'assets/place-16-infected.jpg' },
      text: 'Ворота домой. Заперты не замком, а тем, что вы ещё не сделали.',
      creatures: [creature('c-warden', 'Привратник', 'fire', 8, 'Первый, на ком это выросло. Тот, от кого пошли все остальные.')] },
  ],

  quests: {
    'q-first':  { title: 'Первый шаг', giver: 'mauri', cell: 1,
      text: 'Маури говорит: очисти любое заражённое место, и станет понятнее.',
      need: { cleansed: 1 }, reward: { karma: 2, gold: 10 } },
    'q-water':  { title: 'Огород Зины', giver: 'zina', cell: 4,
      text: 'Принести Зине чистую воду с Мокрой тропы.',
      need: { item: 'water' }, reward: { karma: 3, gold: 15, ally: 'zina' } },
    'q-bell':   { title: 'Треснувший колокольчик', giver: 'smith', cell: 6,
      text: 'Кузнец починит колокольчик, если его принести. Со Стоячего пруда.',
      need: { item: 'bell' }, reward: { karma: 2, gold: 20, item: 'bell', ally: 'smith' } },
    'q-thread': { title: 'Красная нить', giver: 'child', cell: 8,
      text: 'Найти нить у Корней и вернуть потерявшемуся.',
      need: { item: 'thread' }, reward: { karma: 4, gold: 10, ally: 'child' } },
    'q-clean':  { title: 'Счёт хранителя', giver: 'keeper', cell: 12,
      text: 'Хранитель покажет выход, когда очищено будет шесть мест.',
      need: { cleansed: 6 }, reward: { karma: 6, gold: 40, ally: 'keeper' } },
  },
};
