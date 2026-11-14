#!/bin/zsh
# The combined engine (junction check and gap report) with voices behind correct recitation.
# One condition at a time; run.mjs deletes each condition's mixed audio when it ends and skips
# finished clips, so this resumes. Waits while swap is above 20 GB or free disk below 10 GB.
B=${0:A:h}/../recitation-bench
B=${B:A}
V=$B/.out/natural/verify
export TILAWA_DIST=$V/dist
export ENGINE_OPTS='{"junction":{"llrMissing":-7,"fitNext":-4,"fitLate":-20}}'
export BENCH_PROBE=$V/probe.mjs
export ORT_THREADS=1
cd $B
limits_ok() {
  local used=$(sysctl -n vm.swapusage | sed -E 's/.*used = ([0-9]+).*/\1/')
  local free=$(df -g $B/.out | tail -1 | awk '{print $4}')
  [[ $used -lt 20000 && $free -ge 10 ]]
}
for cond in none:0 one_ar:10 crowd:10 one_ar:5 crowd:5 rec_one:5; do
  until limits_ok; do /bin/sleep 60; done
  echo "$(date) start $cond"
  node chatter/run.mjs --conds $cond --jobs 3 --variant combined
  echo "$(date) done $cond"
done
echo finished
