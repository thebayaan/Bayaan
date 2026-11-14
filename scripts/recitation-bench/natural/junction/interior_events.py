"""Where the pool's recordings read an official 'c d' that some ayah X reads as
'c L | d' across its end (ending_twins.py), with QUA's word times.

    python3 -I natural/junction/interior_events.py

Writes .out/natural/junction/interior_events.json: {clip id: [event]}. Only rows
that read the two words once and in order are used; nothing else is read.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)
import manifests as Mf  # noqa: E402
import text as T  # noqa: E402


def main():
    corpus = T.load_corpus()
    with open(os.path.join(T.OUT, 'junction/ending_twins.json'), encoding='utf-8') as f:
        interior = json.load(f)['interior']
    with open(os.path.join(Mf.MAN, 'pool.json'), encoding='utf-8') as f:
        pool = json.load(f)
    metas = {}
    out = {}
    total = 0
    for clip in pool:
        s = clip['truth']['reciter']
        meta = metas.setdefault(s, Mf.load_meta(s, corpus))
        rows = []
        for i, part in enumerate(clip['parts']):
            key = part['key']
            if key not in interior:
                continue
            r = meta.get(key)
            if not r or r['engineMap'] is None:
                continue
            for e in interior[key]:
                w = e['engineWord']
                # The two words, once each and next to each other in the reading.
                at = [j for j, m in enumerate(r['engineMap']) if m == w]
                if len(at) != 1 or at[0] + 1 >= len(r['engineMap']):
                    continue
                if r['engineMap'][at[0] + 1] != w + 1:
                    continue
                rows.append(
                    {
                        'part': i,
                        'key': key,
                        'c': w,
                        'cStartMs': r['stamps'][at[0]][0],
                        'dEndMs': r['stamps'][at[0] + 1][1],
                        'x': e['x'],
                        'engineLast': e['engineLast'],
                        'word': e['word'],
                        'split': e['split'],
                    }
                )
        if rows:
            out[clip['id']] = rows
            total += len(rows)
    with open(os.path.join(T.OUT, 'junction/interior_events.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False)
    print('clips', len(out), 'events', total,
          'word types', len({e['word'] for v in out.values() for e in v}))


if __name__ == '__main__':
    main()
