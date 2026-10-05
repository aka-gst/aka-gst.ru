const GLYPHS = Object.freeze({
  '0a':['01110','10001','10001','10001','01110'],
  '0c':['01110','10001','10001','10011','01110'],
  '0d':['01110','11001','10001','10001','01110'],
  '0e':['01110','10001','10101','10001','01110'],
  '1a':['00100','01100','00100','00100','01110'],
  '1c':['01100','00100','00100','00100','01110'],
  '1d':['00100','01100','00100','00100','00110'],
  '1e':['00100','00100','00100','00100','01110'],
  '7a':['11111','00010','00100','01000','01000'],
  '7c':['11110','00010','00100','01000','01000'],
  '7d':['11111','00010','00100','00100','01000'],
  '7e':['11111','00001','00010','00100','00100'],
});

const EVAL_IDS = Object.freeze(['0c','1c','7c','0d','1d','7d','0e','1e','7e']);
const BASE_TRAINING = Object.freeze([
  { id:'0a', label:'0' },
  { id:'1a', label:'1' },
]);

export const AI_KNN_SOURCE = `def distance(a, b):
    return sum(x != y for x, y in zip(a, b))

def predict(sample, training):
    nearest = min(training, key=lambda row: distance(sample, row["pixels"]))
    return nearest["label"]

# feedback = новый размеченный пример
training.append({"pixels": hard_sample, "label": "7"})`;

export const AI_REWARD_SOURCE = `value = values[state][action]
values[state][action] += 0.5 * (reward - value)

# reward = +1 закрепляет действие
# reward = -1 ослабляет его
# следующая попытка выбирает действие с лучшей оценкой`;

const COACH_STATES = Object.freeze([
  { id:'red', title:'КРАСНЫЙ ГРУЗ', copy:'Бот видит груз, который нельзя нести на обычную палету.', actions:['MOVE','INSPECT','SKIP'], correct:'SKIP' },
  { id:'backlog', title:'ОЧЕРЕДЬ РАСТЁТ', copy:'INPUT 4/s, один worker успевает 2/s.', actions:['BUFFER','SOURCE+','WORKER+'], correct:'WORKER+' },
  { id:'ledger', title:'ОБЩАЯ ЗАПИСЬ', copy:'Два worker-а одновременно меняют один ledger.', actions:['WORKER+','SLEEP','LOCK'], correct:'LOCK' },
]);

function vector(id) {
  return GLYPHS[id].flatMap((row) => [...row].map(Number));
}

export function hammingDistance(a, b) {
  return a.reduce((sum, value, index) => sum + (value !== b[index] ? 1 : 0), 0);
}

export function predictNearest(id, training) {
  const sample = vector(id);
  if (!training.length) return null;
  return training
    .map((row, index) => ({ ...row, distance: hammingDistance(sample, vector(row.id)), index }))
    .sort((a,b) => a.distance - b.distance || a.index - b.index)[0].label;
}

export function evaluateTraining(training) {
  const rows = EVAL_IDS.map((id) => {
    const truth = id[0];
    const predicted = predictNearest(id, training);
    return { id, truth, predicted, ok: truth === predicted };
  });
  const correct = rows.filter((row) => row.ok).length;
  return { rows, correct, total: rows.length, accuracy: correct / rows.length };
}

export function updateActionValue(value, reward, alpha = .5) {
  return value + alpha * (reward - value);
}

function setText(root, selector, text) {
  const node = root.querySelector(selector);
  if (node) node.textContent = text;
}

function drawGlyph(node, id) {
  node.replaceChildren();
  for (const bit of vector(id)) {
    const cell = document.createElement('i');
    cell.dataset.on = String(bit === 1);
    node.append(cell);
  }
}

