export function stepCompanion(previous, target, home, size, dt) {
  const old = previous ?? home;
  // Resize can put the previous position outside the new viewport, not just the target.
  const p = { x: Math.max(36, Math.min(size.width - 36, old.x)),
    y: Math.max(76, Math.min(size.height - 36, old.y)) };
  const aim = target ?? home;
  const x = Math.max(36, Math.min(size.width - 36, aim.x));
  const y = Math.max(76, Math.min(size.height - 36, aim.y));
  const distance = Math.hypot(x-p.x, y-p.y);
  const step = Math.min(distance, 300 * Math.min(.05, Math.max(0, dt || 0)));
  return { x: p.x + (x-p.x) / (distance || 1) * step,
    y: p.y + (y-p.y) / (distance || 1) * step,
    biting: Boolean(target && distance < 48) };
}

export function createCompanion(game, glyph, panel, reducedMotion = false) {
  let point = null, target = null, lastTime = null;
  function notice(event) {
    const rect = game.getBoundingClientRect();
    target = { x: event.clientX-rect.left, y: event.clientY-rect.top };
  }
  game.addEventListener('pointermove', notice);
  game.addEventListener('pointerdown', notice);
  game.addEventListener('pointerleave', () => { target = null; });
  game.addEventListener('pointerup', event => { if(event.pointerType !== 'mouse') target = null; });
  game.addEventListener('pointercancel', () => { target = null; });
  return { update(visible, now) {
    glyph.hidden = !visible;
    if(!visible) { point = null; target = null; lastTime = null; return; }
    const rect = game.getBoundingClientRect();
    const ending = panel.getBoundingClientRect();
    const home = { x: rect.width/2, y: panel.hidden ? rect.height/2 : ending.top-rect.top+48 };
    point = stepCompanion(point, reducedMotion ? null : target, home, rect, lastTime === null ? 0 : (now-lastTime)/1000);
    lastTime = now;
    glyph.style.left = `${point.x}px`; glyph.style.top = `${point.y}px`;
    glyph.dataset.biting = String(point.biting);
  }};
}
