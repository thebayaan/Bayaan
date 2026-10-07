#!/usr/bin/env python3
"""
Round-trip self-test of the KFGQPC -> DigitalKhatt conventions in normalize.py.

The official KFGQPC Hafs v2.0 text (sources/hafs.json, locked in
sources/sources.lock.json), converted with normalize.apply_conventions() plus
the two render rules that also apply to Hafs-style texts (sajdah overline,
dot below), must reproduce the DigitalKhatt Hafs words DB
(data/mushaf/digitalkhatt/digital-khatt-v2.db) word for word, except for the
DK-only encodings listed in KNOWN_RESIDUALS. Any other difference means a
convention mapping changed and fails the test (exit 1).

Usage: python3 scripts/rewayah/validate.py
"""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import normalize as N  # noqa: E402
from validate_rewayah_db import LOCK_FILE, sha256_file  # noqa: E402

REPO = HERE.parents[1]
HAFS_DB = REPO / "data" / "mushaf" / "digitalkhatt" / "digital-khatt-v2.db"
SOURCE = HERE / "sources" / "hafs.json"

# verse -> reason. DK encodes these words differently from KFGQPC; the reading
# is the same.
KNOWN_RESIDUALS = {
    "2:72": "DK writes a CGJ before the hamza of fa-ddara'tum; KFGQPC a hamza on the line",
    "2:97": "KFGQPC writes a tatweel after the lam of li-jibrila",
    "17:7": "DK adds CGJ + small high waw + madda before the hamza seat",
    "52:37": "DK small LOW seen (U+06E3), KFGQPC small high seen (U+06DC) drawn below by its font",
    "69:28": "DK CGJ between sukun and the sakta seen",
    "75:27": "DK CGJ between sukun and the sakta seen",
    "83:14": "DK CGJ between sukun and the sakta seen",
    # hamza with kasra on a ya / waw seat: DK seat + hamza above + kasra,
    # KFGQPC seat + kasra + hamza below
    **{
        v: "hamza with kasra on a seat: DK hamza above + kasra, KFGQPC kasra + hamza below"
        for v in (
            "10:15", "16:90", "20:130", "24:11", "28:30", "30:8", "30:16", "35:43",
            "42:51", "52:21", "56:23", "70:38", "74:52", "80:37",
        )
    },
    # word boundaries: DK splits / joins differently (the builder handles them)
    "15:7": "DK writes two words, KFGQPC one",
    "27:20": "DK writes two words, KFGQPC one",
    "36:22": "DK writes two words, KFGQPC one",
    "37:130": "DK keeps 'il yasin' in one slot with a space",
}


def main() -> int:
    import json

    lock = json.loads(LOCK_FILE.read_text(encoding="utf-8"))
    if sha256_file(SOURCE) != lock["sources"]["hafs"]["sha256"]:
        print(f"FAIL {SOURCE.name} does not match {LOCK_FILE.name}")
        return 1
    rules = [r for r in N.RENDER_POLICY if r.id in ("sajdah-overline", "dot-below")]

    def convert(tok: str) -> str:
        for r in rules:
            tok = r.apply(tok)
        return N.apply_conventions(tok)

    con = sqlite3.connect(f"file:{HAFS_DB}?mode=ro", uri=True)
    dk: dict[tuple[int, int], list[str]] = {}
    for s, a, t in con.execute("SELECT surah, ayah, text FROM words ORDER BY id"):
        if not N.is_marker(t):
            dk.setdefault((s, a), []).append(t)
    con.close()

    total = same = 0
    residual_verses: set[str] = set()
    unexpected: list[str] = []
    for v in N.load_source(SOURCE):
        key = f"{v.surah}:{v.ayah}"
        a = dk[(v.surah, v.ayah)]
        b = [convert(t) for t in v.tokens]
        if len(a) != len(b) or a != b:
            residual_verses.add(key)
            if key not in KNOWN_RESIDUALS:
                unexpected.append(f"{key}: DK {' '.join(a)!r} vs KFGQPC {' '.join(b)!r}")
        for x, y in zip(a, b):
            total += 1
            same += x == y
    stale = sorted(set(KNOWN_RESIDUALS) - residual_verses)
    print(f"Hafs round trip: {same}/{total} words identical; {len(residual_verses)} verses with known DK-only encodings")
    for u in unexpected:
        print(f"FAIL unexpected difference {u}")
    for k in stale:
        print(f"FAIL KNOWN_RESIDUALS entry {k} no longer differs; remove it")
    if unexpected or stale:
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
