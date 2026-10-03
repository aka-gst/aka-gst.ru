/*
 * ИСТОЧНИК: МГС Сергея, stealth@6fda077 (ветка main на 03.10.2026),
 * файл src/light.js. Перенесён ДОСЛОВНО по слову Сергея «механики не
 * изобретать, брать из его MGS»: всё ниже строки-ножниц — байт в байт
 * исходник, ни одной правки.
 *
 * sha256 исходника: 9fda04c766122bd1264c5433b5a139587d643550df4aa35cc709fe5f846e0b2f
 * Сверку держит tests/vospriyatie.mjs: тело ниже ножниц обязано давать
 * этот хеш всегда, а если репозиторий stealth лежит на диске — ещё и
 * совпадать с ним. Разошлось — значит кто-то поправил копию руками или
 * МГС ушёл вперёд, и решать, что из двух брать, надо вслух.
 *
 * vision.js и alarm.js взяты раньше, с stealth@2a57e9d; на 6fda077 оба
 * совпадают с ними байт в байт (та же сверка в tests/vospriyatie.mjs).
 *
 * Импорты ./tuning.js и ./level.js — не МГС, а прокладки этой папки:
 * числа МГС ×4/3 (тайл 24 → наш 32) и луч через наш hasSight, так что
 * стены, створки, пар и пыль держат свет так же, как держат взгляд.
 * Откуда в нашем мире берутся источники (лампы «Башни», огонь на полу,
 * свечи) и что с ними делают стихии — src/vospriyatie/svet.js.
 */
// ---8<--- дальше дословно, байт в байт
/**
 * Свет: фонари, прожектор и вопрос «насколько меня сейчас видно».
 *
 * Два правила, из которых всё следует:
 *
 *   Освещённость — МАКСИМУМ по источникам, а не сумма. Иначе два далёких
 *   фонаря складываются в яркое пятно там, где глазом видно полумрак, и
 *   игрок перестаёт доверять картинке.
 *
 *   Стены свет держат — в отличие от шума. Это делает укрытие от взгляда,
 *   укрытие от слуха и укрытие в тени тремя разными тактиками, а не одной.
 */

import { LIGHT } from './tuning.js';
import { rayBlocked, rayReach } from './level.js';

export function createLight(def) {
    return {
        kind: def.kind ?? 'lamp',
        x: def.x,
        y: def.y,
        r: def.r ?? 100,
        /** Прожектор: куда смотрит, насколько широк и как быстро крутится. */
        angle: def.angle ?? 0,
        arc: def.arc ?? 0.42,
        speed: def.speed ?? 0,
        /** Разбитая лампа не светит совсем; погашенная — до конца отсчёта. */
        broken: false,
        out: 0,
        /** Тень от стен считается один раз: фонарь не двигается. */
        shape: null,
    };
}

export function updateLights(lights, dt) {
    for (const l of lights) {
        if (l.out > 0) l.out = Math.max(0, l.out - dt);
        if (l.speed) {
            l.angle += l.speed * dt;
            if (l.angle > Math.PI) l.angle -= Math.PI * 2;
            l.shape = null;
        }
    }
}

export const lightOn = (l) => !l.broken && l.out <= 0;

/** Разбить лампу насовсем. Тьму можно не искать, а делать, — но громко. */
export function breakLight(l) {
    l.broken = true;
    l.shape = null;
}

/** Погасить на время: рубильник, а не пуля. */
export function douseLight(l, seconds = LIGHT.relight) {
    l.out = Math.max(l.out, seconds);
    l.shape = null;
}

/** Вклад одного источника в точке. Ноль, если между ними стена. */
function contribution(level, l, x, y) {
    if (!lightOn(l)) return 0;
    const d = Math.hypot(x - l.x, y - l.y);
    if (d >= l.r) return 0;

    if (l.kind === 'beam') {
        let da = Math.abs(normalize(Math.atan2(y - l.y, x - l.x) - l.angle));
        if (da > l.arc) return 0;
        // Край луча мягче середины, иначе прожектор режет двор ножницами.
        const edge = 1 - (da / l.arc) ** 2;
        if (rayBlocked(level, l.x, l.y, x, y)) return 0;
        return Math.min(1, (1 - d / l.r) * LIGHT.core) * edge;
    }

    if (rayBlocked(level, l.x, l.y, x, y)) return 0;
    return Math.min(1, (1 - d / l.r) * LIGHT.core);
}

/**
 * Освещённость точки: 0 — ночь, 1 — под самой лампой. Максимум, не сумма.
 */
export function illumination(level, lights, x, y) {
    let best = level.ambient ?? LIGHT.ambient;
    for (const l of lights) {
        const v = contribution(level, l, x, y);
        if (v > best) best = v;
    }
    return Math.min(1, best);
}

const normalize = (a) => {
    let v = a;
    while (v > Math.PI) v -= Math.PI * 2;
    while (v < -Math.PI) v += Math.PI * 2;
    return v;
};

/**
 * Многоугольник, который фонарь реально освещает: лучи веером, каждый
 * укорочен о свою стену.
 *
 * Как и с конусом зрения, рисуется ровно та область, которую считает код.
 * Картинка, которая врёт о правиле, хуже отсутствующей: игрок построит по
 * ней маршрут и не поймёт, почему его увидели.
 */
export function lightShape(level, l, rays = 40) {
    if (l.shape) return l.shape;
    const points = [];
    if (l.kind === 'beam') {
        for (let i = 0; i <= rays; i += 1) {
            const a = l.angle - l.arc + (l.arc * 2 * i) / rays;
            points.push({ a, d: rayReach(level, l.x, l.y, a, l.r) });
        }
    } else {
        for (let i = 0; i < rays; i += 1) {
            const a = (Math.PI * 2 * i) / rays;
            points.push({ a, d: rayReach(level, l.x, l.y, a, l.r) });
        }
    }
    l.shape = points;
    return points;
}
