"""python3 -I fix2/stage/twin_pairs.py <w1_pairs.json> <out pairs.json> <out ayat.json>
Reduces the W1 pair list to numbers (no text) and lists every distinct ayah on either side of a
sub / spelling / indel / short_indel pair."""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qtext
src, out, ayat_out = sys.argv[1:4]
d = json.load(open(src, encoding='utf-8'))
W = qtext.words()
rows, ayat, bad = [], set(), []
for p in d['pairs']:
    t = p['type']
    if t == 'sub':
        x, y, wx, wy = p['a'], p['b'], p['token'], p['token']
        typ = 'spelling' if p['spellingOnly'] else 'sub'
        r = {'id': p['id'], 'type': typ, 'x': x, 'y': y, 'wordX': wx, 'wordY': wy, 'place': p['position'],
             'close': p['close'], 'textDistance': p['textDistance'], 'phonDistance': p['phonDistance']}
    elif t in ('indel', 'short_indel'):
        x, y = p['long'], p['short']
        r = {'id': p['id'], 'type': 'indel', 'x': x, 'y': y, 'wordX': p['token'], 'wordY': p['token'],
             'place': p['position'], 'short': t == 'short_indel',
             'note': 'x is the longer ayah; wordX is the word missing from y; wordY is where it would sit in y (may equal len(y))'}
    else:
        continue
    # check word counts against data/quran.json
    nx, ny = len(W[x]), len(W[y])
    if r['type'] == 'indel':
        ok = nx == ny + 1 and wx_ok if (wx_ok := r['wordX'] < nx) else False
    else:
        ok = nx == ny and r['wordX'] < nx
    if not ok:
        bad.append(p['id'])
    r['wordsX'], r['wordsY'] = nx, ny
    rows.append(r); ayat.update([x, y])
key = lambda k: tuple(int(v) for v in k.split(':'))
json.dump(rows, open(out, 'w'), indent=1)
json.dump(sorted(ayat, key=key), open(ayat_out, 'w'))
import collections
print(len(rows), collections.Counter(r['type'] for r in rows), 'ayat', len(ayat), 'word-count mismatches', bad)
