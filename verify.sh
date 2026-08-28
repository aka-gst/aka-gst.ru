#!/usr/bin/env sh
# Проверка боевого сайта после выкладки.
#
# Написан из трёх ошибок одного дня, все — ошибки проверки, а не кода:
#   * 404 приняли за «защита работает», хотя файла просто ещё не выложили;
#   * ссылку на стиль искали по окончанию .css и не нашли site.css?v=1;
#   * «200 на главной» сочли доказательством, что страница цела.
# Поэтому здесь: ассеты берутся из самой страницы вместе со строкой запроса,
# а сверка идёт по содержимому, а не по коду ответа.
#
#   sh verify.sh            проверить https://aka-gst.ru
#   sh verify.sh <адрес>    проверить другой

set -eu

BASE="${1:-https://aka-gst.ru}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ok=0
bad=0

say_ok()  { ok=$((ok + 1));  printf '  ok    %s\n' "$1"; }
say_bad() { bad=$((bad + 1)); printf '  FAIL  %s\n' "$1"; }

# 000 — это «ответа не было», а не код ответа. Отличать обязательно: иначе
# сетевой сбой читается как «файла нет», а это противоположные выводы.
# Три попытки с паузой: запросы подряд иногда упираются в ограничение.
code() {
  attempt=1
  while [ "$attempt" -le 3 ]; do
    c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 "$1" || echo 000)
    [ "$c" != "000" ] && { echo "$c"; return; }
    attempt=$((attempt + 1))
    sleep 1
  done
  echo 000
}

expect() {
  path="$1"; want="$2"
  got=$(code "$BASE$path")
  if [ "$got" = "$want" ]; then say_ok "$path -> $got"
  elif [ "$got" = "000" ]; then say_bad "$path -> ответа нет (сеть), проверить не удалось"
  else say_bad "$path -> $got, ждали $want"; fi
}

echo "== страницы =="
for p in / /praktikum/ /praktikum/testirovanie/ /praktikum/llm/ /qa-quest/ /acid/ \
         /psy-admin/ /photodata/ /tetcolor/ /knb/ /lines/ /coin/ \
         /robots.txt /sitemap.xml /sitemap-pages.xml /og.png /favicon.svg /503.html; do
  expect "$p" 200
done

echo
echo "== служебное наружу не отдаётся =="
for p in /.githooks/private-words.txt /.githooks/pre-commit /.gitignore /README.md \
         /build.mjs /deploy.sh /verify.sh /Caddyfile /sync-portfolio.sh; do
  expect "$p" 404
done

echo
echo "== опечатка в адресе даёт страницу, а не пустоту =="
miss=$(curl -s --max-time 25 "$BASE/takoy-stranicy-tochno-net" -w '\n%{http_code}')
mcode=$(printf '%s' "$miss" | tail -1)
if [ "$mcode" = "404" ] && printf '%s' "$miss" | grep -q 'Страница не найдена'; then
  say_ok "404 отдаёт свою страницу с кодом 404"
else
  say_bad "404: код $mcode, своя страница не опознана"
fi

echo
echo "== ассеты, на которые ссылается сама страница =="
# Строка запроса — часть адреса. Именно на ней ломается наивная проверка.
page=$(curl -s --max-time 25 "$BASE/")
printf '%s' "$page" \
  | grep -oE '(href|src)="/[^"]+\.(css|js|svg|png)(\?[^"]*)?"' \
  | sed 's/.*="//; s/"$//' | sort -u \
  | while IFS= read -r asset; do
      got=$(code "$BASE$asset")
      if [ "$got" = "200" ]; then printf '  ok    %s\n' "$asset"
      else printf '  FAIL  %s -> %s\n' "$asset" "$got"; fi
    done > /tmp/verify-assets.$$
cat /tmp/verify-assets.$$
ok=$((ok + $(grep -c '^  ok' /tmp/verify-assets.$$ || true)))
bad=$((bad + $(grep -c '^  FAIL' /tmp/verify-assets.$$ || true)))
rm -f /tmp/verify-assets.$$

echo
echo "== выложено то же, что собрано =="
if [ -f "$HERE/index.html" ]; then
  # Хешируем ФАЙЛ, а не $page: подстановка $( ) срезает завершающий перевод
  # строки, и сверка с файлом не совпала бы никогда — вечный ложный провал.
  raw=$(mktemp)
  curl -s --max-time 25 "$BASE/" -o "$raw"
  live=$(shasum -a 256 "$raw" | cut -d' ' -f1)
  rm -f "$raw"
  local_hash=$(shasum -a 256 "$HERE/index.html" | cut -d' ' -f1)
  if [ "$live" = "$local_hash" ]; then say_ok "index.html совпадает с локальной сборкой"
  else say_bad "index.html отличается от локальной сборки — выкладка не доведена"; fi
fi

echo
echo "== содержимое, а не только код ответа =="
for needle in 'og:image' 'data-metric="tests"' 'data-panel="play"' 'class="social"'; do
  if printf '%s' "$page" | grep -q "$needle"; then say_ok "на странице есть $needle"
  else say_bad "на странице НЕТ $needle"; fi
done

echo
printf '%s пройдено, %s провалено\n' "$ok" "$bad"
[ "$bad" -eq 0 ]
