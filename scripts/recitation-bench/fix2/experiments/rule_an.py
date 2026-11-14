"""Offline what-if on probe lines: how other anchoring and ripeness rules would mark.

  python3 -I fix2/experiments/rule_an.py <clean tag> <planted tag> [--list RULE] [--events RULE]

Reads .out/fix2/sim/<clean tag> and .out/fix2/planted/<planted tag>; the batches must
have probe lines (run with --cfg '{"probeSeconds":0.5}' or lower, so early looks are
kept). --list RULE prints that rule's false marks, --events RULE the planted mistakes it
did not catch, with their probe lines. Places only, never letters.

Each probe line is one look at a word that did not read right. A rule says which looks
count as 'bad'; a word is marked when two looks count, or one with a very wide gap.
Clean files give false marks, planted files give catches (and false marks beside them).
This is an estimate: the real check's later steps depend on its own verdicts. need()
copies the check's defaults (changedGap 6, changedGapPerLetter 2): change it with them.
"""
import collections
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..', '.out', 'fix2')
if len(sys.argv) < 3 or sys.argv[1].startswith('--') or sys.argv[2].startswith('--'):
    sys.exit('usage: python3 -I fix2/experiments/rule_an.py <clean tag> <planted tag> [--list RULE] [--events RULE]')
clean_tag, planted_tag = sys.argv[1], sys.argv[2]
show = sys.argv[sys.argv.index('--list') + 1] if '--list' in sys.argv else None
evshow = sys.argv[sys.argv.index('--events') + 1] if '--events' in sys.argv else None

MISTAKES = ['wrong_word', 'skip_word', 'skip_first_word', 'skip_last_word']


def need(p):
    return min(6, 2 * p['letters'])


def exact(x):
    return x == 0


def near(x, lim=0.34):
    return 0 <= x <= lim


def strong(p, times=1.0, share=0.2):
    return p['gap'] >= need(p) * times and (p['kind'] == 'missed' or p['share'] >= share)


def a_current(p):
    return p['anchored']


def a_both_near(p):
    l2, l1, r1, r2 = p['around']
    return near(l1) and near(r1)


def a_one_exact_other_near(p):
    l2, l1, r1, r2 = p['around']
    return (exact(l1) and near(r1)) or (near(l1) and exact(r1))


def a_two_of_side(p):
    l2, l1, r1, r2 = p['around']
    return (exact(l1) or exact(l2)) and (exact(r1) or exact(r2))


def a_pair_one_side(p):
    l2, l1, r1, r2 = p['around']
    return (exact(l1) and exact(l2)) or (exact(r1) and exact(r2))


def a_any3(p):
    l2, l1, r1, r2 = p['around']
    return sum(1 for x in (l2, l1, r1, r2) if exact(x)) >= 3


def a_left_exact(p):
    l2, l1, r1, r2 = p['around']
    return exact(l1)


def a_right_exact(p):
    l2, l1, r1, r2 = p['around']
    return exact(r1)


def ripe(p):
    return p['outcome'] != 'early'


def cur(p):
    """The check's own rule: a look, or settled at once on a wide gap."""
    if not (ripe(p) and strong(p) and a_current(p)):
        return 0
    return 2 if p['gap'] >= need(p) * 2 else 1


def plus(extra):
    """The check's own rule, plus looks that pass `extra` (which returns 0/1/2)."""
    return lambda p: max(cur(p), extra(p))


def look(anchor, times=1.0, wide=2.0, min_gap=0.0, early=None):
    def f(p):
        ok_time = ripe(p) or (early is not None and p['after'] >= early)
        if not (ok_time and strong(p, times) and p['gap'] >= min_gap and anchor(p)):
            return 0
        return 2 if p['gap'] >= need(p) * wide else 1
    return f


RULES = {
    'current': cur,
    'bothNear': plus(look(a_both_near)),
    'oneExactOtherNear': plus(look(a_one_exact_other_near)),
    'twoOfSide': plus(look(a_two_of_side)),
    'twoOfSide|bothNear': plus(lambda p: max(look(a_two_of_side)(p), look(a_both_near)(p))),
    'pairOneSide_x3': plus(look(a_pair_one_side, 3.0, 99)),
    'pairOneSide_x2': plus(look(a_pair_one_side, 2.0, 99)),
    'any3': plus(look(a_any3, 1.0, 99)),
    'oneExact_g20': plus(look(lambda p: a_left_exact(p) or a_right_exact(p), 1.0, 99, 20)),
    'oneExact_g40': plus(look(lambda p: a_left_exact(p) or a_right_exact(p), 1.0, 99, 40)),
    'none_g20': plus(look(lambda p: True, 1.0, 99, 20)),
    'none_g40': plus(look(lambda p: True, 1.0, 99, 40)),
    'none': plus(look(lambda p: True, 1.0, 99)),
    # early looks, the check's own anchors
    'early0.5': plus(look(a_current, 1.0, 2.0, 0, 0.5)),
    'early1.0': plus(look(a_current, 1.0, 2.0, 0, 1.0)),
    'early1.5': plus(look(a_current, 1.0, 2.0, 0, 1.5)),
    'early1.0_x2': plus(look(a_current, 2.0, 99, 0, 1.0)),
    'early1.0_x2_once': plus(look(a_current, 2.0, 1.0, 0, 1.0)),
    'early0.5_x3_once': plus(look(a_current, 3.0, 1.0, 0, 0.5)),
    'early1.0_twoOfSide': plus(lambda p: max(look(a_two_of_side)(p), look(a_current, 1.0, 2.0, 0, 1.0)(p), look(a_two_of_side, 1.0, 2.0, 0, 1.0)(p))),
}


