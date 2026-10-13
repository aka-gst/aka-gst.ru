#!/usr/bin/env sh
# Копии игр и продуктов в репозитории сайта едут на бой ТОЛЬКО по слову Сергея (13.10.2026, через Рта):
# «игры в разработке на витрину покадрово не публиковать, только версию, названную готовой к показу».
# Повод: QueQuest уехал пятью выкладками 19.0→19.5 за пару дней, а он хотел копить и показать готовое.
# Сверяем папку с боем тем же rsync --dry-run, что и выкладка: есть разница и папки нет в GOTOVO — стоп.
#   sh tools/igry-gotovy-k-pokazu.sh <папки выкладки…>      (нужны HOST, ROOT, RSYNC_EXCL из deploy.sh)
#   GOTOVO="quequest technomagic" — что Сергей назвал готовым; везём только их.
# Оба исхода: папка без разницы → ok; разница + в GOTOVO → ok «по слову»; разница без слова → стоп (код 1).
set -u
set -f  # $RSYNC_EXCL содержит *, оболочка не должна его раскрывать
KOPII="${KOPII_IGR:-technomagic quequest qa-quest psy-admin zoo leela puzzle-quest}"
ploho=""
for d in "$@"; do
  case " $KOPII " in *" $d "*) ;; *) continue ;; esac
  [ -d "$d" ] || continue
  # shellcheck disable=SC2086
  n=$(rsync -azn --itemize-changes --omit-dir-times $RSYNC_EXCL "$d" "$HOST:$ROOT/" 2>/dev/null | grep -c '^[<>c]')
  if [ "$n" = 0 ]; then echo "  ok    $d — как на бою"; continue; fi
  case " ${GOTOVO:-} " in
    *" $d "*) echo "  ok    $d — отличается ($n файлов), везём по слову Сергея (GOTOVO)" ;;
    *) echo "  СТОП  $d — отличается от боя ($n файлов), слова «готово» нет"; ploho="$ploho $d" ;;
  esac
done
if [ -n "$ploho" ]; then
  echo "!! копии игр новее боя без слова Сергея:$ploho" >&2
  echo "!! есть «готово» через Рта — GOTOVO=\"$(echo $ploho)\" sh deploy.sh --go ; нет — не выкладывать" >&2
  exit 1
fi
