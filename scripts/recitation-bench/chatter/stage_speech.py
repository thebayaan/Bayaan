"""Downloads the everyday speech the chatter tracks are made from.

All CC BY 4.0, none of it recitation. Files land in .out/chatter/raw/ and are data
only: parquet is read with pyarrow, audio decoded by ffmpeg, no code from these
repositories is run. Hugging Face files are checked against the hash its listing
gives for the pinned revision; the LibriSpeech archive has its hash recorded.
"""
import hashlib
import json
import os
import subprocess
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), '.out/chatter')
RAW = os.path.join(OUT, 'raw')

HF = [
    (
        'mediaspeech_ar_0.parquet',
        'ymoslem/MediaSpeech',
        '4008a968760f2187b0c5b2b2db965f1283433059',
        'ar/train-00000-of-00002.parquet',
    ),
    (
        'clartts_test.parquet',
        'MBZUAI/ClArTTS',
        '2f6e820abba8b5168b346c43479a324d8d37e35a',
        'data/test-00000-of-00001.parquet',
    ),
    (
        'clartts_train0.parquet',
        'MBZUAI/ClArTTS',
        '2f6e820abba8b5168b346c43479a324d8d37e35a',
        'data/train-00000-of-00026.parquet',
    ),
]
LIBRISPEECH = ('librispeech_dev_clean.tar.gz', 'https://www.openslr.org/resources/12/dev-clean.tar.gz')


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def fetch(url, dest):
    subprocess.run(['curl', '-sSL', '--fail', '-C', '-', '-o', dest, url], check=True)


def lfs_hash(repo, revision, path):
    folder = os.path.dirname(path)
    url = f'https://huggingface.co/api/datasets/{repo}/tree/{revision}/{folder}'
    with urllib.request.urlopen(url) as r:
        listing = json.load(r)
    for entry in listing:
        if entry['path'] == path:
            return entry['lfs']['oid']
    raise SystemExit(f'{path} is not in the listing of {repo}')


def main():
    os.makedirs(RAW, exist_ok=True)
    record = {}
    for name, repo, revision, path in HF:
        dest = os.path.join(RAW, name)
        want = lfs_hash(repo, revision, path)
        if not (os.path.exists(dest) and sha256(dest) == want):
            fetch(f'https://huggingface.co/datasets/{repo}/resolve/{revision}/{path}', dest)
        got = sha256(dest)
        if got != want:
            raise SystemExit(f'{name}: hash {got} is not {want}')
        record[name] = {'repo': repo, 'revision': revision, 'path': path, 'sha256': got, 'license': 'CC BY 4.0'}
        print('ok', name)
    name, url = LIBRISPEECH
    dest = os.path.join(RAW, name)
    if not os.path.exists(dest):
        fetch(url, dest)
    record[name] = {'url': url, 'sha256': sha256(dest), 'license': 'CC BY 4.0'}
    print('ok', name)
    with open(os.path.join(OUT, 'sources.json'), 'w', encoding='utf-8') as f:
        json.dump(record, f, indent=1)


if __name__ == '__main__':
    main()
