"""Plant known mistakes in a reciter's surah audio, using Quran.com word timings.

python3 -I mutate.py <audio.f32> <qdc_timings.json> <outdir>

Writes <case>.f32 for each case and cases.json with the ground truth. Word
numbers in the truth are 1-based positions (Quran.com segmentation). The
ayah numbers suit a surah of 22+ ayat (the bench uses Al-Mulk).
"""
import json
import os
import sys
from array import array

SR = 16000
src, timings_path, out = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(out, exist_ok=True)
pcm = array('f')
with open(src, 'rb') as f:
    pcm.frombytes(f.read())
with open(timings_path) as f:
    verse_timings = json.load(f)['audio_files'][0]['verse_timings']
surah = int(verse_timings[0]['verse_key'].split(':')[0])
V = {int(v['verse_key'].split(':')[1]): v for v in verse_timings}


def s(ms):
    return int(ms * SR / 1000)


def ayah_span(a):
    return s(V[a]['timestamp_from']), s(V[a]['timestamp_to'])


def word_span(a, w):
    seg = [x for x in V[a]['segments'] if len(x) >= 3 and x[0] == w][0]
    return s(seg[1]), s(seg[2])


def silence(sec):
    return array('f', [0.0] * int(sec * SR))


cases = []


def emit(name, parts, truth, note):
    buf = array('f')
    for p in parts:
        buf.extend(p)
    with open(os.path.join(out, name + '.f32'), 'wb') as f:
        f.write(buf.tobytes())
    cases.append({'name': name, 'truth': truth, 'note': note})


end = len(pcm)
a0, a1 = ayah_span(5)
emit('skip_ayah_5', [pcm[:a0], pcm[a1:]], [{'kind': 'skippedAyah', 'key': f'{surah}:5'}], 'ayah 5 removed')
w0, w1 = word_span(3, 4)
emit('skip_word_3_4', [pcm[:w0], pcm[w1:]], [{'kind': 'skippedWord', 'key': f'{surah}:3', 'word': 4}], 'interior word dropped')
w0, w1 = word_span(8, 1)
emit('skip_first_word_8', [pcm[:w0], pcm[w1:]], [{'kind': 'skippedWord', 'key': f'{surah}:8', 'word': 1}], 'first word dropped')
last10 = max(x[0] for x in V[10]['segments'] if len(x) >= 3)
w0, w1 = word_span(10, last10)
emit('skip_last_word_10', [pcm[:w0], pcm[w1:]], [{'kind': 'skippedWord', 'key': f'{surah}:10', 'word': last10}], 'last word dropped')
w0, w1 = word_span(12, 3)
r0, r1 = word_span(20, 5)
emit('wrong_word_12_3', [pcm[:w0], pcm[r0:r1], pcm[w1:]], [{'kind': 'differentWord', 'key': f'{surah}:12', 'word': 3}], 'word swapped for another')
w0, w1 = word_span(14, 3)
emit('repeat_word_14_3', [pcm[:w1], pcm[w0:w1], pcm[w1:]], [], 'word repeated: not a mistake')
a0, a1 = ayah_span(16)
mid = word_span(16, 4)[1]
emit('restart_ayah_16', [pcm[:mid], silence(0.6), pcm[a0:]], [], 'ayah restarted: not a mistake')
a0, a1 = ayah_span(18)
w0, w1 = word_span(18, 3)
emit('skip_then_fix_18', [pcm[:w0], pcm[w1:a1], silence(0.6), pcm[a0:]], [], 'word skipped, then the ayah redone correctly')
b0, b1 = ayah_span(21)
c0, c1 = ayah_span(22)
emit('swap_ayat_21_22', [pcm[:b0], pcm[c0:c1], pcm[b0:b1], pcm[c1:]], [{'kind': 'skippedAyah', 'key': f'{surah}:21'}], 'ayah order swapped')
with open(os.path.join(out, 'cases.json'), 'w') as f:
    json.dump(cases, f, indent=1)
print(len(cases), 'cases ->', out)
