// Ordinary mouse input when pointer lock is unavailable (embedded/restricted browsers).
// Keep the existing pointer-lock and touch paths; never apply the same motion twice.
export function createDragLook(canvas, { active, onLook }) {
  let last = null;
  const end = () => { last = null; };
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.pointerType === 'touch' || !active() || canvas.ownerDocument.pointerLockElement) return;
    last = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try { canvas.setPointerCapture?.(e.pointerId); } catch { /* element may have detached */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!last || e.pointerId !== last.id) return;
    if (!active() || canvas.ownerDocument.pointerLockElement) { end(); return; }
    onLook(e.clientX - last.x, e.clientY - last.y);
    last = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, end);
}
