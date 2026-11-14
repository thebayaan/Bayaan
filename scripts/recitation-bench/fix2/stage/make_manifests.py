"""Writes manifest.json for dev_pool, heldout_pool and speech from files already staged.
Idempotent; reads only. Run: python3 -I fix2/stage/make_manifests.py
Seconds come from file size (16 kHz mono f32 = 64,000 B/s). Words from data/quran.json:
whitespace tokens with at least one Arabic letter (the ayah-number token has none).
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import DATA, FIX2_OUT as FIX2, REPO  # noqa: E402
QDC = os.path.join(FIX2, 'qdc')
AR = re.compile('[ء-غف-يٮ-ۓۺ-ۿ]')

quran = json.load(open(os.path.join(REPO, 'data/quran.json'), encoding='utf-8'))
AYAT, WORDS = {}, {}
for v in quran.values():
    s = v['surah_number']
    AYAT[s] = max(AYAT.get(s, 0), v['ayah_number'])
    WORDS[(s, v['ayah_number'])] = sum(1 for t in v['text'].split() if AR.search(t))


def surah_words(s, a0=1, a1=None):
    return sum(WORDS[(s, a)] for a in range(a0, (a1 or AYAT[s]) + 1))


def secs(p):
    return round(os.path.getsize(p) / 64000, 3)


def write(name, made, sources, clips):
    d = os.path.join(DATA, name)
    os.makedirs(d, exist_ok=True)
    json.dump({'set': name, 'made': made, 'sources': sources, 'clips': clips},
              open(os.path.join(d, 'manifest.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    hours = sum(c['seconds'] for c in clips) / 3600
    words = sum(surah_words(c['surah'], c['ayahStart'], c['ayahEnd']) for c in clips if c['surah'])
    stats = {'set': name, 'clips': len(clips), 'hours': round(hours, 3), 'words': words,
             'gb': round(sum(os.path.getsize(c['audio']) for c in clips) / 1e9, 3)}
    json.dump(stats, open(os.path.join(d, 'stats.json'), 'w'), indent=1)
    print(json.dumps(stats))
    return stats


# ---------------- dev_pool ----------------
QNAMES = {2: 'AbdulBaset AbdulSamad', 3: 'Abdur-Rahman as-Sudais', 4: 'Abu Bakr al-Shatri', 5: 'Hani ar-Rifai',
          6: 'Mahmoud Khalil Al-Husary', 7: 'Mishari al-Afasy', 9: 'Mohamed Siddiq al-Minshawi',
          10: "Sa'ud ash-Shuraim", 97: 'Yasser Ad-Dussary', 161: 'Khalifah Al Tunaiji'}
DEV = {r: [67, 78, 36, 55, 89, 56, 50] for r in QNAMES}
for r in (7, 10, 161, 5):
    DEV[r] = DEV[r] + [18]


def dev_pool():
    offs_path = os.path.join(FIX2, 'qdc_offsets.json')
    offs = json.load(open(offs_path)) if os.path.exists(offs_path) else {}
    clips, missing = [], []
    for r, surahs in DEV.items():
        for s in surahs:
            a, t = os.path.join(QDC, f'{r}_{s}.f32'), os.path.join(QDC, f'{r}_{s}.json')
            if not (os.path.exists(a) and os.path.exists(t)):
                missing.append(f'{r}_{s}')
                continue
            af = json.load(open(t))['audio_files'][0]
            vt = af['verse_timings']
            seg = [x for x in vt[0]['segments'] if len(x) >= 3]
            first = seg[0][1] / 1000 if seg else None
            nseg = sum(len([x for x in v['segments'] if len(x) >= 3]) for v in vt)
            o = offs.get(f'{r}_{s}')
            clips.append({
                'id': f'qdc{r}_s{s:03d}', 'audio': a, 'seconds': secs(a), 'reciter': f'qdc_{r}',
                'group': 'checker_heldout' if r == 5 else 'dev', 'kind': 'surah',
                'surah': s, 'ayahStart': 1, 'ayahEnd': AYAT[s],
                'leadSeconds': first if first and first >= 0.5 else None,
                'timings': t, 'timingsKind': 'qdc-words', 'label': 'correct',
                'extra': {'qdcRecitationId': r, 'reciterName': QNAMES[r], 'style': 'Murattal', 'riwayah': 'Hafs',
                          'audioUrl': af['audio_url'], 'qdcDurationMs': af.get('duration'),
                          'qdcFirstWordStart': first, 'segments': nseg, 'officialWords': surah_words(s),
                          'ayatTimed': len(vt),
                          'offset': ({'endMed': o['endMed'], 'startMed': o['startMed'], 'n': o['n']} if o else None),
                          'offsetNote': 'checker word end minus QDC segment end, median over sampled ayat '
                                        '(lab/offset_check.mjs); null = not measured'},
            })
    if missing:
        print('dev_pool missing', missing, file=sys.stderr)
    made = ('Quran.com (QDC) surah recordings with per-word segments, ten Hafs murattal recitations (QDC ids '
            '2 3 4 5 6 7 9 10 97 161), surahs 36 50 55 56 67 78 89 for all and 18 for ids 5 7 10 161. Fetched '
            'with fix2/stage_qdc.sh (timings from api.qurancdn.com, audio_url from that json, decoded '
            'to 16 kHz mono f32). Files live in .out/fix2/qdc/ and are pointed at, not moved. Voices are seen '
            'by both models except id 5 (Hani ar-Rifai), which the checker never trained on. leadSeconds = '
            'the first word segment start when it is at least 0.5 s (QDC usually starts ayah 1 at 0, folding the '
            'opening into the first word, so null there). Tune thresholds here.')
    src = [{'name': 'Quran.com QDC audio API', 'url': 'https://api.qurancdn.com/api/qdc/audio/reciters/<id>/audio_files?chapter=<n>&segments=true',
            'licence': 'none published for the audio; Quran.com developer terms (not read); local test use only, never redistributed',
            'note': 'checker: trained on these voices via EveryAyah except Hani ar-Rifai (id 5, a checker test reciter); '
                    'follower: all voices seen (EveryAyah/QUA *_qdc mushafs); QDC recordings likely follower training data'}]
    return write('dev_pool', made, src, clips), missing


# ---------------- heldout_pool ----------------
HO = os.path.join(DATA, 'heldout_pool')
READS = {20: ('Khalid Al-Jileel', 20), 265: ('Ahmad Deban', 265), 300: ('Saleh Alshamrani', 300),
         3: ('Ibrahim Al-Asiri', 3), 88: ('Neamah Al-Hassan', 88), 69: ('Abdulmohsin Al-Obaikan', 69),
         299: ('Hasan Saleh', 286)}
SERVER = {20: 'khalid-jalil', 265: 'ahmad-deeban', 300: 'saleh-shamrani', 3: 'ibrahim-asiri', 88: 'neama-hassan',
          69: 'abdulmohsen-obaikan', 299: 'hassan-saleh'}
SURAHS = [19, 25, 50, 73, 76, 89]
ZHKEY = {'ahmad-alnufais-murattal': ('zh_ahmad-alnufais', 'Ahmad Al-Nufais', None),
         'khalid-al-jalil-murattal': ('mp3q_20', 'Khalid Al-Jileel', 20),
         'ahmed-diban-murattal': ('mp3q_265', 'Ahmad Deban', 265)}


def zh_info(path, s):
    j = json.load(open(path, encoding='utf-8'))
    vs = j['verses']
    starts = [w['startTime'] for v in vs for w in v['words']]
    mono = all(b >= a for a, b in zip(starts, starts[1:]))
    nw = sum(len(v['words']) for v in vs)
    first = vs[0]['words'][0]['startTime'] / 1000 if vs and vs[0]['words'] else None
    return {'durationMs': j['metadata'].get('duration_ms'), 'zhWords': nw, 'zhVerses': len(vs), 'monotone': mono,
            'firstWordStart': first, 'pipeline': j['metadata'].get('pipeline'),
            'acousticRepairs': len(j['metadata'].get('acoustic_repair') or [])}


def heldout_pool():
    same_p = os.path.join(HO, 'raw', 'zh_vs_mp3quran.json')
    same = json.load(open(same_p)) if os.path.exists(same_p) else {}
    clips, missing = [], []
    for read, (name, rid) in READS.items():
        for s in SURAHS:
            a = os.path.join(HO, 'audio', f'mp3q_{read}_{s:03d}.f32')
            t = os.path.join(HO, 'raw', f'mp3q_{read}_{s:03d}.json')
            if not (os.path.exists(a) and os.path.exists(t)):
                missing.append(f'mp3q_{read}_{s}')
                continue
            rows = json.load(open(t))
            ay = {r['ayah']: r for r in rows}
            lead = ay[1]['start_time'] / 1000 if 1 in ay else None
            extra = {'mp3quranReciterId': rid, 'mp3quranRead': read, 'reciterName': name, 'riwayah': 'Hafs',
                     'style': 'Murattal (moshaf_type 11)',
                     'audioUrl': f'https://cdn.mp3quran.net/audio/{SERVER[read]}/r1/{s:03d}.mp3',
                     'hasAyah0Row': 0 in ay, 'ayah0EndSeconds': ay[0]['end_time'] / 1000 if 0 in ay else None,
                     'ayatTimed': len([k for k in ay if k > 0]), 'officialAyat': AYAT[s],
                     'lastAyahEndSeconds': max(r['end_time'] for r in rows) / 1000,
                     'tailSecondsAfterLastAyah': round(secs(a) - max(r['end_time'] for r in rows) / 1000, 2),
                     'leadNote': 'leadSeconds = ayah 1 start_time; no ayah 0 row for these surahs; whether the '
                                 'basmala sits before it or inside ayah 1 is not verified (values under 1 s suggest inside)',
                     'officialWords': surah_words(s)}
            # ZH word timings for the same recording (Al-Jileel, Deban) when durations agree
            for slug, (key, _n, r2) in ZHKEY.items():
                if r2 == read:
                    m = same.get(f'{slug}_{s}')
                    extra['zh'] = m
                    zt = os.path.join(HO, 'raw', f'zh_{slug}_{s:03d}.json')
                    if m and m['same'] and os.path.exists(zt):
                        extra['zhWordTimings'] = zt
                        extra['zhInfo'] = zh_info(zt, s)
            clips.append({'id': f'mp3q{read}_s{s:03d}', 'audio': a, 'seconds': secs(a), 'reciter': f'mp3q_{read}',
                          'group': 'heldout', 'kind': 'surah', 'surah': s, 'ayahStart': 1, 'ayahEnd': AYAT[s],
                          'leadSeconds': lead, 'timings': t, 'timingsKind': 'mp3quran-ayat', 'label': 'correct',
                          'extra': extra})
    for slug, (key, name, r2) in ZHKEY.items():
        for s in SURAHS:
            a = os.path.join(HO, 'audio', f'zh_{slug}_{s:03d}.f32')
            t = os.path.join(HO, 'raw', f'zh_{slug}_{s:03d}.json')
            if not os.path.exists(a):
                if r2 is None:
                    missing.append(f'zh_{slug}_{s}')
                continue
            info = zh_info(t, s) if os.path.exists(t) else None
            clips.append({'id': f'zh_{slug}_s{s:03d}', 'audio': a, 'seconds': secs(a),
                          'reciter': f'zh_{slug}' if r2 is None else f'mp3q_{r2}',  # key = voice
                          'group': 'heldout', 'kind': 'surah', 'surah': s, 'ayahStart': 1, 'ayahEnd': AYAT[s],
                          'leadSeconds': info['firstWordStart'] if info else None,
                          'timings': t if info else None, 'timingsKind': 'zh-words-surah' if info else None,
                          'label': 'correct',
                          'extra': {'zhSlug': slug, 'reciterName': name, 'riwayah': 'Hafs', 'style': 'Murattal',
                                    'zhRevision': 'fc2d3dc82fe96af3eecb3897395e395d4a004c57',
                                    'zhPath': f'{ZH_DIR[slug]}/Full Surah/{s:03d}/{s:03d}.opus',
                                    'zhInfo': info, 'officialWords': surah_words(s),
                                    'sameVoiceAsMp3quranRead': r2,
                                    'note': None if r2 is None else 'different recording from mp3quran (durations differ)'}})
    made = ('Held-out pool, report only, never tune. mp3quran.net Hafs murattal surah mp3 for reads 20 265 300 3 88 '
            '69 299 (API v3 servers), surahs 19 25 50 73 76 89, with ayah timings from /api/v3/ayat_timing '
            '(ms on the surah clock; leadSeconds = ayah 1 start_time, which equals the end of the "ayah: 0" '
            'opening row when present). Plus zaibihassan/Quranic-Recitation-Data (rev fc2d3dc8) Full Surah opus '
            'and surah-relative word-timing json for Ahmad Al-Nufais (a different recording from mp3quran), '
            'and ZH word timings for Khalid Al-Jalil and Ahmed Diban attached to the mp3quran clip when the ZH '
            'duration matches the mp3quran file within 1 s (else the ZH audio is its own clip). Staged with '
            'data/scripts/stage_heldout.py; decoded to 16 kHz mono f32.')
    src = [{'name': 'mp3quran.net API v3', 'url': 'https://www.mp3quran.net/api/v3/ayat_timing?surah=<n>&read=<id>',
            'licence': 'none found ((c) MP3Quran Audio Library); local test use only, never redistributed',
            'note': 'checker: never trained on mp3quran and none of these voices is an EveryAyah folder; follower: '
                    'not EveryAyah/Muaalem/QUA by name, but the base model archive tier (1,161 reciters) cannot be checked'},
           {'name': 'zaibihassan/Quranic-Recitation-Data', 'url': 'https://huggingface.co/datasets/zaibihassan/Quranic-Recitation-Data',
            'licence': 'Apache-2.0 (declared by uploader; audio source undocumented)',
            'note': 'checker: not trained; follower 0.4.0: not in NOTICE; Al-Nufais held out of the Quran-Lab base benchmark; '
                    'word timings are machine-made (asr_v15.0), not ground truth'}]
    return write('heldout_pool', made, src, clips), missing


ZH_DIR = {'ahmad-alnufais-murattal': 'Ahmad Alnufais (Murattal)', 'khalid-al-jalil-murattal': 'Khalid Al Jalil (Murattal)',
          'ahmed-diban-murattal': 'Ahmed Diban (Murattal)'}


# ---------------- speech ----------------
def speech():
    sp = os.path.join(DATA, 'speech')
    cj = os.path.join(sp, 'clips.json')
    if not os.path.exists(cj):
        return None, ['speech clips.json']
    clips = []
    for c in json.load(open(cj)):
        clips.append({'id': c['id'], 'audio': c['audio'], 'seconds': secs(c['audio']),
                      'reciter': c['speaker'] or f"{c['source'].split()[0].lower()}_unknown",
                      'group': 'ordinary', 'kind': 'span', 'surah': None, 'ayahStart': None, 'ayahEnd': None,
                      'leadSeconds': None, 'timings': None, 'timingsKind': None, 'label': None,
                      'extra': {'language': c['language'], 'source': c['source'], 'sourceRows': c['rows'],
                                'speaker': c['speaker'], 'sex': c.get('sex')}})
    made = ('Background speech for the "speech at 10 dB" condition, mirroring chatter/stage_speech.py (same pinned '
            'CC BY 4.0 files, sha256-checked against the HF tree listing) staged with data/scripts/stage_speech.py. '
            'Arabic: MediaSpeech ar shard 0 (broadcast segments, rows sampled evenly over the file, 2-4 consecutive '
            'sampled rows joined with 0.3 s gaps) and ClArTTS (one speaker, classical Arabic: the hard babble case). '
            'English: LibriSpeech dev-clean, one clip per speaker. Utterances whose transcript holds a four-word run '
            'of mushaf text (chatter/quran_screen.py) or names the Quran (English) are dropped. 16 kHz mono f32.')
    src = [{'name': 'ymoslem/MediaSpeech ar', 'url': 'https://huggingface.co/datasets/ymoslem/MediaSpeech/resolve/4008a968760f2187b0c5b2b2db965f1283433059/ar/train-00000-of-00002.parquet',
            'licence': 'CC BY 4.0', 'note': 'not recitation; not in either model\'s listed training data'},
           {'name': 'MBZUAI/ClArTTS', 'url': 'https://huggingface.co/datasets/MBZUAI/ClArTTS/resolve/2f6e820abba8b5168b346c43479a324d8d37e35a/data/',
            'licence': 'CC BY 4.0', 'note': 'one speaker; not recitation; not in listed training data'},
           {'name': 'LibriSpeech dev-clean', 'url': 'https://www.openslr.org/resources/12/dev-clean.tar.gz',
            'licence': 'CC BY 4.0', 'note': 'English read speech; not in listed training data'}]
    return write('speech', made, src, clips), []


if __name__ == '__main__':
    out = {}
    for f in (dev_pool, heldout_pool, speech):
        st, miss = f()
        out[f.__name__] = {'stats': st, 'missing': miss}
    json.dump(out, open(os.path.join(DATA, 'summary.json'), 'w'), indent=1)
