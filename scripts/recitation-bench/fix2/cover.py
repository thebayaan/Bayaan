"""Coverage of one sim result: words of the surah judged, first and last words of each ayah
judged, and final bad marks. With --detail, also the words not judged per ayah, the bad marks
and the probe lines.

  python3 -I fix2/cover.py <sim result .json> [--detail]

The result must come from sim.mjs with --keep 1 (it lists the words judged fine).
"""
import collections
import json
import os
import sys

if len(sys.argv) < 2:
    sys.exit('usage: python3 -I fix2/cover.py <sim result .json> [--detail]')
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..', '..')
d = json.load(open(sys.argv[1]))
name = d['name']
surah = int(name.split('_')[1])
if d.get('fineKeys') is None:
    sys.exit(f'{sys.argv[1]}: no fineKeys; run sim.mjs with --keep 1')
fine = set(d['fineKeys'])
q = json.load(open(os.path.join(ROOT, 'data', 'quran.json'), encoding='utf-8'))
cnt = {v['ayah_number']: len(v['text'].split()) - 1 for v in q.values() if v['surah_number'] == surah}
by = collections.defaultdict(set)
for k in fine:
    s, a, w = k.split(':')
    by[int(a)].add(int(w))
tot = sum(cnt.values())
got = sum(len(v) for v in by.values())
first = sum(1 for a in cnt if 0 in by[a])
last = sum(1 for a in cnt if cnt[a] - 1 in by[a])
print(f'{name}: judged {got}/{tot} = {100 * got / tot:.1f}%  first words {first}/{len(cnt)}  '
      f'last words {last}/{len(cnt)}  bad {len(d["bad"])}')
if '--detail' in sys.argv[2:]:
    print([(a, sorted(set(range(cnt[a])) - by[a])) for a in sorted(cnt) if set(range(cnt[a])) - by[a]])
    print('bad', d['bad'])
    for p in d['probes']:
        print(' ', {k: (round(v, 2) if isinstance(v, float) else v) for k, v in p.items()})
