"""
Release 1 highlight classification for the rewayah diff JSON (contract C2,
format 2), applied by build_sibling_rewayah.py to every content slot whose
stored text differs from the Hafs slot text.

classify(hafs_text, target_text, rid, ctx) returns a list of
  ("word", [])            whole-word tint; emitted as 'major' (close rewayat)
                          or 'mukhtalif' (far rewayat)
  ("silah", [i, ...])     the silah marks (U+06E5 / U+06E6 plus the damma /
                          kasra before them: the runtime's own selection)
                          that this rewayah pronounces where Hafs does not
`ctx` (Context) holds the word read after the slot in Hafs and in the
rewayah: the across-word rules below only apply in their real context.

A word gets the whole-word tint when it is READ differently from the Hafs
word in that slot: different letters (incl. a hamza Hafs does not have, the
seen of 'صِۜرَٰطَ', or a letter the rewayah never pronounces: Qunbul 75:1
'لَا۟' vs Hafs 'لَآ'), a different long vowel (the dagger alef counts as an
alef: 1:4 مَلِكِ vs مَٰلِكِ; an alef read in waqf only, ٱلظُّنُونَا۠), a
different doubling (5:89 عَقَدتُّمُ, تَذَّكَّرُونَ, idgham ٱتَّخَذتُّمُ), different
vowels on its letters, or a different case ending (2:214 يَقُولُ vs يَقُولَ,
2:284 فَيَغْفِرْ, ya' al-idafa إِنِّيَ vs إِنِّيٓ). In the close rewayat an imala
dot is also a difference (Shu'bah رٜءٜا, حٜمٓ).

NOT highlighted (the reading_key() normalizations):
  encoding    KFGQPC (Maghribi) vs DK (Madani) spelling of the same reading:
              the wasl alef written alef + connecting vowel (+ start dot),
              sukun / rounded-zero shapes, open vs closed tanween, tanween
              written after a final alef (also after a hamza on a tatweel:
              'خَطَـٔاࣰ' = 'خَطَـࣰٔا'), ى / ي / ے, ٱ / آ / ا, full vs dagger
              alef, the unmarked assimilated lam of الذين / لله, the doubled
              ta' of an idgham naqis (بَسَطتَ / بَسَط۟تَّ), hamza seat on a
              tatweel vs on the ya, a vowelless hamza on an alef, tatweel or
              dagger alef seat (Qalun يَسْتَٰٔذِنُكَ; 'فَادَّٰرَٰءْتُمْ' = 'فَٱدَّٰرَٰٔتُمْ'), a
              hamza on the line before a silent final ya ('تِلْقَآءِى۟' =
              'تِلْقَآئِ'), a long vowel written small inside a word (دَاوُۥدَ), an
              assimilated nun written or not ('وَأَن لَّوِ' / 'وَأَلَّوِ'), the
              upright zero in the Nafi' texts (never written), CGJ / ZWJ /
              tatweel, iqlab meem forms, waqf and sajdah signs, rub' el-hizb,
              and a doubled FIRST letter (an idgham with the previous word,
              which carries the difference itself). A letter with U+06DF is
              never pronounced in Hafs, the close rewayat and Abu 'Amr and is
              left out on both sides (not in the Nafi' texts, where U+06DF
              is also the sukun; not on the first letter of an Abu 'Amr word,
              where it is the start dot of a wasl alef).
  usul        rules marked by diacritics or by the hamza's carrier only:
              madd length (U+0653), imala / taqlil dots in the far rewayat (a
              dot written instead of the fatha counts as the fatha), the
              second of two hamzas and, before a word that starts with a
              hamza, the dropped first of two hamzas across words (non-Kufi
              rewayat), and for Warsh and al-Susi the softened hamza (ibdal,
              naql, tashil), compared as the long vowel it becomes. Across
              words, only in context (`Context`):
                Warsh naql: the final consonant gains the vowel of the next
                  word's hamza ('قَدَ اَف۟لَحَ' for 'قَدْ أَفْلَحَ'): this
                  word ends in a consonant (not a madd letter) that is
                  vowelless in Hafs, the next Hafs word starts with a hamza
                  with that vowel, and the next Warsh word lost the hamza.
                  The vowel moved is the one Warsh's next word shows on its
                  bare alef (a start dot = damma: 9:109 'مَنُ ا۟سِّسَ'); the
                  KFGQPC Warsh text also joins surahs this way (93:11).
                al-Susi idgham kabir: the final letter, voweled in Hafs,
                  loses its vowel ('ٱلرَّحِيم مَّلِكِ') or its silah ('فِيه
                  هُّدࣰى') because it merges into the next word, whose first
                  letter is doubled in al-Susi but not in Hafs; a meem before
                  ba is concealed without its vowel and the ba is not doubled
                  ('أَعْلَم بِمَا'); a ba ending a surah merges into the ba of
                  the next surah's basmala (13:43, 14:52; the signed al-Susi
                  Word file writes that basmala 'بِّسۡمِ').
              In the far rewayat the vowel of a final letter may also be
              written only as the connecting vowel of the next word's wasl
              alef (encoding: al-Susi 14:36 'مِّن اَ۬لنَّاسِ').
              Anywhere else a vowel added or dropped on the last letter is a
              difference: a ya' al-idafa opened or closed (Warsh إِنِّيَ), a
              ha' al-kinaya with sukun or without its silah outside a merge
              (al-Susi يُؤَدِّهْ, 25:69 فِيهِ for Hafs فِيهِۦ), a jazm (19:6
              وَيَرِثْ).
              The first letter of a word may lose its hamza (naql, the second
              of two hamzas across words), never gain one (al-Duri 10:81
              'ءَآلسِّحْرُ' for 'ٱلسِّحْرُ' is a difference).
  silah       the 'silah' category instead (a Hafs-only silah, e.g. 25:69
              فِيهِۦ in Warsh, is a whole-word difference: there is no mark
              to colour).

Siblings: two narrators of one reader (Warsh / Qalun, al-Susi / al-Duri)
who store the same words in a slot read it the same way. The builder gives
Warsh and al-Susi the whole-word tint that Qalun / al-Duri get for the same
stored words (`SIBLING_BASE`): their extra usul rules must not hide a farsh
difference, e.g. Nafi' يَاجُوجَ (18:94), Abu 'Amr فَيَغْفِر لِّمَن (2:284, jazm
plus idgham, which reads like al-Susi's idgham kabir). The validator checks
that every pair, al-Bazzi / Qunbul included, agrees on identical stored words.

No letter-level category (tashil / madd / ibdal / taghliz / minor) is
emitted in Release 1.
"""
from __future__ import annotations

