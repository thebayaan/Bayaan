"""
Build dk_words_shouba.db and shouba-diff.json from KFGQPC shoubaData_v8.json.

Strategy
--------
1. Copy Bayaan's dk_words.db -> dk_words_shouba.db
2. For each verse where normalize(KFGQPC Hafs) != normalize(KFGQPC Shouba):
   - Split both normalized texts into whitespace-delimited tokens
   - For each position where Hafs token != Shouba token:
     - Look up Bayaan's existing word at (surah, ayah, word_position)
     - If Bayaan's existing word != normalized Shouba word at that position:
       UPDATE text in new DB, record diff in shouba-diff.json
3. Skip the 3 whitespace-only edge cases (36:22, 37:17, 41:51) — Bayaan's
   tokenization preserves the same visual output

Outputs
-------
- data/mushaf/digitalkhatt/dk_words_shouba.db   (patched words table)
- data/mushaf/digitalkhatt/shouba-diff.json     (runtime highlight lookup)
"""
from __future__ import annotations

import json
import shutil
import sqlite3
from collections import defaultdict
from pathlib import Path

from normalize import normalize_verse

HERE = Path(__file__).parent
REPO = HERE.parents[1]
SRC_DB = REPO / "data" / "mushaf" / "digitalkhatt" / "digital-khatt-v2.db"
DST_DB = REPO / "data" / "mushaf" / "digitalkhatt" / "dk_words_shouba.db"
DIFF_JSON = REPO / "data" / "mushaf" / "digitalkhatt" / "shouba-diff.json"

WHITESPACE_EDGE_CASES = {(36, 22), (37, 17), (41, 51)}


def load_bayaan_words() -> dict[tuple[int, int], list[tuple[int, str]]]:
    """Returns {(surah, ayah): [(word_position, text), ...]} sorted by position."""
    conn = sqlite3.connect(SRC_DB)
    cur = conn.cursor()
    out: dict[tuple[int, int], list[tuple[int, str]]] = defaultdict(list)
    for surah, ayah, word, text in cur.execute(
        "SELECT surah, ayah, word, text FROM words ORDER BY surah, ayah, word"
    ):
        out[(surah, ayah)].append((word, text))
    conn.close()
    return out


def main() -> None:
    print(f"Copying {SRC_DB.name} -> {DST_DB.name}")
    shutil.copy(SRC_DB, DST_DB)

    hafs = json.loads((HERE / "hafs.json").read_text(encoding="utf-8"))
    shouba = json.loads((HERE / "shouba.json").read_text(encoding="utf-8"))
    hafs_by_key = {(r["sora"], r["aya_no"]): r["aya_text"] for r in hafs}
    shouba_by_key = {(r["sura_no"], r["aya_no"]): r["aya_text"] for r in shouba}

    bayaan = load_bayaan_words()

    conn = sqlite3.connect(DST_DB)
    cur = conn.cursor()

    diff_map: dict[str, list[int]] = {}
    patched_words = 0
    skipped_encoding_only = 0
    skipped_whitespace_edge = 0
    word_count_mismatches: list[tuple[int, int, int, int, int]] = []

    for key in sorted(bayaan.keys()):
        if key in WHITESPACE_EDGE_CASES:
            skipped_whitespace_edge += 1
            continue

        hafs_text = hafs_by_key.get(key)
        shouba_text = shouba_by_key.get(key)
        if hafs_text is None or shouba_text is None:
            continue

        hafs_norm = normalize_verse(hafs_text)
        shouba_norm = normalize_verse(shouba_text)

        if hafs_norm == shouba_norm:
            continue  # no change vs Hafs

        hafs_tokens = hafs_norm.split()
        shouba_tokens = shouba_norm.split()

        bayaan_words = bayaan[key]  # [(word_position, text), ...]
        bayaan_word_count = len(bayaan_words)

        # Expected alignment: Bayaan word count == KFGQPC token count (both
        # include the trailing ayah marker token as a distinct word).
        if bayaan_word_count != len(hafs_tokens) or bayaan_word_count != len(shouba_tokens):
            word_count_mismatches.append(
                (key[0], key[1], bayaan_word_count, len(hafs_tokens), len(shouba_tokens))
            )
            continue  # skip and log — can't safely patch

        differing_positions: list[int] = []
        for i, (h, s) in enumerate(zip(hafs_tokens, shouba_tokens)):
            if h == s:
                continue
            word_pos = bayaan_words[i][0]  # 1-indexed from DB
            bayaan_existing = bayaan_words[i][1]
            if s == bayaan_existing:
                skipped_encoding_only += 1
                continue
            # Apply patch
            cur.execute(
                "UPDATE words SET text = ? WHERE surah = ? AND ayah = ? AND word = ?",
                (s, key[0], key[1], word_pos),
            )
            patched_words += 1
            differing_positions.append(word_pos)

        if differing_positions:
            diff_map[f"{key[0]}:{key[1]}"] = differing_positions

    conn.commit()
    conn.close()

    DIFF_JSON.write_text(json.dumps(diff_map, ensure_ascii=False, separators=(",", ":")))

    print()
    print(f"Patched words:             {patched_words}")
    print(f"Verses with diffs:         {len(diff_map)}")
    print(f"Encoding-only skips:       {skipped_encoding_only}")
    print(f"Whitespace edge cases:     {skipped_whitespace_edge}")
    print(f"Word-count mismatches:     {len(word_count_mismatches)}")
    if word_count_mismatches:
        print("  (surah:ayah, bayaan, hafs, shouba)")
        for s, a, bc, hc, sc in word_count_mismatches[:20]:
            print(f"    {s}:{a}  bayaan={bc} hafs={hc} shouba={sc}")
    print()
    print(f"Wrote {DST_DB.name} ({DST_DB.stat().st_size // 1024} KB)")
    print(f"Wrote {DIFF_JSON.name} ({DIFF_JSON.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
