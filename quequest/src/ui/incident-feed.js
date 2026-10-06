/*
 * Короткая лента настоящих случаев для стенда.
 *
 * Карточки лежат в приложении намеренно: запуск упражнения не тянет новости,
 * не ломается без сети и не превращает обучение в случайную рекламную ленту.
 * Здесь только факт, последствие и безопасный вывод — без шагов атаки.
 */

const UCONNECT_2015 = {
  id: 'uconnect-2015',
  eyebrow: 'РЕАЛЬНЫЙ КЕЙС · 2015',
  title: 'Jeep Cherokee: отзыв 1,4 млн машин',
  fact: 'После публично раскрытой уязвимости Uconnect FCA и NHTSA запустили отзыв и обновление ПО для примерно 1,4 млн автомобилей.',
  defense: 'Вывод: обновления безопасности — часть обслуживания машины, а не лишняя галочка.',
  sourceLabel: 'CISA: FCA Uconnect Vulnerability',
  sourceUrl: 'https://www.cisa.gov/news-events/alerts/2015/07/27/fiat-chrysler-automobiles-fca-uconnect-vulnerability',
};

export function incidentForRun({ themeId, outcome }) {
  if (themeId !== 'garage') return null;
  return {
    ...UCONNECT_2015,
    lead: outcome === 'error'
      ? 'Ошибка в коде останавливает программу. В машине она может остановить целую сеть.'
      : 'Твой код дал ответ. В 2015-м один ответ от системы автомобиля привёл к отзыву миллионов машин.',
  };
}