import re
import unicodedata
from collections import Counter
from dataclasses import dataclass

FATHA, DAMMA, KASRA = "\u064E", "\u064F", "\u0650"
FATHATAN, DAMMATAN, KASRATAN = "\u064B", "\u064C", "\u064D"
SHORT_VOWELS = frozenset((FATHA, DAMMA, KASRA))
VOWELS = frozenset("\u064B\u064C\u064D\u064E\u064F\u0650")
TANWEEN = frozenset("\u064B\u064C\u064D")
TANWEEN_OF = {FATHA: FATHATAN, DAMMA: DAMMATAN, KASRA: KASRATAN}
OPEN_TANWEEN = frozenset("\u08F0\u08F1\u08F2")
HAMZA_MARKS = frozenset("\u0654\u0655")
HAMZA_MARK = "\u0654"
IQLAB_MEEMS = frozenset("\u06E2\u06ED")
DOT_BELOW = "\u065C"
TATWEEL = "\u0640"
SHADDA = "\u0651"
MADD = "\u0653"
SILENT = "\u06DF"  # DK rounded zero: a letter never pronounced (Nafi' texts: also the sukun)
UPRIGHT_ZERO = "\u06E0"
DAGGER_ALEF = "\u0670"
RUB_EL_HIZB = "\u06DE"
ALEF, WAW, YEH, LAM, HAMZA, NOON = "\u0627", "\u0648", "\u064A", "\u0644", "\u0621", "\u0646"
TEH, TAH = "\u062A", "\u0637"
ASSIMILATING = frozenset("\u0644\u0631\u0645\u0646\u0648\u064A")  # ل ر م ن و ي
HAMZA_SEATS = frozenset("\u064A\u0649\u0648\u0627")  # ي ى و ا
SILAH_CHARS = frozenset("\u06E5\u06E6")
SILAH_CARRIER_VOWELS = frozenset("\u064F\u0650")
PREFIX_LETTERS = frozenset("\u0648\u0641\u0628\u0644\u0643\u0633")  # و ف ب ل ك س

