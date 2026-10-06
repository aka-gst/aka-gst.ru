/* Pure deterministic, bounded simulation. No DOM, wall clock, eval, network or AI API. */
(function (g, f) { if (typeof module === 'object' && module.exports)
    module.exports = f(require('./data.js'), require('./python-mini.js'), require('./memories.js'));
else
    g.WorkshopEngine = f(g.WorkshopData, g.WorkshopPython, g.WorkshopMemories); })(globalThis, function (D, P, M) {
    'use strict';
    const fail = message => ({ ok: false, message }), ok = (message = '', extra = {}) => ({ ok: true, message, ...extra });
    const node = (id, type, x, y) => ({ id, type, x, y, level: 1, spent: D.machines[type].price, queue: [], active: null, status: 'Ожидает файл', done: 0, busy: 0, pulse: [] });
    const progress = () => ({ manual: 0, auto: 0, image: 0, text: 0, checked: 0, hits: 0, personalized: 0, tabulated: 0, summarized: 0, scheduled: 0, exported: 0, sent: 0, foldered: 0, jsoned: 0, emailed: 0, resilient: 0, idempotent: 0, monitored: 0 });
    const get = (s, id) => s.nodes.find(n => n.id === id), contract = s => D.contracts[Math.min(s.chapter, D.contracts.length - 1)];
    function rng(s) { s.seed = (Math.imul(1664525, s.seed) + 1013904223) >>> 0; return s.seed / 4294967296; }
    function note(s, text) { s.log.unshift({ t: s.time, text }); s.log = s.log.slice(0, 24); }
    function job(s) { const c = contract(s), id = s.nextJob++, type = c.type === 'mixed' ? (id % 2 ? 'image' : 'text') : c.type; return { id, type, contract: s.chapter, born: s.time, key: type + '-' + (c.repeats ? ((c.repeatOffset || 0) + id % 6) : id), prepared: false, checked: false, personalized: false, tabulated: false, summarized: false, scheduled: false, exported: false, sent: false, foldered: false, jsoned: false, emailed: false, resilient: false, idempotent: false, monitored: false, apiFailed: false, cached: false, target: null, returned: false, defect: !!c.checked && rng(s) < .25, trace: ['Входящие'] }; }
    function create(seed = 20260910) { const s = { version: 10, seed: seed >>> 0, started: false, paused: false, speed: 1, time: 0, day: 1, phase: 'day', dayStart: 0, mode: 'campaign', chapter: 0, coins: 140, rep: 0, unlocked: ['router', 'photo'], rules: Array.from({ length: 4 }, () => ({ condition: null, action: null })), nodes: [node('in', 'in', 120, 410), node('out', 'out', 1230, 410)], links: [], transit: [], quarantine: [], memory: {}, nextNode: 1, nextJob: 1, spawnClock: 0, demand: .72, progress: D.contracts.map(progress), claimed: [], total: { delivered: 0, auto: 0, manual: 0, rejected: 0, hits: 0, cost: 0, income: 0 }, recent: [], events: [], log: [], decor: [], dayStats: { auto: 0, manual: 0, income: 0, cost: 0 }, metrics: { firstAuto: null, firstRule: null, rulesChanged: 0, builds: 0, claims: 0 }, peak: 0, puzzle: null, feed: null, ending: null, program: null, codeDraft: "", discoveries: [], memories: [] }; for (let i = 0; i < 3; i++)
        s.nodes[0].queue.push(job(s)); note(s, 'Лида оставила три фотографии на входящем столе.'); return s; }
    const inFlight = s => s.nodes.reduce((v, n) => v + n.queue.length + !!n.active, 0) + s.transit.length + s.quarantine.length + (s.feed?.waiting.length || 0);
    const incoming = (s, id) => s.transit.filter(t => t.to === id).length;
    const space = (s, n) => n.queue.length + !!n.active + incoming(s, n.id) < D.machines[n.type].capacity;
    const edges = (s, id) => s.links.filter(l => l.from === id).map(l => get(s, l.to)).filter(Boolean);
    function path(s, a, b, seen = new Set()) { if (a === b)
        return true; if (seen.has(a))
        return false; seen.add(a); return edges(s, a).some(n => path(s, n.id, b, seen)); }
    function reaches(s, id, type, seen = new Set()) { const n = get(s, id); if (!n || seen.has(id))
        return false; if (n.type === type)
        return true; seen.add(id); return edges(s, id).some(v => reaches(s, v.id, type, seen)); }
    function connect(s, from, to) { const a = get(s, from), b = get(s, to); if (!a || !b)
        return fail('Выбери две машины.'); if (from === to)
        return fail('Нельзя соединить машину с самой собой.'); if (a.type === 'out' || b.type === 'in')
        return fail('Вход — источник, выдача — конец цепочки.'); if (s.links.some(l => l.from === from && l.to === to))
        return fail('Эта линия уже есть.'); if (path(s, to, from))
        return fail('Получится круг. Строй цепочки без циклов.'); if (s.links.length >= 80)
        return fail('Предел этой мастерской: 80 линий.'); s.links.push({ from, to }); note(s, D.machines[a.type].name + ' → ' + D.machines[b.type].name); return ok('Линия готова.'); }
    function disconnect(s, from, to) { if (!s.links.some(l => l.from === from && l.to === to))
        return fail('Линия уже отсутствует.'); s.links = s.links.filter(l => !(l.from === from && l.to === to)); return ok('Линия убрана. Файлы, уже отправленные по ней, доедут.'); }
    function build(s, type, x, y) { const m = D.machines[type]; if (!m || ['in', 'out'].includes(type) || !s.unlocked.includes(type))
        return fail('Машина пока не открыта.'); if (s.nodes.length >= 32)
        return fail('Предел этой мастерской: 30 своих машин.'); if (s.coins < m.price)
        return fail('Не хватает ' + (m.price - s.coins) + ' монет. Сделай несколько заказов самому.'); if (!Number.isFinite(x) || !Number.isFinite(y) || x < 70 || x > 1310 || y < 325 || y > 730)
        return fail('Поставь на пол ниже доски правил.'); if (s.nodes.some(n => Math.abs(n.x - x) < 132 && Math.abs(n.y - y) < 112))
        return fail('Здесь тесно. Выбери свободное место.'); const n = node('n' + s.nextNode++, type, x, y); s.nodes.push(n); s.coins -= m.price; s.metrics.builds++; note(s, 'Поставлено: ' + m.name); return ok('Проведи к машине входящую и исходящую линии.', { id: n.id }); }
    function upgrade(s, id) { const n = get(s, id); if (!n || ['in', 'out'].includes(n.type))
        return fail('Эта машина не улучшается.'); if (n.level >= 4)
        return fail('Максимальный уровень.'); const price = Math.ceil(D.machines[n.type].price * .65 * n.level); if (s.coins < price)
        return fail('Нужно ' + price + ' монет.'); s.coins -= price; n.spent += price; n.level++; return ok('Уровень ' + n.level + '. Новые файлы обрабатываются быстрее.'); }
    function move(s, id, x, y) { const n = get(s, id); if (!n)
        return fail('Нет машины.'); if (!Number.isFinite(x) || !Number.isFinite(y) || x < 70 || x > 1310 || y < 325 || y > 730)
        return fail('Выбери свободный пол.'); if (s.nodes.some(v => v.id !== id && Math.abs(v.x - x) < 132 && Math.abs(v.y - y) < 112))
        return fail('Слишком близко к другой машине.'); n.x = x; n.y = y; return ok(); }
    // A copy contains configuration, never live jobs, links, counters or warmed memory.
    function configurationCost(type, level = 1) { let value = D.machines[type].price; for (let i = 1; i < level; i++)
        value += Math.ceil(D.machines[type].price * .65 * i); return value; }
    function duplicate(s, id, x, y) {
        const original = get(s, id);
        if (!original || ['in', 'out'].includes(original.type))
            return fail('Копировать можно только своё оборудование.');
        const price = configurationCost(original.type, original.level);
        if (s.coins < price)
            return fail('Копия уровня ' + original.level + ' стоит ' + price + ' монет.');
        const result = build(s, original.type, x, y);
        if (!result.ok)
            return result;
        const copy = get(s, result.id);
        s.coins -= price - D.machines[original.type].price;
        copy.level = original.level;
        copy.spent = price;
        return ok('Копия готова. Подключи обе линии — без них она не работает.', { id: copy.id });
    }
    // Observed at the start of a fixed simulation tick, not inferred from wall-clock time.
    function sample(s, n, dt) {
        if (!n.pulse)
            n.pulse = [];
        const second = Math.floor(s.time);
        let b = n.pulse[n.pulse.length - 1];
        if (!b || b.second !== second) {
            b = { second, work: 0, blocked: 0, idle: 0 };
            n.pulse.push(b);
        }
        const state = n.active && n.active.left > 0 && !n.active.finished ? 'work' : n.active || n.queue.length ? 'blocked' : 'idle';
        b[state] += dt;
        n.pulse = n.pulse.filter(v => v.second > second - 12);
    }
    function diagnose(s) {
        return s.nodes.map(n => {
            const samples = (n.pulse || []).filter(v => v.second > Math.floor(s.time) - 12);
            const sums = samples.reduce((a, b) => ({ work: a.work + b.work, blocked: a.blocked + b.blocked, idle: a.idle + b.idle }), { work: 0, blocked: 0, idle: 0 });
            const observed = sums.work + sums.blocked + sums.idle;
            const utilization = observed >= .5 ? Math.round(sums.work / observed * 100) : null;
            const blocked = observed >= .5 ? Math.round(sums.blocked / observed * 100) : null;
            const capacity = D.machines[n.type].capacity, queued = n.queue.length + !!n.active + incoming(s, n.id);
            const connected = path(s, 'in', n.id) && path(s, n.id, 'out');
            let kind = 'idle', reason = 'Ждёт новую работу.', tip = 'Не улучшай машину только потому, что она простаивает.';
            if (!connected) {
                kind = 'disconnected';
                reason = 'Нет полного пути от входа до выдачи.';
                tip = 'Проверь входящую и исходящую линии, включая соседние машины.';
            }
            else if (queued && /Нет правила|Нужна линия|Пришёл|Пришло|Сначала обработай|Нет монет|Нет исходящей/.test(n.status)) {
                kind = 'blocked';
                reason = n.status;
                tip = 'Сначала исправь причину остановки. Ускорение здесь не поможет.';
            }
            else if (utilization !== null && utilization >= 80) {
                kind = 'busy';
                reason = 'Обрабатывает почти всё время.';
                tip = 'При растущей очереди попробуй улучшение или вторую подключённую машину.';
            }
            else if (n.active?.finished || n.status === 'Следующая машина заполнена') {
                kind = 'downstream';
                reason = 'Ждёт место дальше по цепочке.';
                tip = 'Посмотри, кто после этой машины не успевает. Накопитель только отсрочит затор.';
            }
            else if (n.active) {
                kind = 'working';
                reason = 'Работает, запас мощности ещё есть.';
                tip = 'Сравни результат испытаний перед покупкой улучшений.';
            }
            else if (n.type === 'out') {
                reason = 'Выдача ждёт готовую карточку.';
                tip = 'Это конец цепочки. Неподготовленное возвращается на доработку.';
            }
            return { id: n.id, type: n.type, name: D.machines[n.type].name, kind, reason, tip, utilization, blocked, observed, queued, capacity, connected };
        });
    }
    function returnJobs(s, jobs) { const input = get(s, 'in'); for (const j of jobs) {
        j.target = null;
        if (input.queue.length < 40)
            input.queue.push(j);
        else
            s.quarantine.push(j);
    } }
    function remove(s, id) { const n = get(s, id); if (!n || ['in', 'out'].includes(n.type))
        return fail('Вход и выдачу нельзя снести.'); const jobs = [...n.queue, ...(n.active ? [n.active.job] : []), ...s.transit.filter(t => t.from === id || t.to === id).map(t => t.job)]; s.transit = s.transit.filter(t => t.from !== id && t.to !== id); s.links = s.links.filter(l => l.from !== id && l.to !== id); s.nodes = s.nodes.filter(v => v.id !== id); returnJobs(s, jobs); const amount = Math.floor(n.spent * .75); s.coins += amount; return ok('Вернулось ' + amount + ' монет. Все файлы сохранены.'); }
    function rule(s, row, condition, action) { if (!Number.isInteger(row) || row < 0 || row > 3)
        return fail('Нет такой строки.'); if (condition !== null && !D.conditions[condition] || action !== null && !D.actions[action])
        return fail('Неизвестное слово.'); s.program = null; s.rules[row] = { condition, action }; s.metrics.rulesChanged++; if (condition && action && s.metrics.firstRule === null)
        s.metrics.firstRule = s.time; note(s, 'Правило ' + (row + 1) + ': ' + (D.conditions[condition] || '…') + ' → ' + (D.actions[action] || '…')); return ok('Новое правило уже действует.'); }
    const matches = (p, c) => c === 'all' || c === 'ready' && p.prepared || c === p.type;
    function choose(s, n, p) {
        let dest = edges(s, n.id), target = p.target;
        if (!dest.length)
            return { reason: 'Нет исходящей линии' };
        if (n.type === 'router') {
            const r = s.rules.find(r => r.condition && r.action && matches(p, r.condition));
            target = s.program ? s.program.table[P.key({ type: p.type, ready: p.prepared, checked: p.checked })] : (r ? r.action : null);
            if (!target)
                return { reason: 'Нет правила для ' + (p.type === 'image' ? 'фото' : 'текста') };
        }
        if (n.type === 'cache')
            target = p.prepared ? 'out' : p.type === 'image' ? 'photo' : 'writer';
        if (target) {
            dest = dest.filter(v => v.type === target || (['buffer', 'cache', 'router'].includes(v.type) && reaches(s, v.id, target)));
            if (!dest.length)
                return { reason: 'Нужна линия: ' + D.machines[target].name };
        }
        dest = dest.filter(v => space(s, v));
        if (!dest.length)
            return { reason: 'Следующая машина заполнена' };
        dest.sort((a, b) => (a.queue.length + !!a.active + incoming(s, a.id)) - (b.queue.length + !!b.active + incoming(s, b.id)) || a.id.localeCompare(b.id));
        return { node: dest[0], target };
    }
    function startJob(s, n) { if (n.active || !n.queue.length)
        return; const p = n.queue[0]; let reason = null, cost = 0; if (n.type === 'photo' && p.type !== 'image')
        reason = 'Пришёл текст. Нужна другая ветка.'; if (n.type === 'writer' && p.type !== 'text')
        reason = 'Пришло фото. Нужна другая ветка.'; if (['check','template','table','summary','schedule','csv','api','retry','idempotency','json','mail'].includes(n.type) && !p.prepared)
        reason = 'Сначала обработай файл.'; if (n.type === 'template' && p.type !== 'text')
        reason = 'Шаблон работает с текстом.'; if (n.type === 'table' && p.type !== 'image')
        reason = 'В таблицу здесь идут распознанные фото чеков.'; if (n.type === 'summary' && !p.tabulated)
        reason = 'Сводка собирается из строк таблицы.'; if (n.type === 'csv' && !p.tabulated)
        reason = 'CSV выгружается из структурированных строк таблицы.'; if (n.type === 'api' && !p.checked)
        reason = 'Во внешнюю систему отправляем только после Проверки.'; if (n.type === 'retry' && !p.checked)
        reason = 'Повторы нужны только после Проверки, перед внешним запросом.'; if (n.type === 'idempotency' && !p.checked)
        reason = 'Ключ операции ставим только на проверенный запрос перед внешним side effect.'; if (n.type === 'monitor' && !(p.sent || p.emailed))
        reason = 'Журнал ставим после реального внешнего действия: сначала API или email.'; if (n.type === 'json' && !p.checked)
        reason = 'JSON для внешнего сервиса собираем только после Проверки.'; if (n.type === 'mail' && !p.checked)
        reason = 'Письмо отправляем только после Проверки.'; if (n.type === 'photo')
        cost = 2; if (['writer','check','template','table','summary','schedule','csv','api','retry','idempotency','monitor','folder','json','mail'].includes(n.type))
        cost = 1; if (reason) {
        n.status = reason;
        return;
    } if (s.coins < cost) {
        n.status = 'Нет монет на обработку';
        return;
    } s.coins -= cost; s.total.cost += cost; s.dayStats.cost += cost; n.queue.shift(); const duration = D.machines[n.type].seconds / n.level; n.active = { job: p, left: duration, duration, finished: false }; n.status = 'Обрабатывает'; }
    function process(s, n, a) { const p = a.job; if (p.target === n.type)
        p.target = null; switch (n.type) {
        case 'photo':
        case 'writer':
            p.prepared = true;
            p.trace.push(n.type === 'photo' ? 'Фото распознано' : 'Текст оформлен');
            break;
        case 'template':
            p.personalized = true;
            p.trace.push('Персонализировано');
            break;
        case 'table':
            p.tabulated = true;
            p.trace.push('Записано в таблицу');
            break;
        case 'summary':
            p.summarized = true;
            p.trace.push('Сведено по категориям');
            break;
        case 'schedule':
            p.scheduled = true;
            p.trace.push('Поставлено на ежедневный запуск');
            break;
        case 'csv':
            p.exported = true;
            p.trace.push('Выгружено в CSV');
            break;
        case 'retry':
            p.resilient = true;
            p.trace.push('Настроены 3 попытки с паузой');
            break;
        case 'idempotency':
            p.idempotent = true;
            p.trace.push('Добавлен устойчивый ключ операции: request_id=' + p.id);
            break;
        case 'monitor':
            p.monitored = true;
            p.trace.push('LOG: внешняя операция зафиксирована · status=ok · request_id=' + p.id);
            break;
        case 'api': {
            const c = D.contracts[p.contract] || {};
            if (c.resilient && !p.resilient) {
                p.sent = false; p.apiFailed = true;
                p.trace.push('API: временная ошибка 503 — нет политики повтора');
            } else if (c.ambiguous && !p.idempotent) {
                p.sent = false; p.apiFailed = true;
                p.trace.push('API: запрос мог выполниться, но ответ потерян — Retry без ID KEY опасен дублем');
            } else {
                p.sent = true; p.apiFailed = false;
                if (c.ambiguous) p.trace.push('API: ответ потерян → повтор с тем же request_id → сервер вернул тот же результат без дубля');
                else if (c.resilient) p.trace.push('API: 503 → пауза → повтор → успех');
                else p.trace.push('Отправлено во внешнюю CRM');
            }
            break;
        }
        case 'folder':
            p.foldered = true;
            p.trace.push('Разложено по папкам');
            break;
        case 'json':
            p.jsoned = true;
            p.trace.push('Собрано в JSON');
            break;
        case 'mail':
            p.emailed = true;
            p.trace.push('Отправлено по email');
            break;
        case 'check':
            p.checked = true;
            p.defect = false;
            p.trace.push('Проверено');
            break;
        case 'cache':
            if (s.memory[p.key]) {
                p.prepared = true;
                p.checked = s.memory[p.key].checked;
                p.personalized = Boolean(s.memory[p.key].personalized);
                p.tabulated = Boolean(s.memory[p.key].tabulated);
                p.summarized = Boolean(s.memory[p.key].summarized);
                p.scheduled = Boolean(s.memory[p.key].scheduled);
                p.exported = Boolean(s.memory[p.key].exported);
                p.sent = false;
                p.foldered = Boolean(s.memory[p.key].foldered);
                p.jsoned = Boolean(s.memory[p.key].jsoned);
                p.emailed = false;
                p.resilient = false;
                p.idempotent = false;
                p.monitored = false;
                p.apiFailed = false;
                p.cached = true;
                p.defect = false;
                s.total.hits++;
                p.trace.push('Взято из памяти');
            }
            else
                p.trace.push('Новое: нужен обработчик');
            break;
    } a.finished = true; n.done++; }
    function delivery(s, p, manual = false) { const c = D.contracts[Math.min(p.contract, D.contracts.length - 1)]; const needPersonal = c.personalized || (c.personalizedText && p.type === 'text'); const needTable = c.tabulated || (c.tabulatedImage && p.type === 'image'); const needSummary = !!c.summarized; const needSchedule = !!c.scheduled; const needExport = !!c.exported; const needSent = !!c.sent; const needFolder = !!c.foldered; const needJson = !!c.jsoned; const needEmail = !!c.emailed; const needResilient = !!c.resilient; const needIdempotent = !!c.idempotent; const needMonitored = !!c.monitored; if (!p.prepared || c.checked && !p.checked || needPersonal && !p.personalized || needTable && !p.tabulated || needSummary && !p.summarized || needSchedule && !p.scheduled || needExport && !p.exported || needSent && !p.sent || needFolder && !p.foldered || needJson && !p.jsoned || needEmail && !p.emailed || needResilient && !p.resilient || needIdempotent && !p.idempotent || needMonitored && !p.monitored || p.defect) {
        s.total.rejected++;
        p.returned = true;
        p.target = null;
        s.quarantine.push(p);
        note(s, 'Возврат №' + p.id + ': ' + (!p.prepared ? 'файл не обработан' : needPersonal && !p.personalized ? 'нужна персонализация' : needTable && !p.tabulated ? 'нужна таблица' : needSummary && !p.summarized ? 'нужна сводка' : needSchedule && !p.scheduled ? 'нужно расписание' : needExport && !p.exported ? 'нужна выгрузка CSV' : needSent && !p.sent ? 'нужна отправка в API' : needFolder && !p.foldered ? 'нужно разложить по папкам' : needJson && !p.jsoned ? 'нужен JSON' : needEmail && !p.emailed ? 'нужна отправка email' : needResilient && !p.resilient ? 'нужна политика повтора' : needIdempotent && !p.idempotent ? 'нужен ключ операции' : needMonitored && !p.monitored ? 'нужна запись в журнале' : 'нужна проверка'));
        return;
    } const pay = manual ? 12 : 8; s.coins += pay; s.total.income += pay; s.dayStats.income += pay; s.total.delivered++; const q = s.progress[p.contract]; if (manual) {
        s.total.manual++;
        s.dayStats.manual++;
        q.manual++;
    }
    else {
        s.total.auto++;
        s.dayStats.auto++;
        q.auto++;
        q[p.type]++;
        if (p.checked)
            q.checked++;
        if (p.cached)
            q.hits++;
        if (p.personalized) q.personalized++;
        if (p.tabulated) q.tabulated++;
        if (p.summarized) q.summarized++;
        if (p.scheduled) q.scheduled++;
        if (p.exported) q.exported++;
        if (p.sent) q.sent++;
        if (p.foldered) q.foldered++;
        if (p.jsoned) q.jsoned++;
        if (p.emailed) q.emailed++;
        if (p.resilient) q.resilient++;
        if (p.idempotent) q.idempotent++;
        if (p.monitored) q.monitored++;
        s.recent.push({ t: s.time, latency: s.time - p.born });
        if (s.metrics.firstAuto === null) {
            s.metrics.firstAuto = s.time;
            note(s, 'Первый автоматический результат! Машины сделали это сами.');
            M.record(s, 'first-auto', p.contract, p.id);
        }
        if (p.returned) M.record(s, 'repair-' + p.contract, p.contract, p.id);
        if (p.cached) M.record(s, 'first-cache', p.contract, p.id);
    } s.memory[p.key] = { checked: p.checked, personalized: p.personalized, tabulated: p.tabulated, summarized: p.summarized, scheduled: p.scheduled, exported: p.exported, foldered: p.foldered, jsoned: p.jsoned }; const keys = Object.keys(s.memory); if (keys.length > 200)
        delete s.memory[keys[0]]; s.events.push({ kind: 'delivery', t: s.time, type: p.type, manual }); s.events = s.events.slice(-32); }
    function manual(s) { if (!s.started || s.paused || s.phase !== 'day')
        return fail('На паузе заказы не обрабатываются.'); const n = get(s, 'in'); let p = n.queue.shift(); if (!p && n.active) {
        p = n.active.job;
        n.active = null;
    } if (!p)
        return fail('Стол пуст. Дождись следующего заказа.'); p.prepared = true; p.checked = true; p.defect = false; delivery(s, p, true); return ok('Готово. +12 монет.'); }
    function rework(s) { returnJobs(s, s.quarantine.splice(0)); return ok('Файлы возвращены на вход. Исправь маршрут.'); }
    function tick(s, dt) {
        if (!s.started || s.paused || s.phase !== 'day' || !Number.isFinite(dt) || dt <= 0)
            return;
        dt = Math.min(dt, .1);
        s.time += dt;
        const input = get(s, 'in');
        s.spawnClock += dt * (s.mode === 'sandbox' ? s.demand : contract(s).demand);
        if (s.spawnClock >= 1) {
            s.spawnClock = Math.min(s.spawnClock - 1, 1);
            if (s.feed) {
                if (inFlight(s) < 256) {
                    s.feed.waiting.push(job(s));
                    s.feed.offered++;
                }
            }
            else if (space(s, input) && inFlight(s) < 256)
                input.queue.push(job(s));
        }
        if (s.feed)
            while (s.feed.waiting.length && space(s, input))
                input.queue.push(s.feed.waiting.shift());
        const arrived = [];
        for (const t of s.transit) {
            t.left -= dt;
            if (t.left <= 0)
                arrived.push(t);
        }
        s.transit = s.transit.filter(t => t.left > 0);
        for (const t of arrived) {
            const n = get(s, t.to);
            if (n)
                n.queue.push(t.job);
            else
                returnJobs(s, [t.job]);
        }
        for (const n of s.nodes) {
            sample(s, n, dt);
            startJob(s, n);
            if (!n.active) {
                n.status = n.queue.length ? n.status : 'Ожидает файл';
                continue;
            }
            const a = n.active;
            if (a.left > 0) {
                a.left = Math.max(0, a.left - dt);
                n.busy += dt;
                if (a.left > 0)
                    continue;
            }
            if (!a.finished)
                process(s, n, a);
            if (n.type === 'out') {
                delivery(s, a.job);
                n.active = null;
                continue;
            }
            const c = choose(s, n, a.job);
            if (!c.node) {
                n.status = c.reason;
                continue;
            }
            const p = a.job;
            p.target = c.target || null;
            const travel = Math.max(.25, Math.min(.9, Math.hypot(n.x - c.node.x, n.y - c.node.y) / 650));
            s.transit.push({ from: n.id, to: c.node.id, job: p, left: travel, duration: travel });
            n.active = null;
            n.status = 'Передал файл';
        }
        s.recent = s.recent.filter(r => r.t >= s.time - 60);
        s.peak = Math.max(s.peak, s.recent.length);
    }
    function goals(s) { const c = contract(s), p = s.progress[s.chapter], r = []; if (c.manual)
        r.push({ label: 'Сделать три фотографии самому', value: p.manual, target: c.manual }); if (c.image)
        r.push({ label: 'Автоматически обработать фото', value: p.image, target: c.image }); if (c.text)
        r.push({ label: 'Автоматически оформить тексты', value: p.text, target: c.text }); if (c.checked)
        r.push({ label: 'Сдать проверенные карточки автоматически', value: p.checked, target: c.need }); if (!c.image && !c.checked)
        r.push({ label: 'Сдать без ручных кликов', value: p.auto, target: c.need }); if (c.hits)
        r.push({ label: 'Взять готовое из памяти', value: p.hits, target: c.hits }); if (c.personalized || c.personalizedText)
        r.push({ label: 'Персонализировать автоматически', value: p.personalized, target: c.personalized ? c.need : (c.text || Math.ceil(c.need/2)) }); if (c.tabulated || c.tabulatedImage)
        r.push({ label: 'Записать в таблицу автоматически', value: p.tabulated, target: c.tabulated ? c.need : (c.image || Math.floor(c.need/2)) }); if (c.summarized)
        r.push({ label: 'Собрать сводку по категориям', value: p.summarized, target: c.need }); if (c.scheduled)
        r.push({ label: 'Поставить обработку на расписание', value: p.scheduled, target: c.need }); if (c.exported)
        r.push({ label: 'Выгрузить структурированный CSV', value: p.exported, target: c.need }); if (c.sent)
        r.push({ label: 'Отправить проверенные заявки в API', value: p.sent, target: c.need }); if (c.foldered)
        r.push({ label: 'Разложить результат по папкам', value: p.foldered, target: c.need }); if (c.jsoned)
        r.push({ label: 'Собрать структурированный JSON', value: p.jsoned, target: c.need }); if (c.emailed)
        r.push({ label: 'Отправить письма наружу', value: p.emailed, target: c.need }); if (c.resilient)
        r.push({ label: 'Пережить временный сбой через retry', value: p.resilient, target: c.need }); if (c.idempotent)
        r.push({ label: 'Повторять запрос безопасно с ID KEY', value: p.idempotent, target: c.need }); if (c.monitored)
        r.push({ label: 'Оставить наблюдаемый след в журнале', value: p.monitored, target: c.need }); if (c.goals.includes('parallel'))
        r.push({ label: 'Два работающих распознавателя', value: s.nodes.filter(n => n.type === 'photo' && n.done >= 4).length, target: 2 }); return r; }
    const ready = s => !s.claimed.includes(s.chapter) && goals(s).every(g => g.value >= g.target);
    function claim(s) { if (!ready(s))
        return fail('Заказ ещё не готов или уже сдан.'); const c = contract(s); s.claimed.push(s.chapter); s.coins += c.reward; s.rep += c.rep; s.metrics.claims++; M.record(s, 'order-' + s.chapter); note(s, c.client + ': ' + c.thanks); return ok('Награда ' + c.reward + ' монет.', { letter: c.thanks }); }
    function closeClaimedIntake(s, chapter) {
        // Once the client accepts an order, stop producing obsolete leftovers from that order.
        // This keeps a newly rebuilt pipeline from being jammed by stale file types from the previous brief.
        let removed = 0;
        for (const n of s.nodes) {
            const before = n.queue.length;
            n.queue = n.queue.filter(p => p.contract !== chapter);
            removed += before - n.queue.length;
            if (n.active?.job?.contract === chapter) { n.active = null; removed++; }
            if (!n.active && !n.queue.length) n.status = 'Ожидает файл';
        }
        const beforeTransit = s.transit.length;
        s.transit = s.transit.filter(t => t.job.contract !== chapter); removed += beforeTransit - s.transit.length;
        const beforeQ = s.quarantine.length;
        s.quarantine = s.quarantine.filter(p => p.contract !== chapter); removed += beforeQ - s.quarantine.length;
        if (s.feed) {
            const beforeFeed = s.feed.waiting.length;
            s.feed.waiting = s.feed.waiting.filter(p => p.contract !== chapter); removed += beforeFeed - s.feed.waiting.length;
        }
        if (removed) note(s, 'Заказ закрыт: лишние файлы клиента сняты с линии (' + removed + ').');
    }
    function advance(s) { if (!s.claimed.includes(s.chapter))
        return fail('Сначала сдай заказ.'); if (s.chapter >= D.contracts.length - 1) {
        return s.ending ? ok('Мастерская остаётся твоей.') : finish(s);
    } closeClaimedIntake(s, s.chapter); s.chapter++; s.mode = 'campaign'; for (const t of contract(s).unlock)
        if (!s.unlocked.includes(t))
            s.unlocked.push(t); s.spawnClock = 0; note(s, 'Новый заказ: ' + contract(s).name); return ok(); }

    // Finishing is a one-off snapshot. Free play never rewrites the ending.
    function finish(s) {
        if (s.ending) return fail('Эта история уже завершена.');
        if (s.chapter !== D.contracts.length - 1 || !D.contracts.every((_, i) => s.claimed.includes(i))) return fail('Сначала помоги всем соседям и сдай финальный заказ.');
        s.ending = { at: s.time, automatic: s.total.auto, manual: s.total.manual, coins: s.coins, machines: s.nodes.length - 2, memories: s.memories.map(m => ({...m})) };
        s.mode = 'sandbox'; s.demand = 1.5;
        note(s, 'Все соседи пришли на праздник. История завершена; мастерская остаётся.');
        return ok('История завершена. Свободное время теперь твоё.');
    }
    function setProgram(s, source) {
        let compiled; try { compiled = P.compileRouter(source); }
        catch (e) { return fail('Строка ' + (e.line || 1) + ': ' + e.message); }
        s.program = { source, table: compiled.table }; s.codeDraft = source;
        if (!s.discoveries.includes('python')) s.discoveries.push('python');
        note(s, 'Сортировщики исполняют проверенную программу. Изменение слова вернёт управление доске.');
        return ok('Код установлен. Следующие файлы пойдут по его решениям.');
    }
    function discovery(s, id) {
        if (!/^(python|puzzle-[0-2]|lab-(rush|mixed|archive|repeats)|lesson-[0-2])$/.test(id)) return fail('Неизвестное открытие.');
        if (!s.discoveries.includes(id)) s.discoveries.push(id);
        return ok();
    }
    function newDay(s) { s.day++; s.phase = 'day'; s.paused = false; s.dayStart = s.time; s.dayStats = { auto: 0, manual: 0, income: 0, cost: 0 }; return ok('Доброе утро. Всё построенное осталось.'); }
    function decorate(s, id) { const d = D.decor.find(d => d.id === id); if (!d || s.decor.includes(id))
        return fail('Уже построено.'); if (s.coins < d.cost)
        return fail('Пока не хватает монет.'); s.coins -= d.cost; s.decor.push(id); return ok('Двор стал уютнее. Скорость машин не изменилась.'); }
    function metrics(s) { const r = s.recent.filter(r => r.t >= s.time - 60), den = s.total.delivered + s.total.rejected; return { rate: r.length, queue: inFlight(s), accuracy: den ? Math.round(s.total.delivered / den * 100) : null, latency: r.length ? r.reduce((a, b) => a + b.latency, 0) / r.length : 0, autoShare: s.total.delivered ? Math.round(s.total.auto / s.total.delivered * 100) : 0 }; }
    const serialize = s => JSON.stringify(s);
    function parseSave(text) {
        if (typeof text !== 'string' || text.length > 2000000)
            throw Error('Слишком большой файл.');
        const s = JSON.parse(text), bad = message => { throw Error(message); }, num = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
        const int = (v, lo, hi) => Number.isInteger(v) && num(v, lo, hi), str = (v, max) => typeof v === 'string' && v.length <= max;
        const unique = (a, max, predicate) => Array.isArray(a) && a.length <= max && new Set(a).size === a.length && a.every(predicate);
        if (!s || ![6, 7, 10].includes(s.version))
            bad('Нужно сохранение 0.6, 0.7 или 1.0. Более ранние версии имеют другую модель.');
        const legacy = s.version < 10;
        // 1.2 adds two contracts. Old 1.0/1.1 saves had six progress slots,
        // so extend every valid historical save instead of treating it as corrupt.
        if (!Array.isArray(s.progress) || s.progress.length < 5 || s.progress.length > D.contracts.length) bad('Повреждён прогресс.');
        while (s.progress.length < D.contracts.length) s.progress.push(progress());
        if (legacy) {
            s.ending = null; s.program = null; s.codeDraft = ''; s.discoveries = [];
        }
        if (!num(s.coins, 0, 1e12) || !num(s.time, 0, 1e10) || !int(s.chapter, 0, D.contracts.length - 1) || !int(s.nextJob, 1, 1e12) || !int(s.nextNode, 1, 1e6) || ![1, 2, 3].includes(s.speed) || !['campaign', 'sandbox', 'puzzle'].includes(s.mode))
            bad('Повреждены параметры.');
        if (!int(s.day, 1, 1e9) || !int(s.seed, 0, 4294967295) || typeof s.started !== 'boolean' || typeof s.paused !== 'boolean' || !['day', 'night'].includes(s.phase) || !num(s.spawnClock, 0, 2) || !num(s.dayStart, 0, s.time) || !num(s.demand, .01, 10) || !num(s.rep, 0, 1e12))
            bad('Повреждён день или режим игры.');
        if (!Array.isArray(s.nodes) || s.nodes.length < 2 || s.nodes.length > 32 || !Array.isArray(s.links) || s.links.length > 80 || !Array.isArray(s.transit) || s.transit.length > 256 || !Array.isArray(s.quarantine) || s.quarantine.length > 256 || !Array.isArray(s.rules) || s.rules.length !== 4 || !Array.isArray(s.progress) || s.progress.length !== D.contracts.length)
            bad('Повреждена структура.');
        const ids = new Set(), jobs = new Set();
        function checkJob(p) {
            if (!p || !int(p.id, 1, s.nextJob - 1) || jobs.has(p.id) || !['image', 'text'].includes(p.type) || !int(p.contract, 0, D.contracts.length - 1) || !num(p.born, 0, s.time + .1) || !str(p.key, 80) || !/^(image|text)-\d+$/.test(p.key) || !Array.isArray(p.trace) || p.trace.length > 100 || !p.trace.every(t => str(t, 300)))
                bad('Повреждён файл заказа.');
            if (p.returned === undefined) p.returned = false;
            if (p.personalized === undefined) p.personalized = false;
            if (p.tabulated === undefined) p.tabulated = false;
            if (p.summarized === undefined) p.summarized = false;
            if (p.scheduled === undefined) p.scheduled = false;
            if (p.exported === undefined) p.exported = false;
            if (p.sent === undefined) p.sent = false;
            if (p.foldered === undefined) p.foldered = false;
            if (p.jsoned === undefined) p.jsoned = false;
            if (p.emailed === undefined) p.emailed = false;
            if (p.resilient === undefined) p.resilient = false;
            if (p.idempotent === undefined) p.idempotent = false;
            if (p.monitored === undefined) p.monitored = false;
            if (p.apiFailed === undefined) p.apiFailed = false;
            for (const k of ['prepared', 'checked', 'personalized', 'tabulated', 'summarized', 'scheduled', 'exported', 'sent', 'foldered', 'jsoned', 'emailed', 'resilient', 'idempotent', 'monitored', 'apiFailed', 'cached', 'defect', 'returned'])
                if (typeof p[k] !== 'boolean')
                    bad('Повреждено состояние файла.');
            if (p.target !== null && !Object.hasOwn(D.machines, p.target))
                bad('Неизвестный маршрут файла.');
            jobs.add(p.id);
        }
        for (const n of s.nodes) {
            if (!n || !str(n.id, 40) || !(/^(in|out|n[1-9]\d*)$/.test(n.id)) || ids.has(n.id) || !Object.hasOwn(D.machines, n.type) || !int(n.level, 1, 4) || !num(n.x, 0, 1380) || !num(n.y, 240, 810) || !Array.isArray(n.queue) || n.queue.length > 40 || !num(n.spent, 0, 1e12) || !num(n.done, 0, 1e12) || !num(n.busy, 0, 1e10) || !str(n.status, 500))
                bad('Повреждена машина.');
            if (n.id.startsWith('n') && Number(n.id.slice(1)) >= s.nextNode)
                bad('Повторится номер следующей машины.');
            ids.add(n.id);
            n.queue.forEach(checkJob);
            if (n.active) {
                checkJob(n.active.job);
                if (!num(n.active.left, 0, 60) || !num(n.active.duration, .01, 60) || typeof n.active.finished !== 'boolean')
                    bad('Повреждена обработка.');
            }
            if (n.pulse === undefined)
                n.pulse = [];
            if (!Array.isArray(n.pulse) || n.pulse.length > 13 || n.pulse.some(b => !b || !int(b.second, 0, Math.floor(s.time)) || !['work', 'blocked', 'idle'].every(k => num(b[k], 0, 1.1))))
                bad('Повреждены измерения нагрузки.');
        }
        if (get(s, 'in')?.type !== 'in' || get(s, 'out')?.type !== 'out' || s.nodes.filter(n => n.type === 'in' || n.type === 'out').length !== 2)
            bad('Нужны ровно один вход и одна выдача.');
        const linkIds = new Set();
        for (const l of s.links) {
            const key = l?.from + '>' + l?.to;
            if (!l || linkIds.has(key))
                bad('Повторная линия.');
            linkIds.add(key);
            if (!ids.has(l.from) || !ids.has(l.to) || l.from === l.to || l.from === 'out' || l.to === 'in' || path(s, l.to, l.from))
                bad('Неверные или замкнутые линии.');
        }
        for (const t of s.transit) {
            checkJob(t.job);
            if (!ids.has(t.from) || !ids.has(t.to) || !num(t.left, 0, 3) || !num(t.duration, .01, 3))
                bad('Повреждена передача.');
        }
        s.quarantine.forEach(checkJob);
        if (s.feed === undefined)
            s.feed = null;
        if (s.feed !== null) {
            if (!s.feed || !int(s.feed.offered, 0, 1e12) || !Array.isArray(s.feed.waiting) || s.feed.waiting.length > 256)
                bad('Повреждён поток испытания.');
            s.feed.waiting.forEach(checkJob);
        }
        if (jobs.size > 256)
            bad('Слишком много заказов.');
        for (const r of s.rules)
            if (!r || (r.condition !== null && !Object.hasOwn(D.conditions, r.condition)) || (r.action !== null && !Object.hasOwn(D.actions, r.action)))
                bad('Неверное правило.');
        if (!unique(s.unlocked, 24, t => Object.hasOwn(D.machines, t)) || !unique(s.claimed, D.contracts.length, i => int(i, 0, D.contracts.length - 1)) || !unique(s.decor, 3, id => D.decor.some(d => d.id === id)))
            bad('Повреждены открытия или награды.');
        // A legitimate 1.1 save may contain the old six-contract ending.
        // Re-open it at contract seven rather than deleting the workshop or rejecting the save.
        if (s.version === 10 && s.ending && s.claimed.length < D.contracts.length && s.claimed.every((v,i) => v === i)) {
            s.ending = null;
            s.chapter = s.claimed.length;
            s.mode = 'campaign';
            s.spawnClock = 0;
        }
        for (const [key, max] of [['log', 24], ['recent', 2000], ['events', 32]])
            if (!Array.isArray(s[key]) || s[key].length > max)
                bad('Повреждён журнал.');
        if (s.log.some(v => !v || !num(v.t, 0, s.time + .1) || !str(v.text, 1000)) || s.recent.some(v => !v || !num(v.t, 0, s.time + .1) || !num(v.latency, 0, 1e10)))
            bad('Повреждён журнал или время результата.');
        if (s.events.some(v => !v || v.kind !== 'delivery' || !num(v.t, 0, s.time + .1) || !['image', 'text'].includes(v.type) || typeof v.manual !== 'boolean'))
            bad('Повреждены события.');
        const validCounterObject = (obj, keys) => obj && typeof obj === 'object' && keys.every(k => num(obj[k], 0, 1e12));
        for (const p of s.progress) { if (p.personalized === undefined) p.personalized = 0; if (p.tabulated === undefined) p.tabulated = 0; if (p.summarized === undefined) p.summarized = 0; if (p.scheduled === undefined) p.scheduled = 0; if (p.exported === undefined) p.exported = 0; if (p.sent === undefined) p.sent = 0; if (p.foldered === undefined) p.foldered = 0; if (p.jsoned === undefined) p.jsoned = 0; if (p.emailed === undefined) p.emailed = 0; if (p.resilient === undefined) p.resilient = 0; if (p.idempotent === undefined) p.idempotent = 0; if (p.monitored === undefined) p.monitored = 0; }
        for (const p of s.progress)
            if (!validCounterObject(p, Object.keys(progress())))
                bad('Повреждён прогресс.');
        if (!validCounterObject(s.total, ['delivered', 'auto', 'manual', 'rejected', 'hits', 'cost', 'income']) || !validCounterObject(s.dayStats, ['auto', 'manual', 'income', 'cost']))
            bad('Повреждён баланс.');
        if (!validCounterObject(s.metrics, ['rulesChanged', 'builds', 'claims']) || !['firstAuto', 'firstRule'].every(k => s.metrics[k] === null || num(s.metrics[k], 0, s.time + .1)))
            bad('Повреждены открытия.');
        if (!s.memory || typeof s.memory !== 'object' || Array.isArray(s.memory) || Object.keys(s.memory).length > 200 || Object.entries(s.memory).some(([k, v]) => !/^(image|text)-\d+$/.test(k) || !v || typeof v.checked !== 'boolean' || (v.personalized !== undefined && typeof v.personalized !== 'boolean') || (v.tabulated !== undefined && typeof v.tabulated !== 'boolean') || (v.summarized !== undefined && typeof v.summarized !== 'boolean') || (v.scheduled !== undefined && typeof v.scheduled !== 'boolean') || (v.exported !== undefined && typeof v.exported !== 'boolean') || (v.foldered !== undefined && typeof v.foldered !== 'boolean') || (v.jsoned !== undefined && typeof v.jsoned !== 'boolean')))
            bad('Повреждена память.');
        if (s.mode === 'puzzle' && (!s.puzzle || !int(s.puzzle.index, 0, 2) || !str(s.puzzle.name, 200) || !str(s.puzzle.description, 2000)))
            bad('Повреждена головоломка.');
        if (!num(s.peak, 0, 2000))
            bad('Повреждён рекорд.');
        if (!str(s.codeDraft, 12000) || !unique(s.discoveries, 16, id => typeof id === 'string' && /^(python|puzzle-[0-2]|lab-(rush|mixed|archive|repeats)|lesson-[0-2])$/.test(id))) bad('Повреждены открытия или черновик.');
        if (s.program !== null) {
            if (!s.program || !str(s.program.source, 12000)) bad('Повреждена программа.');
            let compiled;
            try { compiled = P.compileRouter(s.program.source); }
            catch (e) { bad('Программа в сохранении не проходит проверку: ' + e.message); }
            // Never trust an externally supplied dispatch table.
            if (!s.program.table || Object.keys(compiled.table).length !== Object.keys(s.program.table).length || Object.keys(compiled.table).some(k => compiled.table[k] !== s.program.table[k])) bad('Таблица маршрутов не соответствует программе.');
            s.program = { source: s.program.source, table: compiled.table };
        }
        if (s.ending !== null && (!s.ending || !num(s.ending.at, 0, s.time) || !num(s.ending.automatic, 0, s.total.auto) || !num(s.ending.manual, 0, s.total.manual) || !num(s.ending.coins, 0, 1e12) || !int(s.ending.machines, 0, 30) || !D.contracts.every((_,i) => s.claimed.includes(i)))) bad('Повреждён финал.');
        M.validate(s);
        s.version = 10;
        return s;
    }
    return { compileProgram: P.compileRouter, finish, setProgram, discovery, create, tick, build, upgrade, move, remove, duplicate, configurationCost, diagnose, connect, disconnect, manual, rule, rework, goals, ready, claim, advance, newDay, decorate, metrics, serialize, parseSave, inFlight, get, contract, note };
});
