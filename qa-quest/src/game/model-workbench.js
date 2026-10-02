const PACKS = Object.freeze({
  digits: Object.freeze({
    title:'ЦИФРЫ', seed:41,
    prototypes:Object.freeze({
      '0':['01110','10001','10001','10001','01110'],
      '1':['00100','01100','00100','00100','01110'],
      '7':['11111','00010','00100','01000','01000'],
    }),
  }),
  letters: Object.freeze({
    title:'БУКВЫ', seed:83,
    prototypes:Object.freeze({
      I:['11111','00100','00100','00100','11111'],
      L:['10000','10000','10000','10000','11111'],
      T:['11111','00100','00100','00100','00100'],
    }),
  }),
  icons: Object.freeze({
    title:'ПИКТОГРАММЫ', seed:127,
    prototypes:Object.freeze({
      BOX:['11111','10001','10001','10001','11111'],
      X:['10001','01010','00100','01010','10001'],
      PLUS:['00100','00100','11111','00100','00100'],
    }),
  }),
});

export const MODEL_DATASET_PACKS = PACKS;

function vector(rows) { return rows.flatMap((row) => [...row].map(Number)); }
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function noisyCopy(base, flips, seed) {
  const out = [...base];
  const random = mulberry32(seed);
  const indices = Array.from({length:out.length}, (_, index) => index);
  for (let index = 0; index < flips; index += 1) {
    const pick = index + Math.floor(random() * (indices.length - index));
    [indices[index], indices[pick]] = [indices[pick], indices[index]];
    out[indices[index]] = out[indices[index]] ? 0 : 1;
  }
  return out;
}

export function makeModelDataset(packId = 'digits', { augmented = false } = {}) {
  const pack = PACKS[packId] ?? PACKS.digits;
  const entries = Object.entries(pack.prototypes);
  const training = entries.map(([label, rows]) => ({ label, pixels:vector(rows), source:'clean' }));
  if (augmented) {
    entries.forEach(([label, rows], classIndex) => {
      const base = vector(rows);
      for (let variant = 0; variant < 4; variant += 1) {
        training.push({
          label,
          pixels:noisyCopy(base, variant % 2 + 1, pack.seed + classIndex * 101 + variant * 17),
          source:'augmented',
        });
      }
    });
  }
  const evalSet = [];
  entries.forEach(([label, rows], classIndex) => {
    const base = vector(rows);
    for (let variant = 0; variant < 4; variant += 1) {
      evalSet.push({
        label,
        pixels:noisyCopy(base, 2 + variant, pack.seed + 1000 + classIndex * 131 + variant * 29),
      });
    }
  });
  return { id:packId, title:pack.title, classes:entries.map(([label]) => label), training, evalSet, prototypes:pack.prototypes };
}

export function createLinearModel(classes) {
  return {
    classes:[...classes],
    weights:Object.fromEntries(classes.map((label) => [label, Array(25).fill(0)])),
    bias:Object.fromEntries(classes.map((label) => [label, 0])),
    epochs:0,
    loss:Math.log(Math.max(1, classes.length)),
  };
}

function scores(model, pixels) {
  return Object.fromEntries(model.classes.map((label) => [
    label,
    model.weights[label].reduce((sum, weight, index) => sum + weight * pixels[index], model.bias[label]),
  ]));
}

function probabilities(model, pixels) {
  const raw = scores(model, pixels);
  const peak = Math.max(...Object.values(raw));
  const exp = Object.fromEntries(Object.entries(raw).map(([label, value]) => [label, Math.exp(value - peak)]));
  const total = Object.values(exp).reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(Object.entries(exp).map(([label, value]) => [label, value / total]));
}

export function predictLinear(model, pixels) {
  const raw = scores(model, pixels);
  return model.classes.reduce((best, label) => raw[label] > raw[best] ? label : best, model.classes[0]);
}

