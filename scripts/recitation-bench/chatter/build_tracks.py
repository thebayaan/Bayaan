"""Builds the chatter tracks from the speech stage_speech.py downloaded.

  one_ar   one Arabic voice talking
  tv_ar    Arabic television or radio: one voice at a time, changing
  one_en   one English voice at a time, men and women
  crowd    eight voices at once, Arabic and English, as in a hall or cafe

Each voice goes through its own room (far_field.py), since a person nearby is not
at the microphone. Clips whose transcript holds Quran text are dropped first
(quran_screen.py). Writes .out/chatter/tracks/<name>.f32, 16 kHz mono, and
tracks.json, which holds counts and room settings, no transcripts or names.

Needs numpy and pyarrow; run with -I.
"""
import json
import os
import subprocess
import sys
import tarfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import numpy as np  # noqa: E402
import pyarrow.parquet as pq  # noqa: E402

from far_field import convolve, synthetic_rir  # noqa: E402
from quran_screen import QuranScreen, mentions_quran  # noqa: E402

OUT = os.path.join(os.path.dirname(HERE), '.out/chatter')
RAW = os.path.join(OUT, 'raw')
TRACKS = os.path.join(OUT, 'tracks')
SR = 16000
SEED = 20261105
MINUTES = 30
CROWD_MINUTES = 10
CROWD_VOICES = 8


def ffmpeg_to_f32(args, data):
    p = subprocess.run(
        ['ffmpeg', '-loglevel', 'error', *args, '-ac', '1', '-ar', str(SR), '-f', 'f32le', 'pipe:1'],
        input=data,
        capture_output=True,
        check=True,
    )
    return np.frombuffer(p.stdout, dtype=np.float32)


def join(clips, rng, gap, seconds):
    """Clips one after another with a pause drawn from gap, up to seconds long."""
    out = []
    total = 0
    used = 0
    for clip in clips:
        out.append(clip)
        pause = np.zeros(int(rng.uniform(*gap) * SR), dtype=np.float32)
        out.append(pause)
        total += len(clip) + len(pause)
        used += 1
        if total >= seconds * SR:
            break
    if total < seconds * SR:
        raise SystemExit(f'only {total / SR:.0f} s of speech for a {seconds} s track')
    return np.concatenate(out)[: int(seconds * SR)], used


def room(x, rng):
    rt60 = float(rng.uniform(0.35, 0.65))
    drr = float(rng.uniform(-8, -3))
    return convolve(x, synthetic_rir(rng, rt60, drr, SR)), {'rt60': round(rt60, 2), 'drrDb': round(drr, 1)}


def write_track(name, x, meta, report):
    x = x * (0.9 / max(1e-6, float(np.abs(x).max())))
    os.makedirs(TRACKS, exist_ok=True)
    x.astype(np.float32).tofile(os.path.join(TRACKS, f'{name}.f32'))
    report[name] = {'seconds': round(len(x) / SR), **meta}
    print(name, report[name], flush=True)


class Screened:
    """Yields clips whose transcript passes the check, counting those that don't."""

    def __init__(self, items, passes):
        self.items = items
        self.passes = passes
        self.kept = 0
        self.dropped = 0

    def __iter__(self):
        for text, load in self.items:
            if not self.passes(text):
                self.dropped += 1
                continue
            self.kept += 1
            yield load()


def mediaspeech():
    """(transcript, loader) for the Arabic media speech, in the file's order."""
    f = pq.ParquetFile(os.path.join(RAW, 'mediaspeech_ar_0.parquet'))
    for batch in f.iter_batches(batch_size=32, columns=['audio', 'sentence']):
        for audio, text in zip(batch['audio'].to_pylist(), batch['sentence'].to_pylist()):
            data = audio['bytes']
            yield text or '', lambda d=data: ffmpeg_to_f32(['-i', 'pipe:0'], d)


def clartts():
    """(transcript, loader) for the one Arabic voice, in the files' order."""
    for name in ('clartts_test.parquet', 'clartts_train0.parquet'):
        f = pq.ParquetFile(os.path.join(RAW, name))
        for batch in f.iter_batches(batch_size=8, columns=['audio', 'text', 'sampling_rate']):
            rows = zip(batch['audio'].to_numpy(zero_copy_only=False), batch['text'].to_pylist(), batch['sampling_rate'].to_pylist())
            for audio, text, rate in rows:
                data = np.asarray(audio, dtype=np.float64).tobytes()
                yield text or '', lambda d=data, r=rate: ffmpeg_to_f32(['-f', 'f64le', '-ar', str(r), '-ac', '1', '-i', 'pipe:0'], d)