export function createAiLab(root, { onComplete = () => {}, onSound = () => {}, onCheckpoint = () => {} } = {}) {
  let training = [];
  let firstEval = null;
  let secondEval = null;
  let coachIndex = 0;
  let coachChoice = null;
  let values = {};
  let complete = false;

  const stage = root.querySelector('#aiLabStage');
  const evalGrid = root.querySelector('#aiEvalGrid');
  const trainGrid = root.querySelector('#aiTrainingGrid');
  const correction = root.querySelector('#aiCorrection');
  const coach = root.querySelector('#aiCoach');
  const reveal = root.querySelector('#aiCodeReveal');
  const continueButton = root.querySelector('#aiContinue');

  function makeSample(id, label, kind = 'train') {
    const card = document.createElement('div');
    card.className = 'ai-sample';
    card.dataset.kind = kind;
    const pixels = document.createElement('div');
    pixels.className = 'ai-pixels';
    drawGlyph(pixels, id);
    const tag = document.createElement('strong');
    tag.textContent = label;
    card.append(pixels, tag);
    return card;
  }

  function paintTraining() {
    trainGrid.replaceChildren();
    for (const row of training) trainGrid.append(makeSample(row.id, `LABEL ${row.label}`));
    setText(root, '#aiMemoryCount', `${training.length} примера в памяти`);
  }

  function paintEval(result) {
    evalGrid.replaceChildren();
    for (const row of result.rows) {
      const card = makeSample(row.id, `${row.predicted ?? '?'} ${row.ok ? '✓' : '×'}`, 'eval');
      card.dataset.result = row.ok ? 'ok' : 'error';
      card.title = `Истина: ${row.truth}; модель: ${row.predicted ?? '?'}`;
      evalGrid.append(card);
    }
    setText(root, '#aiAccuracy', `${result.correct}/${result.total} · ${Math.round(result.accuracy * 100)}%`);
    root.querySelector('#aiAccuracyBar').style.width = `${Math.round(result.accuracy * 100)}%`;
  }

  function reset() {
    training = BASE_TRAINING.map((row) => ({...row}));
    firstEval = null;
    secondEval = null;
    coachIndex = 0;
    coachChoice = null;
    values = Object.fromEntries(COACH_STATES.map((state) => [state.id, Object.fromEntries(state.actions.map((action) => [action, 0]))]));
    complete = false;
    root.hidden = true;
    stage.dataset.step = 'briefing';
    delete stage.dataset.result;
    correction.hidden = true;
    coach.hidden = true;
    reveal.hidden = true;
    continueButton.hidden = true;
    root.querySelector('#aiStart').hidden = false;
    root.querySelector('#aiRunEval').hidden = true;
    root.querySelector('#aiRunEval2').hidden = true;
    root.querySelector('#aiOpenCoach').hidden = true;
    evalGrid.replaceChildren();
    root.querySelector('#aiAccuracyBar').style.width = '0%';
    setText(root, '#aiAccuracy', 'ещё не измерена');
    setText(root, '#aiLabOutput', 'У модели нет магии: сначала ей нужны примеры. В памяти пока только цифры 0 и 1.');
    paintTraining();
  }

  function begin() {
    onCheckpoint('started');
    root.querySelector('#aiStart').hidden = true;
    root.querySelector('#aiRunEval').hidden = false;
    stage.dataset.step = 'evaluate';
    setText(root, '#aiPhase', '1 · TRAINING DATA → PREDICT → EVAL');
    setText(root, '#aiLabOutput', 'Запусти проверку на новых символах. Модель ищет ближайший известный рисунок по отличающимся пикселям.');
    onSound('power');
  }

  function runFirstEval() {
    firstEval = evaluateTraining(training);
    paintEval(firstEval);
    root.querySelector('#aiRunEval').hidden = true;
    correction.hidden = false;
    stage.dataset.step = 'feedback';
    setText(root, '#aiPhase', '2 · ОШИБКА = НОВЫЕ ДАННЫЕ');
    setText(root, '#aiLabOutput', `Точность ${Math.round(firstEval.accuracy * 100)}%. Все варианты 7 модель вынуждена спутать с уже известными классами: в training data ни одной семёрки.`);
    onSound('blocked');
  }

  function labelCorrection(label) {
    if (label !== '7') {
      stage.dataset.result = 'retry';
      setText(root, '#aiLabOutput', `Ты дал hard sample метку ${label}. Это тоже обучение — но неверная разметка закрепила бы ошибку. Посмотри на пиксели и исправь label.`);
      onSound('blocked');
      return;
    }
    stage.dataset.result = 'success';
    training.push({ id:'7a', label:'7' });
    paintTraining();
    correction.hidden = true;
    root.querySelector('#aiRunEval2').hidden = false;
    setText(root, '#aiLabOutput', '✓ В память добавлен первый пример класса 7. Теперь это не правило в коде — это новый размеченный опыт модели.');
    onSound('reward');
  }

  function runSecondEval() {
    secondEval = evaluateTraining(training);
    paintEval(secondEval);
    root.querySelector('#aiRunEval2').hidden = true;
    root.querySelector('#aiOpenCoach').hidden = false;
    stage.dataset.step = 'improved';
    setText(root, '#aiPhase', '3 · DATASET ИЗМЕНИЛ ПОВЕДЕНИЕ');
    setText(root, '#aiLabOutput', `Точность выросла с ${Math.round(firstEval.accuracy*100)}% до ${Math.round(secondEval.accuracy*100)}%. Код алгоритма тот же; изменилась память примеров.`);
    onSound('reward');
  }

  function bestAction(state) {
    const stateValues = values[state.id];
    return state.actions.reduce((best, action) => stateValues[action] > stateValues[best] ? action : best, state.actions[0]);
  }

  function paintCoach() {
    const state = COACH_STATES[coachIndex];
    if (!state) return finishCoach();
    coachChoice = bestAction(state);
    setText(root, '#aiCoachRound', `${coachIndex + 1}/${COACH_STATES.length} · HUMAN FEEDBACK`);
    setText(root, '#aiCoachScenario', state.title);
    setText(root, '#aiCoachCopy', state.copy);
    setText(root, '#aiCoachChoice', coachChoice);
    const bars = root.querySelector('#aiValueBars');
    bars.replaceChildren();
    for (const action of state.actions) {
      const value = values[state.id][action];
      const row = document.createElement('div');
      row.innerHTML = `<span>${action}</span><i style="--v:${Math.round((value + 1) * 50)}%"></i><b>${value.toFixed(2)}</b>`;
      row.dataset.best = String(action === coachChoice);
      bars.append(row);
    }
  }

  function openCoach() {
    root.querySelector('#aiOpenCoach').hidden = true;
    coach.hidden = false;
    stage.dataset.step = 'coach';
    setText(root, '#aiPhase', '4 · ТЕПЕРЬ ТЫ НЕ ДАЁШЬ LABEL — ТЫ ДАЁШЬ REWARD');
    setText(root, '#aiLabOutput', 'Бот сам выбирает действие. 👍 усиливает выбранное действие, 👎 ослабляет. Если похвалить ошибку — она станет привычкой.');
    paintCoach();
  }

  function feedback(reward) {
    const state = COACH_STATES[coachIndex];
    if (!state || !coachChoice) return;
    const correctFeedback = (coachChoice === state.correct && reward > 0) || (coachChoice !== state.correct && reward < 0);
    values[state.id][coachChoice] = updateActionValue(values[state.id][coachChoice], reward);
    if (!correctFeedback) {
      stage.dataset.result = 'retry';
      setText(root, '#aiLabOutput', reward > 0
        ? `Ты усилил ${coachChoice}. Бот не знает, что это ошибка: reward для него и есть сигнал качества. Исправь обратную связь.`
        : `${coachChoice} был правильным действием, но получил отрицательный reward. Его оценка упала — это видно на шкале.`);
      onSound('blocked');
      paintCoach();
      return;
    }
    if (coachChoice === state.correct && reward > 0) {
      stage.dataset.result = 'success';
      coachIndex += 1;
      onSound('reward');
      setText(root, '#aiLabOutput', `✓ ${state.correct} получил положительный reward. Переходим к следующему состоянию.`);
      paintCoach();
      return;
    }
    stage.dataset.result = 'success';
    onSound('scan');
    setText(root, '#aiLabOutput', `✓ ${coachChoice} ослаблен. На следующей попытке бот выберет действие с более высокой оценкой.`);
    paintCoach();
  }

  function finishCoach() {
    coach.hidden = true;
    reveal.hidden = false;
    continueButton.hidden = false;
    root.querySelector('#aiKnnCode').textContent = AI_KNN_SOURCE;
    root.querySelector('#aiRewardCode').textContent = AI_REWARD_SOURCE;
    stage.dataset.step = 'won';
    complete = true;
    setText(root, '#aiPhase', '5 · МОДЕЛЬ = ДАННЫЕ + ПРАВИЛО ОБНОВЛЕНИЯ + EVAL');
    setText(root, '#aiLabOutput', 'Ты увидел два разных способа обучения: supervised label меняет набор примеров, reward меняет ценность действий. В обоих случаях качество нужно проверять отдельно.');
    onCheckpoint('complete');
    onSound('reward');
  }

  root.querySelector('#aiStart').addEventListener('click', begin);
  root.querySelector('#aiRunEval').addEventListener('click', runFirstEval);
  root.querySelector('#aiRunEval2').addEventListener('click', runSecondEval);
  root.querySelector('#aiOpenCoach').addEventListener('click', openCoach);
  for (const button of root.querySelectorAll('[data-ai-label]')) button.addEventListener('click', () => labelCorrection(button.dataset.aiLabel));
  root.querySelector('#aiRewardGood').addEventListener('click', () => feedback(1));
  root.querySelector('#aiRewardBad').addEventListener('click', () => feedback(-1));
  continueButton.addEventListener('click', () => { root.hidden = true; onComplete({ accuracy: secondEval?.accuracy ?? 0, feedbackRounds: COACH_STATES.length }); });

  reset();
  return {
    open({resume=false} = {}) { reset(); root.hidden = false; if (resume) begin(); root.querySelector('#aiStart').focus({preventScroll:true}); },
    reset,
    snapshot() { return { training:[...training], firstEval, secondEval, coachIndex, values:JSON.parse(JSON.stringify(values)), complete }; },
  };
}
