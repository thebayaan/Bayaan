"""Exact-match tests for the natural added-word events.

    python3 -I added/test_pairs.py

Every event must read the pinned official text, and its word positions must map
to the engine's word numbers. Nothing in the text is ever changed.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'natural'))
import mutashabih as M  # noqa: E402
import pairs as P  # noqa: E402
import text as T  # noqa: E402

hafs = T.load_hafs()
corpus = T.load_corpus()
pos, key, raw = P.flat_text(hafs)
events = [P.describe(e, corpus) for e in P.find_events(hafs)]
failures = []
checks = 0


def check(cond, msg):
    global checks
    checks += 1
    if not cond:
        failures.append(msg)


def flat_index(s, a, tok):
    return pos[s].index((a, tok))


def same_letters(key_, engine_index, hafs_index):
    """The engine's word and the pinned token are one word (or the first part of
    a word the engine splits)."""
    plain = T.letters(corpus[key_][engine_index][1])
    official = T.letters(hafs[key_][hafs_index])
    return official.startswith(plain) or plain == official


check(len(events) > 0, 'no events')
for e in events:
    sy, sx = e['surahY'], e['surahX']
    j = flat_index(sy, e['ayahOfWord'], e['tokenOfWord'])
    i = flat_index(sx, *e['xLeft'])
    # The word is a verbatim token of the pinned file, at that place.
    check(hafs[f"{sy}:{e['ayahOfWord']}"][e['tokenOfWord']] == e['word'], f"word text {e['pair']}")
    # The gap is two neighbouring words of X.
    check(flat_index(sx, *e['xRight']) == i + 1, f"gap not adjacent {e['pair']}")
    # Shared words on both sides sound the same; the event's counts hold.
    for k in range(1, e['left'] + 1):
        check(key[sy][j - k] == key[sx][i + 1 - k], f"left word {k} {e['pair']}")
    for k in range(1, e['right'] + 1):
        check(key[sy][j + k] == key[sx][i + k], f"right word {k} {e['pair']}")
    # The extra word is really extra: X does not have it at the gap.
    check(key[sy][j] != key[sx][i + 1] or key[sy][j + 1] == key[sy][j], f"word also in X {e['pair']}")
    # Audio starts at a whole ayah, in order, with nothing left out.
    ayat = [int(k.split(':')[1]) for k in e['audio']]
    check(ayat == list(range(ayat[0], ayat[-1] + 1)), f"audio order {e['pair']}")
    check(all(k in hafs for k in e['audio']), f"audio key {e['pair']}")
    check(e['ayahOfRight'] == ayat[-1], f"audio ends with the right word's ayah {e['pair']}")
    # The expected start is the first shared word, or later when the recording
    # starts inside the shared words.
    xs = flat_index(sx, *e['xStart'])
    check(xs <= i, f"lock after the gap {e['pair']}")
    if not e['prefixWords']:
        first = flat_index(sy, ayat[0], 0)
        check(key[sy][first] == key[sx][xs], f"first word read is not the lock word {e['pair']}")
    # Word numbers: engine ids hold the same words as the pinned tokens.
    for name, (a, tok), eid in (('left', e['xLeft'], e['leftId']), ('right', e['xRight'], e['rightId'])):
        k = f'{sx}:{a}'
        s_, a_, w_ = (int(x) for x in eid.split(':'))
        check((s_, a_) == (sx, a), f'{name} id ayah {e["pair"]}')
        check(T.hafs_token(k, w_) == tok, f'{name} id token {e["pair"]}')
        check(same_letters(k, w_, tok), f'{name} id letters {e["pair"]}: {corpus[k][w_][1]} / {hafs[k][tok]}')
    # Kinds.
    check(e['kind'] != 'between' or e['xLeft'][0] != e['xRight'][0], f"between {e['pair']}")
    check(e['kind'] == 'between' or e['xLeft'][0] == e['xRight'][0], f"interior {e['pair']}")
    check(e['kind'] != 'interior' or e['prefixWords'] == 0, f"prefix class {e['pair']}")
    check(e['kind'] != 'interior_prefix' or e['prefixWords'] > 0, f"prefix class 2 {e['pair']}")

# Known events from W1 appear, at the right gap.
by_pair = {e['pair']: e for e in events}
check('added~43:64:2~3:51:1' in by_pair, 'W1 pair 43:64 / 3:51 missing')
check('added~11:19:9~7:45:8' in by_pair, 'W1 pair 11:19 / 7:45 missing')
if 'added~43:64:2~3:51:1' in by_pair:
    e = by_pair['added~43:64:2~3:51:1']
    check(e['leftId'] == '3:51:1' and e['rightId'] == '3:51:2', 'W1 pair 43:64 gap')
    check(e['word'] == hafs['43:64'][2], 'W1 pair 43:64 word')
# The engine's split ayat map through engine_word: word numbers past the split move by one.
check(T.engine_word('36:22', 1) == 2 and T.engine_word('36:22', 0) == 0, 'split ayah mapping')
# Doubled words of the text itself are not events.
for e in events:
    if e['surahX'] == e['surahY']:
        ja = flat_index(e['surahY'], e['ayahOfWord'], e['tokenOfWord'])
        ia = flat_index(e['surahX'], *e['xLeft'])
        check(abs(ia - ja) > 3, f"self match {e['pair']}")
# text_key is the pinned module's function, and is stable on a known word.
check(M.text_key(['رَحِيمٞ'], 0) == M.text_key(['رَحِيمٌ'], 0), 'text_key folds sequential tanween')

print(f'{checks} checks on {len(events)} events, {len(failures)} failures')
for f in failures[:30]:
    print('FAIL', f)
sys.exit(1 if failures else 0)
