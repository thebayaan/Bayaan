"""Text-side true events for the junction test, from the official text only.

    python3 -I natural/junction/ending_twins.py

Ayah Y ends with word c. Ayah X, elsewhere, ends '... c L'. A reader of Y who goes
on to the next ayah has said c and no L, so over that join the hypothesis 'c L +
next opening' should lose to 'c + next opening'. Nothing is cut or changed; only
the likelihood is computed against a real official word pair. The next opening is
the audio's own, so unlike a natural site (sites.py) it need not be X's.

Also lists interior places where the official text runs 'c d' and X reads 'c L | d'
across an ayah end: a reader who goes straight on with no pause.

Writes .out/natural/junction/ending_twins.json. test_junction.py checks every
entry against the pinned text.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)
import sites as S  # noqa: E402
import text as T  # noqa: E402


def build():
    hafs = T.load_hafs()
    corpus = T.load_corpus()
    keys = T.ayah_keys(hafs)
    # Ayat by their second-last word.
    by_c = {}
    for x in keys:
        t = hafs[x]
        if len(t) >= 2:
            by_c.setdefault(t[-2], []).append(x)
    endings = {}
    for y in keys:
        c = hafs[y][-1]
        for x in by_c.get(c, []):
            if x == y:
                continue
            # Y's own next word must not already be L: then L is not missing.
            ny = S.next_key(hafs, y)
            if ny and hafs[ny][0] == hafs[x][-1]:
                continue
            endings.setdefault(y, []).append(
                {
                    'x': x,
                    'engineLast': len(corpus[x]) - 1,
                    'word': hafs[x][-1],
                    'split': S.type_split(hafs[x][-1]),
                }
            )
    # Interior 'c d' with X reading 'c L | d'.
    by_cd = {}
    for x in keys:
        t = hafs[x]
        nx = S.next_key(hafs, x)
        if nx and len(t) >= 2:
            by_cd.setdefault((t[-2], hafs[nx][0]), []).append(x)
    interior = {}
    for y in keys:
        t = hafs[y]
        for i in range(len(t) - 1):
            for x in by_cd.get((t[i], t[i + 1]), []):
                if x == y:
                    continue
                interior.setdefault(y, []).append(
                    {
                        'token': i,
                        'engineWord': T.engine_word(y, i),
                        'x': x,
                        'engineLast': len(corpus[x]) - 1,
                        'word': hafs[x][-1],
                        'split': S.type_split(hafs[x][-1]),
                    }
                )
    # Whole-ayah twins differing in the last word only, not in sound alone: the
    # reader said another word there and went on. A changed word, not a left-out one.
    changed = {}
    with open(os.path.join(T.OUT, 'manifests/w1_pairs.json'), encoding='utf-8') as f:
        pairs = json.load(f)['pairs']
    for p in pairs:
        if p['type'] != 'sub' or p['position'] != 'last' or p['spellingOnly']:
            continue
        for y, x in ((p['a'], p['b']), (p['b'], p['a'])):
            changed.setdefault(y, []).append(
                {
                    'x': x,
                    'engineLast': len(corpus[x]) - 1,
                    'word': hafs[x][-1],
                    'split': S.type_split(hafs[x][-1]),
                }
            )
    return {'endings': endings, 'interior': interior, 'changed': changed}


if __name__ == '__main__':
    built = build()
    out = os.path.join(T.OUT, 'junction/ending_twins.json')
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(built, f, ensure_ascii=False)
    ends = built['endings']
    print('ayat Y with an ending twin', len(ends), 'events', sum(len(v) for v in ends.values()),
          'last-word types', len({e['word'] for v in ends.values() for e in v}))
    inner = built['interior']
    print('ayat with interior sites', len(inner), 'events', sum(len(v) for v in inner.values()),
          'last-word types', len({e['word'] for v in inner.values() for e in v}))
    print('ayat with a changed-last-word twin', len(built['changed']),
          'events', sum(len(v) for v in built['changed'].values()))
