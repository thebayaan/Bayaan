"""Stages the held-out pool: mp3quran surah audio + ayah timings, and zaibihassan (ZH) full-surah
audio + word timings. Resumable: every step skips files already present. Run with python3 -I.

  python3 -I fix2/stage/stage_heldout.py          # downloads into .out/fix2/data/heldout_pool/
Writes raw/ (timing json) and audio/ (.f32). No manifest here: see make_manifests.py.
"""
import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import DATA  # noqa: E402
OUT = os.path.join(DATA, 'heldout_pool')
RAW = os.path.join(OUT, 'raw')
AUD = os.path.join(OUT, 'audio')
SURAHS = [19, 25, 50, 73, 76, 89]
READS = {20: 'khalid-jalil', 265: 'ahmad-deeban', 300: 'saleh-shamrani', 3: 'ibrahim-asiri',
         88: 'neama-hassan', 69: 'abdulmohsen-obaikan', 299: 'hassan-saleh'}
ZH_REV = 'fc2d3dc82fe96af3eecb3897395e395d4a004c57'
ZH = {'ahmad-alnufais-murattal': 'Ahmad Alnufais (Murattal)',
      'khalid-al-jalil-murattal': 'Khalid Al Jalil (Murattal)',
      'ahmed-diban-murattal': 'Ahmed Diban (Murattal)'}
CURL = ['curl', '-sSL', '--fail', '--retry', '4', '--retry-delay', '3']


def fetch(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return True
    part = dest + '.part'
    r = subprocess.run(CURL + ['-C', '-', '-o', part, url])
    if r.returncode != 0:
        print('FAIL', url, file=sys.stderr)
        return False
    os.replace(part, dest)
    return True


def to_f32(src, dest):
    tmp = dest + '.tmp'
    r = subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-y', '-i', src,
                        '-ac', '1', '-ar', '16000', '-f', 'f32le', tmp])
    if r.returncode != 0:
        print('FAIL decode', src, file=sys.stderr)
        return False
    os.replace(tmp, dest)
    os.remove(src)
    return True


def mp3q(read, s):
    t = os.path.join(RAW, f'mp3q_{read}_{s:03d}.json')
    fetch(f'https://www.mp3quran.net/api/v3/ayat_timing?surah={s}&read={read}', t)
    f32 = os.path.join(AUD, f'mp3q_{read}_{s:03d}.f32')
    if not os.path.exists(f32):
        mp3 = f32[:-4] + '.mp3'
        if fetch(f'https://cdn.mp3quran.net/audio/{READS[read]}/r1/{s:03d}.mp3', mp3):
            return to_f32(mp3, f32)
        return False
    return True


def zh_json(slug, s):
    t = os.path.join(RAW, f'zh_{slug}_{s:03d}.json')
    name = ZH[slug].replace(' ', '%20').replace('(', '%28').replace(')', '%29')
    return fetch(f'https://huggingface.co/datasets/zaibihassan/Quranic-Recitation-Data/resolve/{ZH_REV}/'
                 f'{name}/Full%20Surah/{s:03d}/{s:03d}.json', t)


def zh_audio(slug, s):
    f32 = os.path.join(AUD, f'zh_{slug}_{s:03d}.f32')
    if os.path.exists(f32):
        return True
    name = ZH[slug].replace(' ', '%20').replace('(', '%28').replace(')', '%29')
    opus = f32[:-4] + '.opus'
    if fetch(f'https://huggingface.co/datasets/zaibihassan/Quranic-Recitation-Data/resolve/{ZH_REV}/'
             f'{name}/Full%20Surah/{s:03d}/{s:03d}.opus', opus):
        return to_f32(opus, f32)
    return False


def zh_same_recording(slug, read, s, tol=1.0):
    """Same recording when the ZH duration and the mp3quran f32 duration agree within tol seconds."""
    j = json.load(open(os.path.join(RAW, f'zh_{slug}_{s:03d}.json'), encoding='utf-8'))
    zd = j['metadata']['duration_ms'] / 1000
    f32 = os.path.join(AUD, f'mp3q_{read}_{s:03d}.f32')
    md = os.path.getsize(f32) / 64000 if os.path.exists(f32) else None
    return md is not None and abs(zd - md) <= tol, zd, md


def main():
    os.makedirs(RAW, exist_ok=True)
    os.makedirs(AUD, exist_ok=True)
    jobs = [(r, s) for r in READS for s in SURAHS]
    # 2 workers: at most 2 ffmpeg at once, at most 2 parallel downloads per host
    with ThreadPoolExecutor(2) as ex:
        res = list(ex.map(lambda a: mp3q(*a), jobs))
    print('mp3quran ok', sum(res), 'of', len(res))
    for slug in ZH:
        for s in SURAHS:
            zh_json(slug, s)
    for s in SURAHS:
        zh_audio('ahmad-alnufais-murattal', s)
    same = {}
    for slug, read in (('khalid-al-jalil-murattal', 20), ('ahmed-diban-murattal', 265)):
        for s in SURAHS:
            ok, zd, md = zh_same_recording(slug, read, s)
            same[f'{slug}_{s}'] = {'same': ok, 'zhSeconds': zd, 'mp3quranSeconds': md}
            if not ok:
                zh_audio(slug, s)
    json.dump(same, open(os.path.join(RAW, 'zh_vs_mp3quran.json'), 'w'), indent=1)
    print(json.dumps(same, indent=1))


if __name__ == '__main__':
    main()
