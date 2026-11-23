"""Letter and word error of quran-asr-small's greedy text on the staged clips
against the official letters of what the reciter said, per reciter. Checks that
the features, the runtime and the letters table all agree with the model.

    python3 -I judge/cer.py [dev|test|all] [--words]
"""
import collections
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
J = os.path.join(HERE, '..', '.out', 'natural', 'judge')
MAN = os.path.join(HERE, '..', '.out', 'natural', 'manifests')


def edit(a, b):
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[-1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]


def word_diff(hyp, ref):
    """Word substitutions by a simple alignment: (ref word, hyp word) pairs."""
    h, r = hyp.split(), ref.split()
    n, m = len(r), len(h)
    d = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        d[i][0] = i
    for j in range(m + 1):
        d[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] != h[j - 1]))
    out = []
    i, j = n, m
    while i and j:
        if r[i - 1] == h[j - 1] and d[i][j] == d[i - 1][j - 1]:
            i, j = i - 1, j - 1
        elif d[i][j] == d[i - 1][j - 1] + 1:
            out.append((r[i - 1], h[j - 1]))
            i, j = i - 1, j - 1
        elif d[i][j] == d[i - 1][j] + 1:
            out.append((r[i - 1], ''))
            i -= 1
        else:
            out.append(('', h[j - 1]))
            j -= 1
    while i:
        out.append((r[i - 1], ''))
        i -= 1
    while j:
        out.append(('', h[j - 1]))
        j -= 1
    return out


def main():
    split = sys.argv[1] if len(sys.argv) > 1 else 'dev'
    pool = json.load(open(os.path.join(MAN, 'pool.json'), encoding='utf-8'))
    splits = {c['truth']['reciter']: c['truth']['reciterSplit'] for c in pool}
    totals = collections.defaultdict(lambda: [0, 0, 0, 0, 0])
    subs = collections.Counter()
    ms = secs = 0
    for f in sorted(os.listdir(os.path.join(J, 'align'))):
        for line in open(os.path.join(J, 'align', f), encoding='utf-8'):
            r = json.loads(line)
            if split != 'all' and splits.get(r['slug']) != split:
                continue
            if r['restarts']:
                continue  # the model writes repeats too; scored on single readings
            hyp, ref = r['greedy'], r['said']
            ce = edit(hyp.replace(' ', ''), ref.replace(' ', ''))
            we = edit(hyp.split(), ref.split())
            for k in (r['slug'], 'all'):
                t = totals[k]
                t[0] += ce
                t[1] += len(ref.replace(' ', ''))
                t[2] += we
                t[3] += len(ref.split())
                t[4] += 1
            if hyp != ref:
                for a, b in word_diff(hyp, ref):
                    subs[(a, b)] += 1
            ms += r['ms']
            secs += r['seconds']
    for k, t in sorted(totals.items(), key=lambda kv: (kv[0] != 'all', kv[0])):
        print(f'{k:42s} clips {t[4]:6d} words {t[3]:7d} CER {100 * t[0] / max(1, t[1]):6.2f}% WER {100 * t[2] / max(1, t[3]):6.2f}%')
    print('audio hours', round(secs / 3600, 2), 'ms per audio second', round(ms / max(1, secs), 2))
    print('most common word differences (official, heard):')
    for (a, b), n in subs.most_common(60):
        print(n, repr(a), repr(b))


if __name__ == '__main__':
    main()
