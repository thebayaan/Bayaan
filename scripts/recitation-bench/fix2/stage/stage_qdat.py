"""<venv with pyarrow>/bin/python -I fix2/stage/stage_qdat.py  (resumable)
Reads _dl/qdat/train.parquet (sha256 of the LFS object checked by the caller), writes each audio
blob to a new empty dir _dl/qdat/x/, converts to qdat_bench/audio/<id>.f32, deletes the blob,
and writes _dl/qdat/meta.json with id, original_id, gender, age and the tajweed integer columns
(no transcript text)."""
import pyarrow.parquet as pq, os, sys, json, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common_dl import to_f32
from paths import DATA as D
X = f'{D}/_dl/qdat/x'; OUT = f'{D}/qdat_bench/audio'
os.makedirs(X, exist_ok=True); os.makedirs(OUT, exist_ok=True)
t = pq.read_table(f'{D}/_dl/qdat/train.parquet')
print(t.schema.names, t.num_rows)
INTS = ['qalo_alif_len', 'qalo_waw_len', 'laa_alif_len', 'separate_madd', 'noon_moshaddadah_len',
        'noon_mokhfah_len', 'allam_alif_len', 'madd_aared_len', 'qalqalah']
meta, fails = [], []
for r in t.to_pylist():
    a = r['audio']
    sid = re.sub(r'[^A-Za-z0-9_.-]', '_', str(r['id']))
    path = (a.get('path') or '') if isinstance(a, dict) else ''
    ext = os.path.splitext(path)[1].lower() if re.fullmatch(r'\.[A-Za-z0-9]{1,5}', os.path.splitext(path)[1] or '') else '.bin'
    out = f'{OUT}/{sid}.f32'
    if not (os.path.exists(out) and os.path.getsize(out) > 0):
        tmp = f'{X}/{sid}{ext}'
        open(tmp, 'wb').write(a['bytes'])
        res = to_f32(tmp, out); os.remove(tmp)
        if res != 'ok': fails.append((sid, res)); continue
    meta.append({'id': sid, 'original_id': r['original_id'], 'gender': r['gender'], 'age': r['age'],
                 'sourceExt': ext, **{k: r[k] for k in INTS}})
json.dump({'rows': meta, 'failed': fails}, open(f'{D}/_dl/qdat/meta.json', 'w'), indent=0)
os.rmdir(X)
print(len(meta), 'failed', fails)
