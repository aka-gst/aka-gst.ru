/* Lasting story evidence. Pure, bounded, deterministic; never grants rewards. */
(function (g, f) {
    if (typeof module === 'object' && module.exports) module.exports = f(require('./data.js'));
    else g.WorkshopMemories = f(g.WorkshopData);
})(globalThis, function (D) {
    'use strict';
    const counters = ['auto', 'manual', 'image', 'text', 'checked', 'hits', 'personalized', 'tabulated', 'summarized', 'scheduled', 'exported', 'sent', 'foldered', 'jsoned', 'emailed', 'resilient', 'idempotent', 'monitored'];
    const limit = 2 + D.contracts.length * 2;
    const titles = ['Первый свободный вечер', 'Две дорожки одной лавки', 'Ярмарка получила свой заказ', 'Архиву можно доверять', 'Мы уже встречались', 'Городская премьера', 'Газета к открытию школы', 'Мастерская без тебя', 'Поздравления без копипаста', 'Чеки больше не перепечатываются', 'Две профессии одного потока', 'Утренняя рутина работает сама', 'Расходы сложились в сводку', 'Отчёт приходит к девяти', 'Файл ушёл бухгалтеру', 'CRM приняла заявку', 'Архив раскладывается сам', 'JSON ушёл в соседний сервис', 'Письма отправляются сами', 'Сервис переживает временный сбой', 'Повтор больше не создаёт дубль', 'Ночная смена оставляет след'];

    function record(s, id, chapter = s.chapter, file = null) {
        if (s.memories.some(m => m.id === id)) return false;
        if (s.memories.length >= limit) return false;
        const p = s.progress[chapter];
        s.memories.push({id, at: s.time, day: s.day, chapter, file,
            ...Object.fromEntries(counters.map(k => [k, p[k]]))});
        return true;
    }

    function validate(s) {
        const bad = () => { throw Error('Повреждён альбом мастерской.'); };
        const number = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
        const integer = (v, lo, hi) => Number.isInteger(v) && number(v, lo, hi);
        function check(list, until) {
            if (!Array.isArray(list) || list.length > limit) bad();
            const seen = new Set(); let previous = -1;
            for (const m of list) {
                if (!m || typeof m.id !== 'string' || !/^(first-auto|first-cache|(?:repair|order)-(?:[0-9]|1[0-9]|2[01]))$/.test(m.id) || seen.has(m.id)) bad();
                if (!integer(m.chapter, 0, D.contracts.length - 1) || !integer(m.day, 1, s.day) || !number(m.at, 0, until) || m.at < previous) bad();
                if (m.file !== null && !integer(m.file, 1, s.nextJob - 1)) bad();
                for (const k of ['personalized','tabulated','summarized','scheduled','exported','sent','foldered','jsoned','emailed','resilient','idempotent','monitored']) if (m[k] === undefined) m[k] = 0;
                if (!counters.every(k => integer(m[k], 0, s.progress[m.chapter][k]))) bad();
                const order = m.id.startsWith('order-'), repair = m.id.startsWith('repair-');
                if ((order || repair) && Number(m.id.split('-')[1]) !== m.chapter) bad();
                if (order) {
                    if (!s.claimed.includes(m.chapter) || m.file !== null) bad();
                    const c = D.contracts[m.chapter];
                    if (m.auto < c.need || m.manual < (c.manual || 0) || m.image < (c.image || 0) || m.text < (c.text || 0) || m.hits < (c.hits || 0) || (c.checked && m.checked < c.need) || (c.personalized && m.personalized < c.need) || (c.tabulated && m.tabulated < c.need) || (c.personalizedText && m.personalized < (c.text || Math.ceil(c.need/2))) || (c.tabulatedImage && m.tabulated < (c.image || Math.floor(c.need/2))) || (c.summarized && m.summarized < c.need) || (c.scheduled && m.scheduled < c.need) || (c.exported && m.exported < c.need) || (c.sent && m.sent < c.need) || (c.foldered && m.foldered < c.need) || (c.jsoned && m.jsoned < c.need) || (c.emailed && m.emailed < c.need) || (c.resilient && m.resilient < c.need) || (c.idempotent && m.idempotent < c.need) || (c.monitored && m.monitored < c.need)) bad();
                } else if (m.file === null || m.auto < 1) bad();
                if (m.id === 'first-auto' && (m.auto !== 1 || m.at !== s.metrics.firstAuto)) bad();
                if (m.id === 'first-cache' && m.hits < 1) bad();
                previous = m.at; seen.add(m.id);
            }
        }
        // Absence means an older save. Never reconstruct unobserved events from totals.
        if (s.memories === undefined) s.memories = [];
        check(s.memories, s.time);
        if (s.ending) {
            if (s.ending.memories === undefined) s.ending.memories = [];
            check(s.ending.memories, s.ending.at);
        }
    }

    function outcome(m) {
        switch (m.chapter) {
            case 0: return 'Помню нашу первую партию: ' + m.manual + ' вручную, а ' + m.auto + ' — уже машинами. Тогда у меня впервые освободился вечер.';
            case 1: return 'В нашей партии были и фото (' + m.image + '), и тексты (' + m.text + '). Теперь обоим видам работы нашлось место.';
            case 2: return 'К сдаче ярмарочного заказа машины подготовили ' + m.auto + ' карточек. И обе фотомашины успели поработать. Очередь уже не казалась безнадёжной.';
            case 3: return 'В нашем архивном заказе — ' + m.checked + ' проверенных карточек. За каждой теперь стоит не только скорость, но и проверка.';
            case 4: return 'В новой партии ' + m.hits + ' карточек взяты из памяти. Это уже не первая наша встреча — и мастерская тоже узнаёт знакомое.';
            case 5: return 'На городской премьере мастерская сама довела ' + m.auto + ' карточек. Память помогла ' + m.hits + ' раз, а проверка не дала спешке испортить результат.';
            case 6: return 'Для школьной газеты готовы ' + m.checked + ' проверенных карточек. Узкое место пришлось найти по очереди, а не угадывать.';
            case 7: return 'Мастерская без тебя довела ' + m.checked + ' проверенных карточек и не потребовала ручного спасения.';
            case 8: return 'Шаблон персонализировал ' + m.personalized + ' сообщений. Один алгоритм заменил повторяющийся копипаст.';
            case 9: return 'Из фотографий чеков автоматически получилось ' + m.tabulated + ' строк таблицы.';
            case 10: return 'В одном потоке сошлись ' + m.personalized + ' персональных текстов и ' + m.tabulated + ' строк таблицы.';
            case 11: return 'Утренняя рутина: ' + m.checked + ' проверено, ' + m.personalized + ' персонализировано, ' + m.tabulated + ' записано в таблицу. Мастерская уже похожа на маленький офис.';
            case 12: return 'Из ' + m.tabulated + ' строк таблицы мастерская собрала ' + m.summarized + ' автоматических сводок по категориям.';
            case 13: return 'Утренняя рутина: ' + m.scheduled + ' результатов поставлено на расписание и ' + m.checked + ' проверено. Работа начинается раньше напоминания о ней.';
            case 14: return 'Бухгалтерская выгрузка: ' + m.exported + ' результатов стали переносимым CSV после проверки и сводки.';
            case 15: return 'CRM приняла ' + m.sent + ' проверенных заявок через API. Локальная память не подменила внешнее действие.';
            case 16: return 'Архив сам разложил ' + m.foldered + ' результатов по понятным папкам.';
            case 17: return 'Для соседнего сервиса собрано ' + m.jsoned + ' JSON-результатов и выполнено ' + m.sent + ' API-отправок.';
            case 18: return 'Отправлено ' + m.emailed + ' персональных писем. Кэш сохранил подготовку, но не подменил факт отправки.';
            case 19: return 'API пережил временный сбой: ' + m.resilient + ' результатов прошли политику повтора, ' + m.sent + ' реально отправлены наружу.';
            case 20: return 'Безопасный повтор: ' + m.idempotent + ' запросов получили устойчивый ID KEY и ' + m.sent + ' операций завершились без дублей.';
            default: return 'Ночная смена оставила ' + m.monitored + ' наблюдаемых записей после ' + m.sent + ' внешних операций. Теперь утром есть факты, а не догадки.';
        }
    }

    function describe(m) {
        if (m.id === 'first-auto') return {title: 'Впервые — без твоих рук', text: 'Файл №' + m.file + ' прошёл цепочку и был принят автоматически. Мастерская впервые довела дело до конца сама.'};
        if (m.id === 'first-cache') return {title: 'Не делать знакомое заново', text: 'Файл №' + m.file + ' был принят после получения готового результата из памяти. Повторная работа перестала быть обязательной.'};
        if (m.id.startsWith('repair-')) return {title: 'Возвращён — не потерян', text: 'Файл №' + m.file + ' сначала вернулся на доработку, а потом был принят автоматически. Ошибка не стала концом его истории.'};
        return {title: titles[m.chapter], text: outcome(m)};
    }

    function neighborChapter(s, chapter) {
        return chapter === 0 && (s.chapter >= 4 || s.claimed.includes(4)) ? 4 : chapter;
    }
    function forNeighbor(s, chapter) {
        const chapters = chapter === 0 || chapter === 4 ? [0, 4] : [chapter];
        return s.memories.filter(m => chapters.includes(m.chapter));
    }
    function reply(s, chapter) {
        const list = forNeighbor(s, chapter), m = [...list].reverse().find(v => v.id.startsWith('order-'));
        if (!m) return null;
        const repair = list.find(v => v.id === 'repair-' + m.chapter && v.at <= m.at);
        return (repair ? 'Помню, как один из возвращённых файлов всё-таки дошёл до выдачи без ручной обработки. ' : '') + outcome(m);
    }
    function highlights(list) {
        const selected = [];
        const take = m => { if (m && !selected.some(v => v.id === m.id) && selected.length < 3) selected.push(m); };
        take(list.find(m => m.id === 'first-auto'));
        take(list.find(m => m.id === 'repair-3') || list.find(m => m.id.startsWith('repair-')) || list.find(m => m.id === 'first-cache'));
        take(list.find(m => m.id === 'order-' + (D.contracts.length - 1)) || list[list.length - 1]);
        for (const m of list) take(m);
        return selected;
    }
    return {record, validate, describe, neighborChapter, forNeighbor, reply, highlights, limit};
});
