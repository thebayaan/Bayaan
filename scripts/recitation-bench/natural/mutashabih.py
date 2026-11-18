"""W1: ayat of the official Hafs text that differ by one word.

    python3 -I natural/mutashabih.py [--out .out/natural/manifests/w1_pairs.json]

An authentic recording of ayah Y is scored against the official text of its
twin X. No audio is edited: the event exists in the text. Pair kinds:

- sub: whole-ayah pairs differing by one substituted word;
- indel: whole-ayah pairs where one has one extra word;
- short_indel: the same for ayat under four words, not counted;
- drop_last: Y's whole recording is X without its last word, read from where Y
  starts inside X (a whole ayah for 101:5/70:9, a span of a longer ayah for
  114:6). The 9 pairs first proposed share a three-word ending; the other six also
  differ earlier, so they need cuts (ending_only, listed, never run);
- junction: X's last word is missing and the next ayah still opens the same, so
  Y and the ayah after it, in order, reach the next ayah with X's last word
  unsaid.

Spelling-only pairs sound the same, so hearing Y against X must give no mark.
They become false-flag traps. Two filters must agree: the engine corpus's
phonemes, and a small rule set on the official text that uses no engine data
(see text_key).

Word numbers are Hafs token indexes; engine indexes sit next to them (text.py).
"""
import argparse
import collections
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import text as T  # noqa: E402

MIN_WORDS = 4
CLOSE_DISTANCE = 2
FATHA, DAMMA, KASRA, SHADDA = 'َ', 'ُ', 'ِ', 'ّ'
SAME_SIGN = {
    # The mushaf's sequential tanween forms are the same sound.
    'ٗ': 'ً',
    'ٞ': 'ٌ',
    'ٖ': 'ٍ',
    # Dagger alif and small letters are long vowels.
    'ٰ': 'ا',
    'ۥ': 'و',
    'ۦ': 'ي',
    'ۧ': 'ي',
    'ى': 'ا',
    'ٱ': 'ا',
}
SILENT = set('ـْۭٓۡۢۜ۟۠')


def text_key(words, j):
    """How token j sounds, from the official text alone. Conservative: it only
    folds spellings of one sound, so two different keys may still sound alike,
    but two equal keys do not differ. Used to name spelling-only pairs and to
    measure how close two words are."""
    word = words[j]
    # A doubled first letter is assimilation from the word before: both twins
    # share that word, and at the start of an ayah the reader starts fresh.
    if len(word) > 2 and SHADDA in word[1:3] and word[1] != 'ٰ':
        i = word.index(SHADDA, 1)
        if all(c in (FATHA, DAMMA, KASRA, SHADDA) for c in word[1:i]):
            word = word[:i] + word[i + 1 :]
    out = []
    for c in word:
        if c in SILENT:
            continue
        out.append(SAME_SIGN.get(c, c))
    key = ''.join(out)
    # A long vowel before a joining alif is read short: بِهَٰدِي ٱلۡعُمۡيِ.
    next_word = words[j + 1] if j + 1 < len(words) else None
    if next_word and next_word.startswith('ٱ') and key.endswith(KASRA + 'ي'):
        key = key[:-1]
    # Doubled letters and madd: count a sound once.
    fold = []
    for c in key:
        if c == SHADDA:
            continue
        if fold and fold[-1] == c:
            continue
        fold.append(c)
    return ''.join(fold)


def collapse(s):
    """Phonemes with lengthened sounds counted once."""
    out = []
    for c in s:
        if not out or out[-1] != c:
            out.append(c)
    return ''.join(out)


