"""Reads _dl/ikhlas/Dataset.xlsx (as XML data) into _dl/ikhlas/meta.json:
{file stem: {xlsxRow, trueFalse, errorType, errorWords (1-based numbers in 112:v, by skeleton match), errorNumber, unmapped}}.
Error location text is matched to data/quran.json words and dropped; nothing textual is kept but the category name."""
import zipfile, re, sys, os, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qtext
from paths import DATA as D
z = zipfile.ZipFile(f'{D}/_dl/ikhlas/Dataset.xlsx')
ss = [re.sub(r'<[^>]+>', '', s) for s in re.findall(r'<si>(.*?)</si>', z.read('xl/sharedStrings.xml').decode(), re.S)]
import html
ss = [html.unescape(s) for s in ss]
rows = re.findall(r'<row [^>]*>(.*?)</row>', z.read('xl/worksheets/sheet1.xml').decode(), re.S)
def cells(r):
    out = {}
    for m in re.finditer(r'<c r="([A-Z]+)\d+"([^>]*?)(?:/>|>(.*?)</c>)', r, re.S):
        v = re.search(r'<v>(.*?)</v>', m.group(3) or '')
        if v: out[m.group(1)] = ss[int(v.group(1))] if 't="s"' in m.group(2) else v.group(1)
    return out
CLS = {'تجويد': 'tajweed', 'حركات': 'harakat'}
TYPES = {'تجويد': 'tajweed', 'تشكيل': 'tashkeel', 'حروف': 'letters', 'حرف': 'letters', 'كلمة': 'word', 'كلمات': 'word', 'نطق': 'pronunciation'}
meta, types = {}, collections.Counter()
W = qtext.words()
for r in rows[1:]:
    c = cells(r)
    stem = (c.get('D') or '').strip().rsplit('.', 1)[0]
    if not stem: continue
    v = int(c.get('C', 0) or 0)
    et = (c.get('F') or '').strip(); types[et] += 1
    loc = re.sub(r'[,،]', ' ', (c.get('G') or '')).strip()
    nums, unm = [], 0
    if loc and v in (1, 2, 3, 4):
        sk = [qtext.skeleton(w) for w in W[f'112:{v}']]
        for t in loc.split():
            k = qtext.skeleton(t)
            if k in sk: nums.append(sk.index(k) + 1)
            elif k: unm += 1
    cls = []
    for part in re.split(r'[,،]', et):
        for sub in re.split(r'\s+و', ' ' + part.strip()):
            sub = sub.strip()
            if sub: cls.append(CLS.get(sub, 'other'))
    meta[stem] = {'xlsxRow': c.get('A'), 'verse': v, 'trueFalse': c.get('E'),
                  'errorClasses': [] if et in ('0', '') else cls,
                  'errorWords': sorted(set(nums)), 'errorLocationUnmappedTokens': unm, 'errorNumber': c.get('I')}
json.dump(meta, open(f'{D}/_dl/ikhlas/meta.json', 'w'), indent=0)
print(len(meta), collections.Counter(c for m in meta.values() for c in m['errorClasses']))
print(collections.Counter((m['trueFalse'], bool(m['errorClasses'])) for m in meta.values()))
print('mapped', sum(bool(m['errorWords']) for m in meta.values()), 'unmapped tokens', sum(m['errorLocationUnmappedTokens'] for m in meta.values()))
