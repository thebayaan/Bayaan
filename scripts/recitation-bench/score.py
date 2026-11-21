"""Score bench runs with the app's mark rules (services/recitation/wordMarks.ts).

python3 -I score.py <rundir>

<rundir> holds clean_<rid>.json and <rid>__<case>.json runs, and
cases_<rid>/cases.json with the planted truth. Prints, per reciter and in
total: false marks on clean recitation, planted mistakes caught, and how
long after a word ends its verdict lands.

The rules, as in the app: verdicts count only while the tracker is locked; a
wrong/skipped verdict shows only if it holds CONFIRM seconds; 'wrong' on an
ayah's first or last word does not count; words of an ayah flagged as
skipped, and the first three words of the ayah after it, are left to the
ayah flag.
"""
import glob
import json
import os
import sys

CONFIRM = 0.5
AFTER_SKIP_WORDS = 3
rundir = sys.argv[1]


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


def marks(run):
    locked = locked_fn(run)
    chains = {}
    for c in run['vchanges']:
        if locked(c['t']):
            chains.setdefault(c['id'], []).append((c['t'], c['to']))
    last = {}
    for c in run['vchanges']:
        s, a, w = map(int, c['id'].split(':'))
        last[(s, a)] = max(last.get((s, a), 0), w)
    skipped = {f['key'] for f in run['flags'] if f['kind'] == 'possible_skipped_ayah'}
    shown = set()
    for i, chain in chains.items():
        s, a, w = map(int, i.split(':'))
        if f'{s}:{a}' in skipped or (w < AFTER_SKIP_WORDS and f'{s}:{a - 1}' in skipped):
            continue
        boundary = w == 0 or w == last.get((s, a), -1)
        state = None
        for n, (t, st) in enumerate(chain):
            bad = st == 'skipped' or (st == 'wrong' and not boundary)
            if bad and state is None:
                nxt = chain[n + 1][0] if n + 1 < len(chain) else float('inf')
                if nxt - t >= CONFIRM:
                    state = 'mistake'
            elif state == 'mistake' and st == 'ok':
                state = 'corrected'
        if state == 'mistake':
            shown.add(i)
    return shown | skipped


def caught(truth, got):
    hit = 0
    for t in truth:
        if t['kind'] == 'skippedAyah':
            hit += t['key'] in got
        else:
            s, a = t['key'].split(':')
            w = t['word'] - 1
            hit += any(f'{s}:{a}:{w + d}' in got for d in (-1, 0, 1))
    return hit


def delays(run, timings_path):
    with open(timings_path) as f:
        ref = {v['verse_key']: [x for x in v['segments'] if len(x) >= 3]
               for v in json.load(f)['audio_files'][0]['verse_timings']}
    words = {}
    for c in run['vchanges']:
        s, a, w = c['id'].split(':')
        words[f'{s}:{a}'] = max(words.get(f'{s}:{a}', 0), int(w) + 1)
    out = []
    for c in run['vchanges']:
        if c['from'] != 'pending' or c['to'] == 'pending':
            continue
        s, a, w = c['id'].split(':')
        k = f'{s}:{a}'
        if words.get(k) == len(ref.get(k, [])):
            out.append(c['t'] - ref[k][int(w)][2] / 1000)
    return out


total_false = total_hit = total_truth = 0
all_delays = []
for clean in sorted(glob.glob(os.path.join(rundir, 'clean_*.json'))):
    rid = os.path.basename(clean)[len('clean_'):-len('.json')]
    with open(clean) as f:
        run = json.load(f)
    false = sorted(marks(run))
    timings = os.path.join(rundir, f'qdc_{rid}.json')
    if os.path.exists(timings):
        all_delays += delays(run, timings)
    hit = truth = 0
    missed = []
    cases_path = os.path.join(rundir, f'cases_{rid}', 'cases.json')
    if os.path.exists(cases_path):
        with open(cases_path) as f:
            cases = json.load(f)
        for case in cases:
            p = os.path.join(rundir, f"{rid}__{case['name']}.json")
            if not os.path.exists(p):
                continue
            with open(p) as f:
                got = marks(json.load(f))
            h = caught(case['truth'], got)
            hit += h
            truth += len(case['truth'])
            if h < len(case['truth']):
                missed.append(case['name'])
    total_false += len(false)
    total_hit += hit
    total_truth += truth
    print(f'reciter {rid}: false marks on clean {len(false)} {false}  caught {hit}/{truth}  missed {missed}')
all_delays.sort()
q = (lambda p: round(all_delays[int(p * (len(all_delays) - 1))], 2)) if all_delays else (lambda p: None)
print(f'TOTAL false marks {total_false}  caught {total_hit}/{total_truth}  '
      f'verdict delay p50 {q(0.5)}s p90 {q(0.9)}s (mark shows ~+{CONFIRM}s later)')
