# Clips for the second parity set: junction sites, their controls, added-word events and
# the live last-word suite, with a spread of reciters and pairs.
import json, os, random, sys
B = sys.argv[1]
random.seed(20261107)
M = f'{B}/.out/engine-stack/manifests'
def pick(src, n, name, key=lambda c: c['truth'].get('reciter')):
    clips = json.load(open(src))
    random.shuffle(clips)
    out = []
    seen = set()
    for c in clips:
        k = key(c)
        if k in seen:
            continue
        seen.add(k)
        out.append(c)
        if len(out) >= n:
            break
    for c in clips:
        if len(out) >= n:
            break
        if c not in out:
            out.append(c)
    json.dump(out, open(f'{M}/{name}.json', 'w'))
    print(name, len(out), 'of', len(clips))
J = f'{B}/.out/natural/junction/manifests'
V = f'{B}/.out/natural/verify/live'
print(os.listdir(J)); print(os.listdir(V))
pick(f'{J}/junction_live.json', 24, 'parity_sites')
pick(f'{J}/junction_control.json', 12, 'parity_control')
pick(f'{V}/added_test.json', 36, 'parity_added')
pick(f'{V}/live_last.json', 24, 'parity_last')
