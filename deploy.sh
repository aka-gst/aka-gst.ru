#!/usr/bin/env sh
# Выкладка сайта. По умолчанию показывает, что изменится; --go выполняет.
#
# Список того, что едет на сервер, — БЕЛЫЙ, а не чёрный. Причина: чёрный
# однажды забывает новое. Так .githooks/ с локальным списком личных данных
# оказался в веб-корне только потому, что его не догадались исключить.
# Здесь наоборот: не перечислено — не уедет.
#
#   sh deploy.sh          показать план
#   sh deploy.sh --go     выложить
#   sh deploy.sh --go --caddy   выложить и обновить конфиг Caddy

set -eu

HOST="${DEPLOY_HOST:-bonita}"
ROOT="${DEPLOY_ROOT:-/opt/zakriva/caddy/site}"
HERE="$(cd "$(dirname "$0")" && pwd)"
# Без таймаута недоступный сервер вешает выкладку на минуты.
SSHOPTS="-o ConnectTimeout=15 -o BatchMode=yes"
cd "$HERE"

go=false
caddy=false
for arg in "$@"; do
  case "$arg" in
    --go) go=true ;;
    --caddy) caddy=true ;;
    *) echo "неизвестный аргумент: $arg" >&2; exit 2 ;;
  esac
done

# Что именно отдаётся посетителю. Всё остальное остаётся дома.
# data/ здесь НЕТ намеренно. Сборка читает его из репозитория, странице он
# не нужен ни при загрузке, ни во время работы — проверено поиском по всем
# доставленным файлам. А на сервере он отдавал наружу `stories.json` с
# подписями обложек, которые владелец 31 августа 2026 просил убрать: со
# страниц мы их сняли, а из данных нет, и «сделано» было неполным пять
# часов. Не вписывать обратно.
PAYLOAD="
index.html
404.html
503.html
og.png
favicon.svg
robots.txt
sitemap.xml
sitemap-pages.xml
game-menu.css
player-name.js
tour.js
assets
praktikum
rasskazy
technomagic
qa-quest
psy-admin
photodata
"

echo "== сборка =="
node build.mjs

missing=""
for item in $PAYLOAD; do
  [ -e "$item" ] || missing="$missing $item"
done
if [ -n "$missing" ]; then
  echo "нет в дереве:$missing" >&2
  exit 1
fi

# qa-quest/vendor не версионируется: это 13 МБ бинарников Pyodide, которые
# воспроизводятся скриптом с зафиксированными контрольными суммами. Но в бою
# они нужны — без них приложение молча уходит на чужой CDN. Поэтому добываем
# ДО выкладки, а не обнаруживаем пропажу после.
VENDOR="qa-quest/vendor/pyodide"
VENDOR_FILES="pyodide.mjs pyodide.asm.mjs pyodide.asm.wasm python_stdlib.zip pyodide-lock.json"

if [ ! -f "$VENDOR/pyodide.mjs" ]; then
  echo
  echo "== qa-quest: локальной копии Pyodide нет, добываем =="
  # Версия и суммы живут в репозитории QA Quest — он им владеет. Второй копии
  # не заводим: разъехавшиеся суммы хуже отсутствующих. Путь ищем перебором,
  # потому что каталоги уже дважды переезжали.
  quest=""
  for candidate in "$HOME/dev/QA Quest" "$HOME/dev/qa-quest" "$HOME/dev/Zakriva/QA Quest"; do
    if [ -f "$candidate/tools/fetch-pyodide.sh" ]; then quest="$candidate"; break; fi
  done
  if [ -z "$quest" ]; then
    echo "ОШИБКА: не найден репозиторий QA Quest с tools/fetch-pyodide.sh." >&2
    echo "        В нём зафиксированы версия Pyodide и контрольные суммы." >&2
    echo "        Без него выкладка отправила бы браузеры посетителей на jsDelivr." >&2
    exit 1
  fi
  ( cd "$quest" && sh tools/fetch-pyodide.sh )
  mkdir -p "$VENDOR"
  cp -R "$quest/vendor/pyodide/." "$VENDOR/"
  echo "  скопировано из $quest"
fi

# Проверяем все пять, а не только точку входа: pyodide.mjs весит 18 КБ из 13 МБ,
# и его наличие ничего не говорит о судьбе wasm на 9,6 МБ.
vendor_missing=""
for file in $VENDOR_FILES; do
  [ -f "$VENDOR/$file" ] || vendor_missing="$vendor_missing $file"
done
if [ -n "$vendor_missing" ]; then
  echo "ОШИБКА: в $VENDOR не хватает:$vendor_missing" >&2
  exit 1
fi

