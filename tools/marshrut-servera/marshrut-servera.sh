#!/bin/sh
# Пускает сервер сайта (bonita, Selectel) мимо Browsec.
#
# Зачем: Browsec заворачивает весь трафик Мака в свой туннель, а его выходные
# адреса Selectel режет — ssh и выкладка виснут (21.11.2026, разбор в памяти
# сессии сайта: bonita-cherez-browsec). Browsec нужен Сергею всегда, поэтому
# мимо туннеля идёт только один адрес — наш сервер.
#
# Запускает системная служба ru.aka-gst.marshrut-servera: при загрузке, при
# смене сети и раз в минуту. Ничего не меняет, если маршрут уже верный.
# Журнал: /var/log/marshrut-servera.log — пишет только перемены и ошибки.
#
# Ручной запуск (покажет, что сделал бы):  sh marshrut-servera.sh --proverka

SERVER=139.100.232.40
LOG=/var/log/marshrut-servera.log

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG" 2>/dev/null || echo "$*" >&2; }

# Шлюз ищем у настоящих сетевых карт (Wi-Fi, провод), а не через «default»:
# у Browsec свои маршруты по умолчанию, и «default» может указать на туннель.
shlyuz=""
for i in $(networksetup -listallhardwareports | awk '/^Device:/{print $2}'); do
  g=$(ipconfig getoption "$i" router 2>/dev/null)
  if [ -n "$g" ]; then shlyuz=$g; karta=$i; break; fi
done

seychas=$(route -n get "$SERVER" 2>/dev/null | awk '/gateway:/{print $2}')

if [ "${1:-}" = "--proverka" ]; then
  echo "шлюз сети: ${shlyuz:-нет} (${karta:-}), сейчас к серверу: ${seychas:-нет маршрута}"
  [ -n "$shlyuz" ] && [ "$seychas" = "$shlyuz" ] && echo "маршрут верный" || echo "маршрут надо ставить"
  exit 0
fi

# Сети нет — ставить нечего; это не ошибка, служба зайдёт ещё раз.
[ -n "$shlyuz" ] || exit 0
[ "$seychas" = "$shlyuz" ] && exit 0

route -n delete -host "$SERVER" >/dev/null 2>&1
if route -n add -host "$SERVER" "$shlyuz" >/dev/null 2>&1; then
  log "поставлен: $SERVER через $shlyuz ($karta), было: ${seychas:-нет}"
else
  log "ОШИБКА: не смог поставить $SERVER через $shlyuz ($karta), было: ${seychas:-нет}"
  exit 1
fi
