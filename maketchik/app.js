import { STAGE, TYPES, clampBlock, createBlock, createEmptyState, minHeightForLabel, parseScheme, snapshot, wrapLabel } from './core.mjs';

const $ = (selector) => document.querySelector(selector);
const KEY = 'aka-gst.maketchik.v2';
let loadedFromStorage = false;
let state = load();
let selectedId = state.blocks[0]?.id || null;
let history = [];
let gesture = null;
let labelBeforeEdit = null;
let pendingAction = null;
let previewUrl = '';

const canvas = $('#canvas');
const blocksRoot = $('#blocks');
const labelInput = $('#label');
const typeInput = $('#type');

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { loadedFromStorage = true; return parseScheme(raw); }
    return createEmptyState();
  } catch (error) {
    queueMicrotask(() => showError(`Сохранённая схема не открылась: ${error.message}`));
    return createEmptyState();
  }
}

function showError(message) { const el = $('#error'); el.textContent = message; el.hidden = false; }
function clearError() { $('#error').hidden = true; }
function persist() {
  try {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(KEY, snapshot(state));
    loadedFromStorage = true;
    $('#save-state').textContent = 'Сохранено на этом устройстве';
    clearError();
    return true;
  } catch (error) {
    $('#save-state').textContent = 'Не сохранено';
    showError(`Не удалось сохранить схему: ${error.message}`);
    return false;
  }
}
function checkpoint(value = state) {
  history.push(snapshot(value));
  if (history.length > 60) history.shift();
  $('#undo').disabled = false;
}
function selected() { return state.blocks.find((block) => block.id === selectedId); }
function setState(next, save = true) { state = next; if (save) persist(); render(); }

function render() {
  const hasBlocks = state.blocks.length > 0;
  $('#empty-state').hidden = hasBlocks;
  $('#workspace').hidden = !hasBlocks;
  blocksRoot.replaceChildren(...state.blocks.map(blockNode));
  const block = selected();
  $('#inspector').hidden = !block;
  if (block && document.activeElement !== labelInput) labelInput.value = block.label;
  if (block) {
    typeInput.value = block.type;
    $('#label-count').textContent = `${block.label.length}/120`;
  }
  $('#undo').disabled = history.length === 0;
  $('#undo-empty').hidden = history.length === 0 || hasBlocks;
  if (loadedFromStorage) $('#save-state').textContent = 'Сохранено на этом устройстве';
}

function blockNode(block) {
  const ns = 'http://www.w3.org/2000/svg';
  const group = document.createElementNS(ns, 'g');
  group.classList.add('block');
  if (block.id === selectedId) group.classList.add('selected');
  group.dataset.id = block.id;
  group.setAttribute('transform', `translate(${block.x} ${block.y})`);
  group.setAttribute('tabindex', '0');
  group.setAttribute('role', 'button');
  group.setAttribute('aria-label', `${TYPES[block.type].label}: ${block.label || 'Без подписи'}`);
  const rect = document.createElementNS(ns, 'rect');
  rect.setAttribute('width', block.w); rect.setAttribute('height', block.h); rect.setAttribute('rx', '14');
  rect.setAttribute('stroke', TYPES[block.type].color); rect.classList.add('block-rect');
  const kind = document.createElementNS(ns, 'text');
  kind.setAttribute('x', '18'); kind.setAttribute('y', '28'); kind.setAttribute('fill', TYPES[block.type].color); kind.classList.add('block-kind'); kind.textContent = TYPES[block.type].label;
  const text = document.createElementNS(ns, 'text');
  text.setAttribute('x', '18'); text.setAttribute('y', '58'); text.classList.add('block-label');
  const maxChars = Math.max(8, Math.floor((block.w - 36) / 11));
  wrapLabel(block.label, maxChars).forEach((line, index) => {
    const span = document.createElementNS(ns, 'tspan'); span.setAttribute('x', '18'); span.setAttribute('dy', index ? '24' : '0'); span.textContent = line; text.append(span);
  });
  const handle = document.createElementNS(ns, 'rect');
  handle.setAttribute('x', block.w - 16); handle.setAttribute('y', block.h - 16); handle.setAttribute('width', '16'); handle.setAttribute('height', '16'); handle.setAttribute('stroke', TYPES[block.type].color); handle.classList.add('resize'); handle.dataset.resize = 'true';
  group.append(rect, kind, text, handle);
  return group;
}