CLOSE = frozenset({"shouba", "bazzi", "qumbul"})
NAFI = frozenset({"warsh", "qaloon"})
ABU_AMR = frozenset({"doori", "soosi"})
FAR = NAFI | ABU_AMR
KUFI = frozenset({"shouba"})  # reads both of two hamzas
HAMZA_SOFTENING = frozenset({"warsh", "soosi"})  # general ibdal / naql / tashil of the hamza
MAGHRIBI_LAM = frozenset({"warsh", "qaloon", "doori", "soosi"})
# The KFGQPC Nafi' texts never write the upright zero (alef dropped in wasl).
MAGHRIBI_NO_UPRIGHT_ZERO = frozenset({"warsh", "qaloon"})
# rewayah -> its sibling without the extra usul rules (see the module docstring)
SIBLING_BASE = {"warsh": "qaloon", "soosi": "doori"}
# sibling pairs whose identical stored words must get the same whole-word decision
SIBLING_PAIRS = (("warsh", "qaloon"), ("doori", "soosi"), ("bazzi", "qumbul"))

# Removed from the key: encoding-only signs and diacritic-only general rules.
_REMOVE = frozenset(
    "\u06D6\u06D7\u06D8\u06D9\u06DA\u06DB"  # waqf signs
    "\u06DE\u06E9"  # rub' el-hizb, sajdah
    "\u034F\u200D"  # CGJ, ZWJ
    "\u08F3"  # DK's small high waw of 17:7 (the KFGQPC texts, Hafs included, omit it)
    "\u0652\u06E1"  # sukun shapes (U+06DF is read by _token_units: the silent flag)
    "\u0651"  # shadda
    "\u0653\u06E4"  # madd, sajdah overline
    "\u06EC\u06EA"  # wasl / tashil dots (U+065C is resolved per letter)
)
_LETTER_CANON = {
    "\u0671": ALEF,  # ٱ
    "\u0622": ALEF,  # آ
    "\u0670": ALEF,  # dagger alef is an alef (long vowel)
    "\u0649": YEH,  # ى
    "\u06D2": YEH,  # ے
    "\u06E7": YEH,  # small high yeh
    "\u06E8": "\u0646",  # small high noon
    "\u06DC": "\u0633",  # small high seen (read with seen / sakta)
    "\u06E3": "\u0633",  # small low seen
}
_MARK_CANON = {"\u08F0": FATHATAN, "\u08F1": DAMMATAN, "\u08F2": KASRATAN}
_DECOMPOSE = {  # precomposed hamza letters (DK text is already decomposed)
    "\u0623": ALEF + "\u0654",
    "\u0625": ALEF + "\u0655",
    "\u0624": WAW + "\u0654",
    "\u0626": YEH + "\u0654",
}
# Maghribi wasl alef: alef + connecting vowel + start dot (U+06EC above,
# U+065C/U+06EA below), in either order. The start dot U+06DF only counts at
# the start of a word of a far rewayah: elsewhere U+06DF marks a silent letter.
_WASL = re.compile("\u0627[\u064E\u064F\u0650]?[\u06EC\u065C\u06EA][\u064E\u064F\u0650]?")
_WASL_START = re.compile("^(\u06DE?)\u0627[\u064E\u064F\u0650]?\u06DF[\u064E\u064F\u0650]?")


@dataclass(frozen=True)
class Context:
    """The words read after a slot: the first word of the next non-blank
    content slot in Hafs and in the rewayah (verse markers skipped, verse and
    surah ends crossed; '' after 114:6). `basmala_next`: the slot is the last
    word of a surah followed by a basmala (not before at-Tawbah), which is not
    in the verse data."""

    hafs_next: str = ""
    target_next: str = ""
    basmala_next: bool = False


class _Unit:
    __slots__ = ("letter", "marks", "silah", "shadda", "dagger", "hamza", "dot", "token_start", "silent")

    def __init__(self, letter: str, dagger: bool = False) -> None:
        self.letter = letter
        self.marks = ""
        self.silah = False
        self.shadda = False
        self.dagger = dagger
        self.hamza = False  # carried a hamza mark
        self.dot = False  # carried a tashil / imala dot
        self.token_start = False  # first letter of its whitespace token
        self.silent = False  # carried U+06DF


def _is_letter(c: str) -> bool:
    return c in _LETTER_CANON or (c != TATWEEL and unicodedata.category(c) == "Lo")


def _is_final_small_letter(token: str, i: int) -> bool:
    """A small waw / yeh is a silah (or a ya' zawa'id) mark when no letter
    follows it in its token; inside a word it is a long-vowel letter written
    small (دَاوُۥدَ, إِۦلَٰفِهِمْ)."""
    return not any(unicodedata.category(c) == "Lo" for c in token[i + 1 :])


