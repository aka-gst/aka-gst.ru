/* Труба для кармы: одна функция, которую подключает любая игра сайта.
   Игру менять почти не нужно — достаточно позвать ZooKarma.start('имя').

   Опознание идёт по общей куке сайта, поэтому ни ключей, ни настроек здесь
   нет: запрос уходит с той же страницы и тем же origin. Сервер сам решает,
   начислять ли — есть суточный потолок и минимальный промежуток. */
(() => {
  const HUB = (window.ZOO_HUB || '/zoo').replace(/\/$/, '');
  let timer = null, gained = 0, listeners = new Set();

  async function tick(game) {
    try {
      const response = await fetch(`${HUB}/api/karma/tick`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game }),
      });
      if (!response.ok) return null;
      const result = await response.json();
      if (result.awarded) {
        gained += result.awarded;
        listeners.forEach(fn => { try { fn(gained, result); } catch (error) { /* игра не должна падать из-за хаба */ } });
      }
      return result;
    } catch (error) {
      return null;    // хаб недоступен — игра продолжается как ни в чём не бывало
    }
  }

  window.ZooKarma = {
    /** Начать отсчёт: карма капает, пока игрок действительно играет. */
    start(game, intervalMs = 60000) {
      this.stop();
      void tick(game);
      timer = setInterval(() => { if (!document.hidden) void tick(game); }, intervalMs);
    },
    stop() { if (timer) clearInterval(timer); timer = null; },
    get gained() { return gained; },
    onGain(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
})();
