// 18.0: «клавиша вправо залипала» (Сергей 03.10). A key is "held" from its
// keydown until its keyup — but the keyup never arrives when the window
// loses focus (alt-tab, a system dialog), when the tab is hidden, or when
// focus jumps into a text field that swallows it. Then the player walks
// right forever. Every place that keeps a set of held keys registers here,
// and all of them are released together on those moments.
const listeners = new Set();
let installed = false;

export function releaseAllKeys(reason = 'manual') {
  for (const fn of listeners) {
    try { fn(reason); } catch { /* one broken listener must not keep others stuck */ }
  }
}

function install(target = globalThis) {
  if (installed || !target?.addEventListener) return;
  installed = true;
  target.addEventListener('blur', () => releaseAllKeys('blur'));
  target.document?.addEventListener('visibilitychange', () => { if (target.document.hidden) releaseAllKeys('hidden'); });
  // Focus moving into an editor: world keys pressed before it are released.
  target.document?.addEventListener('focusin', (event) => {
    const el = event.target;
    if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable)) releaseAllKeys('editor');
  });
  target.document?.addEventListener('pointerlockchange', () => { if (!target.document.pointerLockElement) releaseAllKeys('pointer-unlock'); });
}

export function onReleaseKeys(fn, target = globalThis) {
  install(target);
  listeners.add(fn);
  return () => listeners.delete(fn);
}
