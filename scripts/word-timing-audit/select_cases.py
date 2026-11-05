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
for name, style in [('Alafasy', None), ('Sudais', None), ('Abdulbasit', 'Mujawwad'), ('Minshawi', None), ('Husary', None), ('Hussary', None), ('Maher', None)]:
    rid = find(name, style) or find(name)
    if rid and rid not in [p[0] for p in picks]:
        picks.append((rid, 'well-known recitation'))
# a non-Hafs recitation
rid = next((r for r in audio if recs.get(r, {}).get('numbering') and recs[r]['numbering'] != ['hafs']), None)
if rid:
    picks.append((rid, 'non-Hafs numbering'))
# the three weakest by the audio check (most first-word onsets off by >300 ms)
ranked = sorted((r for r in audio.values() if r.get('onset_late_share') is not None and r['rid'] not in [p[0] for p in picks]),
                key=lambda r: (-r['onset_late_share'], -abs(r.get('onset_median_ms', 0))))
for r in ranked[:3]:
    picks.append((r['rid'], f"weakest in audio check ({int(r['onset_late_share']*100)}% of ayah starts off by >300 ms)"))

cases = []
for rid, why in picks:
    a = audio[rid]; s = a['surah']; m = META[rid]
    req = urllib.request.Request(f'{CDN}/timestamps-words/{rid}/{s:03d}.json', headers={'User-Agent': 'bayaan-word-audit'})
    with urllib.request.urlopen(req, timeout=60) as r:
        timing = json.load(r)
    text, font = text_for(timing.get('numbering'), s)
    env = json.load(open(os.path.join(OUT, 'envelopes', f'{rid}-{s:03d}.json')))
    ayahs = [x for x in timing['ayahs'] if x.get('words')]
    # moments: start of ayah 1 words, a mid-surah ayah, a late ayah (drift)
    marks = []
    for frac in (0.0, 0.5, 0.92):
        ay = ayahs[min(len(ayahs) - 1, int(len(ayahs) * frac))]
        marks.append({'ayah': ay['ayah'], 'seek': max(0, ay['words'][0][0] - 600)})
    cases.append({'rid': rid, 'why': why, 'surah': s, 'title': f"{m.get('reciter')}", 'subtitle': f"{m.get('rewayah')} · {m.get('style') or ''} · surah {s}",
                  'audio': next(f['audio_url'] for f in audit['files'] if f['rid'] == rid and f['surah'] == s), 'timing': timing, 'text': {str(k): v for k, v in text.items()},
                  'font': font, 'env': env, 'marks': marks, 'audio_metrics': {k: v for k, v in a.items() if k != 'offsets'}})
json.dump(cases, open(os.path.join(OUT, 'cases.json'), 'w'), ensure_ascii=False)
print('\n'.join(f"{c['title']} | {c['subtitle']} | {c['why']}" for c in cases))