def _vowel_follows(t: str, j: int) -> bool:
    """The letter at t[j] carries a vowel or tanween."""
    k = j + 1
    while k < len(t) and not _is_letter(t[k]) and t[k] != TATWEEL:
        if t[k] in VOWELS or t[k] in OPEN_TANWEEN:
            return True
        k += 1
    return False


def _units(text: str, rid: str) -> tuple[list[_Unit], int]:
    """-> (letter units with their marks, number of hamza signs)."""
    units: list[_Unit] = []
    hamzas = 0
    for token in text.split(" "):
        u, h = _token_units(token, rid)
        if rid not in NAFI:
            # a letter with U+06DF is never pronounced (DK Hafs, close rewayat,
            # Abu 'Amr), except the start dot on the first letter of an Abu
            # 'Amr word; in the Nafi' texts U+06DF is also the sukun
            u = [x for k, x in enumerate(u) if not (x.silent and not (k == 0 and rid in ABU_AMR))]
        if u:
            u[0].token_start = True
        units.extend(u)
        hamzas += h
    return units, hamzas


def _token_units(token: str, rid: str) -> tuple[list[_Unit], int]:
    t = token
    for src, dst in _DECOMPOSE.items():
        t = t.replace(src, dst)
    if rid in FAR:
        t = _WASL_START.sub(r"\g<1>" + ALEF, t)
    t = _WASL.sub(ALEF, t)
    hamzas = sum(1 for c in t if c == HAMZA or c in HAMZA_MARKS)
    units: list[_Unit] = []
    n = len(t)
    skip: set[int] = set()
    for i, c in enumerate(t):
        if i in skip:
            continue
        if c in SILAH_CHARS:
            if _is_final_small_letter(t, i):
                if units:
                    units[-1].silah = True
            else:
                units.append(_Unit(WAW if c == "\u06E5" else YEH))
            continue
        if c == TATWEEL:
            j = i + 1
            while j < n and not _is_letter(t[j]) and t[j] != TATWEEL:
                if t[j] in HAMZA_MARKS:
                    # hamza on a tatweel seat: DK writes it after a ya / waw on
                    # the tatweel, KFGQPC Nafi' on the ya itself
                    if not (units and units[-1].letter in HAMZA_SEATS):
                        units.append(_Unit(HAMZA))
                    break
                j += 1
            continue
        if c == SHADDA:
            if units:
                units[-1].shadda = True
            continue
        if c == SILENT:
            if units:
                units[-1].silent = True
            continue
        if c in _REMOVE:
            continue
        if c == DAGGER_ALEF:
            j = i + 1
            while j < n and t[j] in _REMOVE:
                j += 1
            if j < n and t[j] in HAMZA_MARKS:
                # a dagger alef carrying the hamza is its seat, not a long vowel:
                # Qalun 'يَسْتَٰٔذِنُكَ' reads like Hafs 'يَسْتَـْٔذِنُكَ'
                units.append(_Unit(HAMZA))
                continue
            if j < n and t[j] == HAMZA and MADD not in t[i + 1 : j] and not _vowel_follows(t, j):
                # a vowelless hamza on the line right after a dagger alef sits on
                # it (a long vowel cannot precede a sakin hamza inside a word):
                # KFGQPC 'فَادَّٰرَٰءْتُمْ' = DK 'فَٱدَّٰرَٰٔتُمْ' (2:72)
                seat = _Unit(HAMZA)
                seat.marks = HAMZA_MARK  # as the DK form carries it
                units.append(seat)
                skip.add(j)
                continue
        if _is_letter(c):
            units.append(_Unit(_LETTER_CANON.get(c, c), dagger=c == DAGGER_ALEF))
        elif units:
            units[-1].marks += _MARK_CANON.get(c, c)
    for k, u in enumerate(units):
        marks = u.marks
        u.hamza = any(c in HAMZA_MARKS for c in marks)
        u.dot = DOT_BELOW in marks
        if any(c in IQLAB_MEEMS for c in marks):  # vowel + small meem = tanween with iqlab
            marks = "".join(TANWEEN_OF.get(c, c) for c in marks if c not in IQLAB_MEEMS)
        if u.dot and rid not in CLOSE:  # imala / taqlil dot written instead of the fatha
            marks = marks.replace(DOT_BELOW, "")
            if not any(c in VOWELS for c in marks):
                marks += FATHA
        if rid != "warsh" and u.letter == ALEF and not u.hamza:
            # A bare alef (no hamza mark) with a short vowel is a wasl alef with
            # its connecting vowel (Doori 'وَاَلَّذِينَ', 'تَاَللَّهِ'). In Warsh it
            # is also a naql'd hamza keeping its own vowel ('قَدَ اَفْلَحَ'),
            # compared against the Hafs hamza vowel, so Warsh keeps it.
            marks = "".join(c for c in marks if c not in (FATHA, DAMMA, KASRA))
        vowelless = not any(c in VOWELS or c == DOT_BELOW for c in marks)
        if k and u.letter == ALEF and u.hamza and not u.dagger and vowelless:
            # a vowelless hamza inside a word is the same on an alef seat
            # (Hafs 'يَسْتَأْخِرُونَ') as on a tatweel or dagger seat
            u.letter = HAMZA
        u.marks = marks
    if (
        len(units) >= 2
        and units[-1].letter == YEH
        and units[-1].silent
        and not units[-1].marks
        and units[-2].letter == HAMZA
        and KASRA in units[-2].marks
        and not any(c in TANWEEN for c in units[-2].marks)
    ):
        # a hamza on the line + kasra before a silent final ya: the ya is the
        # hamza's seat (KFGQPC Nafi' 'تِلْقَآءِى۟' = DK 'تِلْقَآئِ', 10:15)
        seat = units[-2]
        seat.letter, seat.hamza, seat.marks = YEH, True, HAMZA_MARK + seat.marks
        units.pop()
    return units, hamzas


