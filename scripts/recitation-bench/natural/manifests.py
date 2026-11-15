"""Builds the bench manifests of the natural benchmark from the pinned text and
QUA's metadata.

    python3 -I natural/manifests.py plan     # writes wanted.json (audio to stage)
    python3 -I natural/manifests.py build    # writes the suites, after staging

Suites, each a bench.mjs --list manifest under .out/natural/manifests/:

- w1: an authentic recording of ayah Y against the official text of its twin X,
  in the app's correction state, flushed at the end.
- w1_control: the same recordings against their own text.
- pool: consecutive whole ayat of one surah in the app's flow, from tracking.
- w5: phenomena sites against their own text; mid-surah starts in the app's flow.

Every clip carries its truth under `truth`. A recording fed with another after it
was cut by QUA from one continuous file; nothing is written joined.
"""
import hashlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mutashabih as M  # noqa: E402
import text as T  # noqa: E402
import w5 as W5  # noqa: E402

MAN = os.path.join(T.OUT, 'manifests')
AUDIO = os.path.join(T.OUT, 'audio')
META = os.path.join(T.OUT, 'qua_meta')
POOL_WORDS_TARGET = 70000
POOL_READERS_PER_BLOCK = 2
BLOCK_WORDS = 350
# Surah 112 stays out of pools thresholds could be tuned on: it is the Al-Ikhlas test.
POOL_EXCLUDED_SURAHS = {112}
# Longer than this between two clips in the source: not one sitting, start a new take.
MAX_SOURCE_GAP_MS = 5000
MIN_SOURCE_GAP_MS = -100
SITE_READERS = {'madd_lazim': 6, 'silent_alif': 3}
MIDSTART_READERS = 2


