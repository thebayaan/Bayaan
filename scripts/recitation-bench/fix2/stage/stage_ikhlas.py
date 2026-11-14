"""python3 -I fix2/stage/stage_ikhlas.py  (after fix2/stage/fetch_ikhlas.sh). Resumable.
Extracts only ID<n>V<1-4><T|F>.wav entries (names checked, no paths from the zip are used) one at a time
into a new empty dir, converts to f32, deletes each wav; deletes the zip at the end when all are done.
Also extracts Dataset.xlsx to _dl/ikhlas/ (read as data only)."""
import zipfile, re, os, sys, json
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common_dl import to_f32
from paths import DATA as D
Z = f'{D}/_dl/ikhlas/ikhlas.zip'; X = f'{D}/_dl/ikhlas/x'; OUT = f'{D}/ikhlas/audio'
assert os.path.exists(f'{D}/_dl/ikhlas/.verified')
os.makedirs(X, exist_ok=True); os.makedirs(OUT, exist_ok=True)
pat = re.compile(r'^ID(\d+)V([1-4])([TF])\.wav$', re.I)
z = zipfile.ZipFile(Z)
items = []
for i in z.infolist():
    b = i.filename.split('/')[-1]
    m = pat.match(b)
    if m: items.append((i, f'ID{int(m.group(1))}V{m.group(2)}{m.group(3).upper()}'))
    elif b == 'Dataset.xlsx':
        with z.open(i) as s, open(f'{D}/_dl/ikhlas/Dataset.xlsx', 'wb') as o: o.write(s.read())
import threading
lock = threading.Lock()
def safe(t):
    with lock:  # zipfile reads are not thread-safe on one handle; extraction serialised
        info, name = t
        out = f'{OUT}/{name}.f32'
        if os.path.exists(out) and os.path.getsize(out) > 0: return name, 'ok', None
        tmp = f'{X}/{name}.wav'
        with z.open(info) as s, open(tmp, 'wb') as o: o.write(s.read())
    r = to_f32(tmp, out); os.remove(tmp); return name, r, None
with ThreadPoolExecutor(2) as ex:
    res = list(ex.map(safe, items))
bad = [(n, r) for n, r, _ in res if r != 'ok']
json.dump({'entries': len(items), 'failed': bad}, open(f'{D}/ikhlas/convert_status.json', 'w'), indent=1)
print(len(items), 'failed', bad)
if not bad:
    z.close(); os.remove(Z); os.rmdir(X); print('zip deleted')
