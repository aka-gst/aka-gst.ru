#!/bin/zsh
set -eu
site_r5_root="$(cd -- "$(dirname -- "$0")/../.." && pwd)"
site_r5_url='http://127.0.0.1:4182/design-preview/site/?v=20261003-8'
site_r5_check() {
  python3 - "$site_r5_url" <<'PY'
import sys, urllib.request
try:
    with urllib.request.urlopen(sys.argv[1],timeout=1) as response:
        content=response.read(250000).decode('utf-8')
    sys.exit(0 if '<!-- GENERATED:FEATURES -->' in content and '20261003-8' in content else 1)
except Exception:
    sys.exit(1)
PY
}
cd -- "$site_r5_root"
if site_r5_check; then
  print 'R5: локальный сервер уже работает; открывается тот же preview.'
else
  site_r5_server_pid=$(python3 - "$site_r5_root" "${TMPDIR:-/tmp}/aka-gst-site-r5-4182.log" <<'PYTHON'
import subprocess, sys
with open(sys.argv[2], 'ab') as log:
    server = subprocess.Popen([sys.executable, '-m', 'http.server', '4182', '--bind', '127.0.0.1'], cwd=sys.argv[1], stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)
print(server.pid)
PYTHON
)
  site_r5_ready=0
  for site_r5_attempt in {1..20}; do
    if site_r5_check; then site_r5_ready=1; break; fi
    sleep 0.1
  done
  if [[ "$site_r5_ready" != 1 ]]; then
    print 'Не удалось открыть preview на 4182. Проверьте, не занят ли порт другим сервером.'
    exit 1
  fi
  print "R5: сервер запущен, PID $site_r5_server_pid. Остановить: kill $site_r5_server_pid"
fi
print "$site_r5_url"
if [[ "${1:-}" != '--no-open' ]]; then open "$site_r5_url"; fi