def edit_distance(a, b):
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[-1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def position(j, n):
    if j == 0:
        return 'first'
    return 'last' if j == n - 1 else 'interior'


def find_pairs(words, min_words=MIN_WORDS):
    """(identical pair count, {(x, y): j} substitutions, [(long, short, j)])."""
    keys = T.ayah_keys(words)
    subs_by_sig = collections.defaultdict(list)
    whole = collections.defaultdict(list)
    for k in keys:
        t = words[k]
        if len(t) < min_words:
            continue
        whole[tuple(t)].append(k)
        for j in range(len(t)):
            subs_by_sig[(j, tuple(t[:j]), tuple(t[j + 1 :]))].append(k)
    identical = sum(len(v) * (len(v) - 1) // 2 for v in whole.values() if len(v) > 1)
    subs = {}
    for (j, _, _), group in subs_by_sig.items():
        for a in range(len(group)):
            for b in range(a + 1, len(group)):
                if words[group[a]] != words[group[b]]:
                    subs[(group[a], group[b])] = j
    indels = []
    for k in keys:
        t = words[k]
        if len(t) <= min_words:
            continue
        for j in range(len(t)):
            for short in whole.get(tuple(t[:j] + t[j + 1 :]), []):
                indels.append((k, short, j))
    return identical, subs, indels


def find_short_indels(words):
    """Whole-ayah one-word pairs where the shorter ayah has under MIN_WORDS."""
    keys = T.ayah_keys(words)
    whole = collections.defaultdict(list)
    for k in keys:
        whole[tuple(words[k])].append(k)
    out = []
    for k in keys:
        t = words[k]
        if len(t) < 2:
            continue
        for j in range(len(t)):
            rest = tuple(t[:j] + t[j + 1 :])
            if len(rest) >= MIN_WORDS:
                continue
            for short in whole.get(rest, []):
                out.append((k, short, j))
    return out


def find_ending_pairs(words, context=3):
    """(x, y): y ends with x's last words before its final one."""
    keys = T.ayah_keys(words)
    ends = collections.defaultdict(list)
    for k in keys:
        if len(words[k]) >= context:
            ends[tuple(words[k][-context:])].append(k)
    out = []
    for x in keys:
        t = words[x]
        if len(t) < context + 1:
            continue
        for y in ends.get(tuple(t[-context - 1 : -1]), []):
            if y != x:
                out.append((x, y))
    return out


def next_key(words, key):
    s, a = key.split(':')
    k = f'{s}:{int(a) + 1}'
    return k if k in words else None


def build():
    hafs = T.load_hafs()
    app = T.load_app()
    corpus = T.load_corpus()

    def engine_phonemes(key):
        return [w[0] for w in corpus[key]]

    identical, subs, indels = find_pairs(hafs)
    pairs = []
    for (a, b), j in sorted(subs.items(), key=lambda kv: _order(kv[0])):
        ea, eb = T.engine_word(a, j), T.engine_word(b, j)
        word_a, word_b = hafs[a][j], hafs[b][j]
        key_a, key_b = text_key(hafs[a], j), text_key(hafs[b], j)
        phon_a, phon_b = corpus[a][ea][0], corpus[b][eb][0]
        spelling_text = key_a == key_b
        spelling_phon = ''.join(engine_phonemes(a)) == ''.join(engine_phonemes(b))
        if spelling_text != spelling_phon:
            raise SystemExit(f'phonetic filters disagree on {a} {b}: {word_a} {word_b}')
        distance = edit_distance(key_a, key_b)
        pairs.append(
            {
                'id': f'sub~{a}~{b}',
                'type': 'sub',
                'a': a,
                'b': b,
                'token': j,
                'position': position(j, len(hafs[a])),
                'wordA': word_a,
                'wordB': word_b,
                'engineA': ea,
                'engineB': eb,
                'phonA': phon_a,
                'phonB': phon_b,
                'spellingOnly': spelling_text,
                'textDistance': distance,
                'phonDistance': edit_distance(collapse(phon_a), collapse(phon_b)),
                'close': (not spelling_text) and distance <= CLOSE_DISTANCE,
            }
        )
    for long_key, short_key, j in sorted(indels, key=lambda r: _order(r[:2])):
        pairs.append(_indel(hafs, corpus, 'indel', long_key, short_key, j))
    for long_key, short_key, j in sorted(find_short_indels(hafs), key=lambda r: _order(r[:2])):
        if j == len(hafs[long_key]) - 1:
            continue  # goes to drop_last
        pairs.append(_indel(hafs, corpus, 'short_indel', long_key, short_key, j))

    ending = find_ending_pairs(hafs)
    usable = []
    ending_only = []
    for x, y in ending:
        n = len(hafs[y])
        if hafs[x][-1 - n : -1] == hafs[y]:
            usable.append((x, y, len(hafs[x]) - 1 - n))
        else:
            ending_only.append({'x': x, 'y': y, 'lastWord': hafs[x][-1]})
    for x, y, start in usable:
        token = len(hafs[x]) - 1
        pairs.append(
            {
                'id': f'drop_last~{x}~{y}',
                'type': 'drop_last',
                'long': x,
                'short': y,
                'token': token,
                'engineLong': T.engine_word(x, token),
                'startToken': start,
                'engineStart': T.engine_word(x, start),
                'word': hafs[x][token],
                'wholeAyah': start == 0,
            }
        )
    # The one natural junction with more than one word of the next ayah in common.
    junction = []
    for x, y in find_ending_pairs(hafs, context=2):
        nx, ny = next_key(hafs, x), next_key(hafs, y)
        if not nx or not ny:
            continue
        same = 0
        for u, v in zip(hafs[nx], hafs[ny]):
            if u != v:
                break
            same += 1
        if same >= 2:
            junction.append(
                {
                    'id': f'junction~{x}~{y}',
                    'type': 'junction',
                    'long': x,
                    'short': y,
                    'nextLong': nx,
                    'nextShort': ny,
                    'token': len(hafs[x]) - 1,
                    'engineLong': T.engine_word(x, len(hafs[x]) - 1),
                    'word': hafs[x][-1],
                    'nextWordsInCommon': same,
                }
            )
    pairs.extend(junction)

    # Pairs must be the same on the app's text (differs in 33 tatweel forms).
    identical_app, subs_app, indels_app = find_pairs(app)
    if set(subs_app) != set(subs) or set(indels_app) != set(indels) or identical_app != identical:
        raise SystemExit('pairs differ between the pinned Hafs text and data/quran.json')

    sub_pairs = [p for p in pairs if p['type'] == 'sub']
    counts = {
        'ayat': len(hafs),
        'words': sum(len(v) for v in hafs.values()),
        'identicalPairs': identical,
        'sub': len(sub_pairs),
        'subLast': sum(p['position'] == 'last' for p in sub_pairs),
        'subFirst': sum(p['position'] == 'first' for p in sub_pairs),
        'subInterior': sum(p['position'] == 'interior' for p in sub_pairs),
        'spellingOnly': sum(p['spellingOnly'] for p in sub_pairs),
        'close': sum(p['close'] for p in sub_pairs),
        'indel': sum(p['type'] == 'indel' for p in pairs),
        'shortIndel': sum(p['type'] == 'short_indel' for p in pairs),
        'endingPairs': len(ending),
        'dropLastUsable': len(usable),
        'junction': len(junction),
    }
    return {
        'pins': {
            'hafs': T.sha256(T.HAFS_FILE),
            'app': T.sha256(T.APP_FILE),
            'corpus': T.sha256(T.CORPUS_FILE),
        },
        'counts': counts,
        'pairs': pairs,
        'endingOnly': ending_only,
    }


def _indel(hafs, corpus, kind, long_key, short_key, j):
    return {
        'id': f'{kind}~{long_key}~{short_key}',
        'type': kind,
        'long': long_key,
        'short': short_key,
        'token': j,
        'position': position(j, len(hafs[long_key])),
        'word': hafs[long_key][j],
        'engineLong': T.engine_word(long_key, j),
        'engineShort': T.engine_word(short_key, j) if j < len(hafs[short_key]) else None,
        'phon': corpus[long_key][T.engine_word(long_key, j)][0],
    }


def _order(pair):
    return tuple(tuple(int(x) for x in k.split(':')) for k in pair)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(T.OUT, 'manifests/w1_pairs.json'))
    args = ap.parse_args()
    built = build()
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, 'w', encoding='utf-8') as f:
        json.dump(built, f, ensure_ascii=False, indent=1)
    print(json.dumps(built['counts'], ensure_ascii=False))
    print('wrote', args.out, T.sha256(args.out))


if __name__ == '__main__':
    main()
