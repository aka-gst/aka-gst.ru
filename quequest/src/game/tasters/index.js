// 20.0 · the tasters added after 19.0, one module each (PLANS/ПЛАТФОРМА-НАВЫКОВ-РЫНОК.md,
// ФИНИШ-ПРОБЫ-20.md). A module exports: taster (the same data shape as career-tasters.js),
// knobs(values, level) → {ok, why, run}, fate(case) → the scene's word for a code case,
// paint(P, view) and label. career-tasters.js and taster-scene.js read them from here.
import * as agents from './agents.js';
import * as visuals from './visuals.js';
import * as sound from './sound.js';
import * as gamelogic from './gamelogic.js';
import * as maker from './maker.js';
import * as data from './data.js';

// The order is Сергей's (13.10): ИИ-агенты, визуал, музыка, логика игр, плата, таблицы.
export const MORE_TASTERS = Object.freeze([agents, visuals, sound, gamelogic, maker, data]);
