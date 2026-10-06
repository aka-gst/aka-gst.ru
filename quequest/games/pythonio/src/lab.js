/* Isolated experiments: same seed, empty queues, cold cache, fixed simulated time.
 * No storage, wall clock, random browser APIs, network, or hidden game rewards. */
(function (g, f) { if (typeof module === 'object' && module.exports)
    module.exports = f(require('./data.js'), require('./engine.js'));
else
    g.WorkshopLab = f(g.WorkshopData, g.WorkshopEngine); })(globalThis, function (D, E) {
    'use strict';
    const FORMAT = 'zhivoy-tsekh.blueprint/1';
    const scenarios = [
        { id: 'rush', name: 'Ярмарка фотографий', tag: 'СКОРОСТЬ', client: 'Ася', chapter: 0, demand: 2.2, seed: 1707, seconds: 60,
            story: 'Фотографий больше, чем успевает один компьютер. Найди способ выдавать больше готового, а не просто хранить длиннее очередь.',
            hint: 'Сравни одну фотомашину, вторую подключённую и улучшение первой. Накопитель не ускоряет распознавание.', goals: [{ key: 'auto', target: 32, label: 'Не меньше 32 готовых' }, { key: 'rejected', target: 0, max: true, label: 'Без возвратов' }] },
        { id: 'mixed', name: 'Два языка лавки', tag: 'РАЗВЕТВЛЕНИЕ', client: 'Марк', chapter: 1, demand: 1.6, seed: 2718, seconds: 60,
            story: 'Половина карточек — фото, половина — текст. Одна лишняя строка правила может остановить оба потока. Раздели работу и сохрани баланс.',
            hint: 'У каждой ветки свой обработчик и путь на выдачу. Первое подходящее правило имеет приоритет.', goals: [{ key: 'auto', target: 38, label: 'Не меньше 38 карточек' }, { key: 'image', target: 14, label: 'Хотя бы 14 фото' }, { key: 'text', target: 14, label: 'Хотя бы 14 текстов' }, { key: 'rejected', target: 0, max: true, label: 'Без возвратов' }] },
        { id: 'archive', name: 'Архив без ошибок', tag: 'НАДЁЖНОСТЬ', client: 'Вера', chapter: 3, demand: 1.3, seed: 3011, seconds: 60,
            story: 'Эти семейные записи должны быть проверены. Быстро отправить непроверенное — не значит выполнить работу. Построй надёжный маршрут.',
            hint: 'После обоих обработчиков нужна проверка. Убери прямые обходные линии к выдаче.', goals: [{ key: 'checked', target: 25, label: '25 проверенных карточек' }, { key: 'rejected', target: 0, max: true, label: 'Ни одного возврата' }] },
        { id: 'repeats', name: 'Знакомые лица', tag: 'ПЕРЕИСПОЛЬЗОВАНИЕ', client: 'Лида', chapter: 4, demand: 2.2, seed: 4409, seconds: 60,
            story: 'Одинаковые фото и тексты возвращаются. Сократи повторную работу. Но в начале каждого опыта память пуста: один раз всё-таки придётся обработать.',
            hint: 'Память ставится перед разбором. Новые файлы — обработчикам; знакомые — сразу на выдачу.', goals: [{ key: 'auto', target: 65, label: '65 готовых карточек' }, { key: 'hits', target: 35, label: '35 результатов из памяти' }, { key: 'unitCost', target: 1.1, max: true, label: 'Не дороже 1,1 монеты за сданную' }] }
    ];
    function scenario(id) { const c = scenarios.find(c => c.id === id); if (!c)
        throw Error('Неизвестное испытание.'); return c; }
    function capture(s) { return { format: FORMAT, nodes: s.nodes.map(({ id, type, x, y, level }) => ({ id, type, x, y, level })), links: s.links.map(({ from, to }) => ({ from, to })), rules: s.rules.map(({ condition, action }) => ({ condition, action })), ...(s.program ? {program:{source:s.program.source}} : {}) }; }
    function readBlueprint(text) {
        if (typeof text !== 'string' || text.length > 200000)
            throw Error('Чертёж слишком большой.');
        const p = JSON.parse(text), bad = t => { throw Error(t); }, num = (v, l, h) => Number.isFinite(v) && v >= l && v <= h;
        if (!p || p.format !== FORMAT)
            bad('Это не чертёж «Живого цеха». Для прогресса используй импорт сохранения.');
        if (!Array.isArray(p.nodes) || p.nodes.length < 2 || p.nodes.length > 32 || !Array.isArray(p.links) || p.links.length > 80 || !Array.isArray(p.rules) || p.rules.length !== 4)
            bad('Повреждена структура чертежа.');
        const ids = new Set();
        let input = 0, output = 0;
        for (const n of p.nodes) {
            if (!n || typeof n.id !== 'string' || !/^(in|out|n[1-9]\d*)$/.test(n.id) || ids.has(n.id) || !Object.hasOwn(D.machines, n.type) || !Number.isInteger(n.level) || !num(n.level, 1, 4) || !num(n.x, 70, 1310) || !num(n.y, 325, 730))
                bad('Неверная машина в чертеже.');
            ids.add(n.id);
            if (n.type === 'in') {
                input++;
                if (n.id !== 'in' || n.level !== 1)
                    bad('Неверный вход.');
            }
            if (n.type === 'out') {
                output++;
                if (n.id !== 'out' || n.level !== 1)
                    bad('Неверная выдача.');
            }
        }
        if (input !== 1 || output !== 1)
            bad('Нужны ровно один вход и одна выдача.');
        for (let i = 0; i < p.nodes.length; i++)
            for (let j = 0; j < i; j++)
                if (Math.abs(p.nodes[i].x - p.nodes[j].x) < 132 && Math.abs(p.nodes[i].y - p.nodes[j].y) < 112)
                    bad('Машины стоят слишком тесно.');
        const edges = new Map(p.nodes.map(n => [n.id, []])), seen = new Set();
        for (const l of p.links) {
            if (!l || !ids.has(l.from) || !ids.has(l.to) || l.from === l.to || l.from === 'out' || l.to === 'in' || seen.has(l.from + '>' + l.to))
                bad('Неверные или повторные линии.');
            seen.add(l.from + '>' + l.to);
            edges.get(l.from).push(l.to);
        }
        const color = new Map();
        function visit(id) { if (color.get(id) === 1)
            bad('Линии образуют круг.'); if (color.get(id) === 2)
            return; color.set(id, 1); for (const to of edges.get(id))
            visit(to); color.set(id, 2); }
        for (const id of ids)
            visit(id);
        for (const r of p.rules)
            if (!r || (r.condition !== null && !Object.hasOwn(D.conditions, r.condition)) || (r.action !== null && !Object.hasOwn(D.actions, r.action)))
                bad('Неизвестное слово на доске.');
        if(p.program!==undefined){
            if(!p.program||typeof p.program.source!=='string')bad('Повреждена программа в чертеже.');
            E.compileProgram(p.program.source);
        }
        // Whitelist: live jobs, claims and money cannot enter an experiment through a blueprint.
        return capture(p);
    }
    function prepare(blueprint, id) {
        const c = scenario(id), p = readBlueprint(JSON.stringify(blueprint)), s = E.create(c.seed);
        s.started = true;
        s.mode = 'sandbox';
        s.chapter = c.chapter;
        s.demand = c.demand;
        s.coins = 1000000;
        s.unlocked = Object.keys(D.machines).filter(t => !['in', 'out'].includes(t));
        const map = new Map([['in', 'in'], ['out', 'out']]);
        for (const n of p.nodes.filter(n => n.type === 'in' || n.type === 'out')) {
            const endpoint = E.get(s, n.id);
            endpoint.x = n.x;
            endpoint.y = n.y;
            endpoint.queue = [];
        }
        for (const n of p.nodes.filter(n => !['in', 'out'].includes(n.type))) {
            const r = E.build(s, n.type, n.x, n.y);
            if (!r.ok)
                throw Error(r.message);
            map.set(n.id, r.id);
            const b = E.get(s, r.id);
            b.level = n.level;
            b.spent = E.configurationCost(n.type, n.level);
        }
        for (const l of p.links) {
            const r = E.connect(s, map.get(l.from), map.get(l.to));
            if (!r.ok)
                throw Error(r.message);
        }
        p.rules.forEach((r, i) => E.rule(s, i, r.condition, r.action));
        if(p.program){const r=E.setProgram(s,p.program.source);if(!r.ok)throw Error(r.message);}
        s.nextJob = 1;
        s.memory = {};
        s.feed = { offered: 0, waiting: [] };
        s.coins = 5000;
        s.log = [];
        s.metrics.builds = 0;
        s.metrics.rulesChanged = 0;
        s.metrics.firstRule = s.rules.some(r => r.condition && r.action) ? 0 : null;
        E.note(s, 'Учебная копия. Одинаковый поток, 60 игровых секунд, память с нуля.');
        return s;
    }
    function investment(s) { return s.nodes.reduce((v, n) => v + E.configurationCost(n.type, n.level), 0); }
    function result(s, id) {
        const c = scenario(id);
        if (s.time < c.seconds - .00001 || s.time > c.seconds + .051)
            throw Error('Сначала закончи ровно минуту испытания.');
        const q = s.progress[c.chapter], latencies = s.recent.map(r => r.latency).sort((a, b) => a - b);
        const r = { format: 'zhivoy-tsekh.trial/1', scenario: id, seed: c.seed, seconds: c.seconds, offered: s.feed?.offered || s.nextJob - 1, auto: s.total.auto, image: q.image, text: q.text, checked: q.checked, rejected: s.total.rejected, hits: q.hits,
            processingCost: s.total.cost, unitCost: s.total.auto ? +(s.total.cost / s.total.auto).toFixed(3) : null,
            investment: investment(s), machines: s.nodes.length - 2, backlog: E.inFlight(s), quality: s.total.auto + s.total.rejected ? Math.round(100 * s.total.auto / (s.total.auto + s.total.rejected)) : null,
            meanSeconds: latencies.length ? +(latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2) : null,
            p95Seconds: latencies.length ? +latencies[Math.max(0, Math.ceil(latencies.length * .95) - 1)].toFixed(2) : null };
        r.goals = c.goals.map(g => ({ ...g, value: r[g.key], passed: r[g.key] !== null && (g.max ? r[g.key] <= g.target : r[g.key] >= g.target) }));
        r.passed = r.goals.every(g => g.passed);
        return r;
    }
    function compare(before, after) { if (!before || !after || before.scenario !== after.scenario || before.seed !== after.seed || before.seconds !== after.seconds)
        throw Error('Разные условия: сравнивать нельзя.'); return { auto: after.auto - before.auto, rejected: after.rejected - before.rejected, investment: after.investment - before.investment, backlog: after.backlog - before.backlog, unitCost: before.unitCost === null || after.unitCost === null ? null : +(after.unitCost - before.unitCost).toFixed(3) }; }
    function template(id) { scenario(id); const p = { format: FORMAT, nodes: [{ id: 'in', type: 'in', x: 120, y: 410, level: 1 }, { id: 'n1', type: 'router', x: 390, y: 410, level: 1 }, { id: 'n2', type: 'photo', x: 660, y: 330, level: 1 }, { id: 'out', type: 'out', x: 1230, y: 410, level: 1 }], links: [{ from: 'in', to: 'n1' }, { from: 'n1', to: 'n2' }, { from: 'n2', to: 'out' }], rules: [{ condition: 'image', action: 'photo' }, ...Array.from({ length: 3 }, () => ({ condition: null, action: null }))] }; if (id !== 'rush') {
        p.nodes.push({ id: 'n3', type: 'writer', x: 660, y: 580, level: 1 });
        p.links.push({ from: 'n1', to: 'n3' }, { from: 'n3', to: 'out' });
        p.rules[1] = { condition: 'text', action: 'writer' };
    } return p; }
    return { scenarios, scenario, capture, readBlueprint, prepare, result, compare, template, investment };
});
