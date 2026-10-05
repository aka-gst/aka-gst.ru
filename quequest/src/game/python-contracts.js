import { runPython } from '../runner.js';

export const PYTHON_CONTRACTS = Object.freeze([
  {
    id:'py-01', tier:1, xp:55, title:'Конвейер имён', visual:'FILE → NORMALIZE → NAME',
    brief:'Сделай функцию clean_names(names): пробелы по краям убрать, текст сделать lowercase, пробелы внутри заменить на _.',
    starter:'def clean_names(names):\n    # верни новый список\n    pass',
    checks:[
      {kind:'py', expr:'clean_names([" Report Final ", "PHOTO ONE.JPG"]) == ["report_final", "photo_one.jpg"]', detail:'clean_names должна нормализовать оба имени'},
      {kind:'py', expr:'clean_names([]) == []', detail:'пустой список остаётся пустым'},
    ],
    concept:'list + loop/comprehension + string methods',
  },
  {
    id:'py-02', tier:1, xp:60, title:'Маршрутизатор грузов', visual:'ITEMS → DICT → LANES',
    brief:'Собери group_by_kind(items): словарь kind → список id в исходном порядке.',
    starter:'def group_by_kind(items):\n    grouped = {}\n    # собери маршруты\n    return grouped',
    checks:[
      {kind:'py', expr:'group_by_kind([{"id":"a","kind":"text"},{"id":"b","kind":"table"},{"id":"c","kind":"text"}]) == {"text":["a","c"],"table":["b"]}', detail:'одинаковые kind должны попасть в одну линию'},
      {kind:'py', expr:'group_by_kind([]) == {}', detail:'пустой поток даёт пустой dict'},
    ],
    concept:'dict + state + grouping',
  },
  {
    id:'py-03', tier:2, xp:65, title:'Webhook без дублей', visual:'EVENTS → DEDUPE → EFFECT',
    brief:'unique_events(events) должен оставить только первое событие каждого id и сохранить порядок.',
    starter:'def unique_events(events):\n    # seen поможет помнить уже обработанные id\n    pass',
    checks:[
      {kind:'py', expr:'unique_events([{"id":"A"},{"id":"A"},{"id":"B"},{"id":"A"}]) == [{"id":"A"},{"id":"B"}]', detail:'повторный id не должен давать второй эффект'},
      {kind:'py', expr:'unique_events([]) == []', detail:'пустой поток остаётся пустым'},
    ],
    concept:'set + idempotency',
  },
  {
    id:'py-04', tier:2, xp:65, title:'Пакеты на запись', visual:'10 ITEMS → BATCHES → DB',
    brief:'batches(items, size) разбивает список на последовательные куски не больше size.',
    starter:'def batches(items, size):\n    # [[...], [...], ...]\n    pass',
    checks:[
      {kind:'py', expr:'batches([1,2,3,4,5], 2) == [[1,2],[3,4],[5]]', detail:'последняя пачка может быть короче'},
      {kind:'py', expr:'batches([], 3) == []', detail:'для пустого списка нет пачек'},
    ],
    concept:'range + slicing + batching',
  },
  {
    id:'py-05', tier:2, xp:65, title:'Индекс состояния', visual:'RECORDS → INDEX[id] → O(1) LOOKUP',
    brief:'index_by_id(records) возвращает dict, где ключ — record["id"], значение — сам record.',
    starter:'def index_by_id(records):\n    pass',
    checks:[
      {kind:'py', expr:'index_by_id([{"id":"x","v":1},{"id":"y","v":2}]) == {"x":{"id":"x","v":1},"y":{"id":"y","v":2}}', detail:'записи должны находиться по id'},
    ],
    concept:'dict comprehension + lookup',
  },
  {
    id:'py-06', tier:3, xp:75, title:'Плохие значения не валят смену', visual:'TEXT → TRY → INT / NONE',
    brief:'safe_int(value) возвращает int(value), а для ValueError/TypeError — None.',
    starter:'def safe_int(value):\n    # try / except\n    pass',
    checks:[
      {kind:'py', expr:'safe_int("42") == 42', detail:'строка с числом должна стать int'},
      {kind:'py', expr:'safe_int("oops") is None and safe_int(None) is None', detail:'плохие значения должны безопасно вернуть None'},
    ],
    concept:'try/except + data boundary',
  },
  {
    id:'py-07', tier:3, xp:85, title:'Retry с пределом', visual:'CALL × FAIL → RETRY → OK',
    brief:'retry_call(fn, attempts) вызывает fn до успеха, ловит ValueError и прекращает после attempts. Если успеха нет — пробрось последнюю ошибку.',
    starter:'def retry_call(fn, attempts):\n    pass',
    preamble:'\nclass Flaky:\n    def __init__(self, fails): self.fails=fails; self.calls=0\n    def __call__(self):\n        self.calls += 1\n        if self.calls <= self.fails: raise ValueError("temporary")\n        return "ok"\n',
    checks:[
      {kind:'py', expr:'(lambda f: (retry_call(f, 3), f.calls))(Flaky(2)) == ("ok", 3)', detail:'две ошибки + успешная третья попытка'},
      {kind:'py', expr:'(lambda f: (retry_call(f, 1), f.calls))(Flaky(0)) == ("ok", 1)', detail:'успех не нужно повторять'},
    ],
    concept:'retry + bounded failure',
  },
  {
    id:'py-08', tier:4, xp:95, title:'Параллельное ожидание', visual:'3 I/O JOBS ⇉ GATHER ⇉ RESULTS',
    brief:'Напиши async def run_all(jobs), которая запускает переданные корутины вместе через asyncio.gather и возвращает список результатов.',
    starter:'import asyncio\n\nasync def run_all(jobs):\n    pass',
    preamble:'\nimport asyncio\nasync def _job(value):\n    await asyncio.sleep(0)\n    return value * 2\n',
    checks:[
      {kind:'source', pattern:'async\\s+def\\s+run_all', detail:'нужна async function'},
      {kind:'source', pattern:'asyncio\\.gather', detail:'используй asyncio.gather для независимых ожиданий'},
      {kind:'py', expr:'asyncio.run(run_all([_job(1), _job(2), _job(3)])) == [2,4,6]', detail:'все три результата должны вернуться вместе'},
    ],
    concept:'async/await + gather',
  },
  {
    id:'py-09', tier:4, xp:100, title:'Лимит конкуренции', visual:'20 JOBS → SEMAPHORE(3) → API',
    brief:'make_gate(limit) должен вернуть asyncio.Semaphore(limit). Это маленький контракт, но он фиксирует лимит как объект системы.',
    starter:'import asyncio\n\ndef make_gate(limit):\n    pass',
    checks:[
      {kind:'py', expr:'isinstance(make_gate(3), asyncio.Semaphore)', detail:'верни asyncio.Semaphore'},
      {kind:'py', expr:'make_gate(3)._value == 3', detail:'лимит должен совпадать с аргументом'},
    ],
    concept:'Semaphore + backpressure',
  },
  {
    id:'py-10', tier:5, xp:115, title:'Граница LLM tool-call', visual:'MODEL JSON → VALIDATE → ALLOWLIST → TOOL',
    brief:'validate_action(action, allowed) возвращает action только если это dict с tool/args, tool есть в allowed, args — dict. Иначе подними ValueError.',
    starter:'def validate_action(action, allowed):\n    pass',
    checks:[
      {kind:'py', expr:'validate_action({"tool":"lookup","args":{"id":1}}, {"lookup"}) == {"tool":"lookup","args":{"id":1}}', detail:'разрешённое структурированное действие проходит'},
      {kind:'py', expr:'(lambda: (validate_action({"tool":"delete_all","args":{}}, {"lookup"}), False))() if False else True', detail:''},
      {kind:'source', pattern:'raise\\s+ValueError', detail:'невалидный tool-call должен отклоняться явно'},
    ],
    postCheck: (source) => {
      // Source contract is supplemented by a real runtime rejection below in the UI.
      return source.includes('allowed');
    },
    concept:'structured output + validation + tool allowlist',
  },
  {
    id:'py-11', tier:3, xp:80, title:'Ленивая лента', visual:'MANY ITEMS → YIELD → ONE BY ONE',
    brief:'stream_batches(items, size) — генератор: выдаёт последовательные списки не больше size через yield, не собирая весь результат заранее.',
    starter:'def stream_batches(items, size):\n    # yield каждую пачку\n    pass',
    checks:[
      {kind:'source', pattern:'\\byield\\b', detail:'лента должна быть генератором через yield'},
      {kind:'py', expr:'list(stream_batches([1,2,3,4,5], 2)) == [[1,2],[3,4],[5]]', detail:'генератор выдаёт три пачки'},
      {kind:'py', expr:'hasattr(stream_batches([], 2), "__iter__")', detail:'даже пустой поток остаётся iterable'},
    ],
    concept:'generator + yield + streaming',
  },
  {
    id:'py-12', tier:3, xp:85, title:'Job как объект', visual:'RAW DICT → DATACLASS → JOB',
    brief:'Создай @dataclass Job с полями id: str, kind: str, attempts: int = 0 и функцию make_job(data), которая собирает Job из dict.',
    starter:'from dataclasses import dataclass\n\n@dataclass\nclass Job:\n    pass\n\ndef make_job(data):\n    pass',
    checks:[
      {kind:'source', pattern:'@dataclass', detail:'используй dataclass'},
      {kind:'py', expr:'(lambda j: (j.id,j.kind,j.attempts))(make_job({"id":"A","kind":"text"})) == ("A","text",0)', detail:'объект хранит типизированное состояние'},
      {kind:'py', expr:'make_job({"id":"B","kind":"table","attempts":2}).attempts == 2', detail:'attempts можно восстановить из данных'},
    ],
    concept:'dataclass + objects + defaults',
  },
  {
    id:'py-13', tier:3, xp:90, title:'Дверь ресурса', visual:'OPEN → WITH → ALWAYS CLOSE',
    brief:'Сделай class ResourceGuard: __enter__ вызывает resource.open() и возвращает resource; __exit__ всегда вызывает resource.close() и не подавляет ошибку.',
    starter:'class ResourceGuard:\n    def __init__(self, resource):\n        self.resource = resource\n\n    def __enter__(self):\n        pass\n\n    def __exit__(self, exc_type, exc, tb):\n        pass',
    preamble:'\nclass DummyResource:\n    def __init__(self): self.events=[]\n    def open(self): self.events.append("open")\n    def close(self): self.events.append("close")\n',
    checks:[
      {kind:'py', expr:'(lambda r: (exec("with ResourceGuard(r) as x:\\n    x.events.append(\\\"work\\\")", globals(), {"r":r}), r.events)[1])(DummyResource()) == ["open","work","close"]', detail:'with открывает, выполняет работу и закрывает ресурс'},
      {kind:'py', expr:'(lambda r: (ResourceGuard(r).__enter__() is r))(DummyResource())', detail:'__enter__ возвращает сам ресурс'},
      {kind:'source', pattern:'def\\s+__exit__', detail:'cleanup должен жить в __exit__'},
    ],
    concept:'context manager + resource safety',
  },
  {
    id:'py-14', tier:3, xp:80, title:'Планировщик приоритетов', visual:'JOBS → SORT(priority, created) → QUEUE',
    brief:'schedule(jobs) возвращает новый список: меньший priority раньше, при равном priority — меньший created раньше. Исходный список не менять.',
    starter:'def schedule(jobs):\n    pass',
    checks:[
      {kind:'py', expr:'[j["id"] for j in schedule([{"id":"b","priority":2,"created":1},{"id":"c","priority":1,"created":3},{"id":"a","priority":1,"created":2}])] == ["a","c","b"]', detail:'двойной ключ задаёт стабильный порядок'},
      {kind:'py', expr:'(lambda x: (schedule(x), [j["id"] for j in x])[1])([{"id":"b","priority":2,"created":1},{"id":"a","priority":1,"created":2}]) == ["b","a"]', detail:'входной список не мутируется'},
    ],
    concept:'sorted + key + ordering',
  },
  {
    id:'py-15', tier:4, xp:95, title:'Граф зависимостей', visual:'DEPS → READY → NEXT LAYER',
    brief:'ready_tasks(deps, done) возвращает sorted список ещё не выполненных задач, у которых все зависимости уже в done. deps — dict task → set требований.',
    starter:'def ready_tasks(deps, done):\n    pass',
    checks:[
      {kind:'py', expr:'ready_tasks({"fetch":set(),"parse":{"fetch"},"save":{"parse"}}, set()) == ["fetch"]', detail:'без выполненных задач готов только корень'},
      {kind:'py', expr:'ready_tasks({"fetch":set(),"parse":{"fetch"},"save":{"parse"}}, {"fetch"}) == ["parse"]', detail:'parse становится доступен после fetch, а done больше не возвращается'},
      {kind:'py', expr:'ready_tasks({"fetch":set(),"parse":{"fetch"},"save":{"parse"}}, {"fetch","parse"}) == ["save"]', detail:'save открывается после parse'},
    ],
    concept:'sets + dependency graph',
  },
  {
    id:'py-16', tier:4, xp:100, title:'Backoff без сна в тестах', visual:'FAIL → 1 → 2 → 4 → STOP/OK',
    brief:'retry_backoff(fn, attempts, sleep_fn) ловит ValueError, между попытками вызывает sleep_fn(delay) с 1,2,4… и возвращает успешный результат. Последнюю ошибку пробрасывает.',
    starter:'def retry_backoff(fn, attempts, sleep_fn):\n    pass',
    preamble:'\nclass FlakyBackoff:\n    def __init__(self, fails): self.fails=fails; self.calls=0\n    def __call__(self):\n        self.calls += 1\n        if self.calls <= self.fails: raise ValueError("temporary")\n        return "ok"\n',
    checks:[
      {kind:'py', expr:'(lambda f,d: (retry_backoff(f,4,d.append), d, f.calls))(FlakyBackoff(3), []) == ("ok", [1,2,4], 4)', detail:'между ошибками backoff 1,2,4'},
      {kind:'py', expr:'(lambda f,d: (retry_backoff(f,2,d.append), d))(FlakyBackoff(0), []) == ("ok", [])', detail:'успешный вызов не спит'},
    ],
    concept:'bounded retry + exponential backoff + dependency injection',
  },
  {
    id:'py-17', tier:4, xp:100, title:'JSON на границе', visual:'JSON TEXT → PARSE → VALIDATE → DATA',
    brief:'parse_event(text) парсит json. Нужен dict с непустыми строками id и kind; иначе ValueError. Верни только {"id":..., "kind":...}, лишние поля отбрось.',
    starter:'import json\n\ndef parse_event(text):\n    pass',
    checks:[
      {kind:'py', expr:'parse_event("{\\\"id\\\":\\\"A\\\",\\\"kind\\\":\\\"text\\\",\\\"secret\\\":1}") == {"id":"A","kind":"text"}', detail:'валидные поля проходят, лишнее не просачивается'},
      {kind:'call', fn:'parse_event', args:['[]'], raises:'ValueError', detail:'список вместо объекта отклоняется'},
      {kind:'call', fn:'parse_event', args:['{"id":"","kind":"text"}'], raises:'ValueError', detail:'пустой id отклоняется'},
    ],
    concept:'json + validation + boundary',
  },
  {
    id:'py-18', tier:4, xp:105, title:'Typed action', visual:'MODEL DATA → ACTION OBJECT → POLICY',
    brief:'Создай @dataclass Action(tool: str, args: dict) и decode_action(data, allowed): проверяет dict, allowlist и args-dict, затем возвращает Action. Иначе ValueError.',
    starter:'from dataclasses import dataclass\n\n@dataclass\nclass Action:\n    pass\n\ndef decode_action(data, allowed):\n    pass',
    checks:[
      {kind:'py', expr:'(lambda a:(a.tool,a.args))(decode_action({"tool":"lookup","args":{"id":1}}, {"lookup"})) == ("lookup", {"id":1})', detail:'валидное действие превращается в объект'},
      {kind:'call', fn:'decode_action', args:[{'tool':'delete_all','args':{}}, ['lookup']], raises:'ValueError', detail:'неразрешённый инструмент отклоняется'},
      {kind:'source', pattern:'@dataclass', detail:'структура действия должна быть явной'},
    ],
    concept:'dataclass + schema boundary + allowlist',
  },
  {
    id:'py-19', tier:5, xp:115, title:'Порт модели', visual:'APP → PROTOCOL → ANY MODEL CLIENT',
    brief:'Определи Protocol ModelClient с методом generate(self, messages). Функция ask(client, messages) должна просто вернуть client.generate(messages), не зная конкретного провайдера.',
    starter:'from typing import Protocol\n\nclass ModelClient(Protocol):\n    pass\n\ndef ask(client, messages):\n    pass',
    preamble:'\nclass FakeModel:\n    def generate(self, messages): return {"seen": len(messages)}\n',
    checks:[
      {kind:'source', pattern:'class\\s+ModelClient\\s*\\(Protocol\\)', detail:'граница описана Protocol'},
      {kind:'source', pattern:'def\\s+generate\\s*\\(', detail:'Protocol объявляет generate'},
      {kind:'py', expr:'ask(FakeModel(), [{"role":"user","content":"hi"}]) == {"seen":1}', detail:'приложение работает с fake без SDK провайдера'},
    ],
    concept:'typing.Protocol + dependency inversion',
  },
  {
    id:'py-20', tier:5, xp:120, title:'Живая asyncio.Queue', visual:'PRODUCER → QUEUE → WORKER → RESULTS',
    brief:'async process_queue(items) кладёт items в asyncio.Queue, worker забирает через await queue.get(), добавляет удвоенное значение в results и вызывает task_done(). Верни results после queue.join().',
    starter:'import asyncio\n\nasync def process_queue(items):\n    pass',
    checks:[
      {kind:'source', pattern:'asyncio\\.Queue', detail:'используй настоящую asyncio.Queue'},
      {kind:'source', pattern:'task_done\\s*\\(', detail:'worker подтверждает обработку item'},
      {kind:'source', pattern:'queue\\.join\\s*\\(', ignore_case:true, detail:'дождись опустошения очереди'},
      {kind:'py', expr:'sorted(asyncio.run(process_queue([3,1,2]))) == [2,4,6]', detail:'все элементы проходят worker'},
    ],
    concept:'asyncio.Queue + worker lifecycle',
  },
  {
    id:'py-21', tier:5, xp:120, title:'Timeout как исход', visual:'AWAIT → TIME LIMIT → VALUE / TIMEOUT',
    brief:'async with_timeout(coro, seconds) запускает coro через asyncio.wait_for. При asyncio.TimeoutError верни строку "timeout".',
    starter:'import asyncio\n\nasync def with_timeout(coro, seconds):\n    pass',
    preamble:'\nimport asyncio\nasync def _fast(): await asyncio.sleep(0); return "ok"\nasync def _slow(): await asyncio.sleep(0.03); return "late"\n',
    checks:[
      {kind:'source', pattern:'asyncio\\.wait_for', detail:'ограничь ожидание wait_for'},
      {kind:'py', expr:'asyncio.run(with_timeout(_fast(), .1)) == "ok"', detail:'быстрый результат проходит'},
      {kind:'py', expr:'asyncio.run(with_timeout(_slow(), .001)) == "timeout"', detail:'долгое ожидание становится контролируемым исходом'},
    ],
    concept:'timeout + async failure handling',
  },
  {
    id:'py-22', tier:5, xp:125, title:'Concurrency gate', visual:'JOBS ⇉ SEMAPHORE(N) ⇉ API',
    brief:'async run_limited(values, limit, fn) запускает fn(value) для всех values, но тело каждого вызова оборачивает в async with asyncio.Semaphore(limit). Верни результаты в исходном порядке.',
    starter:'import asyncio\n\nasync def run_limited(values, limit, fn):\n    pass',
    preamble:'\nimport asyncio\n_active=0\n_peak=0\nasync def _probe(value):\n    global _active,_peak\n    _active += 1; _peak=max(_peak,_active)\n    await asyncio.sleep(0)\n    _active -= 1\n    return value*10\n',
    checks:[
      {kind:'source', pattern:'asyncio\\.Semaphore', detail:'лимит должен быть объектом Semaphore'},
      {kind:'source', pattern:'async\\s+with', detail:'слот удерживается только во время вызова'},
      {kind:'py', expr:'(globals().__setitem__("_active",0), globals().__setitem__("_peak",0), asyncio.run(run_limited([1,2,3,4],2,_probe)), _peak)[2:] == ([10,20,30,40], 2)', detail:'результаты сохраняют порядок, peak concurrency = 2'},
    ],
    concept:'Semaphore + gather + bounded concurrency',
  },
  {
    id:'py-23', tier:6, xp:135, title:'Реестр инструментов', visual:'@TOOL → REGISTRY → DISPATCH',
    brief:'Сделай декоратор tool(name), который регистрирует функцию в TOOL_REGISTRY[name] и возвращает исходную функцию. dispatch(name, **kwargs) вызывает только зарегистрированный tool, иначе ValueError.',
    starter:'TOOL_REGISTRY = {}\n\ndef tool(name):\n    pass\n\ndef dispatch(name, **kwargs):\n    pass',
    checks:[
      {kind:'py', expr:'exec("@tool(\\\"double\\\")\\ndef _double(value): return value*2", globals()) is None', detail:'декоратор можно применить к обычной функции'},
      {kind:'py', expr:'dispatch("double", value=4) == 8', detail:'registry вызывает разрешённый tool'},
      {kind:'call', fn:'dispatch', args:['missing'], raises:'ValueError', detail:'неизвестный tool не вызывается'},
    ],
    concept:'decorator + registry + safe dispatch',
  },
  {
    id:'py-24', tier:6, xp:140, title:'Сообщения без смешения ролей', visual:'SYSTEM + TASK + DATA → MODEL',
    brief:'build_messages(instruction, task, context) возвращает ровно 3 message dict: system с instruction, user с task и user с префиксом "DATA:\\n" + context. Данные не должны попадать в system.',
    starter:'def build_messages(instruction, task, context):\n    pass',
    checks:[
      {kind:'py', expr:'build_messages("Be safe","check A17","A17=packed") == [{"role":"system","content":"Be safe"},{"role":"user","content":"check A17"},{"role":"user","content":"DATA:\\nA17=packed"}]', detail:'instruction, task и данные разделены ролями'},
      {kind:'py', expr:'"A17=packed" not in build_messages("Be safe","check A17","A17=packed")[0]["content"]', detail:'неподтверждённые данные не становятся system-инструкцией'},
    ],
    concept:'LLM messages + instruction/data separation',
  },

  {
    id:'py-25', tier:6, xp:145, title:'Лог без секрета', visual:'HEADERS → REDACT → SAFE TRACE',
    brief:'redact_headers(headers) возвращает новый dict. Значения Authorization и X-API-Key (без учёта регистра) заменяются на "***"; исходный dict не меняется.',
    starter:'def redact_headers(headers):\n    pass',
    checks:[
      {kind:'py', expr:'redact_headers({"Authorization":"Bearer secret","Content-Type":"application/json","x-api-key":"abc"}) == {"Authorization":"***","Content-Type":"application/json","x-api-key":"***"}', detail:'секретные заголовки скрыты, обычные сохранены'},
      {kind:'py', expr:'(lambda h: (redact_headers(h), h)[1])({"Authorization":"secret"}) == {"Authorization":"secret"}', detail:'исходный dict не мутируется'},
    ],
    concept:'security boundary + immutable transform',
  },
  {
    id:'py-26', tier:6, xp:145, title:'Health ≠ Ready', visual:'PROCESS → HEALTH / READY → DEPS',
    brief:'service_status(deps) возвращает {"health":200, "ready":200 или 503}. health показывает, что процесс жив; ready = 200 только если все значения deps truthy.',
    starter:'def service_status(deps):\n    pass',
    checks:[
      {kind:'py', expr:'service_status({"model":True,"retrieval":True}) == {"health":200,"ready":200}', detail:'все зависимости готовы'},
      {kind:'py', expr:'service_status({"model":True,"retrieval":False}) == {"health":200,"ready":503}', detail:'процесс жив, но сервис не готов'},
    ],
    concept:'liveness + readiness',
  },
  {
    id:'py-27', tier:6, xp:150, title:'Нейтральный request envelope', visual:'CLIENT → ENVELOPE → GATEWAY',
    brief:'make_request(request_id, model, messages) возвращает новый dict только с request_id/model/messages. Секретов и provider SDK внутри envelope нет. Пустые request_id/model отклоняй ValueError.',
    starter:'def make_request(request_id, model, messages):\n    pass',
    checks:[
      {kind:'py', expr:'make_request("r-17","q-mini",[{"role":"user","content":"hi"}]) == {"request_id":"r-17","model":"q-mini","messages":[{"role":"user","content":"hi"}]}', detail:'transport envelope стабилен'},
      {kind:'call', fn:'make_request', args:['','q-mini',[]], raises:'ValueError', detail:'request id обязателен'},
      {kind:'call', fn:'make_request', args:['r-1','',[]], raises:'ValueError', detail:'model обязателен'},
    ],
    concept:'API contract + request identity',
  },
  {
    id:'py-28', tier:6, xp:150, title:'MCP capability ≠ authority', visual:'DISCOVERED TOOLS → ALLOWLIST → EXPOSED',
    brief:'filter_tools(advertised, allowed) возвращает только разрешённые имена из advertised, сохраняя порядок. Обнаруженный delete_all не должен пройти сам по себе.',
    starter:'def filter_tools(advertised, allowed):\n    pass',
    checks:[
      {kind:'py', expr:'filter_tools(["read_docs","delete_all","save_note"], {"read_docs","save_note"}) == ["read_docs","save_note"]', detail:'discovery фильтруется policy'},
      {kind:'py', expr:'filter_tools(["delete_all"], set()) == []', detail:'capability без authority не экспонируется'},
    ],
    concept:'MCP discovery + allowlist',
  },
  {
    id:'py-29', tier:6, xp:155, title:'Webhook ровно один раз', visual:'DELIVERY → IDEMPOTENCY SET → EFFECT',
    brief:'accept_once(event_id, seen) мутирует переданный set seen: первый id добавляет и возвращает True, повторный возвращает False.',
    starter:'def accept_once(event_id, seen):\n    pass',
    checks:[
      {kind:'py', expr:'(lambda s: (accept_once("evt-1",s), accept_once("evt-1",s), s)) (set()) == (True,False,{"evt-1"})', detail:'повтор не создаёт второй эффект'},
      {kind:'py', expr:'(lambda s: (accept_once("A",s),accept_once("B",s),len(s)))(set()) == (True,True,2)', detail:'разные события проходят независимо'},
    ],
    concept:'idempotency + webhook delivery',
  },
  {
    id:'py-30', tier:6, xp:160, title:'Evidence вместо обещания', visual:'CLAIM → COMMAND + EXIT + OUTPUT → PROOF',
    brief:'verify_evidence(record) возвращает True только если record — dict с непустыми command/output и exit_code == 0. Поле claim не считается доказательством.',
    starter:'def verify_evidence(record):\n    pass',
    checks:[
      {kind:'py', expr:'verify_evidence({"command":"node --test","exit_code":0,"output":"12 tests passed","claim":"done"}) is True', detail:'реальный command/exit/output образуют proof'},
      {kind:'py', expr:'verify_evidence({"claim":"tests passed"}) is False', detail:'слова агента без evidence не проходят'},
      {kind:'py', expr:'verify_evidence({"command":"pytest","exit_code":1,"output":"1 failed"}) is False', detail:'ненулевой exit code остаётся провалом'},
    ],
    concept:'verification + DevOps evidence',
  },

  {
    id:'py-31', tier:7, xp:170, title:'Blueprint как исполняемая линия', visual:'ITEM → STAGE → STAGE → RESULT',
    brief:'compose(stages) возвращает функцию pipeline(value), которая по порядку передаёт результат каждой функции в следующую. Пустой stages оставляет value без изменений.',
    starter:'def compose(stages):\n    pass',
    preamble:'\ndef _inc(x): return x + 1\ndef _double(x): return x * 2\n',
    checks:[
      {kind:'py', expr:'compose([_inc,_double])(3) == 8', detail:'порядок узлов blueprint влияет на результат'},
      {kind:'py', expr:'compose([])(7) == 7', detail:'пустая линия остаётся identity'},
    ],
    concept:'functions as values + composition + pipeline',
  },
  {
    id:'py-32', tier:7, xp:175, title:'Кэш с наблюдаемым промахом', visual:'KEY → CACHE HIT / COMPUTE → CACHE',
    brief:'cached_get(cache, key, compute) возвращает cache[key], если ключ уже есть. Иначе вызывает compute(key) ровно один раз, сохраняет результат и возвращает его.',
    starter:'def cached_get(cache, key, compute):\n    pass',
    preamble:'\nclass Counter:\n    def __init__(self): self.calls=0\n    def __call__(self,key): self.calls+=1; return key.upper()\n',
    checks:[
      {kind:'py', expr:'(lambda c,f:(cached_get(c,"a",f),cached_get(c,"a",f),f.calls,c))( {}, Counter()) == ("A","A",1,{"a":"A"})', detail:'второй запрос — cache hit без повторного compute'},
      {kind:'py', expr:'(lambda c,f:(cached_get(c,"x",f),cached_get(c,"y",f),f.calls))( {}, Counter()) == ("X","Y",2)', detail:'разные ключи считаются независимо'},
    ],
    concept:'cache + observable work avoidance',
  },
  {
    id:'py-33', tier:7, xp:180, title:'Circuit breaker без магии', visual:'FAILURES → OPEN → BLOCK → RECOVER',
    brief:'allow_call(state, threshold) работает с dict {"failures":int,"open":bool}. Если open=True — верни False. Если failures >= threshold — выставь open=True и верни False. Иначе True.',
    starter:'def allow_call(state, threshold):\n    pass',
    checks:[
      {kind:'py', expr:'(lambda s:(allow_call(s,3),s))({"failures":2,"open":False}) == (True,{"failures":2,"open":False})', detail:'до порога запрос ещё разрешён'},
      {kind:'py', expr:'(lambda s:(allow_call(s,3),s))({"failures":3,"open":False}) == (False,{"failures":3,"open":True})', detail:'на пороге breaker открывается'},
      {kind:'py', expr:'allow_call({"failures":0,"open":True},3) is False', detail:'открытый breaker блокирует вызов'},
    ],
    concept:'state machine + circuit breaker',
  },
  {
    id:'py-34', tier:7, xp:185, title:'Контекст с provenance', visual:'CHUNKS → TOP-K → SOURCE TAGS → CONTEXT',
    brief:'build_context(chunks, ids) возвращает строки только выбранных chunk id в порядке ids как "[source] text". Неизвестный id пропускай.',
    starter:'def build_context(chunks, ids):\n    pass',
    checks:[
      {kind:'py', expr:'build_context({"a":{"source":"manual","text":"alpha"},"b":{"source":"log","text":"beta"}}, ["b","a"]) == ["[log] beta","[manual] alpha"]', detail:'контекст хранит источник и порядок retrieval'},
      {kind:'py', expr:'build_context({"a":{"source":"x","text":"ok"}}, ["missing","a"]) == ["[x] ok"]', detail:'неизвестный chunk не превращается в выдуманный факт'},
    ],
    concept:'retrieval + provenance + defensive lookup',
  },
  {
    id:'py-35', tier:7, xp:190, title:'Eval как отдельный контур', visual:'CASES → SYSTEM → CHECK → SCORE',
    brief:'evaluate(fn, cases) получает список пар (input, expected), вызывает fn(input) и возвращает долю точных совпадений от 0.0 до 1.0. Пустой eval возвращает 0.0.',
    starter:'def evaluate(fn, cases):\n    pass',
    preamble:'\ndef _even(x): return x % 2 == 0\n',
    checks:[
      {kind:'py', expr:'evaluate(_even, [(2,True),(3,False),(5,True)]) == 2/3', detail:'eval считает качество на всех кейсах'},
      {kind:'py', expr:'evaluate(_even, []) == 0.0', detail:'пустой eval не изображает 100% качество'},
    ],
    concept:'eval harness + measurable quality',
  },
  {
    id:'py-36', tier:7, xp:200, title:'Один безопасный шаг агента', visual:'PLAN → POLICY → TOOL → EVIDENCE',
    brief:'agent_step(action, allowed, tools) проверяет action={"tool","args"}: tool должен быть в allowed и tools, args — dict. Вызови tools[tool](**args) и верни {"tool":tool,"result":...}. Иначе ValueError.',
    starter:'def agent_step(action, allowed, tools):\n    pass',
    preamble:'\ndef _lookup(id): return {"id":id,"status":"ok"}\n',
    checks:[
      {kind:'py', expr:'agent_step({"tool":"lookup","args":{"id":"A"}}, {"lookup"}, {"lookup":_lookup}) == {"tool":"lookup","result":{"id":"A","status":"ok"}}', detail:'разрешённый шаг даёт структурированное evidence'},
      {kind:'call', fn:'agent_step', args:[{'tool':'delete_all','args':{}}, ['lookup'], {}], raises:'ValueError', detail:'неразрешённый tool не получает authority'},
      {kind:'call', fn:'agent_step', args:[{'tool':'lookup','args':'A'}, ['lookup'], {}], raises:'ValueError', detail:'args обязаны иметь структуру'},
    ],
    concept:'bounded agent + policy + tool dispatch + evidence',
  },

]);

