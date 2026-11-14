"""One line per tag: on the clean pool, false marks and coverage; on the planted runs,
mistakes caught (a live mark on the word or a neighbour) out of those planted, false
marks, and the time from the word to its mark (median / 90th percentile). The false
marks are listed under each line.

  python3 -I fix2/summary.py <tag> [<tag> ...]

Reads .out/fix2/sim/<tag>/*.json (sim.mjs with --keep 1) and scores
.out/fix2/planted/<tag> with score_planted.mjs, without writing its _score.json. A side
with no folder counts as empty.
"""
import collections
import glob
import json
import os
import re
import subprocess
import sys

if len(sys.argv) < 2:
    sys.exit('usage: python3 -I fix2/summary.py <tag> [<tag> ...]')
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '.out', 'fix2')
ROOT = os.path.join(HERE, '..', '..', '..')

q = json.load(open(os.path.join(ROOT, 'data', 'quran.json'), encoding='utf-8'))
# Words per ayah: the text's spaces, less the ayah number at its end.
counts = collections.defaultdict(dict)
for v in q.values():
    counts[v['surah_number']][v['ayah_number']] = len(v['text'].split()) - 1

for tag in sys.argv[1:]:
    bad = []
    judged = total = files = 0
    for f in sorted(glob.glob(os.path.join(OUT, 'sim', tag, '*.json'))):
        d = json.load(open(f))
        files += 1
        name = os.path.basename(f)[:-5]
        surah = int(name.split('_')[1])
        got = set(d['fineKeys']) | {b['key'] for b in d['bad']}
        judged += len(got)
        total += sum(counts[surah].values())
        for b in d['bad']:
            bad.append(f"{name} {b['key']} {b['verdict']} share={b['share']} gap={b['gap']}")
    line = (f'{tag:10} clean {files} files: false {len(bad)} of {judged} judged '
            f'({1000 * len(bad) / max(1, judged):.2f}/1000), coverage {100 * judged / max(1, total):.1f}%')
    out = ''
    if os.path.isdir(os.path.join(OUT, 'planted', tag)):
        out = subprocess.run(['node', os.path.join(HERE, 'score_planted.mjs'), tag, '--verbose', '1', '--nowrite', '1'],
                             capture_output=True, text=True).stdout

    def row(t):
        # n, caught on the word, caught on the word or a neighbour
        return re.search(rf'^{t}\s+(\d+)\s+(\d+)\s+[\d.]+%\s+(\d+)', out, re.M) or [None, '0', '0', '0']

    parts = []
    for t in ('wrong_word', 'skip_word', 'skip_first_word', 'skip_last_word'):
        m = row(t)
        parts.append(f"{t.replace('_word', '')} {m[3]}/{m[1]}")
    fm = re.search(r'live false marks: (\d+) = ([\d.]+)', out)
    lat = re.search(r'median ([\d.]+) s, p90 ([\d.]+) s \(n=(\d+)\)', out)
    line += (' | planted: ' + ', '.join(parts) + (f'; false {fm[1]} ({fm[2]}/1000)' if fm else '')
             + (f'; latency {lat[1]}/{lat[2]} s' if lat else ''))
    print(line)
    for b in bad:
        print('      clean false:', b)
    for x in out.split('\n'):
        if x.strip().startswith('false '):
            print('      planted', x.strip()[:200])
