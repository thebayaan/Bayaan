"""Natural added-word events that need no cut.

    python3 -I added/pairs.py plan     # writes .out/added/manifests/wanted.json
    python3 -I added/pairs.py build    # after staging: writes the bench manifest

An event: whole recordings of one or two consecutive ayat Y read, in order, words
that also stand side by side in the official text elsewhere (X), except for one
word Y has between them. Nothing is cut: each recording plays whole. Scored against
X's official text, unchanged, like W1. After the shared words the reader simply
goes on with Y, so words past the event are not scored.

Classes, by where the shared words start and where the extra word falls:
- interior: the recording starts at a whole ayah inside the shared words, and the
  extra word falls inside an ayah of X;
- interior_prefix: the same, but the recording's ayah starts before the shared
  words, so the tracker first hears words that are not X's;
- between: the extra word falls between two ayat of X: the reader arrives from X's
  last words and adds a word before its next ayah. Y's ayah before it always holds
  words that are not X's, so all of these have a prefix.

Words are compared by how they sound (mutashabih.text_key). The independent unit
is the event in Y (one word of one ayah), whatever X it is scored against.
"""
import collections
import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BENCH = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(BENCH, 'natural'))
import manifests as MF  # noqa: E402
import mutashabih as M  # noqa: E402
import text as T  # noqa: E402

OUT = os.path.join(BENCH, '.out/added/manifests')
MIN_LEFT = 2
MIN_LEFT_PREFIX = 3
MIN_RIGHT = 1
# The tracker must not idle before the shared words start (8 s without progress).
MAX_PREFIX_MS = 6000
# Between ayat, the ayah before always has other words first. Those clips run with
# the idle timer off and the engine kept on X's surah (ENGINE_OPTS in added/go.sh).
MAX_PREFIX_MS_BETWEEN = 40000
MAX_SOURCE_GAP_MS = 5000
# Catches barely move by reciter and disk is short: 4 reciters from each split,
# chosen by hash.
RECITERS_PER_SPLIT = 4
# One word of Y scored against many X says little more: at most two, those with
# the most shared words.
MAX_X_PER_CLUSTER = 2


def flat_text(hafs):
    """Per surah: positions (ayah, token), sound keys and exact tokens."""
    pos, key, raw = {}, {}, {}
    for k in T.ayah_keys(hafs):
        s, a = (int(x) for x in k.split(':'))
        words = hafs[k]
        pos.setdefault(s, []).extend((a, i) for i in range(len(words)))
        key.setdefault(s, []).extend(M.text_key(words, i) for i in range(len(words)))
        raw.setdefault(s, []).extend(words)
    return pos, key, raw


def find_events(hafs, min_left=MIN_LEFT, min_right=MIN_RIGHT):
    """Every (word of Y, gap of X), by class (see the module's notes)."""
    pos, key, raw = flat_text(hafs)
    bigrams = collections.defaultdict(list)
    for s, t in key.items():
        for i in range(len(t) - 1):
            bigrams[(t[i], t[i + 1])].append((s, i))
    events = []
    for sy, t in key.items():
        for j in range(1, len(t) - 1):
            for sx, i in bigrams.get((t[j - 1], t[j + 1]), ()):
                # The ayah's own words, or a word doubled in the text itself.
                if sx == sy and abs(i - j) <= 3:
                    continue
                tx = key[sx]
                left = 0
                while j - 1 - left >= 0 and i - left >= 0 and t[j - 1 - left] == tx[i - left]:
                    left += 1
                right = 0
                while j + 1 + right < len(t) and i + 1 + right < len(tx) and t[j + 1 + right] == tx[i + 1 + right]:
                    right += 1
                if right < min_right:
                    continue
                xl, xr = pos[sx][i], pos[sx][i + 1]
                between = xl[0] != xr[0]
                starts = [q for q in range(j - left, j) if pos[sy][q][1] == 0]
                if starts:
                    q = max(starts)
                    if j - q < min_left:
                        continue
                    kind = 'between' if between else 'interior'
                    x_from = i - (j - 1 - q)
                else:
                    # The ayah holding the first shared word, from its start.
                    if left < (min_left if between else MIN_LEFT_PREFIX):
                        continue
                    a0 = pos[sy][j - left][0]
                    q = j - left
                    while q > 0 and pos[sy][q - 1][0] == a0:
                        q -= 1
                    kind = 'between' if between else 'interior_prefix'
                    x_from = i - (left - 1)
                ya, yw = pos[sy][j]
                xs = pos[sx][x_from]
                last_right = pos[sy][j + right]
                events.append(
                    {
                        'cluster': f'{sy}:{ya}:{yw}',
                        'word': raw[sy][j],
                        'wordKey': t[j],
                        'surahY': sy,
                        'ayahStart': pos[sy][q][0],
                        'ayahOfWord': ya,
                        'tokenOfWord': yw,
                        'ayahOfRight': pos[sy][j + 1][0],
                        'ayahLastShared': last_right[0],
                        'surahX': sx,
                        'xStart': xs,
                        'xLeft': xl,
                        'xRight': xr,
                        'left': left,
                        'firstShared': pos[sy][j - left],
                        'prefixWords': max(0, (j - left) - q),
                        'right': right,
                        'kind': kind,
                        'between': between,
                        'repeatsNeighbour': t[j] in (t[j - 1], t[j + 1]),
                    }
                )
    return events


