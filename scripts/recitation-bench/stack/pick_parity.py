# Picks the clips for the bench parity runs: pool and W1, a spread of reciters, with and
# without baseline marks. Writes manifests under .out/engine-stack/manifests.
import json, os, random, sys
B = sys.argv[1]
os.makedirs(f'{B}/.out/engine-stack/manifests', exist_ok=True)
random.seed(20261106)
def seconds(clip):
    parts = clip.get('parts') or [clip]
    return sum(os.path.getsize(p['audio']) / 4 / 16000 for p in parts if p.get('audio') and os.path.exists(p['audio']))
def baseline_bad(suite, clip):
    r = json.load(open(f"{B}/.out/natural/baseline/runs/{suite}/{clip['id'].replace(':','_')}.json"))
    bad = sum(1 for c in r['vchanges'] if c['to'] in ('wrong', 'skipped') and not c.get('stop'))
    return bad
pool = json.load(open(f'{B}/.out/natural/manifests/pool.json'))
w1 = json.load(open(f'{B}/.out/natural/manifests/w1.json'))
by_rec = {}
for c in pool:
    s = seconds(c)
    if 20 <= s <= 200:
        by_rec.setdefault(c['truth']['reciter'], []).append(c)
picked = []
recs = sorted(by_rec)
random.shuffle(recs)
for rec in recs[:14]:
    cl = by_rec[rec]
    random.shuffle(cl)
    cl.sort(key=lambda x: -baseline_bad('pool', x))
    picked.append(cl[0])
json.dump(picked, open(f'{B}/.out/engine-stack/manifests/parity_pool.json', 'w'))
print('pool', len(picked), round(sum(seconds(c) for c in picked)), 's', [c['id'] for c in picked][:3])
w = []
types = {}
for c in w1:
    t = c['truth']
    types.setdefault((t['type'], t.get('position')), []).append(c)
print({k: len(v) for k, v in types.items()})
keys = sorted(types, key=str)
random.shuffle(keys)
i = 0
seen_rec = set()
while len(w) < 16:
    k = keys[i % len(keys)]
    i += 1
    cl = [c for c in types[k] if c['truth']['reciter'] not in seen_rec and c not in w] or [c for c in types[k] if c not in w]
    if not cl:
        continue
    c = random.choice(cl)
    w.append(c)
    seen_rec.add(c['truth']['reciter'])
json.dump(w, open(f'{B}/.out/engine-stack/manifests/parity_w1.json', 'w'))
print('w1', len(w), round(sum(seconds(c) for c in w)), 's', [(c['truth']['type'], c['truth'].get('position')) for c in w])
