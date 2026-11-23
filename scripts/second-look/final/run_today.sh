#!/bin/zsh
# Runs today's committed engine (the pristine package with the committed patch) on the
# suites that have no saved run of it, one bench process at a time, through bench.mjs.
#   scripts/second-look/final/run_today.sh
cd "$(dirname "$0")/../../recitation-bench" || exit 1
F=.out/second-look/final
export TILAWA_DIST=$PWD/$F/engine_today/dist
export ORT_THREADS=1
wait_for_room() {
  while true; do
    used=$(sysctl -n vm.swapusage | sed -E 's/.*used = ([0-9]+).*/\1/')
    free=$(df -g .out | tail -1 | awk '{print $4}')
    [ "$used" -lt 20000 ] && [ "$free" -ge 10 ] && return
    print "waiting: swap ${used} MB, disk ${free} GB"
    command sleep 60
  done
}
one() {
  wait_for_room
  print "== $1 $(date +%H:%M:%S)"
  node natural/run_suite.mjs "$2" "$PWD/$F/today_runs/$1" --jobs 1 --minutes-per-process 40 | tail -1
}
V=.out/natural/verify
J=.out/natural/junction/manifests
python3 -I - "$F" <<'PY'
import json, sys
f = sys.argv[1]
m = json.load(open('.out/added/manifests/added_app_devtest.json'))
kept = [c for c in m if c['truth'].get('reciterSplit') == 'test' and c['truth'].get('pairSplit') == 'test']
json.dump(kept, open(f + '/added_app_test.json', 'w'))
print(len(kept))
PY
unset ENGINE_OPTS
one live_control $V/live/control.json
one live_last $V/live/live.json
one interior $V/live/interior.json
one sobolev_multi $V/live/sobolev_multi.json
one added_app $F/added_app_test.json
export ENGINE_OPTS='{"stayOnSurah":true,"config":{"idleFrames":100000,"lostRate":9}}'
one added_kept $V/live/added_test.json
unset ENGINE_OPTS
one sites $J/junction_live.json
one sites_control $J/junction_control.json
print finished-today
