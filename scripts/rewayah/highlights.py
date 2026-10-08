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
`ctx` (Context) holds the words read before and after the slot in Hafs and
in the rewayah: the across-word rules below only apply in their real context.

A word gets the whole-word tint when it is READ differently from the Hafs
word in that slot: different letters (incl. a hamza Hafs does not have, the
seen of 'صِۜرَٰطَ', or a letter the rewayah never pronounces: Qunbul 75:1
'لَا۟' vs Hafs 'لَآ'), a different long vowel (the dagger alef counts as an
alef: 1:4 مَلِكِ vs مَٰلِكِ; 33:14 لَأَتَوْهَا vs لَـَٔاتَوْهَا; an alef read
in waqf only, ٱلظُّنُونَا۠, which Shu'bah and Nafi' also read in wasl: the
Nafi' texts never write U+06E0, so their plain alef counts as read in wasl
only in the NAFI_WASL_ALEF words), a different doubling (5:89 عَقَدتُّمُ,
تَذَّكَّرُونَ, idgham ٱتَّخَذتُّمُ; al-Bazzi's doubled first ta' 'وَلَآ
تَّيَمَّمُوا۟', see below), different vowels on its letters, or a
different case ending (2:214 يَقُولُ vs يَقُولَ, 2:284 فَيَغْفِرْ, ya' al-idafa
إِنِّيَ vs إِنِّيٓ), a question read as a statement or the reverse (7:123
ءَاٰ۬مَنتُم vs ءَامَنتُم, 38:63 اِتَّخَذْنَٰهُمْ vs أَتَّخَذْنَٰهُمْ), a hamzat qat'
read as a wasl alef (20:77 ٱسْرِ vs أَسْرِ). In the close rewayat an imala
dot is also a difference (Shu'bah رٜءٜا, حٜمٓ).

NOT highlighted (the reading_key() normalizations):
  encoding    KFGQPC (Maghribi) vs DK (Madani) spelling of the same reading:
              the wasl alef written alef + connecting vowel (+ start dot),
              sukun / rounded-zero shapes, open vs closed tanween, tanween
              written after a final alef (also after a hamza on a tatweel:
              'خَطَـٔاࣰ' = 'خَطَـࣰٔا'), ى / ي / ے, ٱ / آ / ا, full vs dagger
              alef, the unmarked doubled lam of the article in الذين / لله
              (only there), the long a the Maghribi texts leave unwritten
              after the doubled lam of ٱلَّٰتِي, the doubled ta' of an idgham
              naqis (بَسَطتَ / بَسَط۟تَّ), the hamza's seat (alef, waw, ya,
              tatweel, dagger alef or the line: 'مُنشَأَٰتُ' = 'مُنشَـَٔاتُ',
              Qalun يَسْتَٰٔذِنُكَ, 'فَادَّٰرَٰءْتُمْ' = 'فَٱدَّٰرَٰٔتُمْ'), the Maghribi
              order of a hamza written on the alef of lam-alif (Qalun
              'اُ۬ءَلٰ۟نَ' = 'ٱلْـَٰٔنَ'), a hamza on the line before a silent
              final ya ('تِلْقَآءِى۟' = 'تِلْقَآئِ'), a long vowel written small
              inside a word (دَاوُۥدَ), an assimilated nun written or not
              ('وَأَن لَّوِ' / 'وَأَلَّوِ'), the upright zero in the Nafi' texts
              (never written, see above), CGJ / ZWJ / tatweel, iqlab meem
              forms, waqf and sajdah signs, rub' el-hizb, the small low seen
              of Hafs 52:37 ٱلْمُصَۣيْطِرُونَ (read with sad, seen also
              allowed: Qunbul's seen is the difference), a final long a
              written without its dagger alef before a wasl alef (not read
              before the sakin: Warsh 20:135 'اِٜه۟تَدَى' joined to 21:1), the
              reviewed NAFI_SPELLINGS (14:5, 51:47, 55:54), and a doubled
              FIRST letter where the rewayah's previous word merges into it
              (idgham: a tanween or a nun before ي ر م ل و ن, a waw / ya into
              itself, any other consonant written without vowel or sukun, in
              al-Susi also one his idgham kabir merges; that word carries
              any difference itself). After an alef, a hamza, a silah, a
              sukun, a nun or tanween before another letter, or a vowel, a
              doubled first letter is the word's own reading (al-Bazzi's
              tashdid of the ta': 'وَلَآ تَّيَمَّمُوا۟', 'فَإِن تَّوَلَّوْا۟',
              'هَلْ تَّرَبَّصُونَ'). A letter with U+06DF is never pronounced in Hafs, the
              close rewayat and Abu 'Amr and is left out on both sides (in the
              Nafi' texts, where U+06DF is also the sukun, only an alef inside
              a word: 'وَجِا۟يٓءَ' = 'وَجِىٓءَ'; not on the first letter of an
              Abu 'Amr word, where it is the start dot of a wasl alef). The
              KFGQPC Qalun 'ئِے' ends in a rasm ya Qalun does not read (33:4
              اللاءِ, 35:43 'ٱلسَّيِّئِے' = 'ٱلسَّيِّئِ'); after a hamza on the
              line the ya is read ('وَرَآءِے').
  usul        rules marked by diacritics or by the hamza's carrier only:
              madd length (U+0653), imala / taqlil dots in the far rewayat (a
              dot written instead of the fatha counts as the fatha), and the
              general hamza rules, each in its own context:
                two hamzas in one word (every rewayah but Shu'bah): the
                  second is softened, changed or (Qalun, Abu 'Amr) preceded
                  by an inserted alef (idkhal, never tinted: 2:6 ءَٰا۬نذَرْتَهُمْ
                  = ءَأَنذَرْتَهُمْ). The second hamza is compared as one unit
                  whatever its form (the tashil dot U+06EC on its seat, a
                  written hamza, a long alef for Warsh's ibdal), so a hamza +
                  long a (Hafs 7:123 ءَامَنتُم, a statement) still differs
                  from two hamzas + long a (ءَاٰ۬مَنتُم, a question).
                two hamzas across words (every rewayah but Shu'bah): the
                  first, at the end of a word, dropped or softened before a
                  word that starts with a hamza, or changed into the long
                  waw / ya before it and merged (Qalun, al-Bazzi 12:53
                  'بِالسُّوِّ إِلَّا'); the second, at the start of
                  a word, softened or changed after a word that ends in a
                  voweled hamza (Context: never across a surah start).
                Warsh: a vowelless hamza becomes the long vowel of the vowel
                  before it (يُومِنُونَ, the ibdal of ٱلذِّيبُ; its waw / ya seat
                  after a wasl alef: 'اُيتُونِي'); a single hamza that the
                  KFGQPC text changes into a waw / ya marks it with the dot
                  (مُوَ۬جَّلًا, لِيَ۬لَّا) and is compared as that hamza; naql:
                  the article's lam takes the vowel of the hamza after it
                  ('اَ۬لَارْضِ'), and across words see below. Any other hamza
                  is compared as written: Nafi' أَرَٰ۬يْتَ (Hafs أَرَءَيْتَ),
                  لِاَهَبَ (19:19, 'liyahaba'), ٱلْأَنۢبِئَآءَ are differences.
                al-Susi: a vowelless hamza becomes the long vowel of the
                  vowel before it.
              Across words, only in context (`Context`):
                Warsh naql: the final consonant gains the vowel of the next
                  word's hamza ('قَدَ اَف۟لَحَ' for 'قَدْ أَفْلَحَ'): this
                  word ends in a consonant (not a madd letter) that is
                  vowelless in Hafs, the next Hafs word starts with a hamza
                  with that vowel, and the next Warsh word lost the hamza.
                  The vowel moved is the one Warsh's next word shows on its
                  bare alef (a start dot = damma: 9:109 'مَنُ ا۟سِّسَ'); the
                  KFGQPC Warsh text also joins surahs this way (93:11). The
                  word that lost its hamza: only after such a word (or after
                  a tanween) in Warsh; a hamza dropped anywhere else is a
                  difference (20:77 'أَنِ اِس۟رِ' for 'أَنْ أَسْرِ').
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
              وَيَرِثْ), a sukun on any other letter (al-Duri 32:7 خَلْقَهُۥ).
              The first letter of a word may lose its hamza only in the two
              contexts above, never gain one (al-Duri 10:81 'ءَآلسِّحْرُ' for
              'ٱلسِّحْرُ' is a difference).
  silah       the 'silah' category instead (a Hafs-only silah, e.g. 25:69
              فِيهِۦ in Warsh, is a whole-word difference: there is no mark
              to colour).

Siblings: two narrators of one reader (Warsh / Qalun, al-Susi / al-Duri)
who read a slot the same way get the same whole-word decision. The builder
gives Warsh and al-Susi the whole-word tint that Qalun / al-Duri get for the
same reading (`SIBLING_BASE`; the same stored words, words that only
differ in encoding under the sibling's own rules, or in al-Susi the same
word whose final vowel his idgham kabir merges: see reads_like_sibling):
their extra usul rules must not hide a farsh difference, e.g. Nafi' يَاجُوجَ
(18:94), مُوصَدَةٌ (90:20, 104:8), Abu 'Amr فَيَغْفِر لِّمَن (2:284, jazm plus
idgham, which reads like al-Susi's idgham kabir), Abu 'Amr's case endings
6:27 نُكَذِّبُ and 16:12 وَٱلنُّجُومَ, which al-Susi merges into the next word.
The validator checks that every pair, al-Bazzi / Qunbul included, agrees on
identical stored words.

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
# The KFGQPC dot in place of a softened or changed hamza (normalize.py writes
# it as DK's tashil dot U+06EC; the wasl alef's start dot at the start of a
# word is read with the alef). On a consonant it marks ishmam / ikhtilas.
TASHIL_DOT = "\u06EC"
TATWEEL = "\u0640"
SHADDA = "\u0651"
MADD = "\u0653"
SILENT = "\u06DF"  # DK rounded zero: a letter never pronounced (Nafi' texts: also the sukun)
UPRIGHT_ZERO = "\u06E0"
DAGGER_ALEF = "\u0670"
RUB_EL_HIZB = "\u06DE"
ALEF, WAW, YEH, LAM, HAMZA, NOON = "\u0627", "\u0648", "\u064A", "\u0644", "\u0621", "\u0646"
TEH, TAH = "\u062A", "\u0637"
# Key-only letter (never in a text): the second of two hamzas in one word, in
# whatever form the text writes it (see reading_key).
SOFT_HAMZA = "\uE000"
ASSIMILATING = frozenset("\u0644\u0631\u0645\u0646\u0648\u064A")  # ل ر م ن و ي
# the letters a nun sakinah or a tanween merges into (idgham, the same six);
# before any other letter it is concealed (ikhfa') or read clearly, not merged
NUN_IDGHAM = ASSIMILATING
HAMZA_SEATS = frozenset("\u064A\u0649\u0648\u0627")  # ي ى و ا
SILAH_CHARS = frozenset("\u06E5\u06E6")
SILAH_CARRIER_VOWELS = frozenset("\u064F\u0650")
PREFIX_LETTERS = frozenset("\u0648\u0641\u0628\u0644\u0643\u0633")  # و ف ب ل ك س

CLOSE = frozenset({"shouba", "bazzi", "qumbul"})
NAFI = frozenset({"warsh", "qaloon"})
ABU_AMR = frozenset({"doori", "soosi"})
FAR = NAFI | ABU_AMR
KUFI = frozenset({"shouba"})  # reads both of two hamzas
HAMZA_SOFTENING = frozenset({"warsh", "soosi"})  # general ibdal of the hamza (see reading_key)
MAGHRIBI_LAM = frozenset({"warsh", "qaloon", "doori", "soosi"})
# The KFGQPC Nafi' texts never write the upright zero (alef dropped in wasl):
# their plain alef is read like Hafs's alef with U+06E0 (أَنَا, لَّٰكِنَّا),
# except in the words of NAFI_WASL_ALEF.
MAGHRIBI_NO_UPRIGHT_ZERO = frozenset({"warsh", "qaloon"})
# Farsh: Nafi' reads the final alef of these al-Ahzab words in wasl too
# (33:10, 33:66, 33:67), Hafs only in waqf (U+06E0): letters of the Hafs word.
NAFI_WASL_ALEF = frozenset({
    "\u0627\u0644\u0638\u0646\u0648\u0646\u0627",  # ٱلظُّنُونَا۠
    "\u0627\u0644\u0631\u0633\u0648\u0644\u0627",  # ٱلرَّسُولَا۠
    "\u0627\u0644\u0633\u0628\u064A\u0644\u0627",  # ٱلسَّبِيلَا۠
})
# Reviewed words whose KFGQPC Nafi' spelling differs from the DK Hafs word
# while the reading is the same: (Hafs slot text, stored text), exact texts,
# so a changed source falls back to the rules and the cases gate reports it.
NAFI_SPELLINGS = frozenset({
    # 14:5 bi-ayyāmi: the rasm's second ya, unpronounced, before (Nafi') or
    # after (Hafs, the dagger alef's seat) the doubled ya
    ("\u0628\u0650\u0627\u0654\u064E\u064A\u0651\u064E\u0649\u0670\u0645\u0650",
     "\u0628\u0650\u0627\u0654\u064E\u064A\u064A\u0651\u064E\u0670\u0645\u0650"),
    # 51:47 bi-aydin: the rasm's second ya, unpronounced (Nafi' writes the
    # fatha on the first ya, the sukun on the second)
    ("\u0628\u0650\u0627\u0654\u064E\u064A\u0652\u064A\u06DF\u062F\u08F2",
     "\u0628\u0650\u0627\u0654\u064E\u064A\u064E\u064A\u06DF\u062F\u08F2"),
    # 55:54 wa-janā: an alef for the alef maqsura, both dropped in wasl
    # before ٱلْجَنَّتَيْنِ
    ("\u0648\u064E\u062C\u064E\u0646\u064E\u0649", "\u0648\u064E\u062C\u064E\u0646\u064E\u0627"),
})
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
    "\u06EA"  # dot below (normalize writes U+065C; U+065C is resolved per letter)
    "\u06E3"  # small low seen: Hafs 52:37 ٱلْمُصَۣيْطِرُونَ is read with sad (seen also allowed)
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
}
_MARK_CANON = {"\u08F0": FATHATAN, "\u08F1": DAMMATAN, "\u08F2": KASRATAN}
_DECOMPOSE = {  # precomposed hamza letters (DK text is already decomposed)
    "\u0623": ALEF + "\u0654",
    "\u0625": ALEF + "\u0655",
    "\u0624": WAW + "\u0654",
    "\u0626": YEH + "\u0654",
}
# Maghribi wasl alef: alef + connecting vowel + start dot (U+06EC above,
# U+065C/U+06EA below), in either order. Never right after a hamza or a
# dagger alef: there the dotted alef is the seat of a softened second hamza
# (ءَا۬نتُمْ, Qalun ءَٰا۬نتُمْ, هَٰا۬نتُمْ). The start dot U+06DF only counts at the
# start of a word of a far rewayah: elsewhere U+06DF marks a silent letter.
_WASL = re.compile(
    "(?<![\u0621\u0654\u0655\u0670][\u064E\u064F\u0650])(?<!\u0670)"
    "\u0627[\u064E\u064F\u0650]?[\u06EC\u065C\u06EA][\u064E\u064F\u0650]?"
)
_WASL_START = re.compile("^(\u06DE?)\u0627[\u064E\u064F\u0650]?\u06DF[\u064E\u064F\u0650]?")
_DOTTED_START = re.compile("^\u06DE?\u0627[\u064E\u064F\u0650]?[\u06EC\u065C\u06EA]")


@dataclass(frozen=True)
class Context:
    """The words read around a slot: the first word of the next non-blank
    content slot in Hafs and in the rewayah (verse markers skipped, verse and
    surah ends crossed; '' after 114:6), and the last word of the previous
    one ('' before 1:1). `basmala_next`: the slot is the last word of a surah
    followed by a basmala (not before at-Tawbah), which is not in the verse
    data. `surah_start`: the slot is the first content slot of its surah (a
    basmala, or a surah end, lies between it and the previous word)."""

    hafs_next: str = ""
    target_next: str = ""
    basmala_next: bool = False
    hafs_prev: str = ""
    target_prev: str = ""
    surah_start: bool = False


class _Unit:
    __slots__ = (
        "letter", "marks", "silah", "shadda", "dagger", "hamza", "dot", "tdot",
        "token_start", "silent", "own_letter", "seat", "dotted_start", "from_soft", "sukun",
    )

    def __init__(self, letter: str, dagger: bool = False) -> None:
        self.letter = letter
        self.marks = ""
        self.silah = False
        self.shadda = False
        self.dagger = dagger
        self.hamza = False  # a hamza (letter, or a hamza mark on its seat)
        self.dot = False  # carried a dot below (imala / taqlil / tashil)
        self.tdot = False  # carried the tashil dot U+06EC
        self.token_start = False  # first letter of its whitespace token
        self.silent = False  # carried U+06DF
        self.own_letter = False  # a sukun / madd / U+06DF before any hamza mark on it
        self.seat = ""  # the letter that carried the hamza before it became HAMZA
        self.dotted_start = False  # a word-initial alef + vowel + dot (wasl alef or Warsh naql)
        self.from_soft = False  # an alef that stands for the second of two hamzas
        self.sukun = False  # carried a sukun (U+0652 / U+06E1; the Nafi' texts use U+06DF: `silent`)


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
        else:
            # ...but an alef never takes a sukun: an alef with U+06DF inside a
            # word is silent in both texts (Hafs 'وَجِا۟يٓءَ' = Nafi' 'وَجِىٓءَ',
            # 'مِا۟ئَةَ' in both)
            u = [x for k, x in enumerate(u) if not (k > 0 and x.letter == ALEF and x.silent and not x.dagger)]
        if u:
            u[0].token_start = True
        units.extend(u)
        hamzas += h
    return units, hamzas


def _token_units(token: str, rid: str) -> tuple[list[_Unit], int]:
    t = token
    for src, dst in _DECOMPOSE.items():
        t = t.replace(src, dst)
    dotted_start = bool(_DOTTED_START.match(t))
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
                    # hamza on a tatweel seat: a hamza of its own (DK writes it
                    # after a ya / waw on the tatweel, KFGQPC Nafi' on the ya
                    # itself, which is split below: 'خَطِيٓـَٔتِى' = 'خَطِيَٓٔتِى')
                    units.append(_Unit(HAMZA))
                    break
                j += 1
            continue
        if c == SHADDA:
            if units:
                units[-1].shadda = True
            continue
        if c in (SILENT, "\u0652", "\u06E1", MADD) and units:
            if not any(m in HAMZA_MARKS for m in units[-1].marks):
                units[-1].own_letter = True  # 'شَي۟ٔ', 'خَطِيَٓٔ' (not 'ؤْ': the hamza's sukun)
        if c in ("\u0652", "\u06E1") and units:
            units[-1].sukun = True
        if c == SILENT:
            if units:
                units[-1].silent = True
            continue
        if c == TASHIL_DOT:
            if units:
                units[-1].tdot = True
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
    split: list[_Unit] = []
    for u in units:
        split.append(u)
        if (
            u.letter in (YEH, WAW)
            and any(c in HAMZA_MARKS for c in u.marks)
            and u.own_letter
        ):
            # a ya / waw that is a letter of its own (sakin or a long vowel)
            # with the hamza written on it: KFGQPC Nafi' 'شَي۟ٔاࣰ' = DK
            # 'شَيْـࣰٔا', 'خَطِيَٓٔتِى' = 'خَطِيٓـَٔتِى'; its vowels are the hamza's
            h = _Unit(HAMZA)
            h.marks = "".join(c for c in u.marks if c not in SILAH_CHARS)
            u.marks = ""
            split.append(h)
    units = split
    for u in units:
        marks = u.marks
        u.hamza = u.letter == HAMZA or any(c in HAMZA_MARKS for c in marks)
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
        u.marks = marks
        if u.hamza and u.letter in HAMZA_SEATS and not u.dagger:
            # the hamza's seat (alef, waw, ya) is spelling: compare a hamza
            # (DK 'ٱلْمُنشَـَٔاتُ' = KFGQPC Nafi' 'مُنشَأَٰتُ'); the word-initial
            # hamza becomes the alef Q again in reading_key
            u.seat, u.letter = u.letter, HAMZA
    if rid in NAFI:
        # Maghribi lam-alif: a hamza written on the alef of the ligature comes
        # before the lam ('اُ۬ءَلٰ۟نَ' = 'ٱلْـَٰٔنَ', Qalun 2:71)
        for k in range(len(units) - 2):
            h, lam, alef = units[k], units[k + 1], units[k + 2]
            if (
                h.letter == HAMZA
                and any(c in SHORT_VOWELS for c in h.marks)
                and lam.letter == LAM
                and not any(c in VOWELS for c in lam.marks)
                and alef.letter == ALEF
                and alef.dagger
            ):
                units[k], units[k + 1] = lam, h
                lam.token_start, h.token_start = h.token_start, False
                if HAMZA_MARK not in h.marks:
                    h.marks = HAMZA_MARK + h.marks
                break
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
        units[-2].seat = YEH
        units.pop()
    if (
        rid in NAFI
        and len(units) >= 2
        and units[-1].letter == YEH
        and not units[-1].marks
        and not units[-1].silah
        and units[-2].letter == HAMZA
        and units[-2].seat == YEH
        and KASRA in units[-2].marks
    ):
        # KFGQPC Qalun 'ئِے': a hamza with kasra on its own tooth and the rasm
        # ya after it, not pronounced (Qalun 33:4 اللاءِ, 35:43 'ٱلسَّيِّئِے' =
        # 'ٱلسَّيِّئِ'); a pronounced ya follows a hamza on the line ('وَرَآءِے')
        units.pop()
    if units and dotted_start:
        units[0].dotted_start = True
    return units, hamzas


def _article_lam(units: list[_Unit]) -> int:
    """Index of the article's lam: after a question hamza, up to two prefix
    letters and the wasl alef (or its changed form 'ءَآلْ'), or a prefix lam
    ('لِلْ', the alef not written); -1 if the word has no article."""
    k = 0
    if units and units[0].letter == ALEF and units[0].hamza:
        k = 1  # question hamza
    p = 0
    while k < len(units) and p < 2 and units[k].letter in PREFIX_LETTERS and units[k].letter != LAM:
        k += 1
        p += 1
    if k + 1 < len(units) and units[k].letter == LAM and units[k + 1].letter == LAM:
        return k + 1  # لِلْ...
    if k + 1 < len(units) and units[k].letter == ALEF and not units[k].hamza and units[k + 1].letter == LAM:
        return k + 1
    return -1


def _voweled_hamza(units: list[_Unit], k: int, rid: str) -> bool:
    """units[k] is a hamza with a short vowel (the first of two hamzas); in
    Warsh also a word-initial bare alef with a vowel (a hamza moved by naql:
    'اَو۟۬نَبِّئُكُم')."""
    u = units[k]
    if not any(c in SHORT_VOWELS for c in u.marks):
        return False
    if u.letter == HAMZA or (u.letter == ALEF and u.hamza):
        return True
    return rid == "warsh" and k == 0 and u.letter == ALEF and not u.dagger


def _waqf_alef_differs(text: str, rid: str) -> bool:
    """`text` writes an alef read in waqf only (U+06E0) that this rewayah
    reads in wasl too, although its text does not mark the difference: the
    Nafi' texts never write U+06E0, so only the NAFI_WASL_ALEF words."""
    if rid not in MAGHRIBI_NO_UPRIGHT_ZERO:
        return True
    if UPRIGHT_ZERO not in text:
        return False
    letters = "".join(_LETTER_CANON.get(c, c) for c in text if c in _LETTER_CANON or unicodedata.category(c) == "Lo")
    return letters in NAFI_WASL_ALEF


def reading_key(text: str, rid: str) -> tuple[list[_Unit], int]:
    units, hamzas = _units(text, rid)
    waqf_alef = _waqf_alef_differs(text, rid)
    # tanween written after a final alef / ya -> on the letter before it
    # (before the hamza rules: 'شَي۟ٔاࣰ' = 'شَيْـࣰٔا', the hamza is voweled)
    if len(units) >= 2 and units[-1].letter in (ALEF, YEH) and any(x in TANWEEN for x in units[-1].marks):
        if not any(x in VOWELS for x in units[-2].marks):
            units[-2].marks += "".join(x for x in units[-1].marks if x in TANWEEN)
            units[-1].marks = "".join(x for x in units[-1].marks if x not in TANWEEN)
    # Q: the word-initial hamza (after up to two prefix letters) is an alef:
    # a voweled hamza on an alef or on the line, as a word starts (not
    # وَبِئْسَ, فَأْتُوا۟)
    for i, u in enumerate(units):
        if (
            u.letter == HAMZA
            and u.seat in ("", ALEF)
            and any(c in SHORT_VOWELS for c in u.marks)
            and i <= 2
            and all(x.letter in PREFIX_LETTERS for x in units[:i])
        ):
            u.letter = ALEF
    if rid in MAGHRIBI_LAM:
        # ٱلَّٰتِي: the Maghribi texts write the long a after the doubled lam of
        # the article unmarked; only a plain dagger alef after a wasl alef + a
        # doubled lam (not أَ۬لَٰهٌ, ٱلْـَٰٔنَ, nor the hamza's seat in ٱلَّٰٓـِٔي)
        k = _article_lam(units)
        if (
            k >= 1
            and units[k - 1].letter == ALEF
            and not units[k - 1].hamza
            and units[k].shadda
            and len(units) > k + 2
            and units[k + 1].dagger
            and not units[k + 1].hamza
            and not units[k + 1].tdot
        ):
            del units[k + 1]
    if rid not in KUFI:
        _two_hamza_forms(units, rid)
    softening = rid in HAMZA_SOFTENING
    prev_vowels = ""
    for u in units:
        vowels = "".join(sorted(x for x in u.marks if x in VOWELS))
        if DOT_BELOW in u.marks:  # close rewayat: the imala dot is kept as a mark
            vowels += DOT_BELOW
        if UPRIGHT_ZERO in u.marks and waqf_alef:
            vowels += UPRIGHT_ZERO  # alef read in waqf only (ٱلظُّنُونَا۠ vs Shu'bah, Nafi' ٱلظُّنُونَا)
        if softening and u.letter == HAMZA:
            if not any(x in VOWELS for x in vowels):
                # ibdal of a vowelless hamza: the long vowel of the vowel before
                # it (رُءْيَا -> رُويَا, يُؤْمِنُونَ -> يُومِنُونَ)
                # (its waw / ya seat after a wasl alef: 'ٱئْتُونِي' -> 'اُيتُونِي')
                if DAMMA in prev_vowels or KASRA in prev_vowels or u.seat not in (WAW, YEH):
                    u.letter = WAW if DAMMA in prev_vowels else YEH if KASRA in prev_vowels else ALEF
                else:
                    u.letter = u.seat
                u.hamza = False
                vowels = ""
        if u.letter == SOFT_HAMZA:
            vowels = ""  # compared as one unit, whatever vowel the text shows
        if u.letter == HAMZA or (u.letter == ALEF and u.hamza):
            u.marks = HAMZA_MARK + vowels
        else:
            u.marks = vowels
        prev_vowels = vowels
    if rid == "warsh":
        # naql inside the word: the article's lam takes the vowel of the hamza
        # after it, which Warsh drops ('اُ۬لَار۟ضِ' for 'ٱلْأَرْضِ'; its alef seat
        # stays in the rasm, a hamza on a tatweel goes: 'اُ۬لَٰنَ' for 'ٱلْـَٰٔنَ')
        k = _article_lam(units)
        if 0 < k < len(units) - 1:
            lam, h = units[k], units[k + 1]
            v = [c for c in h.marks if c in SHORT_VOWELS]
            if (h.letter == HAMZA or (h.letter == ALEF and h.hamza)) and len(v) == 1 and not lam.marks and not lam.shadda:
                lam.marks = v[0]
                if h.seat == ALEF:
                    h.letter, h.marks, h.hamza = ALEF, "", False
                else:
                    del units[k + 1]
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
            cur = units[i]
            if cur.letter == SOFT_HAMZA or not _voweled_hamza(units, i - 1, rid):
                continue  # not after a voweled hamza (a sakin one: al-Duri ٱلْمَأْوٜىٰ keeps its waw's vowel)
            last = i == len(units) - 1
            if cur.letter == HAMZA or (cur.letter == ALEF and (cur.dot or any(x in SHORT_VOWELS for x in cur.marks))):
                pass  # a written second hamza, or its dotted / voweled alef seat
            elif cur.letter in (WAW, YEH) and (cur.dot or cur.tdot) and not last:
                pass  # أَيٜمَّةَ, أَو۬نَبِّئُكُم: the second hamza on a dotted waw / ya seat
            else:
                continue  # a long alef, the seat of a tanween ('خَطَـٔاࣰ'), a final imala ya
            cur.letter, cur.marks = SOFT_HAMZA, ""
    # silent alef after a final waw (also the waw seat of a hamza: جَزَٰٓؤُا۟)
    if (
        len(units) >= 2
        and units[-1].letter == ALEF
        and (units[-2].letter == WAW or units[-2].seat == WAW)
        and not units[-1].marks
    ):
        units.pop()
    # the second hamza followed by a long a stays a unit of its own (7:123
    # ءَاٰ۬مَنتُم 'a-'amantum, a question, vs Hafs ءَامَنتُم 'amantum); without
    # a long a after it, it is the long a of an ibdal (Warsh 2:6 ءَآنذَرْتَهُمْ =
    # ءَأَنذَرْتَهُمْ) and compares as that alef
    merged: list[_Unit] = []
    long_after: set[int] = set()  # ids of SOFT_HAMZA units followed by a long a
    for u in units:
        if merged and merged[-1].letter == SOFT_HAMZA and u.letter == ALEF and not u.marks and not u.hamza:
            merged[-1].silah |= u.silah
            long_after.add(id(merged[-1]))
            continue
        merged.append(u)
    for u in merged:
        if u.letter == SOFT_HAMZA and id(u) not in long_after:
            u.letter, u.from_soft = ALEF, True
    return merged, hamzas


def _two_hamza_forms(units: list[_Unit], rid: str) -> None:
    """The second of two hamzas in one word as one SOFT_HAMZA unit, whatever
    the text writes (in place): the tashil dot on the first hamza itself
    (Warsh 'أَ۬نَّكَ'), on a dagger alef (Qalun 'أَٰ۬نَّكَ', also the seat of
    Nafi' أَرَٰ۬يْتَ), on an alef (ءَا۬نتُمْ, ءَاٰ۬مَنتُم: the dagger after it is
    the long a), on a waw / ya seat right after the first hamza; and the
    inserted alef of idkhal (a dagger alef between the two hamzas) dropped.
    A dotted alef at the end of a word is the softened FIRST hamza of two
    across words (Qalun 'هَٰؤُلَآ۬'), compared like the dropped one."""
    i = 0
    while i < len(units):
        u = units[i]
        if u.tdot:
            last = i == len(units) - 1
            if u.letter == ALEF and u.hamza:
                units.insert(i + 1, _Unit(SOFT_HAMZA))  # the dot on the first hamza
                i += 1
            elif u.letter == ALEF and u.dagger:
                u.letter = SOFT_HAMZA
            elif u.letter == ALEF and not last:
                u.letter = SOFT_HAMZA
            elif u.letter in (WAW, YEH) and i >= 1 and (
                _voweled_hamza(units, i - 1, rid)
                or (units[i - 1].dagger and i >= 2 and _voweled_hamza(units, i - 2, rid))
            ):
                u.letter = SOFT_HAMZA
            elif u.letter in (WAW, YEH) and not last:
                # a single hamza changed into its waw / ya, which the KFGQPC
                # text marks with the dot (Warsh 'يُوَ۬اخِذُكُمُ', 'مُّوَ۬جَّلاࣰ',
                # 'لِيَ۬لَّا'): compared as the hamza it stands for
                u.seat, u.letter, u.hamza = u.letter, HAMZA, True
        i += 1
    # idkhal: a plain dagger alef between the first hamza and the second
    i = 1
    while i < len(units) - 1:
        u, nxt = units[i], units[i + 1]
        if (
            u.letter == ALEF
            and u.dagger
            and not u.marks
            and not u.hamza
            and _voweled_hamza(units, i - 1, rid)
            and (nxt.letter in (HAMZA, SOFT_HAMZA) or (nxt.letter in (WAW, YEH) and (nxt.dot or nxt.tdot)))
        ):
            del units[i]
            continue
        i += 1


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


def _final_unit(word: str, rid: str) -> tuple[list[_Unit], int] | None:
    """(units, index of the last pronounced letter) of a word: a final alef
    that only carries a tanween's seat is skipped, its tanween moved to the
    letter ('حَاجِزًا', KFGQPC 'حَاجِزاً')."""
    if not word:
        return None
    units, _ = _units(word, rid)
    k = len(units) - 1
    if k >= 1 and units[k].letter == ALEF and units[k].silent and units[k - 1].letter == WAW:
        k -= 1  # the silent alef after a final waw (Nafi' texts keep the unit)
    elif k >= 1 and units[k].letter in (ALEF, YEH) and not units[k].hamza and any(
        c in TANWEEN for c in units[k - 1].marks + units[k].marks
    ):
        if any(c in TANWEEN for c in units[k].marks) and units[k].letter == YEH:
            return units, k  # 'سُدٜيً': the tanween on the alef maqsura itself
        units[k - 1].marks += "".join(c for c in units[k].marks if c in TANWEEN)
        k -= 1
    return (units, k) if k >= 0 else None


def _ends_with_voweled_hamza(word: str, rid: str) -> bool:
    """The word ends in a hamza with a short vowel: the first of two hamzas
    across words ('هَٰٓؤُلَآءِ', 'نَشَٰٓؤُا۟', 'جَآءَ', Nafi' 'النَّبِيٓءُ')."""
    f = _final_unit(word, rid)
    if f is None:
        return False
    units, k = f
    u = units[k]
    if u.letter == ALEF and not u.hamza and not u.marks and k >= 1:
        u = units[k - 1]  # the silent alef after a final hamza on a waw seat
    return (u.letter == HAMZA or u.hamza) and any(c in SHORT_VOWELS for c in u.marks) and not any(
        c in TANWEEN for c in u.marks
    )


def _two_hamzas_across(ctx: Context, rid: str) -> bool:
    """This word starts right after a word that ends in a voweled hamza in the
    rewayah (Nafi' 33:50 'لِلنَّبِيٓءِ اِن') or in Hafs, with no basmala in
    between: the second of two hamzas across words."""
    if ctx.surah_start:
        return False
    return _ends_with_voweled_hamza(ctx.target_prev, rid) or _ends_with_voweled_hamza(ctx.hafs_prev, "hafs")


def _warsh_moved_vowel(ctx: Context, vowel: str, hafs_sakin: bool) -> bool:
    """Warsh's previous word ends in a tanween, or in a consonant (not a madd
    letter, no silah) carrying `vowel`, the vowel naql moved onto it; with
    `hafs_sakin` that consonant must also be vowelless in Hafs."""
    t = _final_unit(ctx.target_prev, "warsh")
    if t is None:
        return False
    tu, tk = t
    y = tu[tk]
    if any(c in TANWEEN for c in y.marks):
        return True
    if ctx.hafs_prev and not any(c in VOWELS for c in ctx.hafs_prev):
        return True  # into a muqatta'at, written with its letter names (29:1 'أَلَٓمِّٓ اَحَسِبَ')
    moved = [c for c in y.marks if c in SHORT_VOWELS]
    if y.silah or len(moved) != 1 or moved[0] != vowel or (tk and _is_madd_letter(tu, tk)):
        return False
    if not hafs_sakin:
        return True
    h = _final_unit(ctx.hafs_prev, "hafs")
    if h is None:
        return False
    hu, hk = h
    return hu[hk].letter == y.letter and not any(c in VOWELS for c in hu[hk].marks) and not _is_madd_letter(hu, hk)


def _warsh_naql_into_prev(ctx: Context, hafs_vowel: str, target_word: str) -> bool:
    """Warsh: this word starts with the bare alef of a hamza whose vowel naql
    moved onto the previous word (written on the alef, or the Hafs hamza's:
    'قُلَ اَوَلَو۟', 'كُفُؤاً اَحَدࣱ'); a wasl alef ('أَنِ اِس۟رِ') is no naql."""
    shown = _naql_vowel(target_word)
    if shown is None:
        return False
    return _warsh_moved_vowel(ctx, shown or hafs_vowel, hafs_sakin=False)


def _initial_hamza_excused(x: _Unit, y: _Unit, rid: str, ctx: Context, target: str) -> bool:
    """The word-initial hamza of Hafs is not pronounced as a hamza in the
    rewayah only in its context: the second of two hamzas across words
    (softened / changed, every rewayah but Shu'bah) or Warsh's naql."""
    if rid in KUFI or not (x.letter == ALEF and x.hamza) or y.hamza or y.letter != ALEF:
        return False
    hv, yv = _hamza_vowel(x), [c for c in y.marks if c in SHORT_VOWELS]
    if yv and yv != [hv]:
        return False  # a vowel of its own (Nafi' 43:5 'اِن' for 'أَن')
    if _two_hamzas_across(ctx, rid):
        return True
    return rid == "warsh" and _warsh_naql_into_prev(ctx, hv, target.split(" ")[0])


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


def _article_doubled_lam(units: list[_Unit], i: int) -> bool:
    """units[i] is the doubled lam of the article (ٱلَّذِينَ, لِلَّهِ), which the
    Maghribi texts write unmarked ('اَ۬لذِينَ', 'لِلهِ')."""
    return units[i].letter == LAM and units[i].shadda and _article_lam(units) == i


def _warsh_naql_two_hamzas(a: list[_Unit], b: list[_Unit], ctx: Context, target: str) -> tuple[list[_Unit], bool]:
    """Warsh: naql of the first of two hamzas onto the previous word and tashil
    of the second, written as one dotted alef carrying the first hamza's vowel
    ('حَاجِزًا اَ۬لَٰهٌ' for 'حَاجِزًا أَءِلَٰهٌ', 27:61): that alef stands for
    both of Hafs's hamzas. -> (Hafs key without its second hamza, applied)."""
    if (
        len(a) == len(b) + 1
        and len(b) >= 1
        and a[0].letter == ALEF
        and a[0].hamza
        and a[1].letter == ALEF
        and a[1].from_soft
        and b[0].letter == ALEF
        and b[0].dotted_start
        and not b[0].hamza
        and _connecting_vowel(target.split(" ")[0]) == _hamza_vowel(a[0])
        and _warsh_moved_vowel(ctx, _hamza_vowel(a[0]), hafs_sakin=True)
    ):
        return a[:1] + a[2:], True
    return a, False


def _dotted_second_hamza(a: list[_Unit], b: list[_Unit], rid: str, ctx: Context) -> list[_Unit]:
    """The second of two hamzas across words + the long a after it, written
    as one dotted alef ('جَآءَ ا۬لَ لُوطٍ' for 'جَآءَ ءَالَ', 'هَٰٓؤُلَآءِ اَ۬لِهَةً'):
    that alef stands for Hafs's hamza and long a."""
    if (
        rid not in KUFI
        and len(a) == len(b) + 1
        and len(b) >= 1
        and a[0].letter == ALEF
        and a[0].hamza
        and a[1].letter == ALEF
        and not a[1].marks
        and not a[1].from_soft
        and b[0].letter == ALEF
        and b[0].dotted_start
        and not b[0].hamza
        and _two_hamzas_across(ctx, rid)
    ):
        return a[:1] + a[2:]
    return a


def _first_hamza_merged(a: list[_Unit], b: list[_Unit]) -> bool:
    """The first of two hamzas across words, after a long waw / ya, changed
    into that letter and merged into it (ibdal and idgham): the rewayah's
    last letter is that waw / ya doubled with the hamza's vowel (Qalun,
    al-Bazzi 12:53 'بِالسُّوِّ إِلَّا' for 'بِٱلسُّوٓءِ إِلَّا'). `a` still ends in
    Hafs's hamza; `b` is one unit shorter."""
    if len(a) < 2 or len(b) != len(a) - 1:
        return False
    h, x, y = a[-1], a[-2], b[-1]
    vowel = _hamza_vowel(h)
    return (
        bool(vowel)
        and x.letter in (WAW, YEH)
        and y.letter == x.letter
        and not x.shadda
        and not x.marks
        and y.shadda
        and y.marks == vowel
    )


def _long_a_before_wasl(hafs: str, target: str, ctx: Context) -> str:
    """Hafs's final alef maqsura with its dagger alef (a long a), where the
    rewayah writes the alef maqsura without it before a word that starts
    with a wasl alef: no reading pronounces that long a before the sakin (DK
    Hafs writes 'مُوسَى ٱلْكِتَٰبَ' inside a surah; the KFGQPC Warsh text joins
    20:135 to 21:1, 'اِٜه۟تَدَى اِق۟تَرَبَ'). -> the Hafs text without that
    dagger alef."""
    if (
        hafs.endswith("\u0649" + DAGGER_ALEF)
        and target.endswith("\u0649")
        and ctx.hafs_next.lstrip(RUB_EL_HIZB).startswith("\u0671")
    ):
        return hafs[:-1]
    return hafs


def _word_differs(hafs: str, target: str, rid: str, ctx: Context = Context()) -> bool:
    if rid in NAFI and (hafs, target) in NAFI_SPELLINGS:
        return False
    hafs = _long_a_before_wasl(hafs, target, ctx)
    a, ha = reading_key(hafs, rid)
    b, hb = reading_key(target, rid)
    naql_two = False
    if rid == "warsh":
        a, naql_two = _warsh_naql_two_hamzas(a, b, ctx, target)
    a = _dotted_second_hamza(a, b, rid, ctx)
    la = [u.letter for u in a]
    lb = [u.letter for u in b]
    first_hamza_merged = False
    if la != lb:
        # the first of two hamzas across words dropped (isqat) or softened
        # (Qalun 'هَٰؤُلَآ۬ إِن'), non-Kufi
        if (
            rid not in KUFI
            and la[-1:] == [HAMZA]
            and la[:-1] == lb
            and _hamza_vowel(_lead_unit(ctx.hafs_next, rid))
        ):
            first_hamza_merged = _first_hamza_merged(a, b)
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
        if i == n - 1 and first_hamza_merged:
            continue  # the dropped first hamza changed into this waw / ya and merged into it
        if x.shadda != y.shadda and not _shadda_excused(i, a, b, rid, ctx, target):
            return True  # عَقَدتُّمُ / عَقَّدتُّمُ, تَذَّكَّرُونَ, نَزَّلَ, idgham ٱتَّخَذتُّمُ, al-Bazzi وَلَآ تَّيَمَّمُوا۟
        if x.marks == y.marks:
            continue
        one_sided = not x.marks or not y.marks
        if one_sided and (x.silah or y.silah):
            continue  # vowel carried by a silah (meem al-jam', ha' al-kinaya)
        if i == n - 1 and one_sided and _final_vowel_excused(a, b, rid, ctx):
            continue  # Warsh naql / al-Susi idgham kabir into the next word
        if i == 0 and (naql_two or _initial_hamza_excused(x, y, rid, ctx, target)):
            continue  # naql (Warsh) / the second of two hamzas across words
        if (
            rid == "soosi"
            and not y.marks
            and i + 1 < n
            and b[i + 1].shadda
            and not a[i + 1].shadda
        ):
            continue  # idgham kabir inside the word (خَلَقكُّمْ)
        if rid in MAGHRIBI_LAM and _article_doubled_lam(a, i) and x.marks in ("", FATHA) and y.marks in ("", FATHA):
            continue  # unmarked doubled lam of the article (الذين, لله)
        return True
    return False


def _word_before(i: int, b: list[_Unit], target: str, ctx: Context) -> str:
    """The rewayah word read right before the token that b[i] starts: the
    previous slot's last word, or the previous token of this slot."""
    t = sum(1 for u in b[:i] if u.token_start)  # tokens before it (b[0] starts the first)
    toks = target.split(" ")
    if t == 0:
        return ctx.target_prev
    return toks[t - 1] if t - 1 < len(toks) else ""


def _merges_into(prev_word: str, lead: _Unit, rid: str) -> bool:
    """The last letter of `prev_word`, the rewayah word read before, merges
    into `lead`, the doubled first letter of the next word (an idgham across
    words): a tanween or a nun without vowel before ي ر م ل و ن ('مَن يَّقُولُ');
    a waw / ya without vowel into the same letter (al-Susi 'هُو وَّالَّذِينَ');
    any other consonant the rewayah writes without vowel or sukun, its way of
    writing an assimilated letter ('قَد جَّآءَكُم', 'إِذ تَّبَرَّأَ', 'قُل رَّبِّي',
    al-Susi 'ٱلرَّحِيم مَّلِكِ'); in al-Susi also a consonant whose vowel the
    idgham kabir drops although the text keeps it (36:27 'غَفَرَ لِّي'). Never
    after an alef, a hamza, a silah, a sukun (the letter is read clearly), a
    nun or tanween before another letter (concealed, not merged) or a vowel
    elsewhere: there the doubling is the word's own reading (al-Bazzi's
    tashdid of the ta': 'وَلَآ تَّيَمَّمُوا۟', 'هَلْ تَّرَبَّصُونَ', 'إِذْ
    تَّلَقَّوْنَهُۥ', 'فَإِن تَّوَلَّوْا۟', 'نَارࣰا تَّلَظَّىٰ', 'تَكَادُ تَّمَيَّزُ')."""
    f = _final_unit(prev_word, rid)
    if f is None:
        return False
    units, k = f
    u = units[k]
    vowel = any(c in VOWELS for c in u.marks)
    if any(c in TANWEEN for c in u.marks) or (u.letter == NOON and not vowel and not u.silah):
        # the Nafi' texts keep the nun's sukun in an idgham with ghunna ('مَن۟ يَّقُولُ')
        return lead.letter in NUN_IDGHAM
    if u.silah or u.sukun or (u.silent and rid in NAFI) or u.letter in (ALEF, HAMZA) or u.hamza:
        return False
    if u.letter in (WAW, YEH) and lead.letter != u.letter:
        return False
    return not vowel or rid == "soosi"


def _shadda_excused(i: int, a: list[_Unit], b: list[_Unit], rid: str, ctx: Context, target: str) -> bool:
    x, y = a[i], b[i]
    if y.token_start and y.shadda and not x.shadda:
        # a doubled first letter Hafs does not have: excused only as an idgham
        # with the word read before it, which carries any difference itself
        return _merges_into(_word_before(i, b, target, ctx), y, rid)
    if x.token_start or y.token_start:
        return True  # a doubled first letter in Hafs only: its idgham, read clearly in the rewayah (usul)
    if rid in MAGHRIBI_LAM and _article_doubled_lam(a, i) and x.marks in ("", FATHA) and y.marks in ("", FATHA):
        return True  # unmarked doubled lam of the article (الذين, لله)
    if rid == "soosi" and i >= 1 and not b[i - 1].marks and a[i - 1].marks and y.shadda:
        return True  # idgham kabir inside the word (خَلَقكُّمْ)
    if x.letter == TEH and i >= 1 and a[i - 1].letter == TAH:
        return True  # idgham naqis of ta' in ta: DK بَسَطتَ, KFGQPC Nafi' بَسَط۟تَّ
    return False


def same_reading(text1: str, text2: str, rid: str) -> bool:
    """Two stored texts of one rewayah that differ only in encoding (the same
    reading key: letters, vowels, doubling, silah), e.g. Nafi' 'مُّوصَدَةُۢ'
    and 'مُّوصَدَةࣱ'. No across-word rule applies."""
    a, _ = reading_key(text1, rid)
    b, _ = reading_key(text2, rid)
    return len(a) == len(b) and all(
        (x.letter, x.marks, x.shadda, x.silah) == (y.letter, y.marks, y.shadda, y.silah) for x, y in zip(a, b)
    )


def reads_like_sibling(sib_text: str, text: str, rid: str, ctx: Context = Context()) -> bool:
    """`text`, stored by `rid` (Warsh or al-Susi), reads like `sib_text`, stored
    by its sibling SIBLING_BASE[rid] in the same slot: the same words or the
    same reading under the sibling's rules (same_reading), or in al-Susi the
    same word whose final vowel his idgham kabir merges into the next word
    (`ctx` is al-Susi's): 6:27 'نُكَذِّب بِّـَٔايَٰتِ', 16:12 'وَاَلنُّجُوم مُّسَخَّرَٰتࣲ'
    read al-Duri's 'نُكَذِّبُ', 'وَاَلنُّجُومَ' (Abu 'Amr's case endings)."""
    base = SIBLING_BASE[rid]
    if sib_text == text or same_reading(sib_text, text, base):
        return True
    if rid != "soosi":
        return False
    a, _ = reading_key(sib_text, base)
    b, _ = reading_key(text, base)
    if len(a) != len(b) or not a:
        return False
    if any((x.letter, x.marks, x.shadda, x.silah) != (y.letter, y.marks, y.shadda, y.silah) for x, y in zip(a[:-1], b[:-1])):
        return False
    x, y = a[-1], b[-1]
    return (
        (x.letter, x.shadda, x.silah) == (y.letter, y.shadda, y.silah)
        and len(x.marks) == 1
        and x.marks in SHORT_VOWELS
        and not y.marks
        and _susi_merge(b, ctx)
    )


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
