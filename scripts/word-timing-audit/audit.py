#!/usr/bin/env python3
"""Audit the word-level timing files on the Bayaan CDN.

Reads every timestamps-words/<rewayat>/<NNN>.json listed in r2-listing.json,
the matching ayah-level timestamps/<rewayat>/<NNN>.json, the live catalog
(catalog.json, fetched by the workflow) and the Quran text bundled in the repo,
and writes audit.json: one row per surah file plus per-recitation rollups.

Checks per surah file:
  - schema (surah, numbering, ayahs[].{ayah,from,to,words[[s,e]]})
  - ayah count against the expected count for the file's numbering
  - word count per ayah against the Quran text for that numbering
  - word order: start < end, no overlap with the previous word
  - words outside their ayah's [from, to]
  - very short (<60 ms) and very long (>12 s) words, long gaps (>2.5 s) inside an ayah
  - ayah bounds against the ayah-level file (the one the app plays today)
  - audio duration (ffprobe on the catalog mp3) against the last timing
"""
import json, os, re, sqlite3, subprocess, sys, threading, time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

CDN = os.environ.get('CDN', 'https://cdn.thebayaan.com')
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
LIMIT = int(os.environ.get('LIMIT', '0'))  # 0 = every recitation
os.makedirs(OUT, exist_ok=True)


def get(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'bayaan-word-audit'}), timeout=60) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            if e.code in (403, 404):
                return e.code, b''
            time.sleep(1.5 * (i + 1))
        except Exception:
            time.sleep(1.5 * (i + 1))
    return 0, b''


# ---------- reference text ----------
def word_tokens(text):
    return [x for x in re.split(r'[\s\xa0]+', text) if x and not re.fullmatch(r'[٠-٩]+', x) and x != '۞']

HAFS = {}
for v in json.load(open(os.path.join(ROOT, 'data/quran.json'))).values():
    HAFS[(v['surah_number'], v['ayah_number'])] = len(word_tokens(v['text']))

REF = {'hafs': HAFS}
dk = os.path.join(ROOT, 'data/mushaf/digitalkhatt')
for f in os.listdir(dk):
    m = re.fullmatch(r'dk_words_(\w+)\.db', f)
    if m and os.path.getsize(os.path.join(dk, f)) > 0:
        c = sqlite3.connect(os.path.join(dk, f))
        REF[m.group(1)] = {(s, a): n for s, a, n in c.execute('select surah, ayah, count(*) from words group by surah, ayah')}

def ayah_counts(ref):
    out = {}
    for (s, a) in ref:
        out[s] = max(out.get(s, 0), a)
    return out
AYAHS = {k: ayah_counts(v) for k, v in REF.items()}


# ---------- catalog ----------
catalog = json.load(open(os.path.join(OUT, 'catalog.json')))
RW = {}
for rc in catalog:
    for rw in rc.get('rewayat', []):
        RW[rw['id']] = {'reciter': rc.get('name'), 'reciter_id': rc.get('id'), 'rewayah': rw.get('name'), 'style': rw.get('style'),
                       'server': rw.get('server'), 'surah_list': rw.get('surah_list') or [], 'has_timestamps': rw.get('has_timestamps'),
                       'timestamps_surah_list': rw.get('timestamps_surah_list')}

listing = json.load(open(os.path.join(HERE, 'r2-listing.json')))
dec = lambda v: list(range(1, 115)) if v == 'all' else [int(x) for x in v.split(',') if x.isdigit()]
WORDS = {k: dec(v) for k, v in listing['words'].items()}
AYAHF = {k: dec(v) for k, v in listing['ayahs'].items()}
ids = sorted(WORDS)
if LIMIT:
    ids = ids[:LIMIT]


