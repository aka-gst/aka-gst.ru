#!/usr/bin/env sh
# Выкладка с сохранением путей и обязательной сверкой по бою.
#
# Заведено 31 августа 2026 после двух поломок подряд, обеих одной причины:
# rsync берёт от аргумента только имя, а не путь.
#   * `rsync assets/shots dest/` положил папку в КОРЕНЬ сайта как /shots/ —
#     19 лишних файлов, а измеряемое так и не доехало, и замер трижды дал
#     одно и то же число на трёх разных файлах;
#   * `rsync praktikum/index.html dest/` затёр ГЛАВНУЮ страницу сайта
#     страницей практикума. Восемь минут на aka-gst.ru лежало не то.
# Оба раза rsync отчитался успехом: он сделал ровно то, о чём его просили.
#
# Поэтому здесь всегда -R, чтобы пути повторялись на сервере как есть, и
# всегда сверка хешей после. «Отправлено» не значит «доехало», а «доехало»
# не значит «то самое».
#
# Имена переменных латиницей намеренно: POSIX-оболочка не принимает
# кириллицу в имени и падает на первом же присваивании (правило 6б).
#
#   sh tools/vylozhit.sh index.html assets rasskazy
#   sh tools/vylozhit.sh --vse        всё дерево по белому списку
set -eu
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"
# Адрес и цель переопределяются извне: без этого красную ветку сверки
# нельзя проверить поломкой — скрипт сперва везёт, потом сверяет, и на
# боевом адресе всегда сходится.
DEST="${DEST:-bonita:/opt/zakriva/caddy/site/}"
SITE="${SITE:-https://aka-gst.ru}"

if [ "${1:-}" = "--vse" ]; then
  set -- index.html 404.html 503.html assets rasskazy praktikum psy-admin photodata \
         qa-quest technomagic test leela zoo puzzle-quest robots.txt sitemap.xml sitemap-pages.xml og.png favicon.svg \
         game-menu.css player-name.js
fi
[ $# -gt 0 ] || { echo "  что выкладываем? имена файлов и папок от корня репозитория"; exit 2; }

LIST=""
needs_psy_admin_guard=0
for x in "$@"; do
  [ -e "$x" ] || { echo "  нет такого: $x"; exit 2; }
  LIST="$LIST ./${x#./}"
  case "${x#./}" in
    psy-admin|psy-admin/*) needs_psy_admin_guard=1 ;;
  esac
done

if [ "$needs_psy_admin_guard" -eq 1 ]; then
  echo "== PsyAdmin: защита от старой выкладки =="
  node psy-admin/tools/release-guard.mjs --live-base "$SITE"
fi

n=1
while [ "$n" -le 3 ]; do
  # shellcheck disable=SC2086
  if rsync -avzR --timeout=120 -e "ssh -o ConnectTimeout=25" \
      --exclude='proizvodnye.json' --exclude='README.md' \
      --exclude='*test*.mjs' --exclude='*.test.js' --exclude='tests/' --exclude='tools/' \
      --exclude='docs/' --exclude='trash/' --exclude='.git*' --exclude='*.md' \
      --exclude='node_modules/' --exclude='.claude/' \
      $LIST "$DEST" >/dev/null 2>&1; then
    break
  fi
  n=$((n + 1))
  sleep 5
done
[ "$n" -le 3 ] || { echo "  rsync не прошёл трижды"; exit 1; }

echo "== сверка по бою =="
bad=0
seen=0
for x in "$@"; do
  if [ -d "$x" ]; then
    files=$(find "$x" -type f \( -name '*.html' -o -name '*.css' -o -name '*.js' \) | head -12)
  else
    files="$x"
  fi
  for f in $files; do
    seen=$((seen + 1))
    a=$(shasum -a 256 "$f" | cut -c1-12)
    b=$(curl -s --retry 3 --retry-all-errors --max-time 40 \
        "$SITE/${f#./}?svezho=$(date +%s)" | shasum -a 256 | cut -c1-12)
    if [ "$a" = "$b" ]; then
      printf '  ok    %s\n' "$f"
    else
      printf '  FAIL  %s — дерево %s, бой %s\n' "$f" "$a" "$b"
      bad=$((bad + 1))
    fi
  done
done
# Ноль сверенных файлов — это не успех, а молчание меры.
[ "$seen" -gt 0 ] || { echo "  нечего было сверять"; exit 1; }
[ "$bad" -eq 0 ] || { echo "  не доехало: $bad из $seen"; exit 1; }
echo "  всё доехало: $seen"
