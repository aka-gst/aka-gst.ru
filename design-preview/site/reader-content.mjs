export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// Same source convention as the original reader: one line per paragraph.
export function storyMarkup(text) {
  return text.split('\n').map(line => line.trim()).filter(Boolean).map(line =>
    /^\*\*\*$|^\*\s*\*\s*\*$/.test(line) ? '<hr class="story-break">' : `<p>${escapeHtml(line)}</p>`
  ).join('\n');
}
export function storyIllustration(story, collection) {
  if (story.cover) return { file:story.cover, alt:`Обложка рассказа «${story.title}»`, own:true };
  if (collection.cover) return { file:collection.cover, alt:`Обложка сборника «${collection.title}»`, own:false };
  return null;
}
