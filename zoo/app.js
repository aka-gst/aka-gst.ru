/* Zoo: карта, клетка, столкновение, журнал.

   Ядро — столкновение. Существа не враги по природе, их обратили. У каждого
   две полосы: Сила и Покой. Обе наполняются из одних и тех же раундов, и то,
   какая наполнится первой, решает, очистили вы существо или развеяли.
   Выбор не делается в меню — он складывается из того, как вы деретесь. */
(() => {
  const $ = id => document.getElementById(id);
  const W = window.ZOO_WORLD, EL = window.ZOO_ELEMENTS, INTENTS = window.ZOO_INTENTS,
        ACTIONS = window.ZOO_ACTIONS, ITEMS = window.ZOO_ITEMS;
  const cellById = new Map(W.cells.map(c => [c.id, c]));
  const OPEN_COST = 3;                 // карма за открытие соседней клетки
  const RESOLVE = 12;                  // сколько Покоя нужно, чтобы очистить

  let S = {
    at: W.start, opened: [W.start], cleansed: [], resolved: [], taken: [], done: [],
    bag: [], allies: [], gold: 0, resolve: 20,
  };
  let karma = 0, online = false, fight = null;

  const has = (list, v) => list.includes(v);
  const isOpen = id => has(S.opened, id);
  const isClean = id => has(S.cleansed, id) || cellById.get(id).clean;
  const neighbours = id => {
    const i = id - 1, col = i % W.columns, row = Math.floor(i / W.columns), out = [];
    if (col > 0) out.push(id - 1);
    if (col < W.columns - 1) out.push(id + 1);
    if (row > 0) out.push(id - W.columns);
    if (row < W.rows - 1) out.push(id + W.columns);
    return out;
  };
  const reachable = id => isOpen(id) || neighbours(id).some(isOpen);
  const liveCreatures = cell => (cell.creatures || []).filter(c => !has(S.resolved, c.id));

  async function api(path, options) {
    const r = await fetch(path, { credentials: 'same-origin', ...(options || {}) });
    if (!r.ok) { const e = new Error('failed'); e.status = r.status; try { e.payload = await r.json(); } catch (x) {} throw e; }
    return r.json();
  }
  const post = (p, b) => api(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) });

  function absorb(remote) {
    if (!remote) return;
    if (typeof remote.karma === 'number') karma = remote.karma;
    if (remote.state && remote.state.at) S = { ...S, ...remote.state };
    $('who').textContent = remote.account ? remote.account.nickname : 'гость';
    draw();
  }
  const save = () => { if (online) post('api/progress', { state: S }).then(absorb).catch(() => { online = false; }); };
  /* Карма только одна и она на сервере. Клиент её не назначает, а просит
     начислить — иначе сохранение состояния затирает начисленное. */
  async function award(amount) {
    if (!amount) return;
    if (!online) { karma = Math.max(0, karma + amount); return; }
    try { absorb(await post('api/karma/award', { amount })); }
    catch (e) { online = false; karma = Math.max(0, karma + amount); }
  }

  /* ---------- карта ---------- */
  function drawMap() {
    const map = $('map');
    map.style.gridTemplateColumns = `repeat(${W.columns}, 1fr)`;
    map.innerHTML = '';
    for (let row = W.rows - 1; row >= 0; row--) {
      for (let col = 0; col < W.columns; col++) {
        const id = row * W.columns + col + 1;
        const cell = cellById.get(id);
        if (!cell) continue;
        const open = isOpen(id), clean = isClean(id), near = reachable(id);
        const node = document.createElement('button');
        node.type = 'button';
        node.className = 'tile' + (clean ? ' clean' : open ? ' infected' : near ? ' near' : ' fog')
          + (id === S.at ? ' here' : '');
        node.innerHTML = open || near
          ? `<span class="tile-n">${id}</span><span class="tile-name">${open ? cell.name : '?'}</span>`
          : '<span class="tile-n">·</span>';
        if (open) {
          const left = liveCreatures(cell).length;
          node.innerHTML += left ? `<span class="tile-tag">${left} ✦</span>` : '<span class="tile-tag ok">чисто</span>';
        } else if (near) {
          node.innerHTML += `<span class="tile-tag cost">${OPEN_COST} кармы</span>`;
        }
        node.onclick = () => enter(id);
        map.append(node);
      }
    }
  }

  async function enter(id) {
    if (!reachable(id)) return say('Туда пока не дойти — открывайте соседние места.');
    if (!isOpen(id)) {
      if (karma < OPEN_COST) return say(`Чтобы открыть место, нужно ${OPEN_COST} кармы. Её дают добрые дела и ваши игры.`);
      if (online) { try { absorb(await post('api/karma/spend', { amount: OPEN_COST })); } catch (e) { return say('Сервер не ответил, попробуйте ещё раз.'); } }
      else karma -= OPEN_COST;
      S.opened.push(id);
    }
    S.at = id; fight = null; save(); draw();
  }

  /* ---------- клетка ---------- */
  function drawCell() {
    const cell = cellById.get(S.at), clean = isClean(S.at);
    /* Тёплой становится сама клетка, а не вся страница: мир вокруг остаётся
       заражённым, пока его не очистят целиком. Иначе на старте игра выглядит
       спокойной и неона не видно вовсе. */
    $('place').classList.toggle('clean-here', clean);
    $('placeName').textContent = `${cell.id}. ${cell.name}`;
    $('placeText').textContent = cell.text;
    // Вид места зависит от состояния. Файла может не быть — тогда прячем.
    const art = $('placeArt'), src = cell.art && cell.art[clean ? 'clean' : 'infected'];
    art.hidden = !src;
    if (src && art.getAttribute('src') !== src) art.setAttribute('src', src);
    art.onerror = () => { art.hidden = true; };
    $('placeState').textContent = clean ? 'очищено' : 'заражено';
    $('placeState').className = 'place-state' + (clean ? ' ok' : '');

    const list = $('here');
    list.innerHTML = '';
    for (const npc of cell.npcs || []) {
      const quest = W.quests[npc.quest];
      const node = document.createElement('div');
      node.className = 'row npc';
      const state = !quest ? '' : has(S.done, npc.quest) ? 'сделано'
        : has(S.taken, npc.quest) ? (questReady(npc.quest) ? 'можно сдать' : 'в работе') : 'есть просьба';
      node.innerHTML = `<div><b>${npc.name}</b><p>${npc.line}</p></div>`;
      if (quest) {
        const button = document.createElement('button');
        button.className = 'act';
        button.textContent = has(S.done, npc.quest) ? 'сделано'
          : has(S.taken, npc.quest) ? (questReady(npc.quest) ? 'сдать' : state) : 'взять';
        button.disabled = has(S.done, npc.quest) || (has(S.taken, npc.quest) && !questReady(npc.quest));
        button.onclick = () => (has(S.taken, npc.quest) ? finishQuest(npc.quest) : takeQuest(npc.quest));
        node.append(button);
      }
      list.append(node);
    }
    for (const item of cell.items || []) {
      if (has(S.bag, item)) continue;
      const node = document.createElement('div');
      node.className = 'row item';
      node.innerHTML = `<div><b>${ITEMS[item].name}</b><p>${ITEMS[item].text}</p></div>`;
      const button = document.createElement('button');
      button.className = 'act';
      button.textContent = 'взять';
      button.onclick = () => { S.bag.push(item); say(`Взято: ${ITEMS[item].name}.`); save(); draw(); };
      node.append(button);
      list.append(node);
    }
    for (const creature of liveCreatures(cell)) {
      const node = document.createElement('div');
      node.className = 'row beast';
      const face = creature.art ? `<img class="beast-thumb" src="${creature.art.corrupted}" alt="" onerror="this.remove()" />` : '';
      node.innerHTML = `${face}<div><b>${creature.name}</b> <span class="el el-${creature.element}">${EL[creature.element].name}</span>
        <p>${creature.text}</p></div>`;
      const button = document.createElement('button');
      button.className = 'act danger';
      button.textContent = 'подойти';
      button.onclick = () => startFight(creature);
      node.append(button);
      list.append(node);
    }
    if (!list.children.length) {
      list.innerHTML = clean
        ? '<p class="empty">Здесь тихо. Место очищено.</p>'
        : '<p class="empty">Здесь больше некого и нечего искать.</p>';
    }
  }

  /* ---------- столкновение ---------- */
  function startFight(creature) {
    fight = { creature, power: creature.power * 3, calm: 0, intent: nextIntent(), log: [] };
    draw();
  }
  const nextIntent = () => ['strike', 'flee', 'grow'][Math.floor(Math.random() * 3)];

  function advantage(creature) {
    // Спутник даёт перевес, если его стихия бьёт стихию существа.
    return S.allies.some(id => {
      const npc = W.cells.flatMap(c => c.npcs || []).find(n => n.id === id);
      return npc && EL[npc.element] && EL[npc.element].beats === creature.element;
    });
  }

  function act(action) {
    if (!fight) return;
    const { creature } = fight;
    const right = INTENTS[fight.intent].answer === action;
    const bonus = advantage(creature) ? 1 : 0;
    if (right) {
      if (action === 'hit') { fight.power -= 3 + bonus; fight.calm += 1; }
      else { fight.calm += 3 + bonus; }
      fight.log.unshift(`Вы угадали намерение: ${INTENTS[fight.intent].name}.`);
    } else {
      if (action === 'hit') { fight.power -= 2 + bonus; }
      else { fight.calm += 1; }
      S.resolve -= 3;
      fight.log.unshift(`Намерение было — ${INTENTS[fight.intent].name}. Вы пропустили удар.`);
    }
    if (fight.power <= 0) return endFight('dispelled');
    if (fight.calm >= RESOLVE) return endFight('cleansed');
    if (S.resolve <= 0) return endFight('retreat');
    fight.intent = nextIntent();
    draw();
  }

  function endFight(how) {
    const { creature } = fight;
    S.resolved.push(creature.id);
    let change = 0;
    if (how === 'cleansed') { change = 2; S.gold += 2; say(`${creature.name} пришло в себя и ушло. Карма +2.`); }
    if (how === 'dispelled') { change = -1; S.gold += 8; say(`${creature.name} развеяно. Золото +8, карма −1.`); }
    if (how === 'retreat') {
      S.resolved.pop();
      S.resolve = 20;
      say('Сил не осталось. Вы отступили — здесь никого не убивают за это.');
    }
    fight = null;
    const cell = cellById.get(S.at);
    if (!liveCreatures(cell).length && !isClean(S.at)) {
      S.cleansed.push(S.at);
      say(`${cell.name} — место очищено полностью.`);
    }
    save(); draw();
    void award(change);
  }

  function drawFight() {
    const box = $('fight');
    box.hidden = !fight;
    if (!fight) return;
    const { creature } = fight;
    const foeArt = $('foeArt'), face = creature.art && creature.art.corrupted;
    foeArt.hidden = !face;
    if (face && foeArt.getAttribute('src') !== face) foeArt.setAttribute('src', face);
    foeArt.onerror = () => { foeArt.hidden = true; };
    $('foeName').textContent = creature.name;
    $('foeEl').textContent = EL[creature.element].name;
    $('foeEl').className = `el el-${creature.element}`;
    $('barPower').style.width = `${Math.max(0, fight.power / (creature.power * 3) * 100)}%`;
    $('barCalm').style.width = `${Math.min(100, fight.calm / RESOLVE * 100)}%`;
    $('intent').textContent = INTENTS[fight.intent].hint;
    $('resolve').textContent = S.resolve;
    $('fightLog').innerHTML = fight.log.slice(0, 3).map(l => `<li>${l}</li>`).join('');
  }

  /* ---------- задания ---------- */
  const questReady = id => {
    const q = W.quests[id];
    if (q.need.item) return has(S.bag, q.need.item);
    if (q.need.cleansed) return S.cleansed.length >= q.need.cleansed;
    return false;
  };
  function takeQuest(id) { S.taken.push(id); say(`Взято: ${W.quests[id].title}.`); save(); draw(); }
  function finishQuest(id) {
    const q = W.quests[id];
    if (!questReady(id)) return;
    S.done.push(id);
    if (q.need.item) S.bag = S.bag.filter(i => i !== q.need.item);
    S.gold += q.reward.gold || 0;
    if (q.reward.item) S.bag.push(q.reward.item);
    if (q.reward.ally && !has(S.allies, q.reward.ally)) S.allies.push(q.reward.ally);
    say(`${q.title} — выполнено. Карма +${q.reward.karma}, золото +${q.reward.gold}.`);
    save(); draw();
    void award(q.reward.karma || 0);
  }

  function drawJournal() {
    const active = S.taken.filter(id => !has(S.done, id));
    $('journal').innerHTML = active.length
      ? active.map(id => `<li><b>${W.quests[id].title}</b><span>${W.quests[id].text}</span>
          <i>${questReady(id) ? 'можно сдать' : 'в работе'}</i></li>`).join('')
      : '<li class="empty">Заданий пока нет. Поговорите с жителями.</li>';
    $('bag').innerHTML = S.bag.length
      ? S.bag.map(i => `<li>${ITEMS[i].name}</li>`).join('')
      : '<li class="empty">Пусто</li>';
    $('allies').textContent = S.allies.length ? `${S.allies.length}` : '0';
  }

  const say = text => { $('say').textContent = text; };

  function draw() {
    $('karma').textContent = karma;
    $('gold').textContent = S.gold;
    $('cleanCount').textContent = `${W.cells.filter(c => isClean(c.id)).length} из ${W.cells.length}`;
    drawMap(); drawCell(); drawFight(); drawJournal();
  }

  Object.keys(ACTIONS).forEach(key => {
    const button = document.createElement('button');
    button.className = 'move';
    button.innerHTML = `${ACTIONS[key].name}<span>${ACTIONS[key].note}</span>`;
    button.onclick = () => act(key);
    $('moves').append(button);
  });

  (async () => {
    try { absorb(await api('api/state')); online = true; }
    catch (e) { online = false; say('Сервер недоступен — путь не сохранится, но играть можно.'); draw(); }
  })();
})();
