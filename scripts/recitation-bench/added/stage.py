"""Stages added/pairs.py's wanted clips with natural/stage_audio.py's own decoder,
in a work folder of its own, since another run may share the default one.

    python -I added/stage.py .out/added/manifests/wanted.json
"""
import concurrent.futures as cf
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BENCH = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(BENCH, 'natural'))
import qua as Q  # noqa: E402
import stage_audio as SA  # noqa: E402
import text as T  # noqa: E402


def main():
    with open(sys.argv[1], encoding='utf-8') as f:
        wanted = json.load(f)
    api = Q.listing(os.path.join(T.OUT, 'lists/qua_files.json'))
    work = os.path.join(BENCH, '.out/added/tmp_stage')
    os.makedirs(work, exist_ok=True)
    with cf.ThreadPoolExecutor(2) as ex:
        futures = {ex.submit(SA.stage_mushaf, s, keys, api, work): s for s, keys in wanted.items()}
        for fut in cf.as_completed(futures):
            slug, done, total, missing, _ = fut.result()
            print(f'{slug}: {done} new of {total} wanted; missing {missing[:8]}', flush=True)
    shutil.rmtree(work, ignore_errors=True)


if __name__ == '__main__':
    main()