def librispeech():
    """{speaker: {'sex': 'M' or 'F', 'clips': [(transcript, flac path)]}}, in reading order."""
    root = os.path.join(RAW, 'librispeech')
    if not os.path.isdir(root):
        with tarfile.open(os.path.join(RAW, 'librispeech_dev_clean.tar.gz')) as t:
            t.extractall(root, filter='data')
    base = os.path.join(root, 'LibriSpeech')
    sex = {}
    with open(os.path.join(base, 'SPEAKERS.TXT'), encoding='utf-8') as f:
        for line in f:
            if line.startswith(';'):
                continue
            fields = [v.strip() for v in line.split('|')]
            if len(fields) >= 3 and fields[2] == 'dev-clean':
                sex[fields[0]] = fields[1]
    speakers = {}
    dev = os.path.join(base, 'dev-clean')
    for speaker in sorted(os.listdir(dev), key=int):
        clips = []
        for chapter in sorted(os.listdir(os.path.join(dev, speaker))):
            folder = os.path.join(dev, speaker, chapter)
            with open(os.path.join(folder, f'{speaker}-{chapter}.trans.txt'), encoding='utf-8') as f:
                for line in f:
                    utterance, _, text = line.strip().partition(' ')
                    clips.append((text, os.path.join(folder, f'{utterance}.flac')))
        speakers[speaker] = {'sex': sex[speaker], 'clips': clips}
    return speakers


def speaker_stream(entry, rng, seconds):
    items = ((t, lambda p=p: ffmpeg_to_f32(['-i', p], None)) for t, p in entry['clips'])
    screened = Screened(items, lambda t: not mentions_quran(t))
    x, _ = join(screened, rng, (0.1, 0.7), seconds)
    return x, screened


def main():
    rng = np.random.default_rng(SEED)
    screen = QuranScreen()
    is_clean = lambda text: not screen.has_quran(text)  # noqa: E731
    report = {}

    source = Screened(clartts(), is_clean)
    x, used = join(source, rng, (0.4, 2.0), MINUTES * 60)
    x, settings = room(x, rng)
    write_track('one_ar', x, {'clips': used, 'droppedForQuran': source.dropped, 'room': settings}, report)

    source = Screened(mediaspeech(), is_clean)
    stream = iter(source)
    x, used = join(stream, rng, (0.3, 1.5), MINUTES * 60)
    x, settings = room(x, rng)
    write_track('tv_ar', x, {'clips': used, 'droppedForQuran': source.dropped, 'room': settings}, report)

    people = librispeech()
    men = [k for k, v in people.items() if v['sex'] == 'M']
    women = [k for k, v in people.items() if v['sex'] == 'F']
    voices = [v for pair in zip(men[:3], women[:3]) for v in pair]
    parts, rooms, dropped = [], [], 0
    for speaker in voices:
        x, screened = speaker_stream(people[speaker], rng, MINUTES * 10)
        x, settings = room(x, rng)
        parts.append(x)
        rooms.append(settings)
        dropped += screened.dropped
    write_track('one_en', np.concatenate(parts), {'voices': len(voices), 'droppedForMention': dropped, 'rooms': rooms}, report)

    # Four Arabic streams from further on in the same file, four English voices
    # not used above.
    seconds = CROWD_MINUTES * 60
    streams, rooms = [], []
    for _ in range(CROWD_VOICES // 2):
        x, _used = join(stream, rng, (0.2, 1.0), seconds)
        streams.append(x)
    for speaker in men[3:5] + women[3:5]:
        # About 8 minutes each exist, so a voice repeats; in eight voices at once
        # that can't be heard.
        x, _screened = speaker_stream(people[speaker], rng, MINUTES * 10)
        streams.append(np.resize(x, int(seconds * SR)))
    mix = np.zeros(int(seconds * SR), dtype=np.float32)
    for x in streams:
        x, settings = room(x, rng)
        rooms.append(settings)
        mix += np.roll(x, int(rng.integers(len(x))))
    write_track('crowd', mix, {'voices': len(streams), 'droppedForQuran': source.dropped, 'rooms': rooms}, report)

    with open(os.path.join(OUT, 'tracks.json'), 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=1)
    print('done')


if __name__ == '__main__':
    main()
