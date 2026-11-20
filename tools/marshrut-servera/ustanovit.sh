#!/bin/sh
# Ставит службу, которая держит сервер сайта мимо Browsec. Нужен sudo.
#   sudo sh tools/marshrut-servera/ustanovit.sh          поставить / обновить
#   sudo sh tools/marshrut-servera/ustanovit.sh --snyat  убрать совсем
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
L=ru.aka-gst.marshrut-servera
P=/Library/LaunchDaemons/$L.plist

launchctl bootout system/$L 2>/dev/null || true
if [ "${1:-}" = "--snyat" ]; then
  rm -f "$P" /usr/local/libexec/marshrut-servera.sh
  route -n delete -host 139.100.232.40 >/dev/null 2>&1 || true
  echo "служба снята, маршрут убран"; exit 0
fi
mkdir -p /usr/local/libexec
install -m 755 -o root -g wheel "$HERE/marshrut-servera.sh" /usr/local/libexec/marshrut-servera.sh
install -m 644 -o root -g wheel "$HERE/$L.plist" "$P"
plutil -lint "$P"
launchctl bootstrap system "$P"
echo "служба поставлена:"; launchctl print system/$L | grep -E "state|runs|last exit"
