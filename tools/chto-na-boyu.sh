#!/usr/bin/env sh
# Что сейчас на живом сайте — одной командой, без вопросов к сессии.
#
# Заведено 4 сентября 2026. За один вечер картина боя у связного отстала
# ТРИЖДЫ: он верил последнему письму, а письма отстают на коммит. Механизм
# «спроси у сессии сайта» это не чинит: сессии живут меньше суток, и через
# день спрашивать будет некого. Поэтому команда, а не договорённость.
#
#   sh tools/chto-na-boyu.sh
#
# Печатает только то, что уже путали: где ветка, где бой, сходятся ли они,
# и два факта, которые расходились чаще всего.
#
# Имена переменных латиницей: POSIX-оболочка падает на кириллице в имени.
set -eu
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"
SITE="${SITE:-https://aka-gst.ru}"
RETRY="--retry 3 --retry-delay 1 --max-time 30"

echo "== ветка =="
git fetch -q origin 2>/dev/null || echo "  (fetch не прошёл, показываю известное)"
printf "  main:   %s\n" "$(git log -1 --oneline main 2>/dev/null || echo '—')"
printf "  origin: %s\n" "$(git log -1 --oneline origin/main 2>/dev/null || echo '—')"
if [ "$(git rev-parse main 2>/dev/null || echo a)" != "$(git rev-parse origin/main 2>/dev/null || echo b)" ]; then
  echo "  ВНИМАНИЕ: ветка и origin разошлись"
fi

echo
echo "== бой против ветки =="
# Сверяем содержимое, а не код ответа: 200 не значит «то самое».
# Хеш пустоты — сюда попадает всё, что не доехало. Без этой строки
# несуществующий адрес выглядел бы как «файл просто другой».
PUSTO=$(printf '' | shasum -a 256 | cut -d' ' -f1)
sovpalo=0; razoshlos=0; pustyh=0; heshi=''
for f in index.html assets/app.js assets/read.js assets/site.css rasskazy/index.html; do
  # shellcheck disable=SC2086
  zhivoy=$(curl -s $RETRY "$SITE/$f" 2>/dev/null | shasum -a 256 | cut -d' ' -f1)
  vetka=$(git show "main:$f" 2>/dev/null | shasum -a 256 | cut -d' ' -f1)
  heshi="$heshi $zhivoy"
  if [ "$zhivoy" = "$PUSTO" ]; then
    printf "  ПУСТО %-24s ответ пустой — сеть или адрес\n" "$f"; pustyh=$((pustyh + 1))
  elif [ -z "$vetka" ] || [ "$vetka" = "$PUSTO" ]; then
    printf "  ?     %-24s в ветке файла нет\n" "$f"
  elif [ "$zhivoy" = "$vetka" ]; then
    printf "  ok    %-24s\n" "$f"; sovpalo=$((sovpalo + 1))
  else
    printf "  РАЗНО %-24s бой %s / ветка %s\n" "$f" "$(echo "$zhivoy" | cut -c1-8)" "$(echo "$vetka" | cut -c1-8)"
    razoshlos=$((razoshlos + 1))
  fi
done
# Пять РАЗНЫХ файлов с ОДНИМ хешем — это не пять расхождений, а одна страница
# 404, отданная на всё подряд. Без этой проверки инструмент уверенно врёт.
raznyh=$(printf '%s' "$heshi" | tr ' ' '\n' | grep -v '^$' | sort -u | wc -l | tr -d ' ')
if [ "$raznyh" -eq 1 ] && [ "$pustyh" -eq 0 ]; then
  echo "  ПРОВАЛ: все файлы отдают ОДНО И ТО ЖЕ — похоже, адрес отвечает заглушкой"
  exit 1
fi
[ "$pustyh" -eq 0 ] || { echo "  ПРОВАЛ: $pustyh файлов не доехало — сверять нечего"; exit 1; }
[ "$((sovpalo + razoshlos))" -gt 0 ] || { echo "  ПРОВАЛ: не сверено ни одного файла"; exit 1; }

echo
echo "== два факта, которые чаще всего расходились =="
# shellcheck disable=SC2086
app=$(curl -s $RETRY "$SITE/assets/app.js" 2>/dev/null || echo '')
# shellcheck disable=SC2086
read_js=$(curl -s $RETRY "$SITE/assets/read.js" 2>/dev/null || echo '')
# ПРИМЕТА ПЕРЕД ПОИСКОМ. На мёртвом адресе прежний вариант печатал
# «прокрутка мгновенная везде» из пустого файла — зелёное утверждение о
# том, чего не видел. Нет приметы, значит мерить нечего.
if printf '%s' "$app" | grep -q 'data-track-to' && printf '%s' "$read_js" | grep -q 'book-toggle'; then
  PLAVNO="'smooth'|\"smooth\"|scroll-behavior[[:space:]]*:[[:space:]]*smooth"
  n=$(printf '%s%s' "$app" "$read_js" | grep -cE "$PLAVNO" 2>/dev/null || true); n=${n:-0}
  if [ "$n" -eq 0 ]; then echo "  прокрутка: мгновенная везде (плавности 0)"
  else echo "  прокрутка: ПЛАВНАЯ в $n местах"; fi
else
  echo "  прокрутка: НЕ ПРОВЕРЕНО — файлы не те или не доехали"
fi

echo "  карточки игр (версия заглушки и петли):"
# shellcheck disable=SC2086
curl -s $RETRY "$SITE/" 2>/dev/null \
  | grep -oE '(game|clip)-[a-z0-9-]+\.(jpg|mp4)\?v=[a-f0-9]{8}' \
  | sort -u | sed 's/^/    /' | head -30

echo
echo "  (сверялось содержимое по хешам, а не код ответа)"
