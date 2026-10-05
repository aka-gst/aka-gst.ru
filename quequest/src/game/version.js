// One build label for the whole game. Every visible "СБОРКА …" / "QUEQUEST …"
// eyebrow reads it, so old screens can't keep showing a previous build.
export const BUILD = '18.1';
export const BUILD_LABEL = `СБОРКА ${BUILD}`;

// Fills [data-build] (just the number) and [data-build-label] ("СБОРКА 17.0").
// [data-build="…"] keeps its subtitle: "QUEQUEST 17.0 · …".
export function applyBuildLabels(root = globalThis.document) {
  if (!root?.querySelectorAll) return 0;
  let n = 0;
  for (const el of root.querySelectorAll('[data-build-label]')) { el.textContent = BUILD_LABEL; n++; }
  for (const el of root.querySelectorAll('[data-build]')) {
    const tail = el.dataset.build ? ` · ${el.dataset.build}` : '';
    el.textContent = `QUEQUEST ${BUILD}${tail}`; n++;
  }
  return n;
}
