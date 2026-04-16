"""
Comprehensive comparison of all KFGQPC rewayat against Hafs.

For each rewayah reports:
  - Verse count vs Hafs (6236)
  - Whether ayah numbering is identical
  - Number of surahs with different verse counts
  - Page/line layout alignment (how many verses share the same page+line slot)
  - Word-level text diff count (after normalization)
  - Single-word swap count
  - Word-count mismatch count (verses where word counts differ)
  - Overall complexity rating for implementation
"""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

from normalize import normalize_verse

HERE = Path(__file__).parent

REWAYAT = {
    "shouba": {"file": "shouba.json", "sura_key": "sura_no", "sora_key": None},
    "warsh": {"file": "warsh.json", "sura_key": "sura_no", "sora_key": None},
    "qaloon": {"file": "qaloon.json", "sura_key": "sura_no", "sora_key": None},
    "doori": {"file": "doori.json", "sura_key": "sura_no", "sora_key": None},
    "soosi": {"file": "soosi.json", "sura_key": "sura_no", "sora_key": None},
    "bazzi": {"file": "bazzi.json", "sura_key": "sura_no", "sora_key": None},
    "qumbul": {"file": "qumbul.json", "sura_key": "sura_no", "sora_key": None},
}

HAFS_FILE = "hafs.json"


def load_json(name: str) -> list[dict]:
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def get_key(row: dict, sura_key: str) -> tuple[int, int]:
    return (row.get(sura_key) or row.get("sora"), row["aya_no"])


def first_page(p) -> int:
    if isinstance(p, int):
        return p
    return int(str(p).split("-")[0])


def main() -> None:
    hafs_data = load_json(HAFS_FILE)
    hafs_by_key = {(r["sora"], r["aya_no"]): r for r in hafs_data}
    hafs_verse_count = len(hafs_data)

    print(f"{'Rewayah':>10} | {'Verses':>7} | {'Same#':>5} | {'SurahΔ':>6} | "
          f"{'PageLine%':>9} | {'TextΔ':>6} | {'1-word':>6} | {'WC-mis':>6} | "
          f"{'Complexity':>12}")
    print("-" * 100)

    for rw_name, cfg in REWAYAT.items():
        data = load_json(cfg["file"])
        sura_key = cfg["sura_key"] or "sora"

        # --- Verse count ---
        verse_count = len(data)
        same_count = verse_count == hafs_verse_count

        # --- Build key map ---
        rw_by_key: dict[tuple[int, int], dict] = {}
        for row in data:
            k = (row.get(sura_key, row.get("sora")), row["aya_no"])
            rw_by_key[k] = row

        # --- Surah-level verse count mismatches ---
        surah_deltas = 0
        for s in range(1, 115):
            hc = sum(1 for r in hafs_data if r["sora"] == s)
            rc = sum(1 for r in data if (r.get(sura_key, r.get("sora"))) == s)
            if hc != rc:
                surah_deltas += 1

        # --- Page/line alignment ---
        shared_keys = set(hafs_by_key) & set(rw_by_key)
        page_line_match = 0
        for key in shared_keys:
            h = hafs_by_key[key]
            r = rw_by_key[key]
            hp = h["page"]
            rp = first_page(r["page"])
            if hp == rp and h["line_start"] == r["line_start"] and h["line_end"] == r["line_end"]:
                page_line_match += 1
        pct = page_line_match / max(len(shared_keys), 1) * 100

        # --- Word-level diff (using normalization) ---
        text_diffs = 0
        single_word_swaps = 0
        wc_mismatches = 0
        for key in shared_keys:
            h_text = hafs_by_key[key]["aya_text"]
            r_text = rw_by_key[key]["aya_text"]
            h_norm = normalize_verse(h_text)
            r_norm = normalize_verse(r_text)
            if h_norm == r_norm:
                continue
            text_diffs += 1
            h_words = h_norm.split()
            r_words = r_norm.split()
            if len(h_words) != len(r_words):
                wc_mismatches += 1
                continue
            word_diffs = sum(1 for a, b in zip(h_words, r_words) if a != b)
            if word_diffs == 1:
                single_word_swaps += 1

        # --- Complexity rating ---
        if same_count and pct == 100.0 and wc_mismatches <= 5:
            complexity = "DROP-IN"
        elif same_count and pct > 95 and wc_mismatches <= 20:
            complexity = "EASY"
        elif not same_count and pct > 85:
            complexity = "MODERATE"
        elif not same_count and surah_deltas > 20:
            complexity = "HARD"
        else:
            complexity = "MODERATE"

        print(
            f"{rw_name:>10} | {verse_count:>7} | {'YES' if same_count else 'NO':>5} | "
            f"{surah_deltas:>6} | {pct:>8.1f}% | {text_diffs:>6} | "
            f"{single_word_swaps:>6} | {wc_mismatches:>6} | {complexity:>12}"
        )

    print()
    print("Legend:")
    print("  Verses   = total verse count (Hafs = 6236)")
    print("  Same#    = verse count identical to Hafs?")
    print("  SurahΔ   = surahs with different verse counts vs Hafs")
    print("  PageLine% = % of shared verses on exact same (page, line_start, line_end)")
    print("  TextΔ    = verses where normalized text differs from Hafs")
    print("  1-word   = of those, how many are single-word swaps")
    print("  WC-mis   = verses where word count differs (can't do position-based patching)")
    print("  Complexity: DROP-IN = same pipeline as Shu'bah, EASY = minor extensions,")
    print("              MODERATE = needs verse-number mapping, HARD = significant work")


if __name__ == "__main__":
    main()
