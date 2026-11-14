"""Background speech for the "speech at 10 dB" condition, staged into .out/fix2/data/speech/.

Mirrors scripts/recitation-bench/chatter/stage_speech.py (same pinned CC BY 4.0 sources, same hash
checks) but writes to .out/fix2/data/speech/raw/, then cuts 16 kHz mono f32 clips of 10-60 s into
.out/fix2/data/speech/audio/ and writes .out/fix2/data/speech/clips.json (manifest input). Transcripts are screened with
chatter/quran_screen.py (any four-word run of mushaf text drops the source utterance; English uses
mentions_quran). Resumable. Needs pyarrow: run with a venv python, e.g.
  python3 -m venv .out/fix2/data/.venv && .out/fix2/data/.venv/bin/pip install pyarrow numpy
  .out/fix2/data/.venv/bin/python -I fix2/stage/stage_speech.py      (from scripts/recitation-bench)
"""
import hashlib
import io
import json
import os
import random
import subprocess
import sys
import tarfile
import urllib.request

import numpy as np  # noqa: F401  (pyarrow brings numpy)
import pyarrow.parquet as pq

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import BENCH, DATA  # noqa: E402
OUT = os.path.join(DATA, 'speech')
RAW = os.path.join(OUT, 'raw')
AUD = os.path.join(OUT, 'audio')
sys.path.insert(0, os.path.join(BENCH, 'chatter'))
import quran_screen  # noqa: E402  (tracked repo code, read only)

HF = [
    ('mediaspeech_ar_0.parquet', 'ymoslem/MediaSpeech', '4008a968760f2187b0c5b2b2db965f1283433059',
     'ar/train-00000-of-00002.parquet'),
    ('clartts_test.parquet', 'MBZUAI/ClArTTS', '2f6e820abba8b5168b346c43479a324d8d37e35a',
     'data/test-00000-of-00001.parquet'),
    ('clartts_train0.parquet', 'MBZUAI/ClArTTS', '2f6e820abba8b5168b346c43479a324d8d37e35a',
     'data/train-00000-of-00026.parquet'),
]
LIBRI = ('librispeech_dev_clean.tar.gz', 'https://www.openslr.org/resources/12/dev-clean.tar.gz')
SR = 16000
TARGET = {'mediaspeech': 32 * 60, 'clartts': 10 * 60, 'librispeech': 22 * 60}  # seconds


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def fetch(url, dest):
    subprocess.run(['curl', '-sSL', '--fail', '--retry', '4', '--retry-delay', '3', '-C', '-', '-o', dest, url],
                   check=True)


def lfs_hash(repo, rev, path):
    url = f'https://huggingface.co/api/datasets/{repo}/tree/{rev}/{os.path.dirname(path)}'
    with urllib.request.urlopen(url) as r:
        for e in json.load(r):
            if e['path'] == path:
                return e['lfs']['oid']
    raise SystemExit(f'{path} not listed in {repo}')


def download():
    os.makedirs(RAW, exist_ok=True)
    rec_path = os.path.join(RAW, 'sources.json')
    record = json.load(open(rec_path)) if os.path.exists(rec_path) else {}
    for name, repo, rev, path in HF:
        dest = os.path.join(RAW, name)
        if name in record and os.path.exists(dest):
            continue
        want = lfs_hash(repo, rev, path)
        if not (os.path.exists(dest) and sha256(dest) == want):
            fetch(f'https://huggingface.co/datasets/{repo}/resolve/{rev}/{path}', dest)
        got = sha256(dest)
        if got != want:
            raise SystemExit(f'{name}: hash {got} != {want}')
        record[name] = {'repo': repo, 'revision': rev, 'path': path, 'sha256': got, 'license': 'CC BY 4.0'}
        json.dump(record, open(rec_path, 'w'), indent=1)
        print('ok', name, flush=True)
    name, url = LIBRI
    dest = os.path.join(RAW, name)
    if name not in record or not os.path.exists(dest):
        fetch(url, dest)
        record[name] = {'url': url, 'sha256': sha256(dest), 'license': 'CC BY 4.0'}
        json.dump(record, open(rec_path, 'w'), indent=1)
    print('ok', name, flush=True)
    return record


