// Читалка: грунт, размер текста, полоса прочитанного и возврат на место.
// Всё, что читатель выбрал, запоминается — иначе на телефоне, где читают в
// три захода, каждый заход начинается с настройки заново.
(() => {
  const root = document.documentElement;
  const ПАМЯТЬ = 'aka-gst:read';

  const прочитать = () => {
    try {
      return JSON.parse(localStorage.getItem(ПАМЯТЬ)) || {};
    } catch (e) {
      // Приватный режим и запрет хранилища — не повод ломать чтение.
      return {};
    }
  };
  const записать = (что) => {
    try {
      localStorage.setItem(ПАМЯТЬ, JSON.stringify({ ...прочитать(), ...что }));
    } catch (e) {
      /* читать можно и без памяти */
    }
  };

  const настройки = прочитать();
  const РАЗМЕРЫ = ['s', '', 'l', 'xl'];
  let размер = РАЗМЕРЫ.indexOf(настройки.размер ?? '');
  if (размер < 0) размер = 1;

  const применить = () => {
    root.dataset.ground = настройки.грунт === 'paper' ? 'paper' : 'dark';
    if (РАЗМЕРЫ[размер]) root.dataset.size = РАЗМЕРЫ[размер];
    else delete root.dataset.size;
  };
  применить();

  document.querySelector('[data-ground-toggle]')?.addEventListener('click', () => {
    настройки.грунт = настройки.грунт === 'paper' ? 'dark' : 'paper';
    применить();
    записать({ грунт: настройки.грунт });
  });

  for (const кнопка of document.querySelectorAll('[data-size]')) {
    кнопка.addEventListener('click', () => {
      размер = Math.min(РАЗМЕРЫ.length - 1, Math.max(0, размер + Number(кнопка.dataset.size)));
      применить();
      записать({ размер: РАЗМЕРЫ[размер] });
    });
  }

  const рассказ = document.querySelector('.story');
  if (!рассказ) return;

  const слаг = рассказ.dataset.story;
  const полоса = document.querySelector('.reader-progress i');

  // Доля прочитанного считается по самому тексту, а не по всей странице:
  // шапка и навигация внизу не должны попадать в «сколько осталось».
  const доля = () => {
    const r = рассказ.getBoundingClientRect();
    const пройдено = -r.top + innerHeight * 0.6;
    return Math.min(1, Math.max(0, пройдено / Math.max(1, r.height)));
  };

  let ждём = false;
  const обновить = () => {
    if (полоса) полоса.style.width = `${(доля() * 100).toFixed(1)}%`;
    ждём = false;
  };
  addEventListener(
    'scroll',
    () => {
      if (ждём) return;
      ждём = true;
      requestAnimationFrame(обновить);
    },
    { passive: true }
  );
  обновить();

  // Место храним в долях высоты, а не в пикселях: при другом размере шрифта
  // или на другом экране пиксели указывают не туда.
  const места = настройки.места || {};
  let таймер;
  addEventListener(
    'scroll',
    () => {
      clearTimeout(таймер);
      таймер = setTimeout(() => {
        const d = доля();
        // Начало и самый конец не запоминаем: возвращать в них незачем.
        записать({ места: { ...прочитать().места, [слаг]: d > 0.04 && d < 0.97 ? d : 0 } });
      }, 600);
    },
    { passive: true }
  );

  const было = места[слаг];
  if (было > 0.04) {
    const r = рассказ.getBoundingClientRect();
    const цель = r.top + scrollY + r.height * было - innerHeight * 0.6;
    // Предлагаем вернуться, а не прыгаем сами: непрошеный прыжок при
    // открытии страницы сбивает сильнее, чем помогает.
    const подсказка = document.createElement('button');
    подсказка.type = 'button';
    подсказка.className = 'reader-resume';
    подсказка.textContent = `Вернуться на ${Math.round(было * 100)}%`;
    подсказка.addEventListener('click', () => {
      scrollTo({ top: цель, behavior: 'smooth' });
      подсказка.remove();
    });
    рассказ.querySelector('.story-meta')?.after(подсказка);
  }
})();
