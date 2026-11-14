"""Try extra mark rules offline on existing bench runs (no re-running).

python3 -I rules.py <rundir> [<rundir> ...]

Starts from the marks the app shows today (score.py's rules) and applies
candidate rules on the verdict timeline. For each rule: false marks on clean
recitations, planted mistakes caught, and how much later marks appear.
"""
import glob
import json
import os
import sys

CONFIRM = 0.5
AFTER_SKIP_WORDS = 3


def locked_fn(run):
    spans, start = [], None
    for e in run['log']:
        if e['type'] == 'word_progress' and start is None:
            start = e['t']
        elif e['type'] == 'debug' and e.get('event') in ('lost', 'idle', 'locateFailed', 'completed') and start is not None:
            spans.append((start, e['t']))
            start = None
    if start is not None:
        spans.append((start, float('inf')))
    return lambda t: any(a <= t <= b for a, b in spans)


def timeline(run):
    locked = locked_fn(run)
    chains, last = {}, {}
    for c in run['vchanges']:
        s, a, w = map(int, c['id'].split(':'))
        last[(s, a)] = max(last.get((s, a), 0), w)
        if locked(c['t']):
            chains.setdefault((s, a, w), []).append((c['t'], c['to']))
    return chains, last


def state_at(chain, t):
    st = None
    for ct, s in chain:
        if ct <= t:
            st = s
    return st


def marks(run, rule):
    """id -> time shown, under the app's rules plus `rule`."""
    chains, last = timeline(run)
    skipped = {f['key'] for f in run['flags'] if f['kind'] == 'possible_skipped_ayah'}
    out = {}
    for (s, a, w), chain in chains.items():
        if f'{s}:{a}' in skipped or (w < AFTER_SKIP_WORDS and f'{s}:{a - 1}' in skipped):
            continue
        boundary = w == 0 or w == last.get((s, a), -1)
        for n, (t, st) in enumerate(chain):
            bad = st == 'skipped' or (st == 'wrong' and not boundary)
            if not bad:
                continue
            nxt = chain[n + 1][0] if n + 1 < len(chain) else float('inf')
            if nxt - t < CONFIRM:
                continue
            shown_at = rule(chains, last, (s, a, w), t)
            if shown_at is not None:
                out[f'{s}:{a}:{w}'] = shown_at - t
            break
    return out


def after_words(last, key, k):
    s, a, w = key
    out = []
    for i in range(1, k + 1):
        if w + i <= last.get((s, a), -1):
            out.append((s, a, w + i))
        else:
            out.append((s, a + 1, w + i - last.get((s, a), w) - 1))
    return out


def next_ok(k, window, hold=CONFIRM):
    """Shown once one of the next k words is heard correctly, within window s."""
    def rule(chains, last, key, t):
        best = None
        for nk in after_words(last, key, k):
            for ct, st in chains.get(nk, []):
                if st == 'ok' and ct >= t and ct - t <= window:
                    best = ct if best is None else min(best, ct)
                    break
        if best is None:
            return None
        show = max(best, t + hold)
        # The word itself must still be bad then.
        return show if state_at(chains[key], show) in ('wrong', 'skipped') else None
    return rule


def isolated(span, window):
    """Dropped when other words within `span` went bad within `window` s."""
    def rule(chains, last, key, t):
        s, a, w = key
        for (s2, a2, w2), chain in chains.items():
            if (s2, a2) != (s, a) or w2 == w or abs(w2 - w) > span:
                continue
            if any(st in ('wrong', 'skipped') and abs(ct - t) <= window for ct, st in chain):
                return None
        return t + CONFIRM
    return rule


def hold(seconds):
    def rule(chains, last, key, t):
        show = t + seconds
        return show if state_at(chains[key], show) in ('wrong', 'skipped') else None
    return rule


RULES = {
    'today': lambda chains, last, key, t: t + CONFIRM,
    'hold 1.0 s': hold(1.0),
    'hold 1.5 s': hold(1.5),
    'next 1 word ok (3 s)': next_ok(1, 3.0),
    'next 2 words ok (3 s)': next_ok(2, 3.0),
    'next 2 words ok (4 s)': next_ok(2, 4.0),
    'isolated (2 words, 3 s)': isolated(2, 3.0),
}


def truth_ids(rundir, rid, case):
    with open(os.path.join(rundir, f'cases_{rid}', 'cases.json')) as f:
        truth = {c['name']: c['truth'] for c in json.load(f)}[case]
    want = []
    for t in truth:
        if t['kind'] == 'skippedAyah':
            want.append(('ayah', t['key']))
        else:
            s, a = t['key'].split(':')
            want.append(('word', {f'{s}:{a}:{t["word"] - 1 + k}' for k in (-1, 0, 1)}))
    return want


for name, rule in RULES.items():
    line = f'{name:26s}'
    for rundir in sys.argv[1:]:
        false = hit = total = 0
        delays = []
        for clean in glob.glob(os.path.join(rundir, 'clean_*.json')):
            with open(clean) as f:
                run = json.load(f)
            m = marks(run, rule)
            false += len(m) + sum(1 for fl in run['flags'] if fl['kind'] == 'possible_skipped_ayah')
        for p in glob.glob(os.path.join(rundir, '*__*.json')):
            rid, case = os.path.basename(p)[:-5].split('__')
            with open(p) as f:
                run = json.load(f)
            m = marks(run, rule)
            skipped = {fl['key'] for fl in run['flags'] if fl['kind'] == 'possible_skipped_ayah'}
            for kind, want in truth_ids(rundir, rid, case):
                total += 1
                if kind == 'ayah':
                    hit += want in skipped
                else:
                    got = [m[i] for i in want if i in m]
                    if got:
                        hit += 1
                        delays.append(min(got))
        delays.sort()
        med = delays[len(delays) // 2] if delays else 0
        line += f' | {os.path.basename(rundir.rstrip("/"))[:12]:12s} false {false:3d} caught {hit:2d}/{total} +{med:.1f}s'
    print(line)
