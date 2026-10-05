export const XOR_SAMPLES = Object.freeze([
  Object.freeze({ input:[0,0], target:0 }),
  Object.freeze({ input:[0,1], target:1 }),
  Object.freeze({ input:[1,0], target:1 }),
  Object.freeze({ input:[1,1], target:0 }),
]);

function sigmoid(value) { return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, value)))); }
function binaryLoss(target, prediction) {
  const p = Math.max(1e-9, Math.min(1 - 1e-9, prediction));
  return -(target * Math.log(p) + (1 - target) * Math.log(1 - p));
}

export function createLinearGate() { return { weights:[.1,-.2], bias:.05, epochs:0, loss:Math.log(2) }; }
export function predictLinearGate(model, input) { return sigmoid(model.weights[0] * input[0] + model.weights[1] * input[1] + model.bias); }
export function trainLinearGate(model, epochs = 1, learningRate = .5) {
  const next = { weights:[...model.weights], bias:model.bias, epochs:model.epochs, loss:model.loss };
  for (let epoch=0; epoch<epochs; epoch+=1) {
    const grad=[0,0]; let gradBias=0; let loss=0;
    for (const sample of XOR_SAMPLES) {
      const prediction = predictLinearGate(next, sample.input);
      const delta = prediction - sample.target;
      grad[0] += delta * sample.input[0]; grad[1] += delta * sample.input[1]; gradBias += delta;
      loss += binaryLoss(sample.target, prediction);
    }
    next.weights[0] -= learningRate * grad[0] / XOR_SAMPLES.length;
    next.weights[1] -= learningRate * grad[1] / XOR_SAMPLES.length;
    next.bias -= learningRate * gradBias / XOR_SAMPLES.length;
    next.epochs += 1; next.loss = loss / XOR_SAMPLES.length;
  }
  return next;
}

export function createXorNetwork() {
  return {
    hidden:4,
    w1:[[.25,-.35],[-.45,.15],[.2,.4],[-.3,-.25]],
    b1:[.1,-.1,.05,.08],
    w2:[.3,-.2,.25,-.35],
    b2:.02,
    epochs:0,
    loss:Math.log(2),
  };
}

export function forwardXor(model, input) {
  const hidden = model.w1.map((weights,index) => Math.tanh(weights[0]*input[0] + weights[1]*input[1] + model.b1[index]));
  const output = sigmoid(model.w2.reduce((sum,weight,index)=>sum + weight*hidden[index], model.b2));
  return { hidden, output };
}

export function trainXorNetwork(model, epochs = 1, learningRate = .8) {
  const next = {
    hidden:model.hidden,
    w1:model.w1.map(row=>[...row]), b1:[...model.b1], w2:[...model.w2], b2:model.b2,
    epochs:model.epochs, loss:model.loss,
  };
  for (let epoch=0; epoch<epochs; epoch+=1) {
    const gw1=next.w1.map(()=>[0,0]); const gb1=next.b1.map(()=>0); const gw2=next.w2.map(()=>0);
    let gb2=0; let loss=0;
    for (const sample of XOR_SAMPLES) {
      const pass = forwardXor(next, sample.input);
      loss += binaryLoss(sample.target, pass.output);
      const d2 = pass.output - sample.target;
      for (let h=0; h<next.hidden; h+=1) {
        gw2[h] += d2 * pass.hidden[h];
        const d1 = (1 - pass.hidden[h] ** 2) * next.w2[h] * d2;
        gw1[h][0] += d1 * sample.input[0]; gw1[h][1] += d1 * sample.input[1]; gb1[h] += d1;
      }
      gb2 += d2;
    }
    const count = XOR_SAMPLES.length;
    for (let h=0; h<next.hidden; h+=1) {
      next.w1[h][0] -= learningRate * gw1[h][0] / count;
      next.w1[h][1] -= learningRate * gw1[h][1] / count;
      next.b1[h] -= learningRate * gb1[h] / count;
      next.w2[h] -= learningRate * gw2[h] / count;
    }
    next.b2 -= learningRate * gb2 / count;
    next.epochs += 1; next.loss = loss / count;
  }
  return next;
}

export function evaluateGate(model, predictor) {
  const rows = XOR_SAMPLES.map(sample => {
    const probability = predictor(model, sample.input);
    const prediction = Number(probability >= .5);
    return { ...sample, probability, prediction, ok:prediction === sample.target };
  });
  return { rows, correct:rows.filter(row=>row.ok).length, accuracy:rows.filter(row=>row.ok).length / rows.length };
}
export function evaluateXorNetwork(model) { return evaluateGate(model, (network,input)=>forwardXor(network,input).output); }

export const NEURAL_PYTHON_SOURCE = `# tiny educational MLP: 2 -> 4 -> 1\nh = tanh(W1 @ x + b1)\ny = sigmoid(W2 @ h + b2)\nloss = binary_cross_entropy(target, y)\n\n# backprop asks: which weights contributed to this error?\nd_output = y - target\nd_hidden = (1 - h**2) * W2 * d_output\nW2 -= lr * d_output * h\nW1 -= lr * outer(d_hidden, x)`;

function setText(root, selector, value) { const node=root.querySelector(selector); if (node) node.textContent=value; }
function pct(value) { return `${Math.round(value*100)}%`; }

