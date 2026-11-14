"""Places the checker model misreads on correct recitations.

  python3 -I fix2/blind_spots.py <clean tag> [<tag> ...] [--write <blindSpots.json>]

Every file under .out/fix2/sim/<tag>/ is a correct recitation by a professional
reciter, so a bad verdict there is the model's doing (or the check's), not the
reader's. A place called bad for two or more different reciters is a blind spot: the
text sets it off, not the voice. Places called bad for one reciter only are printed
for review and never written.

Run the tags WITHOUT --blind, so the places already listed show again. --write adds
the new places to the "words" of the app's list
(services/recitation/liveCheck/blindSpots.json) and keeps what is there. Places are
surah:ayah:word, the word counted from 0. The file holds places only.
"""
import collections
import glob
import json
import os
import sys

args = sys.argv[1:]
out = None
if '--write' in args:
    i = args.index('--write')
    if i + 1 >= len(args):
        sys.exit('usage: python3 -I fix2/blind_spots.py <tag> [<tag> ...] [--write <json>]')
    out = args[i + 1]
    del args[i:i + 2]
if not args:
    sys.exit('usage: python3 -I fix2/blind_spots.py <tag> [<tag> ...] [--write <json>]')
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '.out', 'fix2')


def place(key):
    return tuple(int(x) for x in key.split(':'))


by = collections.defaultdict(dict)
files = 0
for tag in args:
    for f in sorted(glob.glob(os.path.join(OUT, 'sim', tag, '*.json'))):
        name = os.path.basename(f)[:-5]
        reciter = name.split('_')[0]
        try:
            d = json.load(open(f, encoding='utf-8'))
        except ValueError:
            continue
        if 'bad' not in d:
            continue
        files += 1
        for b in d['bad']:
            by[b['key']][reciter] = (b['verdict'], b['share'], b['gap'])
blind = sorted((k for k, v in by.items() if len(v) >= 2), key=place)
print(f'{files} recitations, {len(by)} places called bad, {len(blind)} for two or more reciters')
for k in blind:
    print('  blind', k, by[k])
for k in sorted(by, key=place):
    if len(by[k]) < 2:
        print('  once ', k, by[k])
if out:
    data = json.load(open(out, encoding='utf-8')) if os.path.exists(out) else {}
    data['words'] = sorted(set(data.get('words', [])) | set(blind), key=place)
    with open(out, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
        fh.write('\n')
    print(f'wrote {len(data["words"])} places to {out}')
