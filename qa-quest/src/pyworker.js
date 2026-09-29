/*
 * Изолированный воркер с настоящим CPython (Pyodide).
 * Это module worker: Pyodide подгружается динамическим import().
 * Главный поток не блокируется, а бесконечный цикл ученика
 * останавливается трассировщиком, а не перезагрузкой страницы.
 */

let pyodide = null;
let loading = null;
let config = {
  version: '314.0.6',
  base: null,
};

function cdnBase() {
  return config.base || `https://cdn.jsdelivr.net/pyodide/v${config.version}/full/`;
}

const HARNESS = String.raw`
import builtins, io, json, re, sys, time, traceback

class _QuestTimeout(Exception):
    pass


_HINTS = {
    'NameError': 'Python не знает такого имени. Проверь опечатку и то, что переменная создана выше по коду.',
    'SyntaxError': 'Python не смог прочитать строку. Чаще всего забыто двоеточие, кавычка или закрывающая скобка.',
    'IndentationError': 'Сбит отступ. Внутри if, for, while и def строки сдвигаются на четыре пробела.',
    'TabError': 'В отступах смешались пробелы и табуляция. Оставь только пробелы.',
    'TypeError': 'Операция применена к неподходящему типу. Часто это сложение строки с числом: нужен str() или int().',
    'ValueError': 'Тип подходит, а само значение — нет. Например, int("привет") превратить нельзя.',
    'ZeroDivisionError': 'Деление на ноль. Проверь делитель перед делением.',
    'IndexError': 'Такого номера в списке нет. Нумерация начинается с 0, последний элемент — len(x) - 1.',
    'KeyError': 'В словаре нет такого ключа. Проверь написание или используй .get().',
    'AttributeError': 'У этого объекта нет такого метода. Проверь тип значения и название метода.',
    'ModuleNotFoundError': 'Модуль недоступен в браузерной версии Python. В уроках он не нужен.',
    'EOFError': 'Программа просит ввод, а вводить нечего. В этом уроке input() не используется.',
    'RecursionError': 'Функция вызывает саму себя без условия остановки.',
}


def _tracer_factory(deadline):
    ticks = [0]

    def tracer(frame, event, arg):
        ticks[0] += 1
        if ticks[0] % 1200 == 0 and time.monotonic() > deadline:
            raise _QuestTimeout()
        return tracer

    return tracer


def _format_syntax_error(exc):
    line = getattr(exc, 'lineno', None)
    text = (getattr(exc, 'text', None) or '').rstrip('\n')
    offset = getattr(exc, 'offset', None) or 0
    parts = ['%s: %s' % (type(exc).__name__, exc.msg)]
    if line:
        parts.append('строка %d' % line)
    if text:
        parts.append('  ' + text)
        if offset and offset <= len(text) + 1:
            parts.append('  ' + ' ' * (offset - 1) + '^')
    return '\n'.join(parts), line


def _format_error(exc):
    kind = type(exc).__name__
    if isinstance(exc, _QuestTimeout):
        return {
            'type': 'Timeout',
            'text': 'Программа работала слишком долго и была остановлена.',
            'hint': 'Обычно это бесконечный цикл: проверь, что условие while когда-нибудь становится ложным.',
            'line': None,
        }
    if isinstance(exc, SyntaxError):
        text, line = _format_syntax_error(exc)
        return {'type': kind, 'text': text, 'hint': _HINTS.get(kind), 'line': line}
    frames = [f for f in traceback.extract_tb(exc.__traceback__) if f.filename == 'solution.py']
    line = frames[-1].lineno if frames else None
    lines = ['%s: %s' % (kind, exc)]
    for frame in frames:
        source = (frame.line or '').strip()
        lines.append('  строка %d%s' % (frame.lineno, ': ' + source if source else ''))
    return {'type': kind, 'text': '\n'.join(lines), 'hint': _HINTS.get(kind), 'line': line}


def _normalize(value, spec):
    if not isinstance(value, str):
        return value
    if spec.get('strip', True):
        value = value.strip()
    if spec.get('collapse'):
        value = re.sub(r'[ \t]+', ' ', value)
        value = re.sub(r'\n{2,}', '\n', value)
    if spec.get('ignore_case'):
        value = value.lower()
    return value


def _short(value, limit=120):
    try:
        text = repr(value)
    except Exception:
        text = '<значение не показать>'
    if len(text) > limit:
        text = text[:limit - 1] + '…'
    return text


def _same(actual, expected, spec):
    approx = spec.get('approx')
    if approx is not None and isinstance(actual, (int, float)) and isinstance(expected, (int, float)):
        return abs(actual - expected) <= approx
    if isinstance(expected, list) and isinstance(actual, tuple):
        actual = list(actual)
    return actual == expected


def _check_stdout(ns, stdout, spec):
    mode = spec.get('mode', 'contains')
    actual = _normalize(stdout, spec)
    if mode == 'equals':
        expected = _normalize(spec['value'], spec)
        return actual == expected, 'в терминале: %s' % _short(stdout.strip())
    if mode == 'contains':
        needles = spec.get('values') or [spec['value']]
        missing = [n for n in needles if _normalize(n, spec) not in actual]
        detail = 'не хватает в выводе: %s' % ', '.join(_short(m, 40) for m in missing) if missing else ''
        return not missing, detail
    if mode == 'absent':
        needles = spec.get('values') or [spec['value']]
        found = [n for n in needles if _normalize(n, spec) in actual]
        return not found, ('лишнее в выводе: %s' % ', '.join(_short(f, 40) for f in found)) if found else ''
    if mode == 'regex':
        flags = re.IGNORECASE if spec.get('ignore_case') else 0
        return bool(re.search(spec['value'], stdout, flags)), 'в терминале: %s' % _short(stdout.strip())
    if mode == 'lines':
        expected = [_normalize(x, spec) for x in spec['value']]
        actual_lines = [_normalize(x, spec) for x in stdout.strip().splitlines() if x.strip()]
        return actual_lines == expected, 'строки вывода: %s' % _short(actual_lines)
    raise ValueError('неизвестный режим stdout: %s' % mode)


def _check_var(ns, stdout, spec):
    name = spec['name']
    if name not in ns:
        return False, 'переменная %s не создана' % name
    value = ns[name]
    if 'equals' in spec:
        return _same(value, spec['equals'], spec), '%s = %s' % (name, _short(value))
    if 'type' in spec:
        return type(value).__name__ == spec['type'], '%s имеет тип %s' % (name, type(value).__name__)
    if spec.get('truthy'):
        return bool(value), '%s = %s' % (name, _short(value))
    if 'min_len' in spec:
        try:
            return len(value) >= spec['min_len'], '%s содержит %d элементов' % (name, len(value))
        except TypeError:
            return False, '%s не коллекция' % name
    return True, ''


def _check_call(ns, stdout, spec):
    name = spec['fn']
    fn = ns.get(name)
    if not callable(fn):
        return False, 'функция %s не определена' % name
    args = spec.get('args', [])
    kwargs = spec.get('kwargs', {})
    call_repr = '%s(%s)' % (name, ', '.join([_short(a, 30) for a in args] + ['%s=%s' % (k, _short(v, 30)) for k, v in kwargs.items()]))
    if 'raises' in spec:
        try:
            fn(*args, **kwargs)
        except Exception as exc:
            ok = type(exc).__name__ == spec['raises']
            return ok, '%s вызвал %s' % (call_repr, type(exc).__name__)
        return False, '%s не вызвал %s' % (call_repr, spec['raises'])
    captured = io.StringIO()
    saved = sys.stdout
    sys.stdout = captured
    try:
        result = fn(*args, **kwargs)
    except Exception as exc:
        return False, '%s упал с ошибкой %s: %s' % (call_repr, type(exc).__name__, exc)
    finally:
        sys.stdout = saved
    if 'prints' in spec:
        printed = captured.getvalue()
        return spec['prints'] in printed, '%s напечатал %s' % (call_repr, _short(printed.strip()))
    if 'equals' in spec:
        return _same(result, spec['equals'], spec), '%s вернул %s' % (call_repr, _short(result))
    return result is not None, '%s вернул %s' % (call_repr, _short(result))


def _check_source(ns, stdout, spec):
    source = ns['__quest_source__']
    flags = re.MULTILINE | (re.IGNORECASE if spec.get('ignore_case') else 0)
    found = bool(re.search(spec['pattern'], source, flags))
    if spec.get('absent'):
        return not found, spec.get('detail', '')
    return found, spec.get('detail', '')


def _check_py(ns, stdout, spec):
    scope = dict(ns)
    scope['stdout'] = stdout
    return bool(eval(spec['expr'], scope)), spec.get('detail', '')


_CHECKERS = {
    'stdout': _check_stdout,
    'var': _check_var,
    'call': _check_call,
    'source': _check_source,
    'py': _check_py,
}


def _quest_run(payload):
    request = json.loads(payload)
    source = request['source']
    preamble = request.get('preamble') or ''
    checks = request.get('checks') or []
    stdin_lines = list(request.get('stdin') or [])
    limit = float(request.get('timeLimit', 8))
    event_var = request.get('eventVar') or ''

    ns = {'__name__': '__main__', '__quest_source__': source}
    buffer = io.StringIO()

    def fake_input(prompt=''):
        if prompt:
            print(prompt, end='')
        if not stdin_lines:
            raise EOFError('нет данных для input()')
        value = stdin_lines.pop(0)
        print(value)
        return value

    saved_out, saved_err, saved_input = sys.stdout, sys.stderr, builtins.input
    sys.stdout = buffer
    sys.stderr = buffer
    builtins.input = fake_input
    error = None
    started = time.monotonic()
    # Стенд урока выполняется до решения и в том же пространстве имён:
    # ученик получает готовый объект тестирования, а нумерация строк
    # в его собственном файле не сдвигается.
    if preamble:
        exec(compile(preamble, 'stand.py', 'exec'), ns)
    try:
        code = compile(source, 'solution.py', 'exec')
    except SyntaxError as exc:
        error = _format_error(exc)
    else:
        sys.settrace(_tracer_factory(started + limit))
        try:
            exec(code, ns)
        except BaseException as exc:
            error = _format_error(exc)
        finally:
            sys.settrace(None)
    sys.stdout, sys.stderr, builtins.input = saved_out, saved_err, saved_input

    stdout = buffer.getvalue()
    events = []
    if error is None and event_var:
        try:
            raw_events = ns.get(event_var, [])
            if not isinstance(raw_events, list) or len(raw_events) > 32:
                raise ValueError('invalid world event list')
            events = json.loads(json.dumps(raw_events))
        except Exception as exc:
            error = {
                'type': 'WorldEventError',
                'text': 'Мир не принял команды Python: %s' % exc,
                'hint': 'Команды миру должны быть обычным списком из простых значений.',
                'line': None,
            }
    results = []
    for spec in checks:
        if error is not None:
            results.append({'ok': False, 'detail': ''})
            continue
        checker = _CHECKERS.get(spec.get('kind', 'stdout'))
        if checker is None:
            results.append({'ok': False, 'detail': 'неизвестная проверка'})
            continue
        try:
            ok, detail = checker(ns, stdout, spec)
        except Exception as exc:
            ok, detail = False, 'проверка не выполнилась: %s' % exc
        results.append({'ok': bool(ok), 'detail': detail})

    return json.dumps({
        'stdout': stdout,
        'events': events,
        'error': error,
        'checks': results,
        'ms': int((time.monotonic() - started) * 1000),
    })
`;

