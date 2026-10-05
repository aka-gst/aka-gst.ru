#!/usr/bin/env sh
# Ключи маршрутов Caddyfile для стража выкладки (deploy.sh, раздел «сверка с живым»).
#
# Страж сравнивает МНОЖЕСТВА того, что обслуживается, а не строки: хосты, пути
# (матчеры redir/handle/handle_path/route) и апстримы reverse_proxy. Куда ведёт
# redir, какой код, handle это или route — настройка правила, а не маршрут:
# замена правила проходит, пропажа хоста, пути или апстрима — останавливает.
# Повод (05.10.2026): страж принял замену двух строк /qa-quest за потерю маршрутов,
# и конфиг пришлось класть руками в обход — ложная тревога приучает обходить
# стража, а однажды обойдут и на настоящей потере (свод п.7и).
# Проверка обоими исходами: sh tools/proverka-storozha-caddy.sh
#
#   . tools/marshruty-caddy.sh; klyuchi_marshrutov Caddyfile
klyuchi_marshrutov() {
  grep -oE '^[[:space:]]*(redir|handle|handle_path|route|reverse_proxy)[[:space:]]+[^{]*|^[a-z0-9_.*-]+([[:space:]]*,[[:space:]]*[a-z0-9_.*-]+)*[[:space:]]*\{' "$1" \
    | sed 's/^[[:space:]]*//; s/[[:space:]]*$//; s/[[:space:]]\{1,\}/ /g' \
    | awk '
        /\{$/                    { sub(/ *\{$/, ""); print "хост " $0; next }
        $1 == "redir"            { print "redir " $2; next }
        $1 == "handle" || $1 == "handle_path" || $1 == "route" { print "путь " $2; next }
        $1 == "reverse_proxy"    { print; next }
      ' \
    | sort -u
}
