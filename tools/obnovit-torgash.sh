#!/usr/bin/env sh
# Обновляет страницу «Тест на 1000 ₽» на бою одним файлом, без полной выкладки.
#
# Зачем: страница — снимок, Торгаш пересобирает её у себя, а Сергей смотрит с
# телефона. Гонять ради четырёх килобайт весь deploy.sh (сборка, полсотни
# тестов, rsync по всему сайту) незачем.
#
# Но мимо сторожа страница не проходит и здесь: перед отправкой гоняется
# tests/torgash-stranitsa.test.mjs — в папке ничего, кроме index.html, есть
# noindex и счётчик, нет внешних адресов, полей ввода и похожего на ключи.
# Красный тест останавливает отправку. Обход выкладки не должен быть обходом
# проверки.
#
#   sh tools/obnovit-torgash.sh
#
# Имя папки живёт ОДНОЙ строкой ниже: адрес со случайным хвостом менялся уже
# раз, и второй переезд должен быть правкой в одном месте, а не поиском по
# восьми. Те же имена стоят в deploy.sh (PAYLOAD), verify.sh
# (PRIVATE_TEST_DIRS), .gitignore и в тесте — их правят вместе.
#
# Имена переменных латиницей: POSIX-оболочка кириллические не принимает.
set -eu

DIR="torgash-gnjeev4lb7"

HERE="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${TORGASH_SRC:-$HOME/dev/laboratoriya-resheniy/vitrina/index.html}"
HOST="${DEPLOY_HOST:-bonita}"
ROOT="${DEPLOY_ROOT:-/opt/zakriva/caddy/site}"
ADRES="https://aka-gst.ru/$DIR/"

[ -f "$SRC" ] || { echo "!! нет исходного файла $SRC — Торгаш его не собрал?" >&2; exit 1; }

cd "$HERE"
mkdir -p "$DIR"

# Порядок важен: сторож смотрит на файл в дереве, поэтому кандидат
# подкладывается временно, а прежний откладывается и возвращается при красном.
# Иначе порченый исходник портит местный файл, хотя на бой и не уходит —
# поймано отрицательным контролем 6 сентября 2026.
BYLO=""
if [ -f "$DIR/index.html" ]; then
  BYLO=$(mktemp /tmp/torgash-bylo.XXXXXX)
  cp "$DIR/index.html" "$BYLO"
fi
cp "$SRC" "$DIR/index.html"
cmp -s "$SRC" "$DIR/index.html" || { echo "!! копия разошлась с исходником" >&2; exit 1; }
echo "взято из $SRC ($(wc -c < "$DIR/index.html" | tr -d ' ') байт)"

if ! node --test tests/torgash-stranitsa.test.mjs > /tmp/torgash-test.$$ 2>&1; then
  echo "!! сторож страницы красный — на бой не отправляю:" >&2
  grep -E 'not ok|AssertionError|беды|\+ актуальн|- ожидан' /tmp/torgash-test.$$ | head -12 >&2
  rm -f /tmp/torgash-test.$$
  if [ -n "$BYLO" ]; then
    cp "$BYLO" "$DIR/index.html"
    rm -f "$BYLO"
    echo "прежняя страница возвращена на место" >&2
  else
    rm -f "$DIR/index.html"
    echo "кандидат убран, страницы в дереве не было" >&2
  fi
  exit 1
fi
rm -f /tmp/torgash-test.$$
[ -n "$BYLO" ] && rm -f "$BYLO"
echo "сторож зелёный"

rsync -az --omit-dir-times "$DIR/index.html" "$HOST:$ROOT/$DIR/index.html"

# Сверка боя по содержимому, а не по «rsync прошёл» (правило 3). Сеть даёт
# обрывы — потому три попытки.
i=1
while [ $i -le 3 ]; do
  if curl -s --max-time 15 -o /tmp/torgash-boy.$$ "$ADRES"; then break; fi
  i=$((i + 1))
  sleep 2
done
if cmp -s /tmp/torgash-boy.$$ "$DIR/index.html"; then
  echo "на бою совпадает побайтно: $ADRES"
else
  echo "!! на бою НЕ совпадает с отправленным — смотреть руками" >&2
  rm -f /tmp/torgash-boy.$$
  exit 1
fi
rm -f /tmp/torgash-boy.$$

# Отрицательный контроль тут же: внутренние файлы теста наружу не уехали.
for f in sdelki.jsonl nastroyki-testa.json zhurnal-signalov.jsonl storozh.log; do
  kod=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://aka-gst.ru/$DIR/$f")
  [ "$kod" = "404" ] || { echo "!! /$DIR/$f отдаёт $kod вместо 404" >&2; exit 1; }
done
echo "внутренние файлы теста дают 404"

# И вторая половина того же: прежний, угадываемый адрес не должен отвечать.
# Ради этого хвост и заводили — если старый путь жив, хвост бесполезен.
kod=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 https://aka-gst.ru/torgash/)
[ "$kod" = "404" ] || { echo "!! прежний /torgash/ отдаёт $kod вместо 404 — снять с сервера" >&2; exit 1; }
echo "прежний /torgash/ снят: 404"
