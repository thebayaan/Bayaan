"""SHA-256 pins of what the natural benchmark was built from.

    python3 -I natural/pins.py write   # after building manifests
    python3 -I natural/pins.py check

natural/pins.json holds hashes only, so it carries no reciter names. Absolute
paths are masked before hashing, so a checkout elsewhere gets the same hashes.
"""
import hashlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import text as T  # noqa: E402

PIN_FILE = os.path.join(T.HERE, 'pins.json')
MAN = os.path.join(T.OUT, 'manifests')
BUILT = [
    'reciters.json',
    'w1_pairs.json',
    'w5_sites.json',
    'wanted.json',
    'pool_plan.json',
    'w1.json',
    'w1_control.json',
    'pool.json',
    'w5.json',
    'learners.json',
]


def masked_sha(path):
    with open(path, encoding='utf-8') as f:
        text = f.read()
    return hashlib.sha256(text.replace(T.BENCH, '$BENCH').encode('utf-8')).hexdigest()


def current():
    out = {
        'hafs': T.sha256(T.HAFS_FILE),
        'app': T.sha256(T.APP_FILE),
        'corpus': T.sha256(T.CORPUS_FILE),
        'quaRevision': None,
        'manifests': {},
    }
    with open(os.path.join(MAN, 'reciters.json'), encoding='utf-8') as f:
        out['quaRevision'] = json.load(f)['revision']
    for name in BUILT:
        path = os.path.join(MAN, name)
        if os.path.exists(path):
            out['manifests'][name] = masked_sha(path)
    return out


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'check'
    got = current()
    if mode == 'write':
        with open(PIN_FILE, 'w', encoding='utf-8') as f:
            json.dump(got, f, indent=1)
            f.write('\n')
        print('wrote', PIN_FILE)
        return
    with open(PIN_FILE, encoding='utf-8') as f:
        want = json.load(f)
    if got != want:
        for k in sorted(set(got) | set(want)):
            if got.get(k) != want.get(k):
                print(f'{k}: pinned {want.get(k)} now {got.get(k)}')
        raise SystemExit(1)
    print('pins match')


if __name__ == '__main__':
    main()
