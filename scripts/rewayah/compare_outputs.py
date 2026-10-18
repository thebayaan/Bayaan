#!/usr/bin/env python3
"""
Compare freshly built rewayah outputs with the committed ones (drift check).

Usage: python3 scripts/rewayah/compare_outputs.py FRESH_DIR COMMITTED_DIR [rid ...]

<id>-diff.json, <id>-versemap.json and <id>-basmala.json must be
byte-identical. dk_words_<id>.db
must have the same schema and rows; its bytes are compared too when both
files were written by the same SQLite version (the header records it), since
other SQLite builds may lay out pages differently. Exit 1 on any difference.
"""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import normalize as N  # noqa: E402


def sqlite_version(path: Path) -> int:
    with open(path, "rb") as f:
        header = f.read(100)
    return int.from_bytes(header[96:100], "big")


def dump(path: Path) -> tuple[list, list]:
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        schema = con.execute("SELECT type, name, sql FROM sqlite_master ORDER BY name").fetchall()
        rows = con.execute("SELECT id, location, surah, ayah, word, text FROM words ORDER BY id").fetchall()
    finally:
        con.close()
    return schema, rows


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    fresh, committed = Path(argv[0]), Path(argv[1])
    rids = argv[2:] or list(N.REWAYAT)
    bad = 0
    for rid in rids:
        for name in (f"{rid}-diff.json", f"{rid}-versemap.json", f"{rid}-basmala.json"):
            a, b = fresh / name, committed / name
            if not b.exists() or a.read_bytes() != b.read_bytes():
                print(f"DIFF {name}: committed file is not what the builder produces")
                bad += 1
        name = f"dk_words_{rid}.db"
        a, b = fresh / name, committed / name
        if not b.exists():
            print(f"DIFF {name}: missing")
            bad += 1
            continue
        if dump(a) != dump(b):
            print(f"DIFF {name}: rows / schema differ from a fresh build")
            bad += 1
        elif sqlite_version(a) == sqlite_version(b) and a.read_bytes() != b.read_bytes():
            print(f"DIFF {name}: same rows and SQLite version but different bytes")
            bad += 1
    print("OK: committed outputs match a fresh build" if not bad else f"FAILED: {bad} difference(s)")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
