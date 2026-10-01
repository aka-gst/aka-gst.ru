// Curated by Sergey; unselected/private projects stay out.
const order = {
  work: ['local-agent-gateway', 'dharma-ai', 'qa-quest', 'photo-meta-editor', 'praktikum-testing', 'ai-agent-service-lab', 'voki-toki', 'ai-router', 'ashennote'],
  games: ['black-ice', 'afterflow-prism', 'acid-uno', 'pythonio', 'qa-quest', 'neon-lines', 'puzzle-quest', 'odin-udar', 'pulse-arena', 'sdvig-21', 'stealth', 'technomagic', 'glubina']
};
export function selectProjects(projects, section) {
  const ids = order[section];
  if (!ids) throw new Error(`Unknown section: ${section}`);
  return ids.flatMap(id => projects.filter(project => project.id === id));
}
