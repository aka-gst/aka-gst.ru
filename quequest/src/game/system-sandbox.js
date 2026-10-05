function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function generateSandboxScenario(seed = 1) {
  const random = mulberry32(Math.max(1, Number(seed) || 1));
  const sourceRate = 2 + Math.floor(random() * 5);
  const serviceRate = 1 + Math.floor(random() * 3);
  const burstEvery = random() > .42 ? 4 : 0;
  const burstSize = burstEvery ? 2 + Math.floor(random() * 5) : 0;
  const sharedWrite = random() > .48;
  return { seed, sourceRate, serviceRate, burstEvery, burstSize, sharedWrite, ticks: 16 };
}

export function simulateSandbox(scenario, config) {
  let queue = 0;
  let processed = 0;
  let dropped = 0;
  let collisions = 0;
  const timeline = [];
  const workers = Math.max(1, Math.min(8, Math.round(config.workers || 1)));
  const buffer = Math.max(1, Math.min(30, Math.round(config.buffer || 4)));
  const lock = Boolean(config.lock);
  for (let tick = 1; tick <= scenario.ticks; tick += 1) {
    const burst = scenario.burstEvery && tick % scenario.burstEvery === 0 ? scenario.burstSize : 0;
    const arrivals = scenario.sourceRate + burst;
    queue += arrivals;
    if (queue > buffer) { dropped += queue - buffer; queue = buffer; }
    const capacity = workers * scenario.serviceRate;
    const attempted = Math.min(queue, capacity);
    const race = scenario.sharedWrite && workers > 1 && !lock ? Math.floor(attempted / 3) : 0;
    collisions += race;
    processed += attempted - race;
    queue -= attempted;
    timeline.push({ tick, arrivals, queue, attempted, race });
  }
  const expectedWorkers = Math.max(1, Math.ceil((scenario.sourceRate + (scenario.burstEvery ? scenario.burstSize / scenario.burstEvery : 0)) / scenario.serviceRate));
  const stable = dropped === 0 && collisions === 0 && queue <= scenario.sourceRate && workers <= expectedWorkers + 1;
  const cost = workers * 10 + buffer + (lock ? 6 : 0);
  const score = Math.max(0, processed * 5 - dropped * 18 - collisions * 24 - cost);
  return { stable, score, processed, dropped, collisions, queueEnd:queue, timeline, expectedWorkers, workers, buffer, lock };
}

function setText(root, selector, text) { const node = root.querySelector(selector); if (node) node.textContent = text; }

export function createSystemSandbox(root, { getProfile, onProfile, onSound = () => {}, onClose = () => {} } = {}) {
  let seed = 1;
  let scenario = generateSandboxScenario(seed);
  let config = { workers:1, buffer:4, lock:false };

  function paintScenario() {
    setText(root,'#sandboxSeed',`SHIFT #${String(seed).padStart(3,'0')}`);
    setText(root,'#sandboxSource',`${scenario.sourceRate}/tick`);
    setText(root,'#sandboxWorkerRate',`${scenario.serviceRate}/worker`);
    setText(root,'#sandboxBurst',scenario.burstEvery ? `+${scenario.burstSize} каждый ${scenario.burstEvery}-й tick` : 'нет');
    setText(root,'#sandboxShared',scenario.sharedWrite ? 'ДА · возможна race' : 'НЕТ');
    paintConfig();
    root.querySelector('#sandboxTimeline').replaceChildren();
    setText(root,'#sandboxResult','Настрой линию и запусти 16 ticks. Цель: 0 drops, 0 collisions и без грубого overprovision.');
  }

  function paintConfig() {
    setText(root,'#sandboxWorkers',String(config.workers));
    setText(root,'#sandboxBuffer',String(config.buffer));
    root.querySelector('#sandboxLock').dataset.on=String(config.lock);
    root.querySelector('#sandboxLock').textContent=config.lock ? 'LOCK: ON' : 'LOCK: OFF';
  }

  function run() {
    const result=simulateSandbox(scenario,config);
    const timeline=root.querySelector('#sandboxTimeline'); timeline.replaceChildren();
    const max=Math.max(1,...result.timeline.map((row)=>row.queue+row.arrivals));
    for (const row of result.timeline) {
      const bar=document.createElement('i');
      bar.style.setProperty('--q',`${Math.max(8,Math.round((row.queue/max)*100))}%`);
      bar.dataset.race=String(row.race>0);
      bar.title=`tick ${row.tick}: arrived ${row.arrivals}, queue ${row.queue}, race ${row.race}`;
      timeline.append(bar);
    }
    setText(root,'#sandboxResult',result.stable
      ? `✓ СТАБИЛЬНО · processed ${result.processed} · drops 0 · collisions 0 · score ${result.score}. Можно брать следующую смену.`
      : `НЕСТАБИЛЬНО · processed ${result.processed} · drops ${result.dropped} · collisions ${result.collisions} · queue ${result.queueEnd}. Меняй причину, а не просто всё сразу.`);
    root.dataset.result=result.stable?'success':'retry';
    if (result.stable) {
      onProfile({type:'sandbox',seed,score:result.score,xp:20});
      root.querySelector('#sandboxNext').hidden=false;
      onSound('reward');
    } else onSound('blocked');
  }

  root.querySelector('#sandboxWorkersMinus').addEventListener('click',()=>{config.workers=Math.max(1,config.workers-1);paintConfig();});
  root.querySelector('#sandboxWorkersPlus').addEventListener('click',()=>{config.workers=Math.min(8,config.workers+1);paintConfig();});
  root.querySelector('#sandboxBufferMinus').addEventListener('click',()=>{config.buffer=Math.max(1,config.buffer-2);paintConfig();});
  root.querySelector('#sandboxBufferPlus').addEventListener('click',()=>{config.buffer=Math.min(30,config.buffer+2);paintConfig();});
  root.querySelector('#sandboxLock').addEventListener('click',()=>{config.lock=!config.lock;paintConfig();onSound('lock');});
  root.querySelector('#sandboxRun').addEventListener('click',run);
  root.querySelector('#sandboxNext').addEventListener('click',()=>{seed+=1;scenario=generateSandboxScenario(seed);config={workers:1,buffer:4,lock:false};root.querySelector('#sandboxNext').hidden=true;delete root.dataset.result;paintScenario();});
  root.querySelector('#sandboxClose').addEventListener('click',()=>{root.hidden=true;onClose();});

  return {
    open(){ const solved=getProfile()?.sandbox?.solvedSeeds ?? []; seed=Math.max(1,(solved.at(-1)??0)+1);scenario=generateSandboxScenario(seed);config={workers:1,buffer:4,lock:false};root.querySelector('#sandboxNext').hidden=true;paintScenario();root.hidden=false;root.querySelector('#sandboxRun').focus({preventScroll:true}); },
    close(){root.hidden=true;},
  };
}
