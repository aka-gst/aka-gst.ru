#!/bin/bash
# Жми дважды — сайт из этой папки откроется в браузере. Закрой это окно, чтобы остановить.
# Бой — https://aka-gst.ru/ ; выкладка — sh deploy.sh --go ; сверка боя — sh verify.sh
cd "$(dirname "$0")"
PORT=4187
while lsof -i tcp:$PORT >/dev/null 2>&1; do PORT=$((PORT+1)); done
(python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1) &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null" EXIT
sleep 1
open "http://127.0.0.1:$PORT/"
echo "aka-gst.ru из этой папки открылся в браузере на порту $PORT."
echo "Закрой это окно (или нажми Ctrl+C), чтобы остановить."
wait $SERVER_PID