function svgPoint(event) {
  const point = new DOMPoint(event.clientX, event.clientY);
  return point.matrixTransform(canvas.getScreenCTM().inverse());
}
function addBlock(type = 'screen') {
  checkpoint();
  const vb = canvas.viewBox.baseVal;
  const block = createBlock(type, state.blocks.length, { x: vb.x, y: vb.y, width: vb.width, height: vb.height });
  state.blocks.push(block); selectedId = block.id; persist(); render();
  requestAnimationFrame(() => labelInput.focus());
}

canvas.addEventListener('pointerdown', (event) => {
  const group = event.target.closest('.block');
  if (!group) return;
  const block = state.blocks.find((item) => item.id === group.dataset.id);
  selectedId = block.id;
  const p = svgPoint(event);
  gesture = { id: block.id, mode: event.target.dataset.resize ? 'resize' : 'move', start: p, before: snapshot(state), origin: { ...block } };
  canvas.setPointerCapture(event.pointerId); render();
});
canvas.addEventListener('pointermove', (event) => {
  if (!gesture) return;
  const p = svgPoint(event), block = state.blocks.find((item) => item.id === gesture.id);
  const dx = p.x - gesture.start.x, dy = p.y - gesture.start.y;
  Object.assign(block, gesture.mode === 'resize'
    ? clampBlock({ ...gesture.origin, w: gesture.origin.w + dx, h: gesture.origin.h + dy })
    : clampBlock({ ...gesture.origin, x: gesture.origin.x + dx, y: gesture.origin.y + dy }));
  render();
});
canvas.addEventListener('pointerup', () => {
  if (!gesture) return;
  history.push(gesture.before); gesture = null; persist(); render();
});
canvas.addEventListener('pointercancel', () => {
  if (!gesture) return;
  state = parseScheme(gesture.before); gesture = null; persist(); render();
});
canvas.addEventListener('keydown', (event) => {
  const group = event.target.closest('.block');
  if (!group) return;
  selectedId = group.dataset.id;
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteSelected(); return; }
  if (!event.key.startsWith('Arrow')) return;
  event.preventDefault(); checkpoint();
  const step = event.shiftKey ? 10 : 2, block = selected();
  const delta = { ArrowLeft: [-step,0], ArrowRight:[step,0], ArrowUp:[0,-step], ArrowDown:[0,step] }[event.key];
  Object.assign(block, event.altKey ? clampBlock({ ...block, w: block.w + delta[0], h: block.h + delta[1] }) : clampBlock({ ...block, x: block.x + delta[0], y: block.y + delta[1] }));
  persist(); render(); requestAnimationFrame(() => document.querySelector(`[data-id="${selectedId}"]`)?.focus());
});

labelInput.addEventListener('focus', () => { labelBeforeEdit = snapshot(state); });
labelInput.addEventListener('input', () => {
  const block = selected(); if (!block) return;
  block.label = labelInput.value;
  block.h = Math.max(block.h, minHeightForLabel(block));
  $('#label-count').textContent = `${block.label.length}/120`;
  persist(); render();
});
labelInput.addEventListener('blur', () => { if (labelBeforeEdit && labelBeforeEdit !== snapshot(state)) history.push(labelBeforeEdit); labelBeforeEdit = null; render(); });
typeInput.addEventListener('change', () => { const block = selected(); if (!block) return; checkpoint(); block.type = typeInput.value; persist(); render(); });

