#!/usr/bin/env python3
"""Vowel (tashkeel) checker bench, stage 0.

Can an offline phoneme model flag wrong short vowels in recitation without
false alarms on correct recitation? This bench measures it.

Run with the bench venv's python and -I (isolated mode), from anywhere:

  python -I vowel_bench.py refcheck     # reference pack, word-mapping checks
  python -I vowel_bench.py segment      # cut the clean recitations into ayat
  python -I vowel_bench.py decode --model teacher --set clean
  python -I vowel_bench.py score        # rules, thresholds, metrics -> results.json
  python -I vowel_bench.py speed        # latency and memory per ayah

Setup (all inside .out/, which git ignores):

  .out/vowel/venv     python 3.12 venv: pip install quran-muaalem==0.3.0
                      "transformers>=4.55,<5" (the package's model code does
                      not import under transformers 5)
  .out/vowel/models/teacher  the Muaalem v3.2 model (606M parameters, the
                             quran-muaalem package's default): its json files
                             and model.safetensors
  .out/vowel/models/mini     the HifzGuide distilled Muaalem student (116M,
                             phoneme head only): json files and model.safetensors
  .out/vowel/models/SOURCES.json  exact repositories, revisions and SHA-256

Models are loaded from safetensors only, with the model class shipped in the
quran-muaalem package. No remote code, no pickle files. The package's code is
under its own licence (QML-1.0): internal evaluation only, never shipped.

References come from quran-transcript's phonetizer (Hafs, default madd
lengths of the quran-muaalem app, waqf at the end of each reference span),
mapped to the app's mushaf word numbers (data/quran.json, words by space,
1-based) and checked by exact skeleton match.

Clean recitations (.out/audio_<reciter>_<surah>.f32 and Quran.com timings in
.out/runs/) are cut into ayat: the Quran.com timing gives the search window,
a CTC alignment of the ayah's reference against the teacher's output finds
the ayah, and the cut goes into the nearest pause found from the audio
energy. A side with no pause is marked as cut, and its edge word is skipped.

The rule ("swap-only"): flag a word only when the decode commits a different
short vowel (fatha, damma or kasra) on a consonant that was heard correctly,
in a word whose consonants were all heard correctly, and when the next
consonant was heard too (otherwise the vowel may be that consonant's). Empty
vowel slots are never flagged, nor is the waqf-final letter. Variants: one
decode, or the same swap in two decodes 20 ms apart; with or without case
endings. The threshold is on the margin p(heard vowel) - p(expected vowel);
the operating point is the lowest threshold that meets the gate (1 false flag
per 1,000 words) on clean recitation, pooled, and again for every reciter.
Also reported: the same flags read from quran-transcript's explain_error,
dropped vowels and vowels on a sukun (diagnostics, never flagged), and
whether each qalqala was heard.

Output: .out/vowel/results.json (all metrics), events/ (per-item vowel events),
decodes/ (frame outputs), segments/ (ayah cuts), ref/ (reference pack and
mapping checks), speed.json. Nothing from the datasets is written outside .out/.
"""
import argparse
import json
import math
import os
import re
import subprocess
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
OUT = HERE / '.out'
VOUT = OUT / 'vowel'
REPO = HERE.parent.parent
QURAN_JSON = REPO / 'data' / 'quran.json'
MODEL_DIRS = {'teacher': VOUT / 'models' / 'teacher', 'mini': VOUT / 'models' / 'mini'}
SR = 16000
FRAME = 0.04          # model output frame: 20 ms features, stride-2 adapter
SHIFT_B = 0.02        # the second window offset: half an output frame
MOSHAF = dict(rewaya='hafs', madd_monfasel_len=4, madd_mottasel_len=4,
              madd_mottasel_waqf=4, madd_aared_len=4)
