"""Realistic takes from the learner recitation sets, for bench.mjs --list.

python3 -I make_takes.py [dataset ...] [--reciter 7] [--out DIR] [--surahs 1,112]
                         [--limit N] [--gaps bridge|plain] [--no-refine]

The learner sets in .out/datasets hold clips of 2-4 s. Run cold, one by one,
the engine locks only at the very end of a clip, so almost nothing in it is
judged. A take here puts each clip where the app meets it, in the middle of
a recitation:

- al-ikhlas: each speaker's ayat in verse order, 0.4 s apart (file names
  ID<speaker>V<verse><T|F>). Hint: the first verse.
- sobolev-errors: each recording's chunks in chunk order, 0.4 s apart. Hint:
  the first chunk's ayah. Chunk numbers often jump ayat. Some chunks are as
  long as the labelled ayah, and then the ayat between are missing; others
  are as long as the labelled ayah plus the missing ones, so the reader
  carried on inside the chunk. With --gaps bridge (the default) a professional
  reciter reads the missing ayat in the first case, so a hole in the data
  does not reach the engine as a skipped ayah, and in the second case the
  segment gets extendsTo (the last ayah its audio probably runs to; words
  there have no label). Whichever span length the chunk is closer to (in
  log ratio, against the reciter's timings) decides. --gaps plain does
  neither.
- quranmb (without annotationSuspect / duplicateOf clips), retasy (located
  Quran clips labelled correct or incorrect) and qdat-bench: a professional
  reciter (Quran.com audio) leads in from the start of the ayah one or two
  before (back far enough for 6 s) to the end of the word before the clip,
  then 0.3 s of silence, then the clip. The engine locks during the lead-in
  and is in correction mode, its cursor on the clip's first word, when the
  learner starts. Hint: the lead-in's first ayah. A clip at a surah's first
  word has nothing before it and runs cold, as a take that starts there.

--control RID builds control takes for the lead-in sets instead (default
out .out/takes_control<RID>): the same lead-in, then reciter RID reading the
clip's own words (cut by RID's Quran.com timings), labelled correct. With
RID 7, the lead-in's own reciter, they measure what the cut and the pause
cost; with another reciter, what a change of voice adds. Every mark on the
continuation of a control take is false. Clips that share a span share one
control take (named after the first of them).

Every take ends with 1 s of silence, the pause before the reader taps stop.
The lead-in is scaled to the learner's speech level and every piece gets
8 ms fades, so no click or level jump marks the joins. The lead-in's last
cut is moved to the quietest point within 0.1 s of the word boundary
(--no-refine keeps Quran.com's time).

Writes <out>/<dataset>/manifest.json and <out>/<dataset>/audio/*.f32
(default out: .out/takes). Each take is {id, audio, hint, seconds, label,
segments}; a segment is {clipId, start, end (seconds in the take audio),
lead, label, surah, ayahStart, ayahEnd, wordStart, wordEnd, the source
clip's error fields, cold?}. Word numbers are the manifests' (1-based, by
space in data/quran.json, the ۞ sign not counted). <out>/wordmap.json maps
the engine's 0-based words to them where the engine splits a word in two.

Quran.com timing files are kept in <out>/_qdc/<reciter>/; full-surah audio
is downloaded to <out>/_tmp/, cut and deleted surah by surah. Each take's
entry is also saved next to its audio (<audio>.json), and a rerun keeps
takes already written: delete a take's files, or the folder, to rebuild it.
"""
import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
import unicodedata
from array import array
from collections import defaultdict

SR = 16000
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(HERE, '.out')
DATASETS = os.path.join(OUT, 'datasets')
ALL = ['al-ikhlas', 'sobolev-errors', 'quranmb', 'retasy', 'qdat-bench']

STITCH_GAP = 0.4  # between a reader's own ayat
LEAD_GAP = 0.3  # between the lead-in and the learner
TAIL = 1.0  # silence before stop
LEAD_MIN = 6.0  # seconds of lead-in wanted
FADE = 0.008
REFINE = 0.1
HIZB = '\u06de'  # the rub el hizb sign
AYAH_NO = re.compile(r'[\u0660-\u0669\u06f0-\u06f9]+')  # ayah numbers
QDC = 'https://api.qurancdn.com/api/qdc/audio/reciters/{rid}/audio_files?chapter={s}&segments=true'