def decode(blob):
    """Any encoded audio bytes -> 16 kHz mono float32 (ffmpeg via pipes)."""
    r = subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-i', 'pipe:0', '-ac', '1', '-ar', str(SR),
                        '-f', 'f32le', 'pipe:1'], input=blob, capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype='<f4')


def write_clip(cid, x):
    p = os.path.join(AUD, cid + '.f32')
    if not os.path.exists(p):
        x.astype('<f4').tofile(p + '.tmp')
        os.replace(p + '.tmp', p)
    return p


def pack(utts, prefix, lo=12.0, hi=45.0, gap=0.3):
    """Join consecutive utterances (each (key, audio)) into clips of lo..hi seconds."""
    clips, cur, keys = [], [], []
    sil = np.zeros(int(gap * SR), dtype='<f4')
    for key, x in utts:
        if len(x) / SR > hi:
            x = x[: int(hi * SR)]
        if cur and (sum(len(c) for c in cur) + len(x)) / SR > hi:
            if sum(len(c) for c in cur) / SR >= lo:
                clips.append((keys, np.concatenate(cur)))
            cur, keys = [], []
        if cur:
            cur.append(sil)
        cur.append(x)
        keys.append(key)
        if sum(len(c) for c in cur) / SR >= lo * 2:
            clips.append((keys, np.concatenate(cur)))
            cur, keys = [], []
    if cur and sum(len(c) for c in cur) / SR >= lo:
        clips.append((keys, np.concatenate(cur)))
    return clips


