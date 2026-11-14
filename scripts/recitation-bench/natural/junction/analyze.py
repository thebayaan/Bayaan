"""Compares ways to tell a last word was left out, on scored joins.

    python3 -I natural/junction/analyze.py --split dev [--m 1]

Reads scan_joins.mjs and scan_phantom.mjs output under .out/natural/junction/scan.
Only the requested split is read: reciters and last-word types (true events) or
reciters and passages (the pool). `--split test` refuses to run until frozen.json
holds the rule. Intervals: 95%, resampling pairs (or passages) and reciters
together. The rows here are the test alone, before the app's mark rules; replay
scoring is score_junction.mjs.
"""
import argparse
import collections
import json
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import text as T  # noqa: E402

J = os.path.join(T.OUT, 'junction')
SCAN = os.path.join(J, 'scan')
BOOT = 1000


def load(name):
    path = os.path.join(SCAN, name)
    if not os.path.exists(path):
        return []
    with open(path, encoding='utf-8') as f:
        return [json.loads(line) for line in f]


def two_way(rows, boot=BOOT, seed=7):
    """rows: (a, b, num, den). Point and 95% interval of sum num / sum den."""
    num = sum(r[2] for r in rows)
    den = sum(r[3] for r in rows)
    if not den:
        return None, None, None, num, den
    aa = sorted({r[0] for r in rows})
    bb = sorted({r[1] for r in rows})
    cells = collections.defaultdict(lambda: [0.0, 0.0])
    for a, b, n, d in rows:
        cells[(a, b)][0] += n
        cells[(a, b)][1] += d
    rng = random.Random(seed)
    stats = []
    items = list(cells.items())
    for _ in range(boot):
        wa = collections.Counter(rng.choices(aa, k=len(aa)))
        wb = collections.Counter(rng.choices(bb, k=len(bb)))
        n = d = 0.0
        for (a, b), (x, y) in items:
            w = wa.get(a, 0) * wb.get(b, 0)
            if w:
                n += w * x
                d += w * y
        if d:
            stats.append(n / d)
    stats.sort()
    lo = stats[int(0.025 * len(stats))] if stats else None
    hi = stats[min(len(stats) - 1, int(0.975 * len(stats)))] if stats else None
    return num / den, lo, hi, num, den


def snap(row, m):
    for s in row['snaps']:
        if s['m'] == m:
            return s
    return None


def rules():
    """name -> (features at the snapshot) -> flagged. Each needs a not-ok verdict
    except where its name says otherwise."""
    notok = lambda s: s and s.get('state') not in ('ok', 'pending', None)
    out = {
        'today: skipped verdict only': lambda s: s and s.get('state') == 'skipped',
        'wrong or skipped verdict (drop the edge rule)': lambda s: s and s.get('state') in ('wrong', 'skipped'),
        'not ok at all': notok,
    }
    for x in (0, 0.25, 0.34, 0.5):
        out[f'not ok, consonants heard <= {x}'] = lambda s, x=x: notok(s) and s.get('hits', 1) <= x
    for x in (0.34, 0.5, 0.75):
        out[f'not ok, heard ratio <= {x}'] = lambda s, x=x: notok(s) and (s.get('heardRatio') or 0) <= x
    for x in (0.4, 0.5, 0.6, 0.8):
        out[f'not ok, distance >= {x}'] = lambda s, x=x: notok(s) and (s.get('distance') or 0) >= x
    for x in (5, 10):
        out[f'not ok, heard frames <= {x}'] = lambda s, x=x: notok(s) and s.get('heardFrames', 0) <= x
    for x in (-5, -10, -15):
        out[f'not ok, gop <= {x} (none counts no)'] = lambda s, x=x: notok(s) and s.get('gop') is not None and s['gop'] <= x
    for x in (0.1, 0.25, 0.5):
        out[f'not ok, sounds fit better without it by >= {x}'] = lambda s, x=x: notok(s) and (s.get('symbolic') or -9) >= x
    for x in (0, -3, -6, -10):
        out[f'not ok, fixed-window llr < {x}'] = lambda s, x=x: notok(s) and s.get('llr') is not None and s['llr'] < x
    for x in (0, -3, -6, -10):
        out[f'not ok, free-tail llr < {x}'] = lambda s, x=x: (
            notok(s) and (s.get('free') or {}).get('q1', {}).get('llr') is not None and s['free']['q1']['llr'] < x
        )
    for back in ('b0', 'b25', 'b50', 'b75'):
        for x in (0, -3, -6, -10):
            out[f'not ok, local fit {back} llr < {x}'] = lambda s, x=x, back=back: (
                notok(s) and (s.get('local') or {}).get(back, {}).get('llr') is not None and s['local'][back]['llr'] < x
            )
    for x in (-3, -6):
        out[f'any verdict, free-tail llr < {x}'] = lambda s, x=x: (
            s and s.get('state') != 'pending' and (s.get('free') or {}).get('q1', {}).get('llr') is not None and s['free']['q1']['llr'] < x
        )
    return out


