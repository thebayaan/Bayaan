"""
Check how many of the round-trip residual verses also differ between
KFGQPC Hafs and KFGQPC Shouba. Those are the ones that would actually
be touched by the patch operation.
"""
from __future__ import annotations

import json
import sqlite3
from collections import defaultdict
from pathlib import Path

from normalize import normalize_verse

HERE = Path(__file__).parent
REPO = HERE.parents[1]
BAYAAN_DB = REPO / "data" / "mushaf" / "digitalkhatt" / "digital-khatt-v2.db"


def load_bayaan() -> dict[tuple[int, int], str]:
    conn = sqlite3.connect(BAYAAN_DB)
    cur = conn.cursor()
    v: dict[tuple[int, int], list[tuple[int, str]]] = defaultdict(list)
    for surah, ayah, word, text in cur.execute(
        "SELECT surah, ayah, word, text FROM words ORDER BY surah, ayah, word"
    ):
        v[(surah, ayah)].append((word, text))
    conn.close()
    return {k: " ".join(t for _, t in sorted(ws)) for k, ws in v.items()}


def main() -> None:
    bayaan = load_bayaan()
    hafs = json.loads((HERE / "hafs.json").read_text(encoding="utf-8"))
    shouba = json.loads((HERE / "shouba.json").read_text(encoding="utf-8"))

    hafs_by_key = {(r["sora"], r["aya_no"]): r["aya_text"] for r in hafs}
    shouba_by_key = {(r["sura_no"], r["aya_no"]): r["aya_text"] for r in shouba}

    residual_keys = set()
    for key, bayaan_text in bayaan.items():
        kf = hafs_by_key.get(key)
        if kf is None:
            continue
        if normalize_verse(kf) != bayaan_text:
            residual_keys.add(key)

    shouba_diff_keys = set()
    for key, hafs_text in hafs_by_key.items():
        sh = shouba_by_key.get(key)
        if sh is None:
            continue
        if normalize_verse(hafs_text) != normalize_verse(sh):
            shouba_diff_keys.add(key)

    overlap = residual_keys & shouba_diff_keys

    print(f"Hafs round-trip residuals:       {len(residual_keys)}")
    print(f"Shouba differs from Hafs:        {len(shouba_diff_keys)}")
    print(f"Overlap (BOTH residual AND changed in Shouba): {len(overlap)}")
    print()

    if overlap:
        print("Verses in the overlap set (these would be patched AND have encoding quirks):")
        for key in sorted(overlap):
            print(f"  {key[0]}:{key[1]}")


if __name__ == "__main__":
    main()
