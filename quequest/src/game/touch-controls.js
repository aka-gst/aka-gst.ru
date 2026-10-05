// 18.0: phone controls (Сергей 03.10: «мобильный: не ходит»). A stick on the
// left walks (it presses the same W/A/S/D the keyboard does, so every scene
// that already listens to keys just works), dragging on the right looks
// around (a 'qq:look' event the first-person views listen to), and two big
// buttons: E (use / talk / pick up) and jump.
const DEAD = 0.28;

export function createTouchControls(root, { isActive = () => false, sendKey, onLook = (dx, dy) => window.dispatchEvent(new CustomEvent('qq:look', { detail: { dx, dy } })) } = {}) {
  if (!root) return { update() {} };
  root.innerHTML = `
    <div class="touch__stick" aria-label="Ходить"><i class="touch__knob"></i></div>
    <div class="touch__look" aria-label="Смотреть"></div>
    <button type="button" class="touch__btn touch__jump" aria-label="Прыжок">⤒<small>ПРЫЖОК</small></button>
    <button type="button" class="touch__btn touch__use" aria-label="Действие">E<small>ВЗЯТЬ</small></button>`;
  const stick = root.querySelector('.touch__stick');
  const knob = root.querySelector('.touch__knob');
  const look = root.querySelector('.touch__look');
  const held = new Set();
  const key = sendKey ?? ((type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true })));
  function setHeld(next) {
    for (const code of held) if (!next.has(code)) { key('keyup', code); held.delete(code); }
    for (const code of next) if (!held.has(code)) { key('keydown', code); held.add(code); }
  }
  let stickId = null; let origin = null;
  stick.addEventListener('pointerdown', (e) => {
    stickId = e.pointerId; try { stick.setPointerCapture?.(e.pointerId); } catch { /* synthetic touch */ }
    const r = stick.getBoundingClientRect(); origin = { x: r.left + r.width / 2, y: r.top + r.height / 2, R: r.width / 2 };
    move(e); e.preventDefault();
  });
  function move(e) {
    if (e.pointerId !== stickId || !origin) return;
    let dx = (e.clientX - origin.x) / origin.R; let dy = (e.clientY - origin.y) / origin.R;
    const len = Math.hypot(dx, dy); if (len > 1) { dx /= len; dy /= len; }
    knob.style.transform = `translate(${dx * origin.R * 0.6}px, ${dy * origin.R * 0.6}px)`;
    const next = new Set();
    if (dy < -DEAD) next.add('KeyW'); if (dy > DEAD) next.add('KeyS');
    if (dx < -DEAD) next.add('KeyA'); if (dx > DEAD) next.add('KeyD');
    setHeld(next);
  }
  function end(e) {
    if (e.pointerId !== stickId) return;
    stickId = null; origin = null; knob.style.transform = ''; setHeld(new Set());
  }
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);

  let lookId = null; let last = null;
  look.addEventListener('pointerdown', (e) => { lookId = e.pointerId; try { look.setPointerCapture?.(e.pointerId); } catch { /* synthetic touch */ } last = { x: e.clientX, y: e.clientY }; e.preventDefault(); });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookId || !last) return;
    onLook((e.clientX - last.x) * 0.0065, (e.clientY - last.y) * 0.0065);
    last = { x: e.clientX, y: e.clientY };
  });
  const lookEnd = (e) => { if (e.pointerId === lookId) { lookId = null; last = null; } };
  window.addEventListener('pointerup', lookEnd); window.addEventListener('pointercancel', lookEnd);

  const tapKey = (code) => (e) => { e.preventDefault(); key('keydown', code); setTimeout(() => key('keyup', code), 60); };
  root.querySelector('.touch__jump').addEventListener('pointerdown', tapKey('Space'));
  root.querySelector('.touch__use').addEventListener('pointerdown', tapKey('KeyE'));

  let shown = false;
  function update() {
    const on = Boolean(isActive());
    if (on !== shown) {
      shown = on; root.hidden = !on;
      if (!on) { setHeld(new Set()); stickId = null; lookId = null; knob.style.transform = ''; }
    }
  }
  return { update, held: () => [...held] };
}

export function isTouchDevice() {
  try { return matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0; } catch { return false; }
}
