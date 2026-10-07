"""
KFGQPC v2.x riwayah text -> Bayaan DigitalKhatt (DK) word tokens.

This module is the single definition of "the normalized official source"
used by the builder (build_sibling_rewayah.py) and by the validator
(validate_rewayah_db.py). It has three layers:

1. Source parsing (`load_source`, `parse_verse`)
   The official KFGQPC v2.x JSON files are a list of verse records
   (`sura_no`/`sora`, `aya_no`, `aya_text`). In v2.x the verse number is
   written at the end of `aya_text` as ONE code point U+FC00 + n - 1 (the
   KFGQPC fonts draw it as an ornamented number); a few records still use
   Arabic-Indic digits (Shu'bah 2:286). It is normally preceded by NBSP and
   in one record (Warsh 16:123) glued to the last word. The number is checked
   against `aya_no` and removed from the content.

2. Tokenization (`parse_verse`)
   - NBSP is a space; RLM (U+200F, 14 Warsh/Qalun records, always at a word
     end) is dropped; leading/double spaces collapse.
   - A standalone rub' el-hizb sign U+06DE is attached, without a space, to
     the following word (DK Hafs convention '۞وَإِذَا').
   - A token without any letter (e.g. a lone waqf sign, KFGQPC 2021 Doori
     4:44) is glued, without a space, to the previous word (policy A1).

3. KFGQPC -> DK conversion (`dk_token`)
   a. CONVENTION_MAP: encoding conventions that differ between KFGQPC and
      DK for the same sign (sukun shapes, open tanween, precomposed hamza,
      'أٓ'). Derived from the Hafs round trip: applied to the official
      KFGQPC Hafs v2.0 text (with the sajdah and dot-below rules) it
      reproduces the DK Hafs DB in 77,385 of 77,429 words; the 25 verses
      with DK-only encodings are listed in validate.py.
   b. RENDER_POLICY: the per-rewayah table of marks the DK font cannot draw
      or draws with a different meaning, with the decision taken for each
      (see the table below and docs/features/rewayat.md). Letters are never
      changed except by an explicitly listed rule (LETTER_MAPPINGS).

Run `python3 normalize.py --policy` to print the render-policy table.
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

# ---------------------------------------------------------------------------
# Rewayah ids (file ids of the bundled assets)
# ---------------------------------------------------------------------------

REWAYAT = ("warsh", "qaloon", "bazzi", "qumbul", "doori", "soosi", "shouba")
CLOSE = frozenset({"shouba", "bazzi", "qumbul"})  # Kufi/Makki, KFGQPC Hafs-style encoding
NAFI = frozenset({"warsh", "qaloon"})  # Maghribi encoding (sukun U+0652, no U+0671, ے, Habti ص)
ABU_AMR = frozenset({"doori", "soosi"})  # Maghribi wasl dots, Hafs-style sukun and waqf signs
FAR = NAFI | ABU_AMR

# ---------------------------------------------------------------------------
# Code points
# ---------------------------------------------------------------------------

RUB_EL_HIZB = "\u06DE"
SAJDAH = "\u06E9"
END_OF_AYAH = "\u06DD"
WAQF_SIGNS = frozenset("\u06D6\u06D7\u06D8\u06D9\u06DA\u06DB\u06DC")
ARABIC_INDIC_DIGITS = "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669"
KFGQPC_AYAH_NUMBER_BASE = 0xFC00  # v2.x: verse n is the single code point U+FC00 + n - 1
MAX_AYAH = 286
NBSP = "\u00A0"
RLM = "\u200F"

FATHA, DAMMA, KASRA = "\u064E", "\u064F", "\u0650"
SMALL_HIGH_MEEM = "\u06E2"
SMALL_LOW_MEEM = "\u06ED"
DOT_BELOW = "\u065C"
EMPTY_CENTRE_LOW_STOP = "\u06EA"

MARKER_RE = re.compile(r"^\u06DD([\u0660-\u0669]+)$")


class SourceError(Exception):
    """The source file violates an assumption the pipeline relies on."""


def arabic_number(n: int) -> str:
    return "".join(ARABIC_INDIC_DIGITS[int(d)] for d in str(n))


def marker(n: int) -> str:
    """Verse-end marker token as stored in the DK words DB ('۝' + digits)."""
    return END_OF_AYAH + arabic_number(n)


def marker_number(tok: str) -> int | None:
    m = MARKER_RE.match(tok)
    if not m:
        return None
    return int("".join(str(ARABIC_INDIC_DIGITS.index(c)) for c in m.group(1)))


def is_marker(tok: str) -> bool:
    return MARKER_RE.match(tok) is not None


def is_letter(ch: str) -> bool:
    """Arabic letters incl. small waw/yeh (Lm), excluding tatweel."""
    return ch != "\u0640" and unicodedata.category(ch) in ("Lo", "Lm")


# ---------------------------------------------------------------------------
# 1. Source parsing
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Verse:
    surah: int
    ayah: int
    tokens: tuple[str, ...]  # raw KFGQPC content tokens (۞ attached, waqf glued)


def _ayah_number_of(tok: str) -> int | None:
    if len(tok) == 1 and KFGQPC_AYAH_NUMBER_BASE <= ord(tok) < KFGQPC_AYAH_NUMBER_BASE + MAX_AYAH:
        return ord(tok) - KFGQPC_AYAH_NUMBER_BASE + 1
    if tok and all(c in ARABIC_INDIC_DIGITS for c in tok):
        return int("".join(str(ARABIC_INDIC_DIGITS.index(c)) for c in tok))
    return None


def _is_number_char(ch: str) -> bool:
    return ch in ARABIC_INDIC_DIGITS or 0xFC00 <= ord(ch) <= 0xFDFF


def parse_verse(text: str, surah: int, ayah: int) -> tuple[str, ...]:
    """aya_text -> raw content tokens. Raises SourceError on any anomaly."""
    where = f"{surah}:{ayah}"
    t = text.replace(RLM, "").replace(NBSP, " ").strip()
    if not t:
        raise SourceError(f"{where}: empty aya_text")
    # The verse number: last whitespace token, or a v2.x number glued to the
    # last word (Warsh 16:123 'لِلْمُشْرِكِينَۖﱺ').
    last = t[-1]
    if 0xFC00 <= ord(last) <= 0xFDFF and len(t) > 1 and not t[-2].isspace():
        t = t[:-1] + " " + last
    toks = t.split()
    number = _ayah_number_of(toks[-1])
    if number is None:
        raise SourceError(f"{where}: aya_text does not end with a verse number: {toks[-1]!r}")
    if number != ayah:
        raise SourceError(f"{where}: trailing verse number {number} != aya_no {ayah}")
    content: list[str] = []
    pending_rub = False
    for tok in toks[:-1]:
        if any(_is_number_char(c) for c in tok):
            raise SourceError(f"{where}: number-like character inside the verse: {tok!r}")
        if tok == RUB_EL_HIZB:
            if pending_rub:
                raise SourceError(f"{where}: two consecutive standalone rub' el-hizb signs")
            pending_rub = True
            continue
        if RUB_EL_HIZB in tok[1:]:
            raise SourceError(f"{where}: rub' el-hizb sign inside a word: {tok!r}")
        if not any(is_letter(c) for c in tok):
            # A1: a letterless token (waqf / sajdah sign) belongs to the previous word.
            if not content or pending_rub:
                raise SourceError(f"{where}: letterless token with no word to attach to: {tok!r}")
            content[-1] += tok
            continue
        if pending_rub:
            tok = RUB_EL_HIZB + tok
            pending_rub = False
        content.append(tok)
    if pending_rub:
        raise SourceError(f"{where}: dangling rub' el-hizb sign at the end of the verse")
    if not content:
        raise SourceError(f"{where}: verse has no words")
    return tuple(content)


ERRATA_FILE = Path(__file__).resolve().parent / "sources" / "errata.json"


def load_errata(rid: str, path: Path = ERRATA_FILE) -> list[dict]:
    """Corrections for rewayah `rid`, each backed by an official KFGQPC artifact."""
    if not path.exists():
        return []
    doc = json.loads(path.read_text(encoding="utf-8"))
    return [e for e in doc.get("errata", []) if e["rewayah"] == rid]


def load_source(path: Path, rid: str | None = None) -> list[Verse]:
    """Load and structurally validate an official KFGQPC v2.x JSON file.

    With `rid`, the sources/errata.json corrections for that rewayah are
    applied to aya_text first (each must match exactly once)."""
    errata = {e["verse"]: e for e in load_errata(rid)} if rid else {}
    applied: set[str] = set()
    raw = Path(path).read_bytes()
    try:
        rows = json.loads(raw.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        raise SourceError(f"{path}: not UTF-8 JSON: {e}") from e
    if not isinstance(rows, list) or not rows:
        raise SourceError(f"{path}: expected a non-empty JSON list of verse records")
    verses: list[Verse] = []
    seen: set[tuple[int, int]] = set()
    for row in rows:
        surah = row.get("sura_no", row.get("sora"))
        ayah = row.get("aya_no")
        text = row.get("aya_text")
        if not isinstance(surah, int) or not isinstance(ayah, int) or not isinstance(text, str):
            raise SourceError(f"{path}: malformed record {str(row)[:120]}")
        if (surah, ayah) in seen:
            raise SourceError(f"{path}: duplicate verse {surah}:{ayah}")
        seen.add((surah, ayah))
        fix = errata.get(f"{surah}:{ayah}")
        if fix is not None:
            if text.count(fix["find"]) != 1:
                raise SourceError(f"{path}: erratum for {surah}:{ayah} does not match exactly once")
            text = text.replace(fix["find"], fix["replace"])
            applied.add(f"{surah}:{ayah}")
        verses.append(Verse(surah, ayah, parse_verse(text, surah, ayah)))
    if set(errata) - applied:
        raise SourceError(f"{path}: errata for verses not in the source: {sorted(set(errata) - applied)}")
    verses.sort(key=lambda v: (v.surah, v.ayah))
    counts: dict[int, int] = {}
    for v in verses:
        counts[v.surah] = counts.get(v.surah, 0) + 1
        if v.ayah != counts[v.surah]:
            raise SourceError(f"{path}: surah {v.surah} verses are not numbered 1..N (got {v.ayah})")
    if sorted(counts) != list(range(1, 115)):
        raise SourceError(f"{path}: expected surahs 1..114, got {len(counts)}")
    return verses


def verse_counts(verses: list[Verse]) -> dict[int, int]:
    out: dict[int, int] = {}
    for v in verses:
        out[v.surah] = max(out.get(v.surah, 0), v.ayah)
    return out


# ---------------------------------------------------------------------------
# 3a. KFGQPC -> DK encoding conventions (all rewayat)
# ---------------------------------------------------------------------------

# Applied atomically (str.translate) so U+06E1 -> U+0652 and U+0652 -> U+06DF
# do not chain.
CONVENTION_MAP = {
    "\u06E1": "\u0652",  # KFGQPC sukun (dotless head of khah) -> DK sukun
    "\u0652": "\u06DF",  # KFGQPC rounded zero -> DK rounded zero (see RENDER_POLICY for Nafi')
    "\u0657": "\u08F0",  # KFGQPC open fathatan (inverted damma) -> DK open fathatan
    "\u065E": "\u08F1",  # KFGQPC open dammatan (fatha with two dots) -> DK open dammatan
    "\u0656": "\u08F2",  # KFGQPC open kasratan (subscript alef) -> DK open kasratan
}
_CONVENTION_TABLE = str.maketrans(CONVENTION_MAP)

HAMZA_ABOVE, HAMZA_BELOW = "\u0654", "\u0655"
HAMZA_DECOMPOSE = {
    "\u0623": "\u0627" + HAMZA_ABOVE,  # أ
    "\u0625": "\u0627" + HAMZA_BELOW,  # إ
    "\u0626": "\u064A" + HAMZA_ABOVE,  # ئ
    "\u0624": "\u0648" + HAMZA_ABOVE,  # ؤ
}
# 'أٓ' (alef + hamza above + madda) is written by DK as tatweel + hamza + fatha
# + alef ('ٱلْـَٔاخِرَةِ'); Hafs round trip: 277/277 occurrences match.
AKHIRAH_PATTERN = "\u0627\u0654\u0653"
AKHIRAH_REPLACEMENT = "\u0640\u0654\u064E\u0627"


def apply_conventions(text: str) -> str:
    text = text.translate(_CONVENTION_TABLE)
    for src, dst in HAMZA_DECOMPOSE.items():
        text = text.replace(src, dst)
    return text.replace(AKHIRAH_PATTERN, AKHIRAH_REPLACEMENT)


# ---------------------------------------------------------------------------
# 3b. Render policy (per rewayah)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RenderRule:
    id: str
    codepoints: str  # human-readable
    rewayat: frozenset[str]
    kfgqpc_meaning: str
    dk_draws: str
    decision: str
    evidence: str
    apply: Callable[[str], str]
    changes_letters: bool = False
    needs_confirmation: bool = False


def _drop(chars: str) -> Callable[[str], str]:
    table = str.maketrans({c: None for c in chars})
    return lambda s: s.translate(table)


def _replace(src: str, dst: str) -> Callable[[str], str]:
    return lambda s: s.replace(src, dst)


def _iqlab_meem_below(s: str) -> str:
    # kasra followed by the small high meem: KFGQPC far-rewayah fonts draw
    # this meem BELOW the letter (iqlab of kasratan); DK only draws U+06E2
    # above, and writes the same sign as kasra + U+06ED.
    return s.replace(KASRA + SMALL_HIGH_MEEM, KASRA + SMALL_LOW_MEEM)


RENDER_POLICY: tuple[RenderRule, ...] = (
    RenderRule(
        id="yeh-barree",
        codepoints="U+06D2",
        rewayat=NAFI,
        kfgqpc_meaning="Maghribi final ya (\u06D2), 2,996 Warsh / 3,003 Qalun",
        dk_draws=".notdef (no glyph)",
        decision="U+0649 alef maksura (same dotless final ya; the Madani script writes final ya as \u0649)",
        evidence="not in the DK cmap; KFGQPC Warsh/Qalun write every final ya as U+06D2",
        apply=_replace("\u06D2", "\u0649"),
        changes_letters=True,
    ),
    RenderRule(
        id="nafi-sukun",
        codepoints="U+0652",
        rewayat=NAFI,
        kfgqpc_meaning="Maghribi sukun, drawn by the KFGQPC Warsh/Qalun fonts as a small circle",
        dk_draws="U+0652 = Madani sukun; U+06DF = small circle",
        decision="U+06DF via CONVENTION_MAP (keeps the circle shape the Nafi' mushaf uses; existing behaviour)",
        evidence="KFGQPC Warsh font render of '\u0627\u064F\u06EA\u0647\u0652\u062F\u0650\u0646\u064E\u0627' (circle sukun); no evidence that the circle is wrong",
        apply=lambda s: s,  # done by CONVENTION_MAP
    ),
    RenderRule(
        id="habti-waqf",
        codepoints="U+06D6",
        rewayat=NAFI,
        kfgqpc_meaning="the Maghribi (Habti) waqf sign, drawn as a small '\u0635' (9,948 per rewayah, 5,030 at verse ends)",
        dk_draws="the Madani '\u0635\u0644\u0649' sign (continuing preferred): the opposite recommendation",
        decision="omit",
        evidence="KFGQPC Warsh font draws uni06D6 as a small \u0635; DK glyph is \u0635\u0644\u0649 (rendered comparison)",
        apply=_drop("\u06D6"),
        needs_confirmation=True,
    ),
    RenderRule(
        id="sajdah-overline",
        codepoints="U+06E4",
        rewayat=frozenset({"shouba", "bazzi", "qumbul", "doori", "soosi"}),
        kfgqpc_meaning="sajdah overline on the sajdah words (26 per rewayah); not a madd",
        dk_draws=".notdef (no glyph); DK Hafs marks the sajdah with \u06E9 only",
        decision="drop (the \u06E9 sign is kept)",
        evidence="Hafs round trip: the 26 U+06E4 are the only extra marks vs DK Hafs",
        apply=_drop("\u06E4"),
    ),
    RenderRule(
        id="taqlil-open-dot",
        codepoints="U+06ED",
        rewayat=ABU_AMR,
        kfgqpc_meaning="hollow dot below (KFGQPC glyph 'downo'): taqlil / bayna bayn (626 Doori, 593 Soosi)",
        dk_draws="small low meem (iqlab sign): a wrong sign",
        decision="U+065C dot below (DK cannot draw a hollow dot: taqlil and imala then look alike)",
        evidence="KFGQPC Doori font render of '\u0645\u064F\u0648\u0633\u06ED\u064A\u0670' (hollow dot) vs DK U+065C (filled dot)",
        apply=_replace(SMALL_LOW_MEEM, DOT_BELOW),
    ),
    RenderRule(
        id="dot-below",
        codepoints="U+06EA",
        rewayat=frozenset(REWAYAT),
        kfgqpc_meaning=(
            "filled dot below (KFGQPC glyph 'down'): imala / taqlil on a consonant, tashil or ikhtilas, "
            "and on a wasl alef the start-with-kasra dot"
        ),
        dk_draws=".notdef (no glyph)",
        decision="U+065C dot below (DK's own imala sign, Hafs 11:41), including the wasl-alef dot",
        evidence=(
            "KFGQPC Warsh/Doori fonts draw a filled dot below in every use; DK U+065C draws the same dot "
            "below the letter (rendered comparison); dropping it turns Warsh 1:5 into '\u0627\u064F\u0647\u0652\u062F\u0650\u0646\u064E\u0627'"
        ),
        apply=_replace(EMPTY_CENTRE_LOW_STOP, DOT_BELOW),
        needs_confirmation=True,  # the wasl-alef use (about 690 per far rewayah)
    ),
    RenderRule(
        id="iqlab-meem-below",
        codepoints="U+0650 U+06E2",
        rewayat=FAR,
        kfgqpc_meaning="iqlab of kasratan: kasra + small meem, drawn BELOW the letter by the KFGQPC font",
        dk_draws="U+06E2 above the letter (reads like an iqlab of fathatan)",
        decision="U+0650 U+06ED (DK and KFGQPC-Hafs encoding of the same sign)",
        evidence="KFGQPC Warsh render of '\u0643\u064E\u0627\u0641\u0650\u0631\u0650\u06E2' (meem below) vs DK U+06E2 (above) and U+06ED (below)",
        apply=_iqlab_meem_below,
    ),
    RenderRule(
        id="zwj-hamza-seat",
        codepoints="U+200D",
        rewayat=ABU_AMR,
        kfgqpc_meaning="zero-width joiner used as the seat of the hamza in 17:7 '\u0644\u0650\u064A\u064E\u0633\u064F\u200D\u064F\u0654\u0648\u0627\u0652'",
        dk_draws="nothing (zero width): the damma and hamza after it float unattached",
        decision="U+0640 tatweel seat (how KFGQPC Hafs v2.0 and the DK Hafs DB write the same word)",
        evidence="glyph gate: unattached hamza with U+200D, attached with U+0640; DK Hafs 17:7 uses a tatweel seat",
        apply=_replace("\u200D", "\u0640"),
    ),
    RenderRule(
        id="dotless-tooth",
        codepoints="U+066E",
        rewayat=frozenset({"bazzi", "qumbul"}),
        kfgqpc_meaning="dotless tooth: seat of the tashil hamza in Hafs 6:19 (Makki 6:20) '\u0623\u064E\u066E\u06EA\u0646\u064E\u0651\u0643\u064F\u0645\u064F\u06E5'",
        dk_draws=".notdef (no glyph)",
        decision="U+0649 (a medial alef maksura is the same dotless tooth)",
        evidence="not in the DK cmap; one occurrence (Hafs 6:19)",
        apply=_replace("\u066E", "\u0649"),
        changes_letters=True,
    ),
    RenderRule(
        id="dad-with-small-zah",
        codepoints="U+0636 U+0638",
        rewayat=frozenset({"bazzi", "qumbul", "doori", "soosi"}),
        kfgqpc_meaning=(
            "81:24 '\u0628\u0650\u0636\u0638\u064E\u0646\u0650\u064A\u0646\u064D': the KFGQPC fonts draw \u0636 with a small \u0638 above (written with \u0636, read with \u0638)"
        ),
        dk_draws="both letters in full: the non-word '\u0628\u0636\u0638\u0646\u064A\u0646'",
        decision="\u0638 (the reading of these rewayat: '\u0628\u0650\u0638\u064E\u0646\u0650\u064A\u0646\u064D'); DK has no small \u0638",
        evidence="KFGQPC Bazzi/Doori fonts render the ligature afii57430_afii57432 as \u0636 + small \u0638",
        apply=_replace("\u0636\u0638", "\u0638"),
        changes_letters=True,
        needs_confirmation=True,
    ),
)

# Letter mappings a rule may perform. The validator canonicalizes BOTH the
# raw source token and the stored token with these (and hamza decomposition)
# before checking that no letter was added, dropped or changed.
LETTER_MAPPINGS: dict[str, tuple[tuple[str, str], ...]] = {
    "yeh-barree": (("\u06D2", "\u0649"),),
    "dotless-tooth": (("\u066E", "\u0649"),),
    "dad-with-small-zah": (("\u0636\u0638", "\u0638"),),
}

_RULES_BY_REWAYAH: dict[str, tuple[RenderRule, ...]] = {
    rid: tuple(r for r in RENDER_POLICY if rid in r.rewayat) for rid in REWAYAT
}


def dk_token(raw: str, rid: str) -> str:
    """Raw KFGQPC token -> text stored in the DK words DB for rewayah `rid`."""
    if rid not in _RULES_BY_REWAYAH:
        raise ValueError(f"unknown rewayah id {rid!r}")
    s = raw
    for rule in _RULES_BY_REWAYAH[rid]:
        s = rule.apply(s)
    return apply_conventions(s)


def policy_rows() -> list[dict[str, str]]:
    rows = []
    for r in RENDER_POLICY:
        rows.append(
            {
                "rule": r.id,
                "codepoints": r.codepoints,
                "rewayat": ", ".join(x for x in REWAYAT if x in r.rewayat),
                "kfgqpc_meaning": r.kfgqpc_meaning,
                "dk_draws": r.dk_draws,
                "decision": r.decision,
                "evidence": r.evidence,
                "confirm": "yes" if r.needs_confirmation else "",
            }
        )
    return rows


def policy_markdown() -> str:
    cols = ["rule", "codepoints", "rewayat", "kfgqpc_meaning", "dk_draws", "decision", "evidence", "confirm"]
    out = ["| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
    for row in policy_rows():
        out.append("| " + " | ".join(row[c].replace("|", "/") for c in cols) + " |")
    return "\n".join(out)


if __name__ == "__main__":
    if "--policy" in sys.argv:
        print(policy_markdown())
    else:
        print(__doc__)
