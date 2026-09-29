export function getWakeFailureGuidance(attempt, result) {
  if (result.error?.type === 'PythonUnavailable') {
    return {
      message: 'Терминал не запустился. Проверь соединение и попробуй ещё раз.',
      prefill: null,
    };
  }
  if (attempt >= 3) {
    return {
      message: 'Почти. Сверь команду целиком и попробуй ещё раз.',
      prefill: null,
    };
  }
  if (attempt === 2) {
    return {
      message: 'Сигнал не совпал. Здесь важны все знаки, не только слово.',
      prefill: null,
    };
  }
  return {
    message: 'Команда не распознана. Сверь знаки с тем, что видел на складе.',
    prefill: null,
  };
}
