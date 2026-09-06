import {
  COLLAPSE_DURATION,
  INTERACTION_RADIUS,
  MACHINE,
  PALLET,
  WAKE_REVEAL_DURATION,
  WAREHOUSE_INTRO_DURATION,
  WORLD,
} from './config.js?v=novice-1';
import { getArmTransferPhase } from './model.js?v=novice-1';
import { getSceneCameraTarget, getViewportTransform } from './viewport.js?v=2';
import { getChipShowcasePhase } from './showcase-chip.js?v=1';

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

// "Спокойный" из Аниматеки: cubic-bezier(0.4, 0, 0.2, 1).
// Он помечен там как кривая для перемещений в обе стороны, поэтому обратный
// путь героя — та же траектория, а не телепортация или новая анимация.
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
  ctx.moveTo(-31, -9); ctx.lineTo(-12, -23); ctx.lineTo(18, -18);
  ctx.lineTo(33, 0); ctx.lineTo(18, 18); ctx.lineTo(-12, 23); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff4d5a';
  ctx.fillRect(-8, -5, 22, 10);
  ctx.strokeStyle = '#8c98a8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-17, 14); ctx.lineTo(-37, 34);
  ctx.moveTo(14, 15); ctx.lineTo(34, 35);
  ctx.stroke();
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
  const online = ['machine', 'automation', 'red-crate', 'reward'].includes(state.scene);
  const foreshadow = state.scene === 'warehouse' && state.warehouse.manualDelivered >= 2;
  const buttonAwake = state.arm.awake;
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
  ctx.fillStyle = '#101721';
  ctx.fillRect(MACHINE.x - 18, MACHINE.y + 62, 36, 112);
  ctx.fillRect(MACHINE.x - 62, MACHINE.y + 170, 124, 22);
  const buttonX = MACHINE.x + 155;
  const buttonY = MACHINE.y + 205;
  ctx.fillStyle = '#141b25';
  ctx.strokeStyle = buttonAwake ? '#64e9ff' : '#59616b';
  ctx.lineWidth = 5;
  ctx.fillRect(buttonX - 42, buttonY - 30, 84, 60);
  ctx.strokeRect(buttonX - 42, buttonY - 30, 84, 60);
  ctx.fillStyle = buttonAwake ? '#64e9ff' : '#4c3032';
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = buttonAwake ? 25 : 3;
  ctx.beginPath(); ctx.arc(buttonX, buttonY, 17, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = buttonAwake ? '#b9f6ff' : '#79828c';
  ctx.font = '700 10px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(buttonAwake ? 'ПИТАНИЕ' : 'НЕТ ПИТАНИЯ', buttonX, buttonY + 47);
  ctx.restore();
}

function drawPoster(ctx, state, now) {
  const bossExit = state.scene === 'warehouse' && state.warehouse.bossEntrance;
  const fallen = state.scene !== 'warehouse' || bossExit;
  const progress = bossExit
    ? Math.min(1, Math.max(0, (state.sceneTime - 3.7) / .9))
    : (fallen ? Math.min(1, state.sceneTime / .9) : 0);
  const warning = !fallen && state.warehouse.manualDelivered >= 2;
  const tremble = warning ? Math.sin(now / 42) * 3 : 0;
  const x = (bossExit ? 900 + progress * 70 : 1180 - progress * 60) + tremble;
  const y = 215 + progress * 495;
  ctx.save();
  if (state.scene === 'automation') ctx.globalAlpha = state.arm.wakeRevealRemaining > 0 ? .18 : .06;
  ctx.translate(x, y);
  ctx.rotate(-.03 + progress * 1.1 + (warning ? Math.sin(now / 55) * .015 : 0));
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
    ctx.fillText('print("wake")', 0, -25);
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
  ctx.fillText('ОТГРУЗКА → +$120', PALLET.x - 65, PALLET.y + 130);
}

