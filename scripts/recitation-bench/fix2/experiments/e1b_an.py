"""Tables from e1b.mjs output: for condition A, by audio after the word's end (dR), the share
of words whose greedy letters differ from the text, the 1st percentile and minimum of the
forced score per letter, and for a planted change: how often its letters were read anyway
and the 1st and 5th percentiles of the whole-window score gap (ctot); for conditions B0 and
Bq, the last three words before the cut.

  python3 -I fix2/experiments/e1b_an.py [<e1b .jsonl> ...]

With no files, every .jsonl under .out/fix2/e1b. Needs numpy.
"""
import collections
import glob
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
files = sys.argv[1:] or sorted(glob.glob(os.path.join(HERE, '..', '..', '.out', 'fix2', 'e1b', '*.jsonl')))
rows = [json.loads(line) for f in files for line in open(f)]
A = [r for r in rows if r['cond'] == 'A']
print('cond A rows', len(A), 'words', len({r['i'] for r in A}))
bins = [0, 0.12, 0.24, 0.36, 0.48, 0.72, 0.96, 1.2, 1.44, 1.92, 2.88, 9]


def bin_of(d):
    for i in range(len(bins) - 1):
        if bins[i] <= d < bins[i + 1]:
            return i
    return len(bins) - 2


def table(sel, title):
    agg = collections.defaultdict(list)
    for r in A:
        if sel(r):
            agg[bin_of(r['dR'])].append(r)
    print(f'\n{title}\n dR bin       n  edErr%  sc/let p1   min | changed n  miss%(ced<.5)  ctot p1   ctot p5')
    for i in sorted(agg):
        rs = agg[i]
        psc = np.array([r['sc'] / r['n'] for r in rs])
        ch = [r for r in rs if 'ctot' in r]
        ct = np.array([r['ctot'] for r in ch]) if ch else np.array([0.0])
        cm = np.mean([('cnone' not in r) and r['ced'] / r['cn'] < 0.5 for r in ch]) * 100 if ch else 0
        print(f" {bins[i]:4.2f}-{bins[i + 1]:4.2f} {len(rs):5d} {np.mean([r['ed'] > 0 for r in rs]) * 100:6.2f}  "
              f"{np.percentile(psc, 1):7.2f} {psc.min():7.2f} | {len(ch):5d}   {cm:6.2f}     "
              f"{np.percentile(ct, 1):7.2f} {np.percentile(ct, 5):7.2f}")


table(lambda r: not r['last'] and not r['cutMid'] and r['into'] <= 0,
      'A: interior+first words, window from ayah start, right edge inside the ayah')
table(lambda r: not r['last'] and r['cutMid'] and r['into'] <= 0,
      'A: same, but left edge cut at a word boundary mid-ayah (ayah longer than W)')
table(lambda r: r['last'], 'A: last word of the ayah (right edge in the pause or into the next ayah)')
table(lambda r: not r['last'] and r['into'] > 0, 'A: non-last words, right edge already past the ayah end')
for cond in ['B0', 'Bq']:
    B = [r for r in rows if r['cond'] == cond]
    print(f'\ncond {cond}: right edge at a word end' + (' + quiet tail' if cond == 'Bq' else ''))
    for back in [0, 1, 2]:
        for name, sel in [('non-last', lambda r: not r['last']), ('last', lambda r: r['last'])]:
            rs = [r for r in B if r['back'] == back and sel(r)]
            if not rs:
                continue
            psc = np.array([r['sc'] / r['n'] for r in rs])
            print(f"  back={back} {name:8s} n={len(rs):4d} edErr%={np.mean([r['ed'] > 0 for r in rs]) * 100:6.2f} "
                  f"sc/let p1={np.percentile(psc, 1):6.2f} min={psc.min():6.2f}")
