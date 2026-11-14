"""What each reciter said in each staged clip, as official token numbers, from
QUA's own recited text (repeats kept), mapped by natural/text.py's recited_map.

    python3 -I judge/recited.py

Writes .out/natural/judge/recited.json:
{reciter: {key: {"map": [hafs token per recited word], "restarts": n,
                 "stamps": [[start_ms, end_ms] per recited word], "ms": duration}}}
Rows that are not the official text with repeats get "map": null and stay out.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'natural'))
import text as T  # noqa: E402

META = os.path.join(T.OUT, 'qua_meta')
AUDIO = os.path.join(T.OUT, 'audio')
OUT = os.path.join(T.OUT, 'judge', 'recited.json')


def hafs_map(key, engine_map):
    """Engine word per recited word -> Hafs token per recited word. Two engine
    words of one split token read in a row count as one recited word."""
    out = []
    keep = []
    for i, e in enumerate(engine_map):
        h = T.hafs_token(key, e)
        if out and out[-1] == h and engine_map[i - 1] == e - 1:
            keep[-1].append(i)
            continue
        out.append(h)
        keep.append([i])
    return out, keep


def main():
    corpus = T.load_corpus()
    out = {}
    total = masked = 0
    for name in sorted(os.listdir(META)):
        slug = name[: -len('.jsonl')]
        staged = {f[: -len('.f32')].replace('_', ':') for f in os.listdir(os.path.join(AUDIO, slug)) if f.endswith('.f32')}
        rows = {}
        with open(os.path.join(META, name), encoding='utf-8') as f:
            for line in f:
                r = json.loads(line)
                key = f"{r['surah']}:{r['ayah']}"
                if key not in staged:
                    continue
                total += 1
                engine_words = [w[1] for w in corpus[key]]
                mapping, restarts = T.recited_map(T.tokens(r['text_uthmani']), engine_words)
                if mapping is None:
                    masked += 1
                    rows[key] = {'map': None}
                    continue
                hafs, groups = hafs_map(key, mapping)
                stamps = r['word_timestamps']
                rows[key] = {
                    'map': hafs,
                    'restarts': restarts,
                    'stamps': [[int(stamps[g[0]][1]), int(stamps[g[-1]][2])] for g in groups],
                    'ms': r['duration_ms'],
                }
        out[slug] = rows
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, separators=(',', ':'))
    print(json.dumps({'clips': total, 'masked': masked, 'reciters': len(out), 'bytes': os.path.getsize(OUT)}))


if __name__ == '__main__':
    main()
