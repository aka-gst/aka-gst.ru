/*
 * Живая машина на первом экране.
 *
 * Человек, который никогда не писал кода, читает «код запускается прямо на
 * странице» и не верит: это просто слова на сайте. Здесь он набирает ping car
 * и видит, как моргнули фары. Дальше объяснять не нужно — обещание уже
 * выполнено, до всякого питона.
 *
 * Машина нарисована вектором прямо здесь, а не картинкой: картинка не умеет
 * открывать двери. Всё, что меняется, — это классы на группах.
 */

import { el } from './dom.js';
import { activeTheme } from '../content/themes.js';

export const CAR = `
<svg viewBox="0 0 340 150" role="img" aria-label="Машина сбоку: фары, двери и багажник откликаются на команды">
  <defs>
    <linearGradient id="pc-body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1d2b38"/><stop offset="1" stop-color="#0e1922"/>
    </linearGradient>
  </defs>
  <g class="pc-shadow"><ellipse cx="170" cy="128" rx="140" ry="9"/></g>

  <g class="pc-body">
    <path d="M28 104 L34 78 Q40 62 62 60 L112 56 Q130 34 168 33 Q208 32 228 55 L286 63 Q308 68 312 84 L314 104 Z" fill="url(#pc-body)"/>
    <path d="M118 56 Q134 40 166 39 L168 57 Z" class="pc-glass"/>
    <path d="M176 39 Q206 40 222 57 L176 57 Z" class="pc-glass"/>
  </g>

  <!-- Багажник: крышка поворачивается вокруг своей петли -->
  <g class="pc-trunk">
    <path d="M228 55 L286 63 Q308 68 312 84 L300 84 Q294 72 280 70 L228 62 Z"/>
  </g>

  <!-- Двери: обе распахиваются наружу от стойки -->
  <g class="pc-door pc-door-front"><path d="M112 58 L168 58 L168 100 L112 100 Z"/><circle cx="160" cy="79" r="2.4"/></g>
  <g class="pc-door pc-door-rear"><path d="M172 58 L226 58 L226 100 L172 100 Z"/><circle cx="180" cy="79" r="2.4"/></g>

  <g class="pc-lamp pc-lamp-front"><ellipse cx="30" cy="88" rx="9" ry="6"/></g>
  <g class="pc-lamp pc-lamp-rear"><ellipse cx="311" cy="88" rx="7" ry="5"/></g>
  <g class="pc-beam"><path d="M22 88 L-70 62 L-70 116 Z"/></g>

  <g class="pc-wheel"><circle cx="92" cy="106" r="21"/><circle cx="92" cy="106" r="9" class="pc-hub"/></g>
  <g class="pc-wheel"><circle cx="256" cy="106" r="21"/><circle cx="256" cy="106" r="9" class="pc-hub"/></g>

  <!-- Поворотник: моргает по одному разу на каждую напечатанную строку -->
  <g class="pc-signal"><circle cx="62" cy="92" r="4.5"/></g>

  <!-- Проекция на лобовое: сюда выводится то, что напечатала программа -->
  <g class="pc-hud">
    <path d="M150 33 L150 24" class="pc-hud-ray"/>
    <rect x="24" y="4" width="292" height="19" rx="5"/>
    <text x="34" y="17">—</text>
  </g>
</svg>`;


/*
 * Сцена истории про сеть. Классы намеренно те же, что у машины: вся логика
 * консоли и стенда написана против них, и вторая история получает всё
 * сделанное для первой бесплатно. Меняется то, чем управляешь, — не механизм.
 *
 * Робота в комнате здесь быть не может: в сети нет предметов. Поэтому «бот» —
 * это узел с отростками связи, существо из линий и света, а щит перед ним —
 * та самая программа-лёд, которую человек в финале напишет сам.
 */
export const NET = `
<svg viewBox="0 0 340 150" role="img" aria-label="Узел сети: связь, порты и щит откликаются на команды">
  <g class="pc-shadow"><ellipse cx="170" cy="132" rx="120" ry="7"/></g>

  <!-- Линия связи, по которой уходят пакеты -->
  <g class="pc-beam"><path d="M6 84 L120 84 L120 90 L6 90 Z"/></g>
  <g class="pc-body">
    <path d="M118 60 L170 34 L222 60 L222 106 L170 132 L118 106 Z" class="pc-core"/>
    <path d="M170 34 L170 132" class="pc-thread"/>
    <path d="M118 60 L222 106 M222 60 L118 106" class="pc-thread"/>
    <circle cx="170" cy="83" r="13" class="pc-glass"/>
  </g>

  <!-- Отростки связи: расходятся, когда узел открыт -->
  <g class="pc-door pc-door-front"><path d="M112 66 L64 52 L64 60 L112 74 Z"/><circle cx="64" cy="56" r="3"/></g>
  <g class="pc-door pc-door-rear"><path d="M228 66 L276 52 L276 60 L228 74 Z"/><circle cx="276" cy="56" r="3"/></g>

  <!-- Щит: та самая программа-лёд перед узлом -->
  <g class="pc-trunk"><path d="M236 48 L300 66 L300 104 L236 122 Z"/></g>

  <g class="pc-lamp pc-lamp-front"><ellipse cx="128" cy="118" rx="7" ry="5"/></g>
  <g class="pc-lamp pc-lamp-rear"><ellipse cx="212" cy="118" rx="6" ry="4"/></g>

  <g class="pc-signal"><circle cx="102" cy="87" r="4.5"/></g>

  <g class="pc-hud">
    <path d="M170 32 L170 24" class="pc-hud-ray"/>
    <rect x="24" y="4" width="292" height="19" rx="5"/>
    <text x="34" y="17">—</text>
  </g>
</svg>`;