export function trainLinearModel(model, samples, epochs = 1, learningRate = .35) {
  const next = {
    classes:[...model.classes],
    weights:Object.fromEntries(model.classes.map((label) => [label, [...model.weights[label]]])),
    bias:{...model.bias},
    epochs:model.epochs,
    loss:model.loss,
  };
  const count = Math.max(1, samples.length);
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const weightGrad = Object.fromEntries(next.classes.map((label) => [label, Array(25).fill(0)]));
    const biasGrad = Object.fromEntries(next.classes.map((label) => [label, 0]));
    let loss = 0;
    for (const sample of samples) {
      const prob = probabilities(next, sample.pixels);
      loss -= Math.log(Math.max(prob[sample.label] ?? 1e-9, 1e-9));
      for (const label of next.classes) {
        const gradient = prob[label] - (label === sample.label ? 1 : 0);
        for (let index = 0; index < 25; index += 1) weightGrad[label][index] += gradient * sample.pixels[index];
        biasGrad[label] += gradient;
      }
    }
    for (const label of next.classes) {
      for (let index = 0; index < 25; index += 1) next.weights[label][index] -= learningRate * weightGrad[label][index] / count;
      next.bias[label] -= learningRate * biasGrad[label] / count;
    }
    next.loss = loss / count;
    next.epochs += 1;
  }
  return next;
}

export function evaluateLinearModel(model, samples) {
  const rows = samples.map((sample) => {
    const predicted = predictLinear(model, sample.pixels);
    return { ...sample, predicted, ok:predicted === sample.label };
  });
  const correct = rows.filter((row) => row.ok).length;
  return { rows, correct, total:rows.length, accuracy:rows.length ? correct / rows.length : 0 };
}

function setText(root, selector, text) { const node = root.querySelector(selector); if (node) node.textContent = text; }
function drawPixels(node, pixels) {
  node.replaceChildren();
  pixels.forEach((value) => {
    const cell = document.createElement('i');
    cell.dataset.on = String(Boolean(value));
    node.append(cell);
  });
}

