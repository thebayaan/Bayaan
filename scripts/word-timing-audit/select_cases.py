#!/usr/bin/env python3
"""Pick the recitations the playback harness walks and bundle what each needs."""
import json, os, re, sqlite3, sys, urllib.request

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
CDN = os.environ.get('CDN', 'https://cdn.thebayaan.com')
audit = json.load(open(os.path.join(OUT, 'audit.json')))
audio = {r['rid']: r for r in json.load(open(os.path.join(OUT, 'audio.json'))) if 'word_voiced' in r}
META = audit['catalog_meta']
recs = {r['rid']: r for r in audit['recitations']}


def tokens(t):
    return [x for x in re.split(r'[\s\xa0]+', t) if x and not re.fullmatch(r'[٠-٩]+', x) and x != '۞']

HAFS = {}
for v in json.load(open(os.path.join(ROOT, 'data/quran.json'))).values():
    HAFS.setdefault(v['surah_number'], {})[v['ayah_number']] = tokens(v['text'])


def text_for(numbering, s):
    if numbering == 'hafs':
        return HAFS.get(s, {}), 'hafs'
    db = os.path.join(ROOT, f'data/mushaf/digitalkhatt/dk_words_{numbering}.db')
    if os.path.exists(db) and os.path.getsize(db):
        out = {}
        for a, t in sqlite3.connect(db).execute('select ayah, text from words where surah=? order by ayah, word', (s,)):
            out.setdefault(a, []).append(t)
        return out, 'dk'
    return HAFS.get(s, {}), 'hafs'


def find(name_part, style_part=None, rewayah_part='hafs'):
    for rid, m in META.items():
        if rid not in audio:
            continue
        if name_part.lower() in (m.get('reciter') or '').lower() and \
           (style_part is None or style_part.lower() in (m.get('style') or '').lower()) and \
           (rewayah_part is None or rewayah_part.lower() in (m.get('rewayah') or '').lower()):
            return rid
    return None


picks = []  # (rid, why)
for name, style in [('Alafasi', None), ('Alsudaes', None), ('Abdulbasit', 'Mujawwad'), ('Minshawi', None), ('Hussary', None), ('Maher', None)]:
    rid = find(name, style) or find(name)
    if rid and rid not in [p[0] for p in picks]:
        picks.append((rid, 'well-known recitation'))
# a non-Hafs recitation
rid = next((r for r in audio if 'Warsh' in (META.get(r, {}).get('rewayah') or '') and r not in [p[0] for p in picks]), None)
if rid:
    picks.append((rid, 'non-Hafs rewayah'))
# the three weakest by the audio check (most first-word onsets off by >300 ms)
ranked = sorted((r for r in audio.values() if r.get('onset_late_share') is not None and r['rid'] not in [p[0] for p in picks]),
                key=lambda r: (-r['onset_late_share'], -abs(r.get('onset_median_ms', 0))))
for r in ranked[:3]:
    picks.append((r['rid'], f"weakest in audio check ({int(r['onset_late_share']*100)}% of ayah starts off by >300 ms)"))

cases = []
ENV_LATER = []
for rid, why in picks:
    a = audio[rid]; s = a['surah']; m = META[rid]
    req = urllib.request.Request(f'{CDN}/timestamps-words/{rid}/{s:03d}.json', headers={'User-Agent': 'bayaan-word-audit'})
    with urllib.request.urlopen(req, timeout=60) as r:
        timing = json.load(r)
    text, font = text_for(timing.get('numbering'), s)
    ef = os.path.join(OUT, 'envelopes', f'{rid}-{s:03d}.json')
    env = json.load(open(ef)) if os.path.exists(ef) else None
    ayahs = [x for x in timing['ayahs'] if x.get('words')]
    # moments: start of ayah 1 words, a mid-surah ayah, a late ayah (drift)
    marks = []
    for frac in (0.0, 0.5, 0.92):
        ay = ayahs[min(len(ayahs) - 1, int(len(ayahs) * frac))]
        marks.append({'ayah': ay['ayah'], 'seek': max(0, ay['words'][0][0] - 600)})
    cases.append({'rid': rid, 'why': why, 'surah': s, 'title': f"{m.get('reciter')}", 'subtitle': f"{m.get('rewayah')} · {m.get('style') or ''} · surah {s}",
                  'audio': next(f['audio_url'] for f in audit['files'] if f['rid'] == rid and f['surah'] == s), 'timing': timing, 'text': {str(k): v for k, v in text.items()},
                  'font': font, 'env': env, 'marks': marks, 'audio_metrics': {k: v for k, v in a.items() if k != 'offsets'}})

# explicit problem moments (problems.json): seek next to a known issue
import subprocess
import numpy as np
def envelope(url):
    p = subprocess.run(['ffmpeg', '-v', 'error', '-user_agent', 'bayaan-word-audit', '-i', url, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True, timeout=900)
    x = np.frombuffer(p.stdout, dtype=np.int16).astype(np.float32) / 32768
    n = 1600
    db = 20 * np.log10(np.sqrt((x[: len(x) // n * n].reshape(-1, n) ** 2).mean(axis=1)) + 1e-6)
    floor, loud = np.percentile(db, 10), np.percentile(db, 90)
    return {'hop': 100, 'thr': float(floor + 0.35 * (loud - floor)), 'floor': float(floor), 'loud': float(loud), 'db': [round(float(v), 1) for v in db]}
for c in cases:
    if c['env'] is None:
        c['env'] = envelope(c['audio'])
pf = os.path.join(HERE, 'problems.json')
if os.path.exists(pf) and os.environ.get('PROBLEMS', '1') == '1':
    for pr in json.load(open(pf)):
        rid, s = pr['rid'], pr['surah']; m = META[rid]
        url = next(f['audio_url'] for f in audit['files'] if f['rid'] == rid and f['surah'] == s)
        req = urllib.request.Request(f'{CDN}/timestamps-words/{rid}/{s:03d}.json', headers={'User-Agent': 'bayaan-word-audit'})
        with urllib.request.urlopen(req, timeout=60) as r:
            timing = json.load(r)
        ay = next(a for a in timing['ayahs'] if a['ayah'] == pr['at']['ayah'])
        k = pr['at']['word']
        w = ay['words'][k - 1] if k > 0 else ay['words'][k]
        text, font = text_for(timing.get('numbering'), s)
        cases.append({'rid': rid, 'why': pr['label'], 'problem': True, 'surah': s, 'title': m.get('reciter'),
                      'subtitle': f"{m.get('rewayah')} · {m.get('style') or ''} · surah {s}", 'audio': url, 'timing': timing,
                      'text': {str(a): v for a, v in text.items()}, 'font': font, 'env': envelope(url),
                      'marks': [{'ayah': pr['at']['ayah'], 'seek': max(0, w[0] + pr['at']['offset'])}], 'audio_metrics': audio.get(rid, {})})
        cases[-1]['audio_metrics'] = {k2: v for k2, v in cases[-1]['audio_metrics'].items() if k2 != 'offsets'}
json.dump(cases, open(os.path.join(OUT, 'cases.json'), 'w'), ensure_ascii=False)
print('\n'.join(f"{c['title']} | {c['subtitle']} | {c['why']}" for c in cases))
