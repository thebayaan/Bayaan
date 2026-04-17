"""
Build a Bayaan-compatible Mushaf words DB by patching a base rewayah's words
DB with another rewayah's text — the same approach used for Shu'bah on top
of Hafs, generalized to any (base, target) pair.

Strategy
--------
The base DB has Hafs's word IDs and layout. We walk both streams in parallel:
  - Hafs words include ayah-marker tokens (۝N) that delimit verses.
  - Target rewayah words are the same content sequence, just with different
    spelling (Bazzi: Jibril → Jabra'il, etc.) and a different number of
    intra-verse markers (Bazzi merges some Hafs verse pairs).

For each Hafs word slot:
  - If it's an ayah marker, keep Hafs's marker text (preserving Hafs's
    verse numbering even when the target merges verses — see README).
  - Otherwise, advance through the target's content stream and substitute
    the corresponding token's text.

Output is a copy of the base DB with `words.text` updated; word IDs are
unchanged so the existing layout DB still references valid ranges. The
runtime layer only needs to know the words DB path is different.

Limitations
-----------
~7 surahs in some rewayat have ±1-2 content word count differences from
Hafs (typically due to spelling causing whitespace tokenization to split
or merge a word). Those surahs are skipped — Hafs text is left in those
slots — and logged so they can be addressed manually later if needed.

Usage
-----
    python3 build_sibling_rewayah.py <rewayah_id> <kfgqpc_json> [base_db]

    # Defaults base_db to digital-khatt-v2.db (Hafs):
    python3 scripts/rewayah/build_sibling_rewayah.py bazzi \\
        scripts/rewayah/bazzi.json
"""
from __future__ import annotations

import json
import re
import shutil
import sqlite3
import sys
from difflib import SequenceMatcher
from pathlib import Path

from normalize import normalize_verse, strip_for_render

# Classification markers that strip_for_render removes. Mirrored here so the
# anchor helpers can walk pre-strip text and compute post-strip char indices.
_STRIP_SET = set("\u06E4\u06EA")

HERE = Path(__file__).parent
REPO = HERE.parents[1]
OUT_DIR = REPO / "data" / "mushaf" / "digitalkhatt"
DEFAULT_BASE = OUT_DIR / "digital-khatt-v2.db"

# An ayah marker word is "۝" + Arabic-Indic digits, OR (rarely) a bare
# digit run with no other letters. Matches both Hafs and KFGQPC conventions.
_AYAH_MARKER_RE = re.compile(r"^[\u06DD\u06DE]?[\u0660-\u0669]+$")


def is_ayah_marker(text: str) -> bool:
    return bool(_AYAH_MARKER_RE.match(text)) or text.startswith("\u06DD")


# Silah characters: small high waw (ۥ) and small high yeh (ۦ) that sit above
# a preceding heh. Bazzi uses these pervasively on third-person pronouns;
# treating every occurrence as a "word diff" would flag nearly every pronoun
# in the Quran.
#
# Silah also triggers a secondary vocalization change: where Hafs ends a
# pronoun with sukun (ْ), Bazzi uses damma (ُ) or kasra (ِ) to carry the silah
# mark. To match these cases up as "silah-only", we normalize both sides:
#   - Drop silah marks AND the damma/kasra they attach to.
#   - Drop trailing sukun (Hafs's equivalent when there's no silah).
# Genuine letter swaps like Jibril → Jabra'il still differ after normalization.
_SILAH_CHARS = "\u06E5\u06E6"
_PRECEDING_VOWELS = "\u064F\u0650"  # damma, kasra
_TRAILING_VOWELS = set("\u064E\u064F\u0650")  # fatha, damma, kasra
# Marks stripped from both sides during substantive-change comparison.
# These are dominated by Madinah-vs-KFGQPC typographic convention differences
# (Hafs's madda marks, shadda placements, waqf stops) that don't reflect a
# genuine Bazzi reading difference. Stripping them leaves only the letter
# skeleton + internal vowel choices, so only content-level changes trigger
# highlights. Trailing vowels are also stripped because word-final damma/
# kasra differences are almost always silah-adjacent vocalization swaps.
_STRIPPABLE_MARKS = set(
    "\u0651"  # shadda
    "\u0652"  # sukun
    "\u0653"  # madda
    "\u06D6\u06D7\u06D8\u06D9\u06DA\u06DB\u06DC"  # small high waqf signs
)


