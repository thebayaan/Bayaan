"""Why planted mistakes were not caught: for each mistake with no live mark on its word or
a neighbour, the probe lines (score tests) on those words and their outcome, or "no look"
when the check never tested them. Ends with a count by (type, place, reason).

  python3 -I fix2/uncaught.py <planted tag> [<type>]

<type> is one of wrong_word, skip_word, skip_first_word, skip_last_word. Reads
.out/fix2/planted/<tag>/<name>.s<seed>.json and the truth files next to the tag.
Places are surah:ayah:word, words 0-based; letters are never printed.
"""
import collections
import glob
import json
import os
import sys

MISTAKES = ('wrong_word', 'skip_word', 'skip_first_word', 'skip_last_word')
if len(sys.argv) not in (2, 3) or (len(sys.argv) == 3 and sys.argv[2] not in MISTAKES):
    sys.exit('usage: python3 -I fix2/uncaught.py <planted tag> [' + '|'.join(MISTAKES) + ']')
tag = sys.argv[1]
only = sys.argv[2] if len(sys.argv) > 2 else None
HERE = os.path.dirname(os.path.abspath(__file__))
PLANTED = os.path.join(HERE, '..', '.out', 'fix2', 'planted')

why = collections.Counter()
for f in sorted(glob.glob(os.path.join(PLANTED, tag, '*.s*.json'))):
    stem = os.path.basename(f)[:-5]
    sim = json.load(open(f))
    truth = json.load(open(os.path.join(PLANTED, stem + '.truth.json')))
    bad = {b['key'] for b in sim['bad']}
    fine = set(sim.get('fineKeys') or [])
    for e in truth['events']:
        if e['type'] not in MISTAKES:
            continue
        if only and e['type'] != only:
            continue
        s, a = map(int, e['key'].split(':'))
        w = e['word'] - 1
        keys = [f'{s}:{a}:{w + k}' for k in (-1, 0, 1)]
        if any(k in bad for k in keys):
            continue
        ps = [p for p in sim['probes'] if p['key'] in keys]
        place = ('first' if w == 0 else 'last' if w == e['words'] - 1 else 'last2' if w == e['words'] - 2
                 else 'second' if w == 1 else 'mid')
        if not ps:
            reason = 'no look' + (' (word passed as fine)' if f'{s}:{a}:{w}' in fine else '')
        else:
            oc = (collections.Counter(p['outcome'] for p in ps if p['key'] == keys[1])
                  or collections.Counter(p['outcome'] for p in ps))
            reason = '+'.join(sorted(oc))
        why[(e['type'], place, reason)] += 1
        print(f"{stem} {e['type']} {s}:{a}:{w} of {e['words']} [{place}] -> {reason}")
        for p in ps[-4:]:
            print(f"      {p['key']}#{p['reading']} run={p['run']} {p['kind']} share={p['share']:.2f} "
                  f"gap={p['gap']:.1f} after={p['after']:.2f} around={[round(x, 2) for x in p['around']]} "
                  f"lead={p['lead']} end={p['end']} over={p['over']} closing={p['closing']} outcome={p['outcome']}")
print()
for k, n in sorted(why.items(), key=lambda x: -x[1]):
    print(n, k)