async function ensurePyodide() {
  if (pyodide) return pyodide;
  if (loading) return loading;
  loading = (async () => {
    const base = cdnBase();
    self.postMessage({ type: 'progress', stage: 'download', text: 'Загружаю Python в браузер' });
    const { loadPyodide } = await import(/* @vite-ignore */ base + 'pyodide.mjs');
    pyodide = await loadPyodide({
      indexURL: base,
      stdout: () => {},
      stderr: () => {},
    });
    self.postMessage({ type: 'progress', stage: 'harness', text: 'Готовлю проверки' });
    pyodide.runPython(HARNESS);
    self.postMessage({ type: 'ready', version: pyodide.version });
    return pyodide;
  })();
  try {
    return await loading;
  } catch (error) {
    loading = null;
    throw error;
  }
}

self.onmessage = async (event) => {
  const message = event.data || {};
  if (message.type === 'configure') {
    config = { ...config, ...message.config };
    return;
  }
  if (message.type === 'init') {
    try {
      await ensurePyodide();
    } catch (error) {
      self.postMessage({ type: 'fatal', message: String(error && error.message || error) });
    }
    return;
  }
  if (message.type === 'run') {
    const { id, source, preamble, checks, stdin, eventVar, timeLimit } = message;
    try {
      const py = await ensurePyodide();
      py.globals.set('__quest_request__', JSON.stringify({ source, preamble, checks, stdin, eventVar, timeLimit }));
      const raw = py.runPython('_quest_run(__quest_request__)');
      self.postMessage({ type: 'result', id, result: JSON.parse(raw) });
    } catch (error) {
      self.postMessage({
        type: 'result',
        id,
        result: {
          stdout: '',
          events: [],
          error: { type: 'RunnerError', text: String(error && error.message || error), hint: null, line: null },
          checks: (checks || []).map(() => ({ ok: false, detail: '' })),
          ms: 0,
        },
      });
    }
  }
};
