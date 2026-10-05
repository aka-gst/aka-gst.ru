/*
 * Короткий перевод ошибок Python на язык задачи.
 *
 * Не угадываем причину любой ошибки: ложная уверенность вреднее общего
 * сообщения Python. Объяснение появляется, только когда одновременно видим
 * SyntaxError, ожидаемый текст задачи и этот текст без кавычек в print().
 */

function unquotedPrintsExpectedText(source, expectedText) {
  if (!source || !expectedText) return false;
  const sourceWithoutComments = source.replace(/#.*$/gm, '');
  const compactSource = sourceWithoutComments.replace(/\s+/g, '');
  const compactExpected = expectedText.replace(/\s+/g, '');
  return compactSource.includes(`print(${compactExpected})`);
}

export function errorGuidance({ error, source = '', expectedText = '' }) {
  if (error?.type !== 'SyntaxError') return null;
  if (!unquotedPrintsExpectedText(source, expectedText)) return null;

  return {
    code: 'quote-required-text',
    text: `«${expectedText}» — это текст. Возьми его в кавычки: print("${expectedText}").`,
  };
}
