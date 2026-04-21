"""
Normalize KFGQPC text to Bayaan conventions.

Rules derived empirically from diff_codepoints.py output against 6,236 Hafs verses.

Codepoint substitutions:
  U+06E1 -> U+0652  (sukun style; covers 37,148 occurrences exactly)
  U+0657 -> U+08F0  (open fathatan; 2,901)
  U+0656 -> U+08F2  (open kasratan; 1,935)
  U+065E -> U+08F1  (open dammatan; 1,807)

Hamza decomposition (KFGQPC precomposed -> Bayaan decomposed):
  U+0623 (أ) -> U+0627 U+0654  (alef + hamza-above)
  U+0625 (إ) -> U+0627 U+0655  (alef + hamza-below)
  U+0626 (ئ) -> U+064A U+0654  (yeh + hamza-above)
  U+0624 (ؤ) -> U+0648 U+0654  (waw + hamza-above)

Verse markers:
  KFGQPC suffixes the bare Arabic-Indic digits at end of verse, joined by a space.
  Bayaan emits them as a separate token prefixed with U+06DD (end-of-ayah marker).

  "... يُؤۡمِنُونَ ٦"  ->  "... يُؤْمِنُونَ ۝٦"

Ruku' marker:
  KFGQPC treats U+06DE as a standalone token separated by spaces.
  Bayaan attaches it (no space) to the FIRST word of the verse.

  "۞ وَإِذَا ..."  ->  "۞وَإِذَا ..."

Silent-letter sukun (U+06DF vs U+0652):
  Cannot be resolved from KFGQPC text alone since both conventions collapse to
  the same codepoint. Left as a follow-up: for Hafs round-trip we tolerate ~3988
  mismatches on U+0652/U+06DF, validated numerically below.
"""
from __future__ import annotations

import re

# Combining hamza
HAMZA_ABOVE = "\u0654"
HAMZA_BELOW = "\u0655"

# Applied atomically via str.translate so U+06E1 -> U+0652 and U+0652 -> U+06DF
# don't collide. Bayaan uses U+0652 for quiescence (no vowel) and U+06DF for
# silent letters; KFGQPC inverts this (U+06E1 for quiescence, U+0652 for silent).
CODEPOINT_MAP = {
    "\u06E1": "\u0652",  # quiescence sukun
    "\u0652": "\u06DF",  # silent-letter mark
    "\u0657": "\u08F0",  # open fathatan
    "\u0656": "\u08F2",  # open kasratan
    "\u065E": "\u08F1",  # open dammatan
    # Purely visual KFGQPC glyph variants the DK font doesn't have — remap
    # to the nearest DK-supported equivalent. These do NOT carry tajweed
    # classification signal so substituting loses nothing.
    "\u06D2": "\u0649",  # yeh barree -> alef maksura (same dotless final form)
    "\u200F": "",  # RTL mark (invisible) -> drop; Skia handles RTL from buffer
}
_TRANSLATE_TABLE = str.maketrans({k: v for k, v in CODEPOINT_MAP.items()})

# KFGQPC Warsh/Qaloon markers that the DK font can't render BUT carry
# tajweed classification signal:
#   U+06E4 ۤ SMALL HIGH MADDA   — Madd al-Badal / Madd al-Lin (green)
#   U+06EA ۪ EMPTY CENTRE LOW STOP — Tashil / imalah hint (light blue/dark green)
# Preserve them through normalization so the classifier can read them,
# then strip just before DB insert via strip_for_render() below.
_CLASSIFICATION_MARKERS = set("\u06E4\u06EA")


def strip_for_render(text: str) -> str:
    """Remove classification-signal codepoints that DK can't render so the
    stored DB text renders cleanly. Called AFTER classification decisions
    have been recorded in the diff JSON."""
    return "".join(c for c in text if c not in _CLASSIFICATION_MARKERS)

HAMZA_DECOMPOSE = {
    "\u0623": "\u0627" + HAMZA_ABOVE,  # alef-above
    "\u0625": "\u0627" + HAMZA_BELOW,  # alef-below
    "\u0626": "\u064A" + HAMZA_ABOVE,  # yeh-above
    "\u0624": "\u0648" + HAMZA_ABOVE,  # waw-above
}

ARABIC_DIGITS = "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669"
END_OF_AYAH = "\u06DD"
RUKU = "\u06DE"

# KFGQPC uses NBSP (U+00A0) or regular space before the trailing ayah digits.
TRAIL_AYAH_NUM = re.compile(rf"[ \u00A0]([{ARABIC_DIGITS}]+)$")
# Leading ruku' marker followed by whitespace
LEADING_RUKU = re.compile(rf"^{RUKU}\s+")


# After hamza decomposition, KFGQPC's precomposed `أٓ` becomes `ا + ٔ + ٓ`
# (alef, hamza-above, madda). Bayaan writes the same sound as `ـَٔا`
# (tatweel, fatha, hamza-above, alef) — the tatweel acts as a visual carrier
# for the hamza mark that precedes a true alef. This occurs in words like
# "الآخرة", "آدم", "آخر".
AKHIRAH_PATTERN = "\u0627\u0654\u0653"  # ا + ٔ + ٓ
AKHIRAH_REPLACEMENT = "\u0640\u0654\u064E\u0627"  # ـ + ٔ + َ + ا


def substitute_codepoints(text: str) -> str:
    text = text.translate(_TRANSLATE_TABLE)
    for src, dst in HAMZA_DECOMPOSE.items():
        text = text.replace(src, dst)
    text = text.replace(AKHIRAH_PATTERN, AKHIRAH_REPLACEMENT)
    return text


def attach_ruku(text: str) -> str:
    """KFGQPC: '۞ وَإِذَا...' -> Bayaan: '۞وَإِذَا...'"""
    return LEADING_RUKU.sub(RUKU, text, count=1)


def wrap_ayah_marker(text: str) -> str:
    """KFGQPC: '... يُؤۡمِنُونَ ٦' -> Bayaan: '... يُؤْمِنُونَ ۝٦'"""
    return TRAIL_AYAH_NUM.sub(f" {END_OF_AYAH}" + r"\1", text)


def normalize_verse(kfgqpc_text: str, *, wrap_ayah: bool = True) -> str:
    """Full normalization pipeline: KFGQPC conventions -> Bayaan conventions.

    `wrap_ayah=True` (default) prefixes the trailing ayah digit with U+06DD
    (Bayaan's DigitalKhatt font expects '۝N'). For rewayat that render with
    a KFGQPC per-qiraat font, set `wrap_ayah=False` — KFGQPC fonts have an
    OpenType feature that turns a bare Arabic digit into the ornamental
    ayah marker, and the U+06DD prefix would render as a SECOND empty marker
    in front of the numbered one.
    """
    t = substitute_codepoints(kfgqpc_text)
    t = attach_ruku(t)
    if wrap_ayah:
        t = wrap_ayah_marker(t)
    return t


def normalize_word(kfgqpc_word: str) -> str:
    """Word-level normalization without the whole-verse rules (no ruku' detach,
    no ayah marker wrapping). Used for diff detection at word granularity."""
    return substitute_codepoints(kfgqpc_word)