function drawArm(ctx, state, now, { wakeProgress = 0 } = {}) {
  const awake = state.arm.awake;
  const watch = state.warehouse.manualDelivered * .14;
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
  const trying = !awake && state.scene === 'warehouse' && state.warehouse.introComplete;
  if (trying) {
    const phase = (state.elapsed % 4.5) / 4.5;
    const reach = phase < .58 ? Math.sin(phase / .58 * Math.PI / 2) : Math.max(0, 1 - (phase - .68) / .32);
    endX -= reach * 345;
    endY += reach * 165;
    if (phase > .58 && phase < .72) { endX += Math.sin(now / 22) * 14; endY += Math.cos(now / 31) * 8; }
  }
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
  const moving = active || failure || trying;
  const elbowX = moving ? (baseX + endX) / 2 : MACHINE.x - 25 - gesture * 30;
  const elbowY = moving ? Math.min(baseY, endY) - 150 : MACHINE.y - 70 - gesture * 18;
  ctx.save();
  ctx.fillStyle = '#283444';
  ctx.fillRect(baseX - 70, baseY + 30, 140, 72);
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
  ctx.fillStyle = awake ? '#64e9ff' : (state.warehouse.manualDelivered ? '#ffc857' : '#4c3032');
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
  if (trying && state.elapsed % 4.5 > 2.6 && state.elapsed % 4.5 < 3.35) {
    ctx.save(); ctx.font = '800 18px ui-monospace, monospace'; ctx.fillStyle = '#ffb35c'; ctx.textAlign = 'center';
    ctx.fillText('ПОЧТИ… НЕТ СИГНАЛА', endX, endY - 55); ctx.restore();
  }
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

function drawWarehouseIntro(ctx, state) {
  if (state.warehouse.introComplete || !state.warehouse.bossEntrance) return;
  const time = Math.min(WAREHOUSE_INTRO_DURATION, state.sceneTime);
  const eye = Math.max(0, Math.min(1, time / .9));
  const bossProgress = Math.max(0, Math.min(1, (time - .65) / .75));
  const bossX = 870 - bossProgress * 155;
  const bossY = 575;

  ctx.save();
  ctx.fillStyle = '#080b11';
  ctx.fillRect(810, 330, 155, 355);
  ctx.strokeStyle = '#59687a';
  ctx.lineWidth = 8;
  ctx.strokeRect(810, 330, 155, 355);
  if (time < 3.85) {
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

  if (time >= 1.15 && time < 3.75) {
    const secondLine = time >= 2.75;
    const label = secondLine ? 'РАБОТАЙ БЫСТРЕЕ.' : 'ОПЯТЬ ОТКЛЮЧИЛСЯ?';
    ctx.font = `900 ${secondLine ? 35 : 27}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    const width = ctx.measureText(label).width + 54;
    ctx.fillStyle = secondLine ? '#ffc857' : '#e9e3d5';
    ctx.fillRect(800 - width / 2, 310, width, 68);
    ctx.fillStyle = '#080b11';
    ctx.fillText(label, 800, 355);
  }

  if (time >= 3.65) {
    const slam = Math.min(1, (time - 3.65) / .18);
    ctx.globalAlpha = 1 - slam * .7;
    ctx.fillStyle = '#ffc857';
    ctx.font = '900 30px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ХЛОП.', 885, 290);
    ctx.globalAlpha = 1;
  }

  const lidHeight = (1 - eye) * WORLD.height * .5;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, WORLD.width, lidHeight);
  ctx.fillRect(0, WORLD.height - lidHeight, WORLD.width, lidHeight);
  ctx.restore();
}

function drawPythonChip(ctx, state, now) {
  const bossExit = state.scene === 'warehouse' && state.warehouse.bossEntrance;
  if (!bossExit && !['chip', 'machine', 'automation', 'red-crate', 'reward'].includes(state.scene)) return;
  const chip = bossExit ? 'falling' : state.arm.chip;
  if (chip === 'missing') return;
  const fallenX = 850;
  const fallenY = 535;
  const progress = bossExit
    ? Math.min(1, Math.max(0, (state.sceneTime - 3.7) / .9))
    : (chip === 'inserting' ? Math.min(1, state.sceneTime / 1.05) : (chip === 'installed' ? 1 : 0));
  const x = bossExit
    ? 780 + (fallenX - 780) * progress
    : fallenX + (MACHINE.x - 35 - fallenX) * progress;
  const y = bossExit
    ? 380 + (fallenY - 380) * progress + Math.sin(progress * Math.PI) * 65
    : fallenY + (MACHINE.y + 62 - fallenY) * progress - Math.sin(progress * Math.PI) * 105;
  const pulse = .75 + Math.sin(now / 110) * .25;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-.12 + progress * .6);
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
    ctx.fillText('НАЖМИ ЧИП', 0, 57);
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
  ctx.fillText('print("wake")  →  первое слово машины', titleX, 242);
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
  drawTerminal(ctx, state, now);
  drawWarehouseIntro(ctx, state);
  drawPythonChip(ctx, state, now);
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
  const qBotX = Math.min(WORLD.width - 170, state.player.x + 55);
  const qBotY = 300;
  ctx.fillStyle = '#171e29';
  ctx.fillRect(qBotX - 255, qBotY + 100, 510, 38);
  ctx.fillRect(qBotX - 205, qBotY + 138, 24, 165);
  ctx.fillRect(qBotX + 181, qBotY + 138, 24, 165);
  ctx.strokeStyle = '#64e9ff';
  ctx.lineWidth = 4;
  ctx.shadowColor = '#64e9ff';
  ctx.shadowBlur = 22;
  ctx.beginPath(); ctx.arc(qBotX, qBotY, 64 + Math.sin(now / 800) * 3, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#64e9ff';
  ctx.fillRect(qBotX - 23, qBotY - 10, 12, 8);
  ctx.fillRect(qBotX + 11, qBotY - 10, 12, 8);
  ctx.fillStyle = '#e9e3d5';
  ctx.font = '700 18px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Q-BOT // EMPTY SHELL', qBotX, qBotY + 180);
  ctx.fillStyle = '#ffc857';
  ctx.fillText(`ЗАРАБОТАНО: $ ${state.warehouse.wage}`, qBotX, qBotY + 215);
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
  } else {
    viewportTransform(ctx, viewport, state);
    if (state.scene === 'prologue') drawPrologue(ctx, state, now);
    else if (state.scene === 'collapse') drawCollapse(ctx, state);
    else if (state.scene === 'reward') drawReward(ctx, state, now);
    else drawWarehouse(ctx, state, now, options);
  }
  ctx.restore();
}