# ---------------------------------------------------------------- words


def manifest_words(text):
    """Words as the dataset manifests number them: by space, without the
    ayah number and the ۞ sign."""
    return [t for t in text.split() if t != HIZB and not AYAH_NO.fullmatch(t)]


NORM = str.maketrans({'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ى': 'ي', 'ی': 'ي',
                      'ئ': 'ي', 'ؤ': 'و', 'ة': 'ه', 'ـ': None, 'ء': None})


def skeleton(word):
    return ''.join(ch for ch in word if unicodedata.category(ch).startswith('L')).translate(NORM)


def split_map(q_words, e_words):
    """For each engine word, the 1-based manifest word it is part of, when
    the engine splits manifest words in two or more; None if they do not
    line up that way."""
    out = []
    j = 0
    for i, qw in enumerate(q_words):
        target = skeleton(qw)
        if j >= len(e_words):
            return None
        acc = skeleton(e_words[j])
        parts = [j]
        while acc != target and len(acc) < len(target) and target.startswith(acc) and j + 1 < len(e_words):
            j += 1
            acc += skeleton(e_words[j])
            parts.append(j)
        if acc != target:
            return None
        out.extend([i + 1] * len(parts))
        j += 1
    return out if j == len(e_words) else None


def load_words():
    with open(os.path.join(ROOT, 'data', 'quran.json'), encoding='utf-8') as f:
        quran = json.load(f)
    with open(os.path.join(OUT, 'assets', 'zipformer_quran.json'), encoding='utf-8') as f:
        corpus = json.load(f)
    words = {(v['surah_number'], v['ayah_number']): manifest_words(v['text']) for v in quran.values()}
    engine = {(s['n'], a['n']): [w[2] for w in a['w']] for s in corpus['surahs'] for a in s['ayahs']}
    return words, engine


def word_map(words, engine):
    """Compares word counts for every ayah and maps the ones that differ."""
    hizb = 0
    mapped, excluded = {}, []
    with open(os.path.join(ROOT, 'data', 'quran.json'), encoding='utf-8') as f:
        for v in json.load(f).values():
            if HIZB in v['text'].split():
                hizb += 1
    for key in sorted(words):
        q, e = words[key], engine.get(key)
        if e is None:
            excluded.append({'ayah': '%d:%d' % key, 'why': 'not in the engine corpus'})
            continue
        if len(q) == len(e):
            continue
        m = split_map(q, e)
        if m is None:
            excluded.append({'ayah': '%d:%d' % key, 'manifestWords': len(q), 'engineWords': len(e)})
        else:
            mapped['%d:%d' % key] = m
    return {
        'note': 'Manifest word numbers are 1-based, by space in data/quran.json without the '
                'ayah number and the hizb sign (U+06DE, which starts %d ayat and which the '
                'manifests do not count). With that, every ayah has the engine corpus\'s word '
                'count except the ones below. engineToManifest[ayah][w] is the 1-based manifest '
                'word holding engine word w (0-based); other ayat map w to w + 1.' % hizb,
        'ayat': len(words),
        'hizbSignAyat': hizb,
        'engineToManifest': mapped,
        'excluded': excluded,
    }


# ---------------------------------------------------------------- audio


def read_f32(path, start=0, count=None):
    a = array('f')
    with open(path, 'rb') as f:
        f.seek(start * 4)
        a.frombytes(f.read(-1 if count is None else count * 4))
    return a


def f32_len(path):
    return os.path.getsize(path) // 4


def silence(sec):
    return array('f', bytes(4 * int(round(sec * SR))))


