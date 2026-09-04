#!/usr/bin/env sh
# Перезапуск Caddy со всеми проверками до и после — одной командой.
#
# Заведено 4 сентября 2026, пока ждали слова владельца. Причина: конфиг
# примонтирован в контейнер ПО INODE, монтирование устарело 3 сентября 04:48,
# и с тех пор ни одна правка настроек не применялась. При этом `caddy reload`
# отвечает кодом 0 — он честно перезагружает старую копию. Починка одна:
# перезапуск контейнера, после которого он возьмёт файл заново.
#
# Действие наружное: задевает три домена (aka-gst.ru, meet, stats) и применяет
# заодно чужие правки, лежащие в файле. Поэтому:
#
#   sh tools/perezapusk-caddy.sh          ТОЛЬКО ПРОВЕРКИ, ничего не трогает
#   sh tools/perezapusk-caddy.sh --da     перезапуск и полная сверка
#
# Без «--da» скрипт безопасен и его можно гонять сколько угодно: он лишь
# показывает, что сломано и что применится.
#
# Имена переменных латиницей: POSIX-оболочка падает на кириллице в имени.
set -eu
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"
SITE="${SITE:-https://aka-gst.ru}"
HOST="${HOST:-bonita}"
KONF="/opt/zakriva/caddy/Caddyfile"
RETRY="--retry 3 --retry-delay 1 --max-time 30"
DELAT="net"
[ "${1:-}" = "--da" ] && DELAT="da"

ploho() { echo "  ПРОВАЛ: $1"; exit 1; }

# ── 1. Подтвердить, что поломка та самая, а не что-то другое ──────────
echo "== монтирование =="
ih=$(ssh "$HOST" "stat -c %i $KONF" 2>/dev/null || echo '')
ik=$(ssh "$HOST" "docker exec caddy stat -c %i /etc/caddy/Caddyfile" 2>/dev/null || echo '')
[ -n "$ih" ] && [ -n "$ik" ] || ploho "не удалось прочитать inode — сервер недоступен"
printf "  хост %s / контейнер %s\n" "$ih" "$ik"
if [ "$ih" = "$ik" ]; then
  echo "  монтирование В ПОРЯДКЕ — перезапуск по этой причине не нужен"
  [ "$DELAT" = "da" ] && ploho "отказываюсь перезапускать без причины"
fi

# ── 2. Проверить ТОТ файл, который применится, и доказать, что проверка
#       умеет краснеть. Валидация против /etc/caddy/Caddyfile проверяет
#       старьё — это и есть суть поломки.
echo
echo "== конфиг, который применится =="
ssh "$HOST" "cat $KONF" | ssh "$HOST" 'docker exec -i caddy sh -c "cat > /tmp/Caddyfile.k-primeneniyu"'
ssh "$HOST" 'docker exec caddy caddy validate --config /tmp/Caddyfile.k-primeneniyu --adapter caddyfile' >/dev/null 2>&1 \
  || ploho "конфиг на хосте НЕ проходит проверку — перезапускать нельзя"
echo "  проверка пройдена"
ssh "$HOST" 'docker exec caddy sh -c "{ cat /tmp/Caddyfile.k-primeneniyu; printf \"\nне_директива {\n\"; } > /tmp/Caddyfile.slom"'
if ssh "$HOST" 'docker exec caddy caddy validate --config /tmp/Caddyfile.slom --adapter caddyfile' >/dev/null 2>&1; then
  ploho "проверка не краснеет на заведомо сломанном — ей нельзя верить"
fi
echo "  отрицательный контроль: сломанный конфиг отвергнут"

# ── 3. Что именно применится: разница между живым и лежащим ───────────
echo
echo "== что применится =="
printf "  строк в файле хоста: %s, в копии контейнера: %s\n" \
  "$(ssh "$HOST" "wc -l < $KONF")" \
  "$(ssh "$HOST" "docker exec caddy sh -c 'wc -l < /etc/caddy/Caddyfile'")"

