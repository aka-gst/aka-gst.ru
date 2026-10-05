// «Шкаф Сани» — системная головоломка из пилота «Вскрытия» (/vskrytie/game.js).
// Шкаф в углу гаража открывается несколькими путями, и у каждого своя цена:
//   лампа        — тихо, но долго (читаешь отклик шкалы при свете);
//   генератор + сигнал — быстро, но громко (Витя услышит);
//   стабилизатор — подготовленный путь: тихо и быстро, но стабилизатор
//                  расходуется (их собирают, открывая устройства доски).
// Быстрее значит громче. Вымышленное устройство, никакой реальной техники.

export function createState() {
  return {
    lamp: false,
    generator: false,
    signal: false,
    stabilizer: false
  };
}

export function useLamp(state) {
  return { ...state, lamp: true };
}

export function startGenerator(state) {
  return { ...state, generator: true };
}

export function readSignal(state) {
  return state.generator ? { ...state, signal: true } : state;
}

export function placeStabilizer(state) {
  return { ...state, stabilizer: true };
}

export function attemptOpen(state) {
  if (state.signal) {
    return {
      status: 'opened',
      route: 'signal',
      time: 4,
      noise: 1,
      message: 'Сигнал собран. Шкаф открыт быстро, но генератор услышали.'
    };
  }

  if (state.stabilizer) {
    return {
      status: 'opened',
      route: 'stabilizer',
      time: 6,
      noise: 0,
      spentStabilizer: true,
      message: 'Стабилизатор успокоил шкалу. Шкаф открыт подготовленным путём.'
    };
  }

  if (state.lamp) {
    return {
      status: 'opened',
      route: 'lamp',
      time: 10,
      noise: 0,
      message: 'Лампа показывает отклик. Шкаф открыт тихо.'
    };
  }

  return {
    status: 'blocked',
    message: 'Шкала молчит: сначала нужна подготовка.'
  };
}

// --- QueQuest additions -------------------------------------------------
export const CABINET_ROUTES = Object.freeze(['lamp', 'signal', 'stabilizer']);
export const ROUTE_NAMES = Object.freeze({ lamp: 'ЛАМПА · ТИХО', signal: 'ГЕНЕРАТОР + СИГНАЛ · БЫСТРО', stabilizer: 'СТАБИЛИЗАТОР · ПОДГОТОВКА' });

// One action on the cabinet from the overlay; `stock` -- stabilizers owned.
export function cabinetAction(state, action, { stock = 0 } = {}) {
  switch (action) {
    case 'lamp': return { state: useLamp(state), note: 'Лампа над шкалой. Отклик видно, но читать его долго.' };
    case 'generator': return { state: startGenerator(state), note: 'Генератор затарахтел. В гараже громко.', noise: true };
    case 'signal': return state.generator
      ? { state: readSignal(state), note: 'Сигнал снят со шкалы. Можно открывать.' }
      : { state, note: 'Сигнал нечем снять: генератор молчит.', blocked: true };
    case 'stabilizer': return stock > 0
      ? { state: placeStabilizer(state), note: 'Стабилизатор встал на шкалу.' }
      : { state, note: 'Стабилизаторов нет. Их дают устройства доски — открой «ЛИСУ-3» или дальше.', blocked: true };
    default: return { state, note: '', blocked: true };
  }
}