def fmt(res, scale=100, unit='%'):
    est, lo, hi, num, den = res
    if est is None:
        return 'n/a'
    return f'{scale * est:.2f}{unit} [{scale * lo:.2f}, {scale * hi:.2f}] ({num:.0f}/{den:.0f})'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--split', default='dev', choices=('dev', 'test'))
    ap.add_argument('--m', type=int, default=1)
    args = ap.parse_args()
    if args.split == 'test' and not os.path.exists(os.path.join(J, 'frozen.json')):
        raise SystemExit('the rule is not frozen yet')
    split = args.split

    with open(os.path.join(J, 'manifests/junction_live.json'), encoding='utf-8') as f:
        live_clips = {c['id']: c for c in json.load(f)}
    with open(os.path.join(J, 'manifests/junction_control.json'), encoding='utf-8') as f:
        control_clips = {c['id']: c for c in json.load(f)}

    def of_split(clip):
        t = clip['truth']
        return t['reciterSplit'] == split and t['pairSplit'] == split

    def rows_for(name, clips):
        """Each clip's row for X's last word; a clip with no such join stays, as a
        run where the test could not fire."""
        by_clip = {}
        for r in load(name):
            c = clips.get(r['clip'])
            if not c or not of_split(c):
                continue
            t = c['truth']
            if r['id'] == f"{t['expectedKey']}:{t['target']}":
                by_clip[r['clip']] = r
        return [(c, by_clip.get(i)) for i, c in clips.items() if of_split(c)]

    live = rows_for('live.jsonl', live_clips)
    control = rows_for('control.jsonl', control_clips)
    pool = [r for r in load('pool.jsonl') if r['reciterSplit'] == split and r['blockSplit'] == split]
    with open(os.path.join(T.OUT, 'manifests/pool.json'), encoding='utf-8') as f:
        words = sum(
            c['truth']['words']
            for c in json.load(f)
            if c['truth']['reciterSplit'] == split and c['truth']['blockSplit'] == split
        )
    phantom = [
        r for r in load('phantom.jsonl') if r['reciterSplit'] == split and r['typeSplit'] == split
    ]
    print(f'split {split}, snapshot m={args.m}')
    print(f'live runs {len(live)}, sites {len({c["truth"]["pair"] for c, _ in live})}, '
          f'last-word types {len({c["truth"]["word"] for c, _ in live})}; '
          f'control runs {len(control)}; pool joins {len(pool)}, words {words}; '
          f'text-side events {len(phantom)}, types {len({r["word"] for r in phantom})}')

    sites_two = [(c, r) for c, r in live if c['truth']['right'] >= 2]
    print(f'{"rule":58s} | catch, all sites | catch, 2+ next words | control false | pool false per 1000')
    for name, rule in rules().items():
        def catch(rows):
            return two_way([
                (c['truth']['pair'], c['truth']['reciter'], 1.0 if (r and rule(snap(r, args.m))) else 0.0, 1.0)
                for c, r in rows
            ])
        ctl = two_way([
            (c['truth']['pair'], c['truth']['reciter'], 1.0 if (r and rule(snap(r, args.m))) else 0.0, 1.0)
            for c, r in control
        ])
        flagged = collections.Counter()
        for r in pool:
            if rule(snap(r, args.m)):
                flagged[(r['block'], r['reciter'])] += 1
        blocks = {(r['block'], r['reciter']) for r in pool}
        by = collections.defaultdict(int)
        for r in pool:
            by[(r['block'], r['reciter'])] += 1
        scale = words / max(1, len(pool))
        pool_rows = [(b, s, flagged[(b, s)], by[(b, s)] * scale) for (b, s) in blocks]
        print(f'{name:58s} | {fmt(catch(live))} | {fmt(catch(sites_two))} | {fmt(ctl)} | {fmt(two_way(pool_rows), 1000, "")}')

    # What the test sees alone.
    def quant(v):
        v = sorted(x for x in v if x is not None)
        if not v:
            return 'n/a'
        return ' '.join(f'{v[int(q * (len(v) - 1))]:.1f}' for q in (0, 0.01, 0.05, 0.25, 0.5, 0.75, 0.95, 0.99, 1)) + f' (n={len(v)})'

    def free_llr(rows):
        out = []
        for r in rows:
            s = snap(r, args.m) if r else None
            if s and (s.get('free') or {}).get('q1'):
                out.append(s['free']['q1']['llr'])
        return out

    print('\nfree-tail llr, quantiles 0 1 5 25 50 75 95 99 100')
    print('  live, last word left out :', quant(free_llr([r for _, r in live])))
    print('  control, same word said  :', quant(free_llr([r for _, r in control])))
    print('  pool, all joins          :', quant(free_llr(pool)))
    print('  pool, joins not ok       :', quant(free_llr([r for r in pool if (snap(r, args.m) or {}).get('state') not in ('ok', None)])))
    print('  text-side, at a join     :', quant([r['llr'] for r in phantom if r['kind'] == 'ending']))
    print('  text-side, inside an ayah:', quant([r['llr'] for r in phantom if r['kind'] == 'interior']))

    for back in ('b0', 'b25', 'b50', 'b75'):
        def local_llr(rows):
            out = []
            for r in rows:
                s = snap(r, args.m) if r else None
                if s and (s.get('local') or {}).get(back):
                    out.append(s['local'][back]['llr'])
            return out
        print(f'local fit {back}:')
        print('  live, last word left out :', quant(local_llr([r for _, r in live])))
        print('  control, same word said  :', quant(local_llr([r for _, r in control])))
        print('  pool, all joins          :', quant(local_llr(pool)))
    def early_llr(rows, key, states=None):
        out = []
        for r in rows:
            s = snap(r, 0) if r else None
            if s and (s.get('early') or {}).get(key) is not None:
                if states is None or s.get('state') not in states:
                    out.append(s['early'][key])
        return out
    print('\nan earlier look, at the crossing plus 0, 12 or 24 frames, anchored on 3 or 5 tokens:')
    for key in ('d0a3', 'd0a5', 'd12a3', 'd12a5', 'd24a3', 'd24a5'):
        print(f'  {key}:')
        print('    live, last word left out :', quant(early_llr([r for _, r in live], key)))
        print('    control, same word said  :', quant(early_llr([r for _, r in control], key)))
        print('    pool, all joins          :', quant(early_llr(pool, key)))
    print('\ntext-side events flagged at each threshold, macro over last-word types, interval over types and reciters')
    for kind in ('ending', 'interior'):
        rows = [r for r in phantom if r['kind'] == kind and r['llr'] is not None]
        for x in (0, -3, -6, -10):
            print(f'  {kind} llr < {x}:', fmt(two_way([(r['word'], r['reciter'], 1.0 if r['llr'] < x else 0.0, 1.0) for r in rows])))

    # Lowest correct joins and highest true events.
    print('\nlowest pool joins by free-tail llr')
    rows = sorted(
        (r for r in pool if (snap(r, args.m) or {}).get('local', {}).get('b50')),
        key=lambda r: snap(r, args.m)['local']['b50']['llr'],
    )
    for r in rows[:15]:
        s = snap(r, args.m)
        print('  ', s['local']['b50'], s['free'].get('q1', {}).get('llr'), s['state'], r['id'], r['reciter'][:14], 'heard', s['heard'], 'runs', s['runs'], 't', s['t'])
    print('highest true events by free-tail llr')
    rows = sorted(
        (r for _, r in live if r and (snap(r, args.m) or {}).get('local', {}).get('b50')),
        key=lambda r: -snap(r, args.m)['local']['b50']['llr'],
    )
    for r in rows[:15]:
        s = snap(r, args.m)
        print('  ', s['local']['b50'], s['state'], r['clip'], 'heard', s['heard'])
    no = [c['id'] for c, r in live if not r or not snap(r, args.m)]
    print(f'live runs with no test at m={args.m}: {len(no)}', no[:12])


if __name__ == '__main__':
    main()
