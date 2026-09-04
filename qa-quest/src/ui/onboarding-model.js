/** Данные двух равноправных входов на первом экране. */
export function buildStoryChoices(themes, currentId) {
  return themes.map((theme) => ({
    id: theme.id,
    name: theme.entryName || theme.name,
    hook: theme.entryHook || theme.hook,
    active: theme.id === currentId,
  }));
}
