/**
 * Первые две неудачи оставляют человеку пространство попробовать самому.
 * Третья открывает подсказку, пятая — готовое решение, если оно существует.
 */
export function autoHintLevel({ failedAttempts, currentLevel = 0, hasSolution = false }) {
  if (failedAttempts >= 5 && hasSolution) return Math.max(currentLevel, 2);
  if (failedAttempts >= 3) return Math.max(currentLevel, 1);
  return currentLevel;
}
