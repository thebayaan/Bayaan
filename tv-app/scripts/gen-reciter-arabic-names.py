"""Writes data/reciterArabicNames.json: reciter names in Arabic, keyed by the
English name with only its letters and digits kept, lower case (the phone's
reciterNameKey in i18n/format.ts). Built from the phone's tables, so the TV
can name a live-catalog reciter in Arabic without shipping the reciter list.

Run from tv-app/: python3 scripts/gen-reciter-arabic-names.py
"""
import json
import os
import re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
with open(os.path.join(ROOT, 'data', 'reciterNamesAr.json'), encoding='utf-8') as f:
    by_id = json.load(f)
with open(os.path.join(ROOT, 'data', 'reciters-fallback.json'), encoding='utf-8') as f:
    reciters = json.load(f)

out = {}
for r in reciters:
    arabic = by_id.get(r['id'])
    if arabic:
        out[re.sub(r'[^a-z0-9]', '', r['name'].lower())] = arabic

path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'reciterArabicNames.json')
with open(path, 'w', encoding='utf-8') as f:
    json.dump(dict(sorted(out.items())), f, ensure_ascii=False, indent=0)
    f.write('\n')
print(len(out), 'names')
