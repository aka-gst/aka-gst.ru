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
assets
data
praktikum
acid
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

echo
echo "== Caddyfile: сверка с живым =="
# Конфиг правят несколько проектов. Выложить собранный у себя — значит
# молча снести чужие маршруты; однажды так уехали звонки.
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
if scp -q "$HOST:/opt/zakriva/caddy/Caddyfile" "$tmp" 2>/dev/null; then
  # Опасна только одна разница: строки, которые есть на сервере и нет у нас.
  # Их выкладка сотрёт. Собственные добавления — обычное дело.
  theirs=$(diff Caddyfile "$tmp" | grep '^>' || true)
  mine=$(diff Caddyfile "$tmp" | grep '^<' || true)
  if [ -z "$theirs" ] && [ -z "$mine" ]; then
    echo "  совпадает с живым"
  elif [ -z "$theirs" ]; then
    echo "  ваш файл впереди живого, чужого ничего не теряется:"
    printf '%s\n' "$mine" | sed 's/^</    +/' | head -20
  else
    echo "  ОСТОРОЖНО: на сервере есть строки, которых у вас нет."
    echo "  Выкладка конфига их сотрёт:"
    printf '%s\n' "$theirs" | sed 's/^>/    -/' | head -20
    echo "  Перенесите их к себе и закоммитьте, прежде чем выкладывать конфиг."
    if $caddy; then echo "  --caddy отменён." >&2; exit 1; fi
  fi
else
  echo "  не удалось забрать живой файл — конфиг не трогаю"
  caddy=false
fi

echo
echo "== содержимое сайта =="
# --delete-excluded не используем: coin/, lines/ и knb/ выкладываются
# из своих репозиториев и в этом дереве отсутствуют.
if $go; then
  # shellcheck disable=SC2086
  rsync -avz $PAYLOAD "$HOST:$ROOT/"
else
  # shellcheck disable=SC2086
  rsync -avzn --itemize-changes $PAYLOAD "$HOST:$ROOT/" | sed 's/^/  /'
  echo
  echo "  (черновой прогон; повторите с --go)"
fi

if $caddy && $go; then
  echo
  echo "== конфиг Caddy =="
  scp Caddyfile "$HOST:/opt/zakriva/caddy/Caddyfile"
  ssh "$HOST" 'docker exec caddy caddy validate --config /etc/caddy/Caddyfile \
    && docker exec caddy caddy reload --config /etc/caddy/Caddyfile'
fi