def stable(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def load_reciters():
    with open(os.path.join(MAN, 'reciters.json'), encoding='utf-8') as f:
        chosen = json.load(f)['chosen']
    slugs = sorted(r['slug'] for r in chosen)
    # Half the reciters and half the pairs are for tuning; the rest is held out.
    ordered = sorted(slugs, key=stable)
    dev = set(ordered[: len(ordered) // 2])
    return [
        {'slug': s, 'split': 'dev' if s in dev else 'test'} for s in slugs
    ]


def load_meta(slug, corpus):
    rows = {}
    with open(os.path.join(META, f'{slug}.jsonl'), encoding='utf-8') as f:
        for line in f:
            r = json.loads(line)
            key = f"{r['surah']}:{r['ayah']}"
            engine_words = [w[1] for w in corpus[key]]
            recited = T.tokens(r['text_uthmani'])
            mapping, restarts = T.recited_map(recited, engine_words)
            stamps = r['word_timestamps']
            pauses = [b[1] - a[2] for a, b in zip(stamps, stamps[1:])]
            rows[key] = {
                'key': key,
                'durationMs': r['duration_ms'],
                'offsetMs': r['source_offset_ms'],
                'source': r['source_url'],
                'engineMap': mapping,
                'restarts': restarts,
                'stamps': [[int(s[1]), int(s[2])] for s in stamps],
                'maxPauseMs': max(pauses) if pauses else 0,
            }
    return rows


def audio_path(slug, key):
    s, a = key.split(':')
    return os.path.join(AUDIO, slug, f'{s}_{a}.f32')


def plain(meta, key):
    """A clean row: the official text once, as QUA aligned it."""
    r = meta.get(key)
    return bool(r) and r['engineMap'] is not None and r['restarts'] == 0


def word_stamps(meta, key):
    """Each engine word's [start, end] ms in the clip (plain rows only)."""
    r = meta[key]
    if r['restarts'] != 0 or r['engineMap'] is None:
        return None
    out = {}
    for i, w in enumerate(r['engineMap']):
        out[w] = r['stamps'][i]
    return out


def ref(key):
    s, a = (int(x) for x in key.split(':'))
    return {'surah': s, 'ayah': a}


def pair_split(pair_id):
    return 'dev' if int(stable(pair_id)[:8], 16) % 2 == 0 else 'test'


def w1_events(pairs):
    """Every direction of every pair, as (audio key, next audio key, expected
    key, truth). One event per direction; `pair` is the independent unit."""
    events = []
    for p in pairs:
        pid = p['id']
        split = pair_split(pid)
        if p['type'] == 'sub':
            for audio, expected, target, heard in (
                (p['a'], p['b'], p['engineB'], p['wordA']),
                (p['b'], p['a'], p['engineA'], p['wordB']),
            ):
                events.append(
                    {
                        'audio': audio,
                        'expected': expected,
                        'truth': {
                            'type': 'trap' if p['spellingOnly'] else 'changed',
                            'pair': pid,
                            'pairSplit': split,
                            'target': target,
                            'position': p['position'],
                            'close': p['close'],
                            'textDistance': p['textDistance'],
                            'phonDistance': p['phonDistance'],
                            'expectedWord': p['wordB'] if expected == p['b'] else p['wordA'],
                            'heardWord': heard,
                        },
                    }
                )
        elif p['type'] in ('indel', 'short_indel'):
            base = {
                'pair': pid,
                'pairSplit': split,
                'position': p['position'],
                'word': p['word'],
                'short': p['type'] == 'short_indel',
            }
            events.append(
                {
                    'audio': p['short'],
                    'expected': p['long'],
                    'truth': {**base, 'type': 'skipped', 'target': p['engineLong']},
                }
            )
            events.append(
                {
                    'audio': p['long'],
                    'expected': p['short'],
                    'truth': {**base, 'type': 'added', 'target': p['engineShort'], 'gapBefore': True},
                }
            )
        elif p['type'] == 'drop_last':
            events.append(
                {
                    'audio': p['short'],
                    'expected': p['long'],
                    'startWord': p['engineStart'],
                    'truth': {
                        'type': 'dropped_last',
                        'pair': pid,
                        'pairSplit': split,
                        'target': p['engineLong'],
                        'position': 'last',
                        'word': p['word'],
                        'wholeAyah': p['wholeAyah'],
                    },
                }
            )
            if p['wholeAyah']:
                events.append(
                    {
                        'audio': p['long'],
                        'expected': p['short'],
                        'truth': {
                            'type': 'added_last',
                            'pair': pid,
                            'pairSplit': split,
                            'position': 'last',
                            'word': p['word'],
                            'target': None,
                        },
                    }
                )
        elif p['type'] == 'junction':
            events.append(
                {
                    'audio': p['short'],
                    'next': p['nextShort'],
                    'expected': p['long'],
                    'truth': {
                        'type': 'junction',
                        'pair': pid,
                        'pairSplit': split,
                        'target': p['engineLong'],
                        'position': 'last',
                        'word': p['word'],
                        'nextWordsInCommon': p['nextWordsInCommon'],
                    },
                }
            )
    return events


def pool_blocks(hafs):
    """Consecutive whole ayat of one surah, about BLOCK_WORDS words each."""
    blocks = []
    by_surah = {}
    for key in T.ayah_keys(hafs):
        by_surah.setdefault(int(key.split(':')[0]), []).append(key)
    for s, keys in sorted(by_surah.items()):
        if s in POOL_EXCLUDED_SURAHS:
            continue
        current, n = [], 0
        mine = []
        for k in keys:
            current.append(k)
            n += len(hafs[k])
            if n >= BLOCK_WORDS:
                mine.append(current)
                current, n = [], 0
        if current:
            if mine and n < BLOCK_WORDS / 3:
                mine[-1].extend(current)
            else:
                mine.append(current)
        blocks.extend(mine)
    return blocks


def choose_pool_blocks(blocks, hafs):
    """All short surahs, then every k-th longer block, spread over the mushaf."""
    words = [sum(len(hafs[k]) for k in b) for b in blocks]
    target_text = POOL_WORDS_TARGET / POOL_READERS_PER_BLOCK
    short = [i for i, n in enumerate(words) if n < BLOCK_WORDS / 2]
    taken = set(short)
    have = sum(words[i] for i in short)
    rest = [i for i in range(len(blocks)) if i not in taken]
    mean = sum(words[i] for i in rest) / max(1, len(rest))
    want = max(1, int(round((target_text - have) / mean)))
    step = len(rest) / want
    i = 0.0
    while int(i) < len(rest) and have < target_text:
        taken.add(rest[int(i)])
        have += words[rest[int(i)]]
        i += step
    return sorted(taken)


def assign_readers(chosen, blocks, hafs, reciters, metas):
    """Gives each block two reciters, keeping word counts level and pairs varied."""
    load = {r: 0 for r in reciters}
    together = {}
    out = []
    order = sorted(chosen, key=lambda i: -sum(len(hafs[k]) for k in blocks[i]))
    for i in order:
        n = sum(len(hafs[k]) for k in blocks[i])
        has = [
            r for r in reciters
            if sum(k in metas[r] for k in blocks[i]) >= 0.9 * len(blocks[i])
        ]
        picks = []
        for _ in range(POOL_READERS_PER_BLOCK):
            best = min(
                (r for r in has if r not in picks),
                key=lambda r: (
                    load[r],
                    together.get(tuple(sorted((r, picks[0]))), 0) if picks else 0,
                    stable(r + str(i)),
                ),
            )
            picks.append(best)
            load[best] += n
        pair = tuple(sorted(picks))
        together[pair] = together.get(pair, 0) + 1
        out.append((i, picks))
    return sorted(out), load


def plan():
    hafs = T.load_hafs()
    corpus = T.load_corpus()
    reciters = load_reciters()
    slugs = [r['slug'] for r in reciters]
    metas = {s: load_meta(s, corpus) for s in slugs}
    with open(os.path.join(MAN, 'w1_pairs.json'), encoding='utf-8') as f:
        built = json.load(f)
    wanted = {s: set() for s in slugs}
    # W1: every clean recording of every ayah in a pair.
    events = w1_events(built['pairs'])
    for ev in events:
        for s in slugs:
            if plain(metas[s], ev['audio']) and (
                'next' not in ev or metas[s].get(ev['next'])
            ):
                wanted[s].add(ev['audio'])
                if 'next' in ev:
                    wanted[s].add(ev['next'])
    # Pool.
    blocks = pool_blocks(hafs)
    chosen = choose_pool_blocks(blocks, hafs)
    assigned, load = assign_readers(chosen, blocks, hafs, slugs, metas)
    pool_plan = []
    for i, picks in assigned:
        pool_plan.append({'block': i, 'ayat': blocks[i], 'readers': picks})
        for s in picks:
            wanted[s].update(k for k in blocks[i] if k in metas[s])
    # W5.
    site_table = W5.sites()
    w5_items = []
    rotation = 0
    for category, entries in sorted(site_table.items()):
        if category == 'idgham_across':
            continue  # scored on the pool: it has thousands of them
        keys = sorted({e['key'] for e in entries}, key=lambda k: tuple(int(x) for x in k.split(':')))
        for key in keys:
            readers = slugs
            n = SITE_READERS.get(category)
            if n:
                readers = [slugs[(rotation + j) % len(slugs)] for j in range(n)]
                rotation += n
            parts = [key] + ([W5.IN_ORDER[key]] if key in W5.IN_ORDER else [])
            for s in readers:
                if all(p in metas[s] for p in parts):
                    w5_items.append(
                        {'category': category, 'key': key, 'parts': parts, 'reader': s}
                    )
                    wanted[s].update(parts)
    # Every long pause inside an ayah among these reciters.
    for s in slugs:
        for key, r in metas[s].items():
            if r['maxPauseMs'] >= 3000:
                w5_items.append({'category': 'pause_over_3s', 'key': key, 'parts': [key], 'reader': s})
                wanted[s].add(key)
    # Mid-surah starts: whole ayat of W1, started by search in the app's flow.
    w1_ayat = sorted({ev['audio'] for ev in events}, key=lambda k: tuple(int(x) for x in k.split(':')))
    mid = [k for k in w1_ayat if int(k.split(':')[1]) > 1]
    for n, key in enumerate(mid):
        for j in range(MIDSTART_READERS):
            s = slugs[(n * MIDSTART_READERS + j) % len(slugs)]
            if plain(metas[s], key):
                w5_items.append({'category': 'midstart', 'key': key, 'parts': [key], 'reader': s})
                wanted[s].add(key)
    # The basmala as an ayah: the one place QUA has it.
    for s in slugs:
        if '1:1' in metas[s]:
            w5_items.append({'category': 'basmala', 'key': '1:1', 'parts': ['1:1'], 'reader': s})
            wanted[s].add('1:1')
    os.makedirs(MAN, exist_ok=True)
    with open(os.path.join(MAN, 'wanted.json'), 'w', encoding='utf-8') as f:
        json.dump({s: sorted(v) for s, v in wanted.items()}, f, ensure_ascii=False, indent=0)
    with open(os.path.join(MAN, 'pool_plan.json'), 'w', encoding='utf-8') as f:
        json.dump(pool_plan, f, ensure_ascii=False, indent=0)
    with open(os.path.join(MAN, 'w5_items.json'), 'w', encoding='utf-8') as f:
        json.dump(w5_items, f, ensure_ascii=False, indent=0)
    with open(os.path.join(MAN, 'w5_sites.json'), 'w', encoding='utf-8') as f:
        json.dump(site_table, f, ensure_ascii=False, indent=0)
    ms = sum(metas[s][k]['durationMs'] for s, v in wanted.items() for k in v if k in metas[s])
    print(f'wanted clips {sum(len(v) for v in wanted.values())}, {ms / 3.6e6:.1f} h, '
          f'about {ms / 1000 * 64000 / 1e9:.1f} GB as f32')
    print('pool blocks', len(pool_plan), 'of', len(blocks), 'words per reciter', sorted(load.values()))
    print('w5 items', {c: sum(i['category'] == c for i in w5_items) for c in sorted({i['category'] for i in w5_items})})
    print('w5 sites', {c: len(v) for c, v in site_table.items()})


def learner_clips():
    """Local learner sets, each clip alone in the correction state with its place
    known: Al-Ikhlas (the dev half by participant; the test half is kept for one
    report) and sobolev's Hafs clips. Word numbers there are 1-based."""
    root = os.path.join(T.BENCH, '.out/datasets')
    clips = []
    ikhlas = os.path.join(root, 'al-ikhlas/manifest.json')
    if os.path.exists(ikhlas):
        with open(ikhlas, encoding='utf-8') as f:
            rows = json.load(f)
        for r in rows:
            if r['label'] not in ('correct', 'incorrect'):
                continue
            who = r['id'].split('/')[1].split('V')[0]
            if int(stable('ikhlas' + who)[:8], 16) % 2:
                continue
            key = f"{r['surah']}:{r['ayahStart']}"
            clips.append(
                {
                    'id': f"learners__al-ikhlas__{r['id'].split('/')[1]}",
                    'audio': r['audio'],
                    'expected': ref(key),
                    'hint': ref(key),
                    'flush': True,
                    'suite': 'learners',
                    'truth': {
                        'type': 'learner',
                        'dataset': 'al-ikhlas',
                        'split': 'dev',
                        'label': r['label'],
                        'speaker': who,
                        'expectedKey': key,
                        'audioKey': key,
                        'errors': [
                            {'id': _learner_word(e['word']), 'class': e.get('class')}
                            for e in r.get('errorWords', [])
                            if e.get('word')
                        ],
                    },
                }
            )
    sobolev = os.path.join(root, 'sobolev-errors/manifest.json')
    if os.path.exists(sobolev):
        with open(sobolev, encoding='utf-8') as f:
            rows = json.load(f)
        for r in rows:
            if r['ayahStart'] != r['ayahEnd']:
                continue
            key = f"{r['surah']}:{r['ayahStart']}"
            expected = ref(key)
            start = int(r.get('wordStart') or 1) - 1
            if start > 0:
                expected['word'] = start
            clips.append(
                {
                    'id': f"learners__sobolev__{r['id'].split('/')[1]}",
                    'audio': r['audio'],
                    'expected': expected,
                    'hint': ref(key),
                    'flush': True,
                    'suite': 'learners',
                    'truth': {
                        'type': 'learner',
                        'dataset': 'sobolev',
                        'label': r['label'],
                        'speaker': r.get('recording'),
                        'expectedKey': key,
                        'audioKey': key,
                        'wordStart': start,
                        'wordEnd': int(r.get('wordEnd') or 0),
                        'errors': [
                            {'id': _learner_word(e['word']), 'class': ','.join(e.get('categories') or [])}
                            for e in r.get('errorWords', [])
                            if e.get('word')
                        ],
                    },
                }
            )
    return clips


def _learner_word(word):
    s, a, w = word.split(':')
    return f'{s}:{a}:{int(w) - 1}'


def clip_base(slug, key, nxt=None):
    if nxt:
        return {'parts': [{'audio': audio_path(slug, key), 'key': key}, {'audio': audio_path(slug, nxt), 'key': nxt}]}
    return {'audio': audio_path(slug, key)}


def have(slug, key):
    return os.path.exists(audio_path(slug, key))


def safe(key):
    return key.replace(':', '_')


def build():
    hafs = T.load_hafs()
    corpus = T.load_corpus()
    reciters = load_reciters()
    split_of = {r['slug']: r['split'] for r in reciters}
    slugs = [r['slug'] for r in reciters]
    metas = {s: load_meta(s, corpus) for s in slugs}
    with open(os.path.join(MAN, 'w1_pairs.json'), encoding='utf-8') as f:
        built = json.load(f)
    events = w1_events(built['pairs'])
    w1 = []
    control = {}
    masked = 0
    for ev in events:
        for s in slugs:
            m = metas[s]
            if not plain(m, ev['audio']):
                masked += 1
                continue
            if 'next' in ev and not m.get(ev['next']):
                masked += 1
                continue
            if not have(s, ev['audio']):
                raise SystemExit(f'not staged: {s} {ev["audio"]}')
            expected = {**ref(ev['expected'])}
            if ev.get('startWord'):
                expected['word'] = ev['startWord']
            truth = {
                **ev['truth'],
                'audioKey': ev['audio'],
                'expectedKey': ev['expected'],
                'words': len(corpus[ev['expected']]),
                'reciter': s,
                'reciterSplit': split_of[s],
                'stamps': word_stamps(m, ev['audio']),
                'startWord': ev.get('startWord', 0),
            }
            w1.append(
                {
                    'id': f"w1__{s}__{ev['truth']['type']}__{safe(ev['audio'])}__{safe(ev['expected'])}",
                    **clip_base(s, ev['audio'], ev.get('next')),
                    'expected': expected,
                    'hint': ref(ev['expected']),
                    'flush': True,
                    'suite': 'w1',
                    'truth': truth,
                }
            )
            control[(s, ev['audio'])] = None
    w1_control = []
    for (s, key) in sorted(control):
        w1_control.append(
            {
                'id': f'w1c__{s}__{safe(key)}',
                'audio': audio_path(s, key),
                'expected': ref(key),
                'hint': ref(key),
                'flush': True,
                'suite': 'w1_control',
                'truth': {
                    'type': 'control',
                    'audioKey': key,
                    'expectedKey': key,
                    'words': len(corpus[key]),
                    'reciter': s,
                    'reciterSplit': split_of[s],
                    'stamps': word_stamps(metas[s], key),
                },
            }
        )

    # Pool: consecutive ayat; a new take where the source has a long gap or a row is missing.
    with open(os.path.join(MAN, 'pool_plan.json'), encoding='utf-8') as f:
        pool_plan = json.load(f)
    pool = []
    joins = []
    for item in pool_plan:
        for s in item['readers']:
            m = metas[s]
            run, last = [], None
            pieces = []
            for k in item['ayat']:
                r = m.get(k)
                if r is None or r['engineMap'] is None:
                    if run:
                        pieces.append(run)
                    run, last = [], None
                    continue
                if last is not None:
                    gap = r['offsetMs'] - last['offsetMs'] - last['durationMs']
                    joins.append(gap)
                    if gap > MAX_SOURCE_GAP_MS or gap < MIN_SOURCE_GAP_MS:
                        pieces.append(run)
                        run = []
                run.append(k)
                last = r
            if run:
                pieces.append(run)
            for n, keys in enumerate(pieces):
                if not all(have(s, k) for k in keys):
                    raise SystemExit(f'not staged: {s} {keys[0]}')
                words = sum(len(corpus[k]) for k in keys)
                pool.append(
                    {
                        'id': f"pool__{s}__{item['block']}_{n}__{safe(keys[0])}",
                        'parts': [{'audio': audio_path(s, k), 'key': k} for k in keys],
                        'hint': ref(keys[0]),
                        'flush': True,
                        'suite': 'pool',
                        'truth': {
                            'type': 'pool',
                            'reciter': s,
                            'reciterSplit': split_of[s],
                            'block': item['block'],
                            'blockSplit': pair_split(f"block{item['block']}"),
                            'words': words,
                            'ayat': [
                                {
                                    'key': k,
                                    'words': len(corpus[k]),
                                    'restarts': m[k]['restarts'],
                                    'maxPauseMs': m[k]['maxPauseMs'],
                                }
                                for k in keys
                            ],
                        },
                    }
                )
    # W5.
    with open(os.path.join(MAN, 'w5_items.json'), encoding='utf-8') as f:
        items = json.load(f)
    with open(os.path.join(MAN, 'w5_sites.json'), encoding='utf-8') as f:
        site_table = json.load(f)
    w5 = []
    seen = set()
    for it in items:
        s, key, category = it['reader'], it['key'], it['category']
        ident = (s, key, category)
        if ident in seen:
            continue
        seen.add(ident)
        if not all(have(s, p) for p in it['parts']):
            continue
        sites = [e['engine'] for e in site_table.get(category, []) if e['key'] == key]
        clip = {
            'id': f"w5__{category}__{s}__{safe(key)}",
            **clip_base(s, key, it['parts'][1] if len(it['parts']) > 1 else None),
            'hint': ref(key),
            'flush': True,
            'suite': 'w5',
            'truth': {
                'type': 'w5',
                'category': category,
                'audioKey': key,
                'expectedKey': key,
                'keys': it['parts'],
                'sites': sites,
                'words': sum(len(corpus[p]) for p in it['parts']),
                'restarts': sum(metas[s][p]['restarts'] for p in it['parts']),
                'reciter': s,
                'reciterSplit': split_of[s],
            },
        }
        if category != 'midstart':
            clip['expected'] = ref(key)
        w5.append(clip)

    learners = learner_clips()
    for name, rows in (
        ('w1', w1),
        ('w1_control', w1_control),
        ('pool', pool),
        ('w5', w5),
        ('learners', learners),
    ):
        with open(os.path.join(MAN, f'{name}.json'), 'w', encoding='utf-8') as f:
            json.dump(rows, f, ensure_ascii=False)
    # Sites for scoring pool marks by phenomenon.
    tags = {}
    for category, entries in site_table.items():
        for e in entries:
            tags.setdefault(category, {}).setdefault(e['key'], []).append(e['engine'])
    with open(os.path.join(MAN, 'w5_tags.json'), 'w', encoding='utf-8') as f:
        json.dump(tags, f, ensure_ascii=False)
    # Word counts for the scorer: the engine's numbers, per ayah.
    with open(os.path.join(MAN, 'engine_words.json'), 'w', encoding='utf-8') as f:
        json.dump({k: len(v) for k, v in corpus.items()}, f)
    # Speed per reciter (words per second of speech), for the speed slice.
    speed = {}
    for s in slugs:
        words = secs = 0.0
        for r in metas[s].values():
            if r['stamps']:
                words += len(r['stamps'])
                secs += (r['stamps'][-1][1] - r['stamps'][0][0]) / 1000
        speed[s] = round(words / max(1e-9, secs), 3)
    with open(os.path.join(MAN, 'reciter_speed.json'), 'w', encoding='utf-8') as f:
        json.dump(speed, f, ensure_ascii=False, indent=0)
    joins.sort()
    types = {}
    for c in w1:
        types[c['truth']['type']] = types.get(c['truth']['type'], 0) + 1
    with open(os.path.join(MAN, 'build_report.json'), 'w', encoding='utf-8') as f:
        json.dump(
            {
                'w1Events': len(w1),
                'w1Masked': masked,
                'w1ByType': types,
                'w1Control': len(w1_control),
                'poolTakes': len(pool),
                'poolWords': sum(c['truth']['words'] for c in pool),
                'poolPassages': len(pool_plan),
                'poolWordsInRestartAyat': sum(
                    a['words'] for c in pool for a in c['truth']['ayat'] if a['restarts']
                ),
                'w5Runs': len(w5),
                'learners': len(learners),
                'sourceGapMs': {
                    'joins': len(joins),
                    'median': joins[len(joins) // 2] if joins else None,
                    'p90': joins[int(len(joins) * 0.9)] if joins else None,
                    'over1s': sum(g > 1000 for g in joins),
                    'over5s': sum(g > MAX_SOURCE_GAP_MS for g in joins),
                },
            },
            f,
            indent=1,
        )
    print(f'w1 {len(w1)} events ({masked} masked), w1_control {len(w1_control)}, '
          f'pool {len(pool)} takes, {sum(c["truth"]["words"] for c in pool)} words, w5 {len(w5)}, '
          f'learners {len(learners)}')
    if joins:
        print('source gap between clips ms: '
              f'median {joins[len(joins) // 2]}, p90 {joins[int(len(joins) * 0.9)]}, '
              f'over 1 s {sum(g > 1000 for g in joins) / len(joins):.3f}, '
              f'over {MAX_SOURCE_GAP_MS} ms {sum(g > MAX_SOURCE_GAP_MS for g in joins)}')


if __name__ == '__main__':
    if len(sys.argv) < 2 or sys.argv[1] not in ('plan', 'build'):
        raise SystemExit('usage: manifests.py plan|build')
    plan() if sys.argv[1] == 'plan' else build()
