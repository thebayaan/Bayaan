"""python3 -I fix2/stage/stage_sobolev.py  (resumable)
Hafs rows of sobolev210/quran-recitation-errors metadata.jsonl: download each wav (4 at a time),
convert to sobolev/audio/<recording>-<chunk>.f32, delete the wav. Writes _dl/sobolev/meta.json
with error words mapped to 1-based word numbers in data/quran.json (skeleton match; text dropped)."""
import json, os, re, sys, collections
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common_dl import fetch, to_f32
import qtext
from paths import DATA as D
BASE = 'https://huggingface.co/datasets/sobolev210/quran-recitation-errors/resolve/main/'
X = f'{D}/_dl/sobolev/x'; OUT = f'{D}/sobolev/audio'
rows = [json.loads(l) for l in open(f'{D}/_dl/sobolev_metadata.jsonl', encoding='utf-8') if l.strip()]
hafs = [r for r in rows if r['riwayah'] == 'Hafs']
W = qtext.words()
meta = []
for r in hafs:
    m = re.fullmatch(r'temp_audio_chunks/chunks_recording_([0-9a-f-]+)/chunk(\d+)\.wav', r['file_name'])
    assert m and m.group(1) == r['recording_id'], 'unexpected file name'
    s, a = int(r['surah']), int(r['ayah'])
    sk = [qtext.skeleton(w) for w in W[f'{s}:{a}']]
    errs = []
    for word, classes in r['errors'].items():
        k = qtext.skeleton(word)
        hits = [i + 1 for i, w in enumerate(sk) if w == k]
        errs.append({'word': hits[0] if len(hits) == 1 else None, 'candidates': hits if len(hits) != 1 else None,
                     'inAyah': bool(hits), 'classes': classes})
    meta.append({'recording': m.group(1), 'chunk': int(m.group(2)), 'surah': s, 'ayah': a,
                 'file': r['file_name'], 'mushaf_publisher': r['mushaf_publisher'], 'reviewer': r['reviewer_id'], 'errors': errs})
os.makedirs(f'{D}/_dl/sobolev', exist_ok=True)
def one(m):
    out = f"{OUT}/{m['recording']}-{m['chunk']}.f32"
    if os.path.exists(out) and os.path.getsize(out) > 0: return 'ok'
    tmp = f"{X}/{m['recording']}-{m['chunk']}.wav"
    r = fetch(BASE + m['file'], tmp)
    if r == 'ok':
        r = to_f32(tmp, out); os.remove(tmp)
    return r
with ThreadPoolExecutor(4) as ex:
    res = list(ex.map(one, meta))
for m, r in zip(meta, res): m['status'] = r
json.dump(meta, open(f'{D}/_dl/sobolev/meta.json', 'w'), indent=0)
print(len(meta), collections.Counter(res))
print('errors', sum(len(m['errors']) for m in meta), 'mapped', sum(e['word'] is not None for m in meta for e in m['errors']),
      'notInAyah', sum(not e['inAyah'] for m in meta for e in m['errors']), 'ambiguous', sum(bool(e['candidates']) for m in meta for e in m['errors']))