function deleteSelected() {
  if (!selected()) return; checkpoint();
  state.blocks = state.blocks.filter((block) => block.id !== selectedId);
  selectedId = state.blocks.at(-1)?.id || null; persist(); render();
}
$('#delete').addEventListener('click', deleteSelected);
function undo() { if (!history.length) return; state = parseScheme(history.pop()); selectedId = state.blocks.at(-1)?.id || null; persist(); render(); }
$('#undo').addEventListener('click', undo);
$('#undo-empty').addEventListener('click', undo);
document.querySelectorAll('[data-add]').forEach((button) => button.addEventListener('click', () => addBlock(button.dataset.add)));
$('#first-block').addEventListener('click', () => addBlock('screen'));
$('#load-example').addEventListener('click', () => {
  checkpoint(); state = createEmptyState(); state.title = 'Пример страницы';
  state.blocks = [
    { ...createBlock('screen',0), label:'Главный экран', x:70, y:70, w:520, h:230 },
    { ...createBlock('block',1), label:'Что здесь важно', x:650, y:100, w:390, h:160 },
    { ...createBlock('action',2), label:'Оставить заявку', x:470, y:420, w:340, h:120 },
  ].map(clampBlock); selectedId = state.blocks[0].id; persist(); render();
});
$('#fit').addEventListener('click', () => canvas.setAttribute('viewBox', `0 0 ${STAGE.width} ${STAGE.height}`));
$('#handoff').addEventListener('click', () => { $('#handoff-actions').hidden = !$('#handoff-actions').hidden; });

function download(name, body, type) {
  const a = document.createElement('a'); a.download = name; a.href = URL.createObjectURL(new Blob([body], { type })); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function downloadJson() { download('maketchik-shema.json', snapshot(state), 'application/json'); }
$('#download-json').addEventListener('click', downloadJson);

function drawPng() {
  const out = document.createElement('canvas'); out.width = STAGE.width * 2; out.height = STAGE.height * 2;
  const ctx = out.getContext('2d'); ctx.scale(2,2); ctx.fillStyle = '#fffdf8'; ctx.fillRect(0,0,STAGE.width,STAGE.height);
  ctx.strokeStyle = '#e8e1d5'; ctx.lineWidth = 1;
  for (let x=0;x<STAGE.width;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,STAGE.height);ctx.stroke()}
  for (let y=0;y<STAGE.height;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(STAGE.width,y);ctx.stroke()}
  for (const source of state.blocks) {
    const block = clampBlock({ ...source, h: Math.max(source.h, minHeightForLabel(source)) });
    ctx.fillStyle='#fffdf8';ctx.strokeStyle=TYPES[block.type].color;ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(block.x,block.y,block.w,block.h,14);ctx.fill();ctx.stroke();
    ctx.fillStyle=TYPES[block.type].color;ctx.font='700 13px monospace';ctx.fillText(TYPES[block.type].label.toUpperCase(),block.x+18,block.y+28);
    ctx.fillStyle='#20242c';ctx.font='700 20px system-ui';
    const maxChars=Math.max(8,Math.floor((block.w-36)/11)); wrapLabel(block.label,maxChars).forEach((line,i)=>ctx.fillText(line,block.x+18,block.y+58+i*24));
  }
  return out.toDataURL('image/png');
}
$('#download-png').addEventListener('click', () => {
  previewUrl = drawPng(); $('#preview-image').src = previewUrl; $('#preview-dialog').showModal();
});
$('#save-preview').addEventListener('click', (event) => { event.preventDefault(); const a=document.createElement('a');a.download='maketchik-shema.png';a.href=previewUrl;a.click();$('#preview-dialog').close(); });

const confirmDialog = $('#confirm-dialog');
function confirmReplacement(action, title, copy) {
  pendingAction = action;
  if (!state.blocks.length) return action();
  $('#dialog-title').textContent = title; $('#dialog-copy').textContent = copy; confirmDialog.showModal();
}
confirmDialog.addEventListener('close', () => {
  if (confirmDialog.returnValue === 'download') { downloadJson(); return; }
  if (confirmDialog.returnValue === 'continue') pendingAction?.();
  pendingAction = null;
});
$('#new-scheme').addEventListener('click', () => confirmReplacement(() => { checkpoint(); setState(createEmptyState()); selectedId=null; }, 'Начать новую схему?', 'Текущая схема будет заменена. Сначала её можно скачать.'));
$('#open-scheme').addEventListener('click', () => confirmReplacement(() => $('#file-input').click(), 'Открыть сохранённую схему?', 'Текущая схема будет заменена файлом. Сначала её можно скачать.'));
$('#file-input').addEventListener('change', async () => {
  const file = $('#file-input').files[0]; $('#file-input').value=''; if (!file) return;
  try { const next = parseScheme(await file.text()); checkpoint(); state=next; selectedId=next.blocks[0]?.id||null; persist(); render(); }
  catch(error){ showError(`Файл не открыт: ${error.message}. Текущая схема сохранена.`); }
});

render();
