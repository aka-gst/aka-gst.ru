#!/usr/bin/env sh
# Починка причины: монтировать ПАПКУ с конфигом вместо одиночного файла.
#
# 4 сентября 2026. Одиночный файл монтируется по inode: кто правит его
# заменой (редактор, `mv`), создаёт новый inode, и контейнер навсегда остаётся
# при старом. Так и вышло — сутки ни одна правка настроек не применялась, а
# `caddy reload` при этом отвечал кодом 0. Папка монтируется иначе: файл
# внутри можно заменять сколько угодно.
#
#   sh tools/pochinit-montirovanie.sh          ТОЛЬКО ПРОВЕРКИ, ничего не трогает
#   sh tools/pochinit-montirovanie.sh --da     пересоздать контейнер
#
# ВНИМАНИЕ, это не перезапуск. Контейнер заведён вручную, без compose, значит
# его надо пересоздать по восстановленному описанию. Две ловушки:
#   * у него ДВЕ сети, а `docker run` подключает одну. Вторую добавляем
#     отдельной командой, иначе upstream-службы станут недостижимы и половина
#     сайта ляжет при внешне успешном запуске;
#   * порты 80 и 443 заняты старым контейнером, поэтому новый можно создать
#     только после остановки старого — отсюда простой.
#
# Откат мгновенный: старый контейнер НЕ удаляется, а переименовывается.
# Плохо пошло — останавливаем новый, возвращаем имя старому, запускаем.
#
# Имена переменных латиницей: POSIX-оболочка падает на кириллице в имени.
set -eu
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"
SITE="${SITE:-https://aka-gst.ru}"
HOST="${HOST:-bonita}"
PAPKA="/opt/zakriva/caddy"
STARYY="caddy-staryy-20260904"
RETRY="--retry 3 --retry-delay 1 --max-time 30"
DELAT="net"
[ "${1:-}" = "--da" ] && DELAT="da"

ploho() { echo "  ПРОВАЛ: $1"; exit 1; }

echo "== что есть сейчас =="
mont=$(ssh "$HOST" 'docker inspect caddy --format "{{range .Mounts}}{{.Source}}>{{.Destination}} {{end}}"' 2>/dev/null || echo '')
[ -n "$mont" ] || ploho "контейнер caddy не найден"
printf "  монтирования: %s\n" "$mont"
if printf '%s' "$mont" | grep -q "$PAPKA>/etc/caddy "; then
  echo "  ПАПКА УЖЕ ПРИМОНТИРОВАНА — чинить нечего"
  [ "$DELAT" = "da" ] && ploho "отказываюсь пересоздавать без причины"
  exit 0
fi
# Доллары экранируем ДАЖЕ внутри одинарных кавычек: их разворачивает
# удалённая оболочка, и без экранирования шаблон становится «{{range , :=»
# и падает разбором. Проверено обеими формами.
seti=$(ssh "$HOST" 'docker inspect caddy --format "{{range \$k, \$v := .NetworkSettings.Networks}}{{\$k}} {{end}}"' 2>/dev/null || echo '')
printf "  сети: %s\n" "${seti:-НЕ ПРОЧИТАНЫ}"
# Без второй сети пересоздавать нельзя: подключим одну, а upstream-службы
# останутся недостижимы, и сайт будет отвечать, отдавая половину.
if ! printf ' %s ' "$seti" | grep -q ' zakriva-net '; then
  echo "  сеть zakriva-net не найдена"
  [ "$DELAT" != "da" ] || ploho "не вижу сеть zakriva-net — не рискую пересоздавать"
fi

echo
echo "== конфиг обязан быть исправным ДО пересоздания =="
ssh "$HOST" "cat $PAPKA/Caddyfile" | ssh "$HOST" 'docker exec -i caddy sh -c "cat > /tmp/Caddyfile.pered-peresozdaniem"'
ssh "$HOST" 'docker exec caddy caddy validate --config /tmp/Caddyfile.pered-peresozdaniem --adapter caddyfile' >/dev/null 2>&1 \
  || ploho "конфиг не проходит проверку — пересоздавать нельзя"
echo "  проверка пройдена"

echo
echo "== снимок витрины «до» =="
sh tools/snimok-vitriny.sh > trash/snimok-montirovanie-do.txt || ploho "снимок «до» не снялся"
printf "  адресов: %s, не-200: %s\n" \
  "$(grep -vc '^#' trash/snimok-montirovanie-do.txt)" \
  "$(awk '!/^#/ && $2 != "200"' trash/snimok-montirovanie-do.txt | wc -l | tr -d ' ')"

if [ "$DELAT" != "da" ]; then
  echo
  echo "  холостой ход: ничего не трогал. Для пересоздания — «--da»."
  exit 0
fi

echo
echo "== пересоздание =="
ssh "$HOST" "docker stop caddy >/dev/null && docker rename caddy $STARYY" || ploho "не удалось остановить и переименовать старый"
echo "  старый остановлен и переименован в $STARYY — откат готов"

