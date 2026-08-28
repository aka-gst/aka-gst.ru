/*
 * Словарь терминов. Слова подсвечиваются в теории и объясняются
 * по наведению — новичку не приходится уходить из урока за поиском.
 */

export const glossary = {
  'API': 'Программный интерфейс: способ одной программы обратиться к другой запросом и получить ответ.',
  'HTTP': 'Протокол, по которому браузер и сервисы обмениваются запросами и ответами.',
  'JSON': 'Текстовый формат данных: объекты в фигурных скобках, списки в квадратных, строки в кавычках.',
  'bool': 'Логический тип с двумя значениями: True и False.',
  'int': 'Целое число.',
  'float': 'Число с дробной частью.',
  'str': 'Строка, то есть текст.',
  'list': 'Список — упорядоченная коллекция значений, доступ по номеру с нуля.',
  'dict': 'Словарь — коллекция пар «ключ — значение».',
  'assert': 'Оператор проверки: молчит при истинном условии и возбуждает AssertionError при ложном.',
  'return': 'Завершает функцию и отдаёт результат вызывающему коду.',
  'pytest': 'Самый распространённый инструмент запуска тестов в Python: находит функции test_* и выполняет их.',
  'allowlist': 'Список разрешённого. Всё, чего в нём нет, отклоняется по умолчанию.',
  'bearer': 'Схема авторизации, при которой токен передаётся в заголовке Authorization.',
  'токен': 'Секретная строка, подтверждающая право на запрос. В ответы и логи попадать не должна.',
  'LLM': 'Большая языковая модель: сервис, который по тексту запроса возвращает текст ответа.',
  'промпт': 'Текст запроса к модели вместе со служебными инструкциями.',
  'канарейка': 'Уникальная строка в системном промпте: её появление в ответе доказывает утечку инструкций.',
  'latency': 'Задержка — время между запросом и ответом.',
  'Pyodide': 'Сборка настоящего Python для браузера. Именно она выполняет код на этой странице.',
};

const terms = Object.keys(glossary).sort((a, b) => b.length - a.length);
const lookup = new Map(terms.map((term) => [term.toLowerCase(), term]));
const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
const WORD_CHAR = /[\p{L}\p{N}_]/u;

/**
 * Оборачивает найденные термины в подсказку.
 * Границы слова проверяются вручную, а не через \b: он не знает кириллицы
 * и, например, находил бы «int» внутри «print».
 */
export function decorateGlossary(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement.closest('code, pre, .term-tip')) continue;
    pattern.lastIndex = 0;
    if (pattern.test(node.textContent)) nodes.push(node);
  }
  nodes.forEach((node) => {
    const parts = node.textContent.split(pattern);
    if (parts.length < 2) return;
    const fragment = document.createDocumentFragment();
    parts.forEach((part, index) => {
      const key = index % 2 === 1 ? lookup.get(part.toLowerCase()) : null;
      const before = parts[index - 1] || '';
      const after = parts[index + 1] || '';
      const touchesWord = WORD_CHAR.test(before.slice(-1)) || WORD_CHAR.test(after.slice(0, 1));
      if (!key || touchesWord) {
        fragment.append(document.createTextNode(part));
        return;
      }
      const span = document.createElement('span');
      span.className = 'term-tip';
      span.tabIndex = 0;
      span.textContent = part;
      span.dataset.tip = glossary[key];
      span.setAttribute('aria-label', `${part}: ${glossary[key]}`);
      fragment.append(span);
    });
    node.replaceWith(fragment);
  });
}
