#!/usr/bin/env sh
# Страж Caddyfile проверяется обоими исходами (свод п.7и): замена правила — пропускает,
# пропажа хоста / пути / апстрима — останавливает. Запуск: sh tools/proverka-storozha-caddy.sh
set -u
cd "$(dirname "$0")/.."
. tools/marshruty-caddy.sh
MOE=Caddyfile
ploho=0
sluchay() { # имя ожидание(pass|stop) файл-живого
  a=$(mktemp); b=$(mktemp)
  klyuchi_marshrutov "$MOE" > "$a"; klyuchi_marshrutov "$3" > "$b"
  lost=$(comm -13 "$a" "$b"); rm -f "$a" "$b"
  if [ -n "$lost" ]; then ishod=stop; else ishod=pass; fi
  if [ "$ishod" = "$2" ]; then echo "  ok    $1 — $ishod"; else echo "  FAIL  $1 — ждали $2, вышло $ishod${lost:+: $(printf '%s' "$lost" | head -3 | tr '\n' ';')}"; ploho=$((ploho+1)); fi
  rm -f "$3"
}
zh=$(mktemp); sed 's|redir /qa-quest /quequest/ 301|redir /qa-quest /kuda-ugodno/ 308|' "$MOE" > "$zh"
grep -q 'redir /qa-quest /kuda-ugodno/ 308' "$zh" || { echo "FAIL  подстава 1 не легла"; exit 1; }
sluchay "замена цели и кода redir" pass "$zh"
zh=$(mktemp); sed 's|^  route /qa-quest/\* {|  handle /qa-quest/* {|' "$MOE" > "$zh"
grep -q '^  handle /qa-quest/\* {' "$zh" || { echo "FAIL  подстава 2 не легла"; exit 1; }
sluchay "route вместо handle на том же пути" pass "$zh"
zh=$(mktemp); { cat "$MOE"; printf '\nproba-storozha.aka-gst.ru {\n\treverse_proxy proba:1\n}\n'; } > "$zh"
sluchay "на бою есть хост, которого нет у нас" stop "$zh"
zh=$(mktemp); sed 's|^  redir /qa-quest /quequest/ 301|  redir /qa-quest /quequest/ 301\n  redir /proba-storozha /x/ 308|' "$MOE" > "$zh"
grep -q 'redir /proba-storozha' "$zh" || { echo "FAIL  подстава 4 не легла"; exit 1; }
sluchay "на бою есть redir пути, которого нет у нас" stop "$zh"
zh=$(mktemp); sed 's|^  handle_path /coin/\* {|  handle_path /proba-storozha/* {\n    reverse_proxy proba:1\n  }\n  handle_path /coin/* {|' "$MOE" > "$zh"
grep -q 'reverse_proxy proba:1' "$zh" || { echo "FAIL  подстава 5 не легла"; exit 1; }
sluchay "на бою есть путь и апстрим, которых нет у нас" stop "$zh"
zh=$(mktemp); cp "$MOE" "$zh"
sluchay "живой совпадает с нашим" pass "$zh"
[ "$ploho" = 0 ] && echo "страж Caddy: все исходы верны" || { echo "страж Caddy: $ploho неверных"; exit 1; }