/** Сцена выбранной истории. */
export function scene() {
  return activeTheme().id === 'garage' ? CAR : NET;
}

/*
 * Разбор команды. Принимаем и человеческое слово, и настоящий питоновский
 * вызов — тот самый, который человек напишет в финале ночи:
 *   send({"cmd": "enable", "what": "lights"})
 * Кнопки-подсказки подставляют именно вызов, а не слово: пусть первое, что
 * человек увидит в терминале, будет кодом, а не игрой в слова.
 */
/*
 * Слова у историй разные, механика одна. Классы на сцене общие (lights, doors,
 * trunk), поэтому вторая история не потребовала ни строчки новой логики — она
 * потребовала словаря.
 */
const VOICE = {
  garage: {
    head: 'ПОПРОБУЙ ПРЯМО СЕЙЧАС',
    sub: 'машина настоящая, не видео',
    greet: '> шина слушает. напиши ping car',
    placeholder: 'ping car',
    words: { lights: ['фары включены', 'фары выключены'], doors: ['двери открыты', 'двери закрыты'], trunk: ['багажник открыт', 'багажник закрыт'] },
    pong: 'PONG · блок отвечает, 14 мс',
    hints: [['пинг', 'ping'], ['фары', 'lights'], ['двери', 'doors'], ['багажник', 'trunk']],
  },
  ice: {
    head: 'ПОПРОБУЙ ПРЯМО СЕЙЧАС',
    sub: 'узел настоящий, не видео',
    greet: '> узел слушает. напиши ping node',
    placeholder: 'ping node',
    words: { lights: ['связь поднята', 'связь опущена'], doors: ['порты открыты', 'порты закрыты'], trunk: ['щит снят', 'щит поставлен'] },
    pong: 'PONG · узел отвечает, 9 мс',
    hints: [['пинг', 'ping'], ['связь', 'link'], ['порты', 'ports'], ['щит', 'shield']],
  },
};

const voice = () => VOICE[activeTheme().id] || VOICE.garage;

export const SNIPPETS = {
  ping: 'send({"cmd": "ping"})',
  lights: 'send({"cmd": "enable", "what": "lights"})',
  doors: 'send({"cmd": "unlock", "what": "doors"})',
  trunk: 'send({"cmd": "open", "what": "trunk"})',
  link: 'send({"cmd": "enable", "what": "link"})',
  ports: 'send({"cmd": "unlock", "what": "ports"})',
  shield: 'send({"cmd": "open", "what": "shield"})',
};

/*
 * Обратные команды. Кнопка всегда подставляла включение, и второе нажатие
 * отвечало тем же «фары включены» — выглядело так, будто отклика нет. Теперь
 * кнопка смотрит на текущее состояние и подставляет противоположный вызов:
 * человек видит в консоли обе формы, enable и disable, а не одну.
 */
export const SNIPPETS_OFF = {
  lights: 'send({"cmd": "disable", "what": "lights"})',
  doors: 'send({"cmd": "lock", "what": "doors"})',
  trunk: 'send({"cmd": "close", "what": "trunk"})',
  link: 'send({"cmd": "disable", "what": "link"})',
  ports: 'send({"cmd": "lock", "what": "ports"})',
  shield: 'send({"cmd": "close", "what": "shield"})',
};

/** Какой класс на сцене отвечает за кнопку: у связи и фар он один и тот же. */
const CLASS_OF = { lights: 'lights', link: 'lights', doors: 'doors', ports: 'doors', trunk: 'trunk', shield: 'trunk' };

const TARGET = [
  ['ping', /\bping\b|\bпинг\b/i],
  ['lights', /\blights?\b|\blink\b|\bфар|\bсвяз/i],
  ['doors', /\bdoors?\b|\bports?\b|\bunlock\b|\bдвер|\bпорт/i],
  ['trunk', /\btrunk\b|\bboot\b|\bshield\b|\bбагажник|\bщит/i],
];
const OFF = /\boff\b|\bdisable\b|\bclose\b|\block\b|\bвыкл|\bзакр/i;

function parse(text, car) {
  const found = TARGET.find(([, re]) => re.test(text));
  if (!found) return null;
  const [what] = found;
  if (what === 'ping') {
    blink(car);
    return voice().pong;
  }
  const off = OFF.test(text);
  car.classList.toggle(what, !off);
  const words = voice().words[what];
  return off ? words[1] : words[0];
}

