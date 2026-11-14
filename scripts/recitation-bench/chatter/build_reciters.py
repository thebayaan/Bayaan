"""Builds the tracks for someone reciting nearby. Correct recitation only, by
reciters who are never the reader, each through a simulated room.

  rec_one        one other reciter at a time, on other passages
  same/<id>.f32  for each clip in clips.json: the same passage by the other reciter
                 who read it (the pool has two per passage). run.mjs starts it a few
                 seconds ahead of the reader, the hardest case for following.

The readers in clips.json are the dev reciters, so rec_one takes test reciters. Those
recordings are only background here; no result on them is read.

  $PY -I chatter/build_reciters.py
"""
import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import numpy as np  # noqa: E402

from build_tracks import OUT, SR, TRACKS, room, write_track  # noqa: E402

BENCH = os.path.dirname(HERE)
POOL = os.path.join(BENCH, '.out/natural/manifests/pool.json')
SEED = 20261106
VOICES = 6
SECONDS_EACH = 300


def audio_of(clip):
    return np.concatenate([np.fromfile(p['audio'], dtype=np.float32) for p in clip['parts']])


def main():
    rng = np.random.default_rng(SEED)
    with open(POOL, encoding='utf-8') as f:
        pool = json.load(f)
    with open(os.path.join(OUT, 'clips.json'), encoding='utf-8') as f:
        wanted = json.load(f)
    by_id = {c['id']: c for c in pool}
    report = {}

    by_reciter = {}
    for clip in pool:
        if clip['truth']['reciterSplit'] == 'test':
            by_reciter.setdefault(clip['truth']['reciter'], []).append(clip)
    parts, rooms = [], []
    for reciter in sorted(by_reciter)[:VOICES]:
        pieces, total = [], 0
        for clip in by_reciter[reciter]:
            x = audio_of(clip)
            pieces.append(x)
            total += len(x)
            if total >= SECONDS_EACH * SR:
                break
        x, settings = room(np.concatenate(pieces)[: SECONDS_EACH * SR], rng)
        parts.append(x)
        rooms.append(settings)
    write_track('rec_one', np.concatenate(parts), {'voices': len(parts), 'rooms': rooms}, report)

    same = os.path.join(TRACKS, 'same')
    os.makedirs(same, exist_ok=True)
    made = 0
    missing = []
    for clip_id in wanted:
        clip = by_id[clip_id]
        truth = clip['truth']
        partners = [
            c
            for c in pool
            if c['truth']['block'] == truth['block'] and c['truth']['reciter'] != truth['reciter']
        ]
        if not partners:
            missing.append(clip_id)
            continue
        x, _ = room(audio_of(partners[0]), rng)
        name = hashlib.md5(clip_id.encode()).hexdigest()
        (x * (0.9 / max(1e-6, float(np.abs(x).max())))).astype(np.float32).tofile(os.path.join(same, f'{name}.f32'))
        made += 1
    report['rec_same'] = {'clips': made, 'noPartner': len(missing)}
    print(report['rec_same'])
    with open(os.path.join(OUT, 'tracks_reciters.json'), 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=1)


if __name__ == '__main__':
    main()