def stable(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def split_of(cluster):
    return 'dev' if int(stable('added' + cluster)[:8], 16) % 2 == 0 else 'test'


def engine_id(s, a, tok):
    return f'{s}:{a}:{T.engine_word(f"{s}:{a}", tok)}'


def describe(ev, corpus):
    """Adds what the bench needs: audio keys, expected passage, engine word ids."""
    sy, sx = ev['surahY'], ev['surahX']
    # Audio runs from the start ayah through the ayah that holds the right word.
    audio = [f'{sy}:{a}' for a in range(ev['ayahStart'], ev['ayahOfRight'] + 1)]
    xa, xt = ev['xStart']
    expected = {'surah': sx, 'ayah': xa}
    w0 = T.engine_word(f'{sx}:{xa}', xt)
    if w0:
        expected['word'] = w0
    left = engine_id(sx, ev['xLeft'][0], ev['xLeft'][1])
    right = engine_id(sx, ev['xRight'][0], ev['xRight'][1])
    y_key = f"{sy}:{ev['ayahOfWord']}"
    y_word = T.engine_word(y_key, ev['tokenOfWord'])
    phon = corpus[y_key][y_word][0]
    return {
        **ev,
        'audio': audio,
        'expected': expected,
        'leftId': left,
        'rightId': right,
        'phon': phon,
        'yWordEngine': y_word,
        'pair': f"added~{ev['cluster']}~{sx}:{ev['xLeft'][0]}:{ev['xLeft'][1]}",
        'pairSplit': split_of(ev['cluster']),
    }


def build_events():
    hafs = T.load_hafs()
    corpus = T.load_corpus()
    events = [describe(e, corpus) for e in find_events(hafs)]
    by_cluster = collections.defaultdict(list)
    for e in events:
        by_cluster[(e['kind'], e['cluster'])].append(e)
    kept = []
    for group in by_cluster.values():
        group.sort(key=lambda e: (-(e['left'] + e['right']), stable(e['pair'])))
        kept.extend(group[:MAX_X_PER_CLUSTER])
    return hafs, corpus, kept


def chosen_reciters():
    out = []
    for split in ('dev', 'test'):
        mine = [r for r in MF.load_reciters() if r['split'] == split]
        out.extend(sorted(mine, key=lambda r: stable('added' + r['slug']))[:RECITERS_PER_SPLIT])
    return out


def one_sitting(audio, meta):
    for a, b in zip(audio, audio[1:]):
        ra, rb = meta[a], meta[b]
        if ra['source'] != rb['source']:
            return False
        gap = rb['offsetMs'] - (ra['offsetMs'] + ra['durationMs'])
        if not (MF.MIN_SOURCE_GAP_MS <= gap <= MAX_SOURCE_GAP_MS):
            return False
    return True


def prefix_ms(e, meta):
    """When the first shared word starts in the recording, by QUA's timings."""
    a, tok = e['firstShared']
    key = f"{e['surahY']}:{a}"
    stamps = MF.word_stamps(meta, key)
    if not stamps:
        return None
    stamp = stamps.get(T.engine_word(key, tok))
    return stamp[0] if stamp else None


def usable(e, s, metas):
    meta = metas[s]
    if not all(MF.plain(meta, k) for k in e['audio']) or not one_sitting(e['audio'], meta):
        return False
    if e['prefixWords']:
        at = prefix_ms(e, meta)
        if at is None or at > (MAX_PREFIX_MS_BETWEEN if e['kind'] == 'between' else MAX_PREFIX_MS):
            return False
    return True


def plan():
    hafs, corpus, events = build_events()
    reciters = chosen_reciters()
    slugs = [r['slug'] for r in reciters]
    metas = {s: MF.load_meta(s, corpus) for s in slugs}
    wanted = {s: set() for s in slugs}
    for e in events:
        for s in slugs:
            if usable(e, s, metas):
                wanted[s].update(e['audio'])
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'wanted.json'), 'w', encoding='utf-8') as f:
        json.dump({s: sorted(v) for s, v in wanted.items()}, f, ensure_ascii=False, indent=0)
    new = 0
    ms = 0
    for s, v in wanted.items():
        for k in v:
            if not os.path.exists(MF.audio_path(s, k)):
                new += 1
                ms += metas[s][k]['durationMs']
    print(f'events {len(events)}, clusters {len({e["cluster"] for e in events})}')
    print('by split', collections.Counter(e['pairSplit'] for e in {e['cluster']: e for e in events}.values()))
    print('by kind', collections.Counter(e['kind'] for e in events))
    print('clusters by kind', collections.Counter(e['kind'] for e in {(e['kind'], e['cluster']): e for e in events}.values()))
    print('repeats a neighbour', sum(e['repeatsNeighbour'] for e in events))
    print(f'wanted clips {sum(len(v) for v in wanted.values())}, new {new}, {ms / 3.6e6:.1f} h, about {ms / 1000 * 64000 / 1e9:.2f} GB')


