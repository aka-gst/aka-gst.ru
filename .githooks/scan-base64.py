#!/usr/bin/env python3
# Ищет личные данные, спрятанные в base64, в индексе git.
#
# Зачем: правило 7ж свода — измеритель, переставший видеть предмет, врёт стабильно
# и уверенно. Почта ушла в base64 на страницах, и plaintext-сторож пропустил её
# зелёным не потому, что знает о разрешении, а потому что ослеп. Следующее личное,
# спрятанное в base64 по ошибке, тоже прошло бы. Этот проход декодирует короткие
# base64-токены и проверяет расшифровку по тому же списку запрещённых слов.
#
# Вход (stdin): строки "path:line:token" от git grep -Ino по base64-токенам индекса.
# Аргумент 1: путь к списку (строки — запрещённые слова; allow:<значение> # пометка —
#             одобренные исключения, пропускаются ТОЛЬКО в base64, в plaintext краснеют).
# Выход (stdout): "личные данные (base64):  path:line" на каждую находку (отсортировано,
#                 без повторов). Само значение наружу не печатается (как и у pre-commit).
#
# Личных данных в самом этом файле нет: список берётся из аргумента, а не зашит.
import sys
import base64


def load_words(path):
    forbidden, allowed = [], set()
    with open(path, encoding="utf-8") as fh:
        for raw in fh:
            t = raw.strip()
            if not t or t.startswith("#"):
                continue
            if t.startswith("allow:"):
                val = t[len("allow:"):].split("#", 1)[0].strip()
                if val:
                    allowed.add(val.lower())
            else:
                forbidden.append(t.lower())
    return forbidden, allowed


def decode(tok):
    t = tok.rstrip("=")
    t += "=" * (-len(t) % 4)
    try:
        return base64.b64decode(t).decode("utf-8", "ignore").lower()
    except Exception:
        return ""


def main():
    if len(sys.argv) < 2:
        sys.stderr.write("scan-base64.py: нужен путь к списку слов\n")
        return 2
    forbidden, allowed = load_words(sys.argv[1])
    if not forbidden:
        return 0
    findings = set()
    for line in sys.stdin:
        line = line.rstrip("\n")
        parts = line.split(":", 2)
        if len(parts) != 3:
            continue
        path, lineno, tok = parts
        dec = decode(tok)
        if not dec:
            continue
        if dec in allowed:          # одобренное точным совпадением — пропускаем
            continue
        if any(w and w in dec for w in forbidden):
            findings.add("%s:%s" % (path, lineno))
    for f in sorted(findings):
        sys.stdout.write("личные данные (base64):  " + f + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
