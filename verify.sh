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

# Сеть даёт 2-7% случайных обрывов, и это НЕ свойство сайта. Повторы нужны
# каждому запросу, а не только проверке кодов: раньше сверка хеша и разбор
# страницы 404 ходили голым curl, и их случайный обрыв читался как
# «выкладка не доведена». Отсюда и плавал счёт: 35/2, 36/1, 37/0.
RETRY="--retry 3 --retry-all-errors --retry-delay 1 --max-time 25"

# 000 — это «ответа не было», а не код ответа. Отличать обязательно: иначе
# сетевой сбой читается как «файла нет», а это противоположные выводы.
# Три попытки с паузой: запросы подряд иногда упираются в ограничение.
code() {
  attempt=1
  while [ "$attempt" -le 3 ]; do
    # shellcheck disable=SC2086
    c=$(curl -s $RETRY -o /dev/null -w '%{http_code}' "$1" || echo 000)
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
         /psy-admin/ /photodata/ /tetcolor/ /stihii/ /lines/ /coin/ \
         /robots.txt /sitemap.xml /sitemap-pages.xml /og.png /favicon.svg /503.html; do
  expect "$p" 200
done

echo
echo "== служебное наружу не отдаётся =="
# Папки проектов выкладываются целиком, и с ними однажды уехало служебное:
# README и тесты psy-admin отдавались наружу с 28 августа, пока их не
# исключили из выкладки. Проверяем, что не вернулись.
for p in /.githooks/private-words.txt /.githooks/pre-commit /.gitignore /README.md \
         /build.mjs /deploy.sh /verify.sh /Caddyfile /sync-portfolio.sh \
         /psy-admin/README.md /psy-admin/test.mjs /stories/solyanochka--letuny.txt; do
  expect "$p" 404
done

echo
echo "== старые адреса перенаправляют, а не теряются =="
# Имена функций и переменных в sh только латиницей: кириллица здесь
# не идентификатор, и скрипт падает на разборе.
moved() {
  from="$1"; to="$2"
  # shellcheck disable=SC2086
  target=$(curl -s $RETRY -o /dev/null -w '%{redirect_url}' "$BASE$from")
  if [ "$target" = "$BASE$to" ]; then say_ok "$from -> $to"
  else say_bad "$from ведёт на «$target», ждали $BASE$to"; fi
}
moved /knb/ /stihii/
moved /tetris/ /tetcolor/

echo
echo "== опечатка в адресе даёт страницу, а не пустоту =="
# shellcheck disable=SC2086
miss=$(curl -s $RETRY "$BASE/takoy-stranicy-tochno-net" -w '\n%{http_code}')
mcode=$(printf '%s' "$miss" | tail -1)
if [ "$mcode" = "404" ] && printf '%s' "$miss" | grep -q 'Страница не найдена'; then
  say_ok "404 отдаёт свою страницу с кодом 404"
else
  say_bad "404: код $mcode, своя страница не опознана"
fi

echo
echo "== ассеты, на которые ссылается сама страница =="
# Строка запроса — часть адреса. Именно на ней ломается наивная проверка.
# shellcheck disable=SC2086
page=$(curl -s $RETRY "$BASE/")
printf '%s' "$page" \
  | grep -oE '(href|src)="/[^"]+\.(css|js|svg|png|jpg)(\?[^"]*)?"' \
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
  # shellcheck disable=SC2086
  curl -s $RETRY "$BASE/" -o "$raw"
  live=$(shasum -a 256 "$raw" | cut -d' ' -f1)
  rm -f "$raw"
  local_hash=$(shasum -a 256 "$HERE/index.html" | cut -d' ' -f1)
  if [ "$live" = "$local_hash" ]; then say_ok "index.html совпадает с локальной сборкой"
  else say_bad "index.html отличается от локальной сборки — выкладка не доведена"; fi
fi

echo
echo "== на бою лежит то, что мы положили =="
# Раньше сверялся только index.html сайта, и этого не хватало: у ТехноМагии
# выкладка отработала «успешно», verify дал 62 из 62, а на бою лежал файл
# игры на восемь килобайт короче исходного. Проверка смотрела на главную,
# а вопрос был про файлы. «200 ≠ выложено» ровно в том виде, как записано.
#
# Сверяем ХЕШ, а не размер и не код. Размер ловит только изменение длины:
# файл может отдаваться, быть ровно той же длины и всё равно быть
# вчерашним — правка на один символ размера не меняет. Хеш ловит и это,
# и разницу в обе стороны, включая случай, когда на бою файл НОВЕЕ
# местного, о котором обычно не думают.
#
# Пустой ответ отсекается отдельно: без этого опечатка в адресе даёт
# пустоту, а пустота неотличима от «не выложилось».
same() {
  path="$1"
  if [ ! -f "$HERE$path" ]; then say_bad "$path — локального файла нет, сверять не с чем"; return; fi
  tmp=$(mktemp)
  # Обход кэша: без него можно померить прошлый ответ, а не бой. Совет
  # сессии ТехноМагии, купленный её же ошибкой.
  # shellcheck disable=SC2086
  curl -s $RETRY "$BASE$path?svezho=$(date +%s)" -o "$tmp"
  if [ ! -s "$tmp" ]; then rm -f "$tmp"; say_bad "$path — с боя ничего не пришло"; return; fi
  a=$(shasum -a 256 "$tmp" | cut -d' ' -f1)
  b=$(shasum -a 256 "$HERE$path" | cut -d' ' -f1)
  rm -f "$tmp"
  if [ "$a" = "$b" ]; then say_ok "$path совпадает с деревом"
  else say_bad "$path НА БОЮ ДРУГОЙ — выкладка не доведена"; fi
}

for f in /technomagic/index.html /technomagic/src/main.js /technomagic/src/world.js \
         /qa-quest/index.html /psy-admin/index.html /photodata/index.html \
         /praktikum/index.html /praktikum/llm/index.html /praktikum/testirovanie/index.html \
         /rasskazy/index.html /game-menu.css /player-name.js; do
  same "$f"
done

# Игры, которые выкладывают свои сессии из своих репозиториев, сверить
# нечем: исходника у нас нет. Молчать об этом нельзя — «не проверено» и
# «проверено и хорошо» разные вещи.
echo "  прим.  /acid/ /stealth/ /worm/ /udar/ /lines/ /tetcolor/ /coin/ /stihii/ —"
echo "         выкладываются своими сессиями, содержимое здесь не сверяется"

echo
echo "== содержимое, а не только код ответа =="
for needle in 'og:image' 'data-metric="tests"' 'data-panel="play"' 'class="social"' \
              'class="shot"' 'assets/shots/allure-gateway.png'; do
  if printf '%s' "$page" | grep -q "$needle"; then say_ok "на странице есть $needle"
  else say_bad "на странице НЕТ $needle"; fi
done

echo
echo "== ничего не притягивает экран =="
# Владелец 31 августа 2026: «тут снова есть притягивание — уберите его
# вообще отовсюду и чтоб он больше не появлялся!!». Это уже третий заход:
# сначала убрали scroll-snap, потом он вернулся ощущением от плавной
# самовольной прокрутки. Проверка стоит здесь, чтобы четвёртого не было.
#
# Берём файлы С БОЯ, а не из дерева: правка, которая не доехала, ничего не
# чинит, а собранное дерево лжёт убедительнее всего (правило 48а).
# scroll-padding-top намеренно НЕ в списке — это отступ якоря, а не
# движение: без него заголовок встаёт под липкую шапку.
#
# Ищем объявления и вызовы, а не слова. Первый прогон покраснел на
# комментарии «proximity без scroll-snap-stop: always», который как раз
# объясняет, как притягивание убрали: проверка, краснеющая на объяснении,
# будет отключена первой же рукой.
for f in /assets/site.css /assets/read.css /assets/app.js /assets/read.js; do
  # shellcheck disable=SC2086
  body=$(curl -s $RETRY "$BASE$f?svezho=$(date +%s)" || echo '')
  for bad_word in 'scroll-snap-type' 'scroll-behavior:' '.scrollIntoView(' "behavior: 'smooth'" 'behavior:"smooth"'; do
    n=$(printf '%s' "$body" | grep -c -- "$bad_word" 2>/dev/null || true)
    n=${n:-0}
    if [ "$n" -eq 0 ]; then say_ok "$f без $bad_word"
    else say_bad "$f: $bad_word вернулся ($n)"; fi
  done
done

echo
printf '%s пройдено, %s провалено\n' "$ok" "$bad"
[ "$bad" -eq 0 ]
