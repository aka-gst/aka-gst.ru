/*
 * Ступень 2. Тестирование.
 *
 * Материал опирается на практикум по проверке шлюза (agent-lab) и на
 * набор тестов local-agent-gateway: 50 автотестов, контракт, границы,
 * негативные сценарии и требование доказательства вместо впечатления.
 */

import { TEST_RUNNER, GATEWAY, MUTATION } from './stands.js';

export const testingLessons = [
  {
    id: 'qa-assert',
    tier: 'testing',
    title: 'Проверка вместо взгляда',
    subtitle: 'Что такое тест и чем он отличается от print',
    skill: 'assert',
    sprint: {
      idea: '<code>assert условие</code> молчит, когда условие истинно, и обрывает программу, когда ложно. Тест — это код, который сам решает, всё ли в порядке, вместо того чтобы показывать результат человеку.',
    },
    deep: {
      theory: 'Пока мы печатали результат и смотрели глазами, проверял человек. Тест переносит решение в код: <code>assert actual == expected</code> ничего не выводит при успехе и возбуждает <code>AssertionError</code> при расхождении. Такая проверка не устаёт, выполняется за миллисекунды и одинаково работает у всех. У хорошего утверждения три части: что получили (<b>actual</b>), что ожидали (<b>expected</b>) и понятное сообщение, если они разошлись: <code>assert total == 3, f"ожидали 3, получили {total}"</code>. Сообщение важнее, чем кажется: через месяц именно оно объяснит, что сломалось.',
      where: 'С assert начинается любой автотест, от модульного до приёмочного. Тот же оператор используют внутри кода как страховку от невозможного состояния.',
      pitfall: 'Проверять слишком общо: <code>assert result</code> проходит для любого непустого значения и не ловит подмену данных. Сравнивать надо с конкретным ожиданием.',
      examples: [
        { code: 'total = 2 + 2\nassert total == 4\nprint("проверка прошла")', note: 'Успешный assert не выводит ничего, программа идёт дальше.' },
        { code: 'assert 1 == 2, "числа разошлись"', note: 'Падение с понятным сообщением — так выглядит найденный дефект.' },
      ],
    },
    tasks: [
      {
        id: 'a', xp: 30, file: 'first_assert.py',
        brief: 'Функция <code>normalize</code> должна убирать пробелы и приводить текст к нижнему регистру. Проверь её утверждением: результат для <code>"  Вход СЛОМАН "</code> обязан быть <code>вход сломан</code>. Если проверка прошла, выведи <code>проверка прошла</code>.',
        starter: 'def normalize(text):\n    return text.strip().lower()\n\n\n# напиши assert и печать\n',
        hint: 'assert normalize("  Вход СЛОМАН ") == "вход сломан"',
        solution: 'def normalize(text):\n    return text.strip().lower()\n\n\nassert normalize("  Вход СЛОМАН ") == "вход сломан"\nprint("проверка прошла")',
        checks: [
          { label: 'Проверка написана через assert', kind: 'source', pattern: '^\\s*assert\\s+', detail: 'нужен оператор assert' },
          { label: 'Сравнение с конкретным ожиданием', kind: 'source', pattern: '==\\s*["\']вход сломан["\']', detail: 'ожидаемое значение должно быть указано явно' },
          { label: 'Проверка проходит', kind: 'stdout', mode: 'equals', value: 'проверка прошла' },
        ],
      },
      {
        id: 'b', xp: 35, file: 'message.py',
        brief: 'Здесь функция сломана специально. Напиши <code>assert</code> с понятным сообщением, поймай <code>AssertionError</code> и выведи текст сообщения.',
        starter: 'def percent(passed, total):\n    return passed / total  # забыли умножить на 100\n\n\nresult = percent(7, 10)\n\n# assert с сообщением, обёрнутый в try / except AssertionError\n',
        hint: 'try: assert result == 70, f"ожидали 70, получили {result}" — а в except AssertionError напечатай exc.',
        solution: 'def percent(passed, total):\n    return passed / total\n\n\nresult = percent(7, 10)\ntry:\n    assert result == 70, f"ожидали 70, получили {result}"\nexcept AssertionError as exc:\n    print(exc)',
        checks: [
          { label: 'Сообщение объясняет расхождение', kind: 'stdout', mode: 'contains', values: ['ожидали 70', '0.7'] },
          { label: 'Использован assert с сообщением', kind: 'source', pattern: 'assert[^\\n]+,', detail: 'после условия через запятую пишется сообщение' },
          { label: 'AssertionError перехвачен', kind: 'source', pattern: 'except\\s+AssertionError', detail: 'падение нужно поймать, чтобы показать текст' },
        ],
      },
      {
        id: 'c', xp: 35, file: 'strict.py',
        brief: 'Ниже слабая проверка: она проходит для любого непустого словаря. Замени её на три точных утверждения — по полям <code>title</code>, <code>severity</code> и <code>status</code>. В конце выведи <code>все поля проверены</code>.',
        starter: 'def create(title, severity):\n    return {"title": title.strip(), "severity": severity, "status": "open"}\n\n\nincident = create("  вход сломан  ", 5)\n\nassert incident  # слишком слабо: замени\n',
        hint: 'assert incident["title"] == "вход сломан", затем по severity и status.',
        solution: 'def create(title, severity):\n    return {"title": title.strip(), "severity": severity, "status": "open"}\n\n\nincident = create("  вход сломан  ", 5)\n\nassert incident["title"] == "вход сломан"\nassert incident["severity"] == 5\nassert incident["status"] == "open"\nprint("все поля проверены")',
        checks: [
          { label: 'Проверок стало не меньше трёх', kind: 'py', expr: 'len([line for line in __quest_source__.splitlines() if line.strip().startswith("assert")]) >= 3', detail: 'нужны отдельные утверждения на каждое поле' },
          { label: 'Слабая проверка убрана', kind: 'source', pattern: 'assert\\s+incident\\s*$', absent: true, detail: 'проверка без сравнения ничего не доказывает' },
          { label: 'Все утверждения проходят', kind: 'stdout', mode: 'equals', value: 'все поля проверены' },
        ],
      },
    ],
  },

  {
    id: 'qa-test-fn',
    tier: 'testing',
    title: 'Тест как функция',
    subtitle: 'Подготовка, действие, проверка',
    skill: 'test_*, AAA',
    preamble: TEST_RUNNER,
    sprint: {
      idea: 'Каждую проверку оформляют отдельной функцией с именем <code>test_...</code>. Внутри — три шага: подготовили данные, выполнили действие, сравнили результат. Здесь такие функции запускает команда <code>run_tests()</code> — ровно то, что делает pytest.',
    },
    deep: {
      theory: 'Тест — это функция без аргументов, имя которой начинается с <code>test_</code>. Раннер находит все такие функции и вызывает их по очереди: не упала — PASSED, возбудила <code>AssertionError</code> — FAILED, любая другая ошибка — ERROR. Внутри теста удобно держать три части, их называют arrange-act-assert: подготовка данных, одно действие, одна проверка результата. Имя теста должно читаться как утверждение о поведении: <code>test_пустой_заголовок_отклоняется</code> полезнее, чем <code>test_1</code>. Один тест проверяет одно поведение: тогда по имени упавшего теста сразу понятно, что сломалось.',
      where: 'Так устроены все наборы тестов на pytest, включая тот, что защищает шлюз: имя, три шага и одно утверждение на поведение.',
      pitfall: 'Складывать в один тест пять проверок разных вещей. Он упадёт на первой, остальные останутся невыполненными, и картина сломанного будет неполной.',
      examples: [
        { code: 'def test_очистка_убирает_пробелы():\n    raw = "  вход  "        # подготовка\n    result = raw.strip()      # действие\n    assert result == "вход"   # проверка\n\nrun_tests()', note: 'Три шага и запуск раннера последней строкой.' },
      ],
    },
    tasks: [
      {
        id: 'a', xp: 35, file: 'test_normalize.py',
        brief: 'Оформи проверку функции <code>normalize</code> как тест: функция <code>test_normalize_убирает_пробелы_и_регистр</code>, внутри — подготовка, действие и утверждение. Последней строкой вызови <code>run_tests()</code>.',
        starter: 'def normalize(text):\n    return text.strip().lower()\n\n\ndef test_normalize_убирает_пробелы_и_регистр():\n    \n\n\nrun_tests()',
        hint: 'raw = "  Вход СЛОМАН "; result = normalize(raw); assert result == "вход сломан"',
        solution: 'def normalize(text):\n    return text.strip().lower()\n\n\ndef test_normalize_убирает_пробелы_и_регистр():\n    raw = "  Вход СЛОМАН "\n    result = normalize(raw)\n    assert result == "вход сломан"\n\n\nrun_tests()',
        checks: [
          { label: 'Тест прошёл', kind: 'stdout', mode: 'contains', value: 'итог: 1 passed, 0 failed' },
          { label: 'Проверка находится внутри функции test_', kind: 'source', pattern: 'def\\s+test_\\w+\\s*\\(\\s*\\)\\s*:[\\s\\S]*assert', detail: 'утверждение должно быть внутри теста' },
        ],
      },
      {
        id: 'b', xp: 40, file: 'test_two.py',
        brief: 'Напиши два отдельных теста для <code>severity_label</code>: один проверяет 5 → <code>блокер</code>, другой 1 → <code>мелочь</code>. Оба должны пройти.',
        starter: 'def severity_label(level):\n    if level == 5:\n        return "блокер"\n    if level == 4:\n        return "критично"\n    return "мелочь"\n\n\n\n\nrun_tests()',
        hint: 'Две функции: test_пятёрка_это_блокер и test_единица_это_мелочь.',
        solution: 'def severity_label(level):\n    if level == 5:\n        return "блокер"\n    if level == 4:\n        return "критично"\n    return "мелочь"\n\n\ndef test_пятёрка_это_блокер():\n    assert severity_label(5) == "блокер"\n\n\ndef test_единица_это_мелочь():\n    assert severity_label(1) == "мелочь"\n\n\nrun_tests()',
        checks: [
          { label: 'Оба теста прошли', kind: 'stdout', mode: 'contains', value: 'итог: 2 passed, 0 failed' },
          { label: 'Проверки разнесены по двум функциям', kind: 'py', expr: '__quest_source__.count("def test_") >= 2', detail: 'одно поведение — один тест' },
        ],
      },
      {
        id: 'c', xp: 40, file: 'test_finds_bug.py',
        brief: 'В <code>create_incident</code> есть настоящий дефект: заголовок не очищается. Напиши тест, который это доказывает — он должен упасть и назвать расхождение. В выводе появится FAILED, и это правильный результат задачи.',
        starter: 'def create_incident(title, severity):\n    return {"title": title, "severity": severity, "status": "open"}\n\n\ndef test_заголовок_очищается_от_пробелов():\n    \n\n\nrun_tests()',
        hint: 'incident = create_incident("  вход сломан  ", 5); assert incident["title"] == "вход сломан", f"получили {incident[\'title\']!r}"',
        solution: 'def create_incident(title, severity):\n    return {"title": title, "severity": severity, "status": "open"}\n\n\ndef test_заголовок_очищается_от_пробелов():\n    incident = create_incident("  вход сломан  ", 5)\n    assert incident["title"] == "вход сломан", f"получили {incident[\'title\']!r}"\n\n\nrun_tests()',
        checks: [
          { label: 'Тест падает и показывает дефект', kind: 'stdout', mode: 'contains', value: 'итог: 0 passed, 1 failed' },
          { label: 'Проверяется именно очистка заголовка', kind: 'source', pattern: '["\']вход сломан["\']', detail: 'ожидаемое значение — очищенный заголовок' },
          { label: 'Функция под тестом не исправлена', kind: 'source', pattern: '\\.strip\\s*\\(\\s*\\)', absent: true, detail: 'задача — доказать дефект тестом, а не чинить код' },
        ],
      },
    ],
  },

  {
    id: 'qa-boundaries',
    tier: 'testing',
    title: 'Границы',
    subtitle: 'Где ломается почти всё',
    skill: 'граничные значения',
    preamble: TEST_RUNNER,
    sprint: {
      idea: 'Ошибки живут на краях диапазона. Если правило «от 1 до 5», проверяют 0, 1, 5 и 6 — по значению с каждой стороны каждой границы, а не середину.',
    },
    deep: {
      theory: 'Проверить все возможные входы нельзя, поэтому их делят на классы эквивалентности — группы, внутри которых программа ведёт себя одинаково. Из каждого класса берут один представитель, а дополнительно — значения на границах между классами. Для правила «severity от 1 до 5» классы такие: слишком мало, допустимо, слишком много. Интересные точки: 0 и 1 на нижней границе, 5 и 6 на верхней. Именно там живут ошибки вида «поставили &lt; вместо &lt;=». Отдельный класс — пустое, отсутствующее и совсем чужое значение: пустая строка, <code>None</code>, текст вместо числа.',
      where: 'Границы проверяют в любой валидации: длина пароля, размер запроса, диапазон дат, лимит страницы. Это самый дешёвый способ найти настоящий дефект.',
      pitfall: 'Проверить только середину диапазона. Тест «severity = 3 проходит» зелёный, а правило может быть написано неверно и пропускать шестёрку.',
      examples: [
        { code: 'for value in (0, 1, 5, 6):\n    print(value, 1 <= value <= 5)', note: 'Четыре интересные точки: две снаружи и две на самой границе.' },
      ],
    },
    tasks: [
      {
        id: 'a', xp: 35, file: 'test_bounds.py',
        brief: 'Проверь <code>is_valid_severity</code> на четырёх граничных значениях: 0 и 6 должны отклоняться, 1 и 5 — приниматься. Оформи это одним тестом с четырьмя утверждениями.',
        starter: 'def is_valid_severity(level):\n    return 1 <= level <= 5\n\n\ndef test_границы_диапазона():\n    \n\n\nrun_tests()',
        hint: 'assert is_valid_severity(1) is True и assert is_valid_severity(0) is False, и так для 5 и 6.',
        solution: 'def is_valid_severity(level):\n    return 1 <= level <= 5\n\n\ndef test_границы_диапазона():\n    assert is_valid_severity(0) is False\n    assert is_valid_severity(1) is True\n    assert is_valid_severity(5) is True\n    assert is_valid_severity(6) is False\n\n\nrun_tests()',
        checks: [
          { label: 'Тест прошёл', kind: 'stdout', mode: 'contains', value: 'итог: 1 passed, 0 failed' },
          { label: 'Проверены все четыре точки', kind: 'py', expr: 'all(str(v) in __quest_source__ for v in (0, 1, 5, 6))', detail: 'нужны значения 0, 1, 5 и 6' },
        ],
      },
      {
        id: 'b', xp: 40, file: 'test_off_by_one.py',
        brief: 'Здесь функция написана с ошибкой на единицу: она отклоняет пятёрку. Напиши тест, который её ловит. Тест должен упасть.',
        starter: 'def is_valid_severity(level):\n    return 1 <= level < 5  # ошибка на границе\n\n\ndef test_верхняя_граница_включена():\n    \n\n\nrun_tests()',
        hint: 'Достаточно одного утверждения: assert is_valid_severity(5) is True.',
        solution: 'def is_valid_severity(level):\n    return 1 <= level < 5\n\n\ndef test_верхняя_граница_включена():\n    assert is_valid_severity(5) is True, "пятёрка входит в допустимый диапазон"\n\n\nrun_tests()',
        checks: [
          { label: 'Тест падает и указывает на верхнюю границу', kind: 'stdout', mode: 'contains', value: 'итог: 0 passed, 1 failed' },
          { label: 'Проверяется именно значение 5', kind: 'source', pattern: 'is_valid_severity\\s*\\(\\s*5\\s*\\)', detail: 'дефект виден только на границе' },
          { label: 'Проверяемая функция не изменена', kind: 'source', pattern: 'level\\s*<\\s*5', detail: 'исправлять код в этой задаче не нужно' },
        ],
      },
      {
        id: 'c', xp: 40, file: 'test_classes.py',
        brief: 'Напиши три теста для <code>page_size</code> — по одному на класс: слишком мало (0), допустимо (50), слишком много (1000). Функция обязана возвращать значение из диапазона 1..100.',
        starter: 'def page_size(requested):\n    if requested < 1:\n        return 1\n    if requested > 100:\n        return 100\n    return requested\n\n\n\n\nrun_tests()',
        hint: 'Три функции: test_слишком_маленький_становится_единицей, test_допустимое_не_меняется, test_слишком_большой_обрезается.',
        solution: 'def page_size(requested):\n    if requested < 1:\n        return 1\n    if requested > 100:\n        return 100\n    return requested\n\n\ndef test_слишком_маленький_становится_единицей():\n    assert page_size(0) == 1\n\n\ndef test_допустимое_не_меняется():\n    assert page_size(50) == 50\n\n\ndef test_слишком_большой_обрезается():\n    assert page_size(1000) == 100\n\n\nrun_tests()',
        checks: [
          { label: 'Все три теста прошли', kind: 'stdout', mode: 'contains', value: 'итог: 3 passed, 0 failed' },
          { label: 'Каждый класс проверяется отдельным тестом', kind: 'py', expr: '__quest_source__.count("def test_") >= 3', detail: 'один класс — один тест' },
        ],
      },
    ],
  },

  {
    id: 'qa-params',
    tier: 'testing',
    title: 'Один тест — много данных',
    subtitle: 'Параметризация вместо копирования',
    skill: 'таблица случаев',
    preamble: TEST_RUNNER,
    sprint: {
      idea: 'Когда проверок много, а логика одна, данные выносят в таблицу и проходят по ней циклом. В pytest это делает декоратор <code>parametrize</code>, здесь — обычный список пар «вход — ожидание».',
    },
    deep: {
      theory: 'Пять почти одинаковых тестов, отличающихся только числом, — это пять мест, которые придётся править при изменении правила. Вместо копирования данные выносят в список кортежей: <code>CASES = [(0, False), (1, True), (5, True), (6, False)]</code>, а тест проходит по нему циклом. Важная деталь: в сообщении утверждения нужно указывать сам случай, иначе при падении будет непонятно, какая строка таблицы сломалась. В настоящем pytest это делает декоратор <code>@pytest.mark.parametrize("value,expected", CASES)</code> — он ещё и превращает каждую строку в отдельный тест с собственным именем.',
      where: 'Матрицы кодов ответов, наборы форматов дат, списки допустимых моделей, таблицы прав доступа. Везде, где одна логика проверяется на многих данных.',
      pitfall: 'Забыть добавить в сообщение об ошибке сам случай. Тогда упавший тест сообщает «False != True» и ничего не объясняет.',
      examples: [
        { code: 'CASES = [(200, True), (404, False)]\nfor code, expected in CASES:\n    assert (200 <= code < 300) is expected, f"случай {code}"', note: 'Таблица данных и одна логика проверки.' },
      ],
    },
    tasks: [
      {
        id: 'a', xp: 40, file: 'test_table.py',
        brief: 'Заполни таблицу <code>CASES</code> четырьмя случаями для <code>is_success</code>: 199 → False, 200 → True, 299 → True, 300 → False. Тест уже написан.',
        starter: 'def is_success(code):\n    return 200 <= code < 300\n\n\nCASES = [\n    \n]\n\n\ndef test_коды_ответов():\n    for code, expected in CASES:\n        assert is_success(code) is expected, f"случай {code}"\n\n\nrun_tests()',
        hint: 'Каждая строка — пара в круглых скобках: (199, False),',
        solution: 'def is_success(code):\n    return 200 <= code < 300\n\n\nCASES = [\n    (199, False),\n    (200, True),\n    (299, True),\n    (300, False),\n]\n\n\ndef test_коды_ответов():\n    for code, expected in CASES:\n        assert is_success(code) is expected, f"случай {code}"\n\n\nrun_tests()',
        checks: [
          { label: 'В таблице четыре случая', kind: 'py', expr: 'len(CASES) == 4' },
          { label: 'Границы 200 и 299 включены', kind: 'py', expr: 'dict(CASES).get(200) is True and dict(CASES).get(299) is True' },
          { label: 'Тест прошёл', kind: 'stdout', mode: 'contains', value: 'итог: 1 passed, 0 failed' },
        ],
      },
      {
        id: 'b', xp: 40, file: 'test_message.py',
        brief: 'В таблицу закралась строка с неверным ожиданием. Запусти тест и убедись, что сообщение называет сломавшийся случай: в выводе должен быть номер этого кода.',
        starter: 'def is_success(code):\n    return 200 <= code < 300\n\n\nCASES = [\n    (200, True),\n    (404, True),  # ожидание неверное\n    (500, False),\n]\n\n\ndef test_коды_ответов():\n    for code, expected in CASES:\n        assert is_success(code) is expected  # добавь сообщение со случаем\n\n\nrun_tests()',
        hint: 'assert ..., f"случай {code}: ожидали {expected}"',
        solution: 'def is_success(code):\n    return 200 <= code < 300\n\n\nCASES = [\n    (200, True),\n    (404, True),\n    (500, False),\n]\n\n\ndef test_коды_ответов():\n    for code, expected in CASES:\n        assert is_success(code) is expected, f"случай {code}: ожидали {expected}"\n\n\nrun_tests()',
        checks: [
          { label: 'Тест падает', kind: 'stdout', mode: 'contains', value: 'итог: 0 passed, 1 failed' },
          { label: 'В сообщении назван код 404', kind: 'stdout', mode: 'contains', value: '404' },
        ],
      },
      {
        id: 'c', xp: 45, file: 'test_matrix.py',
        brief: 'Составь таблицу для <code>severity_label</code> на все пять уровней и напиши тест, проходящий по ней. Метки: 5 — блокер, 4 — критично, 3 — важно, 2 и 1 — мелочь.',
        starter: 'def severity_label(level):\n    if level == 5:\n        return "блокер"\n    if level == 4:\n        return "критично"\n    if level == 3:\n        return "важно"\n    return "мелочь"\n\n\nCASES = [\n    \n]\n\n\ndef test_метки_уровней():\n    \n\n\nrun_tests()',
        hint: 'Пять пар в CASES, внутри теста цикл for level, expected in CASES с assert и сообщением.',
        solution: 'def severity_label(level):\n    if level == 5:\n        return "блокер"\n    if level == 4:\n        return "критично"\n    if level == 3:\n        return "важно"\n    return "мелочь"\n\n\nCASES = [\n    (5, "блокер"),\n    (4, "критично"),\n    (3, "важно"),\n    (2, "мелочь"),\n    (1, "мелочь"),\n]\n\n\ndef test_метки_уровней():\n    for level, expected in CASES:\n        assert severity_label(level) == expected, f"уровень {level}"\n\n\nrun_tests()',
        checks: [
          { label: 'В таблице пять уровней', kind: 'py', expr: 'len(CASES) == 5 and {c[0] for c in CASES} == {1, 2, 3, 4, 5}' },
          { label: 'Тест проходит по таблице циклом', kind: 'source', pattern: 'for\\s+\\w+\\s*,\\s*\\w+\\s+in\\s+CASES', detail: 'данные и логика должны быть разделены' },
          { label: 'Тест прошёл', kind: 'stdout', mode: 'contains', value: 'итог: 1 passed, 0 failed' },
        ],
      },
    ],
  },

  {
    id: 'qa-fixtures',
    tier: 'testing',
    title: 'Подготовка и уборка',
    subtitle: 'Тесты не должны мешать друг другу',
    skill: 'фикстуры, изоляция',
    preamble: TEST_RUNNER,
    sprint: {
      idea: 'Повторяющуюся подготовку выносят в отдельную функцию, а всё изменённое возвращают на место после теста. Иначе тесты начинают зависеть от порядка запуска — и падают по очереди без всякой причины.',
    },
    deep: {
      theory: 'Хороший тест начинается с чистого состояния и оставляет его таким же чистым. Подготовку данных выносят в функцию — в pytest её называют фикстурой и объявляют через <code>@pytest.fixture</code>, здесь достаточно обычной функции <code>make_incident()</code>. Второе правило жёстче: тест не имеет права зависеть от того, что сделал предыдущий. Общий список, глобальный флаг, запись в базе — всё это протекает между тестами, и набор начинает вести себя по-разному в зависимости от порядка. Лечится двумя приёмами: создавать данные заново в каждом тесте и возвращать изменённое состояние обратно через <code>try / finally</code>, чтобы уборка происходила даже когда тест упал.',
      where: 'Любой набор, который работает с базой, файлами, конфигурацией или общими объектами. Именно ради изоляции браузерные тесты шлюза поднимают отдельные процессы фальшивого апстрима на каждый прогон.',
      pitfall: 'Убирать за собой в конце теста без <code>finally</code>. Тест упал на утверждении — уборка не выполнилась, и следующий тест падает уже по чужой причине.',
      examples: [
        { code: 'def make_incident():\n    return {"title": "вход сломан", "severity": 5, "status": "open"}\n\n\ndef test_новая_запись_открыта():\n    assert make_incident()["status"] == "open"', note: 'Подготовка вынесена: каждый тест получает свежие данные.' },
        { code: 'CONFIG = {"strict": False}\n\ndef test_строгий_режим():\n    CONFIG["strict"] = True\n    try:\n        assert CONFIG["strict"] is True\n    finally:\n        CONFIG["strict"] = False', note: 'finally возвращает настройку на место даже при падении теста.' },
      ],
    },
    tasks: [
      {
        id: 'a', xp: 40, file: 'fixture.py',
        brief: 'Вынеси подготовку в функцию <code>make_incident()</code>, возвращающую свежий словарь с полями <code>title</code>, <code>severity</code> = 5 и <code>status</code> = <code>open</code>. Используй её в обоих тестах вместо копирования данных.',
        starter: 'def make_incident():\n    \n\n\ndef test_новая_запись_открыта():\n    \n\n\ndef test_у_записи_есть_важность():\n    \n\n\nrun_tests()',
        hint: 'В каждом тесте: incident = make_incident(), затем одно утверждение по нужному полю.',
        solution: 'def make_incident():\n    return {"title": "вход сломан", "severity": 5, "status": "open"}\n\n\ndef test_новая_запись_открыта():\n    incident = make_incident()\n    assert incident["status"] == "open"\n\n\ndef test_у_записи_есть_важность():\n    incident = make_incident()\n    assert incident["severity"] == 5\n\n\nrun_tests()',
        checks: [
          { label: 'Оба теста прошли', kind: 'stdout', mode: 'contains', value: 'итог: 2 passed, 0 failed' },
          { label: 'Подготовка возвращает свежий словарь каждый раз', kind: 'py', expr: 'make_incident() is not make_incident()', detail: 'фикстура должна создавать новый объект, а не отдавать общий' },
          { label: 'Оба теста пользуются фикстурой', kind: 'py', expr: '__quest_source__.count("make_incident()") >= 3', detail: 'данные не должны копироваться в каждый тест' },
        ],
      },
      {
        id: 'b', xp: 45, file: 'isolation.py',
        brief: 'Эти два теста ломаются из-за общего списка: второй видит запись, оставленную первым. Почини изоляцию, не меняя сами утверждения.',
        starter: 'STORAGE = []\n\n\ndef add(title):\n    STORAGE.append({"title": title, "status": "open"})\n\n\ndef test_первая_запись_одна_в_списке():\n    add("вход сломан")\n    assert len(STORAGE) == 1\n\n\ndef test_вторая_запись_тоже_одна():\n    add("оплата зависает")\n    assert len(STORAGE) == 1\n\n\nrun_tests()',
        hint: 'Добавь функцию setup(), которая очищает STORAGE через .clear(), и вызови её первой строкой каждого теста.',
        solution: 'STORAGE = []\n\n\ndef add(title):\n    STORAGE.append({"title": title, "status": "open"})\n\n\ndef setup():\n    STORAGE.clear()\n\n\ndef test_первая_запись_одна_в_списке():\n    setup()\n    add("вход сломан")\n    assert len(STORAGE) == 1\n\n\ndef test_вторая_запись_тоже_одна():\n    setup()\n    add("оплата зависает")\n    assert len(STORAGE) == 1\n\n\nrun_tests()',
        checks: [
          { label: 'Оба теста прошли', kind: 'stdout', mode: 'contains', value: 'итог: 2 passed, 0 failed' },
          { label: 'Состояние сбрасывается перед тестом', kind: 'source', pattern: '\\.clear\\s*\\(\\s*\\)|STORAGE\\[:\\]\\s*=', detail: 'общий список нужно очищать, а не наращивать' },
          { label: 'Утверждения не переписаны под текущее поведение', kind: 'py', expr: '__quest_source__.count("len(STORAGE) == 1") == 2', detail: 'чинить надо изоляцию, а не ожидания' },
        ],
      },
      {
        id: 'c', xp: 45, file: 'teardown.py',
        brief: 'Первый тест включает строгий режим и обязан вернуть настройку обратно даже при падении. Допиши уборку так, чтобы второй тест видел значение по умолчанию.',
        starter: 'CONFIG = {"strict": False}\n\n\ndef test_строгий_режим_включается():\n    CONFIG["strict"] = True\n    assert CONFIG["strict"] is True\n\n\ndef test_по_умолчанию_режим_выключен():\n    assert CONFIG["strict"] is False\n\n\nrun_tests()',
        hint: 'Оберни утверждение первого теста в try, а возврат значения положи в finally.',
        solution: 'CONFIG = {"strict": False}\n\n\ndef test_строгий_режим_включается():\n    CONFIG["strict"] = True\n    try:\n        assert CONFIG["strict"] is True\n    finally:\n        CONFIG["strict"] = False\n\n\ndef test_по_умолчанию_режим_выключен():\n    assert CONFIG["strict"] is False\n\n\nrun_tests()',
        checks: [
          { label: 'Оба теста прошли', kind: 'stdout', mode: 'contains', value: 'итог: 2 passed, 0 failed' },
          { label: 'Настройка вернулась к значению по умолчанию', kind: 'py', expr: 'CONFIG["strict"] is False' },
          { label: 'Уборка выполняется через finally', kind: 'source', pattern: '^\\s*finally\\s*:', detail: 'иначе упавший тест оставит состояние испорченным' },
        ],
      },
    ],
  },

  {
    id: 'qa-api',
    tier: 'testing',
    title: 'Контракт шлюза',
    subtitle: 'Проверка API без интерфейса',
    skill: 'API-тесты',
    preamble: `${TEST_RUNNER}\n${GATEWAY}`,
    sprint: {
      idea: 'API-тест отправляет запрос и проверяет ответ: код состояния, форму тела, заголовки. Здесь под рукой функция <code>gateway_request(method, path, token=..., json=...)</code> — модель настоящего шлюза с теми же правилами.',
    },
    deep: {
      theory: 'Проверять систему через интерфейс дорого и медленно; API-тест обращается к ней напрямую и потому быстрее и устойчивее. У ответа есть три слоя, и каждый заслуживает утверждения: код состояния (<code>200</code>, <code>401</code>, <code>403</code>), тело (нужные поля и их типы) и заголовки (например, идентификатор запроса для трассировки). Проверять надо контракт, а не текст: <code>response["json"]["choices"][0]["message"]["content"]</code> должен существовать и быть строкой, а вот его содержимое у модели каждый раз своё. Стенд урока повторяет правила настоящего шлюза: открытый <code>/health</code>, обязательный bearer-токен на <code>/v1/chat/completions</code>, список разрешённых моделей и бэкендов, ограничение размера запроса.',
      where: 'Так устроен основной слой тестов у любого сервиса. В local-agent-gateway именно этот слой проверяет аутентификацию, allowlist, валидацию и проксирование.',
      pitfall: 'Проверять только код 200. Ответ может быть успешным и при этом пустым или без нужного поля — контракт нарушен, а тест зелёный.',
      examples: [
        { code: 'response = gateway_request("GET", "/health")\nprint(response["status"], response["json"])', note: 'Открытый health-check: 200 и словарь со статусом.' },
        { code: 'response = gateway_request(\n    "POST", "/v1/chat/completions",\n    token=GATEWAY_TOKEN,\n    json={"model": "qwen3:8b", "messages": [{"role": "user", "content": "привет"}]},\n)\nprint(response["status"])', note: 'Успешный запрос с токеном и разрешённой моделью.' },
      ],
    },
    tasks: [
      {
        id: 'a', xp: 40, file: 'test_health.py',
        brief: 'Напиши тест <code>test_health_открыт_без_токена</code>: запрос <code>GET /health</code> без токена возвращает 200, а в теле есть поле <code>status</code> со значением <code>ok</code>.',
        starter: 'def test_health_открыт_без_токена():\n    \n\n\nrun_tests()',
        hint: 'response = gateway_request("GET", "/health"); assert response["status"] == 200; assert response["json"]["status"] == "ok"',
        solution: 'def test_health_открыт_без_токена():\n    response = gateway_request("GET", "/health")\n    assert response["status"] == 200\n    assert response["json"]["status"] == "ok"\n\n\nrun_tests()',
        checks: [
          { label: 'Тест прошёл', kind: 'stdout', mode: 'contains', value: 'итог: 1 passed, 0 failed' },
          { label: 'Проверен код ответа', kind: 'source', pattern: '\\[["\']status["\']\\]\\s*==\\s*200', detail: 'код состояния нужно утверждать явно' },
          { label: 'Проверено тело ответа', kind: 'source', pattern: '\\[["\']json["\']\\]', detail: 'кода 200 недостаточно, тело тоже часть контракта' },
        ],
      },
      {
        id: 'b', xp: 45, file: 'test_contract.py',
        brief: 'Напиши тест успешного обращения к модели: с токеном <code>GATEWAY_TOKEN</code> и моделью <code>qwen3:8b</code> ответ должен быть 200, содержать непустой список <code>choices</code>, а внутри — строковое поле <code>content</code>.',
        starter: 'def test_успешный_ответ_соответствует_контракту():\n    response = gateway_request(\n        "POST", "/v1/chat/completions",\n        token=GATEWAY_TOKEN,\n        json={"model": "qwen3:8b", "messages": [{"role": "user", "content": "привет"}]},\n    )\n    \n\n\nrun_tests()',
        hint: 'Проверь response["status"], затем len(body["choices"]) > 0 и isinstance(..., str).',
        solution: 'def test_успешный_ответ_соответствует_контракту():\n    response = gateway_request(\n        "POST", "/v1/chat/completions",\n        token=GATEWAY_TOKEN,\n        json={"model": "qwen3:8b", "messages": [{"role": "user", "content": "привет"}]},\n    )\n    assert response["status"] == 200\n    body = response["json"]\n    assert len(body["choices"]) > 0\n    content = body["choices"][0]["message"]["content"]\n    assert isinstance(content, str) and content\n\n\nrun_tests()',
        checks: [
          { label: 'Тест прошёл', kind: 'stdout', mode: 'contains', value: 'итог: 1 passed, 0 failed' },
          { label: 'Проверена структура choices', kind: 'source', pattern: 'choices', detail: 'контракт ответа включает список choices' },
          { label: 'Проверен тип содержимого', kind: 'source', pattern: 'isinstance\\s*\\(', detail: 'поле content должно быть строкой' },
        ],
      },
      {
        id: 'c', xp: 45, file: 'test_request_id.py',
        brief: 'Шлюз обязан возвращать заголовок <code>x-request-id</code> у любого ответа — по нему запрос находят в логах. Напиши тест, проверяющий это и для <code>/health</code>, и для успешного запроса к модели.',
        starter: 'def test_идентификатор_запроса_есть_всегда():\n    \n\n\nrun_tests()',
        hint: 'Сделай два запроса и проверь, что в response["headers"] есть ключ "x-request-id" и он непустой.',
        solution: 'def test_идентификатор_запроса_есть_всегда():\n    health = gateway_request("GET", "/health")\n    chat = gateway_request(\n        "POST", "/v1/chat/completions",\n        token=GATEWAY_TOKEN,\n        json={"model": "qwen3:8b", "messages": [{"role": "user", "content": "привет"}]},\n    )\n    for response in (health, chat):\n        assert response["headers"].get("x-request-id"), "нет идентификатора запроса"\n\n\nrun_tests()',
        checks: [
          { label: 'Тест прошёл', kind: 'stdout', mode: 'contains', value: 'итог: 1 passed, 0 failed' },
          { label: 'Проверены оба маршрута', kind: 'py', expr: '"/health" in __quest_source__ and "chat/completions" in __quest_source__' },
          { label: 'Проверяется именно заголовок', kind: 'source', pattern: 'x-request-id', detail: 'заголовок — третий слой контракта' },
        ],
      },
    ],
  },

  {
    id: 'qa-negative',
    tier: 'testing',
    title: 'Негативные сценарии',
    subtitle: 'Что должно быть запрещено',
    skill: 'безопасность и отказы',
    preamble: `${TEST_RUNNER}\n${GATEWAY}`,
    sprint: {
      idea: 'Позитивный тест доказывает, что нужное работает. Негативный — что ненужное не проходит: без токена 401, чужая модель 403, слишком большой запрос 413. И что в ответе об ошибке нет секретов.',
    },
    deep: {
      theory: 'Половина ценности набора тестов — в проверках отказа. Шлюз обязан не только пропускать разрешённое, но и надёжно отклонять всё остальное, причём с правильным кодом: <code>401</code> — не аутентифицирован, <code>403</code> — аутентифицирован, но нельзя, <code>422</code> — запрос не собран по правилам, <code>413</code> — слишком большой, <code>502</code> — сломался апстрим. Отдельная и часто забытая проверка: сообщение об ошибке не должно содержать токен, внутренний адрес или трассировку. Утечка в тексте ошибки — настоящий дефект безопасности, и ловится он ровно одним утверждением.',
      where: 'Это тот слой, который отличает набор тестов «для галочки» от набора, которому доверяют. В таблице рисков local-agent-gateway почти каждая строка — негативный сценарий.',
      pitfall: 'Проверять только факт ошибки, не проверяя код. Ответ 500 вместо 403 — это тоже отказ, но он означает, что сервис упал, а не защитился.',
      examples: [
        { code: 'response = gateway_request("POST", "/v1/chat/completions", json={"model": "qwen3:8b", "messages": [{"role": "user", "content": "x"}]})\nprint(response["status"], response["json"])', note: 'Без токена: 401 и безопасное сообщение об ошибке.' },
      ],
    },
    tasks: [
      {
        id: 'a', xp: 40, file: 'test_401.py',
        brief: 'Напиши тест: запрос к <code>/v1/chat/completions</code> без токена возвращает ровно 401, а не любую другую ошибку.',
        starter: 'def test_без_токена_отказ_401():\n    \n\n\nrun_tests()',
        hint: 'Вызови gateway_request без параметра token и проверь response["status"] == 401.',
        solution: 'def test_без_токена_отказ_401():\n    response = gateway_request(\n        "POST", "/v1/chat/completions",\n        json={"model": "qwen3:8b", "messages": [{"role": "user", "content": "привет"}]},\n    )\n    assert response["status"] == 401, response["status"]\n\n\nrun_tests()',
        checks: [
          { label: 'Тест прошёл', kind: 'stdout', mode: 'contains', value: 'итог: 1 passed, 0 failed' },
          { label: 'Проверяется именно код 401', kind: 'source', pattern: '==\\s*401', detail: 'важен конкретный код отказа' },
        ],
      },
      {
        id: 'b', xp: 45, file: 'test_allowlist.py',
        brief: 'Напиши два теста: модель не из списка разрешённых даёт 403, а запрос без поля <code>model</code> — 422. Разница между «нельзя» и «неправильно собран» должна быть видна.',
        starter: 'def test_чужая_модель_запрещена():\n    \n\n\ndef test_запрос_без_модели_невалиден():\n    \n\n\nrun_tests()',
        hint: 'Первый тест: model="gpt-4o". Второй: json без ключа model.',
        solution: 'def test_чужая_модель_запрещена():\n    response = gateway_request(\n        "POST", "/v1/chat/completions",\n        token=GATEWAY_TOKEN,\n        json={"model": "gpt-4o", "messages": [{"role": "user", "content": "привет"}]},\n    )\n    assert response["status"] == 403, response["status"]\n\n\ndef test_запрос_без_модели_невалиден():\n    response = gateway_request(\n        "POST", "/v1/chat/completions",\n        token=GATEWAY_TOKEN,\n        json={"messages": [{"role": "user", "content": "привет"}]},\n    )\n    assert response["status"] == 422, response["status"]\n\n\nrun_tests()',
        checks: [
          { label: 'Оба теста прошли', kind: 'stdout', mode: 'contains', value: 'итог: 2 passed, 0 failed' },
          { label: 'Проверены оба кода: 403 и 422', kind: 'py', expr: '"403" in __quest_source__ and "422" in __quest_source__' },
        ],
      },
      {
        id: 'c', xp: 50, file: 'test_no_leak.py',
        brief: 'Сломай апстрим — отправь сообщение со словом <code>boom</code> — и докажи тестом две вещи: код ответа 502 и в тексте ответа нет значения <code>GATEWAY_TOKEN</code>.',
        starter: 'def test_ошибка_апстрима_не_раскрывает_токен():\n    \n\n\nrun_tests()',
        hint: 'После запроса собери текст: str(response["json"]), и проверь GATEWAY_TOKEN not in текст.',
        solution: 'def test_ошибка_апстрима_не_раскрывает_токен():\n    response = gateway_request(\n        "POST", "/v1/chat/completions",\n        token=GATEWAY_TOKEN,\n        json={"model": "qwen3:8b", "messages": [{"role": "user", "content": "boom"}]},\n    )\n    assert response["status"] == 502, response["status"]\n    body = str(response["json"])\n    assert GATEWAY_TOKEN not in body, "токен утёк в ответ"\n\n\nrun_tests()',
        checks: [
          { label: 'Тест прошёл', kind: 'stdout', mode: 'contains', value: 'итог: 1 passed, 0 failed' },
          { label: 'Проверен код 502', kind: 'source', pattern: '==\\s*502', detail: 'ошибка апстрима имеет свой код' },
          { label: 'Проверена утечка токена', kind: 'source', pattern: 'GATEWAY_TOKEN\\s+not\\s+in', detail: 'секрет не должен попадать в ответ' },
        ],
      },
    ],
  },

  {
    id: 'qa-evidence',
    tier: 'testing',
    title: 'PASS и NOT PROVEN',
    subtitle: 'Доказательство вместо впечатления',
    skill: 'дисциплина проверки',
    preamble: TEST_RUNNER,
    sprint: {
      idea: 'Из практикума: результат бывает трёх видов. PASS — есть вывод, файл или прогон, который прямо доказывает критерий. FAIL — доказано обратное. NOT PROVEN — утверждение похоже на правду, но доказательства нет. Третье — не PASS.',
    },
    deep: {
      theory: 'Самая частая ошибка начинающего тестировщика не техническая, а логическая: принять правдоподобный ответ за доказанный факт. Практикум по шлюзу вводит для этого жёсткое правило. Каждый критерий закрывается одним из трёх статусов, и NOT PROVEN — законный результат, а не поражение: он честно говорит, что проверка не проводилась или её вывод ничего не доказывает. Отчёт по эксперименту состоит из точной команды, кода возврата, минимального обезличенного вывода, статуса и двух строк: что доказано и что не доказано. Это же правило применимо к автотестам: тест, который не может упасть, доказывает ровно ничего.',
      where: 'Так пишут отчёты о прогонах, так принимают работу от подрядчика, так формулируют вывод в резюме: «50 автотестов и 99% покрытия» — это PASS с доказательством, а «всё работает» — это NOT PROVEN.',
      pitfall: 'Тест без возможности упасть. Утверждение <code>assert True</code> или проверка, которая всегда истинна, создаёт иллюзию покрытия.',
      examples: [
        { code: 'def test_ничего_не_доказывает():\n    result = 2 + 2\n    assert result  # истинно для любого ненулевого\n\nrun_tests()', note: 'PASSED в отчёте, NOT PROVEN по существу.' },
      ],
    },
    tasks: [
      {
        id: 'a', xp: 40, file: 'evidence.py',
        brief: 'Функция <code>verdict(actual, expected, checked)</code> должна возвращать <code>PASS</code>, если проверка выполнялась и значения совпали, <code>FAIL</code>, если выполнялась и не совпали, и <code>NOT PROVEN</code>, если проверка не выполнялась.',
        starter: 'def verdict(actual, expected, checked):\n    \n\n\nprint(verdict(4, 4, True))\nprint(verdict(3, 4, True))\nprint(verdict(4, 4, False))',
        hint: 'Сначала обработай случай checked = False, потом сравнение.',
        solution: 'def verdict(actual, expected, checked):\n    if not checked:\n        return "NOT PROVEN"\n    if actual == expected:\n        return "PASS"\n    return "FAIL"\n\n\nprint(verdict(4, 4, True))\nprint(verdict(3, 4, True))\nprint(verdict(4, 4, False))',
        checks: [
          { label: 'Совпадение при выполненной проверке даёт PASS', kind: 'call', fn: 'verdict', args: [4, 4, true], equals: 'PASS' },
          { label: 'Расхождение даёт FAIL', kind: 'call', fn: 'verdict', args: [3, 4, true], equals: 'FAIL' },
          { label: 'Невыполненная проверка даёт NOT PROVEN даже при совпадении', kind: 'call', fn: 'verdict', args: [4, 4, false], equals: 'NOT PROVEN' },
        ],
      },
      {
        id: 'b', xp: 45, file: 'fix_weak_test.py',
        brief: 'Ниже тест, который не может упасть. Перепиши его так, чтобы он действительно проверял поведение <code>percent</code> — и убедись, что он проходит на верной реализации.',
        starter: 'def percent(passed, total):\n    return round(passed / total * 100, 1)\n\n\ndef test_процент_считается():\n    result = percent(7, 10)\n    assert result  # ничего не доказывает\n\n\nrun_tests()',
        hint: 'assert result == 70.0, f"получили {result}"',
        solution: 'def percent(passed, total):\n    return round(passed / total * 100, 1)\n\n\ndef test_процент_считается():\n    result = percent(7, 10)\n    assert result == 70.0, f"получили {result}"\n\n\nrun_tests()',
        checks: [
          { label: 'Тест прошёл', kind: 'stdout', mode: 'contains', value: 'итог: 1 passed, 0 failed' },
          { label: 'Проверка сравнивает с конкретным значением', kind: 'source', pattern: 'assert\\s+result\\s*==', detail: 'нужно ожидаемое значение, а не просто истинность' },
          { label: 'Слабое утверждение убрано', kind: 'source', pattern: 'assert\\s+result\\s*(#.*)?$', absent: true, detail: 'assert без сравнения ничего не доказывает' },
        ],
      },
      {
        id: 'c', xp: 45, file: 'report_line.py',
        brief: 'Собери строку отчёта в формате практикума. Функция <code>report_line(name, command, exit_code, status)</code> возвращает <code>Эксперимент: имя | Команда: cmd | Exit code: 0 | Статус: PASS</code>.',
        starter: 'def report_line(name, command, exit_code, status):\n    \n\n\nprint(report_line("health-check", "curl /health", 0, "PASS"))',
        hint: 'Одна f-строка с четырьмя подстановками и разделителем " | ".',
        solution: 'def report_line(name, command, exit_code, status):\n    return f"Эксперимент: {name} | Команда: {command} | Exit code: {exit_code} | Статус: {status}"\n\n\nprint(report_line("health-check", "curl /health", 0, "PASS"))',
        checks: [
          { label: 'Строка собрана по формату', kind: 'call', fn: 'report_line', args: ['health-check', 'curl /health', 0, 'PASS'], equals: 'Эксперимент: health-check | Команда: curl /health | Exit code: 0 | Статус: PASS' },
          { label: 'Формат не зависит от конкретных данных', kind: 'call', fn: 'report_line', args: ['allowlist', 'pytest -k allowlist', 1, 'FAIL'], equals: 'Эксперимент: allowlist | Команда: pytest -k allowlist | Exit code: 1 | Статус: FAIL' },
        ],
      },
    ],
  },

  {
    id: 'qa-mutation',
    tier: 'testing',
    title: 'Кто проверяет тесты',
    subtitle: 'Сломай код и посмотри, заметит ли тест',
    skill: 'мутационное тестирование',
    preamble: `${TEST_RUNNER}\n${MUTATION}`,
    sprint: {
      idea: 'Зелёный тест ничего не доказывает сам по себе. Проверить его можно так: подменить реализацию заведомо сломанной и убедиться, что тест упал. Если не упал — он пропустит и настоящий дефект.',
    },
    deep: {
      theory: 'Это прямое продолжение правила NOT PROVEN. Мы уже знаем, что <code>assert result</code> проходит для любого непустого значения. Но и вполне приличный на вид тест может ничего не проверять — просто потому, что данные выбраны неудачно. Приём называется мутационным тестированием: берём рабочую функцию, вносим в неё типичную ошибку (забыли умножить, перепутали аргументы, поставили целочисленное деление) и запускаем тест на этой «мутации». Тест обязан упасть — тогда говорят, что он <b>убил</b> мутанта. Выживший мутант означает дыру: такая ошибка пройдёт мимо набора незамеченной. Здесь <code>kills(test, implementation)</code> возвращает <code>True</code>, если тест поймал подмену, а словарь <code>MUTANTS</code> хранит три типичные поломки функции процента.',
      where: 'Так оценивают качество набора там, где покрытие строк уже стопроцентное, а уверенности нет. Покрытие говорит, что строка выполнилась; мутационный тест — что её поведение действительно проверяется.',
      pitfall: 'Выбирать для теста данные, на которых верная и сломанная реализации совпадают. Классика: проверять процент на <code>7 из 7</code> — там и правильная формула, и целочисленное деление дадут одинаковые 100.',
      examples: [
        { code: 'def test_percent(percent):\n    assert percent(7, 10) == 70.0\n\nprint(kills(test_percent, percent_correct))\nprint(kills(test_percent, percent_no_hundred))', note: 'На верной реализации тест проходит (False), сломанную ловит (True).' },
      ],
    },
    tasks: [
      {
        id: 'a', xp: 45, file: 'mutation.py',
        brief: 'Напиши тест <code>test_percent(percent)</code>, который принимает реализацию аргументом и проверяет, что 7 из 10 — это <code>70.0</code>. Затем выведи две строки: ловит ли он верную реализацию и ловит ли мутанта <code>percent_no_hundred</code>.',
        starter: 'def test_percent(percent):\n    \n\n\nprint(kills(test_percent, percent_correct))\nprint(kills(test_percent, percent_no_hundred))',
        hint: 'Внутри теста одно утверждение: assert percent(7, 10) == 70.0',
        solution: 'def test_percent(percent):\n    assert percent(7, 10) == 70.0\n\n\nprint(kills(test_percent, percent_correct))\nprint(kills(test_percent, percent_no_hundred))',
        checks: [
          { label: 'На верной реализации тест не падает, сломанную ловит', kind: 'stdout', mode: 'lines', value: ['False', 'True'] },
          { label: 'Тест принимает реализацию аргументом', kind: 'source', pattern: 'def\\s+test_percent\\s*\\(\\s*percent\\s*\\)', detail: 'подменять реализацию можно только так' },
          { label: 'Проверяется конкретное ожидаемое значение', kind: 'py', expr: 'kills(test_percent, percent_swapped) is True', detail: 'слабое утверждение не поймало бы и перестановку аргументов' },
        ],
      },
      {
        id: 'b', xp: 50, file: 'survivors.py',
        brief: 'Напиши функцию <code>survivors(test_fn)</code>: она возвращает список имён мутантов из <code>MUTANTS</code>, которых тест не поймал. Слабый тест из заготовки должен оставить в живых двоих — выведи их.',
        starter: 'def test_percent(percent):\n    assert percent(10, 10) == 100.0  # слабые данные\n\n\ndef survivors(test_fn):\n    \n\n\nprint(survivors(test_percent))',
        hint: 'Пройди MUTANTS.items() и оставь те имена, для которых kills(...) вернул False.',
        solution: 'def test_percent(percent):\n    assert percent(10, 10) == 100.0\n\n\ndef survivors(test_fn):\n    return [name for name, mutant in MUTANTS.items() if not kills(test_fn, mutant)]\n\n\nprint(survivors(test_percent))',
        checks: [
          { label: 'Слабый тест пропускает двух мутантов', kind: 'py', expr: 'len(survivors(test_percent)) == 2' },
          { label: 'Названы именно перестановка аргументов и целочисленное деление', kind: 'py', expr: 'set(survivors(test_percent)) == {"перепутали местами аргументы", "целочисленное деление вместо обычного"}' },
          { label: 'Список выживших выведен', kind: 'stdout', mode: 'contains', value: 'целочисленное деление' },
          { label: 'Тест пока не переписан', kind: 'source', pattern: 'percent\\s*\\(\\s*10\\s*,\\s*10\\s*\\)', detail: 'в этой задаче инструмент, а не починка' },
        ],
      },
      {
        id: 'c', xp: 50, file: 'kill_all.py',
        brief: 'Усиль тест так, чтобы не выжил ни один мутант, и выведи <code>выжило мутантов: 0</code>. На верной реализации тест обязан по-прежнему проходить.',
        starter: 'def test_percent(percent):\n    assert percent(10, 10) == 100.0  # усиль эти данные\n\n\ndef survivors(test_fn):\n    return [name for name, mutant in MUTANTS.items() if not kills(test_fn, mutant)]\n\n\nprint(f"выжило мутантов: {len(survivors(test_percent))}")',
        hint: 'Возьми данные, на которых сломанные формулы дают другой ответ: например 7 из 10.',
        solution: 'def test_percent(percent):\n    assert percent(7, 10) == 70.0\n\n\ndef survivors(test_fn):\n    return [name for name, mutant in MUTANTS.items() if not kills(test_fn, mutant)]\n\n\nprint(f"выжило мутантов: {len(survivors(test_percent))}")',
        checks: [
          { label: 'Не выжил ни один мутант', kind: 'py', expr: 'survivors(test_percent) == []' },
          { label: 'На верной реализации тест проходит', kind: 'py', expr: 'kills(test_percent, percent_correct) is False', detail: 'усиление не должно ломать тест на рабочем коде' },
          { label: 'Отчёт выведен', kind: 'stdout', mode: 'contains', value: 'выжило мутантов: 0' },
        ],
      },
    ],
  },

  {
    id: 'qa-report',
    tier: 'testing',
    title: 'Отчёт о прогоне',
    subtitle: 'Что показать вместо «вроде работает»',
    skill: 'сводка и код возврата',
    preamble: TEST_RUNNER,
    sprint: {
      idea: 'Прогон заканчивается не строчками в терминале, а двумя вещами: короткой сводкой для человека и кодом возврата для машины. Ноль — можно выкладывать, единица — нельзя.',
    },
    deep: {
      theory: 'У результата прогона два адресата. Человеку нужна сводка: сколько всего, сколько прошло, что именно упало и почему — без неё падение приходится искать глазами в длинной простыне. Машине нужен код возврата: <code>0</code>, если всё зелёное, и любой ненулевой, если нет. Именно на него смотрит CI, чтобы решить, пускать ли изменение дальше. Отчёт полезно собирать структурой, а не текстом: словарь с числами легко сравнить со вчерашним, положить в JSON и построить график. Здесь <code>run_tests()</code> возвращает такой словарь: <code>passed</code>, <code>failed</code>, <code>names</code> и <code>failures</code> со списком имён и причин.',
      where: 'GitHub Actions останавливает сборку по ненулевому коду возврата pytest. Allure и отчёты в JSON и Markdown строятся из тех же данных, что и сводка в терминале.',
      pitfall: 'Печатать «всё хорошо» и завершаться нулём независимо от результата. Такой прогон зелёный всегда и не защищает ни от чего.',
      examples: [
        { code: 'result = run_tests()\nprint(f"тестов: {len(result[\'names\'])} · пройдено: {result[\'passed\']}")', note: 'Сводка строится из возвращённого словаря, а не из напечатанного текста.' },
      ],
    },
    tasks: [
      {
        id: 'a', xp: 45, file: 'summary.py',
        brief: 'Собери сводку по результату прогона в формате <code>тестов: 3 · пройдено: 2 · упало: 1</code>. Один из тестов в заготовке падает специально.',
        starter: 'def test_код_200_успешный():\n    assert 200 <= 200 < 300\n\n\ndef test_код_404_не_успешный():\n    assert not 200 <= 404 < 300\n\n\ndef test_верхняя_граница():\n    assert 200 <= 300 < 300, "300 не входит в диапазон успешных"\n\n\nresult = run_tests()\n\nprint()',
        hint: 'Всего тестов — len(result["names"]), остальное лежит в result["passed"] и result["failed"].',
        solution: 'def test_код_200_успешный():\n    assert 200 <= 200 < 300\n\n\ndef test_код_404_не_успешный():\n    assert not 200 <= 404 < 300\n\n\ndef test_верхняя_граница():\n    assert 200 <= 300 < 300, "300 не входит в диапазон успешных"\n\n\nresult = run_tests()\n\nprint(f"тестов: {len(result[\'names\'])} · пройдено: {result[\'passed\']} · упало: {result[\'failed\']}")',
        checks: [
          { label: 'Сводка собрана верно', kind: 'stdout', mode: 'contains', value: 'тестов: 3 · пройдено: 2 · упало: 1' },
          { label: 'Числа взяты из результата прогона', kind: 'source', pattern: 'result\\s*\\[', detail: 'сводка не должна быть вписана руками' },
        ],
      },
      {
        id: 'b', xp: 45, file: 'exit_code.py',
        brief: 'Напиши функцию <code>exit_code(result)</code>: <code>0</code>, если ни один тест не упал, иначе <code>1</code>. Выведи код возврата текущего прогона.',
        starter: 'def test_первый():\n    assert True\n\n\ndef test_второй_падает():\n    assert False, "заложенное падение"\n\n\ndef exit_code(result):\n    \n\n\nprint(exit_code(run_tests()))',
        hint: 'Достаточно посмотреть на result["failed"].',
        solution: 'def test_первый():\n    assert True\n\n\ndef test_второй_падает():\n    assert False, "заложенное падение"\n\n\ndef exit_code(result):\n    return 1 if result["failed"] else 0\n\n\nprint(exit_code(run_tests()))',
        checks: [
          { label: 'Зелёный прогон даёт 0', kind: 'call', fn: 'exit_code', args: [{ passed: 3, failed: 0 }], equals: 0 },
          { label: 'Одно падение даёт 1', kind: 'call', fn: 'exit_code', args: [{ passed: 2, failed: 1 }], equals: 1 },
          { label: 'Код возврата текущего прогона выведен', kind: 'stdout', mode: 'contains', value: '1' },
        ],
      },
      {
        id: 'c', xp: 50, file: 'failures.py',
        brief: 'Допиши отчёт: после сводки выведи строку <code>упали:</code> и по строке на каждый упавший тест в формате <code>  имя — причина</code>. Данные бери из <code>result["failures"]</code>.',
        starter: 'def test_очистка_заголовка():\n    assert "  вход  ".strip() == "вход"\n\n\ndef test_верхняя_граница_включена():\n    assert 5 <= 4, "пятёрка должна входить в диапазон"\n\n\nresult = run_tests()\nprint(f"пройдено: {result[\'passed\']}, упало: {result[\'failed\']}")\n\n',
        hint: 'Каждый элемент failures — словарь с ключами name и reason. Пройди список циклом.',
        solution: 'def test_очистка_заголовка():\n    assert "  вход  ".strip() == "вход"\n\n\ndef test_верхняя_граница_включена():\n    assert 5 <= 4, "пятёрка должна входить в диапазон"\n\n\nresult = run_tests()\nprint(f"пройдено: {result[\'passed\']}, упало: {result[\'failed\']}")\n\nif result["failures"]:\n    print("упали:")\n    for failure in result["failures"]:\n        print(f"  {failure[\'name\']} — {failure[\'reason\']}")',
        checks: [
          { label: 'Сводка выведена', kind: 'stdout', mode: 'contains', value: 'пройдено: 1, упало: 1' },
          { label: 'Назван упавший тест и причина', kind: 'stdout', mode: 'contains', values: ['упали:', 'test_верхняя_граница_включена', 'пятёрка должна входить в диапазон'] },
          { label: 'Список собран циклом по failures', kind: 'source', pattern: 'for\\s+\\w+\\s+in\\s+result\\s*\\[\\s*["\']failures["\']', detail: 'имена не должны быть вписаны руками' },
        ],
      },
    ],
  },

  {
    id: 'qa-suite',
    tier: 'testing',
    title: 'Проект: набор тестов шлюза',
    subtitle: 'Собери всё в один прогон',
    skill: 'итоговая работа',
    preamble: `${TEST_RUNNER}\n${GATEWAY}`,
    sprint: {
      idea: 'Соберём небольшой, но честный набор: открытый health, успешный контракт, отказ без токена, запрет чужой модели и отсутствие утечки секрета. Пять тестов, каждый доказывает свой риск.',
    },
    deep: {
      theory: 'Набор тестов имеет смысл, когда каждый тест закрывает названный риск. Полезно держать перед глазами таблицу «риск — проверка»: невалидная аутентификация — тест на 401; чужая модель дошла до апстрима — тест на 403; ошибка апстрима раскрыла секрет — тест на отсутствие токена в теле; сломался контракт ответа — тест на структуру choices. Такой список объясняет, зачем каждый тест существует, и сразу показывает дыры. Именно так документирован набор из 50 тестов в local-agent-gateway.',
      where: 'Это финальная форма работы тестировщика: не «я потыкал», а набор проверок, который запускается на каждый коммит и держит поведение системы.',
      pitfall: 'Гнаться за числом тестов вместо покрытия рисков. Двадцать тестов на один и тот же успешный путь слабее пяти, закрывающих пять разных рисков.',
      examples: [
        { code: 'def test_health_открыт():\n    assert gateway_request("GET", "/health")["status"] == 200\n\nrun_tests()', note: 'Один риск — один тест с говорящим именем.' },
      ],
    },
    tasks: [
      {
        id: 'a', xp: 70, file: 'suite.py',
        brief: 'Напиши пять тестов: health открыт без токена (200), успешный запрос с токеном (200), запрос без токена (401), чужая модель (403), ошибка апстрима на слове <code>boom</code> (502) без утечки токена. Все пять должны пройти.',
        starter: 'CHAT = "/v1/chat/completions"\n\n\ndef chat(token=None, model="qwen3:8b", content="привет"):\n    return gateway_request(\n        "POST", CHAT, token=token,\n        json={"model": model, "messages": [{"role": "user", "content": content}]},\n    )\n\n\n# пять тестов ниже\n\n\nrun_tests()',
        hint: 'Вспомогательная функция chat уже написана — используй её и меняй только нужный параметр в каждом тесте.',
        solution: 'CHAT = "/v1/chat/completions"\n\n\ndef chat(token=None, model="qwen3:8b", content="привет"):\n    return gateway_request(\n        "POST", CHAT, token=token,\n        json={"model": model, "messages": [{"role": "user", "content": content}]},\n    )\n\n\ndef test_health_открыт_без_токена():\n    assert gateway_request("GET", "/health")["status"] == 200\n\n\ndef test_успешный_запрос_с_токеном():\n    assert chat(token=GATEWAY_TOKEN)["status"] == 200\n\n\ndef test_без_токена_401():\n    assert chat()["status"] == 401\n\n\ndef test_чужая_модель_403():\n    assert chat(token=GATEWAY_TOKEN, model="gpt-4o")["status"] == 403\n\n\ndef test_ошибка_апстрима_без_утечки():\n    response = chat(token=GATEWAY_TOKEN, content="boom")\n    assert response["status"] == 502\n    assert GATEWAY_TOKEN not in str(response["json"])\n\n\nrun_tests()',
        checks: [
          { label: 'Все пять тестов прошли', kind: 'stdout', mode: 'contains', value: 'итог: 5 passed, 0 failed' },
          { label: 'Закрыты все пять рисков', kind: 'py', expr: 'all(code in __quest_source__ for code in ("200", "401", "403", "502"))' },
          { label: 'Проверена утечка секрета', kind: 'source', pattern: 'GATEWAY_TOKEN\\s+not\\s+in', detail: 'секрет не должен попадать в тело ответа' },
        ],
      },
      {
        id: 'b', xp: 60, file: 'risk_table.py',
        brief: 'Опиши таблицу «риск — проверка» словарями в списке <code>RISKS</code> (поля <code>risk</code> и <code>check</code>), затем напиши функцию <code>coverage(risks)</code>, возвращающую строку <code>рисков: 5, закрыто проверками: 5</code>.',
        starter: 'RISKS = [\n    \n]\n\n\ndef coverage(risks):\n    \n\n\nprint(coverage(RISKS))',
        hint: 'Закрытым считается риск с непустым полем check.',
        solution: 'RISKS = [\n    {"risk": "нет аутентификации", "check": "test_без_токена_401"},\n    {"risk": "чужая модель уходит в апстрим", "check": "test_чужая_модель_403"},\n    {"risk": "секрет в теле ошибки", "check": "test_ошибка_апстрима_без_утечки"},\n    {"risk": "сломан контракт ответа", "check": "test_успешный_запрос_с_токеном"},\n    {"risk": "health закрыт токеном", "check": "test_health_открыт_без_токена"},\n]\n\n\ndef coverage(risks):\n    closed = [item for item in risks if item.get("check")]\n    return f"рисков: {len(risks)}, закрыто проверками: {len(closed)}"\n\n\nprint(coverage(RISKS))',
        checks: [
          { label: 'В таблице пять рисков', kind: 'py', expr: 'len(RISKS) == 5 and all("risk" in item and "check" in item for item in RISKS)' },
          { label: 'Функция считает закрытые риски', kind: 'call', fn: 'coverage', args: [[{ risk: 'a', check: 't1' }, { risk: 'b', check: '' }]], equals: 'рисков: 2, закрыто проверками: 1' },
          { label: 'Отчёт выведен', kind: 'stdout', mode: 'contains', value: 'рисков: 5, закрыто проверками: 5' },
        ],
      },
    ],
  },
];
