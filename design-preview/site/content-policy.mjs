// The preview lists only the curated portfolio. New projects require a choice.
const order = {
  work: ['qa-quest', 'local-agent-gateway', 'photo-meta-editor', 'praktikum-testing', 'ai-agent-service-lab', 'voki-toki'],
  games: ['acid-uno', 'qa-quest', 'neon-lines', 'puzzle-quest', 'odin-udar', 'stealth', 'technomagic']
};
export function selectProjects(projects, section) {
  const ids = order[section];
  if (!ids) throw new Error(`Unknown section: ${section}`);
  return ids.flatMap(id => projects.filter(project => project.id === id));
}
