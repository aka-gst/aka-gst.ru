# Данные для главной страницы

Три профессиональных проекта отдают машиночитаемые файлы. Главная страница их
читает и ничего не переписывает руками: цифры на первом экране должны быть теми
же, что CI проверил на последнем прогоне.

| Что | Живой URL | Локальный снимок |
|---|---|---|
| Метрики прогона gateway | `https://aka-gst.github.io/local-agent-gateway/qa-metrics.json` | `data/qa-metrics.json` |
| История прогонов | `https://aka-gst.github.io/local-agent-gateway/qa-metrics-history.json` | `data/qa-metrics-history.json` |
| Практикум по тестированию | `/praktikum/testirovanie/course.json` | тот же файл |
| Практикум по настройке LLM | `/praktikum/llm/course.json` | тот же файл |

Обновить всё локальное: `sh sync-portfolio.sh`.

## Экран 1. Local Agent Gateway

Файл `qa-metrics.json` (схема `aka-gst.qa-metrics/1`) собран так, чтобы первый
экран рендерился из одного поля.

`headline` — массив ровно из четырёх карточек: `tests`, `coverage`,
`pass_rate`, `median_latency`. У каждой есть:

- `display` — уже отформатированная строка (`66`, `99%`, `100%`, `3483 ms`);
- `value` и `unit` — сырое значение, если нужен свой формат;
- `label.ru` и `note.ru` — подпись и пояснение по-русски;
- `status` — `passed` или `failed`, для цвета чипа.

Остальное для деталей под экраном: `tests.suites[]` даёт разбивку по слоям
(Gateway API, LLM evaluation, End-to-end), `coverage.threshold` — порог CI,
`evaluation.deterministic` и `evaluation.live` — прогоны по моделям.

Обязательные элементы, иначе экран перестаёт быть отчётом:

- показать `generated_at` рядом с числами;
- сослаться на `commit.run_url` («смотреть прогон») и на `project.report`
  (Allure) — обе кнопки уже описаны в плане;
- отметить, что `evaluation.live.source` = `recorded-local-run`: эти цифры
  измерены один раз на названной машине, а не enforced каждым push.

Порядок загрузки: сначала отрисовать снимок `data/qa-metrics.json`, который
лежит в репозитории сайта, затем попробовать живой URL и заменить значения.
GitHub Pages отдаёт `Access-Control-Allow-Origin: *`, поэтому fetch из браузера
работает без прокси. Если сеть недоступна, страница остаётся корректной.

```js
const render = (report) => {
  for (const card of report.headline) {
    const node = document.querySelector(`[data-metric="${card.key}"]`);
    if (!node) continue;
    node.querySelector('.value').textContent = card.display;
    node.querySelector('.label').textContent = card.label.ru;
    node.querySelector('.note').textContent = card.note.ru;
    node.dataset.status = card.status;
  }
  document.querySelector('[data-metric-updated]').textContent = report.generated_at;
};

render(await (await fetch('/data/qa-metrics.json')).json());
fetch('https://aka-gst.github.io/local-agent-gateway/qa-metrics.json')
  .then((response) => (response.ok ? response.json() : null))
  .then((live) => live && live.schema === 'aka-gst.qa-metrics/1' && render(live))
  .catch(() => {});
```

Живой файл появляется после первого успешного прогона `main` с новым
workflow. До этого сайт работает на снимке.

### Почему в `projects.json` больше нет чисел

У проекта `local-agent-gateway` раньше лежал собственный массив `metrics` —
`50`, `99%`, `9/9`, `0.755`, `3 483 мс`, `v0.2.1`. К моменту, когда feed
заработал, половина из них уже разошлась с кодом: тестов стало 66, версия
`0.3.0`. Ровно этот класс ошибок feed и закрывает.

Массив удалён вместе с `runContext`, вместо него у проекта есть `metricsFeed`
с адресами живого файла, истории и снимка. В `projects.json` остаются описание,
стек и ссылки — всё, что действительно пишется руками и меняется редко. Не
возвращайте числа обратно: через месяц они снова станут неправдой.

## Экран 2. Практикумы

Оба практикума уже развёрнуты как статические страницы и отдаются Caddy с
основного домена:

- `https://aka-gst.ru/praktikum/testirovanie/` — 20 страниц, 16 экспериментов;
- `https://aka-gst.ru/praktikum/llm/` — 17 страниц, 10 лабораторных.

Каждая директория самодостаточна: свои `styles.css`, `sitemap.xml`, canonical
на `aka-gst.ru` и `course.json` рядом со страницами. Правок в `Caddyfile` не
нужно — их подхватывает общий `root * /srv`, а Caddy сам добавляет слэш в конце
директории.

Для карточек на главной берите из `course.json`: `title`, `subtitle`,
`totals.units`, `totals.experiments`, `totals.estimate_minutes`,
`generated_at`. Ссылка карточки — на `index.html` практикума.

Эти файлы генерируются, а не пишутся: исходники живут в `agent-lab` (DOCX) и
`ai-agent-service-lab` (Markdown), CI пересобирает их и падает, если
опубликованное разошлось с исходником. Не редактируйте `praktikum/**` вручную —
правка потеряется при следующем `sync-portfolio.sh`.

## QA Quest: ступени 2 и 3

QA Quest не должен переписывать уроки. Оба практикума отдают одну и ту же схему
`aka-gst.course/1`, описанную в
`agent-lab/docs/course-schema.md`:

| Ступень | Курс | `stage` | Источник |
|---|---|---|---|
| 1 | Питон с нуля | 1 | собственные миссии QA Quest |
| 2 | Тестирование | 2 | `/praktikum/testirovanie/course.json` |
| 3 | Работа и тесты с LLM | 3 | `/praktikum/llm/course.json` |

У каждого `unit` с `kind: "experiment"` есть поле `task`, спроецированное прямо
на поля миссии QA Quest:

| Поле миссии | Поле `task` |
|---|---|
| `theory` | `objective` |
| `task` | `scope` |
| `checks` | `done_when` |
| `hint` | `pitfalls` |
| стартовый код / команда | `commands[].text` |
| «где применяется» | `artifacts` |
| «типичная ошибка» | `pitfalls` |

Ссылка «читать полностью» ведёт на `<base>/<unit.id>.html`. Проверки в этих
ступенях ручные: `done_when` — это чек-лист, а не автотест, и на страницах
практикума он уже отмечается галочками с сохранением в `localStorage`.

## Одно замечание про анонимность

Сайт подписан `aka-gst`, и всё, на что он ссылается, должно быть подписано так
же. Кнопка «Репозиторий» уводит посетителя за пределы сайта, поэтому одного
чистого `index.html` мало: анонимность теряется в один клик, если подпись
разъезжается на той стороне.

На 2026-08-28 связанные репозитории проверены и подписаны `aka-gst`. Проверять
это стоит при каждой новой ссылке с главной — и не цитировать найденное имя в
заметке об этом, иначе документ сам становится утечкой.