export function createNeuralFoundry(root, { getProfile, onProfile=()=>{}, onSound=()=>{}, onClose=()=>{} } = {}) {
  let linear=createLinearGate(); let network=createXorNetwork(); let hiddenInstalled=false; let selected=1;
  const learningRates=[.2,.8,2.4]; let rateIndex=1;

  function drawSamples(result) {
    const node=root.querySelector('#neuralSamples'); node.replaceChildren();
    result.rows.forEach((row,index)=>{
      const button=document.createElement('button'); button.type='button'; button.dataset.active=String(index===selected); button.dataset.ok=String(row.ok);
      button.innerHTML=`<span>${row.input[0]} ${row.input[1]}</span><b>→ ${row.prediction}</b><small>target ${row.target} · ${pct(row.probability)}</small>`;
      button.addEventListener('click',()=>{selected=index; paint();}); node.append(button);
    });
  }
  function drawNetwork() {
    const sample=XOR_SAMPLES[selected]; const pass=forwardXor(network,sample.input);
    setText(root,'#neuralInputA',String(sample.input[0])); setText(root,'#neuralInputB',String(sample.input[1]));
    root.querySelectorAll('[data-neural-hidden]').forEach((node,index)=>{
      const value=pass.hidden[index] ?? 0; node.textContent=value.toFixed(2); node.style.setProperty('--activation',String(Math.abs(value))); node.dataset.sign=value>=0?'positive':'negative';
    });
    setText(root,'#neuralOutput',pass.output.toFixed(2));
    root.querySelector('#neuralGraph').dataset.hidden=String(hiddenInstalled);
  }
  function paint() {
    const linearEval=evaluateGate(linear,predictLinearGate); const networkEval=evaluateXorNetwork(network); const active=hiddenInstalled?networkEval:linearEval;
    setText(root,'#neuralLinearAccuracy',`${linearEval.correct}/4 · ${pct(linearEval.accuracy)}`);
    setText(root,'#neuralEpochs',String(hiddenInstalled?network.epochs:linear.epochs));
    setText(root,'#neuralLoss',(hiddenInstalled?network.loss:linear.loss).toFixed(3));
    setText(root,'#neuralAccuracy',`${active.correct}/4 · ${pct(active.accuracy)}`);
    setText(root,'#neuralRate',`LR ${learningRates[rateIndex].toFixed(1)}`);
    root.dataset.hidden=String(hiddenInstalled);
    drawSamples(active); drawNetwork();
    const linearStuck=linear.epochs>=100 && linearEval.accuracy<1;
    root.querySelector('#neuralAddHidden').hidden=!linearStuck || hiddenInstalled;
    root.querySelector('#neuralTrainLinear').disabled=hiddenInstalled;
    root.querySelector('#neuralEpoch25').disabled=!hiddenInstalled;
    root.querySelector('#neuralEpoch200').disabled=!hiddenInstalled;
    const mastered=hiddenInstalled && networkEval.accuracy===1 && network.loss<.12;
    root.dataset.mastered=String(mastered);
    setText(root,'#neuralStatus', mastered
      ? '✓ HIDDEN LAYER освоен: 4/4. Ошибка прошла назад через связи и изменила веса.'
      : (!hiddenInstalled
        ? (linearStuck ? 'Линейный узел упёрся в XOR: одна прямая граница не разделяет эти четыре случая. Добавь скрытый слой.' : 'Сначала попробуй обучить один линейный узел. Не верь обещанию — посмотри на 4 случая.')
        : `Forward показывает активации. Backprop двигает веса от ошибки назад. Добейся 4/4 при loss < 0.12.`));
    root.querySelector('#neuralCodeReveal').hidden=!mastered;
    if (mastered && !getProfile()?.labs?.neural?.completed) onProfile({type:'neural-complete', accuracy:networkEval.accuracy, loss:network.loss, epochs:network.epochs});
  }

  root.querySelector('#neuralTrainLinear').addEventListener('click',()=>{linear=trainLinearGate(linear,200); onSound('power'); paint();});
  root.querySelector('#neuralAddHidden').addEventListener('click',()=>{hiddenInstalled=true; onSound('wire'); paint();});
  root.querySelector('#neuralEpoch25').addEventListener('click',()=>{network=trainXorNetwork(network,25,learningRates[rateIndex]); onSound('power'); paint();});
  root.querySelector('#neuralEpoch200').addEventListener('click',()=>{network=trainXorNetwork(network,200,learningRates[rateIndex]); onSound('power'); paint();});
  root.querySelector('#neuralRate').addEventListener('click',()=>{rateIndex=(rateIndex+1)%learningRates.length; paint();});
  root.querySelector('#neuralReset').addEventListener('click',()=>{linear=createLinearGate();network=createXorNetwork();hiddenInstalled=false;rateIndex=1;paint();});
  root.querySelector('#neuralClose').addEventListener('click',()=>{root.hidden=true;onClose();});
  root.querySelector('#neuralPython').textContent=NEURAL_PYTHON_SOURCE;

  return { open(){linear=createLinearGate();network=createXorNetwork();hiddenInstalled=false;rateIndex=1;selected=1;paint();root.hidden=false;root.querySelector('#neuralTrainLinear').focus({preventScroll:true});}, close(){root.hidden=true;}, snapshot(){return {linear,network,hiddenInstalled,result:evaluateXorNetwork(network)};} };
}