def fade(x):
    n = min(int(FADE * SR), len(x) // 2)
    for i in range(n):
        g = 0.5 - 0.5 * math.cos(math.pi * i / n)
        x[i] *= g
        x[-1 - i] *= g
    return x


def active_rms(x):
    """Level of the louder half of 25 ms frames (the speech, not the pauses)."""
    frame = 400
    powers = []
    for i in range(0, len(x) - frame + 1, frame):
        seg = x[i:i + frame:2]
        powers.append(sum(v * v for v in seg) / len(seg))
    if not powers:
        return 0.0
    powers.sort()
    top = powers[len(powers) // 2:]
    return math.sqrt(sum(top) / len(top))


def quietest(path, t, total):
    """The quietest 20 ms point within REFINE seconds of t (seconds)."""
    lo = max(0, int((t - REFINE - 0.01) * SR))
    hi = min(total, int((t + REFINE + 0.01) * SR))
    x = read_f32(path, lo, hi - lo)
    win, hop = 320, 80
    best, at = None, t
    for i in range(0, len(x) - win + 1, hop):
        e = sum(v * v for v in x[i:i + win:2])
        if best is None or e < best:
            best, at = e, (lo + i + win / 2) / SR
    return at


# ---------------------------------------------------------------- Quran.com


class Reciter:
    """Quran.com word timings and audio of one reciter, fetched on demand."""

    def __init__(self, rid, out):
        self.rid = rid
        self.qdc_dir = os.path.join(out, '_qdc', str(rid))
        self.tmp_dir = os.path.join(out, '_tmp')
        os.makedirs(self.qdc_dir, exist_ok=True)
        self.cache = {}

    def timings(self, s):
        if s in self.cache:
            return self.cache[s]
        path = os.path.join(self.qdc_dir, 'qdc_%d.json' % s)
        if not os.path.exists(path) or os.path.getsize(path) == 0:
            subprocess.run(['curl', '-sS', '--fail', '--max-time', '120', '-o', path,
                            QDC.format(rid=self.rid, s=s)], check=True)
        with open(path, encoding='utf-8') as f:
            af = json.load(f)['audio_files'][0]
        verses = {}
        for v in af['verse_timings']:
            a = int(str(v['verse_key']).split(':')[1])
            segs = []
            for x in v.get('segments') or []:
                if (len(x) >= 3 and all(isinstance(y, (int, float)) for y in x[:3])
                        and x[2] > x[1]):
                    segs.append([int(x[0]), x[1] / 1000, x[2] / 1000])
            segs.sort(key=lambda g: g[1])
            # A lone mislabelled word between two neighbours (3, 12, 5 -> 3, 4, 5).
            for i in range(1, len(segs) - 1):
                p, n = segs[i - 1][0], segs[i + 1][0]
                if segs[i][0] != p + 1 and n == p + 2:
                    segs[i][0] = p + 1
            verses[a] = {'from': v['timestamp_from'] / 1000, 'to': v['timestamp_to'] / 1000,
                         'segs': segs}
        url = str(af['audio_url'])
        if not url.startswith('https://'):
            raise ValueError('unexpected audio url for surah %d' % s)
        self.cache[s] = (url, verses)
        return self.cache[s]

    def audio(self, s):
        """Downloads and decodes surah s; returns (path, cleanup dir)."""
        url, _ = self.timings(s)
        d = os.path.join(self.tmp_dir, '%d_%d' % (self.rid, s))
        shutil.rmtree(d, ignore_errors=True)
        os.makedirs(d)
        mp3, f32 = os.path.join(d, 'a.mp3'), os.path.join(d, 'a.f32')
        subprocess.run(['curl', '-sSL', '--fail', '--max-time', '1800', '-o', mp3, url], check=True)
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', mp3, '-ac', '1', '-ar', str(SR),
                        '-f', 'f32le', f32], check=True)
        os.remove(mp3)
        return f32, d


def ayah_start(verses, a):
    """Where ayah a starts: its first timed word (a little before, but not
    into the ayah before); ayah 1 from the very start (with any basmala)."""
    v = verses[a]
    if a == 1 or not v['segs']:
        return v['from']
    st = v['segs'][0][1]
    prev = verses.get(a - 1)
    prev_end = prev['segs'][-1][2] if prev and prev['segs'] else v['from']
    return min(st, max(prev_end, st - 0.15))


