"""W5, first cut: recitation phenomena from tajweed references, on the official
text. Every mark on these words is false. Nothing here comes from any app.

Sites are (ayah, Hafs token, category). `sites()` finds them on the pinned text
and fails if a named word is not where the table says. Categories needing a
reciter's own behaviour (restarts, pauses, speed) come from QUA's metadata in
manifests.py, and mid-surah starts are whole ayat started by search.

Not in this cut, with why (README.md): isti'adha and basmala outside 1:1, since
QUA's rows start after them; pauses over 20 s, none inside an ayah in this pool;
hadr, no fast reciter among the unseen.
"""
import re
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import text as T  # noqa: E402

MUQATTAAT = [
    '2:1', '3:1', '7:1', '10:1', '11:1', '12:1', '13:1', '14:1', '15:1', '19:1',
    '20:1', '26:1', '27:1', '28:1', '29:1', '30:1', '31:1', '32:1', '36:1', '38:1',
    '40:1', '41:1', '42:1', '42:2', '43:1', '44:1', '45:1', '46:1', '50:1', '68:1',
]

# (ayah, word as written, what is transmitted or taught at it)
SAKTA = [
    ('18:1', 'عِوَجَا', 'sakta'),
    ('36:52', 'مَّرۡقَدِنَا', 'sakta'),
    ('69:28', 'مَالِيَهۡ', 'sakta or idgham'),
    ('75:27', 'مَنۡ', 'sakta'),
    ('83:14', 'بَلۡ', 'sakta'),
]
OPTIONS = [
    ('2:245', 'وَيَبۡصُطُ', 'seen or sad'),
    ('7:69', 'بَصۡطَةٗ', 'seen or sad'),
    ('52:37', 'ٱلۡمُصَيۡطِرُونَ', 'seen or sad'),
    ('88:22', 'بِمُصَيۡطِرٍ', 'seen or sad'),
    ('12:11', 'تَأۡمَ۬نَّا', 'ishmam or rawm'),
    ('30:54', 'ضَعۡفٖ', 'fath or damm'),
    ('30:54', 'ضَعۡفٗا', 'fath or damm'),
    ('27:36', 'ءَاتَىٰنِۦَ', 'ya kept or dropped at a stop'),
    ('76:4', 'سَلَٰسِلَاْ', 'alif kept or dropped at a stop'),
    ('7:176', 'يَلۡهَث', 'idgham or izhar'),
    ('11:42', 'ٱرۡكَب', 'idgham or izhar'),
    ('77:20', 'نَخۡلُقكُّم', 'full or partial idgham'),
    ('26:63', 'فِرۡقٖ', 'heavy or light ra'),
    ('34:12', 'ٱلۡقِطۡرِ', 'heavy or light ra at a stop'),
    ('10:87', 'بِمِصۡرَ', 'heavy or light ra at a stop'),
    ('12:21', 'مِّصۡرَ', 'heavy or light ra at a stop'),
    ('12:99', 'مِصۡرَ', 'heavy or light ra at a stop'),
    ('43:51', 'مِصۡرَ', 'heavy or light ra at a stop'),
    ('54:16', 'وَنُذُرِ', 'heavy or light ra at a stop'),
    ('54:18', 'وَنُذُرِ', 'heavy or light ra at a stop'),
    ('54:21', 'وَنُذُرِ', 'heavy or light ra at a stop'),
    ('54:30', 'وَنُذُرِ', 'heavy or light ra at a stop'),
    ('54:37', 'وَنُذُرِ', 'heavy or light ra at a stop'),
    ('54:39', 'وَنُذُرِ', 'heavy or light ra at a stop'),
    ('89:4', 'يَسۡرِ', 'heavy or light ra at a stop'),
    ('20:77', 'أَسۡرِ', 'heavy or light ra at a stop'),
    ('26:52', 'أَسۡرِ', 'heavy or light ra at a stop'),
    ('11:81', 'فَأَسۡرِ', 'heavy or light ra at a stop'),
    ('15:65', 'فَأَسۡرِ', 'heavy or light ra at a stop'),
    ('44:23', 'فَأَسۡرِ', 'heavy or light ra at a stop'),
    ('49:11', 'ٱلِٱسۡمُ', 'ways of starting on it'),
    ('6:143', 'ءَآلذَّكَرَيۡنِ', 'tashil or madd'),
    ('6:144', 'ءَآلذَّكَرَيۡنِ', 'tashil or madd'),
    ('10:51', 'ءَآلۡـَٰٔنَ', 'tashil or madd'),
    ('10:91', 'ءَآلۡـَٰٔنَ', 'tashil or madd'),
    ('10:59', 'ءَآللَّهُ', 'tashil or madd'),
    ('27:59', 'ءَآللَّهُ', 'tashil or madd'),
    ('36:1', 'يسٓ', 'noon joined or clear'),
    ('68:1', 'نٓ', 'noon joined or clear'),
    ('3:1', 'الٓمٓ', 'meem joined or stopped'),
    ('19:1', 'كٓهيعٓصٓ', 'length of ain'),
    ('42:2', 'عٓسٓقٓ', 'length of ain'),
]
# Words read differently from how they are written.
WRITTEN_FORM = [
    ('17:32', 'ٱلزِّنَىٰٓ', 'alif maqsura with madd'),
    ('24:31', 'أَيُّهَ', 'no alif in the writing'),
    ('43:49', 'يَٰٓأَيُّهَ', 'no alif in the writing'),
    ('55:31', 'أَيُّهَ', 'no alif in the writing'),
]
# Recordings that must stay whole across an ayah boundary: fed in order.
IN_ORDER = {'18:1': '18:2', '69:28': '69:29', '36:1': '36:2', '3:1': '3:2'}

