"""Stages whole-ayah audio from QUA: 16 kHz mono float32, one file per ayah.

    python -I natural/stage_audio.py <wanted.json> [--jobs 8]

<wanted.json> is {slug: ["s:a", ...]}. Reads only the row groups that hold a
wanted ayah, decodes each MP3 with ffmpeg (format conversion only: nothing is
cut, joined, stretched or mixed) and deletes the MP3. Writes
.out/natural/audio/<slug>/<s>_<a>.f32. Rows from a banned host are refused.
"""
import argparse
import collections
import concurrent.futures as cf
import json
import os
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pyarrow.parquet as pq  # noqa: E402
import qua as Q  # noqa: E402
import text as T  # noqa: E402

AUDIO = os.path.join(T.OUT, 'audio')
META = os.path.join(T.OUT, 'qua_meta')


def audio_path(slug, key):
    s, a = key.split(':')
    return os.path.join(AUDIO, slug, f'{s}_{a}.f32')


def to_f32(mp3_path, out):
    tmp = out + '.tmp'
    subprocess.run(
        [
            'ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
            '-i', mp3_path, '-ac', '1', '-ar', '16000', '-f', 'f32le', tmp,
        ],
        check=True,
    )
    os.replace(tmp, out)


def stage_mushaf(slug, keys, api, workdir):
    meta = {}
    with open(os.path.join(META, f'{slug}.jsonl'), encoding='utf-8') as f:
        for line in f:
            r = json.loads(line)
            meta[f"{r['surah']}:{r['ayah']}"] = r
    os.makedirs(os.path.join(AUDIO, slug), exist_ok=True)
    todo = [k for k in keys if k in meta and not os.path.exists(audio_path(slug, k))]
    missing = [k for k in keys if k not in meta]
    sizes = dict(Q.shards(api, slug))
    groups = collections.defaultdict(dict)
    for k in todo:
        r = meta[k]
        if Q.banned_source(r['source_url']):
            raise SystemExit(f'{slug} {k}: banned source {r["source_url"]}')
        groups[(r['shard'], r['rowGroup'])][r['row']] = k
    fetched = 0
    done = 0
    open_files = {}
    tmp = tempfile.mkdtemp(prefix=f'{slug}-', dir=workdir)
    try:
        for (shard, group), rows in sorted(groups.items()):
            pf = open_files.get(shard)
            if pf is None:
                hf = Q.HttpFile(Q.BASE + shard, sizes[shard])
                pf = pq.ParquetFile(hf)
                open_files[shard] = pf
            t = pf.read_row_group(group, columns=['audio', 'surah', 'ayah'])
            fetched_rows = t.to_pylist()
            for row, key in sorted(rows.items()):
                r = fetched_rows[row]
                if f"{r['surah']}:{r['ayah']}" != key:
                    raise SystemExit(f'{slug}: row {row} is not {key}')
                mp3 = os.path.join(tmp, 'clip.mp3')
                with open(mp3, 'wb') as f:
                    f.write(r['audio']['bytes'])
                to_f32(mp3, audio_path(slug, key))
                os.remove(mp3)
                done += 1
            del t, fetched_rows
        for pf in open_files.values():
            pass
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return slug, done, len(keys), missing, fetched


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('wanted')
    ap.add_argument('--jobs', type=int, default=8)
    args = ap.parse_args()
    with open(args.wanted, encoding='utf-8') as f:
        wanted = json.load(f)
    api = Q.listing(os.path.join(T.OUT, 'lists/qua_files.json'))
    work = os.path.join(T.OUT, 'tmp_stage')
    os.makedirs(work, exist_ok=True)
    with cf.ThreadPoolExecutor(args.jobs) as ex:
        futures = {
            ex.submit(stage_mushaf, slug, keys, api, work): slug
            for slug, keys in wanted.items()
        }
        for fut in cf.as_completed(futures):
            slug, done, total, missing, _ = fut.result()
            print(f'{slug}: {done} new of {total} wanted; missing {missing[:8]}', flush=True)
    shutil.rmtree(work, ignore_errors=True)


if __name__ == '__main__':
    main()