def lead_plan(verses, nwords, s, a, ws):
    """The lead-in for a clip starting at ayah a, word ws: (start, cut,
    first ayah, last ayah, last word) in seconds of the surah audio, or a
    reason string when the timings cannot place it."""
    if a not in verses:
        return 'no timings for the ayah'
    if ws > 1:
        segs = verses[a]['segs']
        idx = next((i for i, g in enumerate(segs) if g[0] >= ws), None)
        if idx is None or idx == 0:
            return 'no timed word before the clip'
        cut = segs[idx][1]
        if segs[idx - 1][0] == ws - 1:
            cut = min(cut, segs[idx - 1][2])
        last = (a, ws - 1)
    else:
        prev = verses.get(a - 1)
        if not prev:
            return 'no timings for the ayah before'
        cut = prev['segs'][-1][2] if prev['segs'] else prev['to']
        if verses[a]['segs']:
            cut = min(cut, verses[a]['segs'][0][1])
        last = (a - 1, nwords[(s, a - 1)])
    first = a - 1 if a > 1 else 1
    start = ayah_start(verses, first)
    while cut - start < LEAD_MIN and first > 1 and (first - 1) in verses:
        first -= 1
        start = ayah_start(verses, first)
    if cut - start < 1.0:
        return 'lead-in under 1 s'
    return start, cut, first, last[0], last[1]


# ---------------------------------------------------------------- takes


def take_name(take_id):
    return re.sub(r'[^\w.-]', '_', take_id) + '.f32'


ERROR_FIELDS = ['errors', 'errorWords', 'phonemeEdits', 'textMatch', 'labelNote', 'golden',
                'duplicateOf', 'annotationSuspect']


def learner_segment(clip, nwords):
    seg = {
        'clipId': clip['id'],
        'lead': False,
        'label': clip['label'],
        'surah': clip['surah'],
        'ayahStart': clip['ayahStart'],
        'ayahEnd': clip['ayahEnd'],
        'wordStart': clip.get('wordStart') or 1,
        'wordEnd': clip.get('wordEnd') or nwords[(clip['surah'], clip['ayahEnd'])],
    }
    loc = clip.get('location') or {}
    if loc.get('ambiguous'):
        seg['ambiguous'] = True
    for k in ERROR_FIELDS:
        if k in clip:
            seg[k] = clip[k]
    return seg


def select(ds, manifest):
    if ds == 'quranmb':
        return [c for c in manifest if not c.get('annotationSuspect') and not c.get('duplicateOf')]
    if ds == 'retasy':
        return [c for c in manifest if c.get('surah') and c.get('wordStart')
                and c['label'] in ('correct', 'incorrect')]
    return [c for c in manifest if c.get('surah')]


def span_seconds(verses, a0, a1):
    """The reciter's time for whole ayat a0..a1 (first to last timed word)."""
    total = 0.0
    for a in range(a0, a1 + 1):
        v = verses.get(a)
        if not v:
            return None
        segs = v['segs']
        total += (segs[-1][2] - segs[0][1]) if segs else (v['to'] - v['from'])
    return total