def _strip_base(text: str) -> tuple[str, bool]:
    """Strip silah (+ its preceding damma/kasra) and typographic marks.
    Returns (stripped_text, had_silah)."""
    result: list[str] = []
    had_silah = False
    for ch in text:
        if ch in _SILAH_CHARS:
            had_silah = True
            if result and result[-1] in _PRECEDING_VOWELS:
                result.pop()
            continue
        if ch in _STRIPPABLE_MARKS:
            continue
        result.append(ch)
    return "".join(result), had_silah


def categorize_diff(
    hafs_text: str, bazzi_text: str
) -> tuple[str, list[int]] | None:
    """Legacy two-tier categorizer for close-to-Hafs rewayat (Shu'bah,
    Bazzi, Qumbul). Use classify_word() for Warsh/Qaloon/Doori/Soosi
    where the published mushaf color scheme applies.

    Returns (category, char_indices). char_indices is always an empty
    list — close rewayat use whole-word background/foreground highlights
    for major/minor. The renderer treats [] as 'color the whole word'."""
    h_norm, h_silah = _strip_base(hafs_text)
    b_norm, b_silah = _strip_base(bazzi_text)
    if h_silah or b_silah:
        while h_norm and h_norm[-1] in _TRAILING_VOWELS:
            h_norm = h_norm[:-1]
        while b_norm and b_norm[-1] in _TRAILING_VOWELS:
            b_norm = b_norm[:-1]
    if h_norm == b_norm:
        return None
    h_trail = h_norm
    b_trail = b_norm
    while h_trail and h_trail[-1] in _TRAILING_VOWELS:
        h_trail = h_trail[:-1]
    while b_trail and b_trail[-1] in _TRAILING_VOWELS:
        b_trail = b_trail[:-1]
    if h_trail == b_trail:
        return ("minor", [])
    return ("major", [])


# === Published-mushaf classification for Warsh/Qaloon/Doori/Soosi ===
# Categories map to specific tajweed rules with established pedagogical
# color conventions. See Unicode L2/19-306 for KFGQPC encoding details
# of the markers we detect here.

_HAMZA_LETTERS = set("\u0621\u0623\u0624\u0625\u0626")  # ء أ ؤ إ ئ
_IBDAL_LONG_VOWELS = set("\u0627\u0648\u064A")  # ا و ي
_ARABIC_LETTERS = set(
    "\u0627\u0628\u0629\u062A\u062B\u062C\u062D\u062E"
    "\u062F\u0630\u0631\u0632\u0633\u0634\u0635\u0636"
    "\u0637\u0638\u0639\u063A\u0641\u0642\u0643\u0644"
    "\u0645\u0646\u0647\u0648\u0649\u064A"
    "\u0621\u0623\u0624\u0625\u0626"  # hamzas
    "\u0622\u0671"  # alef madda, alef wasla
)
_TAFKHIM_TRIGGERS = set("\u0637\u0638\u0635")  # ط ظ ص
_ALLAH_SUBSTR = "\u0644\u0644\u0651\u064E\u0647"  # للَّه


def _letters_only(text: str) -> str:
    return "".join(c for c in text if c in _ARABIC_LETTERS)


def _marker_anchors(target_raw: str, marker: str) -> list[int]:
    """For each occurrence of `marker` in `target_raw`, return the post-strip
    char index of the nearest preceding base Arabic letter. Classification
    markers are skipped (they'll be stripped before DB insert). The anchor
    is the letter the combining mark visually sits on."""
    anchors: list[int] = []
    post_idx = 0
    last_base_post = -1
    for ch in target_raw:
        if ch == marker:
            if last_base_post >= 0:
                anchors.append(last_base_post)
            continue
        if ch in _STRIP_SET:
            continue
        if ch in _ARABIC_LETTERS:
            last_base_post = post_idx
        post_idx += 1
    return anchors


def _nth_letter_post_idx(target_raw: str, n: int) -> int:
    """Post-strip char index of the n-th (0-based) Arabic base letter in
    target_raw. Returns -1 if out of range."""
    post_idx = 0
    letter_count = 0
    for ch in target_raw:
        if ch in _STRIP_SET:
            continue
        if ch in _ARABIC_LETTERS:
            if letter_count == n:
                return post_idx
            letter_count += 1
        post_idx += 1
    return -1


