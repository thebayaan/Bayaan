#!/usr/bin/env python3
"""Check word timings against the recitation audio itself.

For each recitation (one surah each, Al-Mulk when there is one), decode the mp3,
take a 20 ms loudness envelope and measure:
  - word_voiced: share of word time that is voiced (above the file's speech threshold)
  - pause_voiced: share of the time between ayahs (last word end to next first word
    start) that is voiced; high means the timings cut through speech
  - onset offset: for every ayah, the first word start minus the nearest speech
    onset; the median says whether highlights run early or late, the slope over
    the surah says whether they drift
Writes audio.json and envelopes/<rid>-<surah>.json (used by the playback harness).
"""
import json, os, subprocess, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
import numpy as np

CDN = os.environ.get('CDN', 'https://cdn.thebayaan.com')
OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
HOP = 20  # ms
audit = json.load(open(os.path.join(OUT, 'audit.json')))
META = audit['catalog_meta']
os.makedirs(os.path.join(OUT, 'envelopes'), exist_ok=True)
PREF = [67, 36, 18, 56, 55, 1]


def pick_surah(rid):
    have = {r['surah'] for r in audit['files'] if r['rid'] == rid and r.get('words')}
    for s in PREF:
        if s in have:
            return s
    return min(have) if have else None


def envelope(url):
    p = subprocess.run(['ffmpeg', '-v', 'error', '-rw_timeout', '30000000', '-user_agent', 'bayaan-word-audit', '-i', url, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'],
                       capture_output=True, timeout=600)
    x = np.frombuffer(p.stdout, dtype=np.int16).astype(np.float32) / 32768
    if len(x) < 16000:
        return None
    n = 16000 * HOP // 1000
    frames = x[: len(x) // n * n].reshape(-1, n)
    return 20 * np.log10(np.sqrt((frames ** 2).mean(axis=1)) + 1e-6)


def check(rid):
    s = pick_surah(rid)
    meta = META.get(rid)
    if not s or not meta or not meta.get('server'):
        return None
    try:
        req = urllib.request.Request(f'{CDN}/timestamps-words/{rid}/{s:03d}.json', headers={'User-Agent': 'bayaan-word-audit'})
        with urllib.request.urlopen(req, timeout=60) as r:
            d = json.load(r)
        url = next((f['audio_url'] for f in audit['files'] if f['rid'] == rid and f['surah'] == s), None)
        env = envelope(url)
    except Exception as e:
        return {'rid': rid, 'surah': s, 'error': str(e)[:200]}
    if env is None:
        return {'rid': rid, 'surah': s, 'error': 'no audio'}
    floor, loud = np.percentile(env, 10), np.percentile(env, 90)
    thr = floor + 0.35 * (loud - floor)
    voiced = env > thr
    fr = lambda ms: int(ms // HOP)
    def share(a, b):
        a, b = max(0, fr(a)), min(len(voiced), fr(b))
        return (voiced[a:b].mean(), b - a) if b > a else (None, 0)
    wv = wt = pv = pt = 0
    offsets = []  # (time_ms, offset_ms)
    ayahs = d.get('ayahs', [])
    prev_end = None
    for a in ayahs:
        ws = [w for w in a.get('words', []) if isinstance(w, list) and len(w) >= 2]
        if not ws:
            continue
        for w in ws:
            v, n = share(w[0], w[1])
            if v is not None:
                wv += v * n; wt += n
        if prev_end is not None and ws[0][0] - prev_end > 200:
            v, n = share(prev_end, ws[0][0])
            if v is not None:
                pv += v * n; pt += n
        # nearest onset: 160 ms quiet then 60 ms voiced
        t0 = fr(ws[0][0])
        best = None
        for t in range(max(8, t0 - 75), min(len(voiced) - 3, t0 + 75)):
            if voiced[t] and voiced[t + 1] and voiced[t + 2] and not voiced[t - 8:t].any():
                if best is None or abs(t - t0) < abs(best - t0):
                    best = t
        if best is not None:
            offsets.append((ws[0][0], (t0 - best) * HOP))
        prev_end = ws[-1][1]
    res = {'rid': rid, 'surah': s, 'audio_ms': len(env) * HOP,
           'word_voiced': round(wv / wt, 3) if wt else None,
           'pause_voiced': round(pv / pt, 3) if pt else None,
           'onsets_found': len(offsets), 'ayahs': len(ayahs)}
    if offsets:
        o = np.array(offsets, dtype=float)
        res['onset_median_ms'] = int(np.median(o[:, 1]))
        res['onset_p90_abs_ms'] = int(np.percentile(np.abs(o[:, 1]), 90))
        res['onset_late_share'] = round(float((np.abs(o[:, 1]) > 300).mean()), 3)
        # robust drift: median pairwise slope over ayah starts within 300 ms
        # (a least-squares fit is pulled around by a few missed onsets)
        q = o[np.abs(o[:, 1]) <= 300]
        if len(q) >= 6 and np.ptp(q[:, 0]) > 60000:
            sl = [(q[j, 1] - q[i, 1]) / ((q[j, 0] - q[i, 0]) / 60000) for i in range(len(q)) for j in range(i + 1, len(q)) if q[j, 0] - q[i, 0] > 20000]
            if sl:
                res['drift_ms_per_min'] = round(float(np.median(sl)), 1)
        res['offsets'] = [[int(a), int(b)] for a, b in offsets]
    # keep a 100 ms envelope for the harness strip
    step = 5
    small = env[: len(env) // step * step].reshape(-1, step).max(axis=1)
    json.dump({'hop': HOP * step, 'thr': float(thr), 'floor': float(floor), 'loud': float(loud),
               'db': [round(float(x), 1) for x in small]}, open(os.path.join(OUT, 'envelopes', f'{rid}-{s:03d}.json'), 'w'))
    return res


def main():
    rids = [r['rid'] for r in audit['recitations'] if r.get('in_catalog')]
    lim = int(os.environ.get('AUDIO_LIMIT', '0'))
    if lim:
        rids = rids[:lim]
    print(f'audio check on {len(rids)} recitations', flush=True)
    out = []
    with ThreadPoolExecutor(int(os.environ.get('AUDIO_WORKERS', '12'))) as ex:
        for i, r in enumerate(ex.map(check, rids)):
            if r:
                out.append(r)
            if i % 50 == 0:
                print(f'  {i}/{len(rids)}', flush=True)
    json.dump(out, open(os.path.join(OUT, 'audio.json'), 'w'))
    ok = [r for r in out if 'word_voiced' in r and r['word_voiced'] is not None]
    print(f'done {len(out)}, with metrics {len(ok)}')
    if ok:
        print('median word_voiced', np.median([r['word_voiced'] for r in ok]))
        print('median pause_voiced', np.median([r['pause_voiced'] for r in ok if r['pause_voiced'] is not None]))
        print('median onset', np.median([r.get('onset_median_ms', 0) for r in ok]))


if __name__ == '__main__':
    main()
