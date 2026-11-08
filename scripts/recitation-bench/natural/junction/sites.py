"""Natural dropped-last-word sites, from the official text only.

    python3 -I natural/junction/sites.py plan    # sites.json, wanted.json
    python3 -I natural/junction/sites.py build   # junction manifests, after staging

A site is two places in the official Hafs text. X ends '... c L' and the ayah
after X opens with d. Y ends with c and the ayah after Y also opens with d. So a
reader who recites Y and then the ayah after it says 'c d', exactly what the
official text of X would sound like with its last word L left out. No audio is
cut and no text is changed: the event exists between two official passages, as in
W1.

A live run feeds the recordings of Y and its next ayah in order, as QUA cut them
from one file, against the official text of X. The app would have been following X
from its start; here the tracker locks on c when c starts (bench.mjs `trackAt`),
since what comes before c differs.

Each site has a control: the same reciter's recordings of X and its next ayah
against their own text, locked on the same word. L is said there, so a mark on L
is false. Same hypotheses, same word, opposite truth.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import manifests as Mf  # noqa: E402
import text as T  # noqa: E402

OUT = os.path.join(T.OUT, 'junction')
MAN = os.path.join(OUT, 'manifests')
LOCK_CONTEXT = 3
HEAD_WORDS = 2


def next_key(words, key):
    s, a = key.split(':')
    k = f'{s}:{int(a) + 1}'
    return k if k in words else None


def common_prefix(a, b):
    n = 0
    for u, v in zip(a, b):
        if u != v:
            break
        n += 1
    return n


def common_suffix(a, b):
    n = 0
    for u, v in zip(reversed(a), reversed(b)):
        if u != v:
            break
        n += 1
    return n


def type_split(word):
    """Dev or test by the last word itself, so the two share no last-word type."""
    return Mf.pair_split('jtype~' + word)


def find_sites(hafs):
    """Every (X, Y) where Y and its next ayah read as X and its next ayah without
    X's last word. Exact token equality on the official text."""
    keys = T.ayah_keys(hafs)
    by_end = {}
    for y in keys:
        ny = next_key(hafs, y)
        if ny:
            by_end.setdefault((hafs[y][-1], hafs[ny][0]), []).append(y)
    sites = []
    for x in keys:
        t = hafs[x]
        nx = next_key(hafs, x)
        if not nx or len(t) < 2:
            continue
        for y in by_end.get((t[-2], hafs[nx][0]), []):
            if y == x:
                continue
            ny = next_key(hafs, y)
            token = len(t) - 1
            sites.append(
                {
                    'id': f'site~{x}~{y}',
                    'x': x,
                    'nextX': nx,
                    'y': y,
                    'nextY': ny,
                    'token': token,
                    'engineLast': T.engine_word(x, token),
                    'word': t[-1],
                    'wordBefore': t[-2],
                    'nextWord': hafs[nx][0],
                    'left': common_suffix(t[:-1], hafs[y]),
                    'right': common_prefix(hafs[nx], hafs[ny]),
                    'split': type_split(t[-1]),
                }
            )
    return sites


def tail_stamps(meta, key, n, words):
    """[start, end] ms of the ayah's last n engine words, when the row reads them
    once, in order, at its very end. A restart earlier in the ayah does not
    matter: the tracker locks after it."""
    r = meta.get(key)
    if not r or r['engineMap'] is None or len(r['engineMap']) < n:
        return None
    if r['engineMap'][-n:] != list(range(words - n, words)):
        return None
    return r['stamps'][-n:]


def head_clean(meta, key, n):
    """The row opens with the ayah's first n engine words, in order."""
    r = meta.get(key)
    if not r or r['engineMap'] is None:
        return False
    n = min(n, len(r['engineMap']))
    return r['engineMap'][:n] == list(range(n))


def readers(metas, corpus, site):
    """Who reads the site's two passages cleanly around the join."""
    lock = min(LOCK_CONTEXT, site['left'])
    live, control = [], []
    for s, m in metas.items():
        if tail_stamps(m, site['y'], lock, len(corpus[site['y']])) and head_clean(
            m, site['nextY'], HEAD_WORDS
        ):
            live.append(s)
        if tail_stamps(m, site['x'], lock + 1, len(corpus[site['x']])) and head_clean(
            m, site['nextX'], HEAD_WORDS
        ):
            control.append(s)
    return live, control


def plan():
    hafs = T.load_hafs()
    corpus = T.load_corpus()
    sites = find_sites(hafs)
    reciters = Mf.load_reciters()
    slugs = [r['slug'] for r in reciters]
    metas = {s: Mf.load_meta(s, corpus) for s in slugs}
    wanted = {s: set() for s in slugs}
    for site in sites:
        site['live'], site['control'] = readers(metas, corpus, site)
        for s in site['live']:
            wanted[s].update((site['y'], site['nextY']))
        for s in site['control']:
            wanted[s].update((site['x'], site['nextX']))
    os.makedirs(MAN, exist_ok=True)
    with open(os.path.join(OUT, 'sites.json'), 'w', encoding='utf-8') as f:
        json.dump(sites, f, ensure_ascii=False, indent=0)
    missing = {
        s: sorted(k for k in v if not os.path.exists(Mf.audio_path(s, k)))
        for s, v in wanted.items()
    }
    with open(os.path.join(MAN, 'wanted.json'), 'w', encoding='utf-8') as f:
        json.dump(missing, f, ensure_ascii=False, indent=0)
    ms = sum(metas[s][k]['durationMs'] for s, v in missing.items() for k in v)
    types = {}
    for site in sites:
        types.setdefault(site['word'], []).append(site)
    print(f'sites {len(sites)}, last-word types {len(types)}, '
          f"live runs {sum(len(x['live']) for x in sites)}, "
          f"control runs {sum(len(x['control']) for x in sites)}")
    print('dev sites', sum(x['split'] == 'dev' for x in sites),
          'test sites', sum(x['split'] == 'test' for x in sites),
          'dev types', sum(v[0]['split'] == 'dev' for v in types.values()),
          'test types', sum(v[0]['split'] == 'test' for v in types.values()))
    print(f'to stage {sum(len(v) for v in missing.values())} clips, '
          f'{ms / 3.6e6:.2f} h, about {ms / 1000 * 64000 / 1e9:.2f} GB as f32')
    for x in sorted(sites, key=lambda r: (-r['left'] - r['right'], r['x'])):
        print(x['x'], x['word'], '<-', x['y'], x['left'], x['right'], x['split'],
              len(x['live']), len(x['control']))