def build():
    hafs, corpus, events = build_events()
    reciters = chosen_reciters()
    splits = {r['slug']: r['split'] for r in reciters}
    slugs = [r['slug'] for r in reciters]
    metas = {s: MF.load_meta(s, corpus) for s in slugs}
    clips = []
    skipped = collections.Counter()
    for e in events:
        for s in slugs:
            if not usable(e, s, metas):
                skipped['not usable'] += 1
                continue
            if not all(os.path.exists(MF.audio_path(s, k)) for k in e['audio']):
                skipped['audio not staged'] += 1
                continue
            y_key = f"{e['surahY']}:{e['ayahOfWord']}"
            stamps = MF.word_stamps(metas[s], y_key)
            word_stamp = stamps.get(e['yWordEngine']) if stamps else None
            clip = {
                'id': f"added__{s}__{e['pair'].replace('~', '__').replace(':', '_')}",
                'expected': e['expected'],
                'hint': {'surah': e['expected']['surah'], 'ayah': e['expected']['ayah']},
                'flush': True,
                'suite': 'added',
                'truth': {
                    'type': 'added_natural',
                    'kind': e['kind'],
                    'pair': e['pair'],
                    'cluster': e['cluster'],
                    'pairSplit': e['pairSplit'],
                    'reciter': s,
                    'reciterSplit': splits[s],
                    'left': e['leftId'],
                    'right': e['rightId'],
                    'word': e['word'],
                    'phon': e['phon'],
                    'leftWords': e['left'],
                    'prefixWords': e['prefixWords'],
                    'rightWords': e['right'],
                    'audioKeys': e['audio'],
                    'wordStampMs': word_stamp,
                    'repeatsNeighbour': e['repeatsNeighbour'],
                },
            }
            if len(e['audio']) == 1:
                clip['audio'] = MF.audio_path(s, e['audio'][0])
            else:
                clip['parts'] = [{'audio': MF.audio_path(s, k), 'key': k} for k in e['audio']]
            clips.append(clip)
    os.makedirs(OUT, exist_ok=True)
    for name, mine in (
        ('added', [c for c in clips if c['truth']['kind'] != 'between']),
        ('added_between', [c for c in clips if c['truth']['kind'] == 'between']),
    ):
        path = os.path.join(OUT, f'{name}.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(mine, f, ensure_ascii=False, indent=0)
        print(name, 'clips', len(mine), 'clusters', len({c['truth']['cluster'] for c in mine}), T.sha256(path))
    print('skipped', dict(skipped))


if __name__ == '__main__':
    if len(sys.argv) < 2 or sys.argv[1] not in ('plan', 'build'):
        raise SystemExit('usage: pairs.py plan|build')
    plan() if sys.argv[1] == 'plan' else build()
