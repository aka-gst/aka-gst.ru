/* Local-first UI. Rendering is separate from simulation; saves are explicit JSON. */
(function () {
    'use strict';
    const D = WorkshopData, E = WorkshopEngine, L = WorkshopLab, M = WorkshopMemories, $ = id => document.getElementById(id), esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const SAVE = 'zhivoy-tsekh-v10';
    let labSession = null;
    let S, loaded = false, storageOK = true, preview = false, previewStack = [], activeRow = 0, held = null, tab = 'factory', tool = 'select', selected = null, linkFrom = null, sound = false, audio = null, toastTimer, history = [], lastSave = 0, lastRender = 0, lastFrame = 0, accumulator = 0, modalPause = null, lastAuto = 0;
    const htmlCache = new Map();
    const store = WorkshopStorage.create({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)},E);
    const restored = store.load(); S=restored.state;loaded=restored.loaded;storageOK=restored.usable;
    if(restored.warning)setTimeout(()=>toast(restored.warning),150);
    try {const p=JSON.parse(localStorage.getItem('zhivoy-tsekh-preferences')||'{}');sound=!!p.sound;document.body.classList.toggle('calm',!!p.calm);document.body.classList.toggle('large-text',!!p.large);}catch(_){}
    const view = new WorkshopView($('world'), { click: onMap, connect: (from,to) => act(() => E.connect(S, from, to)), move: g => act(() => E.move(S, g.id, Math.round(g.x / 10) * 10, Math.round(g.y / 10) * 10)), swap: swapWords, drop: dropWord });
    function renderHTML(id, html) { if (htmlCache.get(id) !== html) {
        const keepOpen = id === 'inspector' && $(id).querySelector('details')?.open;
        $(id).innerHTML = html;
        if (keepOpen && $(id).querySelector('details'))
            $(id).querySelector('details').open = true;
        htmlCache.set(id, html);
    } }
    function toast(text) { if (!text)
        return; $('toast').textContent = text; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 4200); }
    function beep(kind = 'click') { if (!sound)
        return; try {
        audio = audio || new (window.AudioContext || window.webkitAudioContext)();
        if (audio.state === 'suspended')
            audio.resume();
        const now = audio.currentTime;
        const osc = audio.createOscillator(), gain = audio.createGain();
        osc.type = 'sine';
        osc.frequency.value = kind === 'done' ? 660 : kind === 'bad' ? 170 : kind === 'win' ? 880 : 440;
        gain.gain.setValueAtTime(.0001, now);
        gain.gain.exponentialRampToValueAtTime(.035, now + .008);
        gain.gain.exponentialRampToValueAtTime(.0001, now + .18);
        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start(now);
        osc.stop(now + .19);
    }
    catch (_) {
        sound = false;
    } }
    function save() {
        if(labSession||preview||S.mode==='puzzle'||!S.started)return;
        const result=store.save(S);storageOK=result.ok;
        $('saveState').textContent=result.ok?'● Сохранено на этом устройстве':'! Автосохранение недоступно — выгрузи JSON через меню';
    }
    function act(fn, undoable = true) { if (labSession?.phase === 'running') {
        toast('Останови испытание, прежде чем менять схему.');
        return { ok: false, message: 'Опыт идёт' };
    } const before = undoable ? E.serialize(S) : null; let r; try {
        r = fn();
    }
    catch (e) {
        toast('Действие не выполнено: ' + e.message);
        return;
    } if (r?.ok === false) {
        toast(r.message);
        beep('bad');
        return r;
    } if (undoable) {
        history.push(before);
        if (history.length > 12)
            history.shift();
    } if (r?.message)
        toast(r.message); beep(); save(); render(true); return r; }
    function setTool(t) { tool = t; view.tool = t; linkFrom = null; view.linkFrom = null; held = null; view.held = null; render(true); if (t === 'link')
        toast('Сначала нажми на машину-источник, потом на получателя.'); if (t === 'move')
        toast('Перетащи машину на свободное место. Её линии и файлы сохранятся.'); }
    function setTab(t) { tab = t; view.tab = t; view.fit(); document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === t)); render(true); }
    function onMap(hit, p, event) { if(hit?.kind==='codeOpen'){showPython();return;} if(hit?.kind==='ending'){showEnding();return;}
        if (hit?.kind === 'cat') {
            toast('Мур. Кот ничего не ускоряет. Просто рад тебя видеть.');
            beep('done');
            return;
        }
        if (hit?.kind === 'neighbor') {
            showNeighbor(hit.chapter);
            return;
        }
        if (tab !== 'factory')
            return;
        if (hit?.kind === 'rule') {
            activeRow = hit.row;
            if (held) {
                applyWord(held, hit);
                held = null;
            }
            else
                showWordPicker(hit);
            render(true);
            return;
        }
        if (hit?.kind === 'node') {
            selected = hit.id;
            view.selected = selected;
            if (event.shiftKey) {
                act(() => E.remove(S, selected));
                selected = null;
                view.selected = null;
            }
            else if (tool === 'link') {
                if (!linkFrom) {
                    linkFrom = hit.id;
                    view.linkFrom = hit.id;
                    toast('Теперь нажми на машину-получателя.');
                }
                else {
                    act(() => E.connect(S, linkFrom, hit.id));
                    linkFrom = null;
                    view.linkFrom = null;
                }
            }
            render(true);
            return;
        }
        if (tool.startsWith('copy:')) {
            const r = act(() => E.duplicate(S, tool.slice(5), Math.round(p.x / 10) * 10, Math.max(330, Math.round(p.y / 10) * 10)));
            if (r?.ok) {
                selected = r.id;
                view.selected = selected;
                setTool('select');
            }
            return;
        }
        if (tool.startsWith('build:')) {
            const type = tool.slice(6), r = act(() => E.build(S, type, Math.round(p.x / 10) * 10, Math.max(330, Math.round(p.y / 10) * 10)));
            if (r?.ok) {
                selected = r.id;
                view.selected = selected;
                setTool('select');
            }
        }
        else if (tool === 'select') {
            selected = null;
            view.selected = null;
            render(true);
        }
    }
    function applyWord(word, hit) { if (hit?.kind !== 'rule' || word.part !== hit.part) {
        toast('Это слово подходит в другую ячейку: слева — файл, справа — действие.');
        return;
    } const r = S.rules[hit.row]; act(() => E.rule(S, hit.row, word.part === 'condition' ? word.value : r.condition, word.part === 'action' ? word.value : r.action)); activeRow = hit.row; }
    function dropWord(word, hit) { applyWord(word, hit); }
    function swapWords(a, b) { const ra = { ...S.rules[a.row] }, rb = { ...S.rules[b.row] }; act(() => { const r = E.rule(S, a.row, a.part === 'condition' ? rb.condition : ra.condition, a.part === 'action' ? rb.action : ra.action); if (!r.ok)
        return r; return E.rule(S, b.row, b.part === 'condition' ? ra.condition : rb.condition, b.part === 'action' ? ra.action : rb.action); }); }
    function openModal(content) { $('modal').classList.remove('ending-window','code-window','story-window'); if (!$('modal').open) {
        modalPause = S.paused;
        S.paused = true;
    } $('modalContent').innerHTML = content; $('modal').showModal(); render(true); }
    function closeModal() { if (!$('modal').open)
        return; $('modal').close(); if (modalPause !== null) {
        S.paused = modalPause;
        modalPause = null;
    } render(true); }
    $('closeModal').onclick = closeModal;
    $('modal').addEventListener('cancel', e => { e.preventDefault(); closeModal(); });
    function showWordPicker(hit) { const list = hit.part === 'condition' ? D.conditions : D.actions; openModal(`<div class="eyebrow">СТРОКА ${hit.row + 1} · ПРАВИЛО МЕНЯЕТ МИР</div><h2>${hit.part === 'condition' ? 'Что пришло?' : 'Что сделать?'}</h2><p>Полное правило действует сразу. Неполное — не действует.</p><div class="buttons">${Object.entries(list).map(([v, l]) => `<button class="secondary" data-pick="${v}">${l}</button>`).join('')}<button class="secondary danger" data-pick="">Убрать слово</button></div>`); $('modalContent').querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { const value = b.dataset.pick || null; closeModal(); applyWord({ part: hit.part, value }, hit); }); }
    function guide() {
        const nodes = S.nodes, first = t => nodes.find(n => n.type === t), linked = (a, b) => a && b && S.links.some(l => l.from === a.id && l.to === b.id);
        if (S.mode === 'puzzle')
            return { title: 'Маленькая задача, настоящее правило', text: S.puzzle.description, action: 'Показать условие', kind: 'puzzle' };
        if (preview)
            return { title: 'Это демонстрация', text: 'Цех уже собран, чтобы показать масштаб. Ничего отсюда не перезапишет твоё прохождение.', action: 'Вернуться к своей мастерской', kind: 'return' };
        if (S.mode === 'sandbox' && !S.ending && S.claimed.includes(4)) return {title:'Соседи готовят общий праздник.',text:'Все прежние решения сохранились. Теперь можно собрать их в одном финальном заказе.',action:'Взять финальный заказ',kind:'advance'};
        if (S.mode === 'sandbox' && !!S.ending)
            return { title: 'Ты уже построил работающую систему.', text: 'Теперь проверь гипотезу: меньше расходов, больше выпуск или ни одного возврата. Испытательная смена не тронет твой цех.', action: 'Выбрать испытание', kind: 'lab' };
        if (E.ready(S))
            return { title: 'Заказ готов. Сосед ждёт!', text: 'Ты справился. Сдай готовую работу и прочитай ответ. Твоя мастерская останется — следующий заказ расширит её.', action: 'Отдать готовый заказ', kind: 'claim' };
        if (S.chapter === 0) {
            if (S.progress[0].manual < 3)
                return { title: 'Шаг 1 · сделай один файл руками', text: 'Нажми кнопку один раз и посмотри, что именно приходится повторять. Всего таких ручных файлов будет три.', action: 'Сделать один файл', kind: 'manual' };
            if (!first('router'))
                return { title: 'Шаг 2 · поставь развилку', text: 'Развилка читает правило и выбирает дорогу. Нажми кнопку, затем поставь её между «Приёмом» и «Готово».', action: 'Поставить развилку', kind: 'build:router' };
            if (!(S.program?.table['image:0:0']==='photo') && !S.rules.some(r => r.condition === 'image' && r.action === 'photo'))
                return { title: 'Шаг 3 · скажи, куда идут фото', text: 'В первой строке выбери «ЕСЛИ ФОТО → В ФОТО». Это настоящее правило маршрута, а не тестовый текст.', action: 'Открыть первую строку', kind: 'rule' };
            if (!first('photo'))
                return { title: 'Шаг 4 · поставь обработчик фото', text: 'Правило уже указывает дорогу, но на ней пока некому работать. Поставь «Фото → карточка» правее развилки.', action: 'Поставить обработчик', kind: 'build:photo' };
            const a = first('in'), r = first('router'), p = first('photo'), o = first('out');
            if (!linked(a, r) || !linked(r, p) || !linked(p, o))
                return { title: 'Шаг 5 · соедини три отрезка', text: 'Проведи: Приём → Развилка → Фото → Готово. Проще всего зажать одну машину и протянуть к следующей.', action: 'Показать режим линий', kind: 'link' };
            return { title: 'Шаг 6 · убери руки', text: 'Если всё соединено, больше ничего не нажимай. Смотри, как оставшиеся файлы проходят путь сами.', action: 'Посмотреть обработчик', kind: 'inspect' };
        }
        const texts = [
            '',
            'Добавь «Текст → карточка». От развилки сделай вторую ветку и правило «ТЕКСТ → В ТЕКСТ».',
            'Одна фотомашина не успевает. Поставь вторую и обязательно подключи её с двух сторон — сама близость ничего не ускоряет.',
            'Убери прямой выход обработчиков. Поставь между ними и «Готово» машину «Проверка».',
            'Поставь «Память» сразу после Приёма. Один выход веди в Развилку, второй — прямо в Готово: знакомые файлы пойдут коротко.',
            'Ничего нового не открывается: собери вместе две ветки, Память и Проверку. Это первый экзамен всей схемы.',
            'Включи «Где тормозит?». Не покупай всё подряд: усили только узкое место. Для фото почти наверняка понадобится второй параллельный обработчик.',
            'Собери устойчивую мастерскую: Память → Развилка → две ветки → Проверка → Готово. Это не конец — дальше начнутся задачи из обычной жизни.',
            'Для поздравлений нужен путь Текст → карточка → Персонализация → Готово. Одна заготовка должна стать десятками разных сообщений без копипаста.',
            'Чек — это ещё не таблица. Проведи фото через «Фото → карточка», затем через «В таблицу» и только потом сдавай результат.',
            'Теперь два типа работы живут одновременно: тексты должны персонализироваться, фото — превращаться в таблицу, а оба потока перед выдачей проходят Проверку.',
            'Финальный рабочий день: Память должна узнавать повторы, Развилка — разделять типы, две специализированные ветки — делать реальную работу, Проверка — страховать результат. Собери систему и отойди от неё.',
            'Собери цепь чеков: Фото → карточка → В таблицу → Сводка → Проверка → Готово. Сводка должна стоять ПОСЛЕ таблицы: сначала получаем строки, потом одним проходом накапливаем суммы по категориям.',
            'Собери утренний отчёт: Текст → карточка → Персонализация → Проверка → 09:00 → Готово. Расписание должно стоять после подготовки: оно запускает уже понятную операцию, а не чинит сырой файл.',
            'Бухгалтеру нужен переносимый результат: Фото → карточка → Таблица → Сводка → Проверка → CSV → Готово. CSV — это граница между твоей программой и чужой таблицей.',
            'Финальная интеграция: Текст → карточка → Проверка → API / CRM → Готово. API ставь ПОСЛЕ проверки: внешнее действие нельзя считать выполненным только потому, что Память узнала файл.'
        ];
        return { title: D.contracts[S.chapter].idea, text: texts[S.chapter] || D.contracts[S.chapter].letter, action: 'Открыть подсказку по цепочке', kind: 'help' };
    }
    function runGuide() { if (labSession) {
        if (labSession.phase === 'running') {
            view.heat = true;
            render(true);
        }
        else
            toast('Сделай исходный замер → измени одну вещь → повтори на тех же файлах.');
        return;
    } const g = guide(); if (g.kind === 'advance') {act(()=>E.advance(S),false);return;} if (g.kind === 'lab') {
        showLab();
    }
    else if (g.kind === 'claim') {
        onClaim();
    }
    else if (g.kind === 'manual') {
        act(() => E.manual(S), false);
        if (innerWidth < 640)
            $('manual').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    else if (g.kind.startsWith('build:')) {
        setTab('factory');
        setTool(g.kind);
    }
    else if (g.kind === 'rule') {
        activeRow = 0;
        render(true);
        $('ruleDock').scrollIntoView({ behavior: 'smooth', block: 'center' });
        $('condition').focus();
    }
    else if (g.kind === 'link') {
        setTab('factory');
        setTool('link');
    }
    else if (g.kind === 'inspect') {
        selected = S.nodes.find(n => n.type === 'photo')?.id;
        view.selected = selected;
        render(true);
    }
    else if (g.kind === 'return')
        leavePreview();
    else if (g.kind === 'puzzle')
        showPuzzleGoal();
    else
        showHelp(); }
    function render(force = false) {
        const c = E.contract(S), m = E.metrics(S), g = guide();
        document.body.classList.toggle('first-contract', !preview && S.mode === 'campaign' && S.chapter === 0 && !S.claimed.length);
        $('chapterLabel').textContent = S.mode === 'puzzle' ? 'ЗАДАЧА В МАСТЕРСКОЙ' : preview ? 'ДЕМОНСТРАЦИЯ · НЕ СОХРАНЯЕТСЯ' : 'ПИСЬМО ОТ СОСЕДА · ' + (S.chapter + 1) + ' / '+D.contracts.length;
        const concepts = ['функция + первый конвейер','if / elif','очередь и параллельная работа','проверка результата','словарь-кэш','композиция функций','измерение узкого места','автоматический pipeline','f-string / шаблон','структура dict','ветвление типов данных','повторяемая система','for + dict.get','функция + расписание','csv.DictWriter / сериализация','JSON + HTTP POST / side effect','pathlib.Path / shutil','json.dumps + схема данных','email / SMTP side effect','try/except + retry/backoff','idempotency key / request_id','logging + наблюдаемость'];
        const knownMoves = globalThis.PythonioHost?.host ? PythonioHost.knownFor(Math.min(S.chapter, concepts.length - 1), PythonioHost.host.known) : [];
        if ($('pythonConcept')) $('pythonConcept').innerHTML = '<b>PYTHON-СМЫСЛ</b><span>' + esc(concepts[Math.min(S.chapter, concepts.length - 1)] || 'автоматизация процесса') + '</span>' + (knownMoves.length ? '<small class="known-move">✓ ' + esc(knownMoves.join(', ')) + ' — уже знаешь: тут это просто рабочий инструмент</small>' : '');
        $('contractName').textContent = S.mode === 'puzzle' ? S.puzzle.name : c.name;
        $('clientPlace').textContent = S.mode === 'puzzle' ? 'Мастерская логики' : c.client + ' · ' + c.place;
        $('avatar').textContent = c.client[0];
        $('letter').textContent = S.mode === 'puzzle' ? S.puzzle.description : c.letter;
        const gs = S.mode === 'puzzle' ? puzzleGoals() : E.goals(S);
        renderHTML('goals', gs.map(r => `<div class="goal ${r.value >= r.target ? 'done' : ''}"><span>${r.value >= r.target ? '✓ ' : ''}${esc(r.label)}</span><b>${Math.min(r.value, r.target)} / ${r.target}</b></div>`).join(''));
        const claim = $('claim');
        if (S.mode === 'puzzle') {
            claim.disabled = !puzzleReady();
            claim.textContent = puzzleReady() ? 'Задача решена! Вернуться' : 'Реши маленькую задачу';
        }
        else {
            claim.disabled = !E.ready(S) && !S.claimed.includes(S.chapter);
            claim.textContent = S.claimed.includes(S.chapter) ? S.chapter < D.contracts.length - 1 ? 'Следующий заказ →' : 'Свободная игра →' : E.ready(S) ? 'Отдать заказ · +' + c.reward + ' ¤' : 'Заказ в работе';
        }
        $('reward').textContent = S.mode === 'puzzle' ? 'Пробуй без риска для своей мастерской' : c.reward + ' монет и ' + c.rep + ' репутации за заказ';
        renderHTML('coach', `<strong>${esc(g.title)}</strong><br>${esc(g.text)}`);
        $('guideAction').textContent = g.action;
        $('coins').innerHTML = Math.floor(S.coins) + ' <em>¤</em>';
        $('auto').innerHTML = S.total.auto + ' <em>заказов</em>';
        $('rate').innerHTML = m.rate + ' <em>/ мин</em>';
        $('rep').innerHTML = S.rep + ' <em>✦</em>';
        $('albumButton').textContent = '▧ Альбом мастерской · ' + mainStoryState().memories.length;
        $('autonomy').textContent = m.autoShare + '%';
        $('autonomyBar').style.width = m.autoShare + '%';
        $('pause').textContent = S.paused ? '▶ Продолжить' : 'Ⅱ Пауза';
        $('undo').disabled = !history.length;
        document.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('active', +b.dataset.speed === S.speed));
        document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === tool));
        const minutes = Math.min(839, Math.floor((S.time - S.dayStart) * 2));
        $('dayLabel').textContent = 'День ' + S.day + ' · ' + String(8 + Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
        const buildable=Object.keys(D.machines).filter(t=>!['in','out'].includes(t)); $('unlockedCount').textContent = S.unlocked.filter(t=>buildable.includes(t)).length + ' / ' + buildable.length;
        const symbols = { router: '≡', photo: '▧', writer: '¶', buffer: '▤', check: '✓', cache: '↻', template: '✦', table: '▦', summary: 'Σ', schedule: '◷', csv: '⇩', api: '⇄', retry:'↺', idempotency:'ID', folder:'▱', json:'{}', mail:'@', monitor:'LOG' };
        renderHTML('buildTools', Object.entries(symbols).map(([type, symbol]) => { const d = D.machines[type], un = S.unlocked.includes(type); return `<button class="machine-button ${un ? '' : 'locked'} ${tool === 'build:' + type ? 'active' : ''}" data-build="${type}" ${un ? '' : 'disabled'} title="${esc(d.detail)}"><i style="color:${d.color}">${symbol}</i><span>${d.name}<small>${un ? d.seconds.toLocaleString('ru-RU') + ' с на файл' : 'Откроется с новым заказом'}</small></span><b>${d.price} ¤</b></button>`; }).join(''));
        $('buildTools').querySelectorAll('[data-build]').forEach(b => b.onclick = () => { setTab('factory'); setTool('build:' + b.dataset.build); });
        renderHTML('ruleRows', S.rules.map((r, i) => `<button class="${activeRow === i ? 'active' : ''}" data-row="${i}" aria-label="Строка правила ${i + 1}">${i + 1}${r.condition && r.action ? ' •' : ''}</button>`).join(''));
        $('ruleRows').querySelectorAll('[data-row]').forEach(b => b.onclick = () => { activeRow = +b.dataset.row; render(true); });
        if (document.activeElement !== $('condition'))
            $('condition').value = S.rules[activeRow].condition || '';
        if (document.activeElement !== $('action'))
            $('action').value = S.rules[activeRow].action || '';
        const n = E.get(S, selected);
        if (n) {
            const d = D.machines[n.type], busy = n.queue.length + !!n.active, price = Math.ceil(d.price * .65 * n.level), sample = n.active?.job || n.queue[0];
            renderHTML('inspector', `<div class="eyebrow">ВЫБРАННАЯ МАШИНА · УР. ${n.level}</div><h3>${d.name}</h3><p>${esc(d.detail)}</p><div class="status">${esc(S.paused ? 'Пауза · ' + n.status : n.status)}</div><div class="mini-stat"><span>Файлов внутри</span><strong>${busy} / ${d.capacity}</strong></div><div class="mini-stat"><span>Обработано здесь</span><strong>${n.done}</strong></div>${!['in', 'out'].includes(n.type) ? `<div class="row"><button class="secondary" id="upgradeMachine" ${n.level >= 4 ? 'disabled' : ''}>Улучшить · ${price} ¤</button><button class="secondary" id="copyMachine">Копия · ${E.configurationCost(n.type, n.level)} ¤</button><button class="text-button" id="removeMachine">Убрать · вернуть 75%</button></div>` : ''}<div class="links">${S.links.filter(l => l.from === n.id).map(l => `<div class="link"><span>→ ${D.machines[E.get(S, l.to).type].name}</span><button data-unlink="${l.to}" aria-label="Убрать линию к ${D.machines[E.get(S, l.to).type].name}">×</button></div>`).join('')}</div>${sample ? `<details><summary>Проследить файл №${sample.id}</summary><p>${sample.type === 'image' ? 'Фото' : 'Текст'} · ${sample.prepared ? 'готово' : 'ещё сырое'}${sample.personalized ? ' · персонализировано' : ''}${sample.tabulated ? ' · строка таблицы' : ''}${sample.summarized ? ' · сводка готова' : ''}${sample.scheduled ? ' · по расписанию' : ''}${sample.exported ? ' · CSV готов' : ''}${sample.sent ? ' · отправлено в CRM' : ''}${sample.resilient ? ' · retry' : ''}${sample.idempotent ? ' · ID KEY' : ''}${sample.monitored ? ' · журнал' : ''}${sample.checked ? ' · проверено' : ''}<br>${sample.trace.map(esc).join(' → ')}</p></details>` : ''}`);
            $('copyMachine') && ($('copyMachine').onclick = () => { setTab('factory'); setTool('copy:' + n.id); toast('Поставь копию на свободном полу. Новые линии нужно подключить.'); });
            $('upgradeMachine') && ($('upgradeMachine').onclick = () => act(() => E.upgrade(S, n.id)));
            $('removeMachine') && ($('removeMachine').onclick = () => { act(() => E.remove(S, n.id)); selected = null; view.selected = null; render(true); });
            $('inspector').querySelectorAll('[data-unlink]').forEach(b => b.onclick = () => act(() => E.disconnect(S, n.id, b.dataset.unlink)));
        }
        else
            renderHTML('inspector', '<div class="eyebrow">ЛЮБОПЫТСТВО ПОЛЕЗНО</div><h3>Нажми на машину</h3><p>Здесь появится её очередь, причина остановки и история конкретного файла. Улучшения никогда не покупаются случайным кликом по карте.</p>');
        const blocked = S.nodes.find(n => n.type !== 'in' && n.queue.length > 0 && /Нет|Нужна|Нужн|Приш|Сначала/.test(n.status));
        const crowded = [...S.nodes].sort((a, b) => b.queue.length - a.queue.length)[0];
        let why = blocked ? D.machines[blocked.type].name + ': ' + blocked.status : crowded.queue.length > 8 ? 'Копится перед ' + D.machines[crowded.type].name.toLowerCase() + '. Посмотри, что задерживает следующую машину.' : S.total.auto ? 'Каждый готовый результат прошёл свою цепочку.' : 'Пока ни одного автоматического результата. Сначала собери первую цепь.';
        renderHTML('diagnosis', `<p>${esc(why)}</p><div class="mini-stat"><span>В работе и ожидании</span><strong>${m.queue}</strong></div><div class="mini-stat"><span>Возвратов на доработку</span><strong>${S.quarantine.length}</strong></div><div class="mini-stat"><span>Принято с попыток</span><strong>${m.accuracy === null ? '—' : m.accuracy + '%'}</strong></div><div class="mini-stat"><span>Ср. путь готового файла</span><strong>${m.latency.toFixed(1)} с</strong></div><div class="mini-stat"><span>Потрачено на обработку</span><strong>${S.total.cost} ¤</strong></div>`);
        $('rework').hidden = !S.quarantine.length;
        $('rework').textContent = 'Вернуть ' + S.quarantine.length + ' на вход';
        renderHTML('log', S.log.map(l => `<p>${esc(l.text)}</p>`).join(''));
        if (tab === 'yard') {
            renderHTML('sceneActions', `<div class="section-title">Сделай место своим</div>${D.decor.map(d => `<div class="scene-action"><strong>${d.name}</strong><p>${d.desc}</p><button class="secondary full" data-decor="${d.id}" ${S.decor.includes(d.id) ? 'disabled' : ''}>${S.decor.includes(d.id) ? 'Уже построено' : 'Построить · ' + d.cost + ' ¤'}</button></div>`).join('')}`);
            $('sceneActions').querySelectorAll('[data-decor]').forEach(b => b.onclick = () => act(() => E.decorate(S, b.dataset.decor)));
        }
        else if (tab === 'town') {
            renderHTML('sceneActions', '<div class="section-title">Заглянуть к соседям</div><div class="neighbor-shortcuts">' + [0,1,2,3].map(ch => '<button class="secondary" data-neighbor="' + ch + '">' + esc(D.contracts[ch].client) + '</button>').join('') + '</div>');
            $('sceneActions').querySelectorAll('[data-neighbor]').forEach(b => b.onclick = () => showNeighbor(+b.dataset.neighbor));
        } else
            renderHTML('sceneActions', '');
        $('mapCaption').textContent = preview ? 'ДЕМОНСТРАЦИЯ · ТВОЙ ПРОГРЕСС НЕ МЕНЯЕТСЯ' : tab === 'town' ? 'ГОРОД ПОМНИТ ДОБРЫЕ ДЕЛА' : tab === 'yard' ? 'ДОМА ХОРОШО' : 'МАСТЕРСКАЯ · ПЕРЕТАЩИ МАШИНУ К МАШИНЕ, ЧТОБЫ СОЕДИНИТЬ';
        $('mapMessage').textContent = tab !== 'factory' ? 'Нажимай на здания. Машины продолжают работать, пока ты гуляешь.' : tool === 'link' ? (linkFrom ? 'Выбери получателя. Стрелка покажет направление.' : 'Выбери источник, затем получателя. Линии бесплатны.') : tool === 'move' ? 'Перетащи машину. Пустое место карты можно двигать рукой.' : tool.startsWith('build:') ? 'Выбрано: ' + D.machines[tool.slice(6)].name + '. Нажми на свободный пол.' : held ? 'Теперь положи слово в подходящую ячейку доски.' : S.paused ? 'Пауза. Можно спокойно перестроить цех.' : 'Нажми на машину, чтобы понять её работу. Колесо и кнопки +/− меняют масштаб.';
        $('codeModeBanner').hidden=!S.program;
        $('pythonButton').textContent=S.program?'✓ Код управляет сортировщиком':'А где здесь Python? ↗';
        renderExperiments();
    }
    function pythonText() {
        const lines = ['# Перевод видимого цеха в Python.', '# Это учебная запись: сначала ты построил процесс глазами, теперь читаешь ту же идею кодом.', ''];
        S.rules.filter(r => r.condition && r.action).forEach((r, i) => {
            const cond = { image: 'item.type == "image"', text: 'item.type == "text"', ready: 'item.prepared', all: 'True' }[r.condition];
            const action = { photo: 'send_to("photo")', writer: 'send_to("text")', check: 'send_to("check")', out: 'send_to("delivery")', cache: 'send_to("memory")', template: 'send_to("personalize")', table: 'send_to("sheet")', summary: 'send_to("summary")', schedule: 'send_to("schedule")', csv: 'send_to("csv")', api: 'send_to("api")' }[r.action];
            lines.push((i ? 'elif ' : 'if ') + cond + ':', '    ' + action);
        });
        if (!S.rules.some(r => r.condition && r.action)) lines.push('# Собери полную строку правила — и здесь появится if/elif.');
        const types = new Set(S.nodes.map(n => n.type));
        if (types.has('template')) lines.push('', '# Персонализация = одна формула вместо копипаста', 'message = f"Привет, {name}! Встречаемся {date}."');
        if (types.has('table')) lines.push('', '# Таблица = структурированные данные', 'row = {"date": date, "amount": amount, "category": category}');
        if (types.has('summary')) lines.push('', '# Сводка = цикл + словарь-накопитель', 'totals = {}', 'for row in rows:', '    key = row["category"]', '    totals[key] = totals.get(key, 0) + row["amount"]');
        if (types.has('schedule')) lines.push('', '# Расписание = функцию можно запускать без ручного клика', 'def morning_report():', '    run_pipeline()', '', '# Идея планировщика:', 'every_day("09:00", morning_report)');
        if (types.has('csv')) lines.push('', '# CSV = данные покидают программу в стандартном формате', 'import csv', 'with open("report.csv", "w", newline="") as file:', '    writer = csv.DictWriter(file, fieldnames=["category", "amount"])', '    writer.writeheader()', '    writer.writerows(rows)');
        if (types.has('api')) lines.push('', '# API = проверенное действие во внешнем мире', 'import requests', 'payload = {"name": name, "message": message}', 'requests.post("https://crm.example/api/leads", json=payload)', '', '# Важно: такой POST нельзя заменить попаданием в локальный кэш.');
        if (types.has('folder')) lines.push('', '# Папки = автоматический порядок в файловой системе', 'from pathlib import Path', 'target = Path("archive") / kind / date', 'target.mkdir(parents=True, exist_ok=True)', 'source.replace(target / source.name)');
        if (types.has('json')) lines.push('', '# JSON = структура, которую понимает другая программа', 'import json', 'payload = {"name": name, "message": message, "checked": True}', 'body = json.dumps(payload, ensure_ascii=False)');
        if (types.has('retry')) lines.push('', '# Retry = временный сбой не требует человека у кнопки', 'import time', 'import requests', 'for attempt in range(3):', '    try:', '        response = requests.post(url, json=payload)', '        response.raise_for_status()', '        break', '    except requests.RequestException:', '        if attempt == 2: raise', '        time.sleep(2 ** attempt)');
        if (types.has('mail')) lines.push('', '# Email = ещё один внешний side effect', 'from email.message import EmailMessage', 'msg = EmailMessage()', 'msg["To"] = address', 'msg.set_content(message)', 'smtp.send_message(msg)', '', '# Кэш может помнить текст, но не факт новой отправки.');
        if (types.has('monitor')) lines.push('', '# Наблюдаемость = автоматизация оставляет след, который можно расследовать', 'import logging', 'logging.basicConfig(level=logging.INFO)', 'logging.info("request_id=%s status=%s", request_id, status)', '', '# Если задача упала ночью, утром нужен журнал, а не догадки.');
        return lines.join('\n');
    }
    function showPython() { codePanel.show(); }
    function showHelp() { openModal(`<div class="eyebrow">КОРОТКАЯ ПАМЯТКА</div><h2>Пусть работают машины.</h2><p><b>Поставить:</b> выбери оборудование слева, затем свободное место на полу.<br><b>Соединить:</b> «Линия» → источник → получатель. Стрелки направленные, линий может быть несколько.<br><b>Изменить правило:</b> выбери слова под картой, перетащи слово на доску или нажми на ячейку.<br><b>Понять остановку:</b> нажми на машину и прочитай причину справа.</p><pre class="code">Первый заказ:\nВходящие → Сортировщик → Фотомашина → Выдача\nЕСЛИ ФОТО → РАСПОЗНАТЬ\n\nДве ветки:\nСортировщик → Фотомашина → Выдача\n            → Текстовая  → Выдача\n\nПроверка:\nОбработчики → Проверка → Выдача\n\nПамять:\nВходящие → Память → Сортировщик → обработчики\n                  → Выдача (для повторов)</pre><p><b>Накопитель</b> добавляет места, но не скорость. <b>Вторая фотомашина</b> ускорит работу только с входящей и исходящей линиями. <b>Выдача</b> не примет сырой файл.</p><p class="small">Пробел — пауза; Esc — отменить инструмент; Ctrl/⌘+Z — вернуться к состоянию перед изменением. На телефоне всё доступно кнопками. Карту можно двигать по пустому месту.</p>`); }
    function mainStoryState() {
        return (preview || S.mode === 'puzzle' || labSession) && previewStack.length ? previewStack[0].state : S;
    }
    function memoryCards(list, compact = false) {
        return '<div class="memory-list ' + (compact ? 'compact' : '') + '">' + list.map(m => {
            const d = M.describe(m), c = D.contracts[m.chapter];
            return `<article class="memory-card" data-memory="${esc(m.id)}"><div class="memory-meta">ДЕНЬ ${m.day} · ${esc(c.client)} · ЗАКАЗ ${m.chapter + 1}</div><h3>${esc(d.title)}</h3><p>${esc(d.text)}</p>${compact ? '' : `<div class="memory-evidence">К этому моменту в заказе: ${m.auto} автоматически · ${m.checked} проверено · ${m.hits} из памяти</div>`}</article>`;
        }).join('') + '</div>';
    }
    function showAlbum() {
        const s = mainStoryState(), outside = s !== S;
        openModal(`<div class="eyebrow">АЛЬБОМ МАСТЕРСКОЙ · ${s.memories.length} ВОСПОМИНАНИЙ</div><h2>Это случилось<br><em>в твоём цехе.</em></h2><p>Не список обязательных заданий. Здесь остаются первые результаты, исправленные возвраты и встречи с соседями.</p>${outside ? '<p class="story-notice">Это альбом основной мастерской. Учебная копия его не меняет.</p>' : ''}${s.memories.length ? memoryCards([...s.memories].reverse()) : '<div class="memory-empty"><span aria-hidden="true">▧</span><h3>Первая страница ещё впереди.</h3><p>Доведи файл до выдачи машинами — и здесь появится настоящее событие. У старых сохранений альбом начинается с обновления: прошлое не выдумывается.</p></div>'}<p class="small">Записи входят в сохранение JSON. Здесь нет наград за ежедневный вход и штрафов за отсутствие. «Назад» возвращает и альбом к выбранному состоянию мира.</p><button id="albumExport" class="secondary full">Сохранить мастерскую вместе с альбомом .json</button>`);
        $('modal').classList.add('story-window');
        $('albumExport').onclick = () => download('my-workshop-with-memories.json', E.serialize(s), 'application/json');
    }
    function showNeighbor(ch) {
        ch = M.neighborChapter(S, ch);
        const c = D.contracts[ch], reply = M.reply(S, ch), memories = M.forNeighbor(S, ch);
        openModal(`<div class="eyebrow">${esc(c.place)} · ${esc(c.client)}</div><h2>${esc(c.name)}</h2><p>${esc(S.claimed.includes(ch) ? c.thanks : c.letter)}</p><div class="badge">${S.claimed.includes(ch) ? '✓ Ты уже помог' : ch === S.chapter ? 'Этот заказ у тебя в работе' : 'Познакомитесь дальше по истории'}</div>${reply ? `<section class="neighbor-memory"><div class="eyebrow">А ЕЩЁ Я ПОМНЮ…</div><blockquote>${esc(reply)}</blockquote></section>` : ''}${memories.length ? memoryCards(M.highlights(memories), true) : '<p class="small">Совместные воспоминания появятся после настоящих событий в мастерской.</p>'}<button id="neighborAlbum" class="secondary full">Открыть весь альбом →</button>`);
        $('neighborAlbum').onclick = showAlbum;
    }
    function showDay() { openModal(`<div class="eyebrow">ДЕНЬ ${S.day} · МОЖНО ВЫДОХНУТЬ</div><h2>Вот что сделали твои решения.</h2><div class="summary-grid"><div><small>Машины сделали сами</small><strong>${S.dayStats.auto}</strong></div><div><small>Сделано руками</small><strong>${S.dayStats.manual}</strong></div><div><small>Доход от карточек</small><strong>${S.dayStats.income} ¤</strong></div><div><small>Расходы на обработку</small><strong>${S.dayStats.cost} ¤</strong></div></div><p>Ничего не пропадёт. Цех, правила, очереди и незаконченный заказ дождутся утра. В сводке — только обработка, без наград и покупок.</p><button id="nextDay" class="primary full">Новое утро →</button>`); $('nextDay').onclick = () => { closeModal(); act(() => E.newDay(S), false); }; }
    function menu() {
        openModal(`<div class="eyebrow">ЖИВОЙ ЦЕХ · ЗАКОНЧЕННЫЙ ВЫПУСК 1.1</div><h2>Твоё место. Твои файлы.</h2>
         <div class="settings-list"><button id="exportSave" class="primary">Скачать сохранение .json</button><button id="importSave" class="secondary">Загрузить сохранение .json</button>
         ${S.ending?'<button id="viewEnding" class="secondary">✦ Вспомнить финал</button>':''}
         <button id="menuAlbum" class="secondary">Альбом мастерской · наши истории</button><button id="menuDiscoveries" class="secondary">Мои открытия</button><button id="menuCode" class="secondary">Учебный Python · писать и исполнять</button>
         <button id="menuLab" class="secondary">⚗ Испытательная смена · до и после</button><button id="menuBlueprint" class="secondary">Скачать чертёж без прогресса</button><button id="puzzles" class="secondary">Три маленькие головоломки</button><button id="preferences" class="secondary">Звук, эффекты и крупные подписи</button>
         <button id="exportReport" class="secondary">Скачать отчёт этого прохождения</button><button id="showDemo" class="secondary">${preview||S.mode==='puzzle'?'Вернуться к своей мастерской':'Посмотреть выросшую мастерскую'}</button><button id="newGame" class="secondary danger">Начать новую игру</button></div>
         <p class="small">Автосохранение ${storageOK?'доступно':'недоступно в этом браузере'}. Перенос на другой компьютер — JSON. Принимаются сохранения 0.6, 0.7 и 1.0. Экспорт из демонстрации или испытания сохраняет основную мастерскую, а не учебную копию.</p>`);
        $('exportSave').onclick=()=>{const state=(preview||S.mode==='puzzle'||labSession)&&previewStack.length?previewStack[0].state:S;download('pythonio-save.json',E.serialize(state),'application/json');};
        $('importSave').onclick=()=>$('importFile').click();$('menuAlbum').onclick=showAlbum;$('menuDiscoveries').onclick=showDiscoveries;$('menuCode').onclick=showPython;$('menuLab').onclick=showLab;
        $('menuBlueprint').onclick=()=>download('pythonio-blueprint.json',JSON.stringify(L.capture(S),null,2),'application/json');
        $('puzzles').onclick=showPuzzles;$('preferences').onclick=showSettings;
        if($('viewEnding'))$('viewEnding').onclick=showEnding;
        $('exportReport').onclick=()=>download('pythonio-run.json',JSON.stringify({version:D.version,simulationSeconds:S.time,metrics:S.metrics,totals:S.total,chapter:S.chapter,machines:S.nodes.length-2,links:S.links.length,progress:S.progress,discoveries:S.discoveries,memories:S.memories,ending:S.ending},null,2),'application/json');
        $('showDemo').onclick=()=>{closeModal();if(preview||S.mode==='puzzle')leavePreview();else launchDemo();};
        $('newGame').onclick=()=>{if(!confirm('Начать заново? Сначала скачай JSON, если мастерскую нужно оставить.'))return;closeModal();labSession=null;S=E.create();S.started=true;history=[];preview=false;previewStack=[];selected=null;view.selected=null;lastAuto=0;view.fit();setTab('factory');save();render(true);};
    }
    function download(name, content, mime) { const url = URL.createObjectURL(new Blob([content], { type: mime })), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000); }
    $('importFile').onchange = async (e) => { const file = e.target.files[0]; e.target.value = ''; if (!file)
        return; if (file.size > 2000000) {
        toast('Слишком большой файл сохранения.');
        return;
    } try {
        const next = E.parseSave(await file.text());
        closeModal();
        labSession = null;
        S = next;
        S.started = true;
        preview = false;
        previewStack = [];
        history = [];
        selected = null;
        view.selected = null;
        view.fit();
        setTab('factory');
        save();
        render(true);
        toast('Мастерская восстановлена.');
    }
    catch (err) {
        toast('Импорт отменён. Текущая игра не изменена. ' + err.message);
    } };
    function buildPreset(ch = 0) { const s = E.create(917); s.started = true; s.paused = false; s.coins = 1400; s.chapter = ch; s.unlocked = ['router', 'photo', 'writer', 'buffer', 'check', 'cache']; const add = (t, x, y) => E.build(s, t, x, y).id; const r = add('router', 390, 410), p = add('photo', 675, 325), w = add('writer', 675, 610); E.connect(s, 'in', r); E.connect(s, r, p); E.connect(s, r, w); E.connect(s, p, 'out'); E.connect(s, w, 'out'); E.rule(s, 0, 'image', 'photo'); E.rule(s, 1, 'text', 'writer'); return { s, r, p, w, add }; }
    function stash() { save(); previewStack.push({ state: S, preview, labSession }); history = []; selected = null; view.selected = null; setTool('select'); }
    function launchDemo() { stash(); const { s, r, p, w, add } = buildPreset(4); const p2 = add('photo', 875, 325), q = add('check', 1060, 605), cache = add('cache', 200, 660); E.disconnect(s, 'in', r); E.connect(s, 'in', cache); E.connect(s, cache, r); E.connect(s, cache, 'out'); E.connect(s, r, p2); for (const id of [p, w])
        E.disconnect(s, id, 'out'); for (const id of [p, p2, w])
        E.connect(s, id, q); E.connect(s, q, 'out'); s.mode = 'sandbox'; s.demand = 1.8; s.rep = 17; s.claimed = [0, 1, 2, 3, 4]; s.decor = ['garden', 'terrace', 'sign']; for (let i = 0; i < 1400; i++)
        E.tick(s, .05); S = s; preview = true; setTab('factory'); view.fit(); render(true); toast('Демонстрация. Можно разбирать и менять всё — твой прогресс не затрагивается.'); }
    function leavePreview() { const previous = previewStack.pop(); labSession = previous?.labSession || null; S = previous?.state || E.create(); preview = previous?.preview || false; history = []; selected = null; view.selected = null; setTab('factory'); view.fit(); if (!S.started) {
        $('welcome').showModal();
    } render(true); }
    const PUZZLES = [
        { name: 'Одно лишнее слово', description: 'Машины исправны, но фото застряли. На доске ошиблись одним словом. Измени правило и получи 5 автоматических карточек.', target: 5 },
        { name: 'Проверка — не украшение', description: 'Архиву возвращают непроверенные карточки. Проверка уже стоит, но не на пути. Измени линии и сдай 8 проверенных карточек.', target: 8 },
        { name: 'Соседний компьютер', description: 'Вторая фотомашина стоит без дела. Подключи её к потоку. Обе должны обработать хотя бы 5 файлов.', target: 5 }
    ];
    function showPuzzles() { if (labSession) {
        toast('Сначала вернись из испытательной смены.');
        return;
    } openModal(`<div class="eyebrow">ДРУГОЙ СПОСОБ ПОНЯТЬ ПРАВИЛО</div><h2>Маленькие открытия.</h2><p>Это отдельные задачки на готовом цехе. Твоё прохождение сохранится.</p>${PUZZLES.map((p, i) => `<div class="puzzle-card"><h3>${i + 1}. ${p.name}</h3><p>${p.description}</p><button class="secondary" data-puzzle="${i}">Попробовать</button></div>`).join('')}`); $('modalContent').querySelectorAll('[data-puzzle]').forEach(b => b.onclick = () => { closeModal(); launchPuzzle(+b.dataset.puzzle); }); }
    function launchPuzzle(i) { stash(); const { s, r, p, w, add } = buildPreset(i === 1 ? 3 : 0); s.mode = 'puzzle'; s.puzzle = { index: i, ...PUZZLES[i] }; if (i === 0)
        E.rule(s, 0, 'text', 'photo'); if (i === 1)
        add('check', 1000, 620); if (i === 2)
        add('photo', 890, 490); s.coins = 500; S = s; setTab('factory'); view.fit(); render(true); showPuzzleGoal(); }
    function puzzleGoals() { if (!S.puzzle)
        return []; if (S.puzzle.index === 1)
        return [{ label: 'Проверено и сдано автоматически', value: S.progress[3].checked, target: 8 }]; if (S.puzzle.index === 2)
        return [{ label: 'Две фотомашины обработали по 5 файлов', value: S.nodes.filter(n => n.type === 'photo' && n.done >= 5).length, target: 2 }]; return [{ label: 'Автоматические результаты', value: S.total.auto, target: 5 }]; }
    function puzzleReady() { return puzzleGoals().every(g => g.value >= g.target); }
    function showPuzzleGoal() { openModal(`<div class="eyebrow">ГОЛОВОЛОМКА · ПРОГРЕСС В БЕЗОПАСНОСТИ</div><h2>${esc(S.puzzle.name)}</h2><p>${esc(S.puzzle.description)}</p><button id="returnPuzzle" class="secondary">Вернуться к своей мастерской</button>`); $('returnPuzzle').onclick = () => { closeModal(); leavePreview(); }; }
    function onClaim() {
        if(labSession)return;
        if(S.mode==='sandbox'&&!preview&&S.ending){showEnding();return;}
        if(S.mode==='puzzle'){
            if(puzzleReady()){
                const index=S.puzzle.index;beep('win');leavePreview();E.discovery(S,'puzzle-'+index);save();
                toast('Получилось! Открытие записано. Твоя основная мастерская не изменилась.');
            }return;
        }
        if(S.claimed.includes(S.chapter)){act(()=>E.advance(S),false);if(S.ending)showEnding();return;}
        const r=act(()=>E.claim(S),false);if(!r?.ok)return;beep('win');
        if(!preview&&globalThis.PythonioHost)PythonioHost.orderDone(S.chapter,E.contract(S));
        if(E.contract(S).finale){act(()=>E.finish(S),false);showEnding();return;}
        const lastBeforeFinal=S.chapter===D.contracts.length-2;
        openModal(`<div class="eyebrow">ПИСЬМО В ОТВЕТ · ${esc(E.contract(S).client)}</div><h2>${lastBeforeFinal?'Осталась одна общая просьба.':'У кого-то появился свободный вечер.'}</h2><p>${esc(r.letter)}</p>${M.reply(S,S.chapter) ? `<blockquote class="claim-memory">${esc(M.reply(S,S.chapter))}</blockquote>` : ''}<div class="badge">+${E.contract(S).reward} монет · +${E.contract(S).rep} репутации</div><p>${lastBeforeFinal?'Соседи готовят праздник. Применишь всё, чему уже научилась мастерская?':'Твоя цепочка остаётся. Следующий сосед принесёт новую задачу — расширь то, что уже работает.'}</p><button id="advance" class="primary full">${lastBeforeFinal?'Взять финальный заказ':'Взять следующий заказ'} →</button>`);
        $('advance').onclick=()=>{closeModal();act(()=>E.advance(S),false);};
    }
    function showLab() {
        openModal(`<div class="eyebrow">ПОПРОБУЙ ГИПОТЕЗУ, А НЕ СВОЮ УДАЧУ · 1.0</div><h2>Что, если сделать иначе?</h2><p>Проверим <b>копию</b> цеха на одной игровой минуте. После первого замера перестрой её и повтори: файлы придут в том же порядке. Свою мастерскую и монеты ты не потеряешь.</p><div class="trial-scenarios">${L.scenarios.map((c, i) => `<article class="trial-card"><div class="eyebrow">0${i + 1} / ${c.tag}</div><h3>${c.name}</h3><p>${c.story}</p><div class="trial-card-goal">${c.goals[0].label} · 60 с</div><button class="primary full" data-trial="${c.id}" data-source="template">На учебной цепочке →</button><button class="text-button full" data-trial="${c.id}" data-source="current">Испытать мой цех</button></article>`).join('')}</div><div class="lab-footnote"><b>Это не дедлайн.</b> В основной игре по-прежнему можно думать сколько угодно. В испытании время нужно только для честного сравнения. Память и очереди каждый раз начинают с нуля.</div><div class="buttons"><button class="secondary" id="labImport">Открыть чертёж .json</button><button class="secondary" id="labExport">Скачать чертёж текущего цеха</button></div>`);
        $('modalContent').querySelectorAll('[data-trial]').forEach(b => b.onclick = () => { const id = b.dataset.trial, plan = b.dataset.source === 'current' ? L.capture(S) : L.template(id); closeModal(); launchLab(id, plan); });
        $('labImport').onclick = () => $('blueprintFile').click();
        $('labExport').onclick = () => download('pythonio-blueprint.json', JSON.stringify(L.capture(S), null, 2), 'application/json');
    }
    function launchLab(id, blueprint) {
        let next;
        try {
            next = L.prepare(blueprint, id);
        }
        catch (e) {
            toast('Не удалось открыть чертёж: ' + e.message);
            return;
        }
        if (labSession)
            leavePreview();
        stash();
        labSession = { id, initial: L.capture(next), phase: 'edit', baseline: null, last: null, runs: 0, initialResultPlan: null };
        S = next;
        S.paused = true;
        S.speed = 3;
        preview = true;
        lastAuto = 0;
        accumulator = 0;
        selected = null;
        view.selected = null;
        view.heat = true;
        setTab('factory');
        view.fit();
        render(true);
        toast('Это учебная копия. Начни с исходного замера — потом меняй схему.');
    }
    function startTrial() {
        if (!labSession || labSession.phase === 'running')
            return;
        let next;
        try {
            next = L.prepare(L.capture(S), labSession.id);
        }
        catch (e) {
            toast(e.message);
            return;
        }
        const speed = S.speed;
        S = next;
        S.speed = speed;
        S.paused = false;
        labSession.phase = 'running';
        history = [];
        lastAuto = 0;
        accumulator = 0;
        setTool('select');
        render(true);
    }
    function stopTrial() { if (!labSession)
        return; S.paused = true; labSession.phase = 'edit'; accumulator = 0; render(true); toast('Опыт остановлен. При следующем запуске поток начнётся с нуля.'); }
    function finishTrial() {
        if (!labSession || labSession.phase !== 'running')
            return;
        S.paused = true;
        labSession.phase = 'edit';
        accumulator = 0;
        try {
            const r = L.result(S, labSession.id);
            labSession.runs++;
            labSession.last = r;
            if(r.passed&&previewStack[0]?.state){E.discovery(previewStack[0].state,'lab-'+labSession.id);store.save(previewStack[0].state);}
            if (!labSession.baseline) {
                labSession.baseline = r;
                labSession.initialResultPlan = L.capture(S);
            }
            render(true);
            showComparison();
            beep(r.passed ? 'win' : 'done');
        }
        catch (e) {
            toast(e.message);
        }
    }
    const ru = x => x === null || x === undefined ? '—' : typeof x === 'number' ? x.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) : String(x);
    function showComparison() {
        if (!labSession?.last)
            return;
        const a = labSession.baseline, b = labSession.last, d = L.compare(a, b), c = L.scenario(labSession.id), first = labSession.runs === 1, max = Math.max(a.auto, b.auto, 1);
        const delta = (n, suffix = '') => n === null ? '—' : (n > 0 ? '+' : '') + ru(n) + suffix;
        const row = (name, v1, v2, unit = '') => `<tr><th scope="row">${name}</th><td>${ru(v1)}${unit}</td><td>${ru(v2)}${unit}</td></tr>`;
        openModal(`<div class="eyebrow">${c.name.toUpperCase()} · ОПЫТ ${labSession.runs} · УСЛОВИЯ ОДИНАКОВЫ</div><h2>${first ? 'Вот твоя точка отсчёта.' : d.auto > 0 ? 'Твоё решение даёт больше.' : d.auto === 0 ? 'Скорость та же. Почему?' : 'Не каждая перестройка помогает.'}</h2><p>${first ? 'Теперь выбери одну причину задержки, измени схему и запусти снова. Для фото попробуй второй подключённый компьютер.' : `За ту же минуту: <b>${delta(d.auto)} карточек</b>. Стоимость оборудования изменилась на ${delta(d.investment, ' ¤')}. Смотри не только на скорость, но и на возвраты и расходы.`}</p><div class="comparison-bars"><div><span>Исходно</span><i style="width:${Math.max(1, a.auto / max * 72)}%"></i><b>${a.auto}</b></div><div><span>Сейчас</span><i style="width:${Math.max(1, b.auto / max * 72)}%"></i><b>${b.auto}</b></div></div><table class="trial-table"><thead><tr><th>За 60 игровых секунд</th><th>Исходно</th><th>Сейчас</th></tr></thead><tbody>${row('Поступило файлов', a.offered, b.offered)}${row('Сдано автоматически', a.auto, b.auto)}${row('Возвраты', a.rejected, b.rejected)}${row('Расходы / сданную карточку', a.unitCost, b.unitCost, ' ¤')}${row('Стоимость всех машин', a.investment, b.investment, ' ¤')}${row('Ожидают внутри и перед входом', a.backlog, b.backlog)}${row('Среднее время готового файла', a.meanSeconds, b.meanSeconds, ' с')}</tbody></table><div class="trial-goals">${b.goals.map(g => `<div class="goal ${g.passed ? 'done' : ''}"><span>${g.passed ? '✓' : '○'} ${g.label}</span><b>${ru(g.value)}</b></div>`).join('')}</div><p class="small">${b.passed ? 'Условия выполнены. Попробуй сохранить результат с меньшей стоимостью оборудования.' : 'Это измерение, не наказание. Сначала найди причину, потом меняй одну вещь.'} Расходы включают начатую обработку ещё не сданных файлов. Скорость ×3 сокращает ожидание, но не меняет длину игрового опыта.</p><div class="buttons"><button class="primary" id="changeTrial">${first ? 'Изменить одну вещь →' : 'Вернуться к схеме →'}</button><button class="secondary" id="exportTrial">Скачать сравнение .json</button><button class="secondary" id="exportBlueprint">Скачать этот чертёж</button></div>`);
        $('changeTrial').onclick = closeModal;
        $('exportTrial').onclick = () => download('pythonio-experiment.json', JSON.stringify({ format: 'zhivoy-tsekh.comparison/1', version: D.version, baseline: a, current: b, delta: d, blueprint: L.capture(S) }, null, 2), 'application/json');
        $('exportBlueprint').onclick = () => download('pythonio-blueprint.json', JSON.stringify(L.capture(S), null, 2), 'application/json');
    }
    function renderExperiments() {
        const lab = labSession, reading = E.diagnose(S);
        view.pulse = reading;
        $('claim').hidden = !!lab;
        const labels = document.querySelectorAll('.scorebar small');
        labels[0].textContent = lab ? 'Сдано за этот опыт' : 'Сделано машинами';
        labels[2].textContent = lab ? 'Учебные монеты' : 'Твои монеты';
        labels[3].textContent = lab ? 'Расход / готовую' : 'Репутация';
        if (lab)
            $('rep').innerHTML = (S.total.auto ? ru(S.total.cost / S.total.auto) : '—') + ' <em>¤</em>';
        $('trialBar').hidden = !lab;
        $('advancedTools').hidden = !lab && !preview && !S.total.auto;
        $('heatLegend').hidden = !view.heat;
        $('heatButton').classList.toggle('active', !!view.heat);
        $('heatButton').setAttribute('aria-pressed', String(!!view.heat));
        const serious = reading.filter(n => !['in', 'out'].includes(n.type) && ['blocked', 'busy', 'downstream', 'disconnected'].includes(n.kind));
        const order = { blocked: 0, busy: 1, downstream: 2, disconnected: 3 };
        serious.sort((a, b) => order[a.kind] - order[b.kind]);
        renderHTML('pulseList', view.heat ? `<div class="section-title">Где теряется время</div><p class="small">Наблюдение за последними 12 игровыми секундами. Это подсказка, а не доказательство единственного узкого места.</p>${serious.slice(0, 4).map(n => `<button class="pulse-card ${n.kind}" data-inspect="${n.id}"><strong>${esc(n.name)} <span>${ru(n.utilization)}% работы</span></strong><small>${esc(n.reason)}</small></button>`).join('') || '<p class="small">Явных задержек сейчас не видно. Дай потоку поработать.</p>'}` : '');
        $('pulseList').querySelectorAll('[data-inspect]').forEach(b => b.onclick = () => { selected = b.dataset.inspect; view.selected = selected; render(true); $('inspector').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
        const n = reading.find(n => n.id === selected);
        renderHTML('machinePulse', n ? `<div class="mini-stat"><span>Работа за последние 12 с</span><strong>${ru(n.utilization)}%</strong></div><div class="mini-stat"><span>Ожидание с файлом</span><strong>${ru(n.blocked)}%</strong></div><p class="small">${esc(n.reason)} ${esc(n.tip)}</p>` : '');
        if (tool.startsWith('copy:'))
            $('mapMessage').textContent = 'Копия с теми же настройками. Нажми на свободный пол. Очередь и линии не копируются.';
        const active = !!lab;
        document.body.classList.toggle('in-trial', active);
        $('manual').disabled = active;
        $('pause').disabled = !!lab && lab.phase !== 'running';
        if (lab && lab.phase !== 'running')
            $('pause').textContent = 'Время не идёт';
        document.querySelectorAll('.quick-manual').forEach(b => b.disabled = active);
        $('endDay').disabled = active;
        if (!lab) {
            if (S.mode === 'sandbox' && !preview && !!S.ending) {
                $('chapterLabel').textContent = D.contracts.length + ' ИСТОРИЙ · СВОБОДНЫЙ ВЕЧЕР';
                $('contractName').textContent = 'Праздник состоялся';
                $('letter').textContent = 'Ты помог всем соседям. Старые решения продолжают работать. Теперь сравни разные способы сделать мастерскую быстрее, надёжнее или экономнее.';
                $('claim').disabled = false;
                $('claim').textContent = 'Вспомнить финал →';
                $('reward').textContent = 'Без риска для твоих построек и монет';
            }
            return;
        }
        const c = L.scenario(lab.id), running = lab.phase === 'running';
        $('trialTitle').textContent = c.name;
        $('trialStatus').textContent = running ? `Идёт опыт · ${Math.min(60, Math.floor(S.time))} / 60 с` : 'Планирование · время не идёт';
        $('trialFill').style.width = (running ? Math.min(100, S.time / 60 * 100) : lab.last ? 100 : 0) + '%';
        $('runTrial').textContent = lab.baseline ? 'Повторить с тем же потоком' : 'Замерить исходную схему';
        $('runTrial').disabled = running;
        $('stopTrial').hidden = !running;
        $('trialResults').hidden = !lab.last;
        $('trialResults').disabled = running;
        $('resetTrial').disabled = running;
        $('chapterLabel').textContent = 'ИСПЫТАТЕЛЬНАЯ КОПИЯ · БЕЗ РИСКА';
        $('contractName').textContent = c.name;
        $('letter').textContent = c.story;
        $('clientPlace').textContent = c.client + ' · одинаковые условия';
        $('avatar').textContent = c.client[0];
        $('claim').hidden = true;
        $('reward').textContent = 'Учебные монеты · награды не переносятся';
        renderHTML('goals', c.goals.map(g => `<div class="goal"><span>${g.label}</span></div>`).join(''));
        renderHTML('coach', `<strong>${running ? 'Наблюдай за причиной задержки.' : 'Одна гипотеза — одно изменение.'}</strong><br>${esc(c.hint)}`);
        $('guideAction').textContent = running ? 'Подсветить задержки' : 'Как сравнивать';
        $('mapCaption').textContent = 'ИСПЫТАТЕЛЬНАЯ СМЕНА · ТВОЁ ПРОХОЖДЕНИЕ НЕ МЕНЯЕТСЯ';
        $('dayLabel').textContent = 'ОПЫТ ' + (lab.runs + (running ? 1 : 0));
        $('saveState').textContent = '◌ Учебная копия · основная мастерская сохранена отдельно';
        $('mapMessage').textContent = tool.startsWith('copy:') ? 'Выбери место копии, затем подключи её с двух сторон.' : running ? 'Сейчас измеряем. Останови опыт, чтобы менять схему.' : tool === 'link' ? (linkFrom ? 'Теперь нажми на получателя.' : 'Сначала источник, затем получатель.') : lab.last ? 'Последняя минута показана на карте. Перестрой и повтори — память и очереди начнут с нуля.' : 'Сначала замерь, затем измени одну вещь. Следующий запуск очистит очереди и память.';
    }
    function bindExperiments() {
        $('labButton').onclick = showLab;
        $('heatButton').onclick = () => { view.heat = !view.heat; render(true); };
        $('runTrial').onclick = startTrial;
        $('stopTrial').onclick = stopTrial;
        $('trialResults').onclick = showComparison;
        $('leaveTrial').onclick = () => { if (labSession?.phase === 'running' && !confirm('Остановить опыт и вернуться к своей мастерской?'))
            return; leavePreview(); };
        $('resetTrial').onclick = () => { if (!labSession)
            return; if (!confirm('Вернуть первоначальный чертёж испытания? Результаты замеров останутся.'))
            return; const speed = S.speed; S = L.prepare(labSession.initial, labSession.id); S.speed = speed; S.paused = true; history = []; selected = null; view.selected = null; render(true); };
        $('blueprintFile').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f)
            return; try {
            if (f.size > 200000)
                throw Error('Чертёж слишком большой.');
            const plan = L.readBlueprint(await f.text());
            closeModal();
            launchLab(labSession?.id || 'rush', plan);
        }
        catch (err) {
            toast('Чертёж не открыт: ' + err.message + ' Твоя игра не изменена.');
        } };
    }
    function showSettings(){
        openModal(`<div class="eyebrow">СВОЙ ТЕМП · НЕТ ОБЯЗАТЕЛЬНОЙ ГОНКИ</div><h2>Как тебе удобнее?</h2><div class="settings-list"><button class="secondary" id="prefSound">Звук: ${sound?'включён':'выключен'}</button><button class="secondary" id="prefMotion">Спокойные эффекты: ${document.body.classList.contains('calm')?'включены':'выключены'}</button><button class="secondary" id="prefText">Крупные подписи: ${document.body.classList.contains('large-text')?'включены':'выключены'}</button></div><p class="small">Пауза доступна всегда. Диалоги останавливают цех. Скрытая вкладка не добывает доход и не теряет заказы. Эти настройки сохраняются отдельно от мастерской, когда браузер разрешает хранилище.</p>`);
        $('prefSound').onclick=()=>{sound=!sound;beep();rememberPreferences();$('prefSound').textContent='Звук: '+(sound?'включён':'выключен');};
        $('prefMotion').onclick=()=>{document.body.classList.toggle('calm');rememberPreferences();$('prefMotion').textContent='Спокойные эффекты: '+(document.body.classList.contains('calm')?'включены':'выключены');};
        $('prefText').onclick=()=>{document.body.classList.toggle('large-text');rememberPreferences();view.resize();$('prefText').textContent='Крупные подписи: '+(document.body.classList.contains('large-text')?'включены':'выключены');};
    }

    function rememberPreferences(){try{localStorage.setItem('zhivoy-tsekh-preferences',JSON.stringify({sound,calm:document.body.classList.contains('calm'),large:document.body.classList.contains('large-text')}));}catch(_){} }

    function showDiscoveries() {
        const s=labSession&&previewStack.length?previewStack[0].state:S;
        const entries=[
            ['Первый свободный вдох','Получить результат без ручного клика.',s.total.auto>0],
            ['Две дорожки','Разделить фотографии и тексты.',s.claimed.includes(1)],
            ['Работать шире','Вторая машина действительно помогает.',s.claimed.includes(2)],
            ['Можно доверять','Сдать семейный архив с проверкой.',s.claimed.includes(3)],
            ['Помнить лучше','Перестать делать одинаковую работу.',s.claimed.includes(4)],
            ['Свободный вечер','Помочь всем соседям и прийти на праздник.',!!s.ending],
            ['Написано мной','Проверить и установить исполняемый учебный код.',s.discoveries.includes('python')],
            ['Три открытия в словах','Пройти все три урока кода.',[0,1,2].every(i=>s.discoveries.includes('lesson-'+i))],
            ['Смотрю на причину','Решить три головоломки.',[0,1,2].every(i=>s.discoveries.includes('puzzle-'+i))],
            ['Не угадываю — измеряю','Выполнить условия хотя бы одного испытания.',s.discoveries.some(v=>v.startsWith('lab-'))],
            ['Здесь хорошо','Обустрой свой двор всеми тремя украшениями.',s.decor.length===3]
        ];
        openModal(`<div class="eyebrow">ТВОИ ОТКРЫТИЯ · ${entries.filter(e=>e[2]).length} / ${entries.length}</div><h2>Не уровни. Понятые идеи.</h2><p>Никаких ежедневных серий и штрафов за отсутствие. Это память о том, что ты попробовал.</p><div class="discovery-grid">${entries.map(([title,text,done])=>`<article class="discovery ${done?'done':''}"><span>${done?'✓':'○'}</span><div><h3>${title}</h3><p>${text}</p></div></article>`).join('')}</div>`);
    }

    function showEnding() {
        if (!S.ending) { toast('Праздник откроется после шестого заказа.'); return; }
        const e=S.ending;
        openModal(`<div class="ending-sky" aria-hidden="true"><span>✦</span><i>⌂</i><span>✧</span><i>⌂</i><span>✦</span></div><div class="eyebrow">ИСТОРИЯ ЗАВЕРШЕНА · МАСТЕРСКАЯ ОСТАЁТСЯ</div>
         <h2>У города появился<br><em>свободный вечер.</em></h2>
         <p>${esc(D.contracts[D.contracts.length-1].thanks)}</p>
         <div class="summary-grid"><div><small>Машины сделали сами</small><strong>${e.automatic}</strong></div><div><small>Твоих ручных действий</small><strong>${e.manual}</strong></div><div><small>Историй завершено</small><strong>${D.contracts.length} / ${D.contracts.length}</strong></div><div><small>Машин в мастерской</small><strong>${e.machines}</strong></div></div>
         ${e.memories?.length ? `<section class="ending-memories"><div class="eyebrow">ТО, ЧТО МЫ БУДЕМ ВСПОМИНАТЬ</div>${memoryCards(M.highlights(e.memories), true)}</section>` : ''}
         <p class="small">Это итог на момент финала. Новые результаты свободной игры его не переписывают. Ты можешь продолжать, испытывать схемы и учиться коду — или спокойно закончить здесь.</p>
         <div class="buttons"><button id="visitFestival" class="primary">Выйти к соседям →</button><button id="continueFree" class="secondary">Продолжить мастерскую</button><button id="endingSave" class="secondary">Сохранить мой мир .json</button></div>
         <div class="ending-credit">ЖИВОЙ ЦЕХ · 1.1<br><small>Для aka-gst. Про решения, которые возвращают время людям.</small></div>`);
        $('modal').classList.add('ending-window');
        $('visitFestival').onclick=()=>{closeModal();setTab('town');save();};
        $('continueFree').onclick=()=>{closeModal();setTab('factory');save();};
        $('endingSave').onclick=()=>download('my-workshop-finished.json',E.serialize(S),'application/json');
    }

    const codePanel=WorkshopCodePanel.mount({
        state:()=>S, open:content=>{openModal(content);$('modal').classList.add('code-window');}, close:closeModal,
        save,toast,download,act,locked:()=>labSession?.phase==='running',
        discovery:id=>{E.discovery(S,id);save();}, install:source=>act(()=>E.setProgram(S,source))
    });
    function init() {
        for (const [value, label] of Object.entries(D.conditions))
            $('condition').add(new Option(label, value));
        for (const [value, label] of Object.entries(D.actions))
            $('action').add(new Option(label, value));
        renderHTML('wordBank', [...Object.entries(D.conditions).map(([value, label]) => ({ part: 'condition', value, label })), ...Object.entries(D.actions).map(([value, label]) => ({ part: 'action', value, label }))].map(w => `<button class="word ${w.part}" draggable="true" data-word="${w.value}" data-part="${w.part}">${w.label}</button>`).join(''));
        $('wordBank').querySelectorAll('[data-word]').forEach(b => { const word = { value: b.dataset.word, part: b.dataset.part }; b.ondragstart = e => e.dataTransfer.setData('text/plain', JSON.stringify(word)); b.onclick = () => { held = word; const r = S.rules[activeRow]; act(() => E.rule(S, activeRow, word.part === 'condition' ? word.value : r.condition, word.part === 'action' ? word.value : r.action)); held = null; }; });
        $('condition').onchange = () => act(() => E.rule(S, activeRow, $('condition').value || null, S.rules[activeRow].action));
        $('action').onchange = () => act(() => E.rule(S, activeRow, S.rules[activeRow].condition, $('action').value || null));
        $('clearRule').onclick = () => act(() => E.rule(S, activeRow, null, null));
        document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => setTab(b.dataset.tab));
        document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => setTool(b.dataset.mode));
        document.querySelectorAll('[data-speed]').forEach(b => b.onclick = () => { S.speed = +b.dataset.speed; render(true); save(); });
        $('manual').onclick = () => act(() => E.manual(S), false);
        $('guideAction').onclick = runGuide;
        $('pause').onclick = () => { if (labSession && labSession.phase !== 'running') {
            toast('При планировании время стоит. Запусти замер верхней кнопкой.');
            return;
        } S.paused = !S.paused; render(true); save(); };
        $('undo').onclick = () => { if (labSession?.phase === 'running')
            return; const old = history.pop(); if (!old)
            return; try {
            S = E.parseSave(old);
            selected = null;
            view.selected = null;
            save();
            render(true);
            toast('Вернулись к состоянию перед последним изменением, включая время и деньги.');
        }
        catch (e) {
            toast(e.message);
        } };
        $('rework').onclick = () => act(() => E.rework(S));
        $('claim').onclick = onClaim;
        $('pythonButton').onclick = showPython;
        $('helpButton').onclick = showHelp;
        $('menuButton').onclick = menu;
        $('endDay').onclick = showDay;
        $('zoomIn').onclick = () => view.zoomBy(1.25);
        $('zoomOut').onclick = () => view.zoomBy(.8);
        $('fit').onclick = () => view.fit();
        $('start').onclick = () => { $('welcome').close(); S.started = true; S.paused = false; preview = false; save(); render(true); };
        $('demo').onclick = () => { $('welcome').close(); launchDemo(); };
        const mobile = document.createElement('button');
        mobile.className = 'secondary quick-manual';
        mobile.textContent = '✋ Сделать самому';
        mobile.onclick = () => act(() => E.manual(S), false);
        document.querySelector('.command-bar').prepend(mobile);
        document.addEventListener('keydown', e => { if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName))
            return; if (e.key === 'Escape') {
            if (!$('modal').open)
                setTool('select');
            return;
        } if ($('modal').open || $('welcome').open)
            return; if (e.code === 'Space') {
            e.preventDefault();
            $('pause').click();
        } if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            $('undo').click();
        } });
        bindExperiments();
        window.addEventListener('beforeunload', save);
        document.addEventListener('visibilitychange', () => { if (document.hidden)
            save(); lastFrame = 0; accumulator = 0; });
        $('albumButton').onclick=showAlbum;
        $('discoveriesButton').onclick=showDiscoveries;
        if (globalThis.PythonioHost) { PythonioHost.onHello(h => { const note = document.querySelector('#welcome .welcome-body p.small'); if (note && h.known.length) note.textContent = (h.player ? h.player + ', ' : '') + 'ты уже знаешь ' + h.known.join(', ') + '. Лекций про это не будет: здесь эти приёмы сразу работают с файлами, таблицами и API.'; render(true); }); PythonioHost.start(); }
        if (!loaded || !S.started)
            $('welcome').showModal();
        render(true);
        requestAnimationFrame(frame);
    }
    function frame(now) { if (!lastFrame)
        lastFrame = now; const dt = Math.min(.15, (now - lastFrame) / 1000); lastFrame = now; if (!document.hidden) {
        accumulator += dt * S.speed;
        let ticks = 0;
        while (accumulator >= .05 && ticks++ < 10) {
            if (!labSession || labSession.phase === 'running')
                E.tick(S, .05);
            accumulator -= .05;
            if (labSession?.phase === 'running' && S.time >= 60 - .00001) {
                finishTrial();
                break;
            }
        }
    } if (S.total.auto > lastAuto) {
        if (S.metrics.firstAuto !== null && S.total.auto === 1 && !preview)
            toast('Получилось! Первый заказ полностью сделали машины.');
        beep('done');
        lastAuto = S.total.auto;
    } view.draw(S); if (now - lastRender > 250) {
        render();
        lastRender = now;
    } if (now - lastSave > 2000) {
        save();
        lastSave = now;
    } requestAnimationFrame(frame); }
    window.Workshop = { get state() { return S; }, engine: E, view, render, launchDemo, launchPuzzle, leavePreview, save, showLab, launchLab, startTrial, stopTrial, finishTrial, showComparison, showEnding, showPython, showDiscoveries, showAlbum, showNeighbor, get labSession() { return labSession; } };
    init();
})();
