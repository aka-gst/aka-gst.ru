#!/usr/bin/env sh
# Обновляет /torgash/ на бою одним файлом, без полной выкладки.
#
# Зачем: страница «Тест на 1000 ₽» — снимок, Торгаш пересобирает её у себя,
# а Сергей смотрит с телефона. Гонять ради 4 килобайт весь deploy.sh (сборка,
# 49 тестов, rsync по всему сайту) незачем.
#
# Но мимо сторожа страница не проходит и здесь: перед отправкой гоняется
# tests/torgash-stranitsa.test.mjs — в папке ничего, кроме index.html, есть
# noindex и счётчик, нет внешних адресов, полей ввода и похожего на ключи.
# Красный тест останавливает отправку. Это та же калитка, что в deploy.sh,
# просто узкая: обход выкладки не должен быть обходом проверки.
#
#   sh tools/obnovit-torgash.sh
#
# Имена переменных латиницей: POSIX-оболочка кириллические не принимает.
set -eu

HERE="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${TORGASH_SRC:-$HOME/dev/laboratoriya-resheniy/vitrina/index.html}"
HOST="${DEPLOY_HOST:-bonita}"
ROOT="${DEPLOY_ROOT:-/opt/zakriva/caddy/site}"

[ -f "$SRC" ] || { echo "!! нет исходного файла $SRC — Торгаш его не собрал?" >&2; exit 1; }

cd "$HERE"
mkdir -p torgash

# Порядок важен: сторож смотрит на torgash/index.html, поэтому кандидат
# подкладывается временно, а прежний файл откладывается и возвращается при
# красном. Иначе порченый исходник портит местный файл, хотя на бой и не
# уходит — поймано отрицательным контролем 6 сентября 2026, когда сторож
# честно отказал, а страница у меня осталась с чужим адресом внутри.
BYLO=""
if [ -f torgash/index.html ]; then
  BYLO=$(mktemp /tmp/torgash-bylo.XXXXXX)
  cp torgash/index.html "$BYLO"
fi
cp "$SRC" torgash/index.html
cmp -s "$SRC" torgash/index.html || { echo "!! копия разошлась с исходником" >&2; exit 1; }
echo "взято из $SRC ($(wc -c < torgash/index.html | tr -d ' ') байт)"

if ! node --test tests/torgash-stranitsa.test.mjs > /tmp/torgash-test.$$ 2>&1; then
  echo "!! сторож страницы красный — на бой не отправляю:" >&2
  grep -E 'not ok|AssertionError|беды|\+ актуальн|- ожидан' /tmp/torgash-test.$$ | head -12 >&2
  rm -f /tmp/torgash-test.$$
  if [ -n "$BYLO" ]; then
    cp "$BYLO" torgash/index.html
    rm -f "$BYLO"
    echo "прежняя страница возвращена на место" >&2
  else
    rm -f torgash/index.html
    echo "кандидат убран, страницы в дереве не было" >&2
  fi
  exit 1
fi
rm -f /tmp/torgash-test.$$
[ -n "$BYLO" ] && rm -f "$BYLO"
echo "сторож зелёный"

rsync -az --omit-dir-times torgash/index.html "$HOST:$ROOT/torgash/index.html"

# Сверка боя по содержимому, а не по «rsync прошёл» (правило 3). Сеть даёт
# обрывы — потому три попытки.
i=1
while [ $i -le 3 ]; do
  if curl -s --max-time 15 -o /tmp/torgash-boy.$$ https://aka-gst.ru/torgash/; then break; fi
  i=$((i + 1))
  sleep 2
done
if cmp -s /tmp/torgash-boy.$$ torgash/index.html; then
  echo "на бою совпадает побайтно: https://aka-gst.ru/torgash/"
else
  echo "!! на бою НЕ совпадает с отправленным — смотреть руками" >&2
  rm -f /tmp/torgash-boy.$$
  exit 1
fi
rm -f /tmp/torgash-boy.$$

# Отрицательный контроль тут же: внутренние файлы теста наружу не уехали.
for f in sdelki.jsonl nastroyki-testa.json; do
  kod=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://aka-gst.ru/torgash/$f")
  [ "$kod" = "404" ] || { echo "!! /torgash/$f отдаёт $kod вместо 404" >&2; exit 1; }
done
echo "внутренние файлы теста дают 404"