def marks(probes, rule):
    test = RULES[rule]
    by = collections.OrderedDict()
    for p in probes:
        by.setdefault((p['key'], p['reading']), []).append(p)
    out = []
    for (key, reading), ps in by.items():
        run = 0
        for p in ps:
            got = test(p)
            if got:
                run += 1
                if run >= 2 or got >= 2:
                    out.append({'key': key, 'reading': reading, 'kind': p['kind'], 't': p.get('t'), 'gap': p['gap'], 'share': p['share'], 'p': p})
                    break
            else:
                run = 0
    return out


def load(tag, planted):
    files = []
    d = os.path.join(ROOT, 'planted' if planted else 'sim', tag)
    # Planted results only: score_planted.mjs leaves _score.json beside them.
    pattern = '*.s[0-9]*.json' if planted else '*.json'
    for f in sorted(glob.glob(os.path.join(d, pattern))):
        sim = json.load(open(f))
        stem = os.path.basename(f)[:-5]
        truth = None
        if planted:
            truth = json.load(open(os.path.join(ROOT, 'planted', stem + '.truth.json')))
        files.append((stem, sim, truth))
    return files


clean = load(clean_tag, False)
planted = load(planted_tag, True)
judged_clean = sum(s['judgedKeys'] for _, s, _ in clean)
judged_planted = sum(s['judgedKeys'] for _, s, _ in planted)
print(f'clean {clean_tag}: {len(clean)} files, {judged_clean} words judged; planted {planted_tag}: {len(planted)} files, {judged_planted} judged')
n_ev = collections.Counter()
for _, _, truth in planted:
    for e in truth['events']:
        if e['type'] in MISTAKES and not (e['type'] == 'skip_last_word' and e['word'] != e['words']):
            n_ev[e['type']] += 1
print('events:', dict(n_ev))
print(f"{'rule':24} {'cleanFalse':>10} {'/1000':>6} | " + ' '.join(f'{t[:12]:>12}' for t in MISTAKES) + f" | {'plFalse':>7}")
for rule in RULES:
    false_clean = []
    for stem, sim, _ in clean:
        for m in marks(sim['probes'], rule):
            false_clean.append((stem, m))
    caught = collections.Counter()
    false_pl = []
    for stem, sim, truth in planted:
        ms = marks(sim['probes'], rule)
        explained = set()
        for e in truth['events']:
            s, a = map(int, e['key'].split(':'))
            if e['type'] in MISTAKES:
                if e['type'] == 'skip_last_word' and e['word'] != e['words']:
                    continue
                nearm = [m for m in ms if any(m['key'] == f"{s}:{a}:{e['word'] - 1 + k}" for k in (-1, 0, 1))]
                for m in nearm:
                    explained.add(id(m))
                if nearm:
                    caught[e['type']] += 1
                elif evshow == rule:
                    print(f"   UNCAUGHT {stem} {e['type']} {s}:{a}:{e['word'] - 1} of {e['words']} words")
                    for p in sim['probes']:
                        if any(p['key'] == f"{s}:{a}:{e['word'] - 1 + k}" for k in (-1, 0, 1)):
                            print(f"       {p['key']}#{p['reading']} run={p['run']} {p['kind']} share={p['share']:.2f} gap={p['gap']:.1f} after={p['after']:.2f} around={[round(x, 2) for x in p['around']]} lead={p['lead']} end={p['end']} over={p['over']} closing={p['closing']} outcome={p['outcome']}")
            elif e['type'] == 'skip_ayah':
                for m in ms:
                    s2, a2, w2 = map(int, m['key'].split(':'))
                    if s2 == s and (a2 == a or (a2 == a + 1 and w2 < 3)):
                        explained.add(id(m))
            elif e['type'] == 'skip_then_fix':
                for m in ms:
                    if any(m['key'] == f"{s}:{a}:{e['word'] - 1 + k}" for k in (-1, 0, 1)):
                        explained.add(id(m))
        for m in ms:
            if id(m) not in explained:
                s, a, w = map(int, m['key'].split(':'))
                on = next((e['type'] for e in truth['events'] if e['key'] == f'{s}:{a}'), 'nothing')
                false_pl.append((stem, m, on))
    line = f"{rule:24} {len(false_clean):>10} {1000 * len(false_clean) / max(1, judged_clean):>6.2f} | "
    line += ' '.join(f"{caught[t]:>5}/{n_ev[t]:<6}" for t in MISTAKES)
    line += f" | {len(false_pl):>7}"
    print(line)
    if show == rule:
        for stem, m in false_clean:
            p = m['p']
            print(f"   CLEAN {stem} {m['key']}#{m['reading']} {m['kind']} share={p['share']:.2f} gap={p['gap']:.1f} after={p['after']:.2f} around={[round(x, 2) for x in p['around']]} lead={p['lead']} end={p['end']} over={p['over']} outcome={p['outcome']} letters={p['letters']}")
        for stem, m, on in false_pl:
            p = m['p']
            print(f"   PLANT {stem} {m['key']}#{m['reading']} {m['kind']} on={on} share={p['share']:.2f} gap={p['gap']:.1f} after={p['after']:.2f} around={[round(x, 2) for x in p['around']]} outcome={p['outcome']}")