def plan_takes(ds, clips, args, rec):
    """Takes as lists of parts: ('clip', clip, extra) | ('gap', sec) | ('lead', request)."""
    takes = []
    if ds == 'al-ikhlas':
        pat = re.compile(r'^al-ikhlas/ID(\d+)V(\d+)([TF])$')
        by = defaultdict(list)
        for c in clips:
            m = pat.match(c['id'])
            if not m or int(m.group(2)) != c['ayahStart']:
                raise ValueError('al-ikhlas id does not match ID<speaker>V<verse><T|F>')
            by[int(m.group(1))].append(c)
        for spk in sorted(by):
            cs = sorted(by[spk], key=lambda c: c['ayahStart'])
            parts = []
            for i, c in enumerate(cs):
                if i:
                    parts.append(('gap', STITCH_GAP))
                parts.append(('clip', c, {}))
            takes.append({'id': 'al-ikhlas/ID%d' % spk, 'hint': {'surah': 112, 'ayah': cs[0]['ayahStart']},
                          'parts': parts})
    elif ds == 'sobolev-errors':
        by = defaultdict(list)
        for c in clips:
            m = re.match(r'^sobolev-errors/(.+)-(\d+)$', c['id'])
            if not m or m.group(1) != c['recording']:
                raise ValueError('sobolev id is not <recording>-<chunk>')
            by[c['recording']].append((int(m.group(2)), c))
        for rec_id in sorted(by):
            parts_extra = []
            cs = [c for _, c in sorted(by[rec_id], key=lambda x: x[0])]
            parts = []
            for i, c in enumerate(cs):
                extra = {}
                nxt = cs[i + 1] if i + 1 < len(cs) else None
                if (args.gaps == 'bridge' and nxt and nxt['surah'] == c['surah']
                        and nxt['ayahStart'] > c['ayahEnd'] + 1):
                    _, verses = rec.timings(c['surah'])
                    lab = span_seconds(verses, c['ayahStart'], c['ayahEnd'])
                    ext = span_seconds(verses, c['ayahStart'], nxt['ayahStart'] - 1)
                    d = c['durationSec']
                    if lab and ext and abs(math.log(d / lab)) > abs(math.log(d / ext)):
                        extra = {'extendsTo': nxt['ayahStart'] - 1}
                    else:
                        extra = {'bridgeAfter': True}
                if i:
                    parts.append(('gap', STITCH_GAP))
                    prev_extra = parts_extra[-1]
                    if prev_extra.get('bridgeAfter'):
                        parts.append(('lead', {'surah': c['surah'], 'from': cs[i - 1]['ayahEnd'] + 1,
                                               'to': c['ayahStart'] - 1, 'bridge': True}))
                        parts.append(('gap', STITCH_GAP))
                parts.append(('clip', c, {k: v for k, v in extra.items() if k != 'bridgeAfter'}))
                parts_extra.append(extra)
            takes.append({'id': 'sobolev-errors/%s' % rec_id,
                          'hint': {'surah': cs[0]['surah'], 'ayah': cs[0]['ayahStart']}, 'parts': parts})
    else:
        seen = set()
        for c in clips:
            ws = c.get('wordStart') or 1
            if args.control:
                # One control take per span: several readers share a span.
                span = (c['surah'], c['ayahStart'], ws, c['ayahEnd'], c['wordEnd'])
                if span in seen:
                    continue
                seen.add(span)
                body = ('expert', {'surah': c['surah'], 'a0': c['ayahStart'], 'w0': ws,
                                   'a1': c['ayahEnd'], 'w1': c['wordEnd'], 'clip': c})
            else:
                body = ('clip', c)
            if c['ayahStart'] == 1 and ws == 1:
                takes.append({'id': c['id'], 'hint': {'surah': c['surah'], 'ayah': 1}, 'cold': True,
                              'parts': [body + ({'cold': True},)]})
            else:
                takes.append({'id': c['id'], 'hint': None, 'parts': [
                    ('lead', {'surah': c['surah'], 'ayah': c['ayahStart'], 'word': ws}),
                    ('gap', LEAD_GAP), body + ({},)]})
    return takes


def span_plan(verses, s, a0, w0, a1, w1):
    """A reciter's reading of words (a0, w0)..(a1, w1): (start, end) in
    seconds of the surah audio, or a reason string."""
    if a0 not in verses or a1 not in verses:
        return 'no timings for the ayat'
    if w0 == 1 and a0 == 1:
        start = ayah_start(verses, a0)
    elif w0 == 1:
        # Where a lead-in to this ayah ends (lead_plan), so the two meet.
        prev, v = verses.get(a0 - 1), verses[a0]
        start = prev['segs'][-1][2] if prev and prev['segs'] else v['from']
        if v['segs']:
            start = min(start, v['segs'][0][1])
    else:
        segs = verses[a0]['segs']
        idx = next((i for i, g in enumerate(segs) if g[0] >= w0), None)
        if idx is None:
            return 'no timed word at the start'
        start = segs[idx][1]
    segs = verses[a1]['segs']
    later = next((i for i, g in enumerate(segs) if g[0] > w1 and g[1] > start), None)
    upto = segs[:later] if later is not None else segs
    ends = [g[2] for g in upto if g[0] == w1 and g[1] >= start]
    if ends:
        end = ends[-1]
    elif later is not None:
        end = segs[later][1]
    else:
        end = verses[a1]['to']
    if later is None:
        nxt = verses.get(a1 + 1)
        if nxt and nxt['segs']:
            end = min(end, nxt['segs'][0][1])
    if end - start < 0.2:
        return 'span under 0.2 s'
    return start, end