def classify_word(
    hafs_raw: str,
    target_raw: str,
    hafs_prev_raw: str | None,
    target_prev_raw: str | None,
) -> tuple[str, list[int]] | None:
    """Classify a patched word into one of the published-mushaf tajweed
    categories. Returns (category, post_strip_char_indices) or None.

    Categories (first match wins):
      'madd'      — Madd al-Badal or Madd al-Lin (U+06E4 marker present)
      'tashil'    — Hamza tashil / musahhala (U+06EA or U+06EC marker)
      'ibdal'     — Hafs hamza → Warsh long vowel at same position
      'taghliz'   — Allah following a tafkhim-trigger (ط/ظ/ص + vowel)
      'mukhtalif' — Any other word-level text diff (fall-through)

    char_indices are into the DB-stored (post-strip) word text. Empty list
    means 'whole word' — the renderer treats it as legacy word-level.
    Silah is detected at runtime from stored text (U+06E5/U+06E6).
    """
    # Is there actually a diff?
    h_strip = strip_for_render(hafs_raw)
    t_strip = strip_for_render(target_raw)
    if h_strip == t_strip:
        return None

    # 1. Madd al-Badal / Madd al-Lin — U+06E4 explicitly marks this in
    #    KFGQPC Warsh/Qaloon data. Anchor on the letter it sits above.
    if "\u06E4" in target_raw:
        anchors = _marker_anchors(target_raw, "\u06E4")
        if anchors:
            return ("madd", sorted(set(anchors)))

    # 2. Tashil — U+06EA (dot below) or U+06EC (ring above) indicates
    #    hamza tashil / musahhala. Anchor on the carrier letter.
    tashil_anchors: list[int] = []
    if "\u06EA" in target_raw:
        tashil_anchors.extend(_marker_anchors(target_raw, "\u06EA"))
    if "\u06EC" in target_raw:
        tashil_anchors.extend(_marker_anchors(target_raw, "\u06EC"))
    if tashil_anchors:
        return ("tashil", sorted(set(tashil_anchors)))

    # 3. Ibdal — Hafs hamza in same letter position as Warsh long vowel.
    #    Letter-count-preserving substitution: أ→ا, ؤ→و, ئ→ي. Color just
    #    the substituted letter in the target word.
    h_letters = _letters_only(hafs_raw)
    t_letters = _letters_only(target_raw)
    if len(h_letters) == len(t_letters):
        ibdal_anchors: list[int] = []
        for i, (h_c, t_c) in enumerate(zip(h_letters, t_letters)):
            if h_c in _HAMZA_LETTERS and t_c in _IBDAL_LONG_VOWELS:
                idx = _nth_letter_post_idx(target_raw, i)
                if idx >= 0:
                    ibdal_anchors.append(idx)
        if ibdal_anchors:
            return ("ibdal", sorted(set(ibdal_anchors)))

    # 4. Taghliz al-Lam — Allah following a tafkhim trigger on the
    #    preceding word. Color the lam+lam+shadda in للّه.
    if _ALLAH_SUBSTR in target_raw and target_prev_raw:
        prev_letters = _letters_only(target_prev_raw)
        if prev_letters and prev_letters[-1] in _TAFKHIM_TRIGGERS:
            post_target = strip_for_render(target_raw)
            idx = post_target.find(_ALLAH_SUBSTR)
            if idx >= 0:
                return ("taghliz", [idx, idx + 1, idx + 2])

    # 5. Mukhtalif fall-through — but only if there's a SUBSTANTIVE diff.
    #    Filter out typographic-only variations (alef wasla style, trailing
    #    vowel mood shifts, silah-adjacent changes) that would otherwise
    #    flood the page with red. The published mushaf reserves the red
    #    "mukhtalif" tag for genuine reading variants. Whole-word highlight.
    h_norm, h_silah = _strip_base(hafs_raw)
    t_norm, t_silah = _strip_base(target_raw)
    if h_silah or t_silah:
        while h_norm and h_norm[-1] in _TRAILING_VOWELS:
            h_norm = h_norm[:-1]
        while t_norm and t_norm[-1] in _TRAILING_VOWELS:
            t_norm = t_norm[:-1]
    if h_norm == t_norm:
        return None
    h_letters = _letters_only(h_norm)
    t_letters = _letters_only(t_norm)
    if h_letters == t_letters:
        return None
    return ("mukhtalif", [])


def align_content(
    base_texts: list[str], target_texts: list[str]
) -> list[int | None]:
    """For each base content index, return the aligned target content index
    (or None if no alignment). Uses difflib's SequenceMatcher — efficient
    for mostly-similar sequences. Unaligned base slots keep the base text;
    unaligned target words are dropped."""
    mapping: list[int | None] = [None] * len(base_texts)
    matcher = SequenceMatcher(a=base_texts, b=target_texts, autojunk=False)
    for op, b_i, b_j, t_i, t_j in matcher.get_opcodes():
        if op in ("equal", "replace"):
            common = min(b_j - b_i, t_j - t_i)
            for k in range(common):
                mapping[b_i + k] = t_i + k
        # 'delete': base has extra words target doesn't cover — keep base text
        # 'insert': target has extra words with no base slot — drop them
    return mapping


