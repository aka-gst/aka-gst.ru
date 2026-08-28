#!/usr/bin/env sh
# Refresh everything the site serves but does not author.
#
#   praktikum/testirovanie/  <- agent-lab/web
#   praktikum/llm/           <- ai-agent-service-lab/web
#   data/qa-metrics.json     <- the published CI feed, kept as the offline
#                               fallback the first screen renders before fetch
#   robots.txt, sitemap.xml  <- индекс карт сайта для поисковиков
#
# Run it after rebuilding a practicum or after a gateway release.
#
#   sh sync-portfolio.sh            обновить локальное дерево
#   sh sync-portfolio.sh --deploy   и выложить praktikum/ и data/ на сервер
#
# Выкладка трогает только эти два каталога. index.html, Caddyfile и остальной
# сайт собираются и выкладываются отдельно — здесь они намеренно не участвуют.
set -eu

DEPLOY=no
[ "${1:-}" = "--deploy" ] && DEPLOY=yes
SSH_HOST="${SSH_HOST:-bonita}"
SITE_ROOT="${SITE_ROOT:-/opt/zakriva/caddy/site}"

HERE="$(cd "$(dirname "$0")" && pwd)"
DEV="${DEV_ROOT:-$HOME/dev}"

sync_course() {
  source_dir="$1"
  target_dir="$2"
  if [ ! -d "$source_dir" ]; then
    echo "пропущено: нет $source_dir" >&2
    return 0
  fi
  mkdir -p "$target_dir"
  rsync --archive --delete "$source_dir/" "$target_dir/"
  echo "синхронизировано: $target_dir"
}

sync_course "$DEV/agent-lab/web" "$HERE/praktikum/testirovanie"
sync_course "$DEV/ai-agent-service-lab/web" "$HERE/praktikum/llm"

FEED="https://aka-gst.github.io/local-agent-gateway"
mkdir -p "$HERE/data"
for file in qa-metrics.json qa-metrics-history.json; do
  if curl --fail --silent --show-error --location "$FEED/$file" --output "$HERE/data/$file.new"; then
    mv "$HERE/data/$file.new" "$HERE/data/$file"
    echo "обновлён снимок: data/$file"
  else
    rm -f "$HERE/data/$file.new"
    echo "пропущено: $FEED/$file не ответил, оставлен прежний снимок" >&2
  fi
done

[ "$DEPLOY" = yes ] || exit 0

echo
echo "выкладка на $SSH_HOST:$SITE_ROOT"

# BatchMode: без tty ssh иначе ждёт ввода и рвёт соединение по таймауту.
REMOTE_SHELL="ssh -o BatchMode=yes -o ConnectTimeout=15"

if ! rsync -az --delete -e "$REMOTE_SHELL" "$HERE/praktikum/" "$SSH_HOST:$SITE_ROOT/praktikum/"; then
  echo "ОШИБКА: praktikum не выложен" >&2
  exit 1
fi
if ! rsync -az -e "$REMOTE_SHELL" "$HERE/data/" "$SSH_HOST:$SITE_ROOT/data/"; then
  echo "ОШИБКА: data не выложена" >&2
  exit 1
fi
if ! rsync -az -e "$REMOTE_SHELL" "$HERE/robots.txt" "$HERE/sitemap.xml" "$SSH_HOST:$SITE_ROOT/"; then
  echo "ОШИБКА: robots.txt и sitemap.xml не выложены" >&2
  exit 1
fi

failed=0
for path in /praktikum/testirovanie/ /praktikum/llm/ /data/qa-metrics.json /robots.txt /sitemap.xml; do
  # Таймаут curl не должен ронять скрипт через set -e: он тут проверяющий,
  # а не исполнитель. Пустой ответ трактуем как провал проверки.
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "https://aka-gst.ru$path" || echo "нет ответа")
  printf "  %-32s %s\n" "$path" "$code"
  [ "$code" = 200 ] || failed=1
done
[ "$failed" = 0 ] || { echo "ОШИБКА: не все страницы отвечают 200" >&2; exit 1; }
