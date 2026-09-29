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
#   sh sync-portfolio.sh --deploy   и передать выкладку общему белому списку
#
# data/ остаётся только источником сборки: наружу её не копируем. Раньше этот
# скрипт обходил общий белый список и рекурсивно публиковал весь data/, включая
# любой новый внутренний файл. Теперь единственная дверь наружу — deploy.sh.
set -eu

DEPLOY=no
[ "${1:-}" = "--deploy" ] && DEPLOY=yes
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
echo "выкладка только через общий белый список deploy.sh"
exec sh "$HERE/deploy.sh" --go
