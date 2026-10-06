#!/bin/zsh
set -euo pipefail

root="${0:A:h:h}"
url='http://127.0.0.1:4180/design-preview/'

if curl --silent --show-error --fail --max-time 2 "$url" 2>/dev/null | grep -q '<title>aka-gst — три направления сайта</title>'; then
  print "Предпросмотр уже работает: $url"
  exit 0
fi

if lsof -nP -iTCP:4180 -sTCP:LISTEN >/dev/null 2>&1; then
  print -u2 'Порт 4180 занят другим приложением. Остановите его или выберите другой порт.'
  exit 1
fi

print "Предпросмотр: $url"
print 'Оставьте это окно открытым, пока смотрите варианты сайта.'
exec python3 -m http.server 4180 --bind 127.0.0.1 --directory "$root"
