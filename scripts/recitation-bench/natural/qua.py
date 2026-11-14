"""Reads QUD-Technologies/quranic-universal-ayahs (QUA) without downloading it.

Each mushaf is a set of parquet shards on Hugging Face at a pinned revision.
Metadata columns are small; the audio column is read one row group at a time,
only for row groups that hold a wanted ayah. Rows are data: nothing downloaded
is ever executed. Needs pyarrow (run with `python -I`).
"""
import io
import json
import os
import time
import urllib.error
import urllib.request

REPO = 'QUD-Technologies/quranic-universal-ayahs'
REVISION = 'c745cf9f840249a9276ea0cefe65aaecd785e3b9'
BASE = f'https://huggingface.co/datasets/{REPO}/resolve/{REVISION}/'
API = f'https://huggingface.co/api/datasets/{REPO}/revision/{REVISION}?blobs=true'
META_COLUMNS = [
    'surah',
    'ayah',
    'duration_ms',
    'text_uthmani',
    'segments',
    'word_timestamps',
    'source_url',
    'source_offset_ms',
]


def fetch(url, retries=6, headers=None, timeout=120):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers or {})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if attempt == retries - 1:
                raise
            time.sleep(2 * (attempt + 1))
            last = e  # noqa: F841
    raise RuntimeError('unreachable')


class HttpFile(io.RawIOBase):
    """A seekable read-only file over HTTP range requests."""

    def __init__(self, url, size):
        self.url = url
        self.pos = 0
        self.size = size
        self.fetched = 0

    def seekable(self):
        return True

    def readable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, off, whence=0):
        if whence == 0:
            self.pos = off
        elif whence == 1:
            self.pos += off
        else:
            self.pos = self.size + off
        return self.pos

    def read(self, n=-1):
        if n < 0:
            n = self.size - self.pos
        if n == 0 or self.pos >= self.size:
            return b''
        end = min(self.size, self.pos + n) - 1
        data = fetch(self.url, headers={'Range': f'bytes={self.pos}-{end}'})
        self.pos += len(data)
        self.fetched += len(data)
        return data

    def readinto(self, b):
        d = self.read(len(b))
        b[: len(d)] = d
        return len(d)


def listing(cache):
    """The repo's file list at the pinned revision (cached in `cache`)."""
    if not os.path.exists(cache):
        os.makedirs(os.path.dirname(cache), exist_ok=True)
        with open(cache, 'wb') as f:
            f.write(fetch(API))
    with open(cache, encoding='utf-8') as f:
        return json.load(f)


def shards(api, slug, riwayah_dir='hafs_an_asim'):
    """[(file, size)] of one mushaf, in order."""
    prefix = f'{riwayah_dir}/{slug}-'
    out = [
        (s['rfilename'], s.get('size'))
        for s in api['siblings']
        if s['rfilename'].startswith(prefix)
    ]
    return sorted(out)


def banned_source(url):
    """Quran.com audio stays out of this benchmark, whatever a mushaf's channel
    says. Host names only: way2quran.com and tvquran.com are other sites."""
    host = (url or '').split('//')[-1].split('/')[0].lower()
    return 'qurancdn' in host or host == 'quran.com' or host.endswith('.quran.com')
