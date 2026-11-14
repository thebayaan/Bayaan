"""Word differences between the pinned KFGQPC riwayah texts and Hafs (W2, T2).

    python3 -I natural/riwayah_diff.py [out_dir]

Reads scripts/rewayah/sources/*.json directly, after checking each file against
sources.lock.json. Writes summary2.json, sites_<riwayah>.json and
unaligned_<riwayah>.json under out_dir (default .out/natural/riwayah_diff).
Prints one line per riwayah. Not used by the W1 baseline: it feeds W2 and T2.
"""
import hashlib, sys, json, collections, difflib, unicodedata
import os as _os
HERE = _os.path.dirname(_os.path.abspath(__file__))
SOURCES = _os.path.join(HERE, '../../rewayah/sources')
OUT = sys.argv[1] if len(sys.argv) > 1 else _os.path.join(HERE, '../.out/natural/riwayah_diff')
R = ['warsh','qaloon','doori','soosi','shouba','bazzi','qumbul']
MAGHRIBI_SUKUN = {'warsh','qaloon'}
STOP = set('ۖۗۘۙۚۛۜ۞۩\u200f\u200d')
DIG = set('٠١٢٣٤٥٦٧٨٩0123456789')
BASE_MAP = {'أ':'ا','إ':'ا','آ':'ا','ٱ':'ا','ا':'ا','ؤ':'و','ئ':'ي','ى':'ي','ي':'ي','ے':'ي','ٮ':'ب'}
HZ = set('أإآؤئء')
VOW = {'َ':('a',0),'ُ':('u',0),'ِ':('i',0),'ً':('a',1),'ٗ':('a',1),'ٌ':('u',1),'ٞ':('u',1),'ٍ':('i',1),'ٖ':('i',1)}

def tokenize(t):
    out = []
    for w in t.replace('\xa0',' ').split(' '):
        w = ''.join(c for c in w if c not in STOP and c not in DIG and not (0xFB50<=ord(c)<=0xFDFF or 0xFE70<=ord(c)<=0xFEFF))
        if w.strip('ـ'): out.append(w)
    return out

def load(r):
    path = _os.path.join(SOURCES, f'{r}.json')
    with open(_os.path.join(SOURCES, 'sources.lock.json'), encoding='utf-8') as f:
        pinned = json.load(f)['sources'][r]['sha256']
    with open(path, 'rb') as f:
        got = hashlib.sha256(f.read()).hexdigest()
    if got != pinned:
        raise SystemExit(f'{r}.json hash {got} is not the pinned one')
    with open(path, encoding='utf-8') as f:
        rows = json.load(f)
    # Rows carry sura_no (or a spelling of it), aya_no and aya_text.
    sura = [k for k in rows[0] if k.startswith('sur') or k.startswith('sor')][0]
    out = collections.defaultdict(list)
    for x in rows:
        for w in tokenize(x['aya_text']):
            out[int(x[sura])].append((int(x['aya_no']), w))
    return out

def is_letter(c):
    return unicodedata.category(c) == 'Lo' and c not in 'ۥۦۧۨ'

def segs(word, r):
    out = []
    for c in word:
        if c == 'ـ':
            out.append({'b':'ـ','raw':'ـ','m':[]}); continue
        if is_letter(c):
            out.append({'b':BASE_MAP.get(c,c),'raw':c,'m':[]}); continue
        if c in 'ٕٔ' and out:
            cur = out[-1]
            has_v = any(x in VOW or x in 'ّْۡ' for x in cur['m'])
            if cur['raw'] in 'اويىےـ' and not has_v:
                cur['m'].append(c); continue
            out.append({'b':'ء','raw':'ء','m':[]}); continue
        if not out: out.append({'b':'','raw':'','m':[]})
        out[-1]['m'].append(c)
    res = []
    for s in out:
        if s['b'] == 'ـ':
            if 'ٔ' in s['m'] or 'ٕ' in s['m']: s['b'] = 'ء'
            elif res: res[-1]['m'] += s['m']; continue
            else: continue
        res.append(s)
    for s in res:
        m = s['m']
        s['hz'] = s['raw'] in HZ or 'ٔ' in m or 'ٕ' in m or s['b'] == 'ء'
        s['wasl'] = s['raw'] == 'ٱ'
        v = None; tan = 0
        for c in m:
            if c in VOW: v, tan = VOW[c]
        if v and ('ۢ' in m or 'ۭ' in m) and s['b'] != '': tan = tan or ('ۢ' in m or s['raw'] != 'ن')
        s['v'] = v; s['tan'] = tan
        if r in MAGHRIBI_SUKUN:
            s['suk'] = 'ْ' in m
        else:
            s['suk'] = 'ۡ' in m
        s['sil'] = ('ْ' in m and r not in MAGHRIBI_SUKUN) or '۟' in m
        s['sh'] = 'ّ' in m
        s['madd'] = 'ٓ' in m or 'ۤ' in m or s['raw'] == 'آ'
        s['im'] = '۪' in m or 'ٜ' in m or ('ۭ' in m and not v)
        s['dot'] = '۬' in m
        s['dag'] = 'ٰ' in m
        s['silah'] = 'ۥ' in m or 'ۦ' in m or 'ۧ' in m
        s['bare'] = not m
    # tanween written on a final alif / alif maqsura -> move to previous letter
    if len(res) >= 2 and res[-1]['b'] in ('ا','ي') and res[-1]['v'] and res[-1]['tan'] and not res[-2]['v']:
        res[-2]['v'], res[-2]['tan'] = res[-1]['v'], 1
        res[-1]['v'], res[-1]['tan'] = None, 0
    return res