# ── 4. Снимок витрины «до» ────────────────────────────────────────────
echo
echo "== снимок витрины «до» =="
sh tools/snimok-vitriny.sh > trash/snimok-do.txt || ploho "снимок «до» не снялся"
printf "  адресов: %s, из них не-200: %s\n" \
  "$(grep -vc '^#' trash/snimok-do.txt)" \
  "$(awk '!/^#/ && $2 != "200"' trash/snimok-do.txt | wc -l | tr -d ' ')"

if [ "$DELAT" != "da" ]; then
  echo
  echo "  холостой ход: ничего не трогал. Для перезапуска — «--da»."
  exit 0
fi

# ── 5. Перезапуск ─────────────────────────────────────────────────────
echo
echo "== перезапуск =="
ssh "$HOST" 'docker restart caddy' >/dev/null 2>&1 || ploho "docker restart не отработал"
i=0
while [ $i -lt 30 ]; do
  # shellcheck disable=SC2086
  kod=$(curl -s -o /dev/null -w '%{http_code}' $RETRY "$SITE/" || echo '000')
  [ "$kod" = "200" ] && break
  i=$((i + 1))
done
[ "$kod" = "200" ] || ploho "сайт не поднялся: код $kod — откатывать вручную"
echo "  сайт отвечает, попыток ожидания: $i"

# ── 6. Монтирование обязано было починиться ───────────────────────────
ih2=$(ssh "$HOST" "stat -c %i $KONF")
ik2=$(ssh "$HOST" "docker exec caddy stat -c %i /etc/caddy/Caddyfile")
printf "  inode после: хост %s / контейнер %s — %s\n" "$ih2" "$ik2" \
  "$([ "$ih2" = "$ik2" ] && echo совпали || echo 'ВСЁ ЕЩЁ РАЗНЫЕ')"

# ── 7. Девять адресов на ОБА исхода, с контролем в обоих концах ───────
echo
echo "== строка запроса =="
sprosit() {
  L=$(curl -sI $RETRY "$SITE/$1?v=123" | grep -i '^location:' | tr -d '\r' | sed 's/^[Ll]ocation: *//')
  if [ -z "$L" ]; then echo net
  elif printf '%s' "$L" | grep -q 'v=123'; then echo sohranil
  else echo poteryal; fi
}
[ "$(sprosit worm)" = "sohranil" ] || ploho "контроль /worm до перебора не сошёлся — прогону верить нельзя"
plohih=0
for p in acid tetcolor naotmash hotline-abakan psy-admin photodata qa-quest praktikum meet; do
  o=$(sprosit "$p")
  printf "  /%-16s %s\n" "$p" "$o"
  [ "$o" = "sohranil" ] || plohih=$((plohih + 1))
done
[ "$(sprosit worm)" = "sohranil" ] || ploho "контроль /worm ПОСЛЕ перебора не сошёлся"
echo "  не починились: $plohih из 9"

# ── 8. Контроли, которые меняться не должны вовсе ─────────────────────
echo
echo "== контроли =="
printf "  /claw  (статика без правила): %s — ожидалось sohranil\n" "$(sprosit claw)"
printf "  /pulse (проксируется, правила нет): %s — ожидалось net\n" "$(sprosit pulse)"

# ── 9. Чужие маршруты и соседние домены ───────────────────────────────
echo
echo "== чужое и соседи =="
for u in "$SITE/psy-admin/admin/" "$SITE/psy-admin/booking/" "https://meet.aka-gst.ru/" "https://stats.aka-gst.ru/"; do
  # shellcheck disable=SC2086
  printf "  %-38s %s\n" "$u" "$(curl -s -o /dev/null -w '%{http_code}' $RETRY "$u" || echo '000')"
done

# ── 10. Витрина целиком ───────────────────────────────────────────────
echo
echo "== витрина: что изменилось =="
sh tools/snimok-vitriny.sh > trash/snimok-posle.txt || ploho "снимок «после» не снялся"
if diff -q trash/snimok-do.txt trash/snimok-posle.txt >/dev/null; then
  echo "  ни одна карточка не изменилась"
else
  diff trash/snimok-do.txt trash/snimok-posle.txt | sed 's/^/    /'
fi
echo
echo "  готово. Откат, если понадобится: docker restart caddy после возврата"
echo "  $KONF из Caddyfile.do-2026-09-04"