export function getPythonContract(id) {
  return PYTHON_CONTRACTS.find((task) => task.id === id) ?? null;
}

function setText(root, selector, text) {
  const node = root.querySelector(selector);
  if (node) node.textContent = text;
}

export function createPythonContracts(root, { getProfile, onProfile, onSound = () => {}, onClose = () => {} }) {
  const list = root.querySelector('#pythonContractList');
  const editor = root.querySelector('#pythonContractEditor');
  const textarea = root.querySelector('#pythonContractCode');
  const checksNode = root.querySelector('#pythonContractChecks');
  let active = null;
  let running = false;

  function renderList() {
    const profile = getProfile();
    list.replaceChildren();
    for (const task of PYTHON_CONTRACTS) {
      const button = document.createElement('button');
      button.type='button';
      button.className='python-contract-card';
      button.dataset.done=String(profile.labs.python.completed.includes(task.id));
      button.innerHTML=`<span><small>TIER ${task.tier} · +${task.xp} XP</small><strong>${task.title}</strong><em>${task.visual}</em></span><b>${profile.labs.python.completed.includes(task.id) ? '✓' : '{ }'}</b>`;
      button.addEventListener('click',()=>openTask(task));
      list.append(button);
    }
    setText(root,'#pythonContractProgress',`${profile.labs.python.completed.length}/${PYTHON_CONTRACTS.length} программ собрано`);
  }

  function openTask(task) {
    active=task;
    editor.hidden=false;
    setText(root,'#pythonContractTier',`TIER ${task.tier} · ${task.concept}`);
    setText(root,'#pythonContractTitle',task.title);
    setText(root,'#pythonContractBrief',task.brief);
    setText(root,'#pythonContractVisual',task.visual);
    textarea.value=task.starter;
    checksNode.replaceChildren();
    setText(root,'#pythonContractFeedback','Запусти настоящий Python. Каждый зелёный датчик — отдельный проверяемый контракт поведения.');
  }

  async function run() {
    if (!active || running) return;
    running=true;
    root.querySelector('#pythonContractRun').disabled=true;
    setText(root,'#pythonContractFeedback','Python проверяет поведение…');
    onProfile({type:'code-run'});
    const result=await runPython({ source:textarea.value, preamble:active.preamble ?? '', checks:active.checks });
    checksNode.replaceChildren();
    if (result.error) {
      const row=document.createElement('div'); row.dataset.ok='false'; row.textContent=`× ${result.error.text}`; checksNode.append(row);
      setText(root,'#pythonContractFeedback',result.error.hint ?? 'Исправь ошибку и запусти ещё раз.');
      onSound('blocked');
    } else {
      result.checks.forEach((check,index)=>{ const row=document.createElement('div'); row.dataset.ok=String(check.ok); row.textContent=`${check.ok?'✓':'×'} ДАТЧИК ${index+1}${check.detail ? ` · ${check.detail}`:''}`; checksNode.append(row); });
      let ok=result.checks.length>0 && result.checks.every((check)=>check.ok);
      if (ok && active.id==='py-10') {
        const rejection=await runPython({
          source:textarea.value+'\n\ntry:\n    validate_action({"tool":"delete_all","args":{}}, {"lookup"})\n    blocked = False\nexcept ValueError:\n    blocked = True',
          checks:[{kind:'py',expr:'blocked is True',detail:'allowlist должна отклонить delete_all'}],
        });
        ok=!rejection.error && rejection.checks.every((check)=>check.ok);
        const row=document.createElement('div'); row.dataset.ok=String(ok); row.textContent=`${ok?'✓':'×'} ALLOWLIST · запрещённый tool отклонён`; checksNode.append(row);
      }
      if (ok) {
        const profile=getProfile();
        const already=profile.labs.python.completed.includes(active.id);
        onProfile({type:'python-contract',id:active.id,xp:active.xp,checks:result.checks.length});
        setText(root,'#pythonContractFeedback',already ? '✓ Контракт снова проходит. Лучший результат сохранён.' : `✓ Контракт закрыт. +${active.xp} XP. Код сделал именно то, что обещал.`);
        onSound('reward');
        renderList();
      } else {
        setText(root,'#pythonContractFeedback','Часть датчиков ещё красная. Меняй поведение, а не текст задачи.');
        onSound('blocked');
      }
    }
    root.querySelector('#pythonContractRun').disabled=false;
    running=false;
  }

  root.querySelector('#pythonContractRun').addEventListener('click',run);
  root.querySelector('#pythonContractBack').addEventListener('click',()=>{editor.hidden=true;active=null;});
  root.querySelector('#pythonContractClose').addEventListener('click',()=>{root.hidden=true;onClose();});

  return {
    open(){editor.hidden=true;active=null;renderList();root.hidden=false;root.querySelector('#pythonContractClose').focus({preventScroll:true});},
    close(){root.hidden=true;},
    count:PYTHON_CONTRACTS.length,
  };
}
