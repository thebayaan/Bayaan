"""Fetches QUA's metadata rows for the chosen mushafs (no audio).

    python -I natural/stage_meta.py [--jobs 8]

Writes .out/natural/qua_meta/<slug>.jsonl: one row per ayah with its place in
the parquet files, the recited text, word timestamps and source mapping.
"""
import argparse
import concurrent.futures as cf
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pyarrow.parquet as pq  # noqa: E402
import qua as Q  # noqa: E402
import text as T  # noqa: E402

META = os.path.join(T.OUT, 'qua_meta')


def fetch_meta(slug, api):
    out = os.path.join(META, f'{slug}.jsonl')
    if os.path.exists(out):
        return slug, 'cached'
    rows = []
    fetched = 0
    for shard, size in Q.shards(api, slug):
        hf = Q.HttpFile(Q.BASE + shard, size)
        pf = pq.ParquetFile(hf)
        for g in range(pf.metadata.num_row_groups):
            t = pf.read_row_group(g, columns=Q.META_COLUMNS).to_pylist()
            for i, r in enumerate(t):
                r['shard'] = shard
                r['rowGroup'] = g
                r['row'] = i
                rows.append(r)
        fetched += hf.fetched
    tmp = out + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')
    os.replace(tmp, out)
    return slug, f'{len(rows)} rows, {fetched / 1e6:.0f} MB read'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--jobs', type=int, default=8)
    args = ap.parse_args()
    with open(os.path.join(T.OUT, 'manifests/reciters.json'), encoding='utf-8') as f:
        chosen = json.load(f)['chosen']
    os.makedirs(META, exist_ok=True)
    api = Q.listing(os.path.join(T.OUT, 'lists/qua_files.json'))
    if api.get('sha') != Q.REVISION:
        raise SystemExit(f"listing is at {api.get('sha')}, not the pinned revision")
    with cf.ThreadPoolExecutor(args.jobs) as ex:
        for slug, note in ex.map(lambda r: fetch_meta(r['slug'], api), chosen):
            print(slug, note, flush=True)


if __name__ == '__main__':
    main()
