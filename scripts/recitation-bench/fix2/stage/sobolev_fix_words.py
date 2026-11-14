"""Second pass over _dl/sobolev/meta.json: an error word whose skeleton is not in the official ayah
is located in the row's own 'text' field; when that text has the same word count as the official
ayah, the position gives the 1-based word number (method 'position-in-row-text'); otherwise an
edit-distance-1 skeleton match is tried. Text is never written out."""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qtext
from paths import DATA as D
rows = {r['file_name']: r for r in map(json.loads, open(f'{D}/_dl/sobolev_metadata.jsonl', encoding='utf-8')) if r['riwayah'] == 'Hafs'}
meta = json.load(open(f'{D}/_dl/sobolev/meta.json'))
def ed(a, b):
    p = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        c = [i]
        for j, y in enumerate(b, 1): c.append(min(p[j] + 1, c[-1] + 1, p[j - 1] + (x != y)))
        p = c
    return p[-1]
fixed = left = 0
for m in meta:
    r = rows[m['file']]
    off = [qtext.skeleton(w) for w in qtext.words()[f"{m['surah']}:{m['ayah']}"]]
    tx = [qtext.skeleton(w) for w in r['text'].split()]
    for e, word in zip(m['errors'], r['errors']):
        e.setdefault('method', 'skeleton' if e['word'] else None)
        if e['word'] is not None: continue
        k = qtext.skeleton(word)
        if k in tx and len(tx) == len(off) and tx.count(k) == 1:
            e['word'] = tx.index(k) + 1; e['method'] = 'position-in-row-text'; fixed += 1; continue
        near = [i + 1 for i, w in enumerate(off) if ed(w, k) <= 1]
        if len(near) == 1:
            e['word'] = near[0]; e['method'] = 'skeleton-edit1'; fixed += 1
        else:
            e['method'] = 'unmapped'; left += 1
json.dump(meta, open(f'{D}/_dl/sobolev/meta.json', 'w'), indent=0)
print('fixed', fixed, 'left', left)