def main():
    cj = os.path.join(OUT, 'clips.json')
    if os.path.exists(cj) and all(os.path.exists(c['audio']) for c in json.load(open(cj))):
        print('already staged'); return
    download()
    os.makedirs(AUD, exist_ok=True)
    screen = quran_screen.QuranScreen() if hasattr(quran_screen, 'QuranScreen') else None
    rng = random.Random(7)
    out = []

    # MediaSpeech Arabic: broadcast segments; no speaker ids. Take rows spread over the whole file
    # (every k-th row) so clips come from many programmes; pack 2-4 consecutive picked rows per clip.
    f = pq.ParquetFile(os.path.join(RAW, 'mediaspeech_ar_0.parquet'))
    n = f.metadata.num_rows
    step = max(1, n // 400)
    utts, dropped, idx = [], 0, 0
    for batch in f.iter_batches(batch_size=64, columns=['audio', 'sentence']):
        for a, s in zip(batch.column('audio').to_pylist(), batch.column('sentence').to_pylist()):
            if idx % step == 0:
                if screen.has_quran(s or ''):
                    dropped += 1
                else:
                    utts.append((idx, decode(a['bytes'])))
            idx += 1
    total = 0
    for k, (keys, x) in enumerate(pack(utts, 'ms')):
        if total >= TARGET['mediaspeech']:
            break
        cid = f'mediaspeech_ar_{k:03d}'
        out.append({'id': cid, 'audio': write_clip(cid, x), 'language': 'ar', 'source': 'MediaSpeech',
                    'rows': keys, 'speaker': None})
        total += len(x) / SR
    print('mediaspeech rows', n, 'picked', len(utts), 'dropped(quran)', dropped, 'sec', round(total), flush=True)

    # ClArTTS: one male speaker reading classical Arabic (the hard babble case).
    utts, dropped = [], 0
    for name in ('clartts_test.parquet', 'clartts_train0.parquet'):
        f = pq.ParquetFile(os.path.join(RAW, name))
        for i, batch in enumerate(f.iter_batches(batch_size=16, columns=['audio', 'text', 'sampling_rate'])):
            for j, (a, t, sr) in enumerate(zip(batch.column('audio').to_pylist(), batch.column('text').to_pylist(),
                                               batch.column('sampling_rate').to_pylist())):
                if screen.has_quran(t or ''):
                    dropped += 1
                    continue
                if isinstance(a, dict) and a.get('bytes'):
                    x = decode(a['bytes'])
                else:  # raw float array at sr
                    raw = np.asarray(a.get('array') if isinstance(a, dict) else a, dtype='<f4')
                    x = decode(raw.tobytes()) if False else _resample(raw, sr)
                utts.append((f'{name}:{i}:{j}', x))
            if sum(len(u[1]) for u in utts) / SR > TARGET['clartts'] * 1.3:
                break
        if sum(len(u[1]) for u in utts) / SR > TARGET['clartts'] * 1.3:
            break
    total = 0
    for k, (keys, x) in enumerate(pack(utts, 'cl')):
        if total >= TARGET['clartts']:
            break
        cid = f'clartts_ar_{k:03d}'
        out.append({'id': cid, 'audio': write_clip(cid, x), 'language': 'ar', 'source': 'ClArTTS',
                    'rows': keys, 'speaker': 'clartts_1'})
        total += len(x) / SR
    print('clartts dropped(quran)', dropped, 'sec', round(total), flush=True)

    # LibriSpeech dev-clean: 40 speakers; one clip run per speaker, about 33 s each.
    root = os.path.join(RAW, 'librispeech')
    if not os.path.isdir(os.path.join(root, 'LibriSpeech')):
        os.makedirs(root, exist_ok=True)
        with tarfile.open(os.path.join(RAW, LIBRI[0])) as t:
            t.extractall(root, filter='data')
    base = os.path.join(root, 'LibriSpeech')
    sex = {}
    for line in open(os.path.join(base, 'SPEAKERS.TXT'), encoding='utf-8'):
        if not line.startswith(';'):
            p = [c.strip() for c in line.split('|')]
            if len(p) >= 3:
                sex[p[0]] = p[1]
    dev = os.path.join(base, 'dev-clean')
    total = 0
    for spk in sorted(os.listdir(dev), key=int):
        if total >= TARGET['librispeech']:
            break
        utts = []
        for ch in sorted(os.listdir(os.path.join(dev, spk))):
            folder = os.path.join(dev, spk, ch)
            for line in open(os.path.join(folder, f'{spk}-{ch}.trans.txt'), encoding='utf-8'):
                uid, text = line.split(' ', 1)
                if quran_screen.mentions_quran(text):
                    continue
                utts.append((uid, decode(open(os.path.join(folder, uid + '.flac'), 'rb').read())))
                if sum(len(u[1]) for u in utts) / SR > 62:
                    break
            if sum(len(u[1]) for u in utts) / SR > 62:
                break
        clips = pack(utts, 'ls', lo=12.0, hi=40.0)
        for k, (keys, x) in enumerate(clips[:2]):
            cid = f'librispeech_en_{spk}_{k}'
            out.append({'id': cid, 'audio': write_clip(cid, x), 'language': 'en', 'source': 'LibriSpeech dev-clean',
                        'rows': keys, 'speaker': f'librispeech_{spk}', 'sex': sex.get(spk)})
            total += len(x) / SR
    print('librispeech sec', round(total), flush=True)
    json.dump(out, open(os.path.join(OUT, 'clips.json'), 'w'), indent=1)
    # downloads are deleted after cutting (rerun re-downloads); sources.json keeps the hashes
    import shutil
    shutil.copy(os.path.join(RAW, 'sources.json'), os.path.join(OUT, 'sources.json'))
    shutil.rmtree(RAW)


def _resample(raw, sr):
    r = subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-f', 'f32le', '-ar', str(sr), '-ac', '1',
                        '-i', 'pipe:0', '-ac', '1', '-ar', str(SR), '-f', 'f32le', 'pipe:1'],
                       input=raw.astype('<f4').tobytes(), capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype='<f4')


if __name__ == '__main__':
    main()
