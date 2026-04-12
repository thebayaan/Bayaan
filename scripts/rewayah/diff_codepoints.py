"""
Diff every Hafs verse between Bayaan's dk_words.db and KFGQPC's hafsData_v18.json
to discover the set of codepoint substitutions and tokenization rules needed to
normalize KFGQPC -> Bayaan conventions.

Outputs a frequency-sorted table of codepoint-level differences across all verses.
"""
from __future__ import annotations

import json
import sqlite3
import unicodedata
from collections import Counter
from pathlib import Path

HERE = Path(__file__).parent
REPO = HERE.parents[1]
KFGQPC_HAFS = HERE / "hafs.json"
BAYAAN_DB = REPO / "data" / "mushaf" / "digitalkhatt" / "digital-khatt-v2.db"


def load_bayaan_verses() -> dict[tuple[int, int], str]:
    conn = sqlite3.connect(BAYAAN_DB)
    cur = conn.cursor()
    verses: dict[tuple[int, int], list[tuple[int, str]]] = {}
    for surah, ayah, word, text in cur.execute(
        "SELECT surah, ayah, word, text FROM words ORDER BY surah, ayah, word"
    ):
        verses.setdefault((surah, ayah), []).append((word, text))
    conn.close()
    out = {}
    for key, words in verses.items():
        words.sort()
        out[key] = " ".join(t for _, t in words)
    return out


def load_kfgqpc_hafs() -> dict[tuple[int, int], str]:
    data = json.loads(KFGQPC_HAFS.read_text(encoding="utf-8"))
    return {(row["sora"], row["aya_no"]): row["aya_text"] for row in data}


def codepoint_histogram(text: str) -> Counter[int]:
    return Counter(ord(c) for c in text if not c.isspace())


def name(cp: int) -> str:
    try:
        return unicodedata.name(chr(cp))
    except ValueError:
        return f"U+{cp:04X} (unknown)"


def main() -> None:
    bayaan = load_bayaan_verses()
    kfgqpc = load_kfgqpc_hafs()

    shared = set(bayaan) & set(kfgqpc)
    print(f"Bayaan verses: {len(bayaan)}")
    print(f"KFGQPC verses: {len(kfgqpc)}")
    print(f"Shared keys:   {len(shared)}")

    bayaan_cps: Counter[int] = Counter()
    kfgqpc_cps: Counter[int] = Counter()
    for key in shared:
        bayaan_cps.update(codepoint_histogram(bayaan[key]))
        kfgqpc_cps.update(codepoint_histogram(kfgqpc[key]))

    only_bayaan = set(bayaan_cps) - set(kfgqpc_cps)
    only_kfgqpc = set(kfgqpc_cps) - set(bayaan_cps)
    common = set(bayaan_cps) & set(kfgqpc_cps)

    print("\n=== Codepoints only in Bayaan ===")
    for cp in sorted(only_bayaan, key=lambda c: -bayaan_cps[c]):
        print(f"  U+{cp:04X} {chr(cp)!r:>5}  {bayaan_cps[cp]:>7}  {name(cp)}")

    print("\n=== Codepoints only in KFGQPC Hafs ===")
    for cp in sorted(only_kfgqpc, key=lambda c: -kfgqpc_cps[c]):
        print(f"  U+{cp:04X} {chr(cp)!r:>5}  {kfgqpc_cps[cp]:>7}  {name(cp)}")

    print("\n=== Codepoints in both, frequency skew (|delta| > 100) ===")
    skewed = []
    for cp in common:
        b = bayaan_cps[cp]
        k = kfgqpc_cps[cp]
        if abs(b - k) > 100:
            skewed.append((cp, b, k))
    skewed.sort(key=lambda x: -abs(x[1] - x[2]))
    for cp, b, k in skewed[:40]:
        print(f"  U+{cp:04X} {chr(cp)!r:>5}  bayaan={b:>7}  kfgqpc={k:>7}  delta={b-k:+}  {name(cp)}")


if __name__ == "__main__":
    main()