LEARNER_SETS = ['al-ikhlas', 'retasy', 'sobolev-errors', 'quranmb']
CLEAN_SURAHS = [67, 78, 36, 55, 89]
TANWEEN = set('\u064b\u064c\u064d\u08f0\u08f1\u08f2\u06e2\u06ed')  # tanween, and the small meem marks on it
DIGITS = set('0123456789\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669'
             '\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9')


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def jdump(obj, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def jload(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


# ---------------------------------------------------------------- alphabet

class Alpha:
    """Quran phonetic script symbols, from quran-transcript itself."""

    def __init__(self):
        from quran_transcript import alphabet as alph
        ph, phg = alph.phonetics, alph.phonetic_groups
        self.core = phg.core
        self.resid = phg.residuals
        self.harakat = phg.harakat            # fatha, damma, kasra
        self.vowels = [ph.fatha, ph.dama, ph.kasra]
        self.vname = {ph.fatha: 'fatha', ph.dama: 'damma', ph.kasra: 'kasra'}
        self.madd = ph.alif + ph.yaa_madd + ph.waw_madd
        self.qalqala = ph.qlqla
        core_group = '|'.join(f'{c}+' for c in phg.core)   # as chunck_phonemes
        self.group_re = re.compile(f'((?:{core_group})[{phg.residuals}]?)')

    def groups(self, s):
        """chunck_phonemes with positions: (i0, i1, base, count, residual)."""
        out = []
        for m in self.group_re.finditer(s):
            g = m.group(1)
            res = g[-1] if g[-1] in self.resid else ''
            core = g[:len(g) - len(res)]
            out.append((m.start(1), m.end(1), core[0], len(core), res))
        return out


_ALPHA = None


def alpha():
    global _ALPHA
    if _ALPHA is None:
        _ALPHA = Alpha()
    return _ALPHA


# ------------------------------------------------------- mushaf word mapping

_SKEL = {chr(c): chr(c) for c in range(0x0621, 0x064B)}
_SKEL.update({c: '\u0627' for c in '\u0623\u0625\u0622\u0671'})
_SKEL.update({'\u0624': '\u0648', '\u0626': '\u064a', '\u0649': '\u064a', '\u0629': '\u0647',
              '\u0621': '', '\u0640': ''})


def skel(word):
    """Letter skeleton used to check that two scripts spell the same word."""
    return ''.join(_SKEL.get(ch, '') for ch in word)


def mushaf_words(text):
    """Words by (regular) space in the app's mushaf text. The ayah number is
    joined to the last word by a no-break space, and a rub el hizb sign to
    the first word the same way; neither is a word."""
    toks = text.split(' ')
    last = toks[-1].split('\u00a0')
    if len(last) > 1 and all(c in DIGITS for c in last[-1]):
        toks[-1] = '\u00a0'.join(last[:-1])
    elif all(c in DIGITS for c in toks[-1]):
        toks.pop()
    first = toks[0].split('\u00a0')
    if len(first) == 2 and first[0] == '\u06de':
        toks[0] = first[1]
    if any(c in DIGITS or c == '\u00a0' or c == '\u06de' for t in toks for c in t) or '' in toks:
        raise ValueError('unexpected mark left inside a word')
    return toks


def map_words(qw, kw):
    """For each quran-transcript word, the 0-based mushaf word it belongs to.
    Consecutive words merge only when their joined skeleton equals one mushaf
    word; anything else raises."""
    out, i, j = [], 0, 0
    while i < len(qw) and j < len(kw):
        target = skel(kw[j])
        acc, k = skel(qw[i]), i + 1
        while acc != target and k < len(qw) and len(acc) < len(target):
            acc += skel(qw[k])
            k += 1
        if acc != target:
            raise ValueError(f'word {j + 1}: skeletons differ')
        out += [j] * (k - i)
        i, j = k, j + 1
    if i != len(qw) or j != len(kw):
        raise ValueError(f'word counts differ: {len(qw)} vs {len(kw)}')
    return out


class Refs:
    """Reference phonetic strings per span, with each phoneme group mapped to
    its mushaf word (1-based)."""

    def __init__(self, quran_json=QURAN_JSON):
        from quran_transcript import Aya, MoshafAttributes, quran_phonetizer
        from quran_transcript.phonetics.error_explainer import extract_ref_phonetic_to_uthmani
        self.Aya, self.phonetize = Aya, quran_phonetizer
        self.ph2uth = extract_ref_phonetic_to_uthmani
        self.moshaf = MoshafAttributes(**MOSHAF)
        q = jload(quran_json)
        self.kfg = {v['verse_key']: mushaf_words(v['text']) for v in q.values()}
        self._ayah, self._cache = {}, {}

    def ayah(self, s, a):
        if (s, a) not in self._ayah:
            f = self.Aya(s, a).get()
            qw = f.uthmani.split()
            kw = self.kfg[f'{s}:{a}']
            self._ayah[(s, a)] = (qw, kw, map_words(qw, kw))
        return self._ayah[(s, a)]

    def build(self, s, a, w0=None, w1=None):
        """Mushaf words w0..w1 (1-based, inclusive) of s:a; whole ayah by
        default. Waqf form at the end of the span."""
        key = (s, a, w0, w1)
        if key in self._cache:
            return self._cache[key]
        A = alpha()
        qw, kw, m = self.ayah(s, a)
        w0 = w0 or 1
        w1 = w1 or len(kw)
        idx = [i for i, j in enumerate(m) if w0 - 1 <= j <= w1 - 1]
        text = ' '.join(qw[i] for i in idx)
        word_of_char, wi = [], 0
        for ch in text:
            if ch == ' ':
                word_of_char.append(-1)
                wi += 1
            else:
                word_of_char.append(m[idx[wi]] + 1)
        out = self.phonetize(text, self.moshaf, remove_spaces=True, sura_idx=s)
        ph = out.phonemes
        p2u = self.ph2uth(out.mappings)
        if sorted(p2u) != list(range(len(ph))):
            raise ValueError('phoneme to text mapping is incomplete')
        pw = [word_of_char[p2u[p]] for p in range(len(ph))]
        if min(pw) < 1 or any(b < a_ for a_, b in zip(pw, pw[1:])):
            raise ValueError('phoneme words are not in order')
        groups = []
        for i0, i1, base, n, res in A.groups(ph):
            groups.append(dict(i0=i0, i1=i1, base=base, n=n, res=res, w=pw[i1 - 1],
                               madd=base in A.madd, src=text[p2u[i0]]))
        if ''.join(ph[g['i0']:g['i1']] for g in groups) != ph:
            raise ValueError('phoneme groups do not cover the string')
        final = max(i for i, g in enumerate(groups) if not g['madd'])
        # the group carrying each word's case ending: its last consonant,
        # not counting madd letters or the noon sound of a tanween
        last_v = {}
        for i, g in enumerate(groups):
            if not g['madd'] and not (g['res'] == '' and g['src'] in TANWEEN):
                last_v[g['w']] = i
        word_ph = defaultdict(str)
        for p, w in enumerate(pw):
            word_ph[w] += ph[p]
        ref = dict(s=s, a=a, w0=w0, w1=w1, text=text, ph=ph, mappings=out.mappings,
                   groups=groups, final=final, last_v=last_v, words=list(range(w0, w1 + 1)),
                   word_ph={w: word_ph.get(w, '') for w in range(w0, w1 + 1)},
                   word_of_char=word_of_char)
        if ''.join(ref['word_ph'][w] for w in ref['words']) != ph:
            raise ValueError('per-word phonemes do not rebuild the span')
        self._cache[key] = ref
        return ref


# ------------------------------------------------------------------- model

class Model:
    def __init__(self, name, device='mps', threads=4):
        import torch
        from transformers import AutoFeatureExtractor
        from quran_muaalem.modeling.modeling_multi_level_ctc import Wav2Vec2BertForMultilevelCTC
        torch.set_num_threads(threads)
        path = MODEL_DIRS[name]
        risky = [p.name for p in path.iterdir() if p.suffix in ('.bin', '.pt', '.pth', '.pkl', '.ckpt', '.py')]
        if risky:
            raise SystemExit(f'refusing to load: {risky} in {path}')
        self.torch, self.name, self.device = torch, name, device
        self.model = Wav2Vec2BertForMultilevelCTC.from_pretrained(str(path), use_safetensors=True)
        self.model.eval().to(device, dtype=torch.float32)
        self.fe = AutoFeatureExtractor.from_pretrained(str(path))
        if (path / 'vocab.json').exists():
            v = jload(path / 'vocab.json')['phonemes']
            self.id2ch = [None] * len(v)
            for ch, i in v.items():
                self.id2ch[i] = ch
        else:
            self.id2ch = jload(path / 'phoneme_vocab.json')['id_to_char']
        self.id2ch[0] = ''
        self.ch2id = {c: i for i, c in enumerate(self.id2ch) if c}
        A = alpha()
        self.vid = [self.ch2id[v] for v in A.vowels]
        self.levels = list(self.model.level_to_lm_head.keys())
        self.n_params = sum(p.numel() for p in self.model.parameters())

    def run(self, wave):
        """Frame log-probs of the phoneme head, and P(qalqala) per frame
        from the sifat head when the model has one."""
        torch = self.torch
        feats = self.fe(np.asarray(wave, dtype=np.float32), sampling_rate=SR, return_tensors='pt')
        x = feats['input_features'].to(self.device, dtype=torch.float32)
        m = feats['attention_mask'].to(self.device)
        with torch.no_grad():
            out = self.model(input_features=x, attention_mask=m, return_dict=False)[0]
            lp = torch.log_softmax(out['phonemes'].float(), -1)[0].cpu().numpy()
            q = None
            if 'qalqla' in out:
                q = torch.softmax(out['qalqla'].float(), -1)[0, :, 1].cpu().numpy()
        return lp, q


# --------------------------------------------------------- segmentation

def read_pcm(path):
    return np.fromfile(path, dtype='<f4')


def timings_path(rid, surah):
    p = OUT / 'runs' / f'qdc_{rid}_{surah}.json'
    if surah == 67 and (OUT / 'runs' / f'qdc_{rid}.json').exists():
        p = OUT / 'runs' / f'qdc_{rid}.json'
    return p


def clean_files():
    """(reciter, surah) pairs with both audio and timings present."""
    out = []
    for p in sorted(OUT.glob('audio_*_*.f32')):
        parts = p.stem.split('_')
        if len(parts) != 3:
            continue
        rid, surah = parts[1], int(parts[2])
        if timings_path(rid, surah).exists():
            out.append((rid, surah))
    return out


def file_logprobs(model, pcm, win=30.0, hop=24.0, guard=3.0):
    """Teacher log-probs for a whole recitation, in overlapping windows."""
    n = len(pcm)
    total = int(math.ceil(n / SR / FRAME)) + 2
    out = np.full((total, len(model.id2ch)), -30.0, np.float32)
    end_f, start = 0, 0.0
    while True:
        a, b = int(start * SR), min(n, int((start + win) * SR))
        lp, _ = model.run(pcm[a:b])
        f0 = int(round(start / FRAME))
        last = b >= n
        k0 = 0 if start == 0 else int(round(guard / FRAME))
        k1 = lp.shape[0] if last else min(lp.shape[0], int(round((win - guard) / FRAME)))
        k1 = min(k1, total - f0)
        out[f0 + k0:f0 + k1] = lp[k0:k1]
        end_f = f0 + k1
        if last:
            break
        start += hop
    return out[:end_f]


def compress_labels(ids):
    """Runs of one symbol (madd counts, ghunna, shadda) become one label that
    may be emitted any number of times, so reciters' madd lengths fit."""
    labels, rep = [], []
    for i in ids:
        if labels and labels[-1] == i:
            rep[-1] = True
        else:
            labels.append(i)
            rep.append(False)
    return labels, rep


def local_align(lp, labels, prior, rep=None):
    """CTC Viterbi of `labels` against a stretch of frames, free to start and
    end anywhere. prior[t] is added when the first label starts at frame t.
    rep[k]: label k may be emitted again after a blank.
    Returns (log-prob of the path without the prior, first frame, last frame)."""
    T, N = lp.shape[0], len(labels)
    S = 2 * N + 1
    ext = np.zeros(S, np.int64)
    ext[1::2] = labels
    skip = np.zeros(S, bool)
    lab = np.asarray(labels)
    skip[3::2] = lab[1:] != lab[:-1]
    back = np.zeros(S, bool)
    if rep is not None:
        back[1::2] = rep
    E = lp[:, ext]
    NEG = -1e18
    alpha_, st = np.full(S, NEG), np.zeros(S, np.int64)
    best, span = NEG, None
    p1, p2, p3 = np.full(S, NEG), np.full(S, NEG), np.full(S, NEG)
    s1, s2, s3 = np.zeros(S, np.int64), np.zeros(S, np.int64), np.zeros(S, np.int64)
    for t in range(T):
        p1[1:] = alpha_[:-1]
        p2[2:] = np.where(skip[2:], alpha_[:-2], NEG)
        p3[:-1] = np.where(back[:-1], alpha_[1:], NEG)
        s1[1:] = st[:-1]
        s2[2:] = st[:-2]
        s3[:-1] = st[1:]
        new, ns = alpha_.copy(), st.copy()
        m = p1 > new
        new[m], ns[m] = p1[m], s1[m]
        m = p2 > new
        new[m], ns[m] = p2[m], s2[m]
        m = p3 > new
        new[m], ns[m] = p3[m], s3[m]
        if prior[t] > new[1]:
            new[1], ns[1] = prior[t], t
        alpha_, st = new + E[t], ns
        if alpha_[S - 2] > best:
            best, span = alpha_[S - 2], (int(st[S - 2]), t)
    if span is None:
        return None
    return float(best - prior[span[0]]), span[0], span[1]


def energy_db(pcm):
    hop = 160
    n = len(pcm) // hop
    e = 10 * np.log10((pcm[:n * hop].reshape(n, hop).astype(np.float64) ** 2).mean(1) + 1e-10)
    return np.convolve(e, np.ones(5) / 5, mode='same')


def low_runs(low, i0, i1, min_len):
    i0, i1 = max(0, i0), min(len(low), i1)
    runs, i = [], i0
    while i < i1:
        if low[i]:
            j = i
            while j < i1 and low[j]:
                j += 1
            if j - i >= min_len:
                runs.append((i, j))
            i = j
        else:
            i += 1
    return runs


def segment_file(model, refs, rid, surah):
    pcm = read_pcm(OUT / f'audio_{rid}_{surah}.f32')
    vt = jload(timings_path(rid, surah))['audio_files'][0]['verse_timings']
    dur = len(pcm) / SR
    lp = file_logprobs(model, pcm)
    db = energy_db(pcm)
    floor, speech = np.percentile(db, 3), np.percentile(db, 90)
    thr = floor + 0.35 * (speech - floor)
    low = db < thr
    segs, prev_end, deltas = [], 0.0, []
    for v in vt:
        s, a = map(int, v['verse_key'].split(':'))
        ref = refs.build(s, a)
        labels, rep = compress_labels([model.ch2id[c] for c in ref['ph']])
        t_from, t_to = v['timestamp_from'] / 1000, v['timestamp_to'] / 1000
        delta = float(np.median(deltas[-3:])) if deltas else 0.0
        guess = max(prev_end, t_from + delta)
        got = None
        for margin, lam in ((4.0, 1.0), (12.0, 0.3)):
            w0 = max(prev_end - 0.5, guess - margin, 0.0)
            w1 = min(dur, guess + (t_to - t_from) * 1.6 + margin)
            f0, f1 = int(w0 / FRAME), min(lp.shape[0], int(w1 / FRAME))
            if f1 - f0 < len(labels):
                continue
            tt = np.arange(f0, f1) * FRAME
            r = local_align(lp[f0:f1], labels, -lam * np.abs(tt - guess), rep)
            if r is None:
                continue
            score, a0, a1 = r
            per = score / (a1 - a0 + 1)
            got = (score, (f0 + a0) * FRAME, (f0 + a1 + 1) * FRAME, per, margin)
            if per > -1.0:
                break
        if got is None:
            segs.append(dict(key=f'{s}:{a}', s=s, a=a, ok=False, why='no alignment'))
            continue
        score, a_start, a_end, per, margin = got
        ok = per > -1.0
        segs.append(dict(key=f'{s}:{a}', s=s, a=a, a_start=round(a_start, 3), a_end=round(a_end, 3),
                         per_frame=round(per, 4), window=margin, timing_from=t_from, timing_to=t_to, ok=ok))
        if ok:  # a failed ayah must not steer the search for the next one
            deltas.append(a_start - t_from)
            prev_end = a_end
    # cut points at pauses
    good = [g for g in segs if g.get('ok')]
    for k, g in enumerate(good):
        prev_e = good[k - 1]['a_end'] if k else 0.0
        next_s = good[k + 1]['a_start'] if k + 1 < len(good) else dur
        i_s = int(g['a_start'] * 100)
        runs = low_runs(low, max(int((g['a_start'] - 1.2) * 100), int(prev_e * 100) + 4), i_s - 4, 12)
        if runs:
            r0, r1 = runs[-1]
            cs, clean_s = max(r0, r1 - 25) / 100, True
        else:
            cs, clean_s = max(prev_e, g['a_start'] - 0.3, 0.0), False
        i_e = int(g['a_end'] * 100)
        runs = low_runs(low, i_e + 4, min(int((g['a_end'] + 1.5) * 100), int(next_s * 100) - 4), 15)
        if runs:
            r0, r1 = runs[0]
            ce, clean_e = min(r1, r0 + 25) / 100, True
        else:
            ce, clean_e = min(dur, next_s, g['a_end'] + 0.5), False
        if k and g['a_start'] - prev_e < 0.2:
            clean_s = False
        if k + 1 < len(good) and next_s - g['a_end'] < 0.2:
            clean_e = False
        g.update(start=round(cs, 3), end=round(ce, 3), clean_start=clean_s, clean_end=clean_e)
    return dict(rid=rid, surah=surah, dur=dur, thr_db=round(float(thr), 1), segments=segs)


# ------------------------------------------------------------ item sets

def clean_items(files=None):
    items = []
    for rid, surah in (files or clean_files()):
        p = VOUT / 'segments' / f'{rid}_{surah}.json'
        if not p.exists():
            continue
        seg = jload(p)
        for g in seg['segments']:
            if not g.get('ok') or 'start' not in g:
                continue
            items.append(dict(id=f'{rid}_{g["key"]}', audio=str(OUT / f'audio_{rid}_{surah}.f32'),
                              start=g['start'], end=g['end'], s=g['s'], a=g['a'], w0=None, w1=None,
                              skip_first=not g['clean_start'], skip_last=not g['clean_end'],
                              group=rid, label='correct', align=g['per_frame']))
    return items


def learner_items(name):
    man = jload(OUT / 'datasets' / name / 'manifest.json')
    items = []
    for x in man:
        if x.get('surah') is None or x.get('ayahStart') is None:
            continue
        if x.get('ayahStart') != x.get('ayahEnd'):
            continue
        if name == 'retasy' and x['label'] not in ('correct', 'incorrect'):
            continue
        if name == 'quranmb' and (x.get('annotationSuspect') or x.get('duplicateOf')):
            continue
        items.append(dict(id=x['id'], audio=x['audio'], start=None, end=None, s=x['surah'],
                          a=x['ayahStart'], w0=x.get('wordStart'), w1=x.get('wordEnd'),
                          skip_first=False, skip_last=False, group=None, label=x['label']))
    return items


def items_for(set_name):
    return clean_items() if set_name == 'clean' else learner_items(set_name)


# ---------------------------------------------------------------- decode

def decode_set(model, refs, set_name, out_dir):
    items = items_for(set_name)
    log(f'{set_name}: {len(items)} items with {model.name}')
    store = {k: dict(am=[], pv=[], pq=[], off=[0]) for k in ('A', 'B')}
    kept, pcm_cache = [], {}
    t0 = time.time()
    audio_sec = 0.0
    for n, it in enumerate(items):
        try:
            refs.build(it['s'], it['a'], it['w0'], it['w1'])
        except Exception as e:  # noqa: BLE001
            it['ref_error'] = str(e)[:200]
            continue
        if it['start'] is None:
            pcm = read_pcm(it['audio'])
            wa, wb = pcm, pcm[int(SHIFT_B * SR):]
        else:
            if it['audio'] not in pcm_cache:
                pcm_cache.clear()
                pcm_cache[it['audio']] = read_pcm(it['audio'])
            pcm = pcm_cache[it['audio']]
            a, b = int(it['start'] * SR), int(it['end'] * SR)
            sh = int(SHIFT_B * SR)
            wa, wb = pcm[a:b], pcm[a + sh:min(len(pcm), b + sh)]
        if len(wa) < SR * 0.3:
            it['ref_error'] = 'audio too short'
            continue
        audio_sec += len(wa) / SR
        for k, w in (('A', wa), ('B', wb)):
            lp, q = model.run(w)
            p = np.exp(lp)
            st = store[k]
            st['am'].append(lp.argmax(-1).astype(np.uint8))
            st['pv'].append(p[:, model.vid].astype(np.float16))
            st['pq'].append((q if q is not None else np.zeros(len(lp))).astype(np.float16))
            st['off'].append(st['off'][-1] + len(lp))
        it['dur'] = round(len(wa) / SR, 3)
        kept.append(it)
        if (n + 1) % 200 == 0:
            el = time.time() - t0
            log(f'  {n + 1}/{len(items)}  {el:.0f}s  RTF {el / max(audio_sec, 1e-9) / 2:.3f}')
    out_dir.mkdir(parents=True, exist_ok=True)
    arrays = {}
    for k, st in store.items():
        arrays[f'am_{k}'] = np.concatenate(st['am']) if st['am'] else np.zeros(0, np.uint8)
        arrays[f'pv_{k}'] = np.concatenate(st['pv']) if st['pv'] else np.zeros((0, 3), np.float16)
        arrays[f'pq_{k}'] = np.concatenate(st['pq']) if st['pq'] else np.zeros(0, np.float16)
        arrays[f'off_{k}'] = np.asarray(st['off'], np.int64)
    np.savez_compressed(out_dir / f'{set_name}.npz', **arrays)
    jdump(dict(model=model.name, set=set_name, id2ch=model.id2ch, items=kept,
               skipped=[it for it in items if 'ref_error' in it],
               audio_sec=round(audio_sec, 1), wall_sec=round(time.time() - t0, 1)),
          out_dir / f'{set_name}.json')
    log(f'{set_name}: kept {len(kept)}, audio {audio_sec / 60:.1f} min, {time.time() - t0:.0f}s')


# ------------------------------------------------------------- the rule

def token_runs(am):
    """Greedy CTC: (id, first frame, end frame) per emitted token."""
    if len(am) == 0:
        return []
    ch = np.flatnonzero(am[1:] != am[:-1]) + 1
    st, en = np.r_[0, ch], np.r_[ch, len(am)]
    return [(int(am[s]), int(s), int(e)) for s, e in zip(st, en) if am[s] != 0]


def align_groups(rg, pg):
    """Phoneme groups aligned in two passes. Whole groups (letter and vowel)
    first, so repeated or merged material anchors on exact matches; then, in
    each block that did not match, by letter only. Returns opcodes whose
    'equal' pairs share a letter."""
    import Levenshtein
    codes = {}

    def code(k):
        if k not in codes:
            codes[k] = chr(0xE000 + len(codes))
        return codes[k]
    rs = ''.join(code((g['base'], g['res'])) for g in rg)
    ps = ''.join(code((g[2], g[4])) for g in pg)
    out = []
    for op, i1, i2, j1, j2 in Levenshtein.opcodes(rs, ps):
        if op == 'equal':
            out.append((op, i1, i2, j1, j2))
            continue
        rb = ''.join(rg[i]['base'] for i in range(i1, i2))
        pb = ''.join(pg[j][2] for j in range(j1, j2))
        for op2, a1, a2, b1, b2 in Levenshtein.opcodes(rb, pb):
            out.append((op2, i1 + a1, i1 + a2, j1 + b1, j1 + b2))
    return out


def analyze(ref, am, pv, id2ch, skip_words=(), align='groups'):
    """Align a decode to its reference by phoneme group and list the vowel
    events. A word is 'ok' when all of its consonant groups were heard
    (madd letters aside). Events:
      swap  a different short vowel committed on a heard consonant
      drop  the expected short vowel slot is empty (never flagged)
      add   a short vowel on a letter the reference has without one
      qal   a qalqala site: heard or not (tajweed signal)
    A swap is marked ambiguous ('amb') when the next consonant of the
    reference was not heard: the decode may have moved that consonant's
    vowel onto this one. The waqf-final letter gets no vowel events;
    skip_words get none at all. align='letters' is the first version
    (letters-only alignment, no ambiguity guard), kept for comparison."""
    import Levenshtein
    A = alpha()
    toks = token_runs(am)
    pred = ''.join(id2ch[t[0]] for t in toks)
    pg = A.groups(pred)
    rg = ref['groups']
    if align == 'letters':
        ops = Levenshtein.opcodes(''.join(g['base'] for g in rg), ''.join(g[2] for g in pg))
    else:
        ops = align_groups(rg, pg)
    pairs, bad = [], set()
    for op, i1, i2, j1, j2 in ops:
        if op == 'equal':
            pairs += list(zip(range(i1, i2), range(j1, j2)))
            continue
        cons = any(not rg[i]['madd'] for i in range(i1, i2)) or any(pg[j][2] not in A.madd for j in range(j1, j2))
        if not cons:
            continue
        if op in ('replace', 'delete'):
            bad |= {rg[i]['w'] for i in range(i1, i2)}
        elif 0 < i1 < len(rg) and rg[i1 - 1]['w'] == rg[i1]['w']:
            bad.add(rg[i1]['w'])          # a consonant inserted inside a word
    paired = {ri for ri, _ in pairs}
    next_cons, nx = [None] * len(rg), None
    for i in range(len(rg) - 1, -1, -1):
        next_cons[i] = nx
        if not rg[i]['madd']:
            nx = i
    vix = {v: k for k, v in enumerate(A.vowels)}
    T = len(am)
    events = []
    for ri, pi in pairs:
        r, p = rg[ri], pg[pi]
        w = r['w']
        if w in skip_words:
            continue
        ev = None
        rv = r['res'] if r['res'] in A.harakat else ''
        hv = p[4] if p[4] in A.harakat else ''
        if r['res'] == A.qalqala:
            ev = dict(t='qal', heard=p[4] == A.qalqala, vowel=bool(hv))
        elif ri >= ref['final']:
            continue
        elif rv and hv and rv != hv:
            f0, f1 = toks[p[1] - 1][1], toks[p[1] - 1][2]
            pc = float(pv[f0:f1, vix[hv]].max())
            pr = float(pv[max(0, f0 - 2):min(T, f1 + 2), vix[rv]].max())
            ev = dict(t='swap', margin=round(pc - pr, 4), pc=round(pc, 4), pr=round(pr, 4),
                      amb=align != 'letters' and next_cons[ri] is not None and next_cons[ri] not in paired)
        elif rv and not hv:
            f0 = toks[p[1] - 1][1]
            f1 = toks[p[1]][1] + 1 if p[1] < len(toks) else T
            ev = dict(t='drop', pr=round(float(pv[f0:f1, vix[rv]].max()), 4))
        elif not rv and hv and not r['madd']:
            f0, f1 = toks[p[1] - 1][1], toks[p[1] - 1][2]
            ev = dict(t='add', pc=round(float(pv[f0:f1, vix[hv]].max()), 4))
        if ev is None:
            continue
        ev.update(w=w, ri=ri, letter=r['base'], ref=A.vname.get(rv, ''), heard=ev.get('heard', A.vname.get(hv, '')),
                  ok=w not in bad, wordfinal=ref['last_v'].get(w) == ri)
        events.append(ev)
    words = [w for w in ref['words'] if w not in skip_words]
    return dict(pred=pred, words=words, ok=[w for w in words if w not in bad], events=events)


def package_swaps(ref, pred, skip_words=()):
    """The same swaps read from quran-transcript's own explain_error."""
    from quran_transcript import explain_error
    A = alpha()
    try:
        errs = explain_error(ref['text'], ref['ph'], pred, ref['mappings'])
    except Exception:  # noqa: BLE001
        return None
    final_i0 = ref['groups'][ref['final']]['i0']
    out = set()
    for e in errs:
        if e.error_type != 'tashkeel' or not e.expected_ph or not e.preditected_ph:
            continue
        x, y = e.expected_ph[-1], e.preditected_ph[-1]
        if x in A.harakat and y in A.harakat and x != y and e.ph_pos[0] < final_i0:
            w = ref['word_of_char'][e.uthmani_pos[0]]
            if w > 0 and w not in skip_words:
                out.add(w)
    return out


def load_decodes(model, set_name):
    d = VOUT / 'decodes' / model
    if not (d / f'{set_name}.json').exists():
        return None
    meta = jload(d / f'{set_name}.json')
    z = np.load(d / f'{set_name}.npz')
    arr = {k: z[k] for k in z.files}
    return meta, arr


def run_rule(refs, model, set_name, with_package=False, align='groups'):
    """Analyze every item of a decoded set, both window offsets."""
    got = load_decodes(model, set_name)
    if got is None:
        return None
    meta, arr = got
    id2ch = meta['id2ch']
    out = []
    for n, it in enumerate(meta['items']):
        ref = refs.build(it['s'], it['a'], it['w0'], it['w1'])
        skip = set()
        if it.get('skip_first'):
            skip.add(ref['words'][0])
        if it.get('skip_last'):
            skip.add(ref['words'][-1])
        res = {}
        for k in ('A', 'B'):
            o0, o1 = arr[f'off_{k}'][n], arr[f'off_{k}'][n + 1]
            res[k] = analyze(ref, arr[f'am_{k}'][o0:o1], arr[f'pv_{k}'][o0:o1].astype(np.float32), id2ch, skip,
                             align)
        rec = dict(id=it['id'], group=it.get('group'), label=it.get('label'), key=f"{it['s']}:{it['a']}",
                   dur=it['dur'], words=res['A']['words'], ok=res['A']['ok'], A=res['A']['events'],
                   B=res['B']['events'], predA=res['A']['pred'], align=it.get('align'))
        if with_package:
            ps = package_swaps(ref, res['A']['pred'], skip)
            rec['pkg'] = sorted(ps) if ps is not None else None
        out.append(rec)
    return out


TAUS = [0.0, 0.5, 0.8, 0.9, 0.95, 0.98, 0.99, 0.995]


def flagged_words(rec, mode, tau, endings=True):
    """Words the rule flags in one item. mode A: first window only;
    AB: the same swap (same letter, same heard vowel) in both windows.
    endings=False leaves out vowels on a word's last consonant (case endings)."""
    def pick(evs):
        return {(e['ri'], e['heard']): e for e in evs
                if e['t'] == 'swap' and e['ok'] and not e.get('amb') and (endings or not e['wordfinal'])}
    a = pick(rec['A'])
    if mode == 'AB':
        b = pick(rec['B'])
        evs = [(min(e['margin'], b[k]['margin']), e) for k, e in a.items() if k in b]
    else:
        evs = [(e['margin'], e) for e in a.values()]
    return {e['w'] for m, e in evs if m >= tau}


RULES = {  # name: (mode, endings)
    'swap': ('A', True),
    'swap_2win': ('AB', True),
    'swap_no_endings': ('A', False),
    'swap_2win_no_endings': ('AB', False),
}


def rule_flagger(rule, tau):
    mode, endings = RULES[rule]
    return lambda r: flagged_words(r, mode, tau, endings)


def package_flagger(r):
    return set(r.get('pkg') or [])


def rate(n, words):
    return round(1000.0 * n / words, 3) if words else None


def poisson_upper(k, conf=0.95):
    """Exact one-sided upper bound on a Poisson count."""
    if k == 0:
        return -math.log(1 - conf)
    lo, hi = float(k), float(k) * 5 + 10
    for _ in range(100):
        mid = (lo + hi) / 2
        cdf = sum(math.exp(-mid) * mid ** i / math.factorial(i) for i in range(k + 1))
        lo, hi = (mid, hi) if cdf > 1 - conf else (lo, mid)
    return hi


def clean_summary(recs, flag):
    per = defaultdict(lambda: dict(words=0, ok=0, flags=0, sec=0.0, segs=0))
    sites = []
    for r in recs:
        g = per[r['group']]
        g['words'] += len(r['words'])
        g['ok'] += len(r['ok'])
        g['sec'] += r['dur']
        g['segs'] += 1
        fw = flag(r)
        g['flags'] += len(fw)
        for w in sorted(fw):
            ev = [e for e in r['A'] if e['t'] == 'swap' and e['w'] == w]
            sites.append(dict(reciter=r['group'], site=f"{r['key']}:{w}",
                              what=[f"{e['letter']} {e['ref']}->{e['heard']}" for e in ev],
                              margin=[e.get('margin') for e in ev], wordfinal=[e['wordfinal'] for e in ev],
                              align=r.get('align')))
    tot = dict(words=sum(g['words'] for g in per.values()), ok=sum(g['ok'] for g in per.values()),
               flags=sum(g['flags'] for g in per.values()), sec=sum(g['sec'] for g in per.values()))
    tot['per_1000'] = rate(tot['flags'], tot['words'])
    tot['per_1000_upper95'] = round(1000 * poisson_upper(tot['flags']) / tot['words'], 3) if tot['words'] else None
    tot['per_min'] = round(tot['flags'] / (tot['sec'] / 60), 4) if tot['sec'] else None
    tot['checkable_share'] = round(tot['ok'] / tot['words'], 4) if tot['words'] else None
    by = {}
    for k, g in sorted(per.items()):
        by[k] = dict(words=g['words'], checkable=g['ok'], flags=g['flags'], minutes=round(g['sec'] / 60, 2),
                     per_1000=rate(g['flags'], g['words']),
                     per_min=round(g['flags'] / (g['sec'] / 60), 4) if g['sec'] else None)
    tot['worst_reciter_per_1000'] = max((b['per_1000'] for b in by.values()), default=None)
    return tot, by, sites


def multi_reciter_sites(sites):
    by = defaultdict(set)
    what = defaultdict(Counter)
    for s in sites:
        by[s['site']].add(s['reciter'])
        for x in s['what']:
            what[s['site']][x] += 1
    return sorted([dict(site=k, reciters=sorted(v), n=len(v), what=dict(what[k]))
                   for k, v in by.items() if len(v) >= 2], key=lambda d: -d['n'])


def manifest_map(name):
    return {x['id']: x for x in jload(OUT / 'datasets' / name / 'manifest.json')}


def learner_summary(name, recs, flag):
    """False flags on clips labelled correct, recall on labelled errors."""
    man = manifest_map(name)
    out = dict(set=name)
    corr = [r for r in recs if r['label'] == 'correct']
    words = sum(len(r['words']) for r in corr)
    fl = [flag(r) for r in corr]
    out['correct'] = dict(clips=len(corr), words=words, flagged_words=sum(len(f) for f in fl),
                          per_1000=rate(sum(len(f) for f in fl), words),
                          clips_flagged=sum(1 for f in fl if f))
    inc = [r for r in recs if r['label'] == 'incorrect']
    out['incorrect_clips'] = dict(clips=len(inc), clips_flagged=sum(1 for r in inc if flag(r)))
    if name == 'retasy':
        for lab, lst in (('correct', corr), ('incorrect', inc)):
            g = [r for r in lst if man[r['id']].get('golden')]
            out[f'golden_{lab}'] = dict(clips=len(g), clips_flagged=sum(1 for r in g if flag(r)))
    if name == 'sobolev-errors':
        unk = [r for r in recs if r['label'] == 'unknown']
        words = sum(len(r['words']) for r in unk)
        n = sum(len(flag(r)) for r in unk)
        out['unlabelled_probably_correct'] = dict(clips=len(unk), words=words, flagged_words=n, per_1000=rate(n, words))
    # word-level labels
    cats = defaultdict(list)          # category -> [(rec, word)]
    for r in recs:
        x = man[r['id']]
        if name in ('al-ikhlas', 'sobolev-errors'):
            for ew in x.get('errorWords') or []:
                if not ew.get('word'):
                    continue
                s, a, w = map(int, ew['word'].split(':'))
                if f'{s}:{a}' != r['key'] or w not in r['words']:
                    continue
                if name == 'al-ikhlas':
                    c = ew.get('class') or 'unclassified'
                    cats[c].append((r, w))
                    if c == 'tajweed' and '\u0642\u0644\u0642\u0644\u0629' in (ew.get('explanation') or ''):
                        cats['qalqala'].append((r, w))
                else:
                    for c in ew.get('categories') or []:
                        cats[c].append((r, w))
        elif name == 'quranmb':
            seen = set()
            for e in x.get('phonemeEdits') or []:
                if e.get('word') and e['class'] in ('vowel', 'vowelDeleted', 'vowelInserted', 'consonant'):
                    s, a, w = map(int, e['word'].split(':'))
                    if f'{s}:{a}' == r['key'] and w in r['words'] and (e['class'], w) not in seen:
                        seen.add((e['class'], w))
                        cats[e['class']].append((r, w))
    rec_out = {}
    for c, lst in sorted(cats.items()):
        caught = drop = swap_any = checkable = 0
        by_site = defaultdict(lambda: [0, 0])
        for r, w in lst:
            f = w in flag(r)
            caught += f
            checkable += w in r['ok']
            evs = [e for e in r['A'] if e['w'] == w]
            drop += any(e['t'] == 'drop' and e['ok'] for e in evs)
            swap_any += any(e['t'] == 'swap' for e in evs)
            if name != 'quranmb':
                k = f"{r['key']}:{w}"
                by_site[k][0] += 1
                by_site[k][1] += f
        d = dict(words=len(lst), flagged=caught, recall=round(caught / len(lst), 4) if lst else None,
                 checkable=checkable, decode_shows_swap=swap_any, decode_shows_dropped_vowel=drop)
        if by_site:
            d['by_site'] = {k: dict(words=v[0], flagged=v[1]) for k, v in sorted(by_site.items(), key=lambda kv: -kv[1][0])[:12]}
        rec_out[c] = d
    out['labelled_words'] = rec_out
    if name == 'quranmb':
        # flags on words where the annotation shows no edit at all
        n_fl = n_clean = 0
        for r in recs:
            edited = {int(e['word'].split(':')[2]) for e in man[r['id']].get('phonemeEdits') or []
                      if e.get('word') and e['word'].startswith(r['key'] + ':')}
            for w in flag(r):
                n_fl += 1
                n_clean += w not in edited
        out['flags_on_unedited_words'] = dict(flags=n_fl, on_unedited=n_clean)
    return out


def qalqala_summary(recs, name, labels=None):
    """Qalqala sites: share heard, on correct audio and on labelled misses."""
    man = manifest_map(name) if labels else None
    tot = miss = 0
    lab_tot = lab_miss = 0
    for r in recs:
        evs = [e for e in r['A'] if e['t'] == 'qal' and e['ok']]
        if man is None or r['label'] == 'correct':
            tot += len(evs)
            miss += sum(1 for e in evs if not e['heard'])
        if man is not None and r['label'] == 'incorrect':
            ws = set()
            for ew in man[r['id']].get('errorWords') or []:
                if ew.get('word') and '\u0642\u0644\u0642\u0644\u0629' in (ew.get('explanation') or ''):
                    s, a, w = map(int, ew['word'].split(':'))
                    if f'{s}:{a}' == r['key']:
                        ws.add(w)
            for e in evs:
                if e['w'] in ws:
                    lab_tot += 1
                    lab_miss += not e['heard']
    out = dict(sites_on_correct_audio=tot, flagged_missing=miss, false_flag_share=round(miss / tot, 4) if tot else None)
    if man is not None:
        out.update(labelled_missing_sites=lab_tot, caught=lab_miss, recall=round(lab_miss / lab_tot, 4) if lab_tot else None)
    return out


def event_rates(recs, kind):
    """Per 1000 words, how often a decode shows a dropped / added vowel on a
    checkable word (diagnostic: the rule never flags these)."""
    words = sum(len(r['words']) for r in recs)
    n = sum(1 for r in recs for e in r['A'] if e['t'] == kind and e['ok'])
    nw = sum(len({e['w'] for e in r['A'] if e['t'] == kind and e['ok']}) for r in recs)
    return dict(events=n, words_with_event=nw, per_1000_words=rate(nw, words))


def summarize_model(M):
    """The headline numbers per rule at its clean operating points."""
    out = {}
    for rule in RULES:
        for label, ops in (('pooled_gate', M.get('operating_points', {})),
                           ('every_reciter_gate', M.get('operating_points_every_reciter', {}))):
            tau = ops.get(rule)
            if tau is None:
                out[f'{rule}/{label}'] = dict(tau=None, note='gate not met at any threshold tried')
                continue
            key = f'{rule}@{tau}'
            c = M['clean'][key]['total']
            d = dict(tau=tau, clean_per_1000=c['per_1000'], clean_per_1000_upper95=c['per_1000_upper95'],
                     clean_per_min=c['per_min'], clean_flags=c['flags'], clean_words=c['words'],
                     clean_worst_reciter_per_1000=c['worst_reciter_per_1000'])
            L = M.get('learners', {})
            g = L.get('al-ikhlas', {}).get(key)
            if g:
                v = g['labelled_words'].get('vowel', {})
                d['al_ikhlas_correct_per_1000'] = g['correct']['per_1000']
                d['al_ikhlas_vowel_recall'] = f"{v.get('flagged')}/{v.get('words')}"
            g = L.get('retasy', {}).get(key)
            if g:
                d['retasy_correct_per_1000'] = g['correct']['per_1000']
                d['retasy_clips_flagged_incorrect_vs_correct'] = (
                    f"{g['incorrect_clips']['clips_flagged']}/{g['incorrect_clips']['clips']} vs "
                    f"{g['correct']['clips_flagged']}/{g['correct']['clips']}")
            g = L.get('sobolev-errors', {}).get(key)
            if g:
                d['sobolev_unlabelled_per_1000'] = g['unlabelled_probably_correct']['per_1000']
                d['sobolev_recall'] = {c_: f"{v['flagged']}/{v['words']}" for c_, v in g['labelled_words'].items()}
            g = L.get('quranmb', {}).get(key)
            if g:
                v = g['labelled_words'].get('vowel', {})
                d['quranmb_ACTED_vowel_quality_recall'] = f"{v.get('flagged')}/{v.get('words')}"
                d['quranmb_ACTED_correct_clips_per_1000'] = g['correct']['per_1000']
            out[f'{rule}/{label}'] = d
    return out


def cmd_score(args):
    refs = Refs()
    results = dict(generated=time.strftime('%Y-%m-%d %H:%M'), moshaf=MOSHAF, gate_per_1000=1.0,
                   taus=TAUS, models={})
    p = VOUT / 'ref' / 'refcheck.json'
    if p.exists():
        rc = jload(p)
        results['reference'] = dict(ayat_checked=rc['ayat'], word_count_failures=len(rc['word_count_failures']),
                                    merged_words=rc['merged_words'], phonetized_ayat=rc['phonetized_ayat'],
                                    phonetize_failures=len(rc['phonetize_failures']))
    seg = []
    for f in sorted((VOUT / 'segments').glob('*.json')):
        sg = jload(f)
        g = sg['segments']
        off = [x['a_start'] - x['timing_from'] for x in g if 'a_start' in x]
        seg.append(dict(file=f.stem, ayat=len(g), aligned_ok=sum(1 for x in g if x.get('ok')),
                        clean_start=sum(1 for x in g if x.get('clean_start')),
                        clean_end=sum(1 for x in g if x.get('clean_end')),
                        timing_offset_median=round(float(np.median(off)), 2) if off else None,
                        timing_offset_range=[round(min(off), 2), round(max(off), 2)] if off else None))
    results['segmentation'] = seg
    results['rules'] = {k: dict(window_offsets=2 if v[0] == 'AB' else 1, case_endings=v[1]) for k, v in RULES.items()}
    for model in args.models:
        log(f'scoring {model}')
        M = dict()
        ops, ops_each = {}, {}
        clean = run_rule(refs, model, 'clean', with_package=True)
        if clean:
            sweep, detail = {}, {}
            for rule in RULES:
                sweep[rule] = []
                for tau in TAUS:
                    tot, by, _ = clean_summary(clean, rule_flagger(rule, tau))
                    sweep[rule].append(dict(tau=tau, **tot))
                # operating point, from clean recitation only: the lowest
                # threshold whose pooled rate meets the gate
                ok = [s for s in sweep[rule] if s['per_1000'] is not None and s['per_1000'] <= 1.0]
                ops[rule] = ok[0]['tau'] if ok else None
                # stricter: every reciter at or under the gate
                ok = [s for s in sweep[rule] if s['worst_reciter_per_1000'] is not None
                      and s['worst_reciter_per_1000'] <= 1.0]
                ops_each[rule] = ok[0]['tau'] if ok else None
                for tau in sorted({0.0, ops[rule] if ops[rule] is not None else TAUS[-1]}
                                  | ({ops_each[rule]} if ops_each[rule] is not None else set())):
                    tot, by, sites = clean_summary(clean, rule_flagger(rule, tau))
                    detail[f'{rule}@{tau}'] = dict(total=tot, by_reciter=by,
                                                   multi_reciter_sites=multi_reciter_sites(sites),
                                                   flags=sites[:400])
            tot, by, sites = clean_summary(clean, package_flagger)
            detail['package_explain_error'] = dict(total=tot, by_reciter=by,
                                                   multi_reciter_sites=multi_reciter_sites(sites))
            for d in detail.values():  # reference phonemes of each repeated site, for audit
                for site in d['multi_reciter_sites']:
                    s, a, w = map(int, site['site'].split(':'))
                    site['reference_word'] = refs.build(s, a)['word_ph'][w]
            M['clean_sweep'] = sweep
            M['operating_points'] = ops
            M['operating_points_every_reciter'] = ops_each
            M['clean'] = detail
            by_s = defaultdict(lambda: [0, 0])
            pos = Counter()
            pairs = Counter()
            for r in clean:
                s = r['key'].split(':')[0]
                by_s[s][0] += len(r['words'])
                by_s[s][1] += len(flagged_words(r, 'A', 0.0))
                for e in r['A']:
                    if e['t'] == 'swap' and e['ok']:
                        pos['case_ending' if e['wordfinal'] else 'inside_word'] += 1
                        pairs[f"{e['ref']}->{e['heard']}"] += 1
            M['clean_by_surah_swap@0'] = {k: dict(words=v[0], flags=v[1], per_1000=rate(v[1], v[0]))
                                          for k, v in sorted(by_s.items())}
            M['clean_swap_events@0'] = dict(position=dict(pos), vowels=dict(pairs))
            M['clean_diagnostics'] = dict(dropped_vowel=event_rates(clean, 'drop'), vowel_on_sukun=event_rates(clean, 'add'))
            both = mine = pkg = 0
            for r in clean:
                if r.get('pkg') is None:
                    continue
                a, b = flagged_words(r, 'A', 0.0), set(r['pkg'])
                both += len(a & b)
                mine += len(a - b)
                pkg += len(b - a)
            M['clean_package_vs_rule@0'] = dict(flagged_by_both=both, only_swap_rule=mine, only_package=pkg)
            M['clean_qalqala'] = qalqala_summary(clean, 'clean')
            jdump(clean, VOUT / 'events' / model / 'clean.json')
            # the first extraction (letters-only alignment, no guard), for the record
            base = run_rule(refs, model, 'clean', align='letters')
            M['clean_sweep_first_extraction'] = {
                rule: [dict(tau=tau, **clean_summary(base, rule_flagger(rule, tau))[0]) for tau in TAUS]
                for rule in ('swap', 'swap_2win')}
            M['clean_first_extraction_multi_reciter_sites@0'] = multi_reciter_sites(
                clean_summary(base, rule_flagger('swap', 0.0))[2])
        L = {}
        for name in LEARNER_SETS:
            recs = run_rule(refs, model, name, with_package=True)
            if not recs:
                continue
            jdump(recs, VOUT / 'events' / model / f'{name}.json')
            L[name] = {}
            for rule in RULES:
                taus = {0.0}
                for o in (ops, ops_each):
                    if o.get(rule) is not None:
                        taus.add(o[rule])
                for tau in sorted(taus):
                    L[name][f'{rule}@{tau}'] = learner_summary(name, recs, rule_flagger(rule, tau))
            L[name]['package_explain_error'] = learner_summary(name, recs, package_flagger)
            corr = [r for r in recs if r['label'] == 'correct']
            L[name]['diagnostics_on_correct'] = dict(dropped_vowel=event_rates(corr, 'drop'),
                                                     vowel_on_sukun=event_rates(corr, 'add'))
            if name == 'al-ikhlas':
                L[name]['qalqala'] = qalqala_summary(recs, name, labels=True)
        M['learners'] = L
        M['summary'] = summarize_model(M)
        results['models'][model] = M
    sp = VOUT / 'speed.json'
    if sp.exists():
        results['speed'] = jload(sp)
    jdump(results, VOUT / 'results.json')
    log(f'wrote {VOUT / "results.json"}')


# ----------------------------------------------------------------- speed

def cmd_speed_one(args):
    """One model on one device: seconds per ayah for 5, 10 and 20 s ayat."""
    import resource
    model = Model(args.model, args.device, args.threads)
    torch = model.torch
    rng = np.random.default_rng(0)
    pcm = read_pcm(OUT / f'audio_{args.audio}.f32')
    res = dict(model=args.model, device=args.device, threads=args.threads, params=model.n_params)
    for sec in (5, 10, 20):
        start = int(rng.integers(0, len(pcm) - sec * SR))
        w = pcm[start:start + sec * SR]
        model.run(w)
        times, cpu = [], []
        for _ in range(args.reps):
            t0, c0 = time.perf_counter(), time.process_time()
            model.run(w)
            if args.device == 'mps':
                torch.mps.synchronize()
            times.append(time.perf_counter() - t0)
            cpu.append(time.process_time() - c0)
        res[f'{sec}s'] = dict(median=round(float(np.median(times)), 4), min=round(min(times), 4),
                              cpu_sec_median=round(float(np.median(cpu)), 4))
    res['load_avg_1m'] = round(os.getloadavg()[0], 1)
    res['peak_rss_mb'] = round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 2 ** 20, 1)
    if args.device == 'mps':
        res['mps_driver_mb'] = round(torch.mps.driver_allocated_memory() / 2 ** 20, 1)
    print(json.dumps(res))


def cmd_speed(args):
    out = dict(runs=[])
    audio = args.audio or f'{clean_files()[0][0]}_{clean_files()[0][1]}'
    for model in ('teacher', 'mini'):
        for device in ('mps', 'cpu'):
            cmd = [sys.executable, '-I', str(Path(__file__).resolve()), 'speed-one', '--model', model,
                   '--device', device, '--threads', str(args.threads), '--audio', audio, '--reps', str(args.reps)]
            log(' '.join(cmd[3:]))
            r = subprocess.run(cmd, capture_output=True, text=True)
            line = [x for x in r.stdout.splitlines() if x.startswith('{')]
            out['runs'].append(json.loads(line[-1]) if line else dict(model=model, device=device, error=r.stderr[-500:]))
            log(out['runs'][-1])
    for m in ('teacher', 'mini'):
        n = next((x['params'] for x in out['runs'] if x.get('model') == m and 'params' in x), None)
        if n:
            out.setdefault('size_estimates_mb', {})[m] = dict(
                params=n, fp32=round(n * 4 / 1e6, 1), fp16=round(n * 2 / 1e6, 1), int8=round(n / 1e6, 1),
                palettized_6bit=round(n * 0.75 / 1e6, 1))
    jdump(out, VOUT / 'speed.json')


# ------------------------------------------------------------------ main

def cmd_refcheck(args):
    from quran_transcript import Aya, chunck_phonemes
    refs = Refs()
    A = alpha()
    counts, merged, failures, n = [], [], [], 0
    for aya in Aya(1, 1).get_ayat_after():
        f = aya.get()
        n += 1
        try:
            qw, kw, m = refs.ayah(f.sura_idx, f.aya_idx)
            if len(qw) != len(kw):
                merged.append(dict(key=f'{f.sura_idx}:{f.aya_idx}', qt_words=len(qw), mushaf_words=len(kw)))
        except ValueError as e:
            failures.append(dict(key=f'{f.sura_idx}:{f.aya_idx}', error=str(e)))
    # phonetize every ayah of the surahs the bench uses
    surahs = sorted(set(CLEAN_SURAHS) | set(args.surahs or []))
    for name in LEARNER_SETS:
        p = OUT / 'datasets' / name / 'manifest.json'
        if p.exists():
            surahs = sorted(set(surahs) | {x['surah'] for x in jload(p) if x.get('surah')})
    pack, ph_fail, t0 = {}, [], time.time()
    for s in surahs:
        a = 1
        while True:
            try:
                f = Aya(s, a).get()
            except Exception:  # noqa: BLE001
                break
            try:
                ref = refs.build(s, a)
                assert chunck_phonemes(ref['ph']) == [ref['ph'][g['i0']:g['i1']] for g in ref['groups']]
                pack[f'{s}:{a}'] = dict(words=len(ref['words']), ph=ref['ph'],
                                        word_ph=[ref['word_ph'][w] for w in ref['words']])
            except Exception as e:  # noqa: BLE001
                ph_fail.append(dict(key=f'{s}:{a}', error=str(e)[:200]))
            if a >= f.num_ayat_in_sura:
                break
            a += 1
    out = dict(ayat=n, word_count_failures=failures, merged_words=merged,
               phonetized_ayat=len(pack), phonetize_failures=ph_fail,
               surahs=surahs, sec=round(time.time() - t0, 1), moshaf=MOSHAF)
    jdump(out, VOUT / 'ref' / 'refcheck.json')
    jdump(pack, VOUT / 'ref' / 'pack.json')
    log(json.dumps({k: (v if not isinstance(v, list) or len(v) < 12 else f'{len(v)} items')
                    for k, v in out.items()}, ensure_ascii=False))


def cmd_segment(args):
    model = Model('teacher', args.device)
    refs = Refs()
    files = clean_files()
    if args.reciters:
        files = [f for f in files if f[0] in args.reciters]
    if args.surahs:
        files = [f for f in files if f[1] in args.surahs]
    for rid, surah in files:
        p = VOUT / 'segments' / f'{rid}_{surah}.json'
        if p.exists() and not args.force:
            continue
        t0 = time.time()
        seg = segment_file(model, refs, rid, surah)
        jdump(seg, p)
        g = seg['segments']
        ok = sum(1 for x in g if x.get('ok'))
        cs = sum(1 for x in g if x.get('clean_start'))
        ce = sum(1 for x in g if x.get('clean_end'))
        off = [x['a_start'] - x['timing_from'] for x in g if 'a_start' in x]
        log(f'{rid}_{surah}: {ok}/{len(g)} aligned, clean starts {cs}, clean ends {ce}, '
            f'offset median {np.median(off):+.2f}s range {min(off):+.2f}..{max(off):+.2f}, {time.time() - t0:.0f}s')


def cmd_decode(args):
    model = Model(args.model, args.device, args.threads)
    refs = Refs()
    for set_name in args.set:
        decode_set(model, refs, set_name, VOUT / 'decodes' / args.model)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('refcheck')
    p.add_argument('--surahs', type=int, nargs='*')
    p.set_defaults(fn=cmd_refcheck)
    p = sub.add_parser('segment')
    p.add_argument('--reciters', nargs='*')
    p.add_argument('--surahs', type=int, nargs='*')
    p.add_argument('--device', default='mps')
    p.add_argument('--force', action='store_true')
    p.set_defaults(fn=cmd_segment)
    p = sub.add_parser('decode')
    p.add_argument('--model', choices=list(MODEL_DIRS), required=True)
    p.add_argument('--set', nargs='+', required=True, choices=['clean'] + LEARNER_SETS)
    p.add_argument('--device', default='mps')
    p.add_argument('--threads', type=int, default=4)
    p.set_defaults(fn=cmd_decode)
    p = sub.add_parser('score')
    p.add_argument('--models', nargs='+', default=list(MODEL_DIRS))
    p.set_defaults(fn=cmd_score)
    p = sub.add_parser('speed')
    p.add_argument('--threads', type=int, default=4)
    p.add_argument('--reps', type=int, default=5)
    p.add_argument('--audio', help='<reciter>_<surah> of a clean recitation to cut test ayat from')
    p.set_defaults(fn=cmd_speed)
    p = sub.add_parser('speed-one')
    p.add_argument('--model', choices=list(MODEL_DIRS), required=True)
    p.add_argument('--device', default='mps')
    p.add_argument('--threads', type=int, default=4)
    p.add_argument('--audio', required=True)
    p.add_argument('--reps', type=int, default=5)
    p.set_defaults(fn=cmd_speed_one)
    args = ap.parse_args()
    args.fn(args)


if __name__ == '__main__':
    main()
