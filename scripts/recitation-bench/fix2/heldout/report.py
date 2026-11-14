"""False marks and coverage on the held-out pool, per voice. Every clip is a correct
recitation, so every bad verdict is a false mark. Coverage counts the words of the clip's
ayat that the check judged.

  python3 -I fix2/heldout/report.py <tag> [quiet|noise]

Reads .out/fix2/sim_heldout/<tag>/<id>.json (quiet, the default) or <id>.n10.json (noise)
for every clip of the held-out manifest; clips with no result are counted as missing.
"""
import collections
import json
import os
import sys

MODES = {'quiet': '', 'noise': '.n10', '': '', '.n10': '.n10'}
if len(sys.argv) not in (2, 3) or (len(sys.argv) == 3 and sys.argv[2] not in MODES):
    sys.exit('usage: python3 -I fix2/heldout/report.py <tag> [quiet|noise]')
tag = sys.argv[1]
suf = MODES[sys.argv[2]] if len(sys.argv) > 2 else ''
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', '.out', 'fix2')
ROOT = os.path.join(HERE, '..', '..', '..', '..')

q = json.load(open(os.path.join(ROOT, 'data', 'quran.json'), encoding='utf-8'))
# Words per ayah: the text's spaces, less the ayah number at its end.
counts = collections.defaultdict(dict)
for v in q.values():
    counts[v['surah_number']][v['ayah_number']] = len(v['text'].split()) - 1
clips = {c['id']: c for c in json.load(open(os.path.join(OUT, 'data', 'heldout_pool', 'manifest.json')))['clips']}
T = collections.defaultdict(collections.Counter)
bad = []
for cid, c in clips.items():
    f = os.path.join(OUT, 'sim_heldout', tag, f'{cid}{suf}.json')
    if not os.path.exists(f):
        T[c['reciter']]['missing'] += 1
        T['all']['missing'] += 1
        continue
    d = json.load(open(f))
    got = set(d['fineKeys']) | {b['key'] for b in d['bad']}
    words = sum(counts[c['surah']][a] for a in range(c['ayahStart'], c['ayahEnd'] + 1))
    inside = {k for k in got
              if int(k.split(':')[0]) == c['surah'] and c['ayahStart'] <= int(k.split(':')[1]) <= c['ayahEnd']}
    for who in (c['reciter'], 'all'):
        T[who]['clips'] += 1
        T[who]['words'] += words
        T[who]['judged'] += len(inside)
        T[who]['bad'] += len(d['bad'])
        T[who]['seconds'] += d['seconds']
    for b in d['bad']:
        bad.append((cid, c['reciter'], b))
print(f"{'voice':>28} clips  hours   words  judged  cover  false  per 1,000 judged")
for who in sorted(T, key=lambda x: (x == 'all', x)):
    t = T[who]
    print(f"{who:>28} {t['clips']:>5} {t['seconds'] / 3600:>6.2f} {t['words']:>7} {t['judged']:>7} "
          f"{100 * t['judged'] / max(1, t['words']):>5.1f}% {t['bad']:>6} {1000 * t['bad'] / max(1, t['judged']):>8.2f}"
          + (f"   ({t['missing']} missing)" if t['missing'] else ''))
for cid, rec, b in bad:
    print(f"   false: {cid} {b['key']} {b['verdict']} share={b['share']} gap={b['gap']} t={b['t']}")
