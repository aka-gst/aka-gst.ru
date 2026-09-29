// Единственная политика для ссылки, которую build.mjs запекает в страницу.
// Браузерная копия в assets/app.js проверяется теми же векторами в тесте:
// app.js остаётся обычным defer-скриптом, поэтому импортировать ESM туда нельзя.
export const trustedQaRunUrl = (value) => {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'github.com' ||
      url.port || url.username || url.password ||
      !/^\/aka-gst\/local-agent-gateway\/actions\/runs\/[1-9]\d*\/?$/.test(url.pathname)
    ) return null;
    url.search = '';
    url.hash = '';
    return url.href;
  } catch (_) {
    return null;
  }
};
