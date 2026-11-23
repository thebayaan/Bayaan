"""Which pairs of the live-path suites are close: letter distance 1 to 2, by the benchmark's own
key on the pinned official text. Writes .out/second-look/live_close.json. No audio, no scores.

  python3 -I scripts/second-look/live_close.py
"""
import json
import os
import sys

BENCH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'recitation-bench')
os.chdir(BENCH)
sys.path.insert(0, 'natural')
import mutashabih as M
import text as T

hafs = T.load_hafs()
out = {}
for clip in json.load(open('.out/natural/verify/live/live.json', encoding='utf8')):
    t = clip['truth']
    kind, x, y = t['pair'].split('~')
    j_x = 0 if kind == 'arrive_first' else len(hafs[x]) - 1
    j_y = 0 if kind == 'arrive_first' else len(hafs[y]) - 1
    d = M.edit_distance(M.text_key(hafs[x], j_x), M.text_key(hafs[y], j_y))
    out[t['pair']] = {'distance': d, 'close': d <= M.CLOSE_DISTANCE}
os.makedirs('.out/second-look', exist_ok=True)
json.dump(out, open('.out/second-look/live_close.json', 'w'), indent=0)
print(len(out), sum(1 for v in out.values() if v['close']))