def reading_key(text: str, rid: str) -> tuple[list[_Unit], int]:
    units, hamzas = _units(text, rid)
    # word-initial hamza (after up to two prefix letters): DK 'ءَا', KFGQPC Nafi' 'اٰ'
    for i, u in enumerate(units):
        if u.letter == HAMZA and i <= 2 and all(x.letter in PREFIX_LETTERS for x in units[:i]):
            u.letter = ALEF
    if rid in MAGHRIBI_LAM:
        # ٱلَّٰتِي / ٱلَّٰٓـِٔي: Maghribi texts write the long a after the article lam unmarked
        k = 0
        while k < 2 and k < len(units) and units[k].letter in PREFIX_LETTERS and units[k].letter != LAM:
            k += 1
        if len(units) > k + 3 and units[k].letter == ALEF and units[k + 1].letter == LAM and units[k + 2].dagger:
            del units[k + 2]
    softening = rid in HAMZA_SOFTENING
    prev_vowels = ""
    for u in units:
        has_hamza = any(x in HAMZA_MARKS for x in u.marks)
        vowels = "".join(sorted(x for x in u.marks if x in VOWELS))
        if DOT_BELOW in u.marks:  # close rewayat: the imala dot is kept as a mark
            vowels += DOT_BELOW
        if UPRIGHT_ZERO in u.marks and rid not in MAGHRIBI_NO_UPRIGHT_ZERO:
            vowels += UPRIGHT_ZERO  # alef read in waqf only (ٱلظُّنُونَا۠ vs Shu'bah ٱلظُّنُونَا)
        if softening:
            if u.letter == HAMZA:
                # ibdal / tashil: the hamza becomes the long vowel of the vowel
                # before it (رُءْيَا -> رُويَا), otherwise an alef
                u.letter = WAW if DAMMA in prev_vowels else YEH if KASRA in prev_vowels else ALEF
                vowels = "".join(x for x in vowels if x in TANWEEN)
            u.marks = vowels
        else:
            u.marks = (HAMZA_MARK if has_hamza else "") + vowels
        prev_vowels = vowels
    # a vowelless nun assimilated into a doubled letter is not pronounced: the
    # rasm may write it ('وَأَن لَّوِ', KFGQPC Nafi' / Abu 'Amr) or not ('وَأَلَّوِ')
    units = [
        u
        for k, u in enumerate(units)
        if not (
            u.letter == NOON
            and not u.marks
            and k + 1 < len(units)
            and units[k + 1].shadda
            and units[k + 1].letter in ASSIMILATING
        )
    ]
    if rid not in KUFI:
        # the second of two hamzas is softened / changed in every non-Kufi rewayah
        for i in range(1, len(units)):
            prev, cur = units[i - 1], units[i]
            if prev.letter not in (ALEF, HAMZA) or not prev.marks:
                continue
            if cur.letter in (ALEF, HAMZA):
                if cur.letter == ALEF and not (cur.hamza or cur.dot or any(x in SHORT_VOWELS for x in cur.marks)):
                    continue  # a long alef, or the seat of a tanween ('خَطَـٔاࣰ'): no second hamza
                cur.letter, cur.marks = ALEF, ""
            elif cur.letter in HAMZA_SEATS and (cur.hamza or cur.dot) and (prev.hamza or prev.letter == HAMZA):
                cur.marks = ""  # أَئِنَّا: the second hamza on a ya / waw seat
    # tanween written after a final alef / ya -> on the letter before it
    if len(units) >= 2 and units[-1].letter in (ALEF, YEH) and any(x in TANWEEN for x in units[-1].marks):
        if not any(x in VOWELS for x in units[-2].marks):
            units[-2].marks += units[-1].marks
            units[-1].marks = ""
    # silent alef after a final waw
    if len(units) >= 2 and units[-1].letter == ALEF and units[-2].letter == WAW and not units[-1].marks:
        units.pop()
    # alef runs (madd, hamza + alef) collapse
    merged: list[_Unit] = []
    for u in units:
        if merged and u.letter == ALEF and merged[-1].letter == ALEF and not u.marks:
            merged[-1].silah |= u.silah
            continue
        merged.append(u)
    if rid == "warsh":
        # naql inside the word (al- + hamza): the vowel sits on the consonant before
        for i in range(1, len(merged)):
            a, b = merged[i - 1], merged[i]
            if b.letter == ALEF and b.marks and not a.marks and a.letter != ALEF:
                a.marks, b.marks = b.marks, ""
    return merged, hamzas


