"""Writes what the judge reads, from the pinned official text only:
.out/natural/judge/index.json.

    python3 -I judge/build_index.py
"""
import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import letters as L  # noqa: E402

OUT = os.path.join(HERE, '..', '.out', 'natural', 'judge')


def main():
    index = L.Index()
    near = {}
    types = {}
    type_list = []

    def tid(x):
        if x not in types:
            types[x] = len(type_list)
            type_list.append(x)
        return types[x]

    ayat = {}
    stats = {'mutashabihPlaces': 0, 'nearSizes': [], 'mutSizes': []}
    for k in index.keys:
        rows = []
        for j, word_letters in enumerate(index.letters[k]):
            m = [tid(x) for x in index.mutashabih(k, j)]
            s = index.sound[k][j]
            if s not in near:
                near[s] = None
            n = index.near(k, j)
            rows.append({'l': word_letters, 's': s, 'm': m})
            stats['nearSizes'].append(len(n))
            stats['mutSizes'].append(len(m))
            if m:
                stats['mutashabihPlaces'] += 1
            near[s] = [tid(x) for x in n]
        ayat[k] = rows
    out = {
        'hafsSha256': L.T.PINS['hafs'],
        'splits': L.T.ENGINE_SPLITS,
        'types': type_list,
        'near': near,
        'ayat': ayat,
    }
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, 'index.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    sizes = sorted(stats['nearSizes'])
    mut = sorted(stats['mutSizes'])
    q = lambda xs, p: xs[min(len(xs) - 1, int(p * len(xs)))]
    print(
        json.dumps(
            {
                'bytes': os.path.getsize(path),
                'sha256': hashlib.sha256(open(path, 'rb').read()).hexdigest(),
                'words': len(sizes),
                'wordTypes': len(type_list),
                'soundKeys': len(near),
                'near': {'p50': q(sizes, 0.5), 'p90': q(sizes, 0.9), 'p99': q(sizes, 0.99), 'max': sizes[-1], 'empty': sum(x == 0 for x in sizes)},
                'mutashabih': {'places': stats['mutashabihPlaces'], 'p50': q(mut, 0.5), 'p90': q(mut, 0.9), 'p99': q(mut, 0.99), 'max': mut[-1]},
            },
            ensure_ascii=False,
        )
    )


if __name__ == '__main__':
    main()
