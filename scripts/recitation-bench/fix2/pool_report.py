"""Report on a clean-pool run set from run_sims.sh: coverage (words of text judged, first and
last words of each ayah judged), false marks per 1,000 judged words, and the strongest score
tests that did not end in a mark (probe lines with a gap of 4 or more).

  python3 -I fix2/pool_report.py <tag>

Reads .out/fix2/sim/<tag>/*.json. Every final mark on the clean pool is a false mark.
"""
import collections
import glob
import json
import os
import sys

if len(sys.argv) != 2:
    sys.exit('usage: python3 -I fix2/pool_report.py <tag>')
tag = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '.out', 'fix2')
ROOT = os.path.join(HERE, '..', '..', '..')

q = json.load(open(os.path.join(ROOT, 'data', 'quran.json'), encoding='utf-8'))
# Words per ayah: the text's spaces, less the ayah number at its end.
cnt = collections.defaultdict(dict)
for v in q.values():
    cnt[v['surah_number']][v['ayah_number']] = len(v['text'].split()) - 1

tot_words = tot_judged = 0
bad, rows, probes = [], [], []
for f in sorted(glob.glob(os.path.join(OUT, 'sim', tag, '*.json'))):
    d = json.load(open(f))
    name = d['name']
    surah = int(name.split('_')[1])
    words = sum(cnt[surah].values())
    keys = set(d.get('fineKeys') or []) | {b['key'] for b in d['bad']}
    first = sum(1 for a in cnt[surah] if f'{surah}:{a}:0' in keys)
    last = sum(1 for a, n in cnt[surah].items() if f'{surah}:{a}:{n - 1}' in keys)
    rows.append((name, d['seconds'], words, len(keys), first, last, len(cnt[surah]), len(d['bad']),
                 d['runs'], d['msPerRun'], d['meanWindow']))
    tot_words += words
    tot_judged += len(keys)
    bad += [(name, b) for b in d['bad']]
    probes += [(name, p) for p in d['probes']]

print(f'{len(rows)} files, {tot_words} words of text, {tot_judged} judged '
      f'({100 * tot_judged / max(1, tot_words):.1f}%), final bad {len(bad)} = '
      f'{1000 * len(bad) / max(1, tot_judged):.2f} per 1000 judged')
print('name      secs  words judged%  first  last   bad runs/s ms/run win')
for r in rows:
    print(f'{r[0]:8s} {r[1]:6.0f} {r[2]:5d} {100 * r[3] / r[2]:5.1f}  {r[4]:3d}/{r[6]:<3d} '
          f'{r[5]:3d}/{r[6]:<3d} {r[7]:3d} {r[8] / r[1]:5.2f} {r[9]:5.1f} {r[10]:4.1f}')
print('\nFINAL BAD:')
for name, b in bad:
    print(' ', name, b)
strong = [(name, p) for name, p in probes if p['gap'] >= 4 and not p['final']]
print(f'\nprobes: {len(probes)}; not final with gap>=4: {len(strong)}')
for name, p in sorted(strong, key=lambda x: -x[1]['gap'])[:25]:
    print(' ', name, {k: (round(v, 2) if isinstance(v, float) else v) for k, v in p.items()})
