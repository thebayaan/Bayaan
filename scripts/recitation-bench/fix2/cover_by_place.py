"""Coverage by the word's place in the ayah, per reciter, for a clean-pool run set: the
share of first words, middle words, second-to-last words and last words that the live
check judged, and the final bad marks (all false on the clean pool).

  python3 -I fix2/cover_by_place.py <tag>

Reads .out/fix2/sim/<tag>/*.json, which must come from sim.mjs with --keep 1.
"""
import collections
import glob
import json
import os
import sys

if len(sys.argv) != 2:
    sys.exit('usage: python3 -I fix2/cover_by_place.py <tag>')
tag = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '.out', 'fix2')
ROOT = os.path.join(HERE, '..', '..', '..')

q = json.load(open(os.path.join(ROOT, 'data', 'quran.json'), encoding='utf-8'))
# Words per ayah: the text's spaces, less the ayah number at its end.
counts = collections.defaultdict(dict)
for v in q.values():
    counts[v['surah_number']][v['ayah_number']] = len(v['text'].split()) - 1

PLACES = ('first', 'mid', 'last2', 'last')
T = collections.defaultdict(collections.Counter)
for f in sorted(glob.glob(os.path.join(OUT, 'sim', tag, '*.json'))):
    d = json.load(open(f))
    name = os.path.basename(f)[:-5]
    rec, surah = name.split('_')
    surah = int(surah)
    got = set(d['fineKeys']) | {b['key'] for b in d['bad']}
    for a, n in counts[surah].items():
        for w in range(n):
            place = 'first' if w == 0 else 'last' if w == n - 1 else 'last2' if w == n - 2 else 'mid'
            for who in (rec, 'all'):
                T[who][place + '_n'] += 1
                if f'{surah}:{a}:{w}' in got:
                    T[who][place] += 1
    T[rec]['bad'] += len(d['bad'])
    T['all']['bad'] += len(d['bad'])

print(f"{'reciter':>8} {'first':>12} {'mid':>12} {'last2':>12} {'last':>12} {'all':>14} bad")
for who in sorted(T, key=lambda x: (x == 'all', int(x) if x != 'all' else 0)):
    t = T[who]

    def cell(p):
        return f"{t[p]}/{t[p + '_n']}={100 * t[p] / max(1, t[p + '_n']):.0f}%"

    tot = sum(t[p] for p in PLACES)
    n = sum(t[p + '_n'] for p in PLACES)
    print(f"{who:>8} {cell('first'):>12} {cell('mid'):>12} {cell('last2'):>12} {cell('last'):>12} "
          f"{tot:>6}/{n}={100 * tot / max(1, n):.0f}% {t['bad']}")
