import {
  COLLAPSE_DURATION,
  INTERACTION_RADIUS,
  MACHINE,
  PALLET,
  WAKE_REVEAL_DURATION,
  WAREHOUSE_INTRO_DURATION,
  WORLD,
} from './config.js?v=5';
import { getArmTransferPhase } from './model.js?v=5';
import { getSceneCameraTarget, getViewportTransform } from './viewport.js?v=2';

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
  const fallen = state.scene !== 'warehouse';
  const progress = fallen ? Math.min(1, state.sceneTime / .9) : 0;
  const warning = !fallen && state.warehouse.manualDelivered >= 2;
  const tremble = warning ? Math.sin(now / 42) * 3 : 0;
  const x = 1180 - progress * 60 + tremble;
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

function drawConveyor(ctx) {
  ctx.fillStyle = '#111924';
  ctx.fillRect(15, 445, 390, 290);
  ctx.strokeStyle = '#334357';
  ctx.lineWidth = 10;
  ctx.strokeRect(15, 445, 390, 290);
  ctx.fillStyle = '#8993a1';
  for (let y = 475; y < 720; y += 46) ctx.fillRect(32, y, 350, 5);
  ctx.fillStyle = '#111924';
  ctx.fillRect(660, 475, 180, 240);
  ctx.strokeStyle = '#334357';
  ctx.lineWidth = 8;
  ctx.strokeRect(660, 475, 180, 240);
  ctx.fillStyle = '#8993a1';
  for (let y = 500; y < 705; y += 42) ctx.fillRect(674, y, 150, 4);
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
  if (state.warehouse.introComplete) return;
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
    const label = secondLine ? 'ЗА РАБОТУ.' : 'ОПЯТЬ ОТКЛЮЧИЛСЯ?';
    ctx.font = `900 ${secondLine ? 35 : 27}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    const width = ctx.measureText(label).width + 54;
    ctx.fillStyle = secondLine ? '#ffc857' : '#e9e3d5';
    ctx.fillRect(620 - width / 2, 310, width, 68);
    ctx.fillStyle = '#080b11';
    ctx.fillText(label, 620, 355);
  }

  if (time >= 3.7) {
    const iconProgress = Math.min(1, (time - 3.7) / .7);
    ctx.globalAlpha = iconProgress;
    ctx.fillStyle = '#05080ddd';
    ctx.fillRect(235, 285, 630, 150);
    const labels = ['ВЗЯЛ', 'ДОНЁС', 'ПОСТАВИЛ'];
    labels.forEach((label, index) => {
      const x = 335 + index * 215;
      ctx.fillStyle = index === 2 ? '#ffc857' : '#e9e3d5';
      ctx.fillRect(x - 28, 315, 56, 56);
      ctx.font = '800 18px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, 405);
      if (index < 2) {
        ctx.font = '900 34px ui-monospace, monospace';
        ctx.fillStyle = '#64e9ff';
        ctx.fillText('→', x + 108, 358);
      }
    });
  }

  const lidHeight = (1 - eye) * WORLD.height * .5;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, WORLD.width, lidHeight);
  ctx.fillRect(0, WORLD.height - lidHeight, WORLD.width, lidHeight);
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

  drawConveyor(ctx);
  drawTerminal(ctx, state, now);
  ctx.fillStyle = '#4d3d25';
  ctx.fillRect(PALLET.x - 20, PALLET.y - 20, PALLET.width, PALLET.height);
  ctx.strokeStyle = '#ffc857';
  ctx.lineWidth = 5;
  ctx.strokeRect(PALLET.x - 20, PALLET.y - 20, PALLET.width, PALLET.height);
  ctx.fillStyle = '#ffc857';
  ctx.font = '700 23px ui-monospace, monospace';
  ctx.fillText('PALLET', PALLET.x, PALLET.y + 150);

  drawArm(ctx, state, now, options);
  drawOtherMind(ctx, state, now, options);
  if (!options.machineFocus) drawMachinePrompt(ctx, state);

  for (const crate of state.warehouse.crates) {
    if (['carried', 'hidden', 'arm'].includes(crate.status)) continue;
    const stack = crate.status === 'pallet' ? state.warehouse.crates.filter((item) => item.status === 'pallet').findIndex((item) => item.id === crate.id) : 0;
    const x = crate.status === 'pallet' ? PALLET.x + 8 + (stack % 3) * 52 : crate.x;
    const y = crate.status === 'pallet' ? PALLET.y + 52 - Math.floor(stack / 3) * 54 : crate.y;
    ctx.fillStyle = crate.kind === 'red' ? '#ff4d5a' : '#bb8440';
    ctx.fillRect(x - 23, y - 23, 46, 46);
    ctx.strokeStyle = '#e9e3d5';
    ctx.globalAlpha = .45;
    ctx.strokeRect(x - 18, y - 18, 36, 36);
    ctx.globalAlpha = 1;
  }

  drawDropFeedback(ctx, state);
  drawWorker(ctx, state);
  drawFirstActionGuide(ctx, state, now, options.firstActionGuide);
  drawPoster(ctx, state, now);
  drawWarehouseIntro(ctx, state);
  drawWakeReveal(ctx, state);

  ctx.fillStyle = '#8993a1';
  ctx.font = '16px ui-monospace, monospace';
  ctx.fillText(`СМЕНА 03:17     ПЕРЕНЕСЕНО ${state.warehouse.manualDelivered + state.warehouse.autoDelivered}     ₽ ${state.warehouse.wage}     СВОБОДНО ${state.warehouse.freeTime} МИН`, 470, 825);
  if (state.scene === 'red-crate') {
    ctx.fillStyle = '#ff4d5a';
    ctx.font = '900 28px ui-monospace, monospace';
    ctx.fillText('ОШИБКА МАРШРУТА · ГРУЗ НЕ СОВПАДАЕТ', 590, 220);
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
  ctx.fillText(`ЗАРАБОТАНО: ₽ ${state.warehouse.wage}`, qBotX, qBotY + 215);
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
  viewportTransform(ctx, viewport, state);
  if (state.scene === 'prologue') drawPrologue(ctx, state, now);
  else if (state.scene === 'collapse') drawCollapse(ctx, state);
  else if (state.scene === 'reward') drawReward(ctx, state, now);
  else drawWarehouse(ctx, state, now, options);
  ctx.restore();
}