def bridge_plan(verses, nwords, s, a0, a1):
    """Expert audio for whole ayat a0..a1."""
    if a0 not in verses or a1 not in verses:
        return 'no timings for the ayat'
    start = ayah_start(verses, a0)
    end_v = verses[a1]
    cut = end_v['segs'][-1][2] if end_v['segs'] else end_v['to']
    nxt = verses.get(a1 + 1)
    if nxt and nxt['segs']:
        cut = min(cut, nxt['segs'][0][1])
    if cut - start < 0.5:
        return 'bridge under 0.5 s'
    return start, cut, a0, a1, nwords[(s, a1)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('datasets', nargs='*', default=ALL)
    ap.add_argument('--reciter', type=int, default=7)
    ap.add_argument('--out', default=os.path.join(OUT, 'takes'))
    ap.add_argument('--surahs', default='')
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--gaps', choices=['bridge', 'plain'], default='bridge')
    ap.add_argument('--no-refine', action='store_true')
    ap.add_argument('--control', type=int, default=0)
    args = ap.parse_args()
    only_surahs = {int(x) for x in args.surahs.split(',') if x}
    if args.control:
        args.datasets = [d for d in args.datasets if d in ('quranmb', 'retasy', 'qdat-bench')]
        if args.out == os.path.join(OUT, 'takes'):
            args.out = os.path.join(OUT, 'takes_control%d' % args.control)
    out = os.path.abspath(args.out)
    os.makedirs(out, exist_ok=True)

    rec = Reciter(args.reciter, out)
    reciters = {args.reciter: rec}
    if args.control:
        reciters.setdefault(args.control, Reciter(args.control, out))
    words, engine = load_words()
    nwords = {k: len(v) for k, v in words.items()}
    wm = word_map(words, engine)
    with open(os.path.join(out, 'wordmap.json'), 'w', encoding='utf-8') as f:
        json.dump(wm, f, ensure_ascii=False, indent=1)
    print('word counts: %d ayat, %d differ after dropping the hizb sign: mapped %s, excluded %s'
          % (wm['ayat'], len(wm['engineToManifest']) + len(wm['excluded']),
             sorted(wm['engineToManifest']), [e['ayah'] for e in wm['excluded']]))

    plans = {}
    for ds in args.datasets:
        with open(os.path.join(DATASETS, ds, 'manifest.json'), encoding='utf-8') as f:
            clips = select(ds, json.load(f))
        if only_surahs:
            clips = [c for c in clips if c['surah'] in only_surahs]
        takes = plan_takes(ds, clips, args, rec)
        if args.limit:
            takes = takes[:args.limit]
        for ti, t in enumerate(takes):
            t['index'] = ti
            if args.control:
                t['control'] = args.control
        plans[ds] = takes
        print('%s: %d clips -> %d takes' % (ds, len(clips), len(takes)), flush=True)

    # Place every lead-in, bridge and control reading on its reciter's timings.
    need = defaultdict(list)  # (reciter, surah) -> [(ds, take index, part index)]
    for ds, takes in plans.items():
        for ti, t in enumerate(takes):
            for pi, part in enumerate(t['parts']):
                kind, req = part[0], part[1]
                if kind == 'lead':
                    rid = args.reciter
                    _, verses = rec.timings(req['surah'])
                    if req.get('bridge'):
                        p = bridge_plan(verses, nwords, req['surah'], req['from'], req['to'])
                    else:
                        p = lead_plan(verses, nwords, req['surah'], req['ayah'], req['word'])
                elif kind == 'expert':
                    rid = args.control
                    _, verses = reciters[rid].timings(req['surah'])
                    p = span_plan(verses, req['surah'], req['a0'], req['w0'], req['a1'], req['w1'])
                else:
                    continue
                req['plan'] = p
                if isinstance(p, tuple):
                    need[(rid, req['surah'])].append((ds, ti, pi))
    failed = [(ds, t['id'], p[1]['plan']) for ds, takes in plans.items() for t in takes
              for p in t['parts'] if p[0] in ('lead', 'expert') and not isinstance(p[1]['plan'], tuple)]
    for f_ in failed:
        print('no lead-in: %s %s (%s)' % f_, flush=True)

    # A take is written as soon as all its pieces are cut (its entry is kept
    # next to the audio, so a rerun skips it); lead-ins are cut surah by
    # surah, so only one surah's audio is on disk at a time.
    entries = {ds: {} for ds in plans}
    waiting = {}
    for ds, takes in plans.items():
        os.makedirs(os.path.join(out, ds, 'audio'), exist_ok=True)
        for ti, t in enumerate(takes):
            apath = os.path.join(out, ds, 'audio', take_name(t['id']))
            if os.path.exists(apath) and os.path.exists(apath + '.json'):
                with open(apath + '.json', encoding='utf-8') as f:
                    entries[ds][ti] = json.load(f)
                continue
            leads = {pi for pi, p in enumerate(t['parts']) if p[0] in ('lead', 'expert')}
            if any(not isinstance(t['parts'][pi][1]['plan'], tuple) for pi in leads):
                continue
            waiting[(ds, ti)] = leads
    pieces = {}
    for (ds, ti), leads in list(waiting.items()):
        if not leads:
            entries[ds][ti] = assemble(out, ds, plans[ds][ti], {}, nwords, args.reciter)
            del waiting[(ds, ti)]
    todo = defaultdict(list)
    for s_, keys in need.items():
        for key in keys:
            if (key[0], key[1]) in waiting:
                todo[s_].append(key)
    for rid, s in sorted(todo):
        reuse = os.path.join(OUT, 'audio_%d_%d.f32' % (rid, s))
        if os.path.exists(reuse):
            path, tmp = reuse, None
        else:
            path, tmp = reciters[rid].audio(s)
        total = f32_len(path)
        for key in todo[(rid, s)]:
            ds, ti, pi = key
            kind, req = plans[ds][ti]['parts'][pi][:2]
            start, cut = req['plan'][:2]
            if not args.no_refine:
                cut = quietest(path, cut, total)
                if kind == 'expert' and (req['a0'], req['w0']) != (1, 1):
                    start = quietest(path, start, total)
            a, b = int(start * SR), min(total, int(cut * SR))
            pieces[key] = read_f32(path, a, b - a)
            req['plan'] = (start, cut) + tuple(req['plan'][2:])
            waiting[(ds, ti)].discard(pi)
            if not waiting[(ds, ti)]:
                own = {k: pieces.pop(k) for k in list(pieces) if k[:2] == (ds, ti)}
                entries[ds][ti] = assemble(out, ds, plans[ds][ti], own, nwords, args.reciter)
                del waiting[(ds, ti)]
        if tmp:
            shutil.rmtree(tmp, ignore_errors=True)
        print('reciter %d surah %d: %d pieces' % (rid, s, len(todo[(rid, s)])), flush=True)
    shutil.rmtree(os.path.join(out, '_tmp'), ignore_errors=True)

    for ds, takes in plans.items():
        done = [entries[ds][ti] for ti in range(len(takes)) if ti in entries[ds]]
        with open(os.path.join(out, ds, 'manifest.json'), 'w', encoding='utf-8') as f:
            json.dump(done, f, ensure_ascii=False)
        lead = sorted(g['end'] - g['start'] for e in done for g in e['segments']
                      if g['lead'] and not g.get('bridge'))
        learn = sum(g['end'] - g['start'] for e in done for g in e['segments'] if not g['lead'])
        print('%s: %d takes, %.1f learner min, %d lead-ins (median %.1f s, max %.1f s, %d under %.0f s), '
              '%d bridges, %d cold, %.1f min audio'
              % (ds, len(done), learn / 60, len(lead), lead[len(lead) // 2] if lead else 0,
                 lead[-1] if lead else 0, sum(1 for e in done for g in e['segments'] if g.get('shortLead')),
                 LEAD_MIN, sum(1 for e in done for g in e['segments'] if g.get('bridge')),
                 sum(1 for e in done if e.get('cold')), sum(e['seconds'] for e in done) / 60), flush=True)


def reciter_of(t):
    return t.get('control')


def assemble(out, ds, t, pieces, nwords, reciter):
    """Writes one take's audio and returns its manifest entry."""
    parts = t['parts']
    clip_audio = {pi: read_f32(p[1]['audio']) for pi, p in enumerate(parts) if p[0] == 'clip'}
    clip_audio.update({pi: pieces[(ds, t['index'], pi)] for pi, p in enumerate(parts) if p[0] == 'expert'})
    level = None
    if any(p[0] == 'lead' for p in parts):
        level = active_rms(array('f', [v for x in clip_audio.values() for v in x]))
    buf = array('f')
    segs = []
    hint = t['hint']
    for pi, part in enumerate(parts):
        kind, item = part[0], part[1]
        t0 = len(buf) / SR
        if kind == 'gap':
            buf.extend(silence(item))
            continue
        if kind == 'clip':
            x = fade(array('f', clip_audio[pi]))
            seg = learner_segment(item, nwords)
            seg.update(part[2])
        elif kind == 'expert':
            x = fade(array('f', clip_audio[pi]))
            c = item['clip']
            seg = {'clipId': c['id'], 'lead': False, 'label': 'correct', 'control': reciter_of(t),
                   'surah': item['surah'], 'ayahStart': item['a0'], 'ayahEnd': item['a1'],
                   'wordStart': item['w0'], 'wordEnd': item['w1'],
                   'sourceStart': round(item['plan'][0], 3), 'sourceEnd': round(item['plan'][1], 3)}
            seg.update(part[2])
        else:
            x = pieces[(ds, t['index'], pi)]
            lvl = active_rms(x)
            gain = min(10.0, max(0.1, level / lvl)) if lvl > 0 and level > 0 else 1.0
            x = fade(array('f', (v * gain for v in x)))
            start, cut, first, last_a, last_w = item['plan']
            seg = {'clipId': None, 'lead': True, 'label': 'expert', 'reciter': reciter,
                   'surah': item['surah'], 'ayahStart': first, 'ayahEnd': last_a,
                   'wordStart': 1, 'wordEnd': last_w, 'sourceStart': round(start, 3),
                   'sourceEnd': round(cut, 3), 'gain': round(gain, 3)}
            if item.get('bridge'):
                seg['bridge'] = True
            elif cut - start < LEAD_MIN:
                seg['shortLead'] = True
            if hint is None:
                hint = {'surah': item['surah'], 'ayah': first}
        buf.extend(x)
        seg['start'] = round(t0, 3)
        seg['end'] = round(len(buf) / SR, 3)
        segs.append(seg)
    buf.extend(silence(TAIL))
    apath = os.path.join(out, ds, 'audio', take_name(t['id']))
    with open(apath, 'wb') as f:
        f.write(buf.tobytes())
    learner = [g for g in segs if not g['lead']]
    labels = {g['label'] for g in learner}
    entry = {'id': t['id'], 'audio': apath, 'hint': hint, 'seconds': round(len(buf) / SR, 3),
             'label': labels.pop() if len(labels) == 1 else 'mixed', 'segments': segs}
    if t.get('cold'):
        entry['cold'] = True
    with open(apath + '.json', 'w', encoding='utf-8') as f:
        json.dump(entry, f, ensure_ascii=False)
    return entry


if __name__ == '__main__':
    sys.exit(main())