if ! ssh "$HOST" "docker run -d --name caddy --restart unless-stopped \
    -p 80:80 -p 443:443 \
    --network zakriva-net \
    -v $PAPKA:/etc/caddy \
    -v $PAPKA/site:/srv \
    -v caddy_config:/config -v caddy_data:/data \
    caddy:2 caddy run --config /etc/caddy/Caddyfile --adapter caddyfile" >/dev/null 2>&1; then
  echo "  новый не создался — возвращаю старый"
  ssh "$HOST" "docker rename $STARYY caddy && docker start caddy" >/dev/null 2>&1 || true
  ploho "откат выполнен, разбираться на копии"
fi
echo "  новый создан"

# ВТОРАЯ СЕТЬ. Без неё upstream-службы недостижимы, а сайт при этом отвечает.
ssh "$HOST" 'docker network connect bridge caddy' >/dev/null 2>&1 || ploho "вторая сеть не подключилась"
echo "  вторая сеть подключена"

echo
echo "== поднялся ли =="
i=0; kod=000
while [ $i -lt 40 ]; do
  # shellcheck disable=SC2086
  kod=$(curl -s -o /dev/null -w '%{http_code}' $RETRY "$SITE/" || echo '000')
  [ "$kod" = "200" ] && break
  i=$((i + 1))
done
if [ "$kod" != "200" ]; then
  echo "  сайт не поднялся (код $kod) — ОТКАТ"
  ssh "$HOST" "docker stop caddy >/dev/null; docker rm caddy >/dev/null; docker rename $STARYY caddy; docker start caddy" >/dev/null 2>&1 || true
  ploho "откат выполнен"
fi
echo "  сайт отвечает, попыток ожидания: $i"

echo
echo "== inode обязаны совпасть — та же мера, что нашла поломку =="
ih=$(ssh "$HOST" "stat -c %i $PAPKA/Caddyfile")
ik=$(ssh "$HOST" 'docker exec caddy stat -c %i /etc/caddy/Caddyfile')
printf "  хост %s / контейнер %s — %s\n" "$ih" "$ik" "$([ "$ih" = "$ik" ] && echo совпали || echo РАЗНЫЕ)"

echo
echo "== отрицательный контроль: правка ДВУМЯ способами обязана доезжать =="
# ВНИМАНИЕ на счёт: `grep -c` печатает «0» И выходит с кодом 1, поэтому
# «|| echo 0» дописывает ВТОРОЙ ноль и сравнение падает на «0\n0». Я на этом
# наступил ровно здесь, в живом прогоне 4 сентября: правки доехали обе, а
# скрипт объявил провал и не дошёл до остальных проверок. Считаем wc -l.
# Способ 1 — запись поверх (inode сохраняется). Способ 2 — ЗАМЕНА через mv,
# та самая, что ломала одиночный файл. Проверяем оба, иначе починим ровно
# тот случай, который проверяли.
ssh "$HOST" "cp $PAPKA/Caddyfile $PAPKA/.proba-vozvrat"
ssh "$HOST" "printf '# proba-zapis-poverh\n' >> $PAPKA/Caddyfile"
v1=$(ssh "$HOST" 'docker exec caddy grep proba-zapis-poverh /etc/caddy/Caddyfile' 2>/dev/null | wc -l | tr -d ' ')
ssh "$HOST" "cp $PAPKA/Caddyfile $PAPKA/.proba-novyy && printf '# proba-zamena-mv\n' >> $PAPKA/.proba-novyy && mv $PAPKA/.proba-novyy $PAPKA/Caddyfile"
v2=$(ssh "$HOST" 'docker exec caddy grep proba-zamena-mv /etc/caddy/Caddyfile' 2>/dev/null | wc -l | tr -d ' ')
ssh "$HOST" "mv $PAPKA/.proba-vozvrat $PAPKA/Caddyfile"
v3=$(ssh "$HOST" 'docker exec caddy grep proba-zamena-mv /etc/caddy/Caddyfile' 2>/dev/null | wc -l | tr -d ' ')
printf "  запись поверх доехала: %s (надо 1)\n" "$v1"
printf "  замена через mv доехала: %s (надо 1)\n" "$v2"
printf "  возврат доехал (пробы больше нет): %s (надо 0)\n" "$v3"
[ "$v1" = "1" ] && [ "$v2" = "1" ] && [ "$v3" = "0" ] || ploho "правки доезжают не всеми способами — причина НЕ починена"

echo
echo "== витрина и соседи =="
sh tools/snimok-vitriny.sh > trash/snimok-montirovanie-posle.txt || ploho "снимок «после» не снялся"
if diff -q trash/snimok-montirovanie-do.txt trash/snimok-montirovanie-posle.txt >/dev/null; then
  echo "  ни одна карточка не изменилась"
else
  diff trash/snimok-montirovanie-do.txt trash/snimok-montirovanie-posle.txt | sed 's/^/    /'
fi
for u in "$SITE/psy-admin/admin/" "$SITE/psy-admin/booking/" "$SITE/pulse/" "https://meet.aka-gst.ru/"; do
  # shellcheck disable=SC2086
  printf "  %-38s %s\n" "$u" "$(curl -s -o /dev/null -w '%{http_code}' $RETRY "$u" || echo '000')"
done

echo
echo "  готово. Старый контейнер оставлен как $STARYY — удалить после суток спокойной работы:"
echo "    ssh $HOST 'docker rm $STARYY'"
