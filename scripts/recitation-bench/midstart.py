"""Cut a clean recitation to start mid-surah, at a chosen ayah and word.

python3 -I midstart.py <audio.f32> <qdc_timings.json> <ayah> <word> <seconds> <out.f32>

Starts at the given 1-based word of the ayah (by Quran.com word timings) and
keeps <seconds> of audio, as when a reader opens the mushaf at a page and
starts reciting there. Every mark on such a take is false: it measures what
locking onto a reader mid-surah costs.
"""
import json
import sys
from array import array

SR = 16000
src, timings_path, ayah, word, seconds, out_path = sys.argv[1:7]
ayah, word, seconds = int(ayah), int(word), float(seconds)
with open(timings_path) as f:
    vt = json.load(f)['audio_files'][0]['verse_timings']
verse = next(v for v in vt if int(v['verse_key'].split(':')[1]) == ayah)
seg = next(s for s in verse['segments'] if len(s) >= 3 and s[0] >= word)
start = int(seg[1] * SR / 1000)
pcm = array('f')
with open(src, 'rb') as f:
    pcm.frombytes(f.read())
part = pcm[start:start + int(seconds * SR)]
with open(out_path, 'wb') as f:
    f.write(part.tobytes())
print(f"{verse['verse_key']} word {seg[0]} at {seg[1] / 1000:.1f}s, {len(part) / SR:.0f}s")