echo
echo "== Caddyfile: сверка с живым =="
# Конфиг правят несколько проектов. Выложить собранный у себя — значит
# молча снести чужие маршруты; однажды так уехали звонки.
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
# shellcheck disable=SC2086
if scp -q $SSHOPTS "$HOST:/opt/zakriva/caddy/Caddyfile" "$tmp" 2>/dev/null; then
  # Сравниваем МАРШРУТЫ, а не строки. Построчный diff считает потерей любую
  # изменённую строку — например, file_server, переписанный на file_server
  # со статусом. Страж, который ругается по пустякам, начнут обходить, и он
  # промолчит там, где важно. Опасна ровно одна пропажа: адрес или апстрим,
  # который есть на сервере и которого нет у нас. Так уехали звонки.
  routes() {
    grep -oE '^[[:space:]]*(redir|handle|handle_path|reverse_proxy|root)[[:space:]]+[^{]*|^[a-z0-9_.*-]+([[:space:]]*,[[:space:]]*[a-z0-9_.*-]+)*[[:space:]]*\{' "$1" \
      | sed 's/^[[:space:]]*//; s/[[:space:]]*$//; s/[[:space:]]\{1,\}/ /g' | sort -u
  }
  # Через временные файлы, а не подстановкой процессов: sh её не умеет,
  # и «sh deploy.sh» падал бы на ней с кодом 0 — вызывающий решил бы,
  # что выкладка удалась.
  rmine=$(mktemp); rlive=$(mktemp)
  routes Caddyfile > "$rmine"
  routes "$tmp" > "$rlive"
  lost=$(comm -13 "$rmine" "$rlive")
  added=$(comm -23 "$rmine" "$rlive")
  rm -f "$rmine" "$rlive"

  if [ -n "$lost" ]; then
    echo "  ОСТОРОЖНО: на сервере есть маршруты, которых у вас нет."
    echo "  Выкладка конфига их сотрёт:"
    printf '%s\n' "$lost" | sed 's/^/    - /'
    echo "  Перенесите их к себе и закоммитьте, прежде чем выкладывать конфиг."
    if $caddy; then echo "  --caddy отменён." >&2; exit 1; fi
  elif [ -n "$added" ]; then
    echo "  новые маршруты у вас, на сервере ничего не теряется:"
    printf '%s\n' "$added" | sed 's/^/    + /'
  elif diff -q Caddyfile "$tmp" >/dev/null; then
    echo "  совпадает с живым"
  else
    echo "  маршруты совпадают, отличаются только настройки внутри блоков:"
    diff Caddyfile "$tmp" | grep '^<' | sed 's/^</    ~/' | head -10
  fi
else
  echo "  не удалось забрать живой файл — конфиг не трогаю"
  caddy=false
fi

echo
echo "== содержимое сайта =="
# acid/ здесь намеренно нет: игра выкладывается из github.com/aka-gst/acid-uno
# своей сессией. Моя копия отставала, и выкладка клала её поверх свежей —
# на телефоне это выглядело как «всё ещё старое».
# --delete-excluded не используем: coin/, lines/ и knb/ выкладываются
# из своих репозиториев и в этом дереве отсутствуют.
if $go; then
  # shellcheck disable=SC2086
  # shellcheck disable=SC2086
  rsync -avz --omit-dir-times --exclude='.DS_Store' --exclude='**/.gitignore' --exclude='psy-admin/tools/**' --exclude='*/vendor/**/README.md' --include='*/vendor/**' --exclude='README.md' --exclude='test.mjs' --exclude='*.test.mjs' --exclude='ФИНИШ.md' --exclude='proizvodnye.json' $PAYLOAD "$HOST:$ROOT/"
else
  # shellcheck disable=SC2086
  rsync -avzn --omit-dir-times --itemize-changes --exclude='.DS_Store' --exclude='**/.gitignore' --exclude='psy-admin/tools/**' --exclude='*/vendor/**/README.md' --include='*/vendor/**' --exclude='README.md' --exclude='test.mjs' --exclude='*.test.mjs' --exclude='ФИНИШ.md' --exclude='proizvodnye.json' $PAYLOAD "$HOST:$ROOT/" | sed 's/^/  /'
  echo
  echo "  (черновой прогон; повторите с --go)"
fi

if $caddy && $go; then
  echo
  echo "== конфиг Caddy =="
  # shellcheck disable=SC2086
  scp $SSHOPTS Caddyfile "$HOST:/opt/zakriva/caddy/Caddyfile"
  # shellcheck disable=SC2086
  ssh $SSHOPTS "$HOST" 'docker exec caddy caddy validate --config /etc/caddy/Caddyfile \
    && docker exec caddy caddy reload --config /etc/caddy/Caddyfile'
fi

if $go; then
  echo
  echo "== проверка =="
  echo "  sh verify.sh"
fi
