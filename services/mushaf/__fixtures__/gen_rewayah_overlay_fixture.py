#!/usr/bin/env python3
"""
Generates rewayahOverlayFixture.json for the span-model / overlay jest tests
(services/mushaf/__tests__/*.test.ts, loaded through rewayahOverlayFixture.ts).

The fixture holds real slot texts for a handful of mushaf pages in several
words DBs (Hafs, Shu'bah and Release-1 "slot model" rewayah DBs), the shared
layout rows, Hafs QPC tajweed segments for those verses, sample diff files in
the legacy and the format-2 shape, and the EXPECTED line layout computed here
independently of the TypeScript code:

  line text = non-blank slot texts joined by single U+0020 (a blank slot
              takes no room and adds no separator; a slot containing spaces
              is one unit)
  span      = [wordId, start, end, wordEnd] in UTF-16 units, inclusive;
              wordEnd excludes a trailing inline verse marker ' ۝N'.
              Stored compactly as "spans": [wordId, start, wordEnd, ...]
              (end = start + slot length - 1)
  segments  = consecutive spans grouped by Hafs verse key
              [verseKey, start, end, firstWordId, lastWordId]

Usage (all inputs are read-only):
  python3 gen_rewayah_overlay_fixture.py \
      --hafs-db data/mushaf/digitalkhatt/digital-khatt-v2.db \
      --layout-db data/mushaf/digitalkhatt/digital-khatt-15-lines.db \
      --shouba-db data/mushaf/digitalkhatt/dk_words_shouba.db \
      --rewayah-dir <dir with dk_words_<id>.db and <id>-diff.json> \
      --tajweed-json "data/QPC Hafs Tajweed 2.json" \
      --out services/mushaf/__fixtures__/rewayahOverlayFixture.json
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
from pathlib import Path

# Pages chosen to cover: page 1 (Fatiha, blank 1:1:5 and inline '۝٦' in the
# Madani/Basri DBs), blank slots mid-line (2, 34), rub' el-hizb prefixes (4),
# inline markers followed by more words (34, 166), a whole-word variant on an
# inline-marker slot (166, 7:137), multi-token slots (203: 9:100:17,
# 451: 37:130:3 incl. Hafs/Shu'bah, 573: 72:16:1).
PAGES = [1, 2, 4, 34, 166, 203, 451, 573]
REWAYAT = ["warsh", "qaloon", "bazzi", "qumbul", "doori", "soosi"]

TRAILING_MARKER = re.compile(r"(?:^| )\u06DD[\u0660-\u0669\u06F0-\u06F9]+$")
SILAH = ("\u06E5", "\u06E6")
PRECEDING_VOWELS = ("\u064F", "\u0650")
TAG = re.compile(r'<rule class="?([a-z_-]+)"?[^>]*>|</rule>')


def u16(s: str) -> int:
    return len(s.encode("utf-16-le")) // 2


def whole_len(text: str) -> int:
    m = TRAILING_MARKER.search(text)
    return u16(text[: m.start()]) if m else u16(text)


def layout_line(ids: list[int], text_of) -> tuple[str, list[list[int]]]:
    parts: list[str] = []
    spans: list[list[int]] = []
    offset = 0
    for wid in ids:
        t = text_of(wid)
        if not t:
            continue
        if parts:
            offset += 1
        n = u16(t)
        spans.append([wid, offset, offset + n - 1, offset + whole_len(t) - 1])
        parts.append(t)
        offset += n
    return " ".join(parts), spans


def segments(spans, loc_of) -> list[list]:
    out: list[list] = []
    for wid, start, end, _ in spans:
        vk = ":".join(loc_of(wid).split(":")[:2])
        if out and out[-1][0] == vk:
            out[-1][2] = end
            out[-1][4] = wid
        else:
            out.append([vk, start, end, wid, wid])
    return out


def parse_tajweed(text: str) -> list[dict]:
    """Same segmentation as utils/tajweedLoader.processTajweedWord."""
    segs: list[dict] = []
    stack: list[str] = []
    i = 0
    while i < len(text):
        m = TAG.search(text, i)
        nxt = m.start() if m else len(text)
        if nxt > i:
            segs.append({"text": text[i:nxt], "rule": stack[-1] if stack else None})
        if not m:
            break
        if m.group(1):
            stack.append(m.group(1))
        elif stack:
            stack.pop()
        i = m.end()
    return segs


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--hafs-db", type=Path, required=True)
    ap.add_argument("--layout-db", type=Path, required=True)
    ap.add_argument("--shouba-db", type=Path, required=True)
    ap.add_argument("--rewayah-dir", type=Path, required=True)
    ap.add_argument("--tajweed-json", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    a = ap.parse_args()

    layout = sqlite3.connect(a.layout_db)
    hafs_rows = {
        r[0]: (r[1], r[2])
        for r in sqlite3.connect(a.hafs_db).execute(
            "SELECT id, location, text FROM words ORDER BY id"
        )
    }

    def db_texts(path: Path) -> dict[int, str]:
        rows = sqlite3.connect(path).execute(
            "SELECT id, location, text FROM words ORDER BY id"
        ).fetchall()
        assert len(rows) == len(hafs_rows), f"{path}: row count differs from Hafs"
        out = {}
        for wid, loc, text in rows:
            assert hafs_rows[wid][0] == loc, f"{path}: location differs at id {wid}"
            out[wid] = text
        return out

    texts = {"hafs": {k: v[1] for k, v in hafs_rows.items()}}
    texts["shouba"] = db_texts(a.shouba_db)
    for rid in REWAYAT:
        texts[rid] = db_texts(a.rewayah_dir / f"dk_words_{rid}.db")

    pages = []
    verse_keys: set[str] = set()
    for page in PAGES:
        rows = layout.execute(
            "SELECT page_number, line_number, line_type, is_centered, first_word_id,"
            " last_word_id, surah_number FROM pages WHERE page_number=? ORDER BY line_number",
            (page,),
        ).fetchall()
        ayah = [r for r in rows if r[2] == "ayah"]
        first_id = min(r[4] for r in ayah)
        last_id = max(r[5] for r in ayah)
        ids = list(range(first_id, last_id + 1))
        for wid in ids:
            verse_keys.add(":".join(hafs_rows[wid][0].split(":")[:2]))
        page_entry = {
            "page": page,
            "firstWordId": first_id,
            "lastWordId": last_id,
            # [line_number, line_type, is_centered, first_word_id, last_word_id, surah_number]
            "lines": [list(r[1:]) for r in rows],
            "locations": [hafs_rows[w][0] for w in ids],
            "texts": {rid: [texts[rid][w] for w in ids] for rid in texts},
            "expected": {},
        }
        for rid in texts:
            exp_lines = []
            for line_index, r in enumerate(rows):
                if r[2] != "ayah":
                    continue
                text, spans = layout_line(
                    list(range(r[4], r[5] + 1)), lambda w, rid=rid: texts[rid][w]
                )
                exp_lines.append(
                    {
                        "lineIndex": line_index,
                        "textLength": u16(text),
                        "spans": [v for wid, st, _end, we in spans for v in (wid, st, we)],
                        "segments": segments(spans, lambda w: hafs_rows[w][0]),
                    }
                )
            page_entry["expected"][rid] = exp_lines
        pages.append(page_entry)

    # Hafs QPC tajweed segments for every verse on the fixture pages.
    raw_tajweed = json.loads(a.tajweed_json.read_text(encoding="utf-8"))
    tajweed: dict[str, list] = {}
    for word in raw_tajweed.values():
        vk = ":".join(word["location"].split(":")[:2])
        if vk in verse_keys:
            tajweed.setdefault(vk, []).append(
                {
                    "word_index": word["word_index"],
                    "location": word["location"],
                    "segments": parse_tajweed(word["text"]),
                }
            )
    for words in tajweed.values():
        words.sort(key=lambda w: w["word_index"])

    # Diff samples restricted to the fixture verses.
    def diff_subset(rid: str) -> dict:
        d = json.loads((a.rewayah_dir / f"{rid}-diff.json").read_text(encoding="utf-8"))
        return {k: v for k, v in d.items() if k in verse_keys}

    def silah_entries(rid: str) -> dict[str, list]:
        """Format-2 style 'silah': only slots that carry more silah marks than
        the Hafs slot; indices = each mark + the damma/kasra before it."""
        out: dict[str, list] = {}
        for page in pages:
            for i, wid in enumerate(range(page["firstWordId"], page["lastWordId"] + 1)):
                text = page["texts"][rid][i]
                hafs_text = page["texts"]["hafs"][i]
                if not text:
                    continue
                m = TRAILING_MARKER.search(text)
                whole = text[: m.start()] if m else text
                if sum(whole.count(c) for c in SILAH) <= sum(hafs_text.count(c) for c in SILAH):
                    continue
                idx: list[int] = []
                unit = 0  # UTF-16 offset of `ch`
                prev = ""
                for ch in whole:
                    if ch in SILAH:
                        if prev in PRECEDING_VOWELS:
                            idx.append(unit - 1)
                        idx.append(unit)
                    prev = ch
                    unit += u16(ch)
                loc = page["locations"][i].split(":")
                out.setdefault(f"{loc[0]}:{loc[1]}", []).append([int(loc[2]), idx])
        return out

    def format2(rid: str, whole_word_category: str) -> dict:
        legacy = diff_subset(rid)
        out: dict = {"__format": 2}
        for vk, cats in legacy.items():
            entries = cats.get(whole_word_category) if isinstance(cats, dict) else None
            if entries:
                out.setdefault(vk, {})[whole_word_category] = [[w, []] for w, _ in entries]
        for vk, entries in silah_entries(rid).items():
            out.setdefault(vk, {})["silah"] = entries
        return out

    fixture = {
        "_about": (
            "Generated by gen_rewayah_overlay_fixture.py from the Hafs words DB, "
            "the shared 15-line layout DB, the Shu'bah DB and Release-1 slot-model "
            "rewayah DBs. Expected spans/segments are computed by the generator, "
            "independently of the TypeScript code under test."
        ),
        "pages": pages,
        "tajweed": tajweed,
        "diffs": {
            "legacy": {"warsh": diff_subset("warsh"), "bazzi": diff_subset("bazzi")},
            "format2": {
                "warsh": format2("warsh", "mukhtalif"),
                "bazzi": format2("bazzi", "major"),
                "soosi": format2("soosi", "mukhtalif"),
            },
        },
    }
    a.out.write_text(
        json.dumps(fixture, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {a.out} ({a.out.stat().st_size} bytes, {len(pages)} pages, "
          f"{len(texts)} DBs, {len(tajweed)} tajweed verses)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
