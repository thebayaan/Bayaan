"""Plant many known events in one recitation, mistakes and harmless ones.

python3 -I mutate2.py <audio.f32> <qdc_timings.json> <out.f32> <truth.json> <seed> [first-last]

Cuts and splices the reciter's audio at Quran.com word timings, about one
event every few ayat, never in the first two ayat of the range (the tracker
is still settling) or the last. Real mistakes: a skipped word (inside an
ayah, its first, its last), a wrong word (another word of similar length
from elsewhere), a skipped ayah. Harmless events a learner makes that must
not be marked: repeating a word, restarting an ayah, skipping a word and
then redoing the ayah, a long pause mid-ayah, and a word stretched in time
(like a held madd). truth.json lists each event with its ayah, 1-based
word, whether it is a mistake, and where it sits in the output audio.
The optional first-last range cuts the recitation to those ayat.
"""
import json
import os
import random
import subprocess
import sys
import tempfile
from array import array

SR = 16000
src, timings_path, out_path, truth_path, seed = sys.argv[1:6]
first_last = sys.argv[6] if len(sys.argv) > 6 else None
rng = random.Random(int(seed))

pcm = array('f')
with open(src, 'rb') as f:
    pcm.frombytes(f.read())
with open(timings_path) as f:
    verse_timings = json.load(f)['audio_files'][0]['verse_timings']
surah = int(verse_timings[0]['verse_key'].split(':')[0])
V = {}
for v in verse_timings:
    words = [x for x in v['segments'] if len(x) >= 3]
    V[int(v['verse_key'].split(':')[1])] = {
        'from': v['timestamp_from'], 'to': v['timestamp_to'], 'words': words}
ayat = sorted(V)
if first_last:
    a, b = map(int, first_last.split('-'))
    ayat = [x for x in ayat if a <= x <= b]


def s(ms):
    return max(0, min(len(pcm), int(ms * SR / 1000)))


def word_span(a, i):
    """The i-th timed word of ayah a (0-based): Quran.com's timings can
    skip a word number, so words are picked by position in the list."""
    seg = V[a]['words'][i]
    return s(seg[1]), s(seg[2])


def word_no(a, i):
    """The 1-based word position of the i-th timed word."""
    return V[a]['words'][i][0]


def n_words(a):
    return len(V[a]['words'])


def stretch(samples, factor):
    """Time-stretch with ffmpeg (pitch kept): factor > 1 makes it longer."""
    with tempfile.TemporaryDirectory() as tmp:
        i, o = os.path.join(tmp, 'i.f32'), os.path.join(tmp, 'o.f32')
        with open(i, 'wb') as f:
            f.write(samples.tobytes())
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1',
                        '-i', i, '-filter:a', f'atempo={1 / factor:.4f}', '-f', 'f32le', o], check=True)
        out = array('f')
        with open(o, 'rb') as f:
            out.frombytes(f.read())
        return out


def silence(sec):
    return array('f', [0.0] * int(sec * SR))


# Events: name -> (is a mistake, weight, needs at least this many words)
EVENTS = {
    'skip_word': (True, 3, 4),
    'skip_first_word': (True, 1, 3),
    'skip_last_word': (True, 1, 3),
    'wrong_word': (True, 3, 4),
    'skip_ayah': (True, 1, 1),
    'repeat_word': (False, 2, 3),
    'restart_ayah': (False, 1, 5),
    'skip_then_fix': (False, 1, 4),
    'pause': (False, 2, 4),
    'stretch_word': (False, 2, 3),
}

# Pick event ayat: spaced 2-4 apart, not the first two or the last.
chosen = {}
i = 2
while i < len(ayat) - 1:
    a = ayat[i]
    names = [n for n, (_, _, need) in EVENTS.items() if n_words(a) >= need]
    weights = [EVENTS[n][1] for n in names]
    if names:
        chosen[a] = rng.choices(names, weights)[0]
    i += rng.randint(2, 4)

out = array('f')
truth = []


def emit(part):
    out.extend(part)


def now():
    return len(out) / SR


range_start = s(V[ayat[0]]['from'])
range_end = s(V[ayat[-1]]['to'])
emit(pcm[range_start:s(V[ayat[0]]['from'])])
for a in ayat:
    a0, a1 = s(V[a]['from']), s(V[a]['to'])
    # Keep any gap after the previous ayah as recorded.
    if a != ayat[0]:
        prev_end = s(V[ayat[ayat.index(a) - 1]]['to'])
        emit(pcm[prev_end:a0])
    event = chosen.get(a)
    nw = n_words(a)
    if event is None:
        emit(pcm[a0:a1])
        continue
    is_mistake = EVENTS[event][0]
    t0 = now()
    word = None
    if event == 'skip_ayah':
        pass
    elif event in ('skip_word', 'wrong_word'):
        i = rng.randint(1, nw - 2)
        word = word_no(a, i)
        w0, w1 = word_span(a, i)
        emit(pcm[a0:w0])
        if event == 'wrong_word':
            dur = w1 - w0
            donors = [(b, j) for b in V for j, x in enumerate(V[b]['words'])
                      if b != a and 0.7 * dur <= s(x[2]) - s(x[1]) <= 1.3 * dur]
            b, j = rng.choice(donors) if donors else (ayat[0], 0)
            d0, d1 = word_span(b, j)
            emit(pcm[d0:d1])
        emit(pcm[w1:a1])
    elif event == 'skip_first_word':
        word = word_no(a, 0)
        emit(pcm[word_span(a, 0)[1]:a1])
    elif event == 'skip_last_word':
        word = word_no(a, nw - 1)
        emit(pcm[a0:word_span(a, nw - 1)[0]])
    elif event == 'repeat_word':
        i = rng.randint(0, nw - 2)
        word = word_no(a, i)
        w0, w1 = word_span(a, i)
        emit(pcm[a0:w1])
        emit(pcm[w0:w1])
        emit(pcm[w1:a1])
    elif event == 'restart_ayah':
        i = rng.randint(2, nw - 2)
        word = word_no(a, i)
        emit(pcm[a0:word_span(a, i)[1]])
        emit(silence(0.6))
        emit(pcm[a0:a1])
    elif event == 'skip_then_fix':
        i = rng.randint(1, nw - 2)
        word = word_no(a, i)
        w0, w1 = word_span(a, i)
        emit(pcm[a0:w0])
        emit(pcm[w1:a1])
        emit(silence(0.6))
        emit(pcm[a0:a1])
    elif event == 'pause':
        i = rng.randint(1, nw - 3)
        word = word_no(a, i)
        w1 = word_span(a, i)[1]
        emit(pcm[a0:w1])
        emit(silence(rng.uniform(2.0, 4.0)))
        emit(pcm[w1:a1])
    elif event == 'stretch_word':
        i = rng.randint(0, nw - 1)
        word = word_no(a, i)
        w0, w1 = word_span(a, i)
        emit(pcm[a0:w0])
        emit(stretch(pcm[w0:w1], rng.uniform(1.4, 1.8)))
        emit(pcm[w1:a1])
    truth.append({'type': event, 'mistake': is_mistake, 'key': f'{surah}:{a}', 'word': word,
                  'words': nw, 'tStart': round(t0, 2), 'tEnd': round(now(), 2)})

with open(out_path, 'wb') as f:
    f.write(out.tobytes())
with open(truth_path, 'w') as f:
    json.dump({'surah': surah, 'ayat': [ayat[0], ayat[-1]], 'seed': int(seed), 'events': truth}, f, indent=1)
print(f'{len(truth)} events ({sum(e["mistake"] for e in truth)} mistakes) -> {out_path}')