# ---------------------------------------------------------------------------
# Across-word context
# ---------------------------------------------------------------------------


def _lead_unit(word: str, rid: str) -> _Unit | None:
    """The first letter unit of a word (a rub' el-hizb prefix skipped)."""
    w = word.lstrip(RUB_EL_HIZB)
    if not w:
        return None
    units, _ = _token_units(w, rid)
    return units[0] if units else None


def _hamza_vowel(u: _Unit | None) -> str:
    """The short vowel of a hamza unit ('' if `u` is not a hamza with one vowel)."""
    if u is None or not (u.letter == HAMZA or u.hamza):
        return ""
    vs = [c for c in u.marks if c in SHORT_VOWELS]
    return vs[0] if len(vs) == 1 else ""


def _is_madd_letter(units: list[_Unit], k: int) -> bool:
    u = units[k]
    prev = units[k - 1].marks if k else ""
    return u.letter == ALEF or (u.letter == WAW and DAMMA in prev) or (u.letter == YEH and KASRA in prev)


_WASL_LEAD = re.compile("^\u06DE?\u0627([\u064E\u064F\u0650]?)[\u06EC\u065C\u06EA]([\u064E\u064F\u0650]?)")


def _connecting_vowel(word: str) -> str:
    """The connecting vowel written on a Maghribi wasl alef at the start of
    `word` ('اَ۬لنَّاسِ' -> fatha): the vowel the previous word ends with."""
    m = _WASL_LEAD.match(word)
    return (m.group(1) or m.group(2)) if m else ""


_WASL_DOTS = frozenset("\u06EC\u065C\u06EA\u06DF")


def _naql_vowel(word: str) -> str | None:
    """Warsh: the vowel of the hamza that naql dropped at the start of `word`,
    as the KFGQPC text writes it on the bare alef: the vowel itself
    ('اَف۟لَحَ'), the start dot alone for damma ('ا۟سِّسَ'), or nothing
    ('اٰدَمَ': ''). None when `word` does not start with such an alef, e.g.
    a wasl alef, whose connecting vowel is followed by a dot ('اِٜس۟رِ')."""
    w = word.lstrip(RUB_EL_HIZB)
    if not w.startswith(ALEF):
        return None
    nxt = w[1] if len(w) > 1 else ""
    if nxt in SHORT_VOWELS:
        return None if len(w) > 2 and w[2] in _WASL_DOTS else nxt
    if nxt == SILENT:
        return DAMMA
    if nxt in _WASL_DOTS or nxt in HAMZA_MARKS:
        return None
    return ""


