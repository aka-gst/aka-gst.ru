const COLORS = ['blue', 'red', 'green'];
const SHAPES = ['square', 'circle'];

function rng(seed) {
  let x = (Number(seed) || 1) >>> 0;
  return () => {
    x += 0x6D2B79F5;
    let t = x;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SORTER_RULES = Object.freeze([
  {
    id: 'not-red', difficulty: 1,
    plain: 'Пропускай всё, кроме красного',
    code: 'box.color != "red"',
    test: box => box.color !== 'red',
  },
  {
    id: 'high-only', difficulty: 1,
    plain: 'Пропускай только срочные',
    code: 'box.priority == "high"',
    test: box => box.priority === 'high',
  },
  {
    id: 'blue-only', difficulty: 1,
    plain: 'Пропускай только синие',
    code: 'box.color == "blue"',
    test: box => box.color === 'blue',
  },
  {
    id: 'fragile-safe', difficulty: 2,
    plain: 'Хрупкие можно, но красные — нет',
    code: 'box.fragile and box.color != "red"',
    test: box => box.fragile && box.color !== 'red',
  },
  {
    id: 'high-blue', difficulty: 2,
    plain: 'Только срочные синие',
    code: 'box.priority == "high" and box.color == "blue"',
    test: box => box.priority === 'high' && box.color === 'blue',
  },
  {
    id: 'green-or-high', difficulty: 3,
    plain: 'Зелёные ИЛИ любые срочные',
    code: 'box.color == "green" or box.priority == "high"',
    test: box => box.color === 'green' || box.priority === 'high',
  },
  {
    id: 'square-safe', difficulty: 3,
    plain: 'Квадратные, если они не красные',
    code: 'box.shape == "square" and box.color != "red"',
    test: box => box.shape === 'square' && box.color !== 'red',
  },
  {
    id: 'not-fragile-or-blue', difficulty: 3,
    plain: 'Не хрупкие ИЛИ синие',
    code: '(not box.fragile) or box.color == "blue"',
    test: box => !box.fragile || box.color === 'blue',
  },
]);

function crateFrom(rand, index) {
  return {
    id: `crate-${index + 1}`,
    color: COLORS[Math.floor(rand() * COLORS.length)],
    shape: SHAPES[Math.floor(rand() * SHAPES.length)],
    fragile: rand() > .55,
    priority: rand() > .58 ? 'high' : 'normal',
  };
}

function distinguishable(target, candidate, crates) {
  return crates.some(box => Boolean(target.test(box)) !== Boolean(candidate.test(box)));
}

export function generateSorterScenario(seed = 1, maxDifficulty = 1) {
  const difficulty = Math.max(1, Math.min(3, Number(maxDifficulty) || 1));
  const rand = rng(seed);
  const available = SORTER_RULES.filter(rule => rule.difficulty <= difficulty);
  const target = available[Math.floor(rand() * available.length)];
  let crates = Array.from({ length: 8 }, (_, index) => crateFrom(rand, index));

  // Ensure the lesson is observable: the correct rule must both pass and hold,
  // and each distractor shown to the player must disagree on at least one box.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const outcomes = crates.map(target.test);
    const useful = outcomes.some(Boolean) && outcomes.some(value => !value);
    const distinctCount = available.filter(rule => rule.id !== target.id && distinguishable(target, rule, crates)).length;
    if (useful && distinctCount >= Math.min(3, available.length - 1)) break;
    crates = Array.from({ length: 8 }, (_, index) => crateFrom(rand, index));
  }

  const distractors = available
    .filter(rule => rule.id !== target.id && distinguishable(target, rule, crates))
    .sort((a, b) => a.id.localeCompare(b.id));
  const offset = Math.floor(rand() * Math.max(1, distractors.length));
  const picked = [];
  for (let i = 0; i < distractors.length && picked.length < 3; i += 1) picked.push(distractors[(offset + i) % distractors.length]);
  const choices = [target, ...picked];
  choices.sort((a, b) => ((a.id.charCodeAt(0) + seed) % 7) - ((b.id.charCodeAt(0) + seed) % 7) || a.id.localeCompare(b.id));

  return { seed, maxDifficulty: difficulty, targetId: target.id, targetPlain: target.plain, crates, choices: choices.map(rule => rule.id) };
}

export function evaluateSorterChoice(scenario, ruleId) {
  const target = SORTER_RULES.find(rule => rule.id === scenario.targetId);
  const selected = SORTER_RULES.find(rule => rule.id === ruleId);
  if (!target || !selected) return { ok:false, correct:false, routes:[] };
  const routes = scenario.crates.map(box => ({
    box,
    expected: target.test(box) ? 'pass' : 'hold',
    actual: selected.test(box) ? 'pass' : 'hold',
  }));
  return {
    ok: true,
    correct: routes.every(route => route.expected === route.actual),
    routes,
    code: selected.code,
    targetCode: target.code,
  };
}

export function getSorterRule(id) {
  return SORTER_RULES.find(rule => rule.id === id) ?? null;
}

function crateNode(route) {
  const node = document.createElement('li');
  node.className = 'sorter-crate';
  node.dataset.color = route.box.color;
  node.dataset.shape = route.box.shape;
  node.dataset.fragile = String(route.box.fragile);
  node.dataset.priority = route.box.priority;
  node.dataset.correct = String(route.expected === route.actual);
  const color = {blue:'СИН', red:'КРАС', green:'ЗЕЛ'}[route.box.color];
  node.innerHTML = `<b>${color}</b><span>${route.box.shape === 'square' ? '□' : '○'} ${route.box.fragile ? 'ХРУП' : 'ОБЫЧ'} ${route.box.priority === 'high' ? '!' : ''}</span>`;
  return node;
}

export function createSorterBay(root, { onSound = () => {}, onSolved = () => {}, onClose = () => {} } = {}) {
  let seed = 41;
  let maxDifficulty = 1;
  let scenario = null;
  let solved = 0;

  const target = root.querySelector('#sorterTarget');
  const source = root.querySelector('#sorterSource');
  const pass = root.querySelector('#sorterPass');
  const hold = root.querySelector('#sorterHold');
  const rules = root.querySelector('#sorterRules');
  const status = root.querySelector('#sorterStatus');
  const code = root.querySelector('#sorterCode');
  const level = root.querySelector('#sorterLevel');
  const streak = root.querySelector('#sorterStreak');

  function routePlaceholder(box) {
    return { box, expected:'source', actual:'source' };
  }

  function renderScenario() {
    scenario = generateSorterScenario(seed, maxDifficulty);
    target.textContent = `ЗАКАЗ: ${scenario.targetPlain}`;
    level.textContent = ['','ЦВЕТ / ОДИН ПРИЗНАК','ДВА УСЛОВИЯ','AND / OR / NOT'][maxDifficulty];
    source.replaceChildren(...scenario.crates.map(box => crateNode(routePlaceholder(box))));
    pass.replaceChildren();
    hold.replaceChildren();
    rules.replaceChildren(...scenario.choices.map(id => {
      const rule = getSorterRule(id);
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.rule = id;
      button.innerHTML = `<strong>${rule.plain}</strong><small>проверить правило</small>`;
      button.addEventListener('click', () => choose(id));
      return button;
    }));
    code.hidden = true;
    code.textContent = '';
    status.dataset.state = 'ready';
    status.textContent = 'Выбери правило и запусти поток. Ошибка ничего не отнимает — ящики просто покажут, где логика не совпала.';
  }

  function choose(id) {
    const result = evaluateSorterChoice(scenario, id);
    if (!result.ok) return;
    source.replaceChildren();
    pass.replaceChildren(...result.routes.filter(route => route.actual === 'pass').map(crateNode));
    hold.replaceChildren(...result.routes.filter(route => route.actual === 'hold').map(crateNode));
    for (const button of rules.querySelectorAll('button')) button.dataset.selected = String(button.dataset.rule === id);
    if (result.correct) {
      solved += 1;
      streak.textContent = `${solved} РЕШЕНО`;
      status.dataset.state = 'success';
      status.textContent = 'ПОТОК ЧИСТЫЙ · правило работает на каждом ящике. Теперь посмотри, как та же мысль выглядит в Python.';
      code.hidden = false;
      code.textContent = `if ${result.targetCode}:\n    sorter.pass_(box)\nelse:\n    sorter.hold(box)`;
      onSound('reward');
      onSolved({ seed, difficulty:maxDifficulty, rule:scenario.targetId });
    } else {
      const wrong = result.routes.filter(route => route.actual !== route.expected).length;
      status.dataset.state = 'error';
      status.textContent = `НЕ СОВПАЛО НА ${wrong} ${wrong === 1 ? 'ЯЩИКЕ' : 'ЯЩИКАХ'} · красная рамка показывает именно контрпример. Меняй правило, не начинай уровень заново.`;
      code.hidden = true;
      onSound('blocked');
    }
  }

  root.querySelector('#sorterNext').addEventListener('click', () => { seed += 1; renderScenario(); onSound('pickup'); });
  root.querySelector('#sorterHarder').addEventListener('click', () => {
    if (maxDifficulty < Number(root.dataset.maxDifficulty || 1)) maxDifficulty += 1;
    else maxDifficulty = 1;
    seed += 7;
    renderScenario();
  });
  root.querySelector('#sorterClose').addEventListener('click', () => { root.hidden = true; onClose(); });

  return {
    open({ maxDifficulty: allowed = 1, seed: nextSeed } = {}) {
      root.dataset.maxDifficulty = String(Math.max(1, Math.min(3, allowed)));
      maxDifficulty = Math.max(1, Math.min(Number(root.dataset.maxDifficulty), maxDifficulty));
      if (Number.isFinite(nextSeed)) seed = nextSeed;
      solved = 0;
      streak.textContent = '0 РЕШЕНО';
      renderScenario();
      root.hidden = false;
      root.querySelector('[data-rule]')?.focus({preventScroll:true});
    },
    close() { root.hidden = true; },
    getState() { return { seed, maxDifficulty, solved, scenario }; },
  };
}