def main() -> None:
    if len(sys.argv) < 3 or len(sys.argv) > 4:
        print(
            f"Usage: {sys.argv[0]} <rewayah_id> <kfgqpc_json> [base_db]",
            file=sys.stderr,
        )
        sys.exit(2)

    rewayah_id = sys.argv[1]
    source_json = Path(sys.argv[2])
    base_db = Path(sys.argv[3]) if len(sys.argv) == 4 else DEFAULT_BASE

    out_db = OUT_DIR / f"dk_words_{rewayah_id}.db"
    print(f"Copying {base_db.name} -> {out_db.name}")
    shutil.copy(base_db, out_db)

    # Load Hafs (base) words in order. Keep the full tuple so we can build
    # the diff JSON with (surah, ayah, word) keys at the same time as the
    # patching runs.
    conn = sqlite3.connect(out_db)
    base_rows = conn.execute(
        "SELECT id, surah, ayah, word, text FROM words ORDER BY id"
    ).fetchall()
    base_verse_key_by_id: dict[int, tuple[int, int, int]] = {
        r[0]: (r[1], r[2], r[3]) for r in base_rows
    }
    # Diff map: {verseKey: {category: [[wordPos, [charIdx, ...]], ...]}}
    # Empty char list = whole-word highlight (close-rewayat major/minor and
    # mukhtalif fallback). Specific char indices = letter-level highlight
    # for madd/tashil/ibdal/taghliz on far rewayat.
    diff_map: dict[str, dict[str, list[list]]] = {}

    # Build target streams per surah. We need TWO views of the target:
    #   - content stream (no markers) for word-by-word substitution
    #   - full token stream (with markers in their Bazzi-native positions),
    #     used to decide what marker text to emit for each Hafs marker slot
    #     so users see Bazzi's verse numbers, not Hafs's.
    target_data = json.loads(source_json.read_text(encoding="utf-8"))
    target_by_surah: dict[int, list[str]] = {}
    target_full_by_surah: dict[int, list[str]] = {}  # tokens in Bazzi order
    for row in sorted(target_data, key=lambda r: (r.get("sura_no", r.get("sora")), r["aya_no"])):
        s = row.get("sura_no", row.get("sora"))
        normalized = normalize_verse(row["aya_text"], wrap_ayah=True)
        for tok in normalized.split():
            target_full_by_surah.setdefault(s, []).append(tok)
            if not is_ayah_marker(tok):
                target_by_surah.setdefault(s, []).append(tok)

    # Group base rows by surah preserving (id, original_text, is_marker).
    base_by_surah: dict[int, list[tuple[int, str, bool]]] = {}
    for row_id, surah, _ayah, _word, text in base_rows:
        base_by_surah.setdefault(surah, []).append(
            (row_id, text, is_ayah_marker(text))
        )

    # Pre-compute target markers as (content_position, marker_text). The
    # content_position is the count of content tokens that precede the
    # marker in Bazzi's stream — i.e., where in the content sequence this
    # marker should appear.
    target_markers_by_surah: dict[int, list[tuple[int, str]]] = {}
    for s, full_tokens in target_full_by_surah.items():
        markers: list[tuple[int, str]] = []
        content_count = 0
        for tok in full_tokens:
            if is_ayah_marker(tok):
                markers.append((content_count, tok))
            else:
                content_count += 1
        target_markers_by_surah[s] = markers

    # Close-to-Hafs rewayat (same qari, nearly identical content) use the
    # simple major/minor categorizer. Far rewayat (different qari with
    # pervasive differences) use the published-mushaf tajweed classifier
    # and strip classification-only markers before DB write.
    _CLOSE_REWAYAT = {"shouba", "bazzi", "qumbul"}
    use_full_classifier = rewayah_id not in _CLOSE_REWAYAT

    patched_words = 0
    blanked_markers = 0
    unmatched_base = 0  # Hafs slots the aligner couldn't map
    dropped_target = 0  # Bazzi content words that fell outside alignment

    cur = conn.cursor()
    for surah in sorted(base_by_surah.keys()):
        base_rows_s = base_by_surah[surah]
        target_content = target_by_surah.get(surah, [])
        target_markers_by_pos = {
            pos: txt for pos, txt in target_markers_by_surah.get(surah, [])
        }

        # Extract base content view (same order as base_rows_s, markers stripped)
        base_content_texts = [t for _, t, m in base_rows_s if not m]

        # Align content streams. mapping[i] = target content index for base
        # content index i (or None if unaligned — in which case we keep the
        # base text at that slot).
        mapping = align_content(base_content_texts, target_content)
        if base_content_texts:
            target_indices_used = {i for i in mapping if i is not None}
            dropped_target += len(target_content) - len(target_indices_used)
            unmatched_base += mapping.count(None)

        # Walk base rows, emitting actions. Track the highest target content
        # index consumed so far so we can line up markers against Bazzi's
        # marker positions.
        base_content_cursor = 0
        last_target_idx = -1
        prev_base_text: str | None = None
        prev_target_raw: str | None = None

        for row_id, base_text, is_marker in base_rows_s:
            if not is_marker:
                target_idx = mapping[base_content_cursor]
                if target_idx is not None:
                    new_text_raw = target_content[target_idx]
                    last_target_idx = max(last_target_idx, target_idx)
                    # DB stores render-safe text (classification-only markers
                    # stripped so DK font doesn't fall back to system font
                    # for U+06E4/U+06EA which it doesn't ship glyphs for).
                    new_text_render = (
                        strip_for_render(new_text_raw)
                        if use_full_classifier
                        else new_text_raw
                    )
                    if new_text_render != base_text:
                        cur.execute(
                            "UPDATE words SET text = ? WHERE id = ?",
                            (new_text_render, row_id),
                        )
                        patched_words += 1
                        # Classify using RAW text (with markers) so the
                        # classifier can see U+06E4/U+06EA.
                        if use_full_classifier:
                            result = classify_word(
                                base_text,
                                new_text_raw,
                                prev_base_text,
                                prev_target_raw,
                            )
                        else:
                            result = categorize_diff(base_text, new_text_raw)
                        if result is not None:
                            cat, char_indices = result
                            s, a, w = base_verse_key_by_id[row_id]
                            verse_key = f"{s}:{a}"
                            diff_map.setdefault(verse_key, {}).setdefault(
                                cat, []
                            ).append([w, char_indices])
                    prev_target_raw = new_text_raw
                else:
                    prev_target_raw = None
                prev_base_text = base_text
                base_content_cursor += 1
            else:
                # Marker slot. The "target content position" we've reached
                # is last_target_idx + 1. If Bazzi has a marker at that
                # position, use it; otherwise blank (Bazzi merged here).
                target_pos = last_target_idx + 1
                target_marker_text = target_markers_by_pos.get(target_pos)
                if target_marker_text is not None:
                    if target_marker_text != base_text:
                        cur.execute(
                            "UPDATE words SET text = ? WHERE id = ?",
                            (target_marker_text, row_id),
                        )
                        patched_words += 1
                    # Consume this marker so it's not used again
                    del target_markers_by_pos[target_pos]
                else:
                    cur.execute(
                        "UPDATE words SET text = ? WHERE id = ?",
                        ("", row_id),
                    )
                    blanked_markers += 1

    conn.commit()
    conn.close()

    # Drop empty-list keys to keep the JSON compact.
    compact_diff_map: dict[str, dict[str, list[list]]] = {}
    for k, tiers in diff_map.items():
        kept = {t: v for t, v in tiers.items() if v}
        if kept:
            compact_diff_map[k] = kept

    diff_path = OUT_DIR / f"{rewayah_id}-diff.json"
    diff_path.write_text(
        json.dumps(compact_diff_map, ensure_ascii=False, separators=(",", ":"))
    )

    category_counts: dict[str, int] = {}
    for tiers in compact_diff_map.values():
        for cat, positions in tiers.items():
            category_counts[cat] = category_counts.get(cat, 0) + len(positions)

    print(f"Patched words: {patched_words}")
    for cat in sorted(category_counts.keys()):
        print(f"  -> {cat}: {category_counts[cat]}")
    print(f"  -> total flagged verses: {len(compact_diff_map)}")
    print(f"Blanked markers (merged verses): {blanked_markers}")
    print(f"Unmatched base slots (kept Hafs text): {unmatched_base}")
    print(f"Dropped target words (no base slot): {dropped_target}")
    print()
    print(f"Wrote {out_db.name} ({out_db.stat().st_size // 1024} KB)")
    print(f"Wrote {diff_path.name} ({diff_path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