def _warsh_naql(a: list[_Unit], b: list[_Unit], ctx: Context) -> bool:
    """Warsh: the final consonant (vowelless in Hafs) carries the vowel of the
    next word's hamza, which Warsh drops ('قَدَ اَف۟لَحَ' for 'قَدْ أَفْلَحَ',
    also into the next surah: 93:11 'فَحَدِّثَ اَلَم۟')."""
    x, y = a[-1], b[-1]
    if x.marks or y.marks not in SHORT_VOWELS or _is_madd_letter(a, len(a) - 1):
        return False
    moved = _naql_vowel(ctx.target_next)
    if moved is None:
        return False  # the next Warsh word keeps its hamza, or starts with a wasl alef
    hafs_vowel = _hamza_vowel(_lead_unit(ctx.hafs_next, "warsh"))
    if not hafs_vowel:
        return False  # the next Hafs word does not start with a hamza
    # the vowel moved is that of Warsh's own next word (9:109 'مَنُ ا۟سِّسَ'
    # for Hafs 'مَنْ أَسَّسَ'); when its alef shows none, the Hafs hamza's
    return y.marks == (moved or hafs_vowel)


def _idgham_kabir_into_next(ctx: Context) -> bool:
    """al-Susi: the next word's first letter is doubled (the merged letter of
    this word) where Hafs does not double it ('ٱلرَّحِيم مَّلِكِ')."""
    t = _lead_unit(ctx.target_next, "soosi")
    h = _lead_unit(ctx.hafs_next, "soosi")
    return t is not None and t.shadda and not (h is not None and h.shadda)


def _susi_merge(a: list[_Unit], ctx: Context) -> bool:
    """al-Susi's idgham kabir of the final letter into the next word:
    the next word's first letter doubled (see _idgham_kabir_into_next);
    a meem before ba, concealed (ikhfa') without its vowel and without a
    doubled ba ('أَعْلَم بِمَا');
    a ba at the end of a surah into the ba of the next surah's basmala (the
    signed al-Susi Word file writes that basmala 'بِّسۡمِ': 13:43, 14:52)."""
    if _idgham_kabir_into_next(ctx):
        return True
    last = a[-1].letter
    nxt = _lead_unit(ctx.target_next, "soosi")
    if last == "\u0645" and nxt is not None and nxt.letter == "\u0628" and not ctx.basmala_next:
        return True
    return ctx.basmala_next and last == "\u0628"


def _final_vowel_excused(a: list[_Unit], b: list[_Unit], rid: str, ctx: Context) -> bool:
    """A vowel added or dropped on the last letter that an across-word rule
    explains in its context: Warsh's naql, al-Susi's idgham kabir, or the
    Maghribi connecting vowel. Anywhere else it is a reading difference: a
    ya' al-idafa opened or closed (a madd letter takes no naql), a ha'
    al-kinaya with sukun, a jazm."""
    x, y = a[-1], b[-1]
    if rid in FAR and len(x.marks) == 1 and x.marks in SHORT_VOWELS and not y.marks:
        if _connecting_vowel(ctx.target_next) == x.marks:
            # encoding: the vowel is written only as the connecting vowel of
            # the next word's wasl alef (al-Susi 14:36 'مِّن اَ۬لنَّاسِ')
            return True
    if rid == "warsh":
        return _warsh_naql(a, b, ctx)
    if rid == "soosi":
        return any(c in SHORT_VOWELS for c in x.marks) and not y.marks and _susi_merge(a, ctx)
    return False


