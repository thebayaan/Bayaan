"""Table from e3_join.mjs output: per quiet between the two ayat, window start (gapcut,
pausecut, tail1, tail2) and position in the next ayah, the share of words whose greedy letters
differ from the text, and the share that would fail both tests ('big', or not found at all).

  python3 -I fix2/experiments/e3_an.py [<dir>]

<dir> defaults to .out/fix2/e3.
"""
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
d = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '..', '.out', 'fix2', 'e3')
rows = [json.loads(line) for f in sorted(glob.glob(os.path.join(d, '*.jsonl'))) for line in open(f)]
print('rows', len(rows))
for lo, hi, label in [(0, 0.16, 'gap < 0.16 s'), (0.16, 0.5, 'gap 0.16-0.5 s'), (0.5, 99, 'gap >= 0.5 s')]:
    print(label)
    for kind in ['gapcut', 'pausecut', 'tail1', 'tail2']:
        line = []
        for pos in range(5):
            rs = [r for r in rows if r['kind'] == kind and r['pos'] == pos and lo <= r['gap'] < hi]
            if rs:
                wrong = 100 * sum(r['ed'] > 0 for r in rs) / len(rs)
                big = 100 * sum(('none' in r) or (r['ed'] / r['n'] >= 0.34 and r['sc'] / r['n'] < -1)
                                for r in rs) / len(rs)
                line.append(f'pos{pos}: {wrong:5.1f}% big {big:4.1f}% (n={len(rs)})')
        print(f'  {kind:8s}', ' | '.join(line))