def skel(word):
    return ''.join(BASE_MAP.get(c,c) for c in word if is_letter(c) and c not in 'ءاأإآٱ')

def align_words(hw, rw):
    hs = [skel(w) for _, w in hw]; rs = [skel(w) for _, w in rw]
    sm = difflib.SequenceMatcher(a=hs, b=rs, autojunk=False)
    pairs, unm = [], []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == 'equal' or (op == 'replace' and i2-i1 == j2-j1):
            pairs += list(zip(range(i1,i2), range(j1,j2)))
        else:
            unm.append((op, [hw[i][1] for i in range(i1,i2)], [rw[j][1] for j in range(j1,j2)]))
    return pairs, unm

def compare(hw, rw, r, h_next, r_next, h_prev_final_drop=False):
    H, S = segs(hw,'hafs'), segs(rw, r)
    sm = difflib.SequenceMatcher(a=[x['b'] for x in H], b=[x['b'] for x in S], autojunk=False)
    pairs, out = [], []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == 'equal' or (op == 'replace' and i2-i1 == j2-j1):
            pairs += list(zip(range(i1,i2), range(j1,j2)))
            if op == 'replace': out.append(('LETTER', 'sub'))
        else:
            out.append(('LETTER', 'indel'))
    n = len(H)
    HN = segs(h_next,'hafs') if h_next else None
    SN = segs(r_next, r) if r_next else None
    next_hz_dropped = bool(HN and SN and HN[0]['hz'] and not HN[0]['wasl'] and not SN[0]['hz'])
    for k, (i, j) in enumerate(pairs):
        h, s = H[i], S[j]
        fin = (i == n-1) or (i == n-2 and H[-1]['b'] in ('ا','ي','و') and not H[-1]['v'])
        pos = 'fin' if fin else 'int'
        if h['wasl'] or (i == 0 and h['b'] == 'ا' and not h['hz'] and HN is not None and False):
            continue
        # hamza / tas-hil
        if h['hz'] and not s['hz']:
            if s['dot'] or s['im']: out.append(('TASHIL', h['raw'])); continue
            out.append(('HAMZA', 'drop'))
        elif s['hz'] and not h['hz']:
            out.append(('HAMZA', 'add'))
        elif h['hz'] and s['hz'] and (s['im'] and not h['im']):
            out.append(('TASHIL', h['raw'])); continue
        if s['dot'] and h['b'] == 'ا' and not h['wasl'] and not h['hz'] and i > 0 and not h['dot']:
            out.append(('TASHIL','alif')); continue
        if s['im'] and not h['im']:
            out.append(('IMALA', pos)); continue
        if h['im'] and not s['im']:
            out.append(('IMALA', 'removed')); continue
        hv, sv = h['v'], s['v']
        if hv != sv:
            if hv and sv:
                out.append(('VQ', f'{hv}>{sv}:{pos}'))
            elif hv and not sv:
                # naql: vowel of hamza moved to previous letter
                if h['hz'] and not s['hz'] and i > 0:
                    out.append(('NAQL', 'int'))
                elif s['suk']:
                    out.append(('DROP', f'{hv}>0:{pos}'))
                elif s['bare'] or not s['suk']:
                    if fin and r == 'soosi':
                        out.append(('IDGHAM_KABIR', 'merged'))
                    elif s['b'] == 'ا' or (h['b'] in 'وي' and s['b'] in 'وي' and (s['silah'] or s['madd'] or s['dag'])):
                        out.append(('LONGV', 'v>madd'))
                    else:
                        out.append(('BARE', f'{hv}>bare:{h["b"]}'))
            else:
                nxt_h = H[i+1] if i+1 < n else None
                nxt_s_idx = pairs[k+1][1] if k+1 < len(pairs) else None
                nxt_s = S[nxt_s_idx] if nxt_s_idx is not None else None
                if nxt_h is not None and nxt_h['hz'] and nxt_s is not None and not nxt_s['hz']:
                    out.append(('NAQL', 'int'))
                elif fin and r == 'warsh' and next_hz_dropped:
                    out.append(('NAQL', 'fin'))
                elif s['silah'] and h['b'] == 'م':
                    out.append(('SILAH', 'mim'))
                elif s['silah']:
                    out.append(('SILAH', 'other'))
                elif fin and h['b'] == 'ي' and sv == 'a':
                    out.append(('YA_IDAFA', 'opened'))
                else:
                    out.append(('INS', f'0>{sv}:{pos}'))
        elif hv and hv == sv and h['tan'] != s['tan']:
            out.append(('VQ', f'tanween:{pos}'))
        if h['sh'] != s['sh']:
            out.append(('SHADDA', ('add' if s['sh'] else 'del') + (':first' if i == 0 else ':other')))
        if h['madd'] != s['madd']:
            out.append(('MADD', 'add' if s['madd'] else 'del'))
        if h['silah'] != s['silah'] and not any(o[0]=='SILAH' for o in out):
            out.append(('SILAH', 'add' if s['silah'] else 'del'))
        if h['dag'] != s['dag']:
            out.append(('LONGV', 'dagger_' + ('add' if s['dag'] else 'del')))
    pass
    return out

