"""Tell false marks from real ones by the engine's word scores.

python3 -I analyze.py <rundir> [<rundir> ...]

Each rundir is laid out as score.py expects. Every mark the app would show
(same rules as score.py) is labelled FALSE when it comes from a clean
recitation, or REAL when it lands on a planted mistake, together with the
engine's scores when the word first went bad. Prints both groups, then how
candidate extra rules trade false marks against real ones.
"""
import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
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


def shown(run):
    """Marks the app would show: id -> (state, scores when first bad)."""
    locked = locked_fn(run)
    chains = {}
    for c in run['vchanges']:
        if locked(c['t']):
            chains.setdefault(c['id'], []).append(c)
    last = {}
    for c in run['vchanges']:
        s, a, w = map(int, c['id'].split(':'))
        last[(s, a)] = max(last.get((s, a), 0), w)
    skipped = {f['key'] for f in run['flags'] if f['kind'] == 'possible_skipped_ayah'}
    out = {}
    for i, chain in chains.items():
        s, a, w = map(int, i.split(':'))
        if f'{s}:{a}' in skipped or (w < AFTER_SKIP_WORDS and f'{s}:{a - 1}' in skipped):
            continue
        boundary = w == 0 or w == last.get((s, a), -1)
        for n, c in enumerate(chain):
            bad = c['to'] == 'skipped' or (c['to'] == 'wrong' and not boundary)
            if not bad:
                continue
            nxt = chain[n + 1]['t'] if n + 1 < len(chain) else float('inf')
            if nxt - c['t'] >= CONFIRM:
                out[i] = (c['to'], c.get('d') or {})
                break
    return out


false, real = [], []
for rundir in sys.argv[1:]:
    cond = os.path.basename(rundir.rstrip('/'))
    for clean in glob.glob(os.path.join(rundir, 'clean_*.json')):
        with open(clean) as f:
            run = json.load(f)
        for i, (state, d) in shown(run).items():
            false.append((cond, os.path.basename(clean), i, state, d))
    for p in glob.glob(os.path.join(rundir, '*__*.json')):
        rid, case = os.path.basename(p)[:-5].split('__')
        with open(os.path.join(rundir, f'cases_{rid}', 'cases.json')) as f:
            truth = {c['name']: c['truth'] for c in json.load(f)}[case]
        want = set()
        for t in truth:
            if t['kind'] != 'skippedAyah':
                s, a = t['key'].split(':')
                want |= {f'{s}:{a}:{t["word"] - 1 + k}' for k in (-1, 0, 1)}
        with open(p) as f:
            run = json.load(f)
        for i, (state, d) in shown(run).items():
            if i in want:
                real.append((cond, f'{rid}__{case}', i, state, d))


def show(group, name):
    print(f'\n{name}: {len(group)}')
    for cond, run, i, state, d in sorted(group):
        print(f"  {cond:24s} {run:30s} {i:9s} {state:8s} " + ' '.join(f'{k}={v}' for k, v in d.items() if v is not None))


show(false, 'FALSE marks (clean recitation)')
show(real, 'REAL marks (planted mistakes)')

RULES = {
    'none': lambda st, d: True,
    'wrong needs distance>=0.5': lambda st, d: st != 'wrong' or (d.get('distance') or 0) >= 0.5,
    'wrong needs distance>=0.6': lambda st, d: st != 'wrong' or (d.get('distance') or 0) >= 0.6,
    'wrong needs distance>=0.7': lambda st, d: st != 'wrong' or (d.get('distance') or 0) >= 0.7,
    'wrong needs margin>=0.5': lambda st, d: st != 'wrong' or (d.get('margin') or 0) >= 0.5,
    'skipped needs heardRatio<=0.2': lambda st, d: st != 'skipped' or (d.get('heardRatio') or 0) <= 0.2,
    'skipped needs heardRatio<=0.1': lambda st, d: st != 'skipped' or (d.get('heardRatio') or 0) <= 0.1,
    'gop<=-1 when present': lambda st, d: d.get('gop') is None or d['gop'] <= -1,
    'gop<=-2 when present': lambda st, d: d.get('gop') is None or d['gop'] <= -2,
}
print('\nrule                                   false kept   real kept')
for name, rule in RULES.items():
    fk = sum(1 for _, _, _, st, d in false if rule(st, d))
    rk = sum(1 for _, _, _, st, d in real if rule(st, d))
    print(f'  {name:36s} {fk:4d}/{len(false):<4d}   {rk:4d}/{len(real)}')
