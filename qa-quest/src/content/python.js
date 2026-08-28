/*
 * Ступень 1. Питон с нуля.
 *
 * Каждый урок живёт в двух режимах на одном материале:
 *   sprint — одна мысль и одна задача;
 *   deep   — объяснение, где это применяется, типичная ошибка, примеры и три задачи.
 * Первая задача урока общая для обоих режимов, поэтому прогресс не раздваивается.
 */

export const pythonLessons = [
  {
    id: 'py-print',
    tier: 'python',
    title: 'Первое слово',
    subtitle: 'Заставь компьютер ответить',
    skill: 'print',
    sprint: {
      idea: 'Команда <code>print()</code> показывает то, что стоит в скобках. Текст пишется в кавычках. Это первое, что делает любая программа, и первый способ увидеть, что внутри неё происходит.',
    },
    deep: {
      theory: 'Программа — это список команд, которые Python выполняет сверху вниз, одну за другой. Команда <code>print()</code> берёт то, что стоит в круглых скобках, и печатает это в терминал. Текст обязательно берётся в кавычки — одинарные или двойные, разницы нет. Без кавычек Python решит, что вы назвали имя переменной, и не найдёт её.',
      where: 'Так выводят результат, так смотрят промежуточные значения при отладке, так пишут логи. Первое, что делает тестировщик с непонятным кодом, — расставляет print и смотрит, что реально происходит.',
      pitfall: 'Забыть кавычки или закрыть скобку не там. Python читает строку буквально: если кавычка одна, он будет искать вторую до конца файла.',
      examples: [
        { code: 'print("Привет")', note: 'Печатает слово Привет без кавычек.' },
        { code: 'print("Привет", "мир")', note: 'Несколько значений через запятую — Python поставит между ними пробел.' },
        { code: 'print(2 + 2)', note: 'В скобках может стоять не только текст: здесь напечатается 4.' },
      ],
    },
    tasks: [
      {
        id: 'a', xp: 20, file: 'hello.py',
        brief: 'Выведи в терминал строку <code>Q-Bot online</code>.',
        starter: '# Напиши команду ниже\n',
        hint: 'print("Q-Bot online")',
        solution: 'print("Q-Bot online")',
        checks: [
          { label: 'В терминале появилось «Q-Bot online»', kind: 'stdout', mode: 'equals', value: 'Q-Bot online' },
        ],
      },
      {
        id: 'b', xp: 20, file: 'lines.py',
        brief: 'Выведи три строки подряд: <code>система запущена</code>, <code>проверка связи</code>, <code>готов к работе</code>.',
        starter: '',
        hint: 'Три отдельные команды print, каждая со своей строкой.',
        solution: 'print("система запущена")\nprint("проверка связи")\nprint("готов к работе")',
        checks: [
          { label: 'Три строки в нужном порядке', kind: 'stdout', mode: 'lines', value: ['система запущена', 'проверка связи', 'готов к работе'] },
        ],
      },
      {
        id: 'c', xp: 25, file: 'report.py',
        brief: 'Выведи одной командой <code>тестов: 10 из 12</code>. Числа передай в <code>print</code> отдельными значениями через запятую, а не внутри кавычек.',
        starter: 'print("тестов:")\n',
        hint: 'print("тестов:", 10, "из", 12)',
        solution: 'print("тестов:", 10, "из", 12)',
        checks: [
          { label: 'Строка собрана правильно', kind: 'stdout', mode: 'equals', value: 'тестов: 10 из 12' },
          { label: 'Числа переданы как числа, а не текстом', kind: 'source', pattern: 'print\\s*\\([^)]*,\\s*10\\s*,', detail: 'числа должны стоять через запятую вне кавычек' },
        ],
      },
    ],
  },

  {
    id: 'py-vars',
    tier: 'python',
    title: 'Коробки с именами',
    subtitle: 'Сохрани значение и переиспользуй его',
    skill: 'переменные',
    sprint: {
      idea: 'Знак <code>=</code> кладёт значение в коробку с именем: <code>name = "Ада"</code>. После этого имя можно использовать вместо самого значения сколько угодно раз.',
    },
    deep: {
      theory: 'Переменная — это имя, привязанное к значению. Запись <code>name = "Ада"</code> читается справа налево: сначала Python вычисляет то, что справа, потом привязывает результат к имени слева. Знак <code>=</code> здесь не «равно» из математики, а «положи в». Имя можно переприсвоить в любой момент — тогда старое значение просто теряется. Имена пишут латиницей, маленькими буквами, слова разделяют подчёркиванием: <code>total_count</code>.',
      where: 'Любые данные в программе живут в переменных: ответ сервера, счётчик ошибок, имя файла. Хороший разработчик тратит время на имена, потому что имя переменной — это половина документации.',
      pitfall: 'Использовать переменную до того, как она создана. Python читает файл сверху вниз и сообщит <code>NameError</code>, если имя ещё не встречалось.',
      examples: [
        { code: 'passed = 7\ntotal = 10\nprint(passed)', note: 'Две коробки и печать содержимого первой.' },
        { code: 'count = 1\ncount = count + 1\nprint(count)', note: 'Справа вычисляется 1 + 1, результат снова кладётся в count. Напечатается 2.' },
      ],
    },
    tasks: [
      {
        id: 'a', xp: 20, file: 'agent.py',
        brief: 'Создай переменную <code>agent_name</code> со значением <code>Q-Bot</code> и выведи её.',
        starter: 'agent_name = \nprint(agent_name)',
        hint: 'Значение — текст, значит нужны кавычки: agent_name = "Q-Bot"',
        solution: 'agent_name = "Q-Bot"\nprint(agent_name)',
        checks: [
          { label: 'Переменная agent_name хранит «Q-Bot»', kind: 'var', name: 'agent_name', equals: 'Q-Bot' },
          { label: 'Значение выведено в терминал', kind: 'stdout', mode: 'contains', value: 'Q-Bot' },
        ],
      },
      {
        id: 'b', xp: 25, file: 'counter.py',
        brief: 'В переменной <code>errors</code> лежит 3. Увеличь её на единицу, не вписывая число 4 руками, и выведи результат.',
        starter: 'errors = 3\n\n# увеличь errors на 1\n\nprint(errors)',
        hint: 'errors = errors + 1',
        solution: 'errors = 3\nerrors = errors + 1\nprint(errors)',
        checks: [
          { label: 'errors стало равно 4', kind: 'var', name: 'errors', equals: 4 },
          { label: 'Число 4 не вписано вручную', kind: 'source', pattern: '=\\s*4\\s*$', absent: true, detail: 'нужно прибавить единицу, а не присвоить 4' },
          { label: 'Результат выведен', kind: 'stdout', mode: 'contains', value: '4' },
        ],
      },
      {
        id: 'c', xp: 30, file: 'swap.py',
        brief: 'В <code>first</code> лежит «Ада», в <code>second</code> — «Грейс». Поменяй значения местами и выведи их в одну строку через запятую.',
        starter: 'first = "Ада"\nsecond = "Грейс"\n\n# поменяй местами\n\nprint(first, second)',
        hint: 'Понадобится третья переменная для временного хранения — или приём Python: first, second = second, first',
        solution: 'first = "Ада"\nsecond = "Грейс"\nfirst, second = second, first\nprint(first, second)',
        checks: [
          { label: 'first теперь «Грейс»', kind: 'var', name: 'first', equals: 'Грейс' },
          { label: 'second теперь «Ада»', kind: 'var', name: 'second', equals: 'Ада' },
          { label: 'Выведено «Грейс Ада»', kind: 'stdout', mode: 'equals', value: 'Грейс Ада' },
        ],
      },
    ],
  },

  {
    id: 'py-numbers',
    tier: 'python',
    title: 'Считалка',
    subtitle: 'Арифметика и проценты',
    skill: 'числа',
    sprint: {
      idea: 'Python считает как калькулятор: <code>+ - * /</code>. Деление <code>/</code> всегда даёт дробь, а <code>//</code> — целую часть. Остаток от деления даёт <code>%</code>.',
    },
    deep: {
      theory: 'Целые числа (<code>int</code>) и дробные (<code>float</code>) — разные типы, но считаются вместе без хлопот. Обычное деление <code>7 / 2</code> даёт <code>3.5</code> даже когда делится нацело: <code>4 / 2</code> — это <code>2.0</code>. Целочисленное деление <code>7 // 2</code> даёт <code>3</code>, а остаток <code>7 % 2</code> — <code>1</code>. Порядок действий как в школе, скобки его меняют. Функция <code>round(x, 1)</code> округляет до нужного числа знаков.',
      where: 'Проценты пройденных тестов, средняя длительность запроса, размер страницы данных, проверка «каждый третий элемент». Остаток от деления — рабочая лошадка: по нему определяют чётность и цикличность.',
      pitfall: 'Делить на ноль и получать <code>ZeroDivisionError</code>. Если делитель приходит извне, его сначала проверяют.',
      examples: [
        { code: 'print(7 / 2, 7 // 2, 7 % 2)', note: 'Напечатает 3.5 3 1 — три разных вопроса к одной паре чисел.' },
        { code: 'print(round(2 / 3 * 100, 1))', note: 'Доля в процентах, округлённая до одного знака: 66.7.' },
      ],
    },
    tasks: [
      {
        id: 'a', xp: 25, file: 'percent.py',
        brief: 'Пройдено <code>passed = 7</code> тестов из <code>total = 10</code>. Посчитай <code>percent</code> — сколько это процентов — и выведи результат.',
        starter: 'passed = 7\ntotal = 10\n\npercent = \nprint(percent)',
        hint: 'Доля — это passed / total, проценты — умножить на 100.',
        solution: 'passed = 7\ntotal = 10\npercent = passed / total * 100\nprint(percent)',
        checks: [
          { label: 'percent равен 70', kind: 'var', name: 'percent', equals: 70, approx: 0.01 },
          { label: 'Число посчитано, а не вписано', kind: 'source', pattern: 'passed\\s*/\\s*total', detail: 'используй переменные passed и total' },
          { label: 'Результат выведен', kind: 'stdout', mode: 'contains', value: '70' },
        ],
      },
      {
        id: 'b', xp: 25, file: 'pages.py',
        brief: 'В отчёте <code>items = 47</code> строк, на страницу помещается <code>per_page = 10</code>. Посчитай <code>full_pages</code> — сколько страниц заполнено целиком — и <code>rest</code> — сколько строк останется.',
        starter: 'items = 47\nper_page = 10\n\nfull_pages = \nrest = \n\nprint(full_pages, rest)',
        hint: 'Целая часть — это //, остаток — это %.',
        solution: 'items = 47\nper_page = 10\nfull_pages = items // per_page\nrest = items % per_page\nprint(full_pages, rest)',
        checks: [
          { label: 'full_pages равно 4', kind: 'var', name: 'full_pages', equals: 4 },
          { label: 'rest равно 7', kind: 'var', name: 'rest', equals: 7 },
          { label: 'Выведено «4 7»', kind: 'stdout', mode: 'equals', value: '4 7' },
        ],
      },
      {
        id: 'c', xp: 30, file: 'latency.py',
        brief: 'Три замера времени ответа: 120, 180 и 240 миллисекунд. Посчитай среднее в переменной <code>average</code> и выведи его округлённым до одного знака после запятой.',
        starter: 'a = 120\nb = 180\nc = 240\n\naverage = \nprint()',
        hint: 'Сумму раздели на 3, а печатать можно round(average, 1).',
        solution: 'a = 120\nb = 180\nc = 240\naverage = (a + b + c) / 3\nprint(round(average, 1))',
        checks: [
          { label: 'average равно 180', kind: 'var', name: 'average', equals: 180, approx: 0.01 },
          { label: 'Сумма поделена на 3 в коде', kind: 'source', pattern: '/\\s*3', detail: 'среднее считается делением суммы на количество' },
          { label: 'Выведено 180.0', kind: 'stdout', mode: 'contains', value: '180' },
        ],
      },
    ],
  },

  {
    id: 'py-strings',
    tier: 'python',
    title: 'Работа с текстом',
    subtitle: 'Собрать, очистить, привести к порядку',
    skill: 'строки и f-строки',
    sprint: {
      idea: 'Строку можно склеить плюсом, а удобнее — вставить значение прямо внутрь: <code>f"Привет, {name}"</code>. Методы <code>.strip()</code> и <code>.lower()</code> возвращают новую очищенную строку.',
    },
    deep: {
      theory: 'Строка — это текст. Склеить две строки можно плюсом, но f-строка читается лучше: перед кавычками ставится буква <code>f</code>, а внутри в фигурных скобках пишется любое выражение — <code>f"пройдено {passed} из {total}"</code>. У строк есть методы: <code>.strip()</code> убирает пробелы по краям, <code>.lower()</code> и <code>.upper()</code> меняют регистр, <code>.replace("а", "б")</code> заменяет подстроку. Важное свойство: методы не меняют исходную строку, а возвращают новую — результат надо куда-то присвоить.',
      where: 'Чистка пользовательского ввода, сборка сообщений об ошибках, нормализация данных перед сравнением. Половина багов с текстом — это лишний пробел или другой регистр.',
      pitfall: 'Написать <code>title.strip()</code> и удивиться, что <code>title</code> не изменился. Нужно <code>title = title.strip()</code>.',
      examples: [
        { code: 'name = "Ада"\nprint(f"Привет, {name}!")', note: 'f-строка подставляет значение прямо в текст.' },
        { code: 'raw = "  Login Broken  "\nprint(raw.strip().lower())', note: 'Методы можно вызывать цепочкой: сначала обрезка, потом регистр.' },
        { code: 'print(f"{2 + 2} и {7 / 2:.1f}")', note: 'Внутри скобок работает любое выражение, а :.1f задаёт один знак после запятой.' },
      ],
    },
    tasks: [
      {
        id: 'a', xp: 25, file: 'greeting.py',
        brief: 'В переменной <code>name</code> лежит «Ада». Собери f-строкой и выведи <code>Привет, Ада! Готова к работе.</code>',
        starter: 'name = "Ада"\n\nprint()',
        hint: 'print(f"Привет, {name}! Готова к работе.")',
        solution: 'name = "Ада"\nprint(f"Привет, {name}! Готова к работе.")',
        checks: [
          { label: 'Строка собрана правильно', kind: 'stdout', mode: 'equals', value: 'Привет, Ада! Готова к работе.' },
          { label: 'Использована f-строка с {name}', kind: 'source', pattern: 'f["\'][^"\']*\\{\\s*name\\s*\\}', detail: 'имя должно подставляться, а не быть вписано текстом' },
        ],
      },
      {
        id: 'b', xp: 25, file: 'clean.py',
        brief: 'Очисти <code>raw_title</code> от пробелов по краям и приведи к нижнему регистру, сохранив результат в <code>title</code>.',
        starter: 'raw_title = "   Кнопка Входа Сломана   "\n\ntitle = \nprint(title)',
        hint: 'Методы можно соединить: raw_title.strip().lower()',
        solution: 'raw_title = "   Кнопка Входа Сломана   "\ntitle = raw_title.strip().lower()\nprint(title)',
        checks: [
          { label: 'title очищен и приведён к нижнему регистру', kind: 'var', name: 'title', equals: 'кнопка входа сломана' },
          { label: 'Исходная строка не изменилась', kind: 'py', expr: 'raw_title.startswith("   ")', detail: 'raw_title должен остаться прежним' },
        ],
      },
      {
        id: 'c', xp: 30, file: 'summary.py',
        brief: 'Собери строку отчёта в переменной <code>summary</code>: <code>отчёт: 7 из 10 (70.0%)</code>. Процент посчитай, а не вписывай.',
        starter: 'passed = 7\ntotal = 10\n\nsummary = \nprint(summary)',
        hint: 'Внутри f-строки можно считать: {passed / total * 100} — а формат :.1f оставит один знак.',
        solution: 'passed = 7\ntotal = 10\nsummary = f"отчёт: {passed} из {total} ({passed / total * 100:.1f}%)"\nprint(summary)',
        checks: [
          { label: 'Строка собрана точно', kind: 'var', name: 'summary', equals: 'отчёт: 7 из 10 (70.0%)' },
          { label: 'Процент посчитан в коде', kind: 'source', pattern: 'passed\\s*/\\s*total', detail: 'значение 70.0 должно вычисляться' },
        ],
      },
    ],
  },

  {
    id: 'py-types',
    tier: 'python',
    title: 'Паспорт значения',
    subtitle: 'Типы и преобразования',
    skill: 'int, str, float, input',
    sprint: {
      idea: 'У каждого значения есть тип: <code>str</code> — текст, <code>int</code> — целое, <code>float</code> — дробное. Всё, что пришло снаружи (в том числе из <code>input()</code>), приходит текстом, и для арифметики его надо превратить в число через <code>int()</code>.',
    },
    deep: {
      theory: 'Тип определяет, что со значением можно делать. <code>"5" + "5"</code> даёт <code>"55"</code>, а <code>5 + 5</code> даёт <code>10</code> — одинаковые на вид данные ведут себя по-разному. Узнать тип можно функцией <code>type(x)</code>. Преобразования делают функции с именами типов: <code>int("42")</code>, <code>float("3.14")</code>, <code>str(42)</code>. Функция <code>input()</code> читает строку и всегда возвращает <code>str</code>, даже если человек ввёл число.',
      where: 'Данные из форм, файлов, JSON и переменных окружения приходят строками. Первое, что делает программа, — приводит их к нужному типу и проверяет, что преобразование удалось.',
      pitfall: 'Сложить строку с числом и получить <code>TypeError</code>, либо забыть <code>int()</code> вокруг <code>input()</code> и получить склейку вместо суммы.',
      examples: [
        { code: 'print(type("5"), type(5), type(5.0))', note: 'Три разных типа: str, int и float.' },
        { code: 'raw = "42"\nprint(int(raw) + 8)', note: 'Сначала превращаем текст в число, потом считаем: 50.' },
        { code: 'print("код: " + str(404))', note: 'Обратное преобразование: число в текст, чтобы склеить со строкой.' },
      ],
    },
    tasks: [
      {
        id: 'a', xp: 25, file: 'convert.py',
        brief: 'В <code>raw</code> лежит текст <code>"200"</code>. Преврати его в число в переменной <code>code</code> и выведи <code>code + 1</code>.',
        starter: 'raw = "200"\n\ncode = \nprint(code + 1)',
        hint: 'code = int(raw)',
        solution: 'raw = "200"\ncode = int(raw)\nprint(code + 1)',
        checks: [
          { label: 'code — целое число 200', kind: 'var', name: 'code', equals: 200 },
          { label: 'Тип действительно int', kind: 'var', name: 'code', type: 'int' },
          { label: 'Выведено 201', kind: 'stdout', mode: 'contains', value: '201' },
        ],
      },
      {
        id: 'b', xp: 30, file: 'ask.py',
        brief: 'Программа спрашивает возраст через <code>input()</code>. Преврати ответ в число и выведи <code>через 10 лет будет 27</code>. В терминал уже подставлен ответ «17».',
        starter: 'raw = input("Сколько тебе лет? ")\n\n# преврати в число и посчитай\n',
        stdin: ['17'],
        hint: 'age = int(raw), а дальше f-строка с age + 10.',
        solution: 'raw = input("Сколько тебе лет? ")\nage = int(raw)\nprint(f"через 10 лет будет {age + 10}")',
        checks: [
          { label: 'Ответ преобразован в число', kind: 'source', pattern: 'int\\s*\\(', detail: 'нужен int() вокруг ответа' },
          { label: 'Выведено «через 10 лет будет 27»', kind: 'stdout', mode: 'contains', value: 'через 10 лет будет 27' },
        ],
      },
      {
        id: 'c', xp: 30, file: 'mixed.py',
        brief: 'Собери строку <code>заявка №128 на сумму 990.5</code> из числовых переменных, не используя f-строку — только склейку через плюс и <code>str()</code>.',
        starter: 'number = 128\namount = 990.5\n\nline = \nprint(line)',
        hint: '"заявка №" + str(number) + " на сумму " + str(amount)',
        solution: 'number = 128\namount = 990.5\nline = "заявка №" + str(number) + " на сумму " + str(amount)\nprint(line)',
        checks: [
          { label: 'Строка собрана верно', kind: 'var', name: 'line', equals: 'заявка №128 на сумму 990.5' },
          { label: 'Использован str() и склейка', kind: 'source', pattern: 'str\\s*\\(', detail: 'числа нужно превратить в текст явно' },
          { label: 'f-строка не использована', kind: 'source', pattern: 'f["\']', absent: true, detail: 'в этой задаче тренируем ручную склейку' },
        ],
      },
    ],
  },

  {
    id: 'py-bool',
    tier: 'python',
    title: 'Правда и ложь',
    subtitle: 'Сравнения и логический тип',
    skill: 'bool, сравнения',
    sprint: {
      idea: 'Сравнение даёт ответ «да» или «нет»: <code>5 > 3</code> — это <code>True</code>, <code>5 == 3</code> — это <code>False</code>. Двойное равно <code>==</code> сравнивает, одинарное <code>=</code> присваивает.',
    },
    deep: {
      theory: 'Тип <code>bool</code> имеет ровно два значения: <code>True</code> и <code>False</code>, с большой буквы. Их производят операторы сравнения: <code>==</code> (равно), <code>!=</code> (не равно), <code>&gt;</code>, <code>&lt;</code>, <code>&gt;=</code>, <code>&lt;=</code>. Сравнения можно связывать цепочкой по-человечески: <code>200 &lt;= code &lt; 300</code>. Оператор <code>in</code> проверяет вхождение: <code>"ошибка" in text</code>. Результат сравнения — обычное значение, его можно положить в переменную и передать дальше.',
      where: 'Любая проверка в тесте заканчивается булевым значением: ожидание совпало или нет. Из таких значений собираются условия, фильтры и утверждения автотестов.',
      pitfall: 'Написать <code>=</code> вместо <code>==</code> в проверке. Python на этом остановится с синтаксической ошибкой — и это лучший исход, чем молча неверная логика.',
      examples: [
        { code: 'code = 404\nprint(code == 200, code != 200)', note: 'Напечатает False True.' },
        { code: 'code = 201\nprint(200 <= code < 300)', note: 'Цепочка сравнений: True, код в диапазоне успешных.' },
        { code: 'log = "connection refused"\nprint("refused" in log)', note: 'Оператор in ищет подстроку: True.' },
      ],
    },
    tasks: [
      {
        id: 'a', xp: 25, file: 'compare.py',
        brief: 'Сохрани в <code>is_ok</code> ответ на вопрос «код ответа равен 200?» и выведи его.',
        starter: 'status_code = 404\n\nis_ok = \nprint(is_ok)',
        hint: 'is_ok = status_code == 200',
        solution: 'status_code = 404\nis_ok = status_code == 200\nprint(is_ok)',
        checks: [
          { label: 'is_ok равен False', kind: 'var', name: 'is_ok', equals: false },
          { label: 'Тип — булев', kind: 'var', name: 'is_ok', type: 'bool' },
          { label: 'Сравнение записано через ==', kind: 'source', pattern: '==\\s*200', detail: 'нужен оператор сравнения' },
        ],
      },
      {
        id: 'b', xp: 25, file: 'range.py',
        brief: 'Проверь, попадает ли <code>status_code</code> в диапазон успешных ответов от 200 до 299 включительно. Результат положи в <code>is_success</code>.',
        starter: 'status_code = 201\n\nis_success = \nprint(is_success)',
        hint: 'Цепочка читается как в математике: 200 <= status_code < 300',
        solution: 'status_code = 201\nis_success = 200 <= status_code < 300\nprint(is_success)',
        checks: [
          { label: 'is_success равен True', kind: 'var', name: 'is_success', equals: true },
          { label: 'Проверяется весь диапазон, а не одно значение', kind: 'source', pattern: '300|299', detail: 'верхняя граница должна участвовать в проверке' },
        ],
      },
      {
        id: 'c', xp: 30, file: 'search.py',
        brief: 'В <code>log</code> лежит строка лога. Положи в <code>has_error</code> ответ на вопрос «встречается ли в логе слово timeout?», не обращая внимания на регистр.',
        starter: 'log = "GET /api/users 200\\nPOST /api/pay TIMEOUT"\n\nhas_error = \nprint(has_error)',
        hint: 'Сначала приведи лог к нижнему регистру, потом ищи через in.',
        solution: 'log = "GET /api/users 200\\nPOST /api/pay TIMEOUT"\nhas_error = "timeout" in log.lower()\nprint(has_error)',
        checks: [
          { label: 'has_error равен True', kind: 'var', name: 'has_error', equals: true },
          { label: 'Использован оператор in', kind: 'source', pattern: '\\bin\\b', detail: 'поиск подстроки делается через in' },
          { label: 'Регистр приведён к одному виду', kind: 'source', pattern: '\\.lower\\s*\\(|\\.upper\\s*\\(', detail: 'нужно сравнивать без учёта регистра' },
        ],
      },
    ],
  },

  {
    id: 'py-if',
    tier: 'python',
    title: 'Развилка',
    subtitle: 'Программа принимает решение',
    skill: 'if / elif / else',
    sprint: {
      idea: '<code>if условие:</code> выполняет блок, когда условие истинно, <code>else:</code> — в остальных случаях. Строки внутри блока сдвигаются на четыре пробела — по отступу Python понимает, что относится к развилке.',
    },
    deep: {
      theory: 'Конструкция начинается со слова <code>if</code>, дальше идёт условие и обязательное двоеточие. Следующие строки, сдвинутые вправо, — тело блока: они выполнятся, только если условие истинно. Ветка <code>elif</code> (сокращение от else if) проверяет следующее условие, если предыдущие не подошли; их может быть сколько угодно. Ветка <code>else</code> идёт последней и срабатывает, когда ни одно условие не подошло. Python проверяет ветки сверху вниз и останавливается на первой сработавшей.',
      where: 'Обработка разных ответов сервера, ветвление бизнес-логики, выбор сообщения об ошибке. В автотестах — решение, считать результат успехом или падением.',
      pitfall: 'Забыть двоеточие или сбить отступ. Ещё частая ошибка — порядок веток: если сначала проверить <code>code >= 200</code>, ветка для 404 уже не сработает.',
      examples: [
        { code: 'code = 404\nif code == 200:\n    print("ок")\nelse:\n    print("не ок")', note: 'Две ветки, отступ в четыре пробела.' },
        { code: 'code = 500\nif code < 300:\n    print("успех")\nelif code < 500:\n    print("ошибка клиента")\nelse:\n    print("ошибка сервера")', note: 'Порядок важен: проверки идут от узкой к широкой.' },
      ],
    },
    tasks: [
      {
        id: 'a', xp: 30, file: 'gate.py',
        brief: 'Если <code>status_code</code> равен 200 — выведи <code>ДОСТУП РАЗРЕШЁН</code>, иначе — <code>ДОСТУП ЗАПРЕЩЁН</code>.',
        starter: 'status_code = 403\n\n# напиши развилку\n',
        hint: 'if status_code == 200: — потом с отступом print, затем else: и второй print.',
        solution: 'status_code = 403\nif status_code == 200:\n    print("ДОСТУП РАЗРЕШЁН")\nelse:\n    print("ДОСТУП ЗАПРЕЩЁН")',
        checks: [
          { label: 'Для кода 403 выведено «ДОСТУП ЗАПРЕЩЁН»', kind: 'stdout', mode: 'equals', value: 'ДОСТУП ЗАПРЕЩЁН' },
          { label: 'Есть ветка if', kind: 'source', pattern: '^\\s*if\\s+', detail: 'нужна конструкция if' },
          { label: 'Есть ветка else', kind: 'source', pattern: '^\\s*else\\s*:', detail: 'нужна вторая ветка' },
        ],
      },
      {
        id: 'b', xp: 35, file: 'triage.py',
        brief: 'Разбери <code>status_code</code> на три случая: меньше 300 — <code>успех</code>, меньше 500 — <code>ошибка клиента</code>, остальное — <code>ошибка сервера</code>. Проверь на коде 500.',
        starter: 'status_code = 500\n\n# три ветки\n',
        hint: 'Порядок веток: сначала самая узкая проверка, elif для средней, else для остального.',
        solution: 'status_code = 500\nif status_code < 300:\n    print("успех")\nelif status_code < 500:\n    print("ошибка клиента")\nelse:\n    print("ошибка сервера")',
        checks: [
          { label: 'Для 500 выведено «ошибка сервера»', kind: 'stdout', mode: 'equals', value: 'ошибка сервера' },
          { label: 'Использован elif', kind: 'source', pattern: '^\\s*elif\\s+', detail: 'средний случай проверяется через elif' },
          { label: 'Все три ветки на месте', kind: 'source', pattern: 'ошибка клиента', detail: 'ветка для клиентских ошибок должна существовать' },
        ],
      },
      {
        id: 'c', xp: 35, file: 'severity.py',
        brief: 'По числу <code>severity</code> выведи метку: 5 — <code>блокер</code>, 4 — <code>критично</code>, 3 — <code>важно</code>, всё остальное — <code>мелочь</code>. Проверь на severity = 4.',
        starter: 'severity = 4\n\n',
        hint: 'Четыре ветки: if, два elif и else.',
        solution: 'severity = 4\nif severity == 5:\n    print("блокер")\nelif severity == 4:\n    print("критично")\nelif severity == 3:\n    print("важно")\nelse:\n    print("мелочь")',
        checks: [
          { label: 'Для severity = 4 выведено «критично»', kind: 'stdout', mode: 'equals', value: 'критично' },
          { label: 'Ветки для 5 и 3 тоже описаны', kind: 'source', pattern: 'блокер[\\s\\S]*важно', detail: 'нужны все четыре случая' },
          { label: 'Есть завершающий else', kind: 'source', pattern: '^\\s*else\\s*:', detail: 'остальные значения тоже нужно обработать' },
        ],
      },
    ],
  },

  {
    id: 'py-logic',
    tier: 'python',
    title: 'Несколько условий сразу',
    subtitle: 'and, or, not',
    skill: 'логические операторы',
    sprint: {
      idea: '<code>and</code> требует, чтобы верны были оба условия, <code>or</code> — хотя бы одно, <code>not</code> переворачивает ответ. Условия удобно брать в скобки, чтобы не гадать о порядке.',
    },
    deep: {
      theory: 'Оператор <code>and</code> даёт <code>True</code>, только когда истинны обе части. Оператор <code>or</code> даёт <code>True</code>, когда истинна хотя бы одна. Оператор <code>not</code> меняет значение на противоположное. Python вычисляет их лениво: в <code>a and b</code> вторая часть не считается, если первая уже ложна — это позволяет писать безопасные проверки вида <code>text and text.strip()</code>. Приоритет: сначала <code>not</code>, потом <code>and</code>, потом <code>or</code>; скобки убирают любые сомнения.',
      where: 'Правила доступа («вошёл и подтвердил почту»), фильтры данных, критерии автотеста, где результат зависит сразу от нескольких признаков.',
      pitfall: 'Написать <code>if code == 200 or 201:</code>. Python поймёт это как «code равен 200, или число 201» — и второе всегда истинно. Правильно: <code>code == 200 or code == 201</code>, а лучше <code>code in (200, 201)</code>.',
      examples: [
        { code: 'logged_in = True\nverified = False\nprint(logged_in and verified)', note: 'False: нужно и то, и другое.' },
        { code: 'code = 201\nprint(code in (200, 201, 204))', note: 'Проверка на принадлежность списку значений — короче цепочки or.' },
      ],
    },
    tasks: [
      {
        id: 'a', xp: 30, file: 'access.py',
        brief: 'Доступ открыт, только если человек вошёл (<code>logged_in</code>) и подтвердил почту (<code>verified</code>). Положи ответ в <code>can_enter</code> и выведи его.',
        starter: 'logged_in = True\nverified = False\n\ncan_enter = \nprint(can_enter)',
        hint: 'can_enter = logged_in and verified',
        solution: 'logged_in = True\nverified = False\ncan_enter = logged_in and verified\nprint(can_enter)',
        checks: [
          { label: 'can_enter равен False', kind: 'var', name: 'can_enter', equals: false },
          { label: 'Использован оператор and', kind: 'source', pattern: '\\band\\b', detail: 'условия объединяются через and' },
        ],
      },
      {
        id: 'b', xp: 30, file: 'retry.py',
        brief: 'Запрос стоит повторить, если код ответа 429 или 503. Положи ответ в <code>should_retry</code>. Проверь на коде 503.',
        starter: 'status_code = 503\n\nshould_retry = \nprint(should_retry)',
        hint: 'Либо два сравнения через or, либо короче: status_code in (429, 503)',
        solution: 'status_code = 503\nshould_retry = status_code in (429, 503)\nprint(should_retry)',
        checks: [
          { label: 'should_retry равен True', kind: 'var', name: 'should_retry', equals: true },
          { label: 'Оба кода участвуют в проверке', kind: 'source', pattern: '429[\\s\\S]*503|503[\\s\\S]*429', detail: 'нужны оба значения' },
          { label: 'Ошибки «or 503» без сравнения нет', kind: 'source', pattern: 'or\\s+\\d+\\s*[:\\n]', absent: true, detail: 'каждое условие сравнивается отдельно' },
        ],
      },
      {
        id: 'c', xp: 35, file: 'valid.py',
        brief: 'Заявка проходит проверку, если <code>title</code> не пустой после очистки И <code>severity</code> от 1 до 5. Положи ответ в <code>is_valid</code> и выведи <code>принято</code> или <code>отклонено</code>.',
        starter: 'title = "   "\nseverity = 3\n\nis_valid = \n\n',
        hint: 'Пустая строка после strip() ложна сама по себе, так что достаточно title.strip() and 1 <= severity <= 5.',
        solution: 'title = "   "\nseverity = 3\nis_valid = bool(title.strip()) and 1 <= severity <= 5\nif is_valid:\n    print("принято")\nelse:\n    print("отклонено")',
        checks: [
          { label: 'Пустой заголовок не проходит проверку', kind: 'py', expr: 'not is_valid', detail: 'строка из пробелов считается пустой' },
          { label: 'Выведено «отклонено»', kind: 'stdout', mode: 'equals', value: 'отклонено' },
          { label: 'Диапазон severity проверяется', kind: 'source', pattern: '5', detail: 'верхняя граница severity должна участвовать' },
        ],
      },
    ],
  },

  {
    id: 'py-list',
    tier: 'python',
    title: 'Список',
    subtitle: 'Много значений под одним именем',
    skill: 'list, индексы, срезы',
    sprint: {
      idea: 'Список хранит значения по порядку: <code>codes = [200, 404, 500]</code>. Обращаются по номеру с нуля: <code>codes[0]</code> — первый, <code>codes[-1]</code> — последний. Метод <code>.append(x)</code> добавляет элемент в конец.',
    },
    deep: {
      theory: 'Список записывается в квадратных скобках, элементы разделяются запятыми, типы могут быть любыми. Нумерация начинается с нуля: у списка из трёх элементов индексы 0, 1 и 2, а <code>codes[3]</code> вызовет <code>IndexError</code>. Отрицательные индексы считают с конца: <code>-1</code> — последний. Срез <code>codes[1:3]</code> берёт кусок от первого индекса включительно до второго исключительно. Длину даёт <code>len(codes)</code>. Список изменяемый: <code>.append()</code> добавляет в конец, <code>.remove(x)</code> удаляет первое совпадение, <code>.sort()</code> сортирует на месте.',
      where: 'Наборы тестовых данных, очередь задач, список ответов API, накопление результатов в цикле. Почти любая обработка данных начинается со списка.',
      pitfall: 'Считать, что первый элемент имеет номер 1. И ещё: <code>.sort()</code> ничего не возвращает, он меняет сам список — <code>result = codes.sort()</code> положит в result значение <code>None</code>.',
      examples: [
        { code: 'codes = [200, 404, 500]\nprint(codes[0], codes[-1], len(codes))', note: 'Напечатает 200 500 3.' },
        { code: 'queue = []\nqueue.append("баг 1")\nqueue.append("баг 2")\nprint(queue)', note: 'Пустой список постепенно наполняется.' },
        { code: 'nums = [3, 1, 2]\nnums.sort()\nprint(nums)', note: 'Сортировка меняет сам список: [1, 2, 3].' },
      ],
    },
    tasks: [
      {
        id: 'a', xp: 30, file: 'codes.py',
        brief: 'В списке <code>codes</code> лежат три кода ответа. Выведи первый и последний в одну строку.',
        starter: 'codes = [200, 404, 500]\n\nprint()',
        hint: 'print(codes[0], codes[-1])',
        solution: 'codes = [200, 404, 500]\nprint(codes[0], codes[-1])',
        checks: [
          { label: 'Выведено «200 500»', kind: 'stdout', mode: 'equals', value: '200 500' },
          { label: 'Использовано обращение по индексу', kind: 'source', pattern: 'codes\\s*\\[', detail: 'значения нужно брать из списка, а не вписывать' },
        ],
      },
      {
        id: 'b', xp: 30, file: 'queue.py',
        brief: 'Создай пустой список <code>queue</code>, добавь в него по очереди <code>вход</code>, <code>оплата</code>, <code>отчёт</code> и выведи количество задач и весь список.',
        starter: 'queue = \n\n\nprint(len(queue), queue)',
        hint: 'queue = [] и три вызова queue.append(...)',
        solution: 'queue = []\nqueue.append("вход")\nqueue.append("оплата")\nqueue.append("отчёт")\nprint(len(queue), queue)',
        checks: [
          { label: 'В очереди три задачи в нужном порядке', kind: 'var', name: 'queue', equals: ['вход', 'оплата', 'отчёт'] },
          { label: 'Элементы добавлены через append', kind: 'source', pattern: '\\.append\\s*\\(', detail: 'список наполняется методом append' },
        ],
      },
      {
        id: 'c', xp: 35, file: 'slice.py',
        brief: 'Из списка <code>durations</code> возьми срезом три средних значения (со второго по четвёртое) в переменную <code>middle</code>, отсортируй его по возрастанию и выведи.',
        starter: 'durations = [820, 120, 340, 210, 990]\n\nmiddle = \n\nprint(middle)',
        hint: 'Срез durations[1:4], затем middle.sort() отдельной строкой.',
        solution: 'durations = [820, 120, 340, 210, 990]\nmiddle = durations[1:4]\nmiddle.sort()\nprint(middle)',
        checks: [
          { label: 'middle содержит [120, 210, 340]', kind: 'var', name: 'middle', equals: [120, 210, 340] },
          { label: 'Использован срез', kind: 'source', pattern: '\\[\\s*1\\s*:\\s*4\\s*\\]', detail: 'нужен срез durations[1:4]' },
          { label: 'Исходный список не отсортирован', kind: 'py', expr: 'durations[0] == 820', detail: 'срез создаёт новый список' },
        ],
      },
    ],
  },

  {
    id: 'py-for',
    tier: 'python',
    title: 'Повтор',
    subtitle: 'Цикл for проходит по данным',
    skill: 'for, range',
    sprint: {
      idea: '<code>for item in items:</code> выполняет блок для каждого элемента по очереди. Чтобы повторить действие n раз, берут <code>for i in range(n):</code>.',
    },
    deep: {
      theory: 'Цикл <code>for</code> перебирает коллекцию: на каждом шаге переменная получает очередной элемент, и выполняется тело цикла — строки с отступом. Функция <code>range(5)</code> даёт числа от 0 до 4, <code>range(1, 6)</code> — от 1 до 5: верхняя граница не включается. Часто внутри цикла копят результат: заводят переменную до цикла и меняют её внутри. Компактная запись <code>[x * 2 for x in nums]</code> — списковое включение — создаёт новый список за одну строку.',
      where: 'Обработка каждой строки файла, каждого ответа API, каждого тестового случая. Всё, что делается «для каждого», делается циклом.',
      pitfall: 'Создать переменную-накопитель внутри цикла — тогда она будет обнуляться на каждом шаге. Накопитель объявляют до цикла.',
      examples: [
        { code: 'for code in [200, 404]:\n    print(code)', note: 'Две итерации, на каждой печатается свой код.' },
        { code: 'total = 0\nfor n in [1, 2, 3]:\n    total = total + n\nprint(total)', note: 'Накопитель объявлен до цикла: напечатает 6.' },
        { code: 'print([n * 2 for n in [1, 2, 3]])', note: 'Списковое включение: [2, 4, 6].' },
      ],
    },
    tasks: [
      {
        id: 'a', xp: 30, file: 'loop.py',
        brief: 'Пройди циклом по списку <code>steps</code> и выведи каждый шаг на отдельной строке.',
        starter: 'steps = ["открыть форму", "ввести данные", "отправить"]\n\n',
        hint: 'for step in steps: — и с отступом print(step)',
        solution: 'steps = ["открыть форму", "ввести данные", "отправить"]\nfor step in steps:\n    print(step)',
        checks: [
          { label: 'Все три шага выведены по порядку', kind: 'stdout', mode: 'lines', value: ['открыть форму', 'ввести данные', 'отправить'] },
          { label: 'Использован цикл for', kind: 'source', pattern: '^\\s*for\\s+\\w+\\s+in\\s+steps', detail: 'нужен цикл по списку steps' },
        ],
      },
      {
        id: 'b', xp: 35, file: 'sum.py',
        brief: 'Посчитай циклом, сколько всего миллисекунд заняли все запросы из списка <code>durations</code>. Результат положи в <code>total</code>.',
        starter: 'durations = [120, 340, 210, 90]\n\ntotal = \n\n\nprint(total)',
        hint: 'total = 0 до цикла, внутри цикла total = total + d',
        solution: 'durations = [120, 340, 210, 90]\ntotal = 0\nfor d in durations:\n    total = total + d\nprint(total)',
        checks: [
          { label: 'total равен 760', kind: 'var', name: 'total', equals: 760 },
          { label: 'Сумма посчитана циклом', kind: 'source', pattern: '^\\s*for\\s+', detail: 'в этой задаче тренируем цикл' },
          { label: 'Результат выведен', kind: 'stdout', mode: 'contains', value: '760' },
        ],
      },
      {
        id: 'c', xp: 35, file: 'filter.py',
        brief: 'Оставь из <code>priorities</code> только значения 3 и выше в новом списке <code>critical</code>. Выведи его.',
        starter: 'priorities = [1, 4, 2, 5, 3]\n\ncritical = \n\nprint(critical)',
        hint: 'Можно циклом с append, а можно одной строкой: [p for p in priorities if p >= 3]',
        solution: 'priorities = [1, 4, 2, 5, 3]\ncritical = [p for p in priorities if p >= 3]\nprint(critical)',
        checks: [
          { label: 'critical равен [4, 5, 3]', kind: 'var', name: 'critical', equals: [4, 5, 3] },
          { label: 'Условие отбора записано в коде', kind: 'source', pattern: '>=\\s*3|>\\s*2', detail: 'элементы отбираются условием' },
          { label: 'Исходный список не изменился', kind: 'py', expr: 'len(priorities) == 5', detail: 'нужен новый список, а не удаление из старого' },
        ],
      },
    ],
  },

  {
    id: 'py-while',
    tier: 'python',
    title: 'Пока не готово',
    subtitle: 'Цикл с условием',
    skill: 'while, break',
    sprint: {
      idea: '<code>while условие:</code> повторяет блок, пока условие истинно. Внутри обязательно должно меняться что-то, что рано или поздно сделает условие ложным, иначе цикл не закончится.',
    },
    deep: {
      theory: 'Цикл <code>for</code> знает заранее, сколько будет шагов; <code>while</code> — нет. Он проверяет условие перед каждым повтором и выполняет тело, пока условие истинно. Поэтому внутри тела обязательно должно меняться то, что входит в условие, — счётчик, флаг, накопленное значение. Оператор <code>break</code> досрочно выходит из цикла, <code>continue</code> пропускает остаток текущего шага. Если условие никогда не станет ложным, программа зависнет: здесь такой цикл остановится сам через несколько секунд и покажет ошибку.',
      where: 'Повторные попытки запроса, ожидание готовности сервиса, чтение данных до конца потока, игровой цикл. Везде, где количество шагов зависит от результата.',
      pitfall: 'Забыть изменить счётчик внутри цикла. Условие остаётся истинным навсегда, и программа перестаёт отвечать.',
      examples: [
        { code: 'attempt = 1\nwhile attempt <= 3:\n    print("попытка", attempt)\n    attempt = attempt + 1', note: 'Счётчик растёт внутри цикла — три шага и выход.' },
        { code: 'for code in [500, 500, 200]:\n    if code == 200:\n        print("получилось")\n        break', note: 'break выходит из цикла сразу после успеха.' },
      ],
    },
    tasks: [
      {
        id: 'a', xp: 30, file: 'attempts.py',
        brief: 'Выведи три строки: <code>попытка 1</code>, <code>попытка 2</code>, <code>попытка 3</code> — используя цикл <code>while</code>.',
        starter: 'attempt = 1\n\nwhile :\n    \n',
        hint: 'Условие attempt <= 3, а внутри не забудь attempt = attempt + 1.',
        solution: 'attempt = 1\nwhile attempt <= 3:\n    print("попытка", attempt)\n    attempt = attempt + 1',
        checks: [
          { label: 'Три строки в нужном порядке', kind: 'stdout', mode: 'lines', value: ['попытка 1', 'попытка 2', 'попытка 3'] },
          { label: 'Использован while', kind: 'source', pattern: '^\\s*while\\s+', detail: 'в этой задаче тренируем while' },
        ],
      },
      {
        id: 'b', xp: 35, file: 'retry.py',
        brief: 'В списке <code>responses</code> лежат коды повторных попыток. Пройди их циклом и на первом коде 200 выведи <code>успех с попытки N</code> и прекрати перебор.',
        starter: 'responses = [503, 503, 200, 500]\n\n',
        hint: 'Пригодится enumerate(responses, start=1) и break после печати.',
        solution: 'responses = [503, 503, 200, 500]\nfor number, code in enumerate(responses, start=1):\n    if code == 200:\n        print(f"успех с попытки {number}")\n        break',
        checks: [
          { label: 'Выведено «успех с попытки 3»', kind: 'stdout', mode: 'equals', value: 'успех с попытки 3' },
          { label: 'Перебор прекращён через break', kind: 'source', pattern: '^\\s*break\\b', detail: 'после успеха продолжать не нужно' },
        ],
      },
      {
        id: 'c', xp: 40, file: 'backoff.py',
        brief: 'Пауза между попытками удваивается: 1, 2, 4, 8… Считай <code>delay</code>, пока он не превысит 10, и на каждом шаге печатай <code>ждём N сек</code>. Последним должно быть <code>ждём 8 сек</code>.',
        starter: 'delay = 1\n\nwhile :\n    \n',
        hint: 'Условие delay <= 10, внутри печать и delay = delay * 2.',
        solution: 'delay = 1\nwhile delay <= 10:\n    print(f"ждём {delay} сек")\n    delay = delay * 2',
        checks: [
          { label: 'Четыре строки: 1, 2, 4 и 8 секунд', kind: 'stdout', mode: 'lines', value: ['ждём 1 сек', 'ждём 2 сек', 'ждём 4 сек', 'ждём 8 сек'] },
          { label: 'Пауза удваивается в коде', kind: 'source', pattern: '\\*\\s*2|\\*=\\s*2', detail: 'значение должно умножаться на два' },
        ],
      },
    ],
  },

  {
    id: 'py-dict',
    tier: 'python',
    title: 'Словарь',
    subtitle: 'Значения с именами внутри одной записи',
    skill: 'dict',
    sprint: {
      idea: 'Словарь хранит пары «ключ — значение»: <code>bug = {"title": "вход сломан", "severity": 4}</code>. Значение берут по ключу: <code>bug["title"]</code>.',
    },
    deep: {
      theory: 'Словарь описывает одну сущность: инцидент, пользователя, ответ сервера. Записывается в фигурных скобках, ключ и значение разделяются двоеточием. Значение читается через квадратные скобки: <code>bug["title"]</code> — но если ключа нет, будет <code>KeyError</code>. Безопасный вариант — <code>bug.get("title")</code>: он вернёт <code>None</code> вместо ошибки, а <code>bug.get("title", "без имени")</code> — заданное значение по умолчанию. Новое поле добавляется обычным присваиванием. Метод <code>.items()</code> даёт пары для перебора циклом. Список словарей — самая частая структура данных в реальной работе, ровно так выглядит JSON.',
      where: 'Ответ любого API — это словарь. Конфигурация, запись в базе, тестовые данные — тоже. Умение уверенно ходить по словарям и спискам словарей закрывает большую часть работы с данными.',
      pitfall: 'Обратиться к отсутствующему ключу. В данных извне поля может не быть — используйте <code>.get()</code> или проверку <code>"key" in data</code>.',
      examples: [
        { code: 'bug = {"title": "вход сломан", "severity": 4}\nprint(bug["title"])', note: 'Чтение по ключу.' },
        { code: 'bug = {"title": "вход сломан"}\nbug["status"] = "open"\nprint(bug)', note: 'Новое поле добавляется присваиванием.' },
        { code: 'bug = {"title": "вход сломан"}\nprint(bug.get("owner", "не назначен"))', note: 'get со значением по умолчанию не падает на отсутствующем ключе.' },
      ],
    },
    tasks: [
      {
        id: 'a', xp: 30, file: 'incident.py',
        brief: 'Создай словарь <code>incident</code> с полями <code>title</code> = <code>вход сломан</code>, <code>severity</code> = 4 и <code>status</code> = <code>open</code>. Выведи заголовок.',
        starter: 'incident = \n\nprint()',
        hint: 'incident = {"title": "вход сломан", "severity": 4, "status": "open"}',
        solution: 'incident = {"title": "вход сломан", "severity": 4, "status": "open"}\nprint(incident["title"])',
        checks: [
          { label: 'Все три поля заполнены', kind: 'var', name: 'incident', equals: { title: 'вход сломан', severity: 4, status: 'open' } },
          { label: 'Заголовок прочитан по ключу', kind: 'source', pattern: 'incident\\s*\\[\\s*["\']title["\']\\s*\\]', detail: 'значение нужно брать из словаря' },
          { label: 'Выведено «вход сломан»', kind: 'stdout', mode: 'equals', value: 'вход сломан' },
        ],
      },
      {
        id: 'b', xp: 35, file: 'safe.py',
        brief: 'В <code>response</code> может не быть поля <code>error</code>. Прочитай его безопасно в переменную <code>error</code>, подставив <code>нет ошибки</code>, если поля нет.',
        starter: 'response = {"status": 200, "body": "ok"}\n\nerror = \nprint(error)',
        hint: 'response.get("error", "нет ошибки")',
        solution: 'response = {"status": 200, "body": "ok"}\nerror = response.get("error", "нет ошибки")\nprint(error)',
        checks: [
          { label: 'error равен «нет ошибки»', kind: 'var', name: 'error', equals: 'нет ошибки' },
          { label: 'Использован get со значением по умолчанию', kind: 'source', pattern: '\\.get\\s*\\(', detail: 'квадратные скобки здесь вызвали бы KeyError' },
        ],
      },
      {
        id: 'c', xp: 40, file: 'feed.py',
        brief: 'В списке <code>incidents</code> лежат словари. Выведи заголовки только тех, у кого <code>status</code> равен <code>open</code>, по одному на строку.',
        starter: 'incidents = [\n    {"title": "вход сломан", "status": "open"},\n    {"title": "опечатка", "status": "closed"},\n    {"title": "оплата зависает", "status": "open"},\n]\n\n',
        hint: 'Цикл по incidents, внутри if по ключу status, затем печать ключа title.',
        solution: 'incidents = [\n    {"title": "вход сломан", "status": "open"},\n    {"title": "опечатка", "status": "closed"},\n    {"title": "оплата зависает", "status": "open"},\n]\nfor incident in incidents:\n    if incident["status"] == "open":\n        print(incident["title"])',
        checks: [
          { label: 'Выведены только открытые инциденты', kind: 'stdout', mode: 'lines', value: ['вход сломан', 'оплата зависает'] },
          { label: 'Есть цикл по списку словарей', kind: 'source', pattern: '^\\s*for\\s+\\w+\\s+in\\s+incidents', detail: 'нужен перебор списка' },
          { label: 'Статус проверяется по ключу', kind: 'source', pattern: '\\[["\']status["\']\\]|get\\s*\\(\\s*["\']status["\']', detail: 'фильтр по полю status' },
        ],
      },
    ],
  },

  {
    id: 'py-func',
    tier: 'python',
    title: 'Своя команда',
    subtitle: 'Функции: имя, параметры, return',
    skill: 'def, return',
    sprint: {
      idea: '<code>def имя(параметр):</code> создаёт свою команду. Слово <code>return</code> отдаёт результат наружу. Без <code>return</code> функция возвращает <code>None</code>.',
    },
    deep: {
      theory: 'Функция — это кусок логики под именем. Она объявляется словом <code>def</code>, получает данные через параметры в скобках и отдаёт результат словом <code>return</code>. Вызов <code>is_success(201)</code> подставляет 201 вместо параметра и выполняет тело. Важно различать <code>print</code> и <code>return</code>: print показывает значение человеку, return отдаёт его программе. Функция, которая печатает вместо возврата, бесполезна для дальнейших вычислений и почти непроверяема тестом. Параметрам можно задать значения по умолчанию: <code>def create(title, severity=3)</code>.',
      where: 'Всё, что повторяется больше одного раза, оформляют функцией. Именно функции покрывают модульными тестами: у них есть вход, выход и никакой скрытой зависимости от остального кода.',
      pitfall: 'Напечатать результат вместо возврата. Вызывающий код получит <code>None</code>, а ошибка проявится далеко от места, где сделана.',
      examples: [
        { code: 'def double(n):\n    return n * 2\n\nprint(double(21))', note: 'Функция возвращает значение, печатает уже вызывающий код.' },
        { code: 'def greet(name, greeting="Привет"):\n    return f"{greeting}, {name}!"\n\nprint(greet("Ада"))', note: 'Значение по умолчанию позволяет вызвать функцию короче.' },
      ],
    },
    tasks: [
      {
        id: 'a', xp: 35, file: 'is_success.py',
        brief: 'Напиши функцию <code>is_success(status)</code>, которая возвращает <code>True</code> для кодов от 200 до 299 включительно и <code>False</code> для остальных.',
        starter: 'def is_success(status):\n    \n\nprint(is_success(201))',
        hint: 'Достаточно вернуть само сравнение: return 200 <= status < 300',
        solution: 'def is_success(status):\n    return 200 <= status < 300\n\nprint(is_success(201))',
        checks: [
          { label: 'is_success(201) возвращает True', kind: 'call', fn: 'is_success', args: [201], equals: true },
          { label: 'is_success(404) возвращает False', kind: 'call', fn: 'is_success', args: [404], equals: false },
          { label: 'is_success(200) возвращает True', kind: 'call', fn: 'is_success', args: [200], equals: true },
        ],
      },
      {
        id: 'b', xp: 35, file: 'label.py',
        brief: 'Напиши функцию <code>severity_label(level)</code>: 5 — <code>блокер</code>, 4 — <code>критично</code>, 3 — <code>важно</code>, остальное — <code>мелочь</code>. Функция должна возвращать строку, а не печатать её.',
        starter: 'def severity_label(level):\n    \n\nprint(severity_label(4))',
        hint: 'Внутри функции обычные if/elif/else, но вместо print — return.',
        solution: 'def severity_label(level):\n    if level == 5:\n        return "блокер"\n    if level == 4:\n        return "критично"\n    if level == 3:\n        return "важно"\n    return "мелочь"\n\nprint(severity_label(4))',
        checks: [
          { label: 'severity_label(5) возвращает «блокер»', kind: 'call', fn: 'severity_label', args: [5], equals: 'блокер' },
          { label: 'severity_label(4) возвращает «критично»', kind: 'call', fn: 'severity_label', args: [4], equals: 'критично' },
          { label: 'severity_label(1) возвращает «мелочь»', kind: 'call', fn: 'severity_label', args: [1], equals: 'мелочь' },
        ],
      },
      {
        id: 'c', xp: 40, file: 'create.py',
        brief: 'Напиши функцию <code>create_incident(title, severity=3)</code>: она очищает заголовок от пробелов и возвращает словарь с полями <code>title</code>, <code>severity</code> и <code>status</code> = <code>open</code>.',
        starter: 'def create_incident(title, severity=3):\n    \n\nprint(create_incident("  вход сломан  ", 5))',
        hint: 'title = title.strip(), затем return {"title": title, "severity": severity, "status": "open"}',
        solution: 'def create_incident(title, severity=3):\n    title = title.strip()\n    return {"title": title, "severity": severity, "status": "open"}\n\nprint(create_incident("  вход сломан  ", 5))',
        checks: [
          { label: 'Заголовок очищается от пробелов', kind: 'call', fn: 'create_incident', args: ['  вход сломан  ', 5], equals: { title: 'вход сломан', severity: 5, status: 'open' } },
          { label: 'Значение severity по умолчанию равно 3', kind: 'call', fn: 'create_incident', args: ['опечатка'], equals: { title: 'опечатка', severity: 3, status: 'open' } },
        ],
      },
    ],
  },

  {
    id: 'py-errors',
    tier: 'python',
    title: 'Когда что-то ломается',
    subtitle: 'Исключения: try, except, raise',
    skill: 'обработка ошибок',
    sprint: {
      idea: 'Опасное действие оборачивают в <code>try:</code>, а в <code>except ValueError:</code> описывают, что делать при конкретной ошибке. Своя проверка сообщает о проблеме словом <code>raise</code>.',
    },
    deep: {
      theory: 'Когда Python не может выполнить операцию, он возбуждает исключение и прерывает программу. Блок <code>try:</code> отмечает участок, где ошибка ожидаема, а <code>except ValueError:</code> перехватывает конкретный её тип и позволяет продолжить работу. Ловить нужно именно тот тип, который вы умеете обработать: голый <code>except:</code> проглотит и настоящие дефекты, и опечатки в вашем коде. Своё исключение возбуждают словом <code>raise</code>: <code>raise ValueError("severity должен быть от 1 до 5")</code> — так функция отказывается работать с неверными данными вместо того, чтобы молча вернуть мусор.',
      where: 'Разбор данных извне, обращения к сети, чтение файлов. В тестировании исключения проверяют специально: тест на некорректный ввод обязан убедиться, что функция ругается, а не делает вид, что всё хорошо.',
      pitfall: 'Написать <code>except:</code> без типа. Такая заглушка скрывает настоящие баги и превращает падение в тишину.',
      examples: [
        { code: 'raw = "оопс"\ntry:\n    print(int(raw))\nexcept ValueError:\n    print("не число")', note: 'Ожидаемая ошибка перехвачена, программа продолжается.' },
        { code: 'def check(level):\n    if not 1 <= level <= 5:\n        raise ValueError("вне диапазона")\n    return level', note: 'Функция сама отказывается работать с плохими данными.' },
      ],
    },
    tasks: [
      {
        id: 'a', xp: 35, file: 'guard.py',
        brief: 'Преврати <code>raw</code> в число. Если не получается, перехвати <code>ValueError</code> и выведи <code>НЕВЕРНЫЕ ДАННЫЕ</code>.',
        starter: 'raw = "оопс"\n\nnumber = int(raw)\nprint(number)',
        hint: 'Оберни int(raw) в try, потом добавь except ValueError: с печатью.',
        solution: 'raw = "оопс"\ntry:\n    number = int(raw)\n    print(number)\nexcept ValueError:\n    print("НЕВЕРНЫЕ ДАННЫЕ")',
        checks: [
          { label: 'Программа не падает и выводит «НЕВЕРНЫЕ ДАННЫЕ»', kind: 'stdout', mode: 'equals', value: 'НЕВЕРНЫЕ ДАННЫЕ' },
          { label: 'Перехвачен именно ValueError', kind: 'source', pattern: 'except\\s+ValueError', detail: 'тип ошибки нужно указывать явно' },
        ],
      },
      {
        id: 'b', xp: 40, file: 'raise.py',
        brief: 'Напиши функцию <code>check_severity(level)</code>: она возвращает <code>level</code>, если он от 1 до 5, и возбуждает <code>ValueError</code> в остальных случаях.',
        starter: 'def check_severity(level):\n    \n\nprint(check_severity(3))',
        hint: 'if not 1 <= level <= 5: raise ValueError("вне диапазона")',
        solution: 'def check_severity(level):\n    if not 1 <= level <= 5:\n        raise ValueError("severity должен быть от 1 до 5")\n    return level\n\nprint(check_severity(3))',
        checks: [
          { label: 'Для 3 возвращается 3', kind: 'call', fn: 'check_severity', args: [3], equals: 3 },
          { label: 'Для 9 возбуждается ValueError', kind: 'call', fn: 'check_severity', args: [9], raises: 'ValueError' },
          { label: 'Для 0 тоже возбуждается ValueError', kind: 'call', fn: 'check_severity', args: [0], raises: 'ValueError' },
        ],
      },
      {
        id: 'c', xp: 40, file: 'parse.py',
        brief: 'В списке <code>raw_values</code> вперемешку числа и мусор. Собери в <code>numbers</code> только те, что удалось превратить в целое число, пропуская остальные.',
        starter: 'raw_values = ["12", "оопс", "7", "", "3"]\n\nnumbers = []\n\n\nprint(numbers)',
        hint: 'Цикл по raw_values, внутри try с int(value) и append, а в except ValueError — continue или ничего.',
        solution: 'raw_values = ["12", "оопс", "7", "", "3"]\nnumbers = []\nfor value in raw_values:\n    try:\n        numbers.append(int(value))\n    except ValueError:\n        continue\nprint(numbers)',
        checks: [
          { label: 'numbers равен [12, 7, 3]', kind: 'var', name: 'numbers', equals: [12, 7, 3] },
          { label: 'Ошибки перехвачены точечно', kind: 'source', pattern: 'except\\s+ValueError', detail: 'ловим именно ValueError' },
          { label: 'Голого except в коде нет', kind: 'source', pattern: 'except\\s*:', absent: true, detail: 'except без типа скрывает настоящие дефекты' },
        ],
      },
    ],
  },

  {
    id: 'py-project',
    tier: 'python',
    title: 'Проект: трекер инцидентов',
    subtitle: 'Собери всё изученное в одну программу',
    skill: 'итоговая работа',
    sprint: {
      idea: 'Настоящая программа — это те же переменные, словари, циклы и функции, собранные вместе. Здесь мы соберём маленький трекер: он принимает заявку, проверяет её и печатает отчёт.',
    },
    deep: {
      theory: 'Законченная программа отличается от набора упражнений разделением обязанностей. Одна функция создаёт запись и отвечает за её корректность, другая формирует отчёт, а основной код только связывает их и хранит данные. Такое разделение не эстетика: каждую функцию можно проверить отдельно, а изменение формата отчёта не затронет проверку данных. Ровно так устроены проекты, которые вы будете тестировать на второй ступени.',
      where: 'Это скелет любого небольшого инструмента: валидация входа, хранение, отчёт. Дальше вместо списка появится база данных, вместо print — веб-интерфейс, но структура останется той же.',
      pitfall: 'Написать всё одним куском в середине файла. Работать будет, а проверить или изменить — почти невозможно.',
      examples: [
        { code: 'def create(title):\n    return {"title": title.strip(), "status": "open"}\n\nitems = [create("  один  ")]\nfor item in items:\n    print(item["title"])', note: 'Функция отвечает за запись, цикл — за отчёт.' },
      ],
    },
    tasks: [
      {
        id: 'a', xp: 60, file: 'tracker.py',
        brief: 'Заверши <code>create_incident</code>: очистить заголовок, возбудить <code>ValueError</code> при severity вне 1..5, вернуть словарь с <code>status</code> = <code>open</code>. Затем выведи каждый инцидент строкой вида <code>[5] вход сломан</code>.',
        starter: 'def create_incident(title, severity):\n    # 1. очисти title\n    # 2. проверь severity от 1 до 5, иначе raise ValueError\n    # 3. верни словарь title / severity / status\n    pass\n\n\nincidents = [\n    create_incident("  вход сломан  ", 5),\n    create_incident("оплата зависает", 3),\n]\n\n# 4. выведи каждый инцидент в формате [severity] title\n',
        hint: 'Внутри функции: title = title.strip(); if not 1 <= severity <= 5: raise ValueError(...); return {...}. Ниже — цикл с f-строкой.',
        solution: 'def create_incident(title, severity):\n    title = title.strip()\n    if not 1 <= severity <= 5:\n        raise ValueError("severity должен быть от 1 до 5")\n    return {"title": title, "severity": severity, "status": "open"}\n\n\nincidents = [\n    create_incident("  вход сломан  ", 5),\n    create_incident("оплата зависает", 3),\n]\n\nfor incident in incidents:\n    print(f\'[{incident["severity"]}] {incident["title"]}\')',
        checks: [
          { label: 'Функция очищает заголовок и собирает запись', kind: 'call', fn: 'create_incident', args: ['  вход сломан  ', 5], equals: { title: 'вход сломан', severity: 5, status: 'open' } },
          { label: 'Неверный severity отклоняется', kind: 'call', fn: 'create_incident', args: ['тест', 9], raises: 'ValueError' },
          { label: 'Отчёт выведен в нужном формате', kind: 'stdout', mode: 'lines', value: ['[5] вход сломан', '[3] оплата зависает'] },
        ],
      },
      {
        id: 'b', xp: 60, file: 'report.py',
        brief: 'Добавь функцию <code>report(incidents)</code>: она возвращает строку <code>всего: 3, открыто: 2</code>. Открытыми считаются записи со <code>status</code> = <code>open</code>.',
        starter: 'incidents = [\n    {"title": "вход сломан", "status": "open"},\n    {"title": "опечатка", "status": "closed"},\n    {"title": "оплата зависает", "status": "open"},\n]\n\n\ndef report(items):\n    \n\nprint(report(incidents))',
        hint: 'Посчитай открытые циклом или через len([i for i in items if i["status"] == "open"]), затем верни f-строку.',
        solution: 'incidents = [\n    {"title": "вход сломан", "status": "open"},\n    {"title": "опечатка", "status": "closed"},\n    {"title": "оплата зависает", "status": "open"},\n]\n\n\ndef report(items):\n    open_items = [item for item in items if item["status"] == "open"]\n    return f"всего: {len(items)}, открыто: {len(open_items)}"\n\nprint(report(incidents))',
        checks: [
          { label: 'Отчёт по трём записям верен', kind: 'call', fn: 'report', args: [[{ title: 'a', status: 'open' }, { title: 'b', status: 'closed' }, { title: 'c', status: 'open' }]], equals: 'всего: 3, открыто: 2' },
          { label: 'Пустой список даёт «всего: 0, открыто: 0»', kind: 'call', fn: 'report', args: [[]], equals: 'всего: 0, открыто: 0' },
          { label: 'Функция возвращает строку, а не печатает', kind: 'source', pattern: 'return\\s+f?["\']', detail: 'результат нужно вернуть через return' },
        ],
      },
      {
        id: 'c', xp: 70, file: 'tracker_full.py',
        brief: 'Собери трекер целиком: функция <code>add(title, severity)</code> добавляет проверенную запись в список <code>storage</code> и возвращает её, функция <code>close(title)</code> переводит запись в статус <code>closed</code>. Проверь обе на данных из заготовки.',
        starter: 'storage = []\n\n\ndef add(title, severity):\n    \n\n\ndef close(title):\n    \n\n\nadd("  вход сломан  ", 5)\nadd("оплата зависает", 3)\nclose("вход сломан")\n\nfor item in storage:\n    print(f\'[{item["severity"]}] {item["title"]} — {item["status"]}\')',
        hint: 'add: очистить title, проверить severity, собрать словарь, storage.append(...), вернуть его. close: пройти storage циклом и изменить нужный словарь.',
        solution: 'storage = []\n\n\ndef add(title, severity):\n    title = title.strip()\n    if not 1 <= severity <= 5:\n        raise ValueError("severity должен быть от 1 до 5")\n    incident = {"title": title, "severity": severity, "status": "open"}\n    storage.append(incident)\n    return incident\n\n\ndef close(title):\n    for item in storage:\n        if item["title"] == title:\n            item["status"] = "closed"\n            return item\n    return None\n\n\nadd("  вход сломан  ", 5)\nadd("оплата зависает", 3)\nclose("вход сломан")\n\nfor item in storage:\n    print(f\'[{item["severity"]}] {item["title"]} — {item["status"]}\')',
        checks: [
          { label: 'В хранилище две записи', kind: 'py', expr: 'len(storage) == 2' },
          { label: 'Первая запись закрыта, вторая открыта', kind: 'py', expr: 'storage[0]["status"] == "closed" and storage[1]["status"] == "open"' },
          { label: 'Отчёт выведен построчно', kind: 'stdout', mode: 'lines', value: ['[5] вход сломан — closed', '[3] оплата зависает — open'] },
          { label: 'Неверный severity отклоняется', kind: 'call', fn: 'add', args: ['проверка', 0], raises: 'ValueError' },
        ],
      },
    ],
  },
];
