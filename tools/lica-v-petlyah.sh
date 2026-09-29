#!/bin/sh
# Ищет человеческие лица во всех петлях витрины и пишет реестр проверенных.
#
# Зачем: 6 сентября 2026 в петле ФотоДата на бою оказалось лицо постороннего
# человека — снимали окно приложения, а в папке лежали чужие фотографии.
# Нашлось случайно, при замере пропорций. Глаза закрыли источник у себя
# (снимать только служебные файлы), это закрывает вторую половину — выкладку.
#
# Меряет ровно одно: есть ли в кадре человеческое лицо (Vision, тот же
# распознаватель, что у Фото на этом Маке). Чужую комнату без лица,
# переписку или документ он не увидит — на это глаза, а не скрипт.
#
#   sh tools/lica-v-petlyah.sh          — проверить и записать реестр
#   sh tools/lica-v-petlyah.sh --tolko  — только проверить, ничего не писать
set -eu
cd "$(dirname "$0")/.."

BIN=trash/lica
KADRY=trash/lica-kadry
REESTR=data/petli-lica.json
FPS=2   # кадр раз в полсекунды: петли по 4–8 секунд

mkdir -p trash
if [ ! -x "$BIN" ] || [ tools/lica.swift -nt "$BIN" ]; then
  echo "== собираю распознаватель =="
  swiftc -O -o "$BIN" tools/lica.swift
fi

# Отрицательный и положительный контроль: измеритель обязан молчать на
# заведомо чистом и срабатывать на заведомо лицевом. Без этого «ноль лиц»
# ничего не значит (правило 7л).
CHISTO=assets/put/put-comic-team-pilot.webp   # наши люди, все со спины
LICO=assets/pechat/urta-avtor.jpg             # авторский снимок
for f in "$CHISTO" "$LICO"; do
  [ -f "$f" ] || { echo "!! нет контрольного файла $f" >&2; exit 2; }
done
n_chisto=$("$BIN" "$CHISTO" | cut -f1)
n_lico=$("$BIN" "$LICO" | cut -f1)
if [ "$n_chisto" != "0" ] || [ "$n_lico" = "0" ]; then
  echo "!! контроли не сошлись: на чистом $n_chisto (ждали 0), на лицевом $n_lico (ждали больше нуля)" >&2
  echo "!! измерителю верить нельзя, реестр не трогаю" >&2
  exit 2
fi
echo "контроли: чистый $n_chisto, лицевой $n_lico — измеритель живой"

rm -rf "$KADRY"; mkdir -p "$KADRY"
plohie=0
ZAPISI=trash/lica-zapisi.txt
: > "$ZAPISI"
for klip in assets/clips/*; do
  [ -f "$klip" ] || continue
  imya=$(basename "$klip")
  osnova=${imya%.*}
  ffmpeg -loglevel error -y -i "$klip" -vf "fps=$FPS" "$KADRY/$osnova-%03d.png" </dev/null
  kadrov=$(ls "$KADRY/$osnova"-*.png 2>/dev/null | wc -l | tr -d ' ')
  if [ "$kadrov" -eq 0 ]; then
    echo "!! из $imya не вышло ни одного кадра" >&2
    exit 2
  fi
  nayden=$(ls "$KADRY/$osnova"-*.png | tr '\n' '\0' | xargs -0 "$BIN" | awk -F'\t' '$1 > 0' || true)
  lic=$(printf '%s' "$nayden" | grep -c . || true)
  sha=$(shasum -a 256 "$klip" | cut -c1-16)
  if [ "$lic" -gt 0 ]; then
    plohie=$((plohie + 1))
    echo "!! $imya — лицо в кадре, $lic из $kadrov кадров:" >&2
    printf '%s\n' "$nayden" | sed 's|^|   |' >&2
  else
    echo "  $imya — чисто, $kadrov кадров"
  fi
    printf '    {"petlya": "%s", "sha256": "%s", "kadrov": %s, "lic": %s}\n' \
      "$imya" "$sha" "$kadrov" "$lic" >> "$ZAPISI"
done

if [ "$plohie" -gt 0 ]; then
  echo "!! петель с лицами: $plohie — реестр не обновляю, выкладывать нельзя" >&2
  exit 1
fi

if [ "${1:-}" = "--tolko" ]; then
  echo "проверено, реестр не трогал (--tolko)"
  exit 0
fi

{
  printf '{\n  "kogda": "%s",\n' "$(date '+%Y-%m-%dT%H:%M')"
  printf '  "chem": "Vision VNDetectFaceRectanglesRequest, кадр раз в %s с",\n' "$(awk "BEGIN{print 1/$FPS}")"
  printf '  "petli": [\n'
  awk 'NR > 1 { print prev "," } { prev = $0 } END { if (NR) print prev }' "$ZAPISI"
  printf '  ]\n}\n'
} > "$REESTR"
echo "реестр обновлён: $REESTR"