export function createModelWorkbench(root, { getProfile, onProfile, onSound = () => {}, onClose = () => {} } = {}) {
  let packId = 'digits';
  let augmented = false;
  let dataset = makeModelDataset(packId);
  let model = createLinearModel(dataset.classes);
  let selectedClass = dataset.classes[0];
  let trainedAfterAugment = false;

  function resetModel() {
    dataset = makeModelDataset(packId, {augmented});
    model = createLinearModel(dataset.classes);
    selectedClass = dataset.classes[0];
    trainedAfterAugment = false;
  }

  function paintPrototypes() {
    const node = root.querySelector('#modelPrototypes');
    node.replaceChildren();
    for (const [label, rows] of Object.entries(dataset.prototypes)) {
      const card = document.createElement('button');
      card.type = 'button';
      card.dataset.modelClass = label;
      card.dataset.active = String(label === selectedClass);
      const pixels = document.createElement('span');
      pixels.className = 'model-mini-pixels';
      drawPixels(pixels, vector(rows));
      const name = document.createElement('b'); name.textContent = label;
      card.append(pixels, name);
      card.addEventListener('click', () => { selectedClass = label; paint(); });
      node.append(card);
    }
  }

  function paintWeights() {
    const node = root.querySelector('#modelWeights');
    node.replaceChildren();
    const values = model.weights[selectedClass] ?? Array(25).fill(0);
    const peak = Math.max(.001, ...values.map((value) => Math.abs(value)));
    values.forEach((value) => {
      const cell = document.createElement('i');
      cell.dataset.sign = value > .02 ? 'positive' : value < -.02 ? 'negative' : 'zero';
      cell.style.setProperty('--weight', String(Math.min(1, Math.abs(value) / peak)));
      cell.title = `${selectedClass}: ${value.toFixed(3)}`;
      node.append(cell);
    });
    setText(root, '#modelWeightLabel', `WEIGHTS · CLASS ${selectedClass}`);
  }

  function paintEval() {
    const result = evaluateLinearModel(model, dataset.evalSet);
    setText(root, '#modelAccuracy', `${result.correct}/${result.total} · ${Math.round(result.accuracy * 100)}%`);
    root.querySelector('#modelAccuracyBar').style.width = `${Math.round(result.accuracy * 100)}%`;
    setText(root, '#modelEpochs', String(model.epochs));
    setText(root, '#modelLoss', Number(model.loss).toFixed(3));
    setText(root, '#modelTrainCount', `${dataset.training.length} samples${augmented ? ' · augmented' : ' · clean only'}`);
    const confusion = root.querySelector('#modelConfusion');
    confusion.replaceChildren();
    for (const label of dataset.classes) {
      const classRows = result.rows.filter((row) => row.label === label);
      const ok = classRows.filter((row) => row.ok).length;
      const row = document.createElement('div');
      row.dataset.ok = String(ok === classRows.length);
      row.innerHTML = `<b>${label}</b><span>${ok}/${classRows.length}</span><small>${classRows.filter((item)=>!item.ok).map((item)=>item.predicted).join(' · ') || 'stable'}</small>`;
      confusion.append(row);
    }
    const mastered = augmented && trainedAfterAugment && result.accuracy >= .9;
    root.dataset.mastered = String(mastered);
    setText(root, '#modelStatus', mastered
      ? `✓ ${dataset.title}: модель держит шумный eval. Сохраняем mastery; попробуй другой набор.`
      : (model.epochs === 0
        ? 'Нулевые веса дают случайный tie. Запусти эпоху и наблюдай, какие пиксели начинают влиять на класс.'
        : `${dataset.title}: ${Math.round(result.accuracy*100)}% на скрытом шумном eval. ${augmented ? 'Теперь меняй epochs и следи за loss.' : 'Training пока слишком чистый — добавь вариации данных.'}`));
    if (mastered) onProfile({type:'model-dataset', id:packId, accuracy:result.accuracy, epochs:model.epochs, xp:110});
  }

  function paint() {
    for (const button of root.querySelectorAll('[data-model-pack]')) button.dataset.active = String(button.dataset.modelPack === packId);
    root.querySelector('#modelAugment').dataset.on = String(augmented);
    root.querySelector('#modelAugment').textContent = augmented ? 'DATA AUGMENTATION: ON' : 'ДОБАВИТЬ ШУМНЫЕ ПРИМЕРЫ';
    paintPrototypes();
    paintWeights();
    paintEval();
    const completed = getProfile()?.labs?.model?.completedDatasets ?? [];
    setText(root, '#modelMastery', `${completed.length}/3 DATASETS MASTERED`);
  }

  function choosePack(nextId) {
    packId = PACKS[nextId] ? nextId : 'digits';
    augmented = false;
    resetModel();
    paint();
    onSound('wire');
  }

  function train(epochs) {
    model = trainLinearModel(model, dataset.training, epochs);
    if (augmented) trainedAfterAugment = true;
    paint();
    onSound('power');
  }

  root.querySelectorAll('[data-model-pack]').forEach((button) => button.addEventListener('click', () => choosePack(button.dataset.modelPack)));
  root.querySelector('#modelEpoch1').addEventListener('click', () => train(1));
  root.querySelector('#modelEpoch10').addEventListener('click', () => train(10));
  root.querySelector('#modelAugment').addEventListener('click', () => {
    if (augmented) return;
    augmented = true;
    dataset = makeModelDataset(packId, {augmented:true});
    trainedAfterAugment = false;
    paint();
    onSound('reward');
  });
  root.querySelector('#modelReset').addEventListener('click', () => { augmented = false; resetModel(); paint(); });
  root.querySelector('#modelClose').addEventListener('click', () => { root.hidden = true; onClose(); });

  return {
    open() { packId='digits'; augmented=false; resetModel(); paint(); root.hidden=false; root.querySelector('#modelEpoch1').focus({preventScroll:true}); },
    close() { root.hidden=true; },
    snapshot() { return { packId, augmented, model:JSON.parse(JSON.stringify(model)), result:evaluateLinearModel(model,dataset.evalSet) }; },
  };
}
