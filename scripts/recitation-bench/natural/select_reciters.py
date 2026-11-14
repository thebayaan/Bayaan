"""Chooses the unseen professional reciters from QUA's catalog.

    python -I natural/select_reciters.py

Keeps Hafs murattal mushafs on the MP3Quran, Way2Quran and tvQuran channels whose
reciter is on neither training list (EveryAyah, Muaalem) by name, and that QUA
published after the engine's fine-tune staged its QUA data, so they cannot be in
that mix. Name lists and manual alias calls live under .out/natural/lists/: the
tracked code holds no names. Writes .out/natural/manifests/reciters.json.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qua as Q  # noqa: E402
import text as T  # noqa: E402

CHANNELS = {'MP3Quran', 'Way2Quran', 'tvQuran'}
# The fine-tune's data mix was staged on this date (Tilawa EXPERIMENTS.md).
FINE_TUNE_STAGED = '2026-09-15T23:59:59'
MIN_RATE_HZ = 22050
MIN_KBPS = 48
LISTS = os.path.join(T.OUT, 'lists')


def norm(name):
    s = name.lower().replace('_', ' ').replace('-', ' ').replace("'", '')
    s = re.sub(r'\b(al|ar|as|ash|ad|az|an|at|el|bin|ibn|abu|bn)\b', ' ', s)
    s = re.sub(r'[^a-z ]', '', s)
    s = re.sub(r'(.)\1+', r'\1', s)
    for a, b in [('ee', 'i'), ('ou', 'u'), ('oo', 'u'), ('th', 't'), ('dh', 'd'), ('kh', 'k'), ('sh', 's')]:
        s = s.replace(a, b)
    s = re.sub(r'[aeiouy]', '', s)
    return ' '.join(s.split())


def on_list(entry, listed, aliases):
    """Why this reciter counts as listed, or None."""
    if entry['slug'] in aliases:
        return f"manual: {aliases[entry['slug']]}"
    words = set(norm(entry['name_en']).split())
    for name in listed:
        other = set(norm(name).split())
        if len(words & other) >= 2:
            return f'name: {name}'
    return None


def main():
    with open(os.path.join(LISTS, 'catalog.json'), encoding='utf-8') as f:
        catalog = json.load(f)
    with open(os.path.join(LISTS, 'everyayah.json'), encoding='utf-8') as f:
        everyayah = json.load(f)
    with open(os.path.join(LISTS, 'muaalem.json'), encoding='utf-8') as f:
        muaalem = json.load(f)
    with open(os.path.join(LISTS, 'aliases.json'), encoding='utf-8') as f:
        aliases = json.load(f)
    listed = sorted(set(everyayah) | {m['english_name'] for m in muaalem})
    listed_ar = {m['arabic_name'] for m in muaalem}
    chosen = []
    rejected = []
    for r in sorted(catalog, key=lambda r: r['slug']):
        if not r['riwayah'].startswith('Hafs') or r['style'] != 'Murattal':
            continue
        if r['channel'] not in CHANNELS:
            continue
        why = on_list(r, listed, aliases)
        if not why and r['name_ar'] in listed_ar:
            why = 'name: same Arabic name on the Muaalem list'
        if not why and r['published_at'] <= FINE_TUNE_STAGED:
            why = 'published before the fine-tune staged its data'
        if not why and r['chapter_count'] != 114:
            why = 'not a whole mushaf'
        if not why and (
            r['sample_rate_hz'] < MIN_RATE_HZ
            or (r['bitrate_kbps_nominal'] or 999) < MIN_KBPS
        ):
            why = 'low-rate source'
        if why:
            rejected.append({'slug': r['slug'], 'why': why})
            continue
        chosen.append(r)
    out = os.path.join(T.OUT, 'manifests/reciters.json')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(
            {'revision': Q.REVISION, 'chosen': chosen, 'rejected': rejected},
            f,
            ensure_ascii=False,
            indent=1,
        )
    print(f'{len(chosen)} chosen, {len(rejected)} rejected; wrote {out}')
    for r in chosen:
        print(
            f"  {r['slug']:<40} {r['channel']:<10} {r['sample_rate_hz']:>6} Hz "
            f"{r['bitrate_kbps_nominal']} kbps  {r['total_duration_hours']:.1f} h"
        )


if __name__ == '__main__':
    main()
