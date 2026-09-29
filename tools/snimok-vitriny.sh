#!/usr/bin/env sh
# Снимок всей витрины: куда ведут ссылки с главной и что там отдаётся.
#
# Заведено 4 сентября 2026 перед перезапуском Caddy. Требование Мозга:
# «правка трогает маршрутизацию целиком, и беда от неё приходит не туда, где
# чинили» — значит сверять надо не девять правленых адресов, а всё, куда
# человек может попасть с витрины.
#
#   sh tools/snimok-vitriny.sh > trash/snimok-do.txt      до правки
#   sh tools/snimok-vitriny.sh > trash/snimok-posle.txt   после
#   diff trash/snimok-do.txt trash/snimok-posle.txt       вся разница
#
# Пишет по строке на адрес: код ответа, размер и хеш содержимого. Хеш нужен
# потому, что 200 не значит «то самое»: страница может отвечать и отдавать
# чужое. Сортировка — чтобы diff показывал смысл, а не перестановку.
#
# Имена переменных латиницей: POSIX-оболочка падает на кириллице в имени.
set -eu
SITE="${SITE:-https://aka-gst.ru}"
RETRY="--retry 3 --retry-delay 1 --max-time 30"

# shellcheck disable=SC2086
glavnaya=$(curl -s $RETRY "$SITE/" || echo '')

# ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ перед разбором. Без него пустая главная даёт пустой
# список, пустой список даёт ноль расхождений, и «всё хорошо» печатается на
# том, чего не видели вовсе.
if ! printf '%s' "$glavnaya" | grep -q 'data-panel'; then
  echo "ПРОВАЛ: главная не доехала или это не она — приметы data-panel нет"
  exit 1
fi

# Собираем внутренние адреса: и обычные ссылки, и цели карточек.
adresa=$(printf '%s' "$glavnaya" \
  | grep -oE 'href="/[^"#?]*"' \
  | sed 's/href="//;s/"$//' \
  | grep -vE '^/$' \
  | sort -u)

n=$(printf '%s\n' "$adresa" | grep -c . || true)
[ "${n:-0}" -gt 5 ] || { echo "ПРОВАЛ: с витрины собрано всего ${n:-0} адресов — разбор сломан"; exit 1; }

echo "# снимок витрины, адресов: $n"
for a in $adresa; do
  # shellcheck disable=SC2086
  telo=$(curl -s $RETRY "$SITE$a" || echo '')
  # shellcheck disable=SC2086
  kod=$(curl -s -o /dev/null -w '%{http_code}' $RETRY "$SITE$a" || echo '000')
  hesh=$(printf '%s' "$telo" | shasum -a 256 | cut -c1-12)
  razmer=$(printf '%s' "$telo" | wc -c | tr -d ' ')
  printf "%-34s %s %8s %s\n" "$a" "$kod" "$razmer" "$hesh"
done
