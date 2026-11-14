"""Background speech for one held-out clip: the speech set's clips (.out/fix2/data/speech)
in an order seeded by the clip's id, joined and cut to the clip's length. noise.sh then
mixes it in at the level asked.

  python3 -I fix2/heldout/mix_speech.py <clip.f32> <speech out.f32> <clip id>

Needs numpy. The same id always gives the same speech.
"""
import hashlib
import json
import os
import sys

import numpy as np

if len(sys.argv) != 4:
    sys.exit('usage: python3 -I fix2/heldout/mix_speech.py <clip.f32> <speech out.f32> <clip id>')
clip, out, cid = sys.argv[1:4]
HERE = os.path.dirname(os.path.abspath(__file__))
MANIFEST = os.path.join(HERE, '..', '..', '.out', 'fix2', 'data', 'speech', 'manifest.json')
need = os.path.getsize(clip) // 4
m = json.load(open(MANIFEST))['clips']
if not m:
    sys.exit(f'no clips in {MANIFEST}')
order = sorted(m, key=lambda c: hashlib.sha256((cid + '|' + c['id']).encode()).hexdigest())
parts = []
have = 0
i = 0
while have < need:
    a = np.fromfile(order[i % len(order)]['audio'], dtype='<f4')
    i += 1
    if i > len(order) and have == 0:
        sys.exit('every speech clip is empty')
    parts.append(a)
    have += len(a)
np.concatenate(parts)[:need].astype('<f4').tofile(out)