def _word_differs(hafs: str, target: str, rid: str, ctx: Context = Context()) -> bool:
    a, ha = reading_key(hafs, rid)
    b, hb = reading_key(target, rid)
    la = [u.letter for u in a]
    lb = [u.letter for u in b]
    if la != lb:
        # the first of two hamzas across words dropped (isqat), non-Kufi
        if (
            rid not in KUFI
            and la[-1:] == [HAMZA]
            and la[:-1] == lb
            and _hamza_vowel(_lead_unit(ctx.hafs_next, rid))
        ):
            a = a[:-1]
        else:
            return True
    if not a:
        return bool(b)
    if not any(u.marks for u in a):
        # unvowelled Hafs word (muqatta'at: Nafi' writes أَلَٓرٜ); an imala dot
        # is still a difference in the close rewayat (Shu'bah حمٓ -> حٜمٓ)
        return any(DOT_BELOW in y.marks for y in b)
    if rid in HAMZA_SOFTENING and hb > ha:
        return True  # a hamza Hafs does not have (e.g. Nafi' النَّبِيٓءَ)
    n = len(a)
    for i, (x, y) in enumerate(zip(a, b)):
        if x.shadda != y.shadda and not _shadda_excused(i, a, b, rid):
            return True  # عَقَدتُّمُ / عَقَّدتُّمُ, تَذَّكَّرُونَ, نَزَّلَ, idgham ٱتَّخَذتُّمُ
        if x.marks == y.marks:
            continue
        one_sided = not x.marks or not y.marks
        if one_sided and (x.silah or y.silah):
            continue  # vowel carried by a silah (meem al-jam', ha' al-kinaya)
        if i == n - 1 and one_sided and _final_vowel_excused(a, b, rid, ctx):
            continue  # Warsh naql / al-Susi idgham kabir into the next word
        if i == 0 and x.letter == ALEF and x.marks and not y.marks and rid not in KUFI:
            continue  # word-initial hamza dropped: naql (Warsh) / second of two hamzas across words
        if (
            rid == "soosi"
            and not y.marks
            and i + 1 < n
            and b[i + 1].shadda
            and not a[i + 1].shadda
        ):
            continue  # idgham kabir inside the word (خَلَقكُّمْ)
        if x.letter == LAM and rid in MAGHRIBI_LAM and x.marks in ("", FATHA) and y.marks in ("", FATHA):
            continue  # unmarked assimilated lam (الذين, لله)
        return True
    return False


def _shadda_excused(i: int, a: list[_Unit], b: list[_Unit], rid: str) -> bool:
    x, y = a[i], b[i]
    if x.token_start or y.token_start:
        return True  # doubled first letter = idgham with the previous word (مَن يَّقُولُ)
    if x.letter == LAM and rid in MAGHRIBI_LAM and x.marks in ("", FATHA) and y.marks in ("", FATHA):
        return True  # unmarked assimilated lam (الذين, لله)
    if rid == "soosi" and i >= 1 and not b[i - 1].marks and a[i - 1].marks and y.shadda:
        return True  # idgham kabir inside the word (خَلَقكُّمْ)
    if x.letter == TEH and i >= 1 and a[i - 1].letter == TAH:
        return True  # idgham naqis of ta' in ta: DK بَسَطتَ, KFGQPC Nafi' بَسَط۟تَّ
    return False


def silah_char_indices(text: str) -> list[int]:
    """The runtime's silah selection (RewayahDiffService.getSilahCharsForLine)."""
    out: list[int] = []
    for i, c in enumerate(text):
        if c in SILAH_CHARS:
            if i > 0 and text[i - 1] in SILAH_CARRIER_VOWELS:
                out.append(i - 1)
            out.append(i)
    return out


def _silah_sites(text: str) -> list[tuple[int, str, str]]:
    """(char index, preceding base letter, silah char) for every silah mark
    (a small waw / yeh at the end of its token)."""
    out = []
    for i, c in enumerate(text):
        if c not in SILAH_CHARS:
            continue
        end = text.find(" ", i)
        if _is_final_small_letter(text[: end if end >= 0 else len(text)], i):
            j = i - 1
            while j >= 0 and not _is_letter(text[j]):
                j -= 1
            out.append((i, text[j] if j >= 0 else "", c))
    return out


def classify(hafs: str, target: str, rid: str, ctx: Context = Context()) -> list[tuple[str, list[int]]]:
    """Categories for a content slot whose stored text differs from Hafs.

    `target` is the stored slot text WITHOUT inline verse markers; char
    indices are into it (UTF-16 == code points: no astral characters).
    `ctx` holds the next words (see Context); without it no across-word
    rule applies."""
    cats: list[tuple[str, list[int]]] = []
    if _word_differs(hafs, target, rid, ctx):
        cats.append(("word", []))
    remaining = Counter((p, c) for _, p, c in _silah_sites(hafs))
    new_sites = []
    for idx, p, c in reversed(_silah_sites(target)):
        if remaining[(p, c)] > 0:
            remaining[(p, c)] -= 1
        else:
            new_sites.append(idx)
    if new_sites:
        chars: list[int] = []
        for idx in sorted(new_sites):
            if idx > 0 and target[idx - 1] in SILAH_CARRIER_VOWELS:
                chars.append(idx - 1)
            chars.append(idx)
        cats.append(("silah", chars))
    elif sum(remaining.values()) > 0 and not cats and not (rid == "soosi" and _idgham_kabir_into_next(ctx)):
        # Hafs pronounces a silah this rewayah does not (al-Susi excused only
        # where the ha merges into the next word: 'فِيه هُّدࣰى')
        cats.append(("word", []))
    return cats