hafs = load('hafs')
summary = {}
import os
os.makedirs(OUT, exist_ok=True)
for r in R:
    rt = load(r)
    tokcat = collections.Counter(); sub = collections.Counter()
    ex = collections.defaultdict(collections.Counter)
    types = collections.defaultdict(set)
    sites = []; npairs = 0; unm_tokens = 0; unm_blocks = []
    for su in range(1,115):
        hw, rw = hafs[su], rt[su]
        pairs, unm = align_words(hw, rw)
        unm_tokens += sum(len(u[1]) for u in unm)
        unm_blocks += [(su,)+u for u in unm]
        for k, (i, j) in enumerate(pairs):
            npairs += 1
            hn = hw[i+1][1] if i+1 < len(hw) else None
            rn = rw[j+1][1] if j+1 < len(rw) else None
            ds = compare(hw[i][1], rw[j][1], r, hn, rn)
            ds = [d for d in ds if d[0] != 'BARE' or True]
            cats = set(d[0] for d in ds)
            for c in cats:
                tokcat[c] += 1; ex[c][(hw[i][1], rw[j][1])] += 1; types[c].add(skel(hw[i][1]))
            for d in ds: sub[f'{d[0]}:{d[1]}'] += 1
            if cats & {'VQ','DROP','INS','YA_IDAFA','SILAH','NAQL','IDGHAM_KABIR','IMALA','TASHIL','MADD','SHADDA','HAMZA','LONGV','LETTER'}:
                sites.append([su, hw[i][0], rw[j][0], i, hw[i][1], rw[j][1], sorted(set(f'{d[0]}:{d[1]}' for d in ds))])
    summary[r] = {'paired_tokens': npairs, 'unaligned_hafs_tokens': unm_tokens,
                  'tokens_by_class': dict(tokcat.most_common()),
                  'types_by_class': {c: len(v) for c, v in types.items()},
                  'sub': dict(sub.most_common()),
                  'examples': {c: [f'{a} → {b} ×{n}' for (a,b), n in ex[c].most_common(30)] for c in ex}}
    with open(f'{OUT}/sites_{r}.json','w') as f: json.dump(sites, f, ensure_ascii=False)
    with open(f'{OUT}/unaligned_{r}.json','w') as f: json.dump(unm_blocks, f, ensure_ascii=False)
    print(f'== {r}: paired {npairs}, unaligned hafs tokens {unm_tokens}')
    print('   ', ', '.join(f'{c}={n} ({len(types[c])} types)' for c, n in tokcat.most_common()))
with open(f'{OUT}/summary2.json','w') as f: json.dump(summary, f, ensure_ascii=False, indent=1)
