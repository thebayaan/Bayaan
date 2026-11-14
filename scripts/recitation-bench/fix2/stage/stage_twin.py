"""python3 -I fix2/stage/stage_twin.py   (resumable; rerun to fill gaps)
Stages one recording per voice of every ayah in twin_ayat/ayat.json as 16 kHz mono f32.
Writes twin_ayat/status.json {voice: {key: 'ok'|'missing'|'error..'}}."""
import json, os, sys
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common_dl import fetch, to_f32
from paths import DATA as D
T = f'{D}/twin_ayat'; DL = f'{D}/_dl/twin'
EA = {'dev': ['Alafasy_64kbps', 'Husary_64kbps', 'Abdurrahmaan_As-Sudais_64kbps', 'Saood_ash-Shuraym_64kbps',
              'Minshawy_Murattal_128kbps', 'Abu_Bakr_Ash-Shaatree_64kbps'],
      'checker_heldout': ['Sahl_Yassin_128kbps', 'Akram_AlAlaqimy_128kbps', 'Hani_Rifai_192kbps', 'Ibrahim_Akhdar_32kbps']}
ZH = ['khalid-al-jalil-murattal', 'ahmed-diban-murattal', 'ahmad-alnufais-murattal', 'qari-khushi-muhammad-al-azhari-murattal']
ayat = json.load(open(f'{T}/ayat.json'))
jobs = []
for g, fs in EA.items():
    for f in fs:
        for k in ayat:
            s, a = map(int, k.split(':'))
            jobs.append(('ea', f, k, f'https://everyayah.com/data/{f}/{s:03d}{a:03d}.mp3', 'mp3'))
for z in ZH:
    for k in ayat:
        s, a = map(int, k.split(':'))
        jobs.append(('zh', z, k, f'https://cdn.mualim.app/{z}/{s:03d}/{s:03d}{a:03d}.opus', 'opus'))
stf = f'{T}/status.json'
status = json.load(open(stf)) if os.path.exists(stf) else {}
def one(j):
    host, voice, k, url, ext = j
    s, a = map(int, k.split(':'))
    out = f'{T}/audio/{voice}/{s:03d}{a:03d}.f32'
    if os.path.exists(out) and os.path.getsize(out) > 0:
        return voice, k, 'ok'
    if status.get(voice, {}).get(k) == 'missing':
        return voice, k, 'missing'
    src = f'{DL}/{voice}/{s:03d}{a:03d}.{ext}'
    r = fetch(url, src)
    if r == 'ok':
        r = to_f32(src, out)
        if os.path.exists(src): os.remove(src)
    return voice, k, r
def timings():
    # ZH CDN per-surah word json (verse-relative clock), one per surah per ZH voice
    surahs = sorted({int(k.split(':')[0]) for k in ayat})
    js = [(z, s) for z in ZH for s in surahs]
    def g(zs):
        z, s = zs
        out = f'{T}/timings/{z}/{s:03d}.json'
        if os.path.exists(out) and os.path.getsize(out) > 0: return z, s, 'ok'
        return z, s, fetch(f'https://cdn.mualim.app/{z}/{s:03d}.json', out)
    with ThreadPoolExecutor(4) as ex:
        return [r for r in ex.map(g, js)]
if __name__ == '__main__':
    tr = timings()
    print('timings', sum(r[2] == 'ok' for r in tr), '/', len(tr), [r for r in tr if r[2] != 'ok'], flush=True)
    ea = [j for j in jobs if j[0] == 'ea']; zh = [j for j in jobs if j[0] == 'zh']
    n = 0
    with ThreadPoolExecutor(4) as e1, ThreadPoolExecutor(4) as e2:
        futs = [e1.submit(one, j) for j in ea] + [e2.submit(one, j) for j in zh]
        for f in futs:
            voice, k, r = f.result()
            status.setdefault(voice, {})[k] = r
            n += 1
            if n % 200 == 0:
                json.dump(status, open(stf, 'w'), indent=0); print(n, '/', len(jobs), flush=True)
    json.dump(status, open(stf, 'w'), indent=0)
    import collections
    print({v: dict(collections.Counter(x.values())) for v, x in status.items()})
