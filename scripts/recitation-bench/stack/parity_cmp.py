# The engine stack's runs against the baselines. Off: nothing may differ. On: only the
# junction results may.
import glob, json, os, sys
B = sys.argv[1]
R = f'{B}/.out/engine-stack/runs'
BASE = f'{B}/.out/natural/baseline/runs'
def load(p):
    return json.load(open(p))
def strip(r):
    r = dict(r)
    r.pop('probe', None)
    s = dict(r['summary'])
    for k in ('rtf', 'stopMs'):
        s.pop(k, None)
    r['summary'] = s
    return r
def clean(c):
    c = dict(c)
    if c.get('d'):
        c['d'] = {k: v for k, v in c['d'].items() if k not in ('junction', 'junctionMissing')}
    return c
for suite in ('w1', 'pool'):
    off_same = off_all = 0
    on_same = on_all = 0
    extra = 0
    fires = []
    for f in sorted(glob.glob(f'{R}/off_{suite}/*.json')):
        name = os.path.basename(f)
        base = strip(load(f'{BASE}/{suite}/{name}'))
        off = strip(load(f))
        off_all += 1
        bad = [k for k in base if k != 'clip' and base[k] != off.get(k)]
        if not bad:
            off_same += 1
        else:
            print('OFF DIFFERS', suite, name, bad)
            for k in bad:
                if k in ('vchanges', 'log'):
                    a, b = base[k], off[k]
                    for i, (x, y) in enumerate(zip(a, b)):
                        if x != y:
                            print(' first diff', k, i, x, y)
                            break
                    print(' lens', len(a), len(b))
        on = strip(load(f'{R}/on_{suite}/{name}'))
        on_all += 1
        missing = {c['id'] for c in on['vchanges'] if c.get('d') and c['d'].get('junctionMissing') is True}
        a = [clean(c) for c in base['vchanges']]
        b = [clean(c) for c in on['vchanges'] if c['from'] != c['to'] or c.get('stop')]
        extra += sum(1 for c in on['vchanges'] if c['from'] == c['to'])
        a2 = [c for c in a if c['id'] not in missing]
        b2 = [c for c in b if c['id'] not in missing]
        ok = a2 == b2
        rest_keys = [k for k in ('log', 'flags', 'health', 'levels', 'partsAt', 'summary') if k in base and base[k] != on.get(k)]
        if ok and not rest_keys:
            on_same += 1
        else:
            print('ON DIFFERS', suite, name, 'vchanges' if not ok else '', rest_keys)
            if not ok:
                for i, (x, y) in enumerate(zip(a2, b2)):
                    if x != y:
                        print(' first diff', i, x, y)
                        break
                print(' lens', len(a2), len(b2))
            for k in rest_keys:
                if isinstance(base[k], list):
                    for i, (x, y) in enumerate(zip(base[k], on.get(k, []))):
                        if x != y:
                            print(' first diff', k, i, x, y)
                            break
                    print(' lens', k, len(base[k]), len(on.get(k, [])))
                else:
                    print(k, base[k], on.get(k))
        if missing:
            fires.append((name, sorted(missing), [(c['t'], c['id'], c['from'], c['to'], c['d'].get('junction')) for c in on['vchanges'] if c['id'] in missing and c.get('d') and not c.get('stop')][-2:]))
    print(json.dumps({'suite': suite, 'off identical': f'{off_same}/{off_all}', 'on identical apart from junction': f'{on_same}/{on_all}', 'junction-only change rows': extra, 'unsaid': fires}, ensure_ascii=False))
    tot = {'reads': 0, 'framesRead': 0, 'compared': 0, 'exact': 0, 'worstKaldi': 0.0, 'worstJudge': 0.0, 'mean': 0.0}
    for f in sorted(glob.glob(f'{R}/on_{suite}/*.json')):
        m = load(f)['probe']['mel']
        tot['reads'] += m['reads']; tot['framesRead'] += m['framesRead']; tot['compared'] += m['compared']; tot['exact'] += m['exact']
        tot['worstKaldi'] = max(tot['worstKaldi'], m['worstKaldi']); tot['worstJudge'] = max(tot['worstJudge'], m['worstJudge']); tot['mean'] += m['meanJudge'] * m['compared']
    tot['mean'] = tot['mean'] / max(1, tot['compared'])
    print(json.dumps({'mel': tot}))
