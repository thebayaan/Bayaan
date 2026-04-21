"""
Validate that normalize.normalize_verse() applied to KFGQPC Hafs JSON
produces text that byte-matches Bayaan's dk_words.db on a per-verse basis.

Reports:
  - round-trip match rate
  - per-verse character-level deltas for the first N mismatches
  - codepoint frequency of residual deltas (helps find missed mapping rules)
"""
from __future__ import annotations

import json
import sqlite3
from collections import Counter, defaultdict
from pathlib import Path

from normalize import normalize_verse

HERE = Path(__file__).parent
REPO = HERE.parents[1]
BAYAAN_DB = REPO / "data" / "mushaf" / "digitalkhatt" / "digital-khatt-v2.db"
KFGQPC_HAFS = HERE / "hafs.json"

MAX_SAMPLES = 10


def load_bayaan_verses() -> dict[tuple[int, int], str]:
    conn = sqlite3.connect(BAYAAN_DB)
    cur = conn.cursor()
    verses: dict[tuple[int, int], list[tuple[int, str]]] = defaultdict(list)
    for surah, ayah, word, text in cur.execute(
        "SELECT surah, ayah, word, text FROM words ORDER BY surah, ayah, word"
    ):
        verses[(surah, ayah)].append((word, text))
    conn.close()
    return {
        key: " ".join(t for _, t in sorted(words))
        for key, words in verses.items()
    }


def char_deltas(a: str, b: str) -> list[tuple[int, str, str]]:
    out = []
    la, lb = len(a), len(b)
    i = j = 0
    while i < la and j < lb:
        if a[i] == b[j]:
            i += 1
            j += 1
        else:
            out.append((i, a[i], b[j]))
            i += 1
            j += 1
    for k in range(i, la):
        out.append((k, a[k], ""))
    for k in range(j, lb):
        out.append((k, "", b[k]))
    return out


def main() -> None:
    bayaan = load_bayaan_verses()
    kfgqpc = json.loads(KFGQPC_HAFS.read_text(encoding="utf-8"))
    kfgqpc_by_key = {(row["sora"], row["aya_no"]): row["aya_text"] for row in kfgqpc}

    total = 0
    matches = 0
    mismatches = 0
    samples: list[tuple[tuple[int, int], str, str]] = []
    residual_cps: Counter[tuple[str, str]] = Counter()

    for key, bayaan_text in bayaan.items():
        kf = kfgqpc_by_key.get(key)
        if kf is None:
            continue
        total += 1
        normalized = normalize_verse(kf)
        if normalized == bayaan_text:
            matches += 1
        else:
            mismatches += 1
            if len(samples) < MAX_SAMPLES:
                samples.append((key, bayaan_text, normalized))
            for _, a, b in char_deltas(bayaan_text, normalized):
                residual_cps[(a, b)] += 1

    print(f"Verses compared: {total}")
    print(f"  Round-trip match:     {matches}  ({matches / total * 100:.2f}%)")
    print(f"  Residual mismatches:  {mismatches}")

    if samples:
        print(f"\n=== First {len(samples)} mismatches ===")
        for key, a, b in samples:
            print(f"\n  {key[0]}:{key[1]}")
            print(f"    bayaan:     {a}")
            print(f"    normalized: {b}")
            deltas = char_deltas(a, b)[:6]
            if deltas:
                print(f"    deltas (first 6):")
                for idx, x, y in deltas:
                    def fmt(c: str) -> str:
                        if not c:
                            return "[]"
                        return f"{c!r} U+{ord(c):04X}"
                    print(f"      @{idx}  bayaan={fmt(x)}  normalized={fmt(y)}")

    print("\n=== Residual codepoint delta frequency (top 20) ===")
    for (a, b), count in residual_cps.most_common(20):
        def name(c: str) -> str:
            import unicodedata
            if not c:
                return "(none)"
            try:
                return f"U+{ord(c):04X} {unicodedata.name(c)}"
            except ValueError:
                return f"U+{ord(c):04X} (unknown)"
        print(f"  {count:>6}  bayaan={name(a):<50}  normalized={name(b)}")


if __name__ == "__main__":
    main()
