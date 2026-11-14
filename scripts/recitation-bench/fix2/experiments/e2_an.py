"""Table from e2_pause.mjs output: per window start (ayah, pause, word) and word position in
the window, the share of words whose greedy letters differ from the text, and the share that
would fail both tests ('big': letters differ by a third or more and forced score per letter
under -1).

  python3 -I fix2/experiments/e2_an.py [<dir>]

<dir> defaults to .out/fix2/e2.
"""
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
d = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '..', '.out', 'fix2', 'e2')
rows = [json.loads(line) for f in sorted(glob.glob(os.path.join(d, '*.jsonl'))) for line in open(f)]
print('rows', len(rows))
for kind in ['ayah', 'pause', 'word']:
    line = []
    for pos in range(6):
        rs = [r for r in rows if r['kind'] == kind and r['pos'] == pos]
        if rs:
            wrong = 100 * sum(r['ed'] > 0 for r in rs) / len(rs)
            big = 100 * sum(r['ed'] / r['n'] >= 0.34 and r['sc'] / r['n'] < -1 for r in rs) / len(rs)
            line.append(f'pos{pos}: {wrong:5.1f}% big {big:4.1f}% (n={len(rs)})')
    print(f'{kind:6s}', ' | '.join(line))