def build():
    corpus = T.load_corpus()
    reciters = Mf.load_reciters()
    split_of = {r['slug']: r['split'] for r in reciters}
    metas = {s: Mf.load_meta(s, corpus) for s in split_of}
    with open(os.path.join(OUT, 'sites.json'), encoding='utf-8') as f:
        sites = json.load(f)
    live = []
    control = []
    skipped = []
    for site in sites:
        x, y, nx, ny = site['x'], site['y'], site['nextX'], site['nextY']
        lock = min(LOCK_CONTEXT, site['left'])
        words_x = len(corpus[x])
        lock_word = words_x - 1 - lock
        sx, ax = (int(v) for v in x.split(':'))
        base = {
            'site': site['id'],
            'pair': site['id'],
            'pairSplit': site['split'],
            'expectedKey': x,
            'nextKey': nx,
            'target': site['engineLast'],
            'position': 'last',
            'word': site['word'],
            'wordBefore': site['wordBefore'],
            'nextWord': site['nextWord'],
            'left': site['left'],
            'right': site['right'],
            'lockWord': lock_word,
            'words': words_x,
        }
        if site['engineLast'] != words_x - 1:
            raise SystemExit(f'{site["id"]}: last word number disagrees')
        where = {'surah': sx, 'ayah': ax, 'word': lock_word, 'ayahEnd': int(nx.split(':')[1])}
        # When the next ayah's first word starts in its recording, for latency.
        onset = lambda s, key: metas[s][key]['stamps'][0][0]

        def one_sitting(s, a, b):
            """QUA cut the two rows from one file, close together, as the pool asks."""
            r, n = metas[s][a], metas[s][b]
            gap = n['offsetMs'] - r['offsetMs'] - r['durationMs']
            ok = r['source'] == n['source'] and Mf.MIN_SOURCE_GAP_MS <= gap <= Mf.MAX_SOURCE_GAP_MS
            if not ok:
                skipped.append((s, a, b, gap))
            return ok

        for s in site['live']:
            if not (Mf.have(s, y) and Mf.have(s, ny)):
                raise SystemExit(f'not staged: {s} {y} {ny}')
            if not one_sitting(s, y, ny):
                continue
            start = tail_stamps(metas[s], y, lock, len(corpus[y]))[0][0]
            live.append(
                {
                    'id': f"jl__{s}__{Mf.safe(x)}__{Mf.safe(y)}",
                    'parts': [
                        {'audio': Mf.audio_path(s, y), 'key': y},
                        {'audio': Mf.audio_path(s, ny), 'key': ny},
                    ],
                    'trackAt': {**where, 't': start / 1000},
                    'hint': Mf.ref(x),
                    'suite': 'junction_live',
                    'truth': {
                        **base,
                        'type': 'junction',
                        'audioKey': y,
                        'nextOnsetMs': onset(s, ny),
                        'reciter': s,
                        'reciterSplit': split_of[s],
                    },
                }
            )
        for s in site['control']:
            if not (Mf.have(s, x) and Mf.have(s, nx)):
                raise SystemExit(f'not staged: {s} {x} {nx}')
            if not one_sitting(s, x, nx):
                continue
            start = tail_stamps(metas[s], x, lock + 1, words_x)[0][0]
            control.append(
                {
                    'id': f"jc__{s}__{Mf.safe(x)}__{Mf.safe(y)}",
                    'parts': [
                        {'audio': Mf.audio_path(s, x), 'key': x},
                        {'audio': Mf.audio_path(s, nx), 'key': nx},
                    ],
                    'trackAt': {**where, 't': start / 1000},
                    'hint': Mf.ref(x),
                    'suite': 'junction_control',
                    'truth': {
                        **base,
                        'type': 'junction_control',
                        'audioKey': x,
                        'nextOnsetMs': onset(s, nx),
                        'reciter': s,
                        'reciterSplit': split_of[s],
                    },
                }
            )
    for name, rows in (('junction_live', live), ('junction_control', control)):
        with open(os.path.join(MAN, f'{name}.json'), 'w', encoding='utf-8') as f:
            json.dump(rows, f, ensure_ascii=False)
    print(f'live {len(live)}, control {len(control)}, sites {len(sites)}, '
          f'left out as not one sitting {len(skipped)}: {skipped[:6]}')


if __name__ == '__main__':
    if len(sys.argv) < 2 or sys.argv[1] not in ('plan', 'build'):
        raise SystemExit('usage: sites.py plan|build')
    plan() if sys.argv[1] == 'plan' else build()