function blink(car) {
  car.classList.add('lights');
  setTimeout(() => car.classList.remove('lights'), 260);
  setTimeout(() => car.classList.add('lights'), 460);
  setTimeout(() => car.classList.remove('lights'), 720);
}

/**
 * Возвращает виджет или null, если у истории нет машины. Молча ничего не
 * ломает: экран собран так, что null просто не добавляется.
 */
export function carConsole() {
  const v = voice();
  const stage = el('div', { class: 'pc-stage' });
  stage.innerHTML = scene();
  const car = stage.querySelector('svg');

  const log = el('div', { class: 'pc-log' }, [
    el('p', { text: v.greet }),
  ]);

  /*
   * В журнале видно и команду, и ответ — как в настоящем терминале. Раньше
   * писался только ответ, и нажатие кнопки выглядело так, будто отклик берётся
   * ниоткуда: человек не видел, какой код ушёл. А ради этого всё и затевалось.
   */
  /*
   * Строки набираются по букве, а не появляются целиком. Это не украшение:
   * мгновенная строка читается как картинка, набираемая — как ответ живого
   * устройства, и человек успевает заметить, что команда и отклик разные вещи.
   * Очередь нужна, потому что команда и ответ приходят подряд: без неё они
   * набирались бы одновременно и мешали друг другу.
   */
  const queue = [];
  let printing = false;

  const drain = () => {
    const item = queue.shift();
    if (!item) { printing = false; return; }
    printing = true;
    const line = el('p', { class: item.cls });
    log.append(line);
    while (log.children.length > 5) log.firstChild.remove();
    let i = 0;
    const tick = setInterval(() => {
      line.textContent = item.text.slice(0, i += 1);
      if (i < item.text.length) return;
      clearInterval(tick);
      setTimeout(drain, 140);
    }, 16);
  };

  const push = (text, cls) => {
    queue.push({ text, cls });
    if (!printing) drain();
  };
  const echo = (cmd) => push(`> ${cmd}`, 'cmd');
  const say = (text, ok) => push(`  ${text}`, ok ? 'ok' : 'bad');

  const input = el('input', {
    type: 'text', class: 'pc-input', placeholder: v.placeholder,
    autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
    'aria-label': 'Команда машине',
  });

  const send = () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    echo(text);
    const answer = parse(text, car);
    say(answer || `не понял. Попробуй ${SNIPPETS.ping}`, Boolean(answer));
  };

  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') send(); });

  const wrap = el('div', { class: 'pc-wrap panel' }, [
    el('div', { class: 'pc-head' }, [
      el('span', { text: v.head }),
      el('small', { text: v.sub }),
    ]),
    stage,
    log,
    el('div', { class: 'pc-row' }, [
      input,
      el('button', { type: 'button', class: 'pc-send', onclick: send }, 'Отправить'),
    ]),
    el('div', { class: 'pc-hints' }, v.hints.map(([label, key]) => el('button', {
      type: 'button', class: 'pc-hint', title: SNIPPETS[key],
      onclick: () => {
        stopIdle();
        // Смотрим, в каком состоянии сейчас железо, и шлём обратную команду.
        const cls = CLASS_OF[key];
        const on = cls && car.classList.contains(cls);
        input.value = on ? SNIPPETS_OFF[key] : SNIPPETS[key];
        send();
        input.focus();
      },
    }, label))),
  ]);

  /*
   * Пока человек ничего не трогает, шина живёт сама: раз в несколько секунд в
   * строку набирается команда и машина откликается. Иначе первый экран стоит
   * мёртвым, и большинство просто не догадается, что здесь можно что-то
   * набрать. Как только человек тронул поле — самовольство прекращается: он
   * пришёл сам, мешать ему нечего.
   */
  const DEMO = v.hints.flatMap(([, key]) => (
    SNIPPETS_OFF[key] ? [SNIPPETS[key], SNIPPETS_OFF[key]] : [SNIPPETS[key]]
  ));
  let demoStep = 0;
  let idleTimer = null;
  let typing = null;

  function stopIdle() {
    clearTimeout(idleTimer);
    clearInterval(typing);
    idleTimer = null;
    typing = null;
    input.classList.remove('auto');
  }

  function typeOut(code, done) {
    input.classList.add('auto');
    input.value = '';
    let i = 0;
    typing = setInterval(() => {
      input.value = code.slice(0, i += 2);
      if (i < code.length) return;
      clearInterval(typing);
      typing = null;
      setTimeout(() => { input.classList.remove('auto'); done(); }, 320);
    }, 26);
  }

  function idleTick() {
    if (document.hidden || !wrap.isConnected) {
      idleTimer = setTimeout(idleTick, 4000);
      return;
    }
    typeOut(DEMO[demoStep++ % DEMO.length], () => {
      send();
      idleTimer = setTimeout(idleTick, 5200);
    });
  }

  ['focus', 'keydown', 'pointerdown'].forEach((event) => input.addEventListener(event, stopIdle));
  idleTimer = setTimeout(idleTick, 2600);

  return wrap;
}