MADD_LAZIM = re.compile('[اويىٰ]ٓ[ء-ي](ّ|ۡ)')
IDGHAM_START = re.compile('^[ينمولر]ّ')
ENDS_NOON_OR_TANWEEN = ('ٞ', 'ٖ', 'ٗ', 'ً', 'ٌ', 'ٍ', 'نۡ', 'ن')


def _find(hafs, key, word):
    """Tokens of this ayah with these letters. The table is for finding only:
    each site records the official token, whatever the table's mark order."""
    want = T.letters(word)
    return [j for j, w in enumerate(hafs[key]) if T.letters(w) == want]


def sites():
    """{category: [{key, token, engine, word, note}]}"""
    hafs = T.load_hafs()
    out = {}

    def add(category, key, j, note):
        if any(e['key'] == key and e['token'] == j for e in out.get(category, [])):
            return
        out.setdefault(category, []).append(
            {
                'key': key,
                'token': j,
                'engine': T.engine_word(key, j),
                'word': hafs[key][j],
                'note': note,
            }
        )

    for table, name in [(SAKTA, 'sakta'), (OPTIONS, 'options'), (WRITTEN_FORM, 'written_form')]:
        for key, word, note in table:
            found = _find(hafs, key, word)
            if not found:
                raise SystemExit(f'W5 table: {word} not in {key}: {hafs[key]}')
            for j in found:
                add(name, key, j, note)
    for key in MUQATTAAT:
        add('muqattaat', key, 0, 'letters read by name')
    for key in T.ayah_keys(hafs):
        t = hafs[key]
        for j, w in enumerate(t):
            if key not in MUQATTAAT and MADD_LAZIM.search(w):
                add('madd_lazim', key, j, 'madd before a doubled or still letter')
            if '۠' in w:
                add('silent_alif', key, j, 'alif silent while joining, read at a stop')
            if j > 0 and IDGHAM_START.search(w):
                prev = t[j - 1]
                if prev.endswith(ENDS_NOON_OR_TANWEEN) or prev[-2:] in ('ٗا', 'ٗى', 'ًا', 'نَ'):
                    add('idgham_across', key, j, 'noon or tanween joined into this word')
    return out
