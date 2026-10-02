import {
  COLLAPSE_DURATION,
  INTERACTION_RADIUS,
  MACHINE,
  PALLET,
  WAKE_REVEAL_DURATION,
  WAREHOUSE_INTRO_DURATION,
  WORLD,
  CRATE_PAY,
} from './config.js?v=novice-1';
import { getArmTransferPhase } from './model.js?v=novice-1';
import { getSceneCameraTarget, getViewportTransform } from './viewport.js?v=2';
import { getChipShowcasePhase } from './showcase-chip.js?v=1';
import { CHIP_SOCKET, DOOR_SLAM_AT, getBossBeat, getChipPose } from './chip-scene.js';

const prologueImage = new Image();
prologueImage.src = 'art/night2-hero.jpg';
const rewardImage = new Image();
rewardImage.src = 'art/garage-milestone-1.jpg';

function viewportTransform(ctx, viewport, state) {
  const { scale, offsetX, offsetY } = getViewportTransform(viewport, getSceneCameraTarget(state));
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
}

function drawCover(ctx, image, alpha = 1) {
  if (!image.complete || !image.naturalWidth) return;
  const scale = Math.max(WORLD.width / image.naturalWidth, WORLD.height / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, (WORLD.width - width) / 2, (WORLD.height - height) / 2, width, height);
  ctx.restore();
}

function drawGrid(ctx, color = '#1d4c57') {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = .35;
  ctx.lineWidth = 1;
  for (let x = 0; x <= WORLD.width; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.height); ctx.stroke();
  }
  for (let y = 0; y <= WORLD.height; y += 80) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.width, y); ctx.stroke();
  }
  ctx.restore();
}

