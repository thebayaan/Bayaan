"""Pinned Quran text for the natural benchmark.

Three word lists, all read verbatim and never changed:

- the pinned official KFGQPC Hafs file, scripts/rewayah/sources/hafs.json,
  whose SHA-256 sources.lock.json pins (the label for every suite);
- the app's text, data/quran.json (engine word numbers, W1 pair finding);
- the engine's corpus, .out/assets/zipformer_quran.json (phonemes, verdict ids).

`tokens()` strips only what is not a word: the ayah marker after the last word,
the rub' sign, waqf signs that stand alone or sit on a word, and the sajdah sign.
Letters and vowels are never touched: a token is the source's exact substring
minus those signs.

Word numbers. The engine's word index equals the Hafs token index except in the
ayat ENGINE_SPLITS lists, where the engine splits one token in two.
`engine_word()` and `hafs_token()` map between them; test_natural.py checks them
on every word of the Quran.
"""
import hashlib
import json
import os
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
BENCH = os.path.dirname(HERE)
ROOT = os.path.dirname(os.path.dirname(BENCH))
HAFS_FILE = os.path.join(ROOT, 'scripts/rewayah/sources/hafs.json')
LOCK_FILE = os.path.join(ROOT, 'scripts/rewayah/sources/sources.lock.json')
APP_FILE = os.path.join(ROOT, 'data/quran.json')
CORPUS_FILE = os.path.join(BENCH, '.out/assets/zipformer_quran.json')
OUT = os.path.join(BENCH, '.out/natural')

# SHA-256 of the text files this benchmark was built from. Rebuilding from
# anything else fails.
PINS = {
    'hafs': 'd2960b3217962e7e4252abdcece67bea3d6b48271e4cd3af45bbbb2dd5c872ca',
    'app': '923a1e95e95f6381026f89f30d9b1c375c5cde7623ae4f59468b3e25cb4a82f5',
    'corpus': None,  # filled by CORPUS_SHA below once read
}
CORPUS_SHA = None

# Counts recounted from the pinned files (tokens() is the only tokenizer).
AYAT = 6236
WORDS = 77430
ENGINE_WORDS = 77433

# Hafs token index the engine splits in two, by ayah.
ENGINE_SPLITS = {'15:7': 0, '27:20': 3, '36:22': 0}

STANDALONE_SIGNS = set('ۖۗۘۙۚۛۜ۝۞۩')
AYAH_NUMBER_DIGITS = set('٠١٢٣٤٥٦٧٨٩')


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def is_ayah_number(token):
    """The ayah marker: Arabic digits (app) or one presentation glyph (KFGQPC)."""
    if not token:
        return False
    if all(c in AYAH_NUMBER_DIGITS for c in token):
        return True
    return all(0xFB50 <= ord(c) <= 0xFDFF or 0xFE70 <= ord(c) <= 0xFEFF for c in token)


def tokens(text):
    """The ayah's words, in order, as exact substrings without signs."""
    out = []
    for raw in text.replace('\xa0', ' ').split():
        if is_ayah_number(raw):
            continue
        word = ''.join(c for c in raw if c not in STANDALONE_SIGNS)
        if word:
            out.append(word)
    return out


def load_hafs():
    """{'s:a': [tokens]} from the pinned official file, after checking its hash."""
    got = sha256(HAFS_FILE)
    if got != PINS['hafs']:
        raise SystemExit(f'hafs.json hash {got} is not the pinned one')
    with open(LOCK_FILE, encoding='utf-8') as f:
        lock = json.load(f)
    if lock['sources']['hafs']['sha256'] != got:
        raise SystemExit('hafs.json does not match sources.lock.json')
    with open(HAFS_FILE, encoding='utf-8') as f:
        rows = json.load(f)
    return {f"{r['sura_no']}:{r['aya_no']}": tokens(r['aya_text']) for r in rows}


def load_app():
    """{'s:a': [tokens]} from data/quran.json, after checking its hash."""
    got = sha256(APP_FILE)
    if got != PINS['app']:
        raise SystemExit(f'data/quran.json hash {got} is not the pinned one')
    with open(APP_FILE, encoding='utf-8') as f:
        rows = json.load(f)
    return {r['verse_key']: tokens(r['text']) for r in rows.values()}


def load_corpus():
    """{'s:a': [(phonemes, plain)]} from the engine's corpus."""
    with open(CORPUS_FILE, encoding='utf-8') as f:
        raw = json.load(f)
    return {
        f"{s['n']}:{a['n']}": [(w[1], w[2]) for w in a['w']]
        for s in raw['surahs']
        for a in s['ayahs']
    }


def ayah_keys(words):
    """Keys in mushaf order."""
    return sorted(words, key=lambda k: tuple(int(x) for x in k.split(':')))


def engine_word(key, token_index):
    """The engine's word index of a Hafs token (first part, if split)."""
    split = ENGINE_SPLITS.get(key)
    if split is not None and token_index > split:
        return token_index + 1
    return token_index


def hafs_token(key, engine_index):
    """The Hafs token index of an engine word (split parts share one token)."""
    split = ENGINE_SPLITS.get(key)
    if split is not None and engine_index > split:
        return engine_index - 1
    return engine_index


# ------------------------------------------------------- spelling comparison

HAMZA_CARRIERS = {'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ؤ': 'و', 'ئ': 'ي', 'ى': 'ي', 'ی': 'ي'}


def letters(word):
    """Base letters only: marks, tatweel and small letters out, hamza and
    alif forms folded. For checking two sources mean the same word, never for
    display or labels."""
    out = []
    for c in unicodedata.normalize('NFD', word):
        cat = unicodedata.category(c)
        if cat in ('Mn', 'Mc', 'Me', 'Cf') or c in 'ـۥۦۧۨ' or cat == 'Lm':
            continue
        out.append(HAMZA_CARRIERS.get(c, c))
    # NFD turns آ أ إ ؤ ئ into a base plus a mark, so fold again after it.
    return ''.join(out).replace('ء', '').replace('ا', '').replace('ة', 'ه')


# ------------------------------------------------------- what a reciter recited

def recited_map(recited, official):
    """Maps QUA's recited tokens to official token indexes.

    QUA keeps a reciter's repeated words, so a row can read past a word, go back
    and read it again. Returns (mapping, restarts): mapping[i] is the official
    index of recited token i, restarts is how many times the reader went back.
    Returns (None, 0) when the row is not the official text with repeats: such a
    row differs by more than a repeat, and is masked, never corrected.
    """
    want = [letters(w) for w in official]
    got = [letters(w) for w in recited]
    mapping = []
    p = 0
    restarts = 0
    for i, g in enumerate(got):
        if p < len(want) and g == want[p]:
            mapping.append(p)
            p += 1
            continue
        best, best_len = None, 0
        for q in range(0, p):
            if want[q] != g:
                continue
            n = 0
            while i + n < len(got) and q + n < len(want) and got[i + n] == want[q + n]:
                n += 1
            if n > best_len:
                best, best_len = q, n
        if best is None:
            return None, 0
        restarts += 1
        mapping.append(best)
        p = best + 1
    if p != len(want):
        return None, 0
    return mapping, restarts
