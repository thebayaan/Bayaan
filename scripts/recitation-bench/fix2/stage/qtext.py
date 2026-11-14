"""Word lists from data/quran.json (KFGQPC), numbered as the bench manifests number them:
split by space, without the ayah number and the rub el hizb sign. Never prints text."""
import json, re, unicodedata
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import QURAN  # noqa: E402
HIZB = '۞'
AYAH_NO = re.compile(r'[٠-٩۰-۹]+')
NORM = str.maketrans({'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ى': 'ي', 'ی': 'ي',
                      'ئ': 'ي', 'ؤ': 'و', 'ة': 'ه', 'ـ': None, 'ء': None})
_W = None
def words():
    global _W
    if _W is None:
        with open(QURAN, encoding='utf-8') as f:
            d = json.load(f)
        _W = {f"{v['surah_number']}:{v['ayah_number']}": [t for t in v['text'].split() if t != HIZB and not AYAH_NO.fullmatch(t)] for v in d.values()}
    return _W
def nwords(s, a1, a2=None):
    w = words()
    return sum(len(w[f'{s}:{a}']) for a in range(a1, (a2 or a1) + 1))
def skeleton(word):
    return ''.join(ch for ch in word if unicodedata.category(ch).startswith('L')).translate(NORM)