function drawCombatHero(ctx, state, now) {
  const { x, y } = state.player;
  const recoil = state.sceneTime - state.prologue.lastShotAt < .1 ? 9 : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = '#64e9ff';
  ctx.shadowBlur = 34;
  ctx.fillStyle = '#183d4b';
  ctx.strokeStyle = '#b9f6ff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-46, -72); ctx.lineTo(-78, -28); ctx.lineTo(-58, 30);
  ctx.lineTo(-30, 48); ctx.lineTo(30, 48); ctx.lineTo(58, 30);
  ctx.lineTo(78, -28); ctx.lineTo(46, -72); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#64e9ff';
  ctx.fillRect(-28, -54, 56, 12);
  ctx.fillStyle = '#e9e3d5';
  ctx.fillRect(-50, 45, 28, 54);
  ctx.fillRect(22, 45, 28, 54);
  ctx.fillStyle = '#283747';
  ctx.fillRect(-90, -38, 38, 72);
  ctx.fillRect(52, -38, 38, 72);
  ctx.fillStyle = '#ffc857';
  ctx.beginPath();
  ctx.arc(0, 2, 13 + Math.sin(now / 80) * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#53657a';
  ctx.fillRect(64, -50, 98 - recoil, 28);
  ctx.fillStyle = '#ffdf7a';
  ctx.shadowColor = '#ffc857';
  ctx.shadowBlur = recoil ? 35 : 0;
  ctx.fillRect(162 - recoil, -45, recoil ? 34 : 8, 18);
  ctx.restore();
}

function drawWorker(ctx, state) {
  const { x, y, carrying } = state.player;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#cfa87c';
  ctx.beginPath(); ctx.arc(0, -54, 22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6f4c32';
  ctx.fillRect(-24, -43, 48, 9);
  ctx.fillStyle = '#d6a447';
  ctx.beginPath(); ctx.ellipse(0, 4, 43, 55, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2d263';
  ctx.fillRect(-39, -26, 78, 12);
  ctx.fillStyle = '#303a47';
  ctx.fillRect(-31, 43, 24, 51);
  ctx.fillRect(7, 43, 24, 51);
  ctx.fillStyle = '#171e29';
  ctx.fillRect(-38, 88, 31, 11);
  ctx.fillRect(7, 88, 31, 11);
  if (carrying) {
    ctx.fillStyle = '#bb8440';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 12;
    ctx.fillRect(-48, -4, 96, 64);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#e9e3d5';
    ctx.globalAlpha = .55;
    ctx.strokeRect(-40, 4, 80, 48);
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = '#cfa87c';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (carrying) {
    ctx.moveTo(-33, -12); ctx.lineTo(-48, 7); ctx.lineTo(-36, 25);
    ctx.moveTo(33, -12); ctx.lineTo(48, 7); ctx.lineTo(36, 25);
  } else {
    ctx.moveTo(-33, -12); ctx.lineTo(-48, 25); ctx.lineTo(-42, 58);
    ctx.moveTo(33, -12); ctx.lineTo(48, 25); ctx.lineTo(42, 58);
  }
  ctx.stroke();
  ctx.restore();
}

function drawCrate(ctx, crate, stack = 0) {
  const x = crate.status === 'pallet' ? PALLET.x + 8 + (stack % 3) * 52 : crate.x;
  const y = crate.status === 'pallet' ? PALLET.y + 52 - Math.floor(stack / 3) * 54 : crate.y;
  ctx.fillStyle = crate.kind === 'red' ? '#ff4d5a' : '#bb8440';
  ctx.fillRect(x - 23, y - 23, 46, 46);
  ctx.strokeStyle = '#e9e3d5';
  ctx.globalAlpha = .45;
  ctx.strokeRect(x - 18, y - 18, 36, 36);
  ctx.globalAlpha = 1;
}


function drawProgramTraceWorld(ctx, state) {
  const visible = state.scene === 'condition' || state.scene === 'queue' || state.scene === 'function'
    || (state.scene === 'automation' && ['condition', 'queue', 'function'].includes(state.arm.startSource));
  if (!visible) return;
  const crates = state.warehouse.crates.filter((crate) => crate.status !== 'hidden');
  if (!crates.length) return;
  const functionMode = state.scene === 'function' || state.arm.startSource === 'function';
  const trace = functionMode
    ? (Array.isArray(state.learning?.functionTrace) ? state.learning.functionTrace : [])
    : (Array.isArray(state.learning?.queueTrace) ? state.learning.queueTrace : []);
  const traceIndex = trace.length ? Math.min(trace.length - 1, Math.max(0, Math.floor(state.sceneTime / .7))) : -1;
  const traceEntry = traceIndex >= 0 ? trace[traceIndex] : null;
  const activeId = traceEntry?.boxId ?? state.arm.active?.boxId ?? null;
  const queueMode = state.scene === 'queue' || state.arm.startSource === 'queue';
  const x0 = 78;
  const y0 = 240;
  const cell = 58;
  const gap = 8;

  ctx.save();
  ctx.fillStyle = '#061019dd';
  ctx.strokeStyle = functionMode ? '#72f0bc' : (queueMode ? '#899cff' : '#64e9ff');
  ctx.lineWidth = 2;
  ctx.fillRect(x0 - 22, y0 - 78, Math.max(470, crates.length * (cell + gap) + 44), 154);
  ctx.strokeRect(x0 - 22, y0 - 78, Math.max(470, crates.length * (cell + gap) + 44), 154);
  ctx.fillStyle = functionMode ? '#a8ffd9' : (queueMode ? '#aeb9ff' : '#92f5ff');
  ctx.font = '900 13px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(functionMode ? 'PYTHON · DEF route(batch) · CALL A / B' : (queueMode ? 'PYTHON · queue = [ ... ] · WHILE' : 'PYTHON · boxes = [ ... ] · FOR'), x0, y0 - 48);

  crates.forEach((crate, index) => {
    const x = x0 + index * (cell + gap);
    const done = crate.status === 'pallet';
    const active = crate.id === activeId;
    ctx.globalAlpha = done ? .25 : 1;
    ctx.fillStyle = crate.kind === 'red' ? '#551820' : '#172638';
    ctx.strokeStyle = active ? '#ffc857' : (crate.kind === 'red' ? '#ff7580' : '#52687f');
    ctx.lineWidth = active ? 5 : 2;
    ctx.fillRect(x, y0 - 16, cell, 44);
    ctx.strokeRect(x, y0 - 16, cell, 44);
    ctx.fillStyle = crate.kind === 'red' ? '#ffd1d5' : '#dce8f0';
    ctx.font = '900 12px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(crate.kind === 'red' ? 'КРАСН.' : (functionMode ? `${crate.line ?? '?'}${index}` : String(index)), x + cell / 2, y0 + 11);
    ctx.fillStyle = '#71869a';
    ctx.font = '700 9px ui-monospace, monospace';
    ctx.fillText(`[${index}]`, x + cell / 2, y0 + 43);
    if (active) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffc857';
      ctx.beginPath();
      ctx.moveTo(x + cell / 2, y0 - 42);
      ctx.lineTo(x + cell / 2 - 9, y0 - 28);
      ctx.lineTo(x + cell / 2 + 9, y0 - 28);
      ctx.closePath();
      ctx.fill();
      ctx.font = '900 10px ui-monospace, monospace';
      ctx.fillText('box', x + cell / 2, y0 - 50);
    }
  });
  ctx.globalAlpha = 1;
  if (traceEntry) {
    ctx.textAlign = 'left';
    ctx.font = '900 12px ui-monospace, monospace';
    ctx.fillStyle = traceEntry.decision === 'move' ? '#6dffaf' : '#ff7c86';
    ctx.fillText(
      `${functionMode ? `LINE ${traceEntry.line} · ` : ''}${traceEntry.decision === 'move' ? 'IF → TRUE → ARM.MOVE' : 'IF → FALSE → ОСТАВИТЬ'}`,
      x0,
      y0 + 68,
    );
  }
  ctx.restore();
}

// "Спокойный" из Аниматеки: cubic-bezier(0.4, 0, 0.2, 1).
// Он помечен там как кривая для перемещений в обе стороны, поэтому обратный
// путь героя — та же траектория, а не телепортация или новая анимация.

function drawFunctionModule(ctx, state, now) {
  const visible = state.scene === 'function'
    || (state.scene === 'automation' && state.arm.startSource === 'function')
    || state.checkpoint === 'reward4';
  if (!visible) return;

  const x = 650;
  const y = 505;
  const w = 250;
  const h = 112;
  const pulse = .55 + Math.sin(now / 180) * .18;
  const active = state.scene === 'automation' && state.arm.startSource === 'function';

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Один физический «картридж поведения». От него идут две связи к двум
  // независимым линиям — ровно та же метафора, что у route(line_a/b).
  ctx.strokeStyle = active ? '#b8ffe0' : '#72f0bc';
  ctx.lineWidth = active ? 7 : 4;
  ctx.globalAlpha = active ? .95 : .58 + pulse * .25;
  ctx.beginPath();
  ctx.moveTo(x, y + 40); ctx.bezierCurveTo(510, y + 20, 455, 448, 350, 448);
  ctx.moveTo(x, y + 72); ctx.bezierCurveTo(510, y + 92, 455, 623, 350, 623);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.shadowColor = '#72f0bc';
  ctx.shadowBlur = active ? 30 : 13 + pulse * 8;
  ctx.fillStyle = '#0b2119';
  ctx.strokeStyle = '#72f0bc';
  ctx.lineWidth = 4;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#8dffd0';
  ctx.font = '900 22px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('DEF ROUTE()', x + 18, y + 34);
  ctx.fillStyle = '#d7ffec';
  ctx.font = '800 13px ui-monospace, monospace';
  ctx.fillText('1 МОДУЛЬ → 2 ЛИНИИ', x + 18, y + 62);
  ctx.fillStyle = '#81bfa5';
  ctx.font = '700 11px ui-monospace, monospace';
  ctx.fillText('batch входит сюда', x + 18, y + 88);

  ctx.fillStyle = active ? '#eafff4' : '#72f0bc';
  for (const cy of [y + 40, y + 72]) {
    ctx.beginPath();
    ctx.arc(x - 2, cy, active ? 8 : 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function calmMotion(progress) {
  const t = Math.max(0, Math.min(1, progress));
  let low = 0;
  let high = 1;
  for (let index = 0; index < 14; index += 1) {
    const u = (low + high) / 2;
    const x = 3 * (1 - u) * (1 - u) * u * .4 + 3 * (1 - u) * u * u * .2 + u * u * u;
    if (x < t) low = u;
    else high = u;
  }
  const u = (low + high) / 2;
  return 3 * (1 - u) * u * u + u * u * u;
}

function drawManualShowcase(ctx, now, reducedMotion) {
  const crates = [
    { id: 'box-01', kind: 'normal', x: 265, y: 560 },
    { id: 'box-02', kind: 'normal', x: 205, y: 630 },
    { id: 'box-03', kind: 'normal', x: 325, y: 650 },
  ];
  const boxDuration = 1000;
  const loopDuration = crates.length * boxDuration * 2;
  const elapsed = reducedMotion ? loopDuration - 1 : now % loopDuration;
  const leg = Math.floor(elapsed / boxDuration);
  const crateIndex = Math.floor(leg / 2);
  const movingToPallet = leg % 2 === 0;
  const current = crates[crateIndex];
  const next = crates[(crateIndex + 1) % crates.length];
  const progress = calmMotion((elapsed % boxDuration) / boxDuration);

  crates.forEach((crate, index) => {
    if (index === crateIndex && movingToPallet) return;
    if (index < crateIndex || (index === crateIndex && !movingToPallet)) {
      drawCrate(ctx, { ...crate, status: 'pallet' }, index);
    } else {
      drawCrate(ctx, { ...crate, status: 'source' });
    }
  });

  const from = movingToPallet ? current : { x: PALLET.x, y: PALLET.y };
  const to = movingToPallet ? { x: PALLET.x, y: PALLET.y } : next;
  const player = {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    carrying: movingToPallet,
  };
  drawWorker(ctx, { player });

  ctx.save();
  ctx.fillStyle = '#e9e3d5';
  ctx.font = '900 46px "Arial Narrow", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ПЕРЕНЕСИ ТРИ ЯЩИКА', WORLD.width / 2, 92);
  ctx.fillStyle = '#ffc857';
  ctx.font = '700 17px ui-monospace, monospace';
  ctx.fillText(movingToPallet ? 'ЧЕЛОВЕК НЕСЁТ ЯЩИК · 1 СЕКУНДА' : 'ЧЕЛОВЕК ИДЁТ ОБРАТНО · ТА ЖЕ ТРАЕКТОРИЯ', WORLD.width / 2, 124);
  ctx.restore();
}

function enemyNumber(enemy) {
  return Number(enemy.id.slice(-2)) || 1;
}

function drawDestroyedEnemy(ctx, enemy, state) {
  const seed = enemyNumber(enemy);
  const age = Math.max(0, state.sceneTime - (enemy.destroyedAt ?? state.sceneTime));
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.fillStyle = '#5a0715';
  ctx.globalAlpha = .65;
  ctx.beginPath();
  ctx.ellipse(0, 16, 28 + seed % 12, 10 + seed % 7, seed * .31, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = Math.max(0, 1 - age / 1.1);
  for (let index = 0; index < 7; index += 1) {
    const angle = seed * .73 + index * .91;
    const travel = 18 + age * (95 + (seed * index) % 70);
    ctx.fillStyle = index % 3 === 0 ? '#ff4d5a' : '#76869a';
    ctx.fillRect(Math.cos(angle) * travel - 5, Math.sin(angle) * travel - 3, 10, 6);
  }
  ctx.restore();
}

function drawDrone(ctx, enemy, now) {
  const seed = enemyNumber(enemy);
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(Math.sin(now / 420 + seed) * .13);
  ctx.shadowColor = '#ff4d5a';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#35131b';
  ctx.strokeStyle = '#ff7580';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  // Spiked bodies read as infection, not anonymous combat drones.
  for (let spike = 0; spike < 10; spike++) {
    const angle = spike * Math.PI / 5;
    const x = Math.cos(angle), y = Math.sin(angle);
    ctx.beginPath(); ctx.moveTo(x*25, y*25); ctx.lineTo(x*39, y*39); ctx.stroke();
    ctx.beginPath(); ctx.arc(x*39, y*39, 4, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#ffdbb2';
  ctx.fillRect(-13, -9, 7, 7); ctx.fillRect(6, -9, 7, 7);
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-12, 10); ctx.lineTo(-4, 5); ctx.lineTo(4, 11); ctx.lineTo(12, 5); ctx.stroke();
  ctx.restore();
}

function drawPrologue(ctx, state, now) {
  ctx.fillStyle = '#02060a';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  drawCover(ctx, prologueImage, .54);
  drawGrid(ctx);

  ctx.save();
  ctx.globalAlpha = .14;
  ctx.fillStyle = '#64e9ff';
  ctx.beginPath(); ctx.arc(state.player.x, state.player.y, 360 + Math.sin(now / 1100) * 10, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  for (const enemy of state.prologue.enemies) {
    if (enemy.alive) drawDrone(ctx, enemy, now);
    else drawDestroyedEnemy(ctx, enemy, state);
  }

  if (state.sceneTime - state.prologue.lastShotAt < .12) {
    const targetId = state.prologue.lastTargets[0];
    const target = state.prologue.enemies.find(({ id }) => id === targetId);
    if (target) {
      ctx.strokeStyle = '#ffe59a';
      ctx.lineWidth = 8;
      ctx.shadowColor = '#ffc857';
      ctx.shadowBlur = 28;
      ctx.beginPath();
      ctx.moveTo(state.player.x + 160, state.player.y - 36);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
      ctx.fillStyle = '#fff4c2';
      ctx.beginPath(); ctx.arc(target.x, target.y, 34, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  if (state.prologue.waveRadius > 0) {
    ctx.strokeStyle = '#ffc857';
    ctx.lineWidth = 8;
    ctx.globalAlpha = Math.min(1, state.prologue.waveRadius / 80);
    ctx.beginPath(); ctx.arc(state.player.x, state.player.y, 210 - state.prologue.waveRadius, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  drawCombatHero(ctx, state, now);
}

function drawTerminal(ctx, state, now) {
  const online = ['machine', 'automation', 'red-crate', 'condition', 'queue', 'function', 'reward'].includes(state.scene);
  const foreshadow = false;
  const buttonAwake = state.arm.awake;
  const buttonMissing = state.learning?.chapter >= 2;
  ctx.save();
  ctx.strokeStyle = buttonAwake ? '#64e9ff' : (foreshadow ? '#ffc857' : '#35404d');
  ctx.globalAlpha = buttonAwake ? .9 : .55;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(MACHINE.x + 70, MACHINE.y + 40);
  ctx.bezierCurveTo(MACHINE.x + 150, MACHINE.y + 85, MACHINE.x + 95, MACHINE.y + 175, MACHINE.x + 155, MACHINE.y + 205);
  ctx.lineTo(MACHINE.x + 48, MACHINE.y + 254);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#202b39';
  ctx.fillRect(MACHINE.x - 88, MACHINE.y - 62, 176, 124);
  ctx.strokeStyle = online ? '#64e9ff' : '#4c3032';
  ctx.lineWidth = 5;
  ctx.strokeRect(MACHINE.x - 74, MACHINE.y - 48, 148, 76);
  ctx.fillStyle = online ? '#092d37' : '#160b0d';
  ctx.fillRect(MACHINE.x - 68, MACHINE.y - 42, 136, 64);
  ctx.fillStyle = online ? '#64e9ff' : (foreshadow && Math.sin(now / 95) > .25 ? '#ffc857' : '#5d3438');
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = online ? 18 + Math.sin(now / 180) * 6 : 2;
  ctx.fillRect(MACHINE.x - 54, MACHINE.y - 25, online ? 78 : 32, 7);
  ctx.fillRect(MACHINE.x - 54, MACHINE.y - 7, online ? 48 : 22, 7);
  ctx.shadowBlur = 0;
  if (state.scene === 'warehouse' && state.checkpoint === 'start') {
    const learned = Math.max(0, Math.min(3, state.warehouse.manualDelivered || 0));
    ctx.font = '800 8px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = learned >= 3 ? '#ffc857' : '#748695';
    ctx.fillText(learned >= 3 ? 'PATTERN READY' : 'LEARNING PATH', MACHINE.x - 54, MACHINE.y + 15);
    for (let i = 0; i < 3; i += 1) {
      const x = MACHINE.x + 10 + i * 20;
      const filled = i < learned;
      ctx.fillStyle = filled ? (learned >= 3 ? '#ffc857' : '#64e9ff') : '#24303c';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = filled ? 10 : 0;
      ctx.beginPath(); ctx.arc(x, MACHINE.y + 12, 5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
  ctx.fillStyle = '#101721';
  ctx.fillRect(MACHINE.x - 18, MACHINE.y + 62, 36, 112);
  ctx.fillRect(MACHINE.x - 62, MACHINE.y + 170, 124, 22);
  const buttonX = MACHINE.x + 155;
  const buttonY = MACHINE.y + 205;
  ctx.fillStyle = '#141b25';
  ctx.strokeStyle = buttonMissing ? '#9d675e' : (buttonAwake ? '#64e9ff' : '#59616b');
  ctx.lineWidth = 5;
  ctx.fillRect(buttonX - 42, buttonY - 30, 84, 60);
  ctx.strokeRect(buttonX - 42, buttonY - 30, 84, 60);
  if (buttonMissing) {
    // Chapter two: the physical shortcut is gone. The player must replace it with code.
    ctx.fillStyle = '#080b10';
    ctx.beginPath(); ctx.arc(buttonX, buttonY, 20, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d36f60';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(buttonX - 9, buttonY + 2); ctx.quadraticCurveTo(buttonX - 23, buttonY + 32, buttonX - 15, buttonY + 45); ctx.stroke();
    ctx.strokeStyle = '#64e9ff';
    ctx.beginPath(); ctx.moveTo(buttonX + 8, buttonY - 1); ctx.quadraticCurveTo(buttonX + 24, buttonY + 30, buttonX + 17, buttonY + 45); ctx.stroke();
    ctx.fillStyle = '#ffc0ac';
    ctx.font = '800 9px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('КНОПКА СНЯТА', buttonX, buttonY + 60);
  } else {
    ctx.fillStyle = buttonAwake ? '#64e9ff' : '#4c3032';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = buttonAwake ? 25 : 3;
    ctx.beginPath(); ctx.arc(buttonX, buttonY, 17, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = buttonAwake ? '#b9f6ff' : '#79828c';
    ctx.font = '700 10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(buttonAwake ? 'ПИТАНИЕ' : 'НЕТ ПИТАНИЯ', buttonX, buttonY + 47);
  }
  ctx.restore();
}

function drawPoster(ctx, state, now) {
  const bossExit = state.scene === 'warehouse' && state.warehouse.bossEntrance;
  const fallen = state.scene !== 'warehouse' || (bossExit && state.sceneTime >= DOOR_SLAM_AT);
  const progress = bossExit
    ? getBossBeat(state.sceneTime).fall
    : (fallen ? 1 : 0);
  const x = 1180 - progress * 410;
  const y = 215 + progress * 495;
  ctx.save();
  if (state.scene === 'automation') ctx.globalAlpha = state.arm.wakeRevealRemaining > 0 ? .18 : .06;
  ctx.translate(x, y);
  ctx.rotate(-.03 + progress * .08);
  ctx.fillStyle = '#e9e3d5';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 18;
  ctx.fillRect(-118, -74, 236, 148);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#262c34';
  ctx.lineWidth = 7;
  ctx.strokeRect(-118, -74, 236, 148);
  ctx.fillStyle = '#111820';
  ctx.textAlign = 'center';
  if (!fallen) {
    ctx.font = '900 21px ui-monospace, monospace';
    ctx.fillText('РУКУ НЕ', 0, -12);
    ctx.fillText('ВКЛЮЧАТЬ', 0, 20);
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillText('приказ № 07', 0, 51);
  } else {
    ctx.font = '900 23px ui-monospace, monospace';
    ctx.font = '900 19px ui-monospace, monospace';
    ctx.fillText('ЧИП → В РАЗЪЁМ', 0, -25);
    ctx.strokeStyle = '#111820';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-45, 34); ctx.lineTo(-8, 4); ctx.lineTo(28, 31); ctx.lineTo(53, 6);
    ctx.stroke();
    for (const [px, py] of [[-45, 34], [-8, 4], [28, 31], [53, 6]]) {
      ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawConveyor(ctx, state) {
  ctx.fillStyle = '#111924';
  ctx.fillRect(15, 445, 390, 290);
  ctx.strokeStyle = '#334357';
  ctx.lineWidth = 10;
  ctx.strokeRect(15, 445, 390, 290);
  ctx.fillStyle = '#8993a1';
  for (let y = 475; y < 720; y += 46) ctx.fillRect(32, y, 350, 5);
  ctx.fillStyle = '#ffc857';
  ctx.font = '700 19px ui-monospace, monospace';
  ctx.fillText('ОБЩАЯ ОЧЕРЕДЬ · ТЕБЕ И РУКЕ', 25, 420);
  ctx.fillStyle = '#30424b';
  ctx.fillRect(PALLET.x - 65, PALLET.y - 48, WORLD.width - PALLET.x + 65, 138);
  ctx.save();
  ctx.beginPath(); ctx.rect(PALLET.x - 65, PALLET.y - 48, WORLD.width - PALLET.x + 65, 138); ctx.clip();
  ctx.fillStyle = '#70908b';
  for (let x = PALLET.x - 100 + (state.elapsed * 110) % 44; x < WORLD.width + 44; x += 44) ctx.fillRect(x, PALLET.y - 36, 5, 112);
  ctx.restore();
  ctx.strokeStyle = '#64e9c0'; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(PALLET.x - 65, PALLET.y - 48); ctx.lineTo(WORLD.width, PALLET.y - 48);
  ctx.moveTo(PALLET.x - 65, PALLET.y + 90); ctx.lineTo(WORLD.width, PALLET.y + 90); ctx.stroke();
  ctx.fillStyle = '#72ffac'; ctx.font = '800 21px ui-monospace, monospace';
  ctx.fillText(`ОТГРУЗКА → +${CRATE_PAY} ₽`, PALLET.x - 65, PALLET.y + 130);
}

function drawArm(ctx, state, now, { wakeProgress = 0 } = {}) {
  const awake = state.arm.awake;
  const watch = 0;
  const wakeRevealProgress = awake
    ? Math.max(0, Math.min(1, 1 - state.arm.wakeRevealRemaining / WAKE_REVEAL_DURATION))
    : 0;
  const angle = awake ? Math.sin(now / 650) * .035 : watch;
  const active = state.arm.active;
  const failure = state.arm.failure;
  const source = active
    ? state.warehouse.crates.find((crate) => crate.id === active.boxId)
    : null;
  const progress = Math.max(0, Math.min(1, active?.progress ?? 0));
  const gesture = state.otherMind.phase === 'awake'
    ? 1
    : (state.otherMind.phase === 'waking' ? Math.min(1, wakeProgress * 1.25) : 0);
  let endX = MACHINE.x - 70 - gesture * 95;
  let endY = MACHINE.y - 55 - gesture * 40;
  let crateX = null;
  let crateY = null;
  let failurePulse = 0;
  if (failure) {
    const red = state.warehouse.crates.find((crate) => crate.id === 'red-01');
    const p = Math.max(0, Math.min(1, failure.progress));
    const targetX = red?.x ?? 720;
    const targetY = (red?.y ?? 575) - 38;
    const restX = MACHINE.x - 70 - gesture * 95;
    const restY = MACHINE.y - 55 - gesture * 40;
    if (failure.phase === 'reach') {
      const t = Math.min(1, p / .28);
      const eased = t * t * (3 - 2 * t);
      endX = restX + (targetX - restX) * eased;
      endY = restY + (targetY - restY) * eased;
    } else if (failure.phase === 'scan') {
      endX = targetX + Math.sin(now / 90) * 18;
      endY = targetY - 12 + Math.sin(now / 55) * 9;
      failurePulse = .45 + Math.sin(now / 85) * .25;
    } else if (failure.phase === 'reject-one') {
      const t = (p - .52) / .24;
      const recoil = Math.sin(Math.min(1, t) * Math.PI);
      endX = targetX + recoil * 155;
      endY = targetY - recoil * 100;
      failurePulse = recoil;
    } else if (failure.phase === 'reject-two') {
      const t = (p - .76) / .16;
      const recoil = Math.sin(Math.min(1, t) * Math.PI);
      endX = targetX + recoil * 210;
      endY = targetY - recoil * 145;
      failurePulse = recoil;
    } else {
      endX = targetX + 205;
      endY = targetY - 150;
      failurePulse = 1;
    }
  } else if (active && source) {
    const phase = getArmTransferPhase(progress);
    if (phase === 'pickup') {
      const p = Math.min(1, progress / .24);
      const returningFromPallet = state.warehouse.autoDelivered > 0;
      const startX = returningFromPallet ? PALLET.x : MACHINE.x - 70 - gesture * 95;
      const startY = returningFromPallet ? PALLET.y - 150 : MACHINE.y - 55 - gesture * 40;
      const swing = Math.min(1, p / .68);
      const swingEased = swing * swing * (3 - 2 * swing);
      const descend = Math.max(0, (p - .68) / .32);
      const descendEased = descend * descend * (3 - 2 * descend);
      endX = startX + (source.x - startX) * swingEased;
      endY = startY + (source.y - 115 - startY) * swingEased + descendEased * 78;
      crateX = source.x;
      crateY = p < .78 ? source.y : source.y - ((p - .78) / .22) * 16;
    } else if (phase === 'carry') {
      const p = (progress - .24) / .6;
      const eased = p * p * (3 - 2 * p);
      endX = source.x + (PALLET.x - source.x) * eased;
      endY = source.y - 37 + (PALLET.y - source.y - 18) * eased - Math.sin(eased * Math.PI) * 245;
      crateX = endX;
      crateY = endY + 34;
    } else {
      const p = (progress - .84) / .16;
      const eased = p * p * (3 - 2 * p);
      endX = PALLET.x;
      endY = PALLET.y - 55 - eased * 95;
      crateX = PALLET.x;
      crateY = PALLET.y + 26;
    }
  } else if (wakeRevealProgress > 0 && wakeRevealProgress < 1) {
    const staged = Math.min(1, wakeRevealProgress * 1.25);
    endX -= staged * 85;
    endY -= Math.sin(staged * Math.PI) * 72;
  }
  const baseX = MACHINE.x;
  const baseY = MACHINE.y + 220;
  const moving = active || failure;
  const elbowX = moving ? (baseX + endX) / 2 : MACHINE.x - 25 - gesture * 30;
  const elbowY = moving ? Math.min(baseY, endY) - 150 : MACHINE.y - 70 - gesture * 18;
  ctx.save();
  ctx.fillStyle = '#283444';
  ctx.fillRect(baseX - 70, baseY + 30, 140, 72);
  ctx.fillStyle = '#03080c';
  ctx.fillRect(CHIP_SOCKET.x - 47, CHIP_SOCKET.y - 26, 94, 52);
  ctx.strokeStyle = state.arm.chip === 'installed' ? '#64e9ff' : '#d3b777';
  ctx.lineWidth = 3;
  ctx.strokeRect(CHIP_SOCKET.x - 47, CHIP_SOCKET.y - 26, 94, 52);
  ctx.fillStyle = '#d3b777';
  for (let i = -2; i <= 2; i++) ctx.fillRect(CHIP_SOCKET.x + i * 14 - 3, CHIP_SOCKET.y - 20, 6, 8);
  if (state.arm.chip !== 'installed') {
    ctx.font = '700 11px ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillText('НЕТ ЧИПА', CHIP_SOCKET.x, CHIP_SOCKET.y + 14);
  }
  ctx.strokeStyle = awake ? '#718398' : '#59687a';
  ctx.lineWidth = 42;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(baseX, baseY + 34); ctx.lineTo(elbowX + angle * 30, elbowY); ctx.lineTo(endX, endY); ctx.stroke();
  ctx.fillStyle = '#263241';
  for (const [x, y] of [[baseX, baseY + 34], [elbowX + angle * 30, elbowY], [endX, endY]]) {
    ctx.beginPath(); ctx.arc(x, y, 29, 0, Math.PI * 2); ctx.fill();
  }
  if (state.otherMind.phase === 'waking' || state.arm.wakeRevealRemaining > 0) {
    const signalProgress = state.arm.wakeRevealRemaining > 0 ? wakeRevealProgress : wakeProgress;
    const signal = Math.min(2.99, signalProgress * 3);
    const joints = [[baseX, baseY + 34], [elbowX + angle * 30, elbowY], [endX, endY]];
    joints.forEach(([x, y], index) => {
      const strength = Math.max(0, 1 - Math.abs(signal - index));
      ctx.fillStyle = strength > .15 ? '#ffc857' : '#64e9ff';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10 + strength * 22;
      ctx.beginPath(); ctx.arc(x, y, 7 + strength * 9, 0, Math.PI * 2); ctx.fill();
    });
  }
  ctx.fillStyle = awake ? '#64e9ff' : '#4c3032';
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.arc(endX, endY, 12, 0, Math.PI * 2); ctx.fill();
  if (failure) {
    const red = state.warehouse.crates.find((crate) => crate.id === 'red-01');
    const x = red?.x ?? 720;
    const y = red?.y ?? 575;
    ctx.globalAlpha = .35 + failurePulse * .45;
    ctx.strokeStyle = failure.phase === 'scan' ? '#64e9ff' : '#ff4d5a';
    ctx.lineWidth = 5 + failurePulse * 7;
    ctx.beginPath();
    ctx.arc(x, y, 42 + failurePulse * 38, 0, Math.PI * 2);
    ctx.stroke();
    if (failure.phase.startsWith('reject') || failure.phase === 'freeze') {
      ctx.globalAlpha = .7 + failurePulse * .3;
      ctx.beginPath();
      ctx.moveTo(x - 42, y - 42); ctx.lineTo(x + 42, y + 42);
      ctx.moveTo(x + 42, y - 42); ctx.lineTo(x - 42, y + 42);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (active && crateX !== null && crateY !== null) {
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#bb8440';
    ctx.fillRect(crateX - 24, crateY - 24, 48, 48);
    ctx.strokeStyle = '#e9e3d5';
    ctx.globalAlpha = .48;
    ctx.strokeRect(crateX - 18, crateY - 18, 36, 36);
  }
  ctx.restore();
}

function drawFirstActionGuide(ctx, state, now, guide) {
  if (!guide) return;
  const dx = guide.x - state.player.x;
  const dy = guide.y - state.player.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const radius = Math.min(145, Math.max(82, length - 54));
  const x = state.player.x + ux * radius;
  const y = state.player.y + uy * radius;
  const pulse = .82 + Math.sin(now / 120) * .18;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(uy, ux));
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffc857';
  ctx.shadowColor = '#ffc857';
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.moveTo(34, 0);
  ctx.lineTo(-18, -27);
  ctx.lineTo(-7, 0);
  ctx.lineTo(-18, 27);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDropFeedback(ctx, state) {
  const age = state.elapsed - state.warehouse.lastDropAt;
  if (age < 0 || age > .72) return;
  const strength = 1 - age / .72;
  const delivered = state.warehouse.lastDropDelivered;
  const x = delivered ? PALLET.x + 56 : state.player.x;
  const y = delivered ? PALLET.y + 82 : state.player.y + 40;
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.strokeStyle = delivered ? '#ffc857' : '#8993a1';
  ctx.lineWidth = 8 * strength + 2;
  ctx.beginPath();
  ctx.ellipse(x, y, 30 + age * 150, 10 + age * 35, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (let index = 0; index < 8; index += 1) {
    const direction = index % 2 ? -1 : 1;
    ctx.fillStyle = index % 3 ? '#8993a1' : '#ffc857';
    ctx.fillRect(x + direction * (15 + index * 8), y - age * (70 + index * 6), 9, 5);
  }
  ctx.restore();
}

function drawWarehouseIntro(ctx, state, { reducedMotion = false } = {}) {
  if (state.warehouse.introComplete || !state.warehouse.bossEntrance) return;
  const time = Math.min(WAREHOUSE_INTRO_DURATION, state.sceneTime);
  const beat = getBossBeat(time);
  const bossX = reducedMotion ? 715 : beat.x;
  const bossY = 575;

  ctx.save();
  ctx.fillStyle = '#080b11';
  ctx.fillRect(810, 330, 155, 355);
  ctx.strokeStyle = '#59687a';
  ctx.lineWidth = 8;
  ctx.strokeRect(810, 330, 155, 355);
  if (beat.bossVisible) {
    ctx.save();
    ctx.translate(bossX, bossY);
    ctx.fillStyle = '#111820';
    ctx.strokeStyle = '#e9e3d5';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, -92, 32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillRect(-43, -60, 86, 125);
    ctx.strokeRect(-43, -60, 86, 125);
    ctx.fillStyle = '#ff4d5a';
    ctx.fillRect(-32, -32, 64, 9);
    ctx.restore();
  }

  // The door closes across the opening after the boss has walked through it.
  const closed = reducedMotion ? (time >= DOOR_SLAM_AT ? 1 : 0) : 1 - beat.doorOpen;
  ctx.fillStyle = '#485260';
  ctx.fillRect(810, 330, 155 * closed, 355);
  if (closed > .8) { ctx.fillStyle = '#d3b777'; ctx.fillRect(934, 505, 14, 8); }

  if (beat.speaking) {
    const label = 'МЕДЛЕННО. РАБОТАЙ БЫСТРЕЕ.';
    ctx.font = '900 24px ui-monospace, monospace';
    ctx.textAlign = 'center';
    const width = ctx.measureText(label).width + 54;
    ctx.fillStyle = '#ffc857';
    ctx.fillRect(800 - width / 2, 310, width, 68);
    ctx.fillStyle = '#080b11';
    ctx.fillText(label, 800, 355);
  }

  if (time >= DOOR_SLAM_AT && time < DOOR_SLAM_AT + .65) {
    const slam = Math.min(1, (time - DOOR_SLAM_AT) / .65);
    ctx.globalAlpha = 1 - slam * .7;
    ctx.fillStyle = '#ffc857';
    ctx.font = '900 30px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ХЛОП.', 885, 290);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function drawPythonChip(ctx, state, now, { reducedMotion = false } = {}) {
  const bossExit = state.scene === 'warehouse' && state.warehouse.bossEntrance;
  if (bossExit && state.sceneTime < DOOR_SLAM_AT) return;
  if (!bossExit && !['chip', 'machine', 'automation', 'red-crate', 'condition', 'queue', 'function', 'reward'].includes(state.scene)) return;
  const chip = bossExit ? 'falling' : state.arm.chip;
  if (chip === 'missing') return;
  const { x, y, rotation, scale } = getChipPose(state, reducedMotion);
  const pulse = .75;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.shadowColor = '#64e9ff';
  ctx.shadowBlur = 17 + pulse * 16;
  ctx.fillStyle = '#133b48';
  ctx.fillRect(-54, -31, 108, 62);
  ctx.strokeStyle = '#b9f6ff';
  ctx.lineWidth = 4;
  ctx.strokeRect(-54, -31, 108, 62);
  ctx.fillStyle = '#64e9ff';
  for (const side of [-1, 1]) {
    for (let index = -2; index <= 2; index += 1) ctx.fillRect(side * 59 - (side < 0 ? 6 : 0), index * 10 - 3, 8, 6);
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#e9e3d5';
  ctx.font = '900 19px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PYTHON', 0, 7);
  if (chip === 'fallen') {
    ctx.fillStyle = '#ffc857';
    ctx.font = '800 13px ui-monospace, monospace';
    ctx.fillText('ПОДОЙДИ · E', 0, 57);
  }
  ctx.restore();
}

function drawWakeReveal(ctx, state) {
  if (!state.arm.awake || state.arm.wakeRevealRemaining <= 0) return;
  const progress = 1 - state.arm.wakeRevealRemaining / WAKE_REVEAL_DURATION;
  const pulse = Math.sin(progress * Math.PI);
  const gradient = ctx.createRadialGradient(MACHINE.x, MACHINE.y + 80, 30, MACHINE.x, MACHINE.y + 80, 420);
  gradient.addColorStop(0, `rgba(100,233,255,${.17 + pulse * .18})`);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.fillStyle = '#0008';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.fillStyle = gradient;
  ctx.fillRect(MACHINE.x - 430, MACHINE.y - 360, 860, 820);
  ctx.textAlign = 'center';
  const titleX = MACHINE.x + 70;
  ctx.fillStyle = progress < .34 ? '#ffc857' : '#64e9ff';
  ctx.font = '900 34px ui-monospace, monospace';
  const line = progress < .34 ? 'СИГНАЛ ПРИНЯТ' : (progress < .7 ? 'ПИТАНИЕ ВОЗВРАЩЕНО' : 'РУКА 07 · ОНЛАЙН');
  ctx.fillText(line, titleX, 205);
  ctx.font = '700 16px ui-monospace, monospace';
  ctx.fillStyle = '#e9e3d5';
  ctx.fillText(state.arm.startSource === 'chip' ? 'ЧИП ЗАКРЕПЛЁН → РУКА РАБОТАЕТ ЗА ТЕБЯ' : 'print("wake")  →  первое слово машины', titleX, 242);
  ctx.restore();
}

function drawOtherMind(ctx, state, now, { reducedMotion = false, wakeProgress = 0 } = {}) {
  const { phase } = state.otherMind;
  const waking = phase === 'waking';
  const awake = phase === 'awake';
  const silent = phase === 'silent';
  const pulse = reducedMotion ? 0 : Math.min(1, wakeProgress);
  const bob = awake && !reducedMotion ? Math.sin(now / 650) * 4 : 0;
  const x = MACHINE.x + 145;
  const y = MACHINE.y + 20 + bob;

  ctx.save();
  ctx.translate(x, y);
  if (waking) {
    ctx.strokeStyle = '#ffc857';
    ctx.lineWidth = 4;
    ctx.globalAlpha = Math.max(.18, .82 - pulse * .62);
    for (const radius of [42 + pulse * 38, 58 + pulse * 66]) {
      ctx.beginPath();
      ctx.ellipse(0, 0, radius, radius * .62, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  ctx.rotate(phase === 'sleeping' ? -.42 : 0);
  ctx.fillStyle = awake ? '#0a2b33' : '#151b24';
  ctx.strokeStyle = silent ? '#a98147' : (waking ? '#ffc857' : (awake ? '#64e9ff' : '#4c5868'));
  ctx.lineWidth = awake ? 5 : 3;
  if (silent) ctx.setLineDash([8, 7]);
  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = awake || waking ? 24 : 5;
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.bezierCurveTo(38, -28, 46, 9, 0, 36);
  ctx.bezierCurveTo(-46, 9, -38, -28, 0, -34);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.shadowBlur = 0;
  if (awake || waking) {
    ctx.fillStyle = awake ? '#e9e3d5' : '#ffc857';
    ctx.beginPath();
    ctx.ellipse(0, 0, awake ? 22 : 12, awake ? 11 : 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#071017';
    ctx.beginPath();
    ctx.arc(awake ? Math.sin(now / 900) * 7 : 0, 0, awake ? 7 : 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = silent ? '#a98147' : '#4c5868';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.quadraticCurveTo(0, 8, 18, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMachinePrompt(ctx, state) {
  if (state.scene !== 'machine') return;
  const near = Math.hypot(state.player.x - MACHINE.x, state.player.y - MACHINE.y) <= INTERACTION_RADIUS + 150;
  if (!near) return;
  const x = MACHINE.x;
  const y = MACHINE.y - 118;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '800 16px ui-monospace, monospace';
  const label = 'SPACE  ·  ОТКРЫТЬ ТЕРМИНАЛ';
  const width = ctx.measureText(label).width + 34;
  ctx.fillStyle = '#e9e3d5';
  ctx.fillRect(x - width / 2, y - 25, width, 42);
  ctx.fillStyle = '#080b11';
  ctx.fillText(label, x, y + 2);
  ctx.strokeStyle = '#ffc857';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x, y + 17); ctx.lineTo(x, y + 45); ctx.stroke();
  ctx.restore();
}


function fpProject(player, yaw, object) {
  const dx = object.x - player.x;
  const dy = object.y - player.y;
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  const forward = dx * sin + dy * (-cos);
  const right = dx * cos + dy * sin;
  if (forward <= 58) return null;
  const fov = Math.PI * 70 / 180;
  const focal = WORLD.width / (2 * Math.tan(fov / 2));
  const x = WORLD.width / 2 + (right / forward) * focal;
  const horizon = WORLD.height * .46;
  const scale = focal / forward;
  const baseY = horizon + 82 * scale;
  return { x, baseY, scale, forward, angle: Math.atan2(right, forward) };
}

function fpBox(ctx, p, crate) {
  const size = Math.max(20, Math.min(180, 58 * p.scale));
  const x = p.x - size / 2;
  const y = p.baseY - size;
  ctx.fillStyle = crate.kind === 'red' ? '#a62f39' : '#936038';
  ctx.strokeStyle = crate.kind === 'red' ? '#ff6873' : '#d3a05b';
  ctx.lineWidth = Math.max(2, 2.5 * Math.min(2.4, p.scale));
  ctx.fillRect(x, y, size, size);
  ctx.strokeRect(x, y, size, size);
  ctx.strokeStyle = crate.kind === 'red' ? '#721b22' : '#67411f';
  ctx.beginPath();
  ctx.moveTo(x + size * .12, y + size * .12); ctx.lineTo(x + size * .88, y + size * .88);
  ctx.moveTo(x + size * .88, y + size * .12); ctx.lineTo(x + size * .12, y + size * .88);
  ctx.stroke();
  if (p.scale > .72) {
    ctx.fillStyle = '#f6e6c9';
    ctx.font = `900 ${Math.max(10, Math.min(18, 10 * p.scale))}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(crate.kind === 'red' ? 'КРАСНЫЙ' : 'ГРУЗ', p.x, y + size * .56);
  }
}

function fpPallet(ctx, p) {
  const w = Math.max(72, Math.min(370, 180 * p.scale));
  const h = Math.max(12, Math.min(62, 26 * p.scale));
  ctx.fillStyle = '#6f604a';
  ctx.strokeStyle = '#b9a277';
  ctx.lineWidth = Math.max(2, 3 * Math.min(2.2, p.scale));
  ctx.fillRect(p.x - w / 2, p.baseY - h, w, h);
  ctx.strokeRect(p.x - w / 2, p.baseY - h, w, h);
  ctx.fillStyle = '#d0b46f';
  for (let i = -2; i <= 2; i += 1) ctx.fillRect(p.x + i * w * .18 - 4, p.baseY - h, 8, h);
}

function fpMachine(ctx, p, state, now) {
  const s = Math.max(.28, Math.min(2.25, p.scale));
  const baseW = 135 * s;
  const baseH = 105 * s;
  const x = p.x;
  const y = p.baseY;
  ctx.fillStyle = '#1a2530';
  ctx.strokeStyle = state.arm.awake ? '#64e9ff' : '#65717c';
  ctx.lineWidth = Math.max(2, 4 * s);
  ctx.fillRect(x - baseW / 2, y - baseH, baseW, baseH);
  ctx.strokeRect(x - baseW / 2, y - baseH, baseW, baseH);

  // Compact local arm animation. The joints never stretch across the room.
  const activity = state.arm.active ? Math.sin(Math.min(1, state.arm.active.progress) * Math.PI) : 0;
  const idle = state.arm.awake ? Math.sin(now / 800) * .07 : 0;
  const shoulder = { x, y: y - baseH };
  const elbow = { x: x - (38 + activity * 12) * s, y: y - (174 - activity * 22) * s };
  const hand = { x: x + (26 + activity * 44) * s, y: y - (228 - activity * 12) * s };
  ctx.strokeStyle = state.arm.awake ? '#7f91a0' : '#5c656c';
  ctx.lineWidth = Math.max(9, 24 * s);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(shoulder.x, shoulder.y);
  ctx.lineTo(elbow.x + idle * 30 * s, elbow.y);
  ctx.lineTo(hand.x, hand.y);
  ctx.stroke();
  ctx.fillStyle = state.arm.awake ? '#64e9ff' : '#873b42';
  for (const joint of [shoulder, elbow, hand]) {
    ctx.beginPath(); ctx.arc(joint.x, joint.y, Math.max(5, 12 * s), 0, Math.PI * 2); ctx.fill();
  }

  const panelW = 104 * s;
  const panelH = 64 * s;
  ctx.fillStyle = '#07131a';
  ctx.strokeStyle = '#4c6b79';
  ctx.fillRect(x - panelW / 2, y - baseH * .72, panelW, panelH);
  ctx.strokeRect(x - panelW / 2, y - baseH * .72, panelW, panelH);
  ctx.fillStyle = state.arm.awake ? '#72f0bc' : '#c65d64';
  ctx.beginPath(); ctx.arc(x, y - baseH * .46, Math.max(3, 6 * s), 0, Math.PI * 2); ctx.fill();
  if (state.arm.chip !== 'installed' && s > .55) {
    ctx.fillStyle = '#d7b66e';
    ctx.font = `900 ${Math.max(9, 10 * s)}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('РАЗЪЁМ РУКИ 07', x, y - 14 * s);
  }
}

function fpLooseButton(ctx, p, tried = false) {
  const s = Math.max(.35, Math.min(2.1, p.scale));
  ctx.save();
  ctx.translate(p.x, p.baseY - 6 * s);
  ctx.rotate(-.18);
  ctx.fillStyle = '#2d3336';
  ctx.strokeStyle = '#788185';
  ctx.lineWidth = Math.max(2, 3 * s);
  ctx.fillRect(-30 * s, -14 * s, 60 * s, 28 * s);
  ctx.strokeRect(-30 * s, -14 * s, 60 * s, 28 * s);
  ctx.fillStyle = tried ? '#315342' : '#42b76a';
  ctx.beginPath(); ctx.arc(0, -2 * s, 11 * s, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawWarehouseFirstPerson(ctx, state, now, options = {}) {
  const yaw = Number.isFinite(options.cameraYaw) ? options.cameraYaw : 0;
  const horizon = WORLD.height * .46;
  const ceiling = ctx.createLinearGradient(0, 0, 0, horizon);
  ceiling.addColorStop(0, '#05070a'); ceiling.addColorStop(1, '#121921');
  ctx.fillStyle = ceiling; ctx.fillRect(0, 0, WORLD.width, horizon);
  const floor = ctx.createLinearGradient(0, horizon, 0, WORLD.height);
  floor.addColorStop(0, '#1b2329'); floor.addColorStop(1, '#06080a');
  ctx.fillStyle = floor; ctx.fillRect(0, horizon, WORLD.width, WORLD.height - horizon);

  // Warehouse wall ribs + floor perspective. They anchor the camera without a top-down minimap.
  ctx.strokeStyle = '#394650'; ctx.lineWidth = 2; ctx.globalAlpha = .32;
  for (let i = -9; i <= 9; i += 1) {
    const x = WORLD.width / 2 + i * 115;
    ctx.beginPath(); ctx.moveTo(WORLD.width / 2, horizon); ctx.lineTo(x, WORLD.height); ctx.stroke();
  }
  for (let i = 1; i <= 11; i += 1) {
    const t = i / 11; const y = horizon + (WORLD.height - horizon) * t * t;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.width, y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#0c1116'; ctx.fillRect(0, horizon - 72, WORLD.width, 72);
  ctx.fillStyle = '#28323a';
  for (let x = 30; x < WORLD.width; x += 175) ctx.fillRect(x, horizon - 70, 9, 70);

  const looseButton = { x: MACHINE.x + 145, y: MACHINE.y + 200 };
  const machinePoint = { x: MACHINE.x, y: MACHINE.y + 175 };
  const objects = [];
  const add = (kind, obj, payload = obj) => {
    const p = fpProject(state.player, yaw, obj);
    if (p && p.x > -260 && p.x < WORLD.width + 260 && p.forward < 1750) objects.push({ kind, obj: payload, p });
  };
  for (const crate of state.warehouse.crates) {
    if (['hidden','carried','arm'].includes(crate.status)) continue;
    if (crate.status === 'pallet') continue;
    add('crate', crate);
  }
  add('pallet', PALLET);
  add('machine', machinePoint, machinePoint);
  if (['shift2','red2','condition'].includes(state.checkpoint) || (state.scene === 'machine' && state.learning.chapter >= 2)) add('button', looseButton, looseButton);
  objects.sort((a, b) => b.p.forward - a.p.forward);
  for (const item of objects) {
    if (item.kind === 'crate') fpBox(ctx, item.p, item.obj);
    else if (item.kind === 'pallet') fpPallet(ctx, item.p);
    else if (item.kind === 'machine') fpMachine(ctx, item.p, state, now);
    else if (item.kind === 'button') fpLooseButton(ctx, item.p, Boolean(state.warehouse.looseButtonTried));
  }

  // During automation the old top-down renderer used to stretch the manipulator
  // all the way across the warehouse. In first person the arm stays compact:
  // the line feeds the active box to its local pickup point and the box visibly
  // travels the short last leg to the pallet. This makes the money tick readable
  // as a physical consequence instead of a HUD-only event.
  if (state.scene === 'automation' && state.arm.active) {
    const crate = state.warehouse.crates.find((item) => item.id === state.arm.active.boxId);
    if (crate) {
      const t = Math.max(0, Math.min(1, state.arm.active.progress ?? 0));
      const eased = t * t * (3 - 2 * t);
      const pickup = { x: MACHINE.x - 78, y: MACHINE.y + 205 };
      const carried = {
        x: pickup.x + (PALLET.x - pickup.x) * eased,
        y: pickup.y + (PALLET.y - pickup.y) * eased,
      };
      const projected = fpProject(state.player, yaw, carried);
      if (projected) {
        projected.baseY -= Math.sin(Math.PI * t) * Math.max(12, 36 * projected.scale);
        fpBox(ctx, projected, crate);
      }
    }
  }

  if (state.scene === 'chip' && state.arm.chip === 'held') {
    ctx.save();
    ctx.translate(WORLD.width - 150, WORLD.height - 110);
    ctx.rotate(-.08);
    ctx.shadowColor = '#64e9ff'; ctx.shadowBlur = 24;
    ctx.fillStyle = '#12343d'; ctx.strokeStyle = '#72f2ff'; ctx.lineWidth = 4;
    ctx.fillRect(-70, -42, 140, 84); ctx.strokeRect(-70, -42, 140, 84);
    ctx.shadowBlur = 0; ctx.fillStyle = '#e6fbff'; ctx.textAlign = 'center'; ctx.font = '900 25px ui-monospace, monospace';
    ctx.fillText('PY · РУКА 07', 0, 8);
    ctx.restore();
  }

  if (state.player.carrying) {
    const carried = state.warehouse.crates.find((crate) => crate.id === state.player.carrying) ?? { kind: 'normal' };
    const p = { x: WORLD.width / 2, baseY: WORLD.height + 85, scale: 2.15 };
    fpBox(ctx, p, carried);
  }

  // Show the consequence in the world after the terminal closes. The player should
  // never have to remember what vanished from a side panel: the exact signal stays
  // on screen while the arm starts moving.
  if (state.arm.awake && state.arm.wakeRevealRemaining > 0) {
    const fromChip = state.arm.startSource === 'chip';
    const w = 620;
    const h = 104;
    const x = (WORLD.width - w) / 2;
    const y = 118;
    ctx.save();
    ctx.fillStyle = 'rgba(5, 12, 16, .88)';
    ctx.strokeStyle = fromChip ? '#ffc857' : '#64e9ff';
    ctx.lineWidth = 3;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = fromChip ? '#ffc857' : '#64e9ff';
    ctx.font = '900 18px ui-monospace, monospace';
    ctx.fillText(fromChip ? 'СЕРВИСНЫЙ ЧИП ПРИНЯТ' : 'КОМАНДА ПРИНЯТА', WORLD.width / 2, y + 31);
    ctx.fillStyle = '#f0eee7';
    ctx.font = '800 24px ui-monospace, monospace';
    ctx.fillText(fromChip ? 'ЧИП  →  РУКА 07 · РАБОТАЕТ' : 'print("wake")  →  РУКА 07 · РАБОТАЕТ', WORLD.width / 2, y + 69);
    ctx.fillStyle = '#aeb9bf';
    ctx.font = '700 13px ui-monospace, monospace';
    ctx.fillText('СМОТРИ НА РУКУ: СИГНАЛ ИЗМЕНИЛ МИР', WORLD.width / 2, y + 91);
    ctx.restore();
  }

  // Crosshair is a DOM overlay so it stays perfectly centered at every aspect ratio.

}

function drawWarehouse(ctx, state, now, options = {}) {
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  gradient.addColorStop(0, '#101722');
  gradient.addColorStop(1, '#06090e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  drawGrid(ctx, '#273343');

  ctx.fillStyle = '#0b1018';
  ctx.fillRect(0, 0, WORLD.width, 170);
  ctx.fillStyle = '#182131';
  for (let x = 30; x < WORLD.width; x += 180) ctx.fillRect(x, 40, 120, 105);

  drawConveyor(ctx, state);
  drawProgramTraceWorld(ctx, state);
  drawFunctionModule(ctx, state, now);
  if (state.scene === 'function' || state.arm.startSource === 'function') {
    ctx.save();
    ctx.font = '900 16px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#72f0bc';
    ctx.fillText('ЛИНИЯ А', 55, 435);
    ctx.fillText('ЛИНИЯ Б', 55, 610);
    ctx.strokeStyle = '#72f0bc66';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(55, 448); ctx.lineTo(350, 448); ctx.moveTo(55, 623); ctx.lineTo(350, 623); ctx.stroke();
    ctx.restore();
  }
  drawTerminal(ctx, state, now);
  drawWarehouseIntro(ctx, state, options);
  drawOtherMind(ctx, state, now, options);

  for (const crate of state.warehouse.crates) {
    if (options.manualShowcase && ['box-01', 'box-02', 'box-03'].includes(crate.id)) continue;
    if (['carried', 'hidden', 'arm'].includes(crate.status)) continue;
    if (crate.status === 'pallet') {
      const age = state.elapsed - (crate.deliveredAt ?? -100);
      if (age < 0 || age > 3.4) continue;
      drawCrate(ctx, { ...crate, status: 'floor', x: PALLET.x + age * 120, y: PALLET.y + 16 });
    } else drawCrate(ctx, crate);
  }
  drawArm(ctx, state, now, options);
  drawPythonChip(ctx, state, now, options);
  drawDropFeedback(ctx, state);
  if (options.manualShowcase) drawManualShowcase(ctx, now, options.reducedMotion);
  else drawWorker(ctx, state);
  drawPoster(ctx, state, now);
  drawWakeReveal(ctx, state);

  if (state.scene === 'red-crate') {
    ctx.fillStyle = '#ff4d5a';
    ctx.font = '900 28px ui-monospace, monospace';
    ctx.fillText('ОШИБКА МАРШРУТА · ГРУЗ НЕ СОВПАДАЕТ', 590, 220);
  }
}

function showcaseText(ctx, text, x, y, size = 42, color = '#e9e3d5') {
  ctx.fillStyle = color;
  ctx.font = `900 ${size}px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
}

function drawShowcaseCrate(ctx, x, y, tilt = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.fillStyle = '#c7893e';
  ctx.fillRect(-82, -58, 164, 116);
  ctx.strokeStyle = '#f4c56b';
  ctx.lineWidth = 7;
  ctx.strokeRect(-82, -58, 164, 116);
  ctx.strokeStyle = '#7b4d28';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-70, -45); ctx.lineTo(70, 45); ctx.moveTo(70, -45); ctx.lineTo(-70, 45); ctx.stroke();
  ctx.restore();
}

function drawShowcaseRobot(ctx, x, y, awake = false, pulse = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#182534';
  ctx.strokeStyle = awake ? '#64e9ff' : '#8993a1';
  ctx.lineWidth = 8;
  ctx.fillRect(-125, -115, 250, 180);
  ctx.strokeRect(-125, -115, 250, 180);
  ctx.fillStyle = awake ? '#64e9ff' : '#ffc857';
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = awake ? 28 + pulse * 24 : 8;
  ctx.fillRect(-58, -55, 30, 22); ctx.fillRect(28, -55, 30, 22);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffc857';
  ctx.beginPath(); ctx.moveTo(-70, 65); ctx.lineTo(-70, 190); ctx.lineTo(70, 190); ctx.lineTo(70, 65); ctx.stroke();
  ctx.restore();
}

function drawChipShowcase(ctx, now, reducedMotion, startedAt) {
  const phase = getChipShowcasePhase(reducedMotion ? 8800 : Math.max(0, now - startedAt));
  const t = phase.progress;
  const W = WORLD.width;
  const H = WORLD.height;
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, '#111c2a'); gradient.addColorStop(1, '#05080d');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#254153'; ctx.lineWidth = 3;
  for (let y = 160; y < H; y += 110) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  showcaseText(ctx, `QUEQUEST · ${String(phase.index + 1).padStart(2, '0')} / 06`, W / 2, 66, 28, '#8993a1');
  showcaseText(ctx, phase.label, W / 2, 135, 58, '#e9e3d5');
  ctx.fillStyle = '#ffc857'; ctx.fillRect(330, 155, 940 * Math.min(1, t), 8);

  if (phase.id === 'boxes') {
    for (let i = 0; i < 3; i += 1) {
      const local = Math.max(0, Math.min(1, (t * 3) - i));
      const x = 320 + local * 900;
      drawShowcaseCrate(ctx, x, 510 + i * 44, Math.sin(local * Math.PI) * .04);
    }
    showcaseText(ctx, 'ЧЕЛОВЕК ПЕРЕНОСИТ ТРИ ЯЩИКА', W / 2, 800, 34, '#ffc857');
  }
  if (phase.id === 'boss') {
    ctx.fillStyle = '#303b49'; ctx.fillRect(1160, 260, 220, 430);
    ctx.strokeStyle = '#8993a1'; ctx.lineWidth = 9; ctx.strokeRect(1160, 260, 220, 430);
    const bossX = 420 + Math.min(1, t * 1.5) * 540;
    ctx.fillStyle = '#8b3d48'; ctx.fillRect(bossX - 70, 350, 140, 220);
    ctx.fillStyle = '#e9e3d5'; ctx.fillRect(bossX - 54, 302, 108, 68);
    showcaseText(ctx, t > .72 ? 'ХЛОП!' : 'РАБОТАЙ БЫСТРЕЕ', 800, 760, 46, '#ff7d85');
    if (t > .72) { ctx.strokeStyle = '#ffc857'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(1200, 275); ctx.lineTo(1350, 675); ctx.stroke(); }
  }
  if (phase.id === 'scatter') {
    drawShowcaseRobot(ctx, 800, 550);
    const spread = 80 + t * 470;
    ctx.fillStyle = '#64e9ff'; ctx.fillRect(800 - spread, 430 - t * 100, 110, 64);
    const paperX = 800 + spread - 110;
    const paperY = 560 + t * 95;
    ctx.save();
    ctx.fillStyle = '#e9e3d5'; ctx.fillRect(paperX, paperY, 260, 96);
    ctx.beginPath(); ctx.rect(paperX + 12, paperY + 12, 236, 72); ctx.clip();
    ctx.fillStyle = '#101722'; ctx.font = '700 28px ui-monospace, monospace'; ctx.textAlign = 'left';
    ctx.fillText('print("wake")', paperX + 22, paperY + 59);
    ctx.restore();
    showcaseText(ctx, 'PY', 800 - spread + 55, 475 - t * 100, 34, '#071018');
  }
  if (phase.id === 'insert') {
    const x = 300 + t * 500;
    drawShowcaseRobot(ctx, 1000, 550);
    ctx.fillStyle = '#64e9ff'; ctx.shadowColor = '#64e9ff'; ctx.shadowBlur = 30;
    ctx.fillRect(x, 420, 120, 70); ctx.shadowBlur = 0;
    showcaseText(ctx, 'ЧИП', x + 60, 465, 30, '#071018');
    ctx.strokeStyle = '#64e9ff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x + 120, 455); ctx.lineTo(875, 455); ctx.stroke();
  }
  if (phase.id === 'terminal') {
    drawShowcaseRobot(ctx, 520, 570);
    ctx.fillStyle = '#0b111a'; ctx.fillRect(820, 300, 560, 390); ctx.strokeStyle = '#64e9ff'; ctx.lineWidth = 8; ctx.strokeRect(820, 300, 560, 390);
    showcaseText(ctx, 'ТЕРМИНАЛ УЗЛА 07', 1100, 390, 38, '#64e9ff');
    ctx.textAlign = 'left'; ctx.fillStyle = '#e9e3d5'; ctx.font = '700 42px ui-monospace, monospace'; ctx.fillText('> print("wake")', 875, 520); ctx.fillStyle = '#ffc857'; ctx.fillText('> _', 875, 590);
  }
  if (phase.id === 'wake') {
    const pulse = Math.sin(t * Math.PI * 5) * .5 + .5;
    drawShowcaseRobot(ctx, 800, 545, true, pulse);
    ctx.strokeStyle = '#64e9ff'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(800, 740); ctx.lineTo(800, 815); ctx.stroke();
    showcaseText(ctx, 'РУКА 07 · ОНЛАЙН', 800, 790, 48, '#64e9ff');
    showcaseText(ctx, 'РУКА ЗАРАБОТАЛА', 800, 850, 32, '#ffc857');
  }
}

function drawReward(ctx, state, now) {
  ctx.fillStyle = '#04070b';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  drawCover(ctx, rewardImage, .68);
  const shade = ctx.createLinearGradient(0, 0, WORLD.width, 0);
  shade.addColorStop(0, '#05080de8');
  shade.addColorStop(.55, '#05080d55');
  shade.addColorStop(1, '#05080dcc');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  // The one live companion is screen-space DOM, independent of the warehouse camera.
  // Wages remain in the bottom wallet rather than behind the central ending panel.
}

function drawCollapse(ctx, state) {
  const progress = Math.min(1, state.sceneTime / COLLAPSE_DURATION);
  if (progress < .72) drawPrologue(ctx, state, state.elapsed * 1000);
  else {
    ctx.fillStyle = '#020306';
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  }
  const blackout = Math.min(.94, progress * 1.08);
  ctx.fillStyle = `rgba(0, 0, 0, ${blackout})`;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  if (progress < .72) {
    ctx.globalAlpha = Math.max(.12, 1 - progress);
    for (let index = 0; index < 18; index += 1) {
      const y = (index * 83 + Math.floor(state.sceneTime * 900)) % WORLD.height;
      const height = 2 + (index % 4) * 3;
      ctx.fillStyle = index % 3 ? '#64e9ff' : '#ff4d5a';
      ctx.fillRect((index * 137) % 260 - 80, y, WORLD.width - (index * 41) % 310, height);
    }
    ctx.globalAlpha = 1;
  }
  ctx.save();
  const shake = progress < .5 ? 22 * (1 - progress * 2) : 0;
  ctx.translate(Math.sin(state.sceneTime * 92) * shake, Math.cos(state.sceneTime * 67) * shake * .45);
  ctx.fillStyle = '#e9e3d5';
  ctx.font = '900 95px Arial Narrow, sans-serif';
  ctx.textAlign = 'center';
  const title = progress < .28 ? 'СИГНАЛ РВЁТСЯ' : (progress < .72 ? 'СВЯЗЬ ПОТЕРЯНА' : 'ТЫ ПРОСЫПАЕШЬСЯ');
  ctx.fillText(title, 800, 470);
  ctx.font = '700 22px ui-monospace, monospace';
  ctx.fillStyle = progress < .72 ? '#ffb4ba' : '#8993a1';
  ctx.fillText(progress < .72 ? 'MEMORY LINK FAILED · DISCONNECT' : 'СМЕНА 03:17 · СКЛАД-07', 800, 520);
  ctx.restore();
}

export function renderGame(ctx, state, viewport, now, options = {}) {
  ctx.save();
  ctx.clearRect(0, 0, viewport.width, viewport.height);
  if (options.chipShowcase) {
    const scale = Math.max(viewport.width / WORLD.width, viewport.height / WORLD.height);
    ctx.translate((viewport.width - WORLD.width * scale) / 2, (viewport.height - WORLD.height * scale) / 2);
    ctx.scale(scale, scale);
    drawChipShowcase(ctx, now, options.reducedMotion, options.showcaseStartedAt ?? now);
  } else if (options.firstPersonWarehouse) {
    // First-person uses a cover transform so the warehouse always fills the monitor.
    // No black side gutters for wide desktop viewports.
    const scale = Math.max(viewport.width / WORLD.width, viewport.height / WORLD.height);
    ctx.translate((viewport.width - WORLD.width * scale) / 2, (viewport.height - WORLD.height * scale) / 2);
    ctx.scale(scale, scale);
    drawWarehouseFirstPerson(ctx, state, now, options);
  } else {
    viewportTransform(ctx, viewport, state);
    if (state.scene === 'prologue') drawPrologue(ctx, state, now);
    else if (state.scene === 'collapse') drawCollapse(ctx, state);
    else if (state.scene === 'reward') drawReward(ctx, state, now);
    else drawWarehouse(ctx, state, now, options);
  }
  ctx.restore();
}
