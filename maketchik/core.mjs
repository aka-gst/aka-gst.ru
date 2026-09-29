export const STAGE = Object.freeze({ width: 1280, height: 760 });
export const TYPES = Object.freeze({
  screen: { label: 'Экран', color: '#6651a8' },
  block: { label: 'Блок', color: '#2f735d' },
  action: { label: 'Действие', color: '#b66b3d' },
  note: { label: 'Заметка', color: '#7a647f' },
});

export function createEmptyState() {
  return { version: 2, title: 'Новая схема', updatedAt: new Date().toISOString(), blocks: [] };
}

export function wrapLabel(value, maxChars = 24) {
  const text = String(value ?? '');
  if (!text) return ['Без подписи'];
  const lines = [];
  for (const paragraph of text.split('\n')) {
    if (!paragraph) { lines.push(''); continue; }
    let line = '';
    for (const token of paragraph.match(/\S+|\s+/g) || []) {
      if (/^\s+$/.test(token)) {
        if (line && !line.endsWith(' ')) line += ' ';
        continue;
      }
      let word = token;
      while (word.length > maxChars) {
        if (line.trim()) { lines.push(line.trimEnd()); line = ''; }
        lines.push(word.slice(0, maxChars));
        word = word.slice(maxChars);
      }
      const candidate = line + word;
      if (candidate.length > maxChars && line.trim()) {
        lines.push(line.trimEnd());
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line || !lines.length) lines.push(line.trimEnd());
  }
  return lines;
}

export function minHeightForLabel(block) {
  const maxChars = Math.max(8, Math.floor((block.w - 36) / 11));
  return Math.max(92, 56 + wrapLabel(block.label, maxChars).length * 24);
}

export function clampBlock(block) {
  const w = Math.min(STAGE.width, Math.max(150, Number(block.w) || 260));
  const provisional = { ...block, w };
  const h = Math.min(STAGE.height, Math.max(minHeightForLabel(provisional), Number(block.h) || 132));
  return {
    ...block,
    x: Math.max(0, Math.min(STAGE.width - w, Number(block.x) || 0)),
    y: Math.max(0, Math.min(STAGE.height - h, Number(block.y) || 0)),
    w,
    h,
  };
}

export function createBlock(type = 'screen', index = 0, viewport = STAGE) {
  const w = 280;
  const h = 132;
  const left = Math.max(0, viewport.x ?? 0);
  const top = Math.max(0, viewport.y ?? 0);
  const visibleW = Math.min(STAGE.width - left, viewport.width ?? STAGE.width);
  const visibleH = Math.min(STAGE.height - top, viewport.height ?? STAGE.height);
  return clampBlock({
    id: `b-${Date.now()}-${index}`,
    type: TYPES[type] ? type : 'screen',
    label: '',
    x: left + Math.max(18, Math.min(visibleW - w - 18, 42 + (index % 3) * 44)),
    y: top + Math.max(18, Math.min(visibleH - h - 18, 42 + (index % 4) * 38)),
    w,
    h,
  });
}

export function parseScheme(raw) {
  const candidate = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!candidate || !Array.isArray(candidate.blocks) || candidate.blocks.length > 200) {
    throw new Error('В файле нет корректной схемы');
  }
  const ids = new Set();
  const blocks = candidate.blocks.map((source, index) => {
    const label = String(source.label ?? '');
    if (label.length > 120) throw new Error(`Подпись блока ${index + 1} длиннее 120 знаков`);
    const id = String(source.id || `import-${index}`);
    if (ids.has(id)) throw new Error('В схеме повторяются идентификаторы блоков');
    ids.add(id);
    if (![source.x, source.y, source.w, source.h].every(Number.isFinite)) {
      throw new Error(`У блока ${index + 1} неверные координаты`);
    }
    return clampBlock({ ...source, id, label, type: TYPES[source.type] ? source.type : 'block' });
  });
  return {
    version: 2,
    title: String(candidate.title || 'Сохранённая схема').slice(0, 80),
    updatedAt: new Date().toISOString(),
    blocks,
  };
}

export function snapshot(state) {
  return JSON.stringify({ ...state, version: 2, updatedAt: new Date().toISOString() }, null, 2);
}
