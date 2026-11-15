"""Puts the replay scores of today's rules and the check side by side, per split.

    python3 -I natural/junction/final_table.py [dev] [test] [mixed]

Reads .out/natural/junction/scores/final_<rules>_<split>.json, written by
score_junction.mjs, and prints each table with sample sizes and intervals.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import text as T  # noqa: E402

SCORES = os.path.join(T.OUT, 'junction/scores')


def pct(r):
    if not r or r.get('est') is None:
        return 'n/a'
    return f"{100 * r['est']:.1f}% [{100 * (r['lo'] or 0):.1f}, {100 * (r['hi'] or 0):.1f}] ({r['num']:.0f}/{r['den']:.0f})"


def per1000(r):
    if not r or r.get('est') is None:
        return 'n/a'
    return f"{1000 * r['est']:.2f} [{1000 * (r['lo'] or 0):.2f}, {1000 * (r['hi'] or 0):.2f}] ({r['num']:.0f}/{r['den']:.0f})"


def load(rules, split):
    path = os.path.join(SCORES, f'final_{rules}_{split}.json')
    if not os.path.exists(path):
        return None
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def main():
    for split in sys.argv[1:] or ('dev', 'test', 'mixed'):
        today, check = load('today', split), load('check', split)
        if not today or not check:
            print(split, 'not scored')
            continue
        print(f'=== {split}')
        for name, data in (('today', today), ('check', check)):
            live = data.get('live')
            if live:
                for k in ('all', 'twoPlusNextWords', 'oneNextWord'):
                    a = live[k]
                    print(f'  sites {name} {k}: runs {a["runs"]}, sites {a["sites"]}, types {a["types"]}: '
                          f'exact {pct(a["exact"])}; by type {pct(a["exactByType"])}; exact or next to it '
                          f'{pct(a["exactOrNear"])}; collateral marks {a["collateralMarks"]} in {a["runsWithCollateral"]} runs')
                print(f'  latency {name}: {live["latencyFromNextWord"]}')
            control = data.get('control')
            if control:
                a = control['all']
                print(f'  controls {name}: runs {a["runs"]}, sites {a["sites"]}: mark on the said word {pct(a["exact"])}; '
                      f'collateral {a["collateralMarks"]}')
            for suite in ('pool', 'w5'):
                a = data.get(suite)
                if a:
                    print(f'  {suite} {name}: takes {a["takes"]}, words {a["words"]}: false marks {a["falseMarks"]}, '
                          f'on last words {a["onLastWords"]}, per 1000 {per1000(a["per1000"])}')
            w1 = data.get('w1')
            if w1:
                for k, a in w1.items():
                    print(f'  w1 {k} {name}: runs {a["runs"]}, pairs {a["pairs"]}: {pct(a["exact"])}')
        for suite in ('pool', 'w5'):
            if suite in today and suite in check:
                before = {r['id']: set(r['marks']) for r in today[suite]['rows']}
                after = {r['id']: set(r['marks']) for r in check[suite]['rows']}
                shared = set(before) & set(after)
                added = [(i, sorted(after[i] - before[i])) for i in shared if after[i] - before[i]]
                removed = [(i, sorted(before[i] - after[i])) for i in shared if before[i] - after[i]]
                print(f'  {suite}, takes in both {len(shared)}: marks added {sum(len(x[1]) for x in added)}, '
                      f'removed {sum(len(x[1]) for x in removed)}')
                for label, rows in (('added', added), ('removed', removed)):
                    for i, marks in rows:
                        print(f'    {label} {marks}')


if __name__ == '__main__':
    main()
