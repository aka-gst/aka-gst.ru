export const CHIP_SHOWCASE_PHASES = Object.freeze([
  { id: 'boxes', label: 'ЯЩИКИ', duration: 3000 },
  { id: 'boss', label: 'НАЧАЛЬНИК ХЛОПАЕТ ДВЕРЬЮ', duration: 1200 },
  { id: 'scatter', label: 'ЧИП И БУМАЖКА РАЗЛЕТАЮТСЯ', duration: 1000 },
  { id: 'insert', label: 'ЧИП ВСТАЁТ В РОБОТА', duration: 1100 },
  { id: 'terminal', label: 'ТЕРМИНАЛ', duration: 1200 },
  { id: 'wake', label: 'РУКА ЗАРАБОТАЛА', duration: 1500 },
]);

export const CHIP_SHOWCASE_DURATION = CHIP_SHOWCASE_PHASES.reduce((sum, phase) => sum + phase.duration, 0);

export function getChipShowcasePhase(elapsed) {
  const time = ((elapsed % CHIP_SHOWCASE_DURATION) + CHIP_SHOWCASE_DURATION) % CHIP_SHOWCASE_DURATION;
  let start = 0;
  for (const phase of CHIP_SHOWCASE_PHASES) {
    if (time < start + phase.duration) {
      return { ...phase, index: CHIP_SHOWCASE_PHASES.indexOf(phase), progress: (time - start) / phase.duration };
    }
    start += phase.duration;
  }
  return { ...CHIP_SHOWCASE_PHASES[0], index: 0, progress: 0 };
}