def load_versions():
    src = open(os.path.join(ROOT, 'utils/audioFileUrl.ts')).read()
    out = {}
    for rid, val in re.findall(r"'([0-9a-f-]{36})':\s*(\d+|\{[^}]*\})", src):
        out[rid] = int(val) if val.isdigit() else {int(a): int(b) for a, b in re.findall(r'(\d+)\s*:\s*(\d+)', val)}
    return out
VERSIONS = load_versions()


def audio_url(rid, s):
    meta = RW.get(rid) or {}
    if not meta.get('server'):
        return None
    e = VERSIONS.get(rid)
    v = e if isinstance(e, int) else (e or {}).get(s)
    url = f"{meta['server'].rstrip('/')}/{s:03d}.mp3"
    return f'{url}?v={v}' if v else url


def probe_duration(url, full=False):
    """Header estimate (fast) or a full decode (exact)."""
    try:
        if not full:
            r = subprocess.run(['ffprobe', '-v', 'error', '-rw_timeout', '30000000', '-user_agent', 'bayaan-word-audit',
                                '-show_entries', 'format=duration', '-of', 'csv=p=0', url], capture_output=True, text=True, timeout=90)
            return round(float(r.stdout.strip()) * 1000) if r.stdout.strip() else None
        r = subprocess.run(['ffmpeg', '-v', 'error', '-rw_timeout', '30000000', '-user_agent', 'bayaan-word-audit', '-i', url,
                            '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], capture_output=True, timeout=600)
        return round(len(r.stdout) / 2 / 8) if r.stdout else None
    except Exception:
        return None


# quran.com word segmentation differs from data/quran.json in three ayahs,
# where the bundled text joins two words.
QURANCOM = {(15, 7): 8, (27, 20): 12, (36, 22): 8}


def audit_file(rid, s):
    row = {'rid': rid, 'surah': s, 'issues': {}, 'n': {}}
    N = row['n']
    def flag(k, detail=None, count=1):
        N[k] = N.get(k, 0) + count
        row['issues'].setdefault(k, [])
        if detail is not None and len(row['issues'][k]) < 6:
            row['issues'][k].append(detail)
    st, body = get(f'{CDN}/timestamps-words/{rid}/{s:03d}.json')
    if st != 200:
        flag('fetch_failed', st); return row
    try:
        d = json.loads(body)
    except Exception:
        flag('bad_json'); return row
    numbering = d.get('numbering')
    row['numbering'] = numbering
    ayahs = d.get('ayahs') or []
    if d.get('surah') != s:
        flag('surah_mismatch', d.get('surah'))
    ref = REF.get(numbering)
    exp_ayahs = AYAHS.get(numbering, {}).get(s)
    row['ayahs'] = len(ayahs)
    row['exp_ayahs'] = exp_ayahs
    if ref is None:
        flag('unknown_numbering', numbering)
    elif exp_ayahs and len(ayahs) != exp_ayahs:
        flag('ayah_count', f'{len(ayahs)} vs {exp_ayahs}')
    words_total = exp_total = 0
    prev_end = None
    last_to = last_word_end = None
    for a in ayahs:
        n = a.get('ayah'); fr, to = a.get('from'), a.get('to'); ws = a.get('words') or []
        e = None
        if ref is not None:
            e = QURANCOM.get((s, n), ref.get((s, n))) if numbering == 'hafs' else ref.get((s, n))
            if e is None:
                flag('ayah_not_in_text', n)
            else:
                exp_total += e
            if numbering == 'hafs' and (s, n) in QURANCOM and len(ws) == QURANCOM[(s, n)]:
                flag('text_split_differs', f'{s}:{n}')
        if fr is None or to is None:
            flag('ayah_untimed', f'{s}:{n}'); continue
        last_to = to
        if to <= fr:
            flag('ayah_zero_length', f'{s}:{n}')
        if not ws:
            flag('ayah_no_words', f'{s}:{n}'); continue
        words_total += len(ws)
        if e is not None and e != len(ws):
            flag('word_count', f'{s}:{n} {len(ws)} vs {e}')
        pe = None
        durs = []
        for i, w in enumerate(ws):
            if not (isinstance(w, list) and len(w) >= 2 and all(isinstance(x, (int, float)) for x in w[:2])):
                flag('bad_word_shape', f'{s}:{n}:{i+1}'); durs.append(None); continue
            ws_, we = w[0], w[1]
            dur = we - ws_
            durs.append(dur)
            if dur <= 0:
                flag('word_zero_length', f'{s}:{n}:{i+1}')
            elif dur < 60:
                flag('word_under_60ms', f'{s}:{n}:{i+1} {dur}ms')
            if 0 < dur < 200:
                flag('word_under_200ms')
            if dur > 12000 and i < len(ws) - 1:
                flag('word_over_12s', f'{s}:{n}:{i+1} {dur/1000:.1f}s')
            if pe is not None:
                if ws_ < pe - 1:
                    flag('word_overlap', f'{s}:{n}:{i+1} {pe-ws_}ms')
                elif ws_ - pe > 2500:
                    flag('word_gap_over_2_5s', f'{s}:{n}:{i} to {i+1} {(ws_-pe)/1000:.1f}s')
            if ws_ < fr - 1 or we > to + 1:
                flag('word_outside_ayah', f'{s}:{n}:{i+1}')
            pe = we
        # evenly squeezed placeholder words: 3+ in a row with the same short length
        run = 1
        for i in range(1, len(durs)):
            if durs[i] is not None and durs[i] == durs[i-1] and 0 < durs[i] <= 120:
                run += 1
                if run == 3:
                    flag('words_squeezed', f'{s}:{n}', 3)
                elif run > 3:
                    N['words_squeezed'] += 1
            else:
                run = 1
        if prev_end is not None and isinstance(ws[0], list) and ws[0][0] < prev_end - 1:
            flag('ayah_word_overlap', f'{s}:{n}')
        if isinstance(ws[-1], list):
            prev_end = ws[-1][1]; last_word_end = ws[-1][1]
    row.update(words=words_total, exp_words=exp_total, last_to=last_to, last_word_end=last_word_end)

    # ayah-level file the app plays today
    st2, b2 = get(f'{CDN}/timestamps/{rid}/{s:03d}.json')
    if st2 == 200:
        try:
            at = {x['ayahNumber']: (x['timestampFrom'], x['timestampTo']) for x in json.loads(b2)}
            dfrom, dto = [], []
            for a in ayahs:
                if a.get('ayah') in at and a.get('from') is not None and a.get('to') is not None:
                    f0, t0 = at[a['ayah']]
                    if a['ayah'] != ayahs[0].get('ayah'):
                        dfrom.append(abs(f0 - a['from']))
                    dto.append(abs(t0 - a['to']))
            row['ayahfile_from_maxdiff'] = max(dfrom) if dfrom else None
            row['ayahfile_to_maxdiff'] = max(dto) if dto else None
            row['ayahfile_last_to'] = max(t for _, t in at.values()) if at else None
            if (dfrom and max(dfrom) > 50) or (dto and max(dto) > 50):
                flag('ayah_bounds_differ', f'from {max(dfrom) if dfrom else 0}ms, to {max(dto) if dto else 0}ms')
            if len(at) != len(ayahs):
                flag('ayah_sets_differ', f'{len(ayahs)} vs {len(at)}')
        except Exception as ex:
            flag('ayahfile_bad', str(ex)[:80])
    else:
        flag('ayahfile_missing', st2)

    url = audio_url(rid, s)
    row['audio_url'] = url
    if url and os.environ.get('PROBE', '1') == '1':
        dur = probe_duration(url)
        if dur and last_to and (last_to > dur + 1500 or (last_word_end and dur - last_word_end > 30000)):
            exact = probe_duration(url, full=True)
            if exact:
                row['audio_header_ms'] = dur
                dur = exact
        row['audio_ms'] = dur
        if dur and last_to:
            if last_to > dur + 1500:
                flag('timing_past_audio_end', f'{(last_to-dur)/1000:.1f}s')
            if last_word_end and dur - last_word_end > 30000:
                flag('audio_tail_untimed', f'{(dur-last_word_end)/1000:.0f}s')
        elif not dur:
            flag('audio_probe_failed')
    return row


def main():
    jobs = [(rid, s) for rid in ids for s in WORDS[rid]]
    print(f'{len(ids)} recitations, {len(jobs)} surah files', flush=True)
    rows = []
    lock = threading.Lock()
    done = [0]
    def run(j):
        r = audit_file(*j)
        with lock:
            rows.append(r); done[0] += 1
            if done[0] % 2000 == 0:
                print(f'  {done[0]}/{len(jobs)}', flush=True)
    with ThreadPoolExecutor(int(os.environ.get('WORKERS', '48'))) as ex:
        list(ex.map(run, jobs))
    rows.sort(key=lambda r: (r['rid'], r['surah']))

    recs = []
    for rid in ids:
        meta = RW.get(rid, {})
        mine = [r for r in rows if r['rid'] == rid]
        expected = sorted(set(meta.get('surah_list') or []))
        logs = {}
        for kind in ('json', 'error.json'):
            st, b = get(f'{CDN}/timestamps-words/_publish_log/{rid}.{kind}', tries=2)
            if st == 200:
                try:
                    j = json.loads(b)
                    logs[kind] = {k: v for k, v in j.items() if k != 'written'} if isinstance(j, dict) else j
                except Exception:
                    logs[kind] = b[:300].decode('utf8', 'replace')
        recs.append({
            'publish_log': logs,
            'rid': rid, **{k: meta.get(k) for k in ('reciter', 'reciter_id', 'rewayah', 'style', 'has_timestamps')},
            'in_catalog': rid in RW,
            'surahs_audio': len(expected), 'surahs_words': len(WORDS[rid]), 'surahs_ayahfile': len(AYAHF.get(rid, [])),
            'missing_words': sorted(set(expected) - set(WORDS[rid])) if expected else [],
            'ayahfile_without_words': sorted(set(AYAHF.get(rid, [])) - set(WORDS[rid])),
            'numbering': sorted({r.get('numbering') for r in mine if r.get('numbering')}),
            'words': sum(r.get('words', 0) for r in mine), 'exp_words': sum(r.get('exp_words', 0) for r in mine),
            'counts': {k: sum(r['n'].get(k, 0) for r in mine) for k in sorted({k for r in mine for k in r['n']})},
            'issue_files': {k: sum(1 for r in mine if k in r['issues']) for k in sorted({k for r in mine for k in r['issues']})},
        })
    in_catalog_with_audio = [rid for rid in RW if RW[rid]['surah_list']]
    summary = {
        'generated': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'recitations_with_words': len(ids), 'surah_files': len(rows),
        'catalog_recitations': len(RW), 'catalog_recitations_without_words': sorted(set(in_catalog_with_audio) - set(WORDS)),
        'words_not_in_catalog': sorted(set(WORDS) - set(RW)),
        'numbering_counts': {n: sum(1 for r in rows if r.get('numbering') == n) for n in sorted({str(r.get('numbering')) for r in rows})},
        'issue_totals': {k: sum(r['n'].get(k, 0) for r in rows) for k in sorted({k for r in rows for k in r['n']})},
        'issue_counts': {k: sum(1 for r in rows if k in r['issues']) for k in sorted({k for r in rows for k in r['issues']})},
        'words_total': sum(r.get('words', 0) for r in rows), 'exp_words_total': sum(r.get('exp_words', 0) for r in rows),
    }
    json.dump({'summary': summary, 'recitations': recs, 'files': rows, 'catalog_meta': RW}, open(os.path.join(OUT, 'audit.json'), 'w'))
    print(json.dumps(summary, indent=1)[:4000])


if __name__ == '__main__':
    main()
