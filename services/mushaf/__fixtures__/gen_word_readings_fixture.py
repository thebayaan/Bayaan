#!/usr/bin/env python3
# @ai-generated
"""
Generates wordReadingsFixture.json for services/mushaf/__tests__/wordReadingsFormat.test.ts.

The fixture holds the index's info and the stored rows of dk_readings.db for
a few words that exercise every part of the format, and NEXT to each row the
readings EXPECTED for that word, computed here independently of the index
(and of scripts/rewayah/build_readings_index.py) from the words DBs, the
highlight maps and the reviewed files:

  members  Hafs, Shu'bah, al-Bazzi, Qunbul, Warsh, Qalun, al-Duri, al-Susi
  span     the listed slots (two where a rewayah writes them as one word);
           a member's text is its non-blank slot texts joined by a space,
           inline verse markers removed
  groups   asHafs: Hafs and every member without a whole-word tint on the
           span; notRead: blank members; differs: the tinted ones, split as
           reading_groups_cases.json says for that span, or one group when
           they all store the same words (any other span is refused here).
           A misprint of reading_upstream_issues.json sits in its sibling's
           group and is questioned
  details  ownText for a differing member whose text is not its group's
           (the group's first member that is not a misprint) and for any
           member with silah; silahChars from the diff, offset across the
           span; verseEnd from the marker slots (own number where only it
           ends a verse after the span, 0 where only Hafs does); wordCount
           for an asHafs member writing another number of words than Hafs;
           basmalaUnnumberedIn: at 1:1, members whose 1:1 marker slot is blank

Usage (inputs are read-only):
  python3 -I gen_word_readings_fixture.py --db-dir data/mushaf/digitalkhatt \\
      --rewayah-dir scripts/rewayah --out wordReadingsFixture.json
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
from pathlib import Path

MEMBERS = [
    ("hafs", "hafs", "digital-khatt-v2.db"),
    ("shubah", "shouba", "dk_words_shouba.db"),
    ("al-bazzi", "bazzi", "dk_words_bazzi.db"),
    ("qunbul", "qumbul", "dk_words_qumbul.db"),
    ("warsh", "warsh", "dk_words_warsh.db"),
    ("qalun", "qaloon", "dk_words_qaloon.db"),
    ("al-duri-abi-amr", "doori", "dk_words_doori.db"),
    ("al-susi", "soosi", "dk_words_soosi.db"),
]
CATEGORY = {"shouba": "major", "bazzi": "major", "qumbul": "major"}  # else mukhtalif
SIBLING = {"warsh": "qaloon", "qaloon": "warsh", "doori": "soosi", "soosi": "doori", "bazzi": "qumbul", "qumbul": "bazzi"}
# (Hafs verse, DK positions of the span): the words the format test decodes.
WORDS = [
    ("1:1", [1]), ("1:1", [4]), ("1:4", [1]), ("1:7", [4]), ("2:1", [1]), ("2:9", [6]),
    ("2:54", [16]), ("2:67", [7]), ("2:85", [18]), ("3:66", [1]), ("9:100", [17]),
    ("10:35", [22]), ("12:12", [4]), ("15:7", [1, 2]), ("17:62", [1]), ("27:20", [4, 5]),
    ("37:130", [3]), ("40:26", [13, 14]), ("57:24", [10]), ("72:16", [1]),
    ("73:20", [21, 22]), ("75:1", [1, 2]),
    # no rows: the two DK slots of the word-by-word بَعْدَ مَا
    ("2:181", [3]), ("2:181", [4]),
]
MARKER = re.compile(r"^۝([٠-٩]+)$")


def marker_number(token: str) -> int | None:
    m = MARKER.match(token)
    return int("".join(str(ord(c) - 0x0660) for c in m.group(1))) if m else None


def read_words(path: Path) -> dict[str, tuple[int, str]]:
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        return {loc: (wid, text) for wid, loc, text in con.execute("SELECT id, location, text FROM words")}
    finally:
        con.close()


def split(text: str) -> tuple[str, int | None]:
    """Stored slot text -> (words without an inline marker, inline number)."""
    tokens = text.split(" ") if text else []
    if tokens and marker_number(tokens[-1]) is not None:
        return " ".join(tokens[:-1]), marker_number(tokens[-1])
    return " ".join(tokens), None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db-dir", type=Path, required=True)
    ap.add_argument("--rewayah-dir", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    a = ap.parse_args()

    words = {fid: read_words(a.db_dir / db) for _, fid, db in MEMBERS}
    by_id = {fid: {wid: text for wid, text in w.values()} for fid, w in words.items()}
    tint: dict[str, set[str]] = {}
    silah: dict[str, dict[str, list[int]]] = {}
    for _, fid, _ in MEMBERS[1:]:
        doc = json.loads((a.db_dir / f"{fid}-diff.json").read_text(encoding="utf-8"))
        tint[fid], silah[fid] = set(), {}
        for key, cats in doc.items():
            if key == "__format":
                continue
            for cat, entries in cats.items():
                for pos, chars in entries:
                    if cat == "silah":
                        silah[fid][f"{key}:{pos}"] = chars
                    else:
                        tint[fid].add(f"{key}:{pos}")
    issues = json.loads((a.rewayah_dir / "reading_upstream_issues.json").read_text(encoding="utf-8"))["issues"]
    cases = json.loads((a.rewayah_dir / "reading_groups_cases.json").read_text(encoding="utf-8"))
    reviewed = {loc: groups for sec in ("groups", "toConfirm") for e in cases[sec] for loc, groups in e["spans"].items()}

    con = sqlite3.connect(f"file:{a.db_dir / 'dk_readings.db'}?mode=ro", uri=True)
    info = dict(con.execute("SELECT key, value FROM info"))
    rows = {(vk, pos): (wid, data) for vk, pos, wid, data in con.execute("SELECT verse_key, position, word_id, data FROM slots")}
    con.close()

    out_words = []
    for verse_key, positions in WORDS:
        locs = [f"{verse_key}:{p}" for p in positions]
        ids = [words["hafs"][loc][0] for loc in locs]
        after = ids[-1] + 1  # the row after the span: a Hafs marker slot when Hafs ends the verse here
        hafs_ends = marker_number(by_id["hafs"].get(after, "")) is not None
        member = {}
        for app_id, fid, _ in MEMBERS:
            parts, inline, chars, offset = [], None, [], 0
            for loc in locs:
                text, number = split(words[fid][loc][1])
                if number is not None:
                    inline = number
                if not text:
                    continue
                chars += [offset + c for c in silah.get(fid, {}).get(loc, [])]
                parts.append(text)
                offset += len(text) + 1
            text = " ".join(parts)
            verse_end = None
            if fid != "hafs" and text:
                ends = inline is not None or (hafs_ends and by_id[fid][after] != "")
                if ends and not hafs_ends:
                    verse_end = inline
                elif hafs_ends and not ends:
                    verse_end = 0
            member[fid] = {
                "app": app_id,
                "text": text,
                "tinted": any(loc in tint.get(fid, ()) for loc in locs),
                "silah": chars,
                "verseEnd": verse_end,
            }
        folded = {i["rid"]: i["sibling"] for i in issues if i["location"] in locs}
        fids = [fid for _, fid, _ in MEMBERS]
        as_hafs = ["hafs"] + [f for f in fids[1:] if member[f]["text"] and not member[f]["tinted"] and f not in folded]
        not_read = [f for f in fids[1:] if not member[f]["text"]]
        differ = [f for f in fids[1:] if member[f]["text"] and member[f]["tinted"] and f not in folded]
        first_loc = locs[0]
        if first_loc in reviewed:
            want = [g for g in reviewed[first_loc] if not set(g) & {"hafs"} and not set(g) <= set(not_read)]
            d_groups = [[f for f in g if f in differ] for g in want]
            d_groups = [g for g in d_groups if g]
        elif len({member[f]["text"] for f in differ}) <= 1:
            d_groups = [differ] if differ else []
        else:
            raise SystemExit(f"{first_loc}: differing texts not pinned in reading_groups_cases.json")
        assert sorted(f for g in d_groups for f in g) == sorted(differ), first_loc
        groups = [["h", as_hafs]] + [["d", g] for g in d_groups] + ([["o", not_read]] if not_read else [])
        for f, sib in folded.items():
            next(g for _, g in groups if sib in g).append(f)
        for _, g in groups:
            g.sort(key=fids.index)
        hafs_text = member["hafs"]["text"]
        expected_groups = []
        for kind, g in groups:
            text = hafs_text if kind == "h" else "" if kind == "o" else member[[f for f in g if f not in folded][0]]["text"]
            ms = []
            for f in g:
                m = member[f]
                own = None
                if f != "hafs" and kind != "o" and f not in folded and (m["silah"] or (kind == "d" and m["text"] != text)):
                    own = m["text"]
                count = len(m["text"].split(" "))
                ms.append({
                    "rewayah": m["app"],
                    "ownText": own,
                    "category": (CATEGORY.get(f, "mukhtalif") if kind == "d" else None),
                    "silahChars": m["silah"] if own is not None else [],
                    "verseEnd": m["verseEnd"],
                    "wordCount": count if kind == "h" and f != "hafs" and count != len(hafs_text.split(" ")) else None,
                    "questioned": f in folded,
                })
            expected_groups.append({"kind": {"h": "asHafs", "d": "differs", "o": "notRead"}[kind], "text": text, "members": ms})
        basmala = []
        if verse_key == "1:1":
            basmala = [member[f]["app"] for f in fids[1:] if by_id[f][words["hafs"]["1:1:5"][0]] == ""]
        alike = len(expected_groups) == 1 and not basmala and all(
            m["ownText"] is None and m["verseEnd"] is None and m["wordCount"] is None for m in expected_groups[0]["members"]
        )
        for p, wid in zip(positions, ids):
            stored = rows.get((verse_key, p))
            out_words.append({
                "verseKey": verse_key,
                "position": p,
                "wordId": wid,
                "data": stored[1] if stored else None,
                "expected": {
                    "verseKey": verse_key,
                    "positions": positions,
                    "hafsText": hafs_text,
                    "groups": expected_groups,
                    "alike": alike,
                    "basmalaUnnumberedIn": basmala,
                },
            })
    doc = {
        "__doc": "Generated by gen_word_readings_fixture.py; do not edit. Expected readings computed from the words DBs, diffs and reviewed files, not from the index.",
        "info": [{"key": k, "value": info[k]} for k in sorted(info)],
        "words": out_words,
    }
    a.out.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
