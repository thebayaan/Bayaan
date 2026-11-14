#!/usr/bin/env python3
# @ai-generated
"""
Per-word readings index: data/mushaf/digitalkhatt/dk_readings.db.

For every Hafs word slot, how each of the 8 bundled rewayat reads it: which
read it as Hafs does, which read it differently and which of those read it
like each other. Built only from the committed words DBs and highlight maps
(nothing is re-aligned), with the reviewed comparison rules of highlights.py.
The app shows it in the word view (WordReadingsSection).

Usage (from the repo root):
  python3 -B scripts/rewayah/build_readings_index.py            # build; replace the
                                       # committed index and review list if they changed
  python3 -B scripts/rewayah/build_readings_index.py --check    # rebuild, run the gates,
                                       # compare with the committed files (CI)
  python3 -B scripts/rewayah/build_readings_index.py --report   # print the review list
  python3 -B scripts/rewayah/build_readings_index.py --out PATH # write the index elsewhere

Model (docs/plans/2026-11-14-word-study/02-word-readings.md and its README):
  span     one Hafs content slot, or two where any rewayah writes them as one
           word (P3 in validate_rewayah_db.PLACEMENT_EVENTS: 15:7, 27:20,
           36:22, 40:26, 73:20, 75:1). A rewayah's span text is its non-blank
           slot texts joined by a space, inline verse markers removed. Both
           slots of a span get the same row.
  groups   in display order:
           'h' Hafs and every rewayah with no whole-word tint on the span in
               its <id>-diff.json (the reviewed highlight decision); its text
               is the Hafs text;
           'd' the tinted rewayat, in member order: each joins the group of
               the other narrator of its reader when they store the same
               words or read alike by the reviewed sibling rule, else the
               first 'd' group whose first member it reads_alike
               (highlights.py), else starts one; its text is its first
               member's stored text;
           'o' rewayat that do not read the word (a P2 blank: 57:24:10).
           The suspected KFGQPC misprints of reading_upstream_issues.json are
           read with their sibling narrator: placed in the sibling's group,
           never shown as text of their own (q).
  details  per member (m): x own text (a 'd' member whose text is not the
           group's, any member with silah), s silah chars from the diff
           (offset across a span), v its own verse number where it ends a
           verse after the span and Hafs does not, 0 where Hafs ends one and
           it does not, w its word count for an 'h' member that writes the
           span as more or fewer words than Hafs, q a misprint read with its
           sibling. u (1:1:1-4 only): members that do not number al-Fatiha's
           basmala.
  rows     only spans with something to show: two or more groups, a member
           detail, a two-slot span, or the basmala. A slot with no row reads
           the same way in all 8 rewayat at word level.

Schema and row JSON (format 1) are documented in
services/mushaf/wordReadingsFormat.ts, which decodes and checks them.

Gates (the build fails on any of them):
  G1 row identity: the 8 words DBs hold the same 83,668 rows (id, location,
     surah, ayah, word); slot grammar; diff JSONs are format 2 with only the
     whole-word category of their rewayah and silah, on non-blank slots
  G2 partition: every member in exactly one group; 'h' = Hafs + the
     untinted non-blank rewayat, 'd' = the tinted ones, 'o' = the P2 blanks,
     except that a listed misprint sits in its sibling's group
  G3 texts: every text of a row is the stored span text of a member (never
     synthesised): 'h' Hafs, 'd' its first member that is not a misprint,
     'o' '', x the member's own
  G4 silah: s equals the diff's silah entries (offset across a span), on
     U+06E5 / U+06E6 or the damma / kasra before one; every entry is used
  G5 completeness: a content slot without a row has no tint, no silah, no
     blank, the Hafs word count and the Hafs verse end, and is not in 1:1
  G6 the reviewed groupings in reading_groups_cases.json hold (groups and
     toConfirm)
  G7 every reading_upstream_issues.json entry still matches the stored,
     tinted text, and names the rewayah's sibling
  G8 determinism: two builds give the same rows; row JSON is canonical
     (sorted keys, compact, UTF-8)
--check also fails when the committed index or review list is not what the
build produces (rows and schema; bytes too when the same SQLite version
wrote both files, as compare_outputs.py does).
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sqlite3
import sys
import tempfile
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import highlights as HL  # noqa: E402
import normalize as N  # noqa: E402
from validate_rewayah_db import LOCK_FILE, PLACEMENT_EVENTS, sha256_file  # noqa: E402

REPO = HERE.parents[1]
DATA_DIR = REPO / "data" / "mushaf" / "digitalkhatt"
HAFS_DB = DATA_DIR / "digital-khatt-v2.db"
OUT_DB = DATA_DIR / "dk_readings.db"
CASES_FILE = HERE / "reading_groups_cases.json"
ISSUES_FILE = HERE / "reading_upstream_issues.json"
REVIEW_FILE = HERE / "reading_review.md"
BUILD_ROOT = HERE / ".build"  # git-ignored

READINGS_FORMAT = 1
EXPECTED_ROWS = 83668
# Member order = the app's ALL_REWAYAH_IDS order (services/rewayah/RewayahIdentity.ts).
MEMBERS = ("hafs", "shouba", "bazzi", "qumbul", "warsh", "qaloon", "doori", "soosi")
APP_IDS = {"hafs": "hafs", **N.APP_IDS}
NAMES = {
    "hafs": "Hafs",
    "shouba": "Shu'bah",
    "bazzi": "al-Bazzi",
    "qumbul": "Qunbul",
    "warsh": "Warsh",
    "qaloon": "Qalun",
    "doori": "al-Duri",
    "soosi": "al-Susi",
}
WHOLE_WORD = {rid: ("major" if rid in N.CLOSE else "mukhtalif") for rid in N.REWAYAT}
SIBLING = {a: b for pair in HL.SIBLING_PAIRS for a, b in (pair, pair[::-1])}
SILAH_MARKS = frozenset("ۥۦ")
SILAH_CARRIERS = frozenset("ُِ")
SCHEMA = (
    "CREATE TABLE info (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID",
    "CREATE TABLE slots (\n"
    "  verse_key TEXT NOT NULL,\n"
    "  position INTEGER NOT NULL,\n"
    "  word_id INTEGER NOT NULL,\n"
    "  data TEXT NOT NULL,\n"
    "  PRIMARY KEY (verse_key, position)\n"
    ") WITHOUT ROWID",
)


class GateError(Exception):
    """An input or output violates a gate; the message says which."""


def canonical_json(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def mi(rid: str) -> int:
    return MEMBERS.index(rid)


# ---------------------------------------------------------------------------
# Inputs
# ---------------------------------------------------------------------------


@dataclass
class Slot:
    """One Hafs content slot and what each rewayah stores in it."""

    index: int  # position in the content-slot list
    row: int  # index into the DB rows (id - 1)
    word_id: int
    location: str
    surah: int
    ayah: int
    word: int
    hafs: str
    words: dict[str, list[str]] = field(default_factory=dict)  # rid -> stored words (no marker)
    inline: dict[str, int] = field(default_factory=dict)  # rid -> inline verse number


@dataclass
class Inputs:
    rows: list[tuple[int, str, int, int, int]]  # id, location, surah, ayah, word
    texts: dict[str, list[str]]  # member -> text per row ("hafs" included)
    slots: list[Slot]
    tint: dict[str, set[str]]  # rid -> whole-word tinted locations
    silah: dict[str, dict[str, list[int]]]  # rid -> location -> char indices
    hashes: dict[str, str]  # input file name -> sha256
    basmala_lead: dict[str, dict[int, str]]  # rid -> surah -> first basmala word (DK)
    issues: list[dict]
    cases: dict


def _read_words(path: Path) -> tuple[list[tuple], str]:
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        objects = con.execute("SELECT type, name FROM sqlite_master ORDER BY name").fetchall()
        rows = con.execute("SELECT id, location, surah, ayah, word, text FROM words ORDER BY id").fetchall()
    finally:
        con.close()
    if objects != [("table", "words")]:
        raise GateError(f"G1 {path.name}: unexpected schema objects {objects}")
    return rows, path.name


def _split_slot(text: str, where: str) -> tuple[list[str], int | None]:
    """Stored slot text -> (words, inline verse number or None)."""
    if text == "":
        return [], None
    tokens = text.split(" ")
    if any(t == "" for t in tokens):
        raise GateError(f"G1 {where}: irregular spacing in {text!r}")
    inline = None
    if N.is_marker(tokens[-1]):
        inline = N.marker_number(tokens[-1])
        tokens = tokens[:-1]
    if not tokens or any(N.is_marker(t) for t in tokens):
        raise GateError(f"G1 {where}: a verse marker that does not end a word slot: {text!r}")
    if any(ord(c) > 0xFFFF for t in tokens for c in t):
        raise GateError(f"G1 {where}: a character outside the BMP (UTF-16 indices would differ)")
    return tokens, inline


def _load_diff(rid: str, slots_by_loc: dict[str, Slot]) -> tuple[set[str], dict[str, list[int]], str]:
    path = DATA_DIR / f"{rid}-diff.json"
    doc = json.loads(path.read_text(encoding="utf-8"))
    if doc.get("__format") != 2:
        raise GateError(f"G1 {path.name}: __format {doc.get('__format')!r} != 2")
    tint: set[str] = set()
    silah: dict[str, list[int]] = {}
    for key, cats in doc.items():
        if key == "__format":
            continue
        if not isinstance(cats, dict) or set(cats) - {WHOLE_WORD[rid], "silah"}:
            raise GateError(f"G1 {path.name} {key}: categories {sorted(cats)} (only {WHOLE_WORD[rid]}, silah)")
        for cat, entries in cats.items():
            for entry in entries:
                pos, chars = entry
                loc = f"{key}:{pos}"
                slot = slots_by_loc.get(loc)
                if slot is None or not slot.words[rid]:
                    raise GateError(f"G1 {path.name}: {cat} entry on {loc}, not a non-blank content slot")
                if cat == "silah":
                    if not chars or any(not isinstance(c, int) for c in chars) or loc in silah:
                        raise GateError(f"G1 {path.name}: bad silah entry {entry} at {loc}")
                    silah[loc] = list(chars)
                else:
                    if chars != [] or loc in tint:
                        raise GateError(f"G1 {path.name}: bad whole-word entry {entry} at {loc}")
                    tint.add(loc)
    return tint, silah, sha256_file(path)


def load_inputs() -> Inputs:
    hashes: dict[str, str] = {}
    hafs_rows, _ = _read_words(HAFS_DB)
    hashes[HAFS_DB.name] = sha256_file(HAFS_DB)
    if len(hafs_rows) != EXPECTED_ROWS or [r[0] for r in hafs_rows] != list(range(1, EXPECTED_ROWS + 1)):
        raise GateError(f"G1 {HAFS_DB.name}: expected ids 1..{EXPECTED_ROWS}")
    texts: dict[str, list[str]] = {"hafs": [r[5] for r in hafs_rows]}
    ident = [r[:5] for r in hafs_rows]
    for rid in MEMBERS[1:]:
        path = DATA_DIR / f"dk_words_{rid}.db"
        rows, _ = _read_words(path)
        if [r[:5] for r in rows] != ident:
            raise GateError(f"G1 {path.name}: rows differ from {HAFS_DB.name} (id, location, surah, ayah, word)")
        texts[rid] = [r[5] for r in rows]
        hashes[path.name] = sha256_file(path)

    slots: list[Slot] = []
    for k, (wid, loc, surah, ayah, word) in enumerate(ident):
        h = texts["hafs"][k]
        if N.is_marker(h):
            for rid in MEMBERS[1:]:
                t = texts[rid][k]
                if t != "" and not N.is_marker(t):
                    raise GateError(f"G1 {rid} {loc}: a Hafs marker slot holding words: {t!r}")
            continue
        hw, hi = _split_slot(h, f"hafs {loc}")
        if not hw or hi is not None:
            raise GateError(f"G1 hafs {loc}: blank slot or inline marker {h!r}")
        slot = Slot(len(slots), k, wid, loc, surah, ayah, word, h)
        for rid in MEMBERS[1:]:
            words, inline = _split_slot(texts[rid][k], f"{rid} {loc}")
            slot.words[rid] = words
            if inline is not None:
                slot.inline[rid] = inline
        slots.append(slot)
    slots_by_loc = {s.location: s for s in slots}

    tint: dict[str, set[str]] = {}
    silah: dict[str, dict[str, list[int]]] = {}
    for rid in MEMBERS[1:]:
        tint[rid], silah[rid], hashes[f"{rid}-diff.json"] = _load_diff(rid, slots_by_loc)

    lock = json.loads(LOCK_FILE.read_text(encoding="utf-8"))
    locked = lock.get("basmala", {})
    if not locked.get("sha256") or sha256_file(HERE / "sources" / locked["file"]) != locked["sha256"]:
        raise GateError(f"G1 sources/basmala.json does not match {LOCK_FILE.name}")
    basmala_lead = {
        rid: {s: N.basmala_dk_tokens(w, rid)[0] for s, w in N.load_basmala(rid).by_surah.items()}
        for rid in MEMBERS[1:]
    }
    issues = json.loads(ISSUES_FILE.read_text(encoding="utf-8")).get("issues", [])
    cases = json.loads(CASES_FILE.read_text(encoding="utf-8"))
    return Inputs([tuple(r) for r in ident], texts, slots, tint, silah, hashes, basmala_lead, issues, cases)


# ---------------------------------------------------------------------------
# Spans, sides and groups
# ---------------------------------------------------------------------------


def make_spans(inp: Inputs) -> list[tuple[int, int]]:
    """(first, last) content-slot indexes of every span, in reading order."""
    by_loc = {s.location: s for s in inp.slots}
    starts: set[int] = set()
    p2: dict[str, set[str]] = {}
    for rid in MEMBERS[1:]:
        for loc, event in PLACEMENT_EVENTS[rid].items():
            slot = by_loc.get(loc)
            if slot is None:
                raise GateError(f"G1 PLACEMENT_EVENTS {rid} {loc}: not a content slot")
            if event == "P3":
                nxt = inp.slots[slot.index + 1] if slot.index + 1 < len(inp.slots) else None
                if (
                    nxt is None
                    or (nxt.surah, nxt.ayah) != (slot.surah, slot.ayah)
                    or nxt.word_id != slot.word_id + 1
                    or nxt.words[rid]
                    or not slot.words[rid]
                ):
                    raise GateError(f"G1 {rid} P3 {loc}: not a word over two slots of one verse")
                starts.add(slot.index)
            elif event == "P2":
                if slot.words[rid]:
                    raise GateError(f"G1 {rid} P2 {loc}: the slot is not blank")
                p2.setdefault(loc, set()).add(rid)
    # every blank content slot is a declared P2 or the second slot of a P3
    for s in inp.slots:
        for rid in MEMBERS[1:]:
            if not s.words[rid] and rid not in p2.get(s.location, ()) and not (
                s.index - 1 in starts and PLACEMENT_EVENTS[rid].get(inp.slots[s.index - 1].location) == "P3"
            ):
                raise GateError(f"G1 {rid} {s.location}: blank slot not declared in PLACEMENT_EVENTS")
    spans: list[tuple[int, int]] = []
    i = 0
    while i < len(inp.slots):
        if i in starts:
            if i + 1 in starts:
                raise GateError(f"G1 overlapping spans at {inp.slots[i].location}")
            spans.append((i, i + 1))
            i += 2
        else:
            spans.append((i, i))
            i += 1
    return spans


class Neighbours:
    """The rewayah's word read before / after each content slot (blank slots
    and verse markers skipped, verse and surah ends crossed)."""

    def __init__(self, inp: Inputs) -> None:
        self.prev: dict[str, list[str]] = {}
        self.next: dict[str, list[str]] = {}
        n = len(inp.slots)
        for rid in MEMBERS[1:]:
            prev, nxt = [""] * n, [""] * n
            last = ""
            for s in inp.slots:
                prev[s.index] = last
                if s.words[rid]:
                    last = s.words[rid][-1]
            first = ""
            for s in reversed(inp.slots):
                nxt[s.index] = first
                if s.words[rid]:
                    first = s.words[rid][0]
            self.prev[rid], self.next[rid] = prev, nxt


@dataclass
class Member:
    rid: str
    text: str  # span text ('' blank)
    words: int  # word count
    tinted: bool
    silah: list[int]  # offset into text
    verse_end: int | None  # v, or None = as Hafs
    folded: bool = False


@dataclass
class Group:
    kind: str  # 'h' | 'd' | 'o'
    members: list[str]
    text: str


@dataclass
class SpanReadings:
    first: Slot
    last: Slot
    members: dict[str, Member]
    groups: list[Group]
    joins: list[tuple[str, str, str]]  # (joining rid, group's first rid, basis)
    basmala_unnumbered: list[str]

    @property
    def two_slots(self) -> bool:
        return self.first.index != self.last.index

    def group_of(self, rid: str) -> Group:
        return next(g for g in self.groups if rid in g.members)

    def own_text(self, rid: str) -> str | None:
        """x: the member's own text, shown under its group (a 'd' member whose
        text is not the group's, any member with silah); never a misprint's."""
        mem, g = self.members[rid], self.group_of(rid)
        if rid == "hafs" or g.kind == "o" or mem.folded:
            return None
        if mem.silah or (g.kind == "d" and mem.text != g.text):
            return mem.text
        return None


def _verse_end_detail(inp: Inputs, rid: str, span: list[Slot]) -> int | None:
    """v of `rid` after the span (see the module docstring), or None."""
    last = span[-1]
    after = last.row + 1
    hafs_ends = after < len(inp.rows) and N.is_marker(inp.texts["hafs"][after])
    non_blank = [s for s in span if s.words[rid]]
    inline = None
    for k, s in enumerate(non_blank):
        if rid in s.inline:
            if k != len(non_blank) - 1:
                raise GateError(f"G1 {rid} {s.location}: a verse ends inside a span")
            inline = s.inline[rid]
    if not non_blank:
        if hafs_ends or any(rid in s.inline for s in span):
            raise GateError(f"G1 {rid} {last.location}: a blank slot at a verse end")
        return None
    marker = inp.texts[rid][after] if hafs_ends else ""
    if inline is not None and marker:
        raise GateError(f"G1 {rid} {last.location}: two verse ends after one word")
    ends = inline is not None or bool(marker)
    if ends and not hafs_ends:
        return inline
    if hafs_ends and not ends:
        return 0
    return None


def _member(inp: Inputs, rid: str, span: list[Slot]) -> Member:
    text_parts: list[str] = []
    chars: list[int] = []
    offset = 0
    tinted = False
    for s in span:
        words = s.words[rid]
        if s.location in inp.tint[rid]:
            tinted = True
        if not words:
            if s.location in inp.silah[rid]:
                raise GateError(f"G1 {rid} {s.location}: silah on a blank slot")
            continue
        text = " ".join(words)
        chars.extend(offset + c for c in inp.silah[rid].get(s.location, []))
        text_parts.append(text)
        offset += len(text) + 1
    text = " ".join(text_parts)
    return Member(rid, text, len(text.split(" ")) if text else 0, tinted, chars, _verse_end_detail(inp, rid, span))


def build_span(inp: Inputs, nb: Neighbours, first: int, last: int, issues_at: dict[str, dict]) -> SpanReadings:
    span = inp.slots[first : last + 1]
    hafs_text = " ".join(s.hafs for s in span)
    members: dict[str, Member] = {"hafs": Member("hafs", hafs_text, len(hafs_text.split(" ")), False, [], None)}
    for rid in MEMBERS[1:]:
        members[rid] = _member(inp, rid, span)
    head = span[0]
    surah_start = head.index == 0 or inp.slots[head.index - 1].surah != head.surah
    tail = span[-1]
    surah_end = tail.index == len(inp.slots) - 1 or inp.slots[tail.index + 1].surah != tail.surah

    def side(rid: str) -> HL.Side:
        bas = inp.basmala_lead[rid].get(tail.surah + 1, "") if surah_end else ""
        return HL.Side(rid, members[rid].text, nb.prev[rid][head.index], nb.next[rid][tail.index], bas)

    # misprints read with their sibling (README decision)
    folded: dict[str, str] = {}
    for s in span:
        for issue in issues_at.get(s.location, {}).values():
            folded[issue["rid"]] = issue["sibling"]
    for rid in folded:
        members[rid].folded = True

    h = Group("h", ["hafs"], hafs_text)
    blank: list[str] = []
    differ: list[str] = []
    for rid in MEMBERS[1:]:
        m = members[rid]
        if not m.text:
            if not any(PLACEMENT_EVENTS[rid].get(s.location) == "P2" for s in span):
                raise GateError(f"G2 {rid} {head.location}: blank span that is not a declared P2")
            blank.append(rid)
        elif rid in folded:
            continue
        elif m.tinted:
            differ.append(rid)
        else:
            h.members.append(rid)
    groups: list[Group] = []
    joins: list[tuple[str, str, str]] = []
    for rid in differ:
        # A narrator joins the other narrator of his reader when they store the
        # same words or read alike by the reviewed sibling rule
        # (highlights.reads_like_sibling: the same reading key under the
        # sibling's rules, or al-Susi's final vowel merged by his idgham
        # kabir). Only these near-identities are followed: a join through any
        # other excuse could chain two excuses into a merge neither allows.
        partner = SIBLING.get(rid)
        home = next((g for g in groups if partner in g.members), None)
        if partner is not None and home is not None:
            basis = HL.alike_basis(side(partner), side(rid), surah_start)
            if basis in ("same", "sibling"):
                home.members.append(rid)
                joins.append((rid, partner, basis))
                continue
        for g in groups:
            basis = HL.alike_basis(side(g.members[0]), side(rid), surah_start)
            if basis is not None:
                g.members.append(rid)
                joins.append((rid, g.members[0], basis))
                break
        else:
            groups.append(Group("d", [rid], members[rid].text))
    all_groups = [h, *groups]
    for rid, sib in folded.items():
        if not members[rid].text or rid in blank:
            raise GateError(f"G7 {rid} {head.location}: a misprint entry on a blank span")
        if members[rid].silah:
            raise GateError(f"G7 {rid} {head.location}: a misprint entry with silah (its own text would show)")
        home = next((g for g in all_groups if sib in g.members), None)
        if home is None:
            raise GateError(f"G7 {rid} {head.location}: its sibling {sib} is not read here")
        home.members.append(rid)
    for g in all_groups:
        g.members.sort(key=mi)
    if blank:
        all_groups.append(Group("o", blank, ""))
    u: list[str] = []
    if (head.surah, head.ayah) == (1, 1):
        # the Hafs marker slot of 1:1 (row 1:1:5): blank where the basmala is unnumbered
        marker_row = next(k for k, r in enumerate(inp.rows) if r[1] == "1:1:5")
        u = [rid for rid in MEMBERS[1:] if inp.texts[rid][marker_row] == ""]
    return SpanReadings(head, tail, members, all_groups, joins, u)


def row_data(sr: SpanReadings) -> dict | None:
    """Row JSON (format 1) of a span, or None when it has nothing to show."""
    t: list[str] = []

    def ti(text: str) -> int:
        if text not in t:
            t.append(text)
        return t.index(text)

    hafs_count = sr.members["hafs"].words
    g = [[grp.kind, ti(grp.text), [mi(r) for r in grp.members]] for grp in sr.groups]
    kind_of = {r: grp.kind for grp in sr.groups for r in grp.members}
    m: dict[str, dict] = {}
    for rid in MEMBERS[1:]:
        mem = sr.members[rid]
        d: dict[str, object] = {}
        own = sr.own_text(rid)
        if own is not None:
            d["x"] = ti(own)
            if mem.silah:
                d["s"] = mem.silah
        if mem.verse_end is not None:
            d["v"] = mem.verse_end
        if kind_of[rid] == "h" and mem.words != hafs_count:
            d["w"] = mem.words
        if mem.folded:
            d["q"] = 1
        if d:
            m[str(mi(rid))] = d
    data: dict[str, object] = {"t": t, "g": g}
    if m:
        data["m"] = m
    if sr.two_slots:
        data["span"] = [sr.first.word_id, sr.last.word_id]
    if sr.basmala_unnumbered:
        data["u"] = [mi(r) for r in sr.basmala_unnumbered]
    if len(sr.groups) == 1 and not m and not sr.two_slots and not sr.basmala_unnumbered:
        return None
    return data


@dataclass
class Build:
    inputs: Inputs
    spans: list[SpanReadings]
    rows: list[tuple[str, int, int, str]]  # verse_key, position, word_id, data
    info: list[tuple[str, str]]


def build(inp: Inputs) -> Build:
    issues_at: dict[str, dict] = {}
    for issue in inp.issues:
        issues_at.setdefault(issue["location"], {})[issue["rid"]] = issue
    nb = Neighbours(inp)
    spans = [build_span(inp, nb, a, b, issues_at) for a, b in make_spans(inp)]
    rows: list[tuple[str, int, int, str]] = []
    for sr in spans:
        data = row_data(sr)
        if data is None:
            continue
        text = canonical_json(data)
        for s in inp.slots[sr.first.index : sr.last.index + 1]:
            rows.append((f"{s.surah}:{s.ayah}", s.word, s.word_id, text))
    rows.sort(key=lambda r: (r[2]))
    info = [
        ("format", str(READINGS_FORMAT)),
        ("inputs", canonical_json(inp.hashes)),
        ("rewayat", ",".join(APP_IDS[r] for r in MEMBERS)),
    ]
    return Build(inp, spans, rows, info)


# ---------------------------------------------------------------------------
# Gates G2-G8
# ---------------------------------------------------------------------------


def _expected_silah(inp: Inputs, rid: str, span_slots: list[Slot]) -> list[int]:
    out: list[int] = []
    off = 0
    for s in span_slots:
        if not s.words[rid]:
            continue
        out.extend(off + c for c in inp.silah[rid].get(s.location, []))
        off += len(" ".join(s.words[rid])) + 1
    return out


def _check_span_row(inp: Inputs, sr: SpanReadings, data: dict, issue_rids: set[tuple[str, str]]) -> list[str]:
    """G2-G4 of one row (any source) against the inputs."""
    errors: list[str] = []
    loc = sr.first.location
    span_slots = inp.slots[sr.first.index : sr.last.index + 1]
    t, groups, m = data["t"], data["g"], data.get("m", {})
    seen = [x for _, _, ms in groups for x in ms]
    if sorted(seen) != list(range(len(MEMBERS))):
        return [f"G2 {loc}: members {seen} are not a partition of 0..7"]
    if not groups or groups[0][0] != "h" or 0 not in groups[0][2]:
        errors.append(f"G2 {loc}: the first group is not Hafs's")
    if [k for k, _, _ in groups] != sorted((k for k, _, _ in groups), key="hdo".index):
        errors.append(f"G2 {loc}: groups not in the order h, d, o")
    kind = {x: k for k, _, ms in groups for x in ms}
    home = {x: tuple(ms) for _, _, ms in groups for x in ms}
    for rid in MEMBERS[1:]:
        mem, x = sr.members[rid], mi(rid)
        if any((s.location, rid) in issue_rids for s in span_slots):
            sib = SIBLING[rid]
            if home[x] != home[mi(sib)] or m.get(str(x), {}).get("q") != 1:
                errors.append(f"G2 {loc} {rid}: a listed misprint not read with {sib}")
            continue
        want = "o" if not mem.text else "d" if mem.tinted else "h"
        if kind[x] != want:
            errors.append(f"G2 {loc} {rid}: in group '{kind[x]}', expected '{want}'")
        if m.get(str(x), {}).get("q"):
            errors.append(f"G2 {loc} {rid}: q on a member that is not a listed misprint")
    # G3 texts: never synthesised
    if len(set(t)) != len(t):
        errors.append(f"G3 {loc}: duplicate texts")
    refs = {ti for _, ti, _ in groups} | {d["x"] for d in m.values() if "x" in d}
    if refs != set(range(len(t))):
        errors.append(f"G3 {loc}: unreferenced or missing texts")
    for k, ti, ms in groups:
        text = t[ti]
        if k == "h" and text != sr.members["hafs"].text:
            errors.append(f"G3 {loc}: 'h' text is not the Hafs text")
        elif k == "o" and (text != "" or any(sr.members[MEMBERS[x]].text for x in ms)):
            errors.append(f"G3 {loc}: an 'o' group with text")
        elif k == "d":
            firsts = [x for x in ms if not m.get(str(x), {}).get("q")]
            if not firsts or text != sr.members[MEMBERS[firsts[0]]].text:
                errors.append(f"G3 {loc}: 'd' text is not its first member's stored text")
        if k != "o" and not text:
            errors.append(f"G3 {loc}: an empty text in a '{k}' group")
    group_text = {x: t[ti] for _, ti, ms in groups for x in ms}
    for rid in MEMBERS[1:]:
        x, d = mi(rid), m.get(str(mi(rid)), {})
        mem = sr.members[rid]
        if kind[x] == "d" and not d.get("q") and mem.text != group_text[x] and "x" not in d:
            errors.append(f"G3 {loc} {rid}: reads its own text but the row shows the group's")
        if "x" in d and not ("s" in d or (kind[x] == "d" and mem.text != group_text[x])):
            errors.append(f"G3 {loc} {rid}: own text without silah or a different text")
        if ("x" in d or "s" in d) and (d.get("q") or kind[x] == "o"):
            errors.append(f"G3 {loc} {rid}: own text on a misprint or a word not read")
    for key, d in m.items():
        rid = MEMBERS[int(key)]
        if "x" in d and t[d["x"]] != sr.members[rid].text:
            errors.append(f"G3 {loc} {rid}: own text is not its stored text")
        # G4 silah
        want = _expected_silah(inp, rid, span_slots)
        if d.get("s", []) != want or ("s" in d and "x" not in d):
            errors.append(f"G4 {loc} {rid}: silah {d.get('s')} != diff {want}")
        if "s" in d and "x" in d:
            text = t[d["x"]]
            for c in d["s"]:
                ok = 0 <= c < len(text) and (
                    text[c] in SILAH_MARKS
                    or (text[c] in SILAH_CARRIERS and c + 1 < len(text) and text[c + 1] in SILAH_MARKS)
                )
                if not ok:
                    errors.append(f"G4 {loc} {rid}: silah index {c} is not on a silah mark or its vowel")
    for rid in MEMBERS[1:]:
        if _expected_silah(inp, rid, span_slots) and "s" not in m.get(str(mi(rid)), {}):
            if not sr.members[rid].folded:
                errors.append(f"G4 {loc} {rid}: diff silah missing from the row")
    # the other details: verse ends, word counts, the basmala (G2: from the DBs)
    members = {str(i) for i in range(1, len(MEMBERS))}
    for key, d in m.items():
        if key not in members or not isinstance(d, dict) or not d or set(d) - {"x", "s", "v", "w", "q"}:
            errors.append(f"G2 {loc}: bad member detail {key}: {d}")
    hafs_words = sr.members["hafs"].words
    for rid in MEMBERS[1:]:
        x, d, mem = mi(rid), m.get(str(mi(rid)), {}), sr.members[rid]
        if d.get("v") != mem.verse_end:
            errors.append(f"G2 {loc} {rid}: verse end {d.get('v')} != {mem.verse_end}")
        want_w = mem.words if kind[x] == "h" and mem.words != hafs_words else None
        if d.get("w") != want_w:
            errors.append(f"G2 {loc} {rid}: word count {d.get('w')} != {want_w}")
    if data.get("u") != ([mi(r) for r in sr.basmala_unnumbered] or None):
        errors.append(f"G2 {loc}: basmala members {data.get('u')}")
    if set(data) - {"t", "g", "m", "span", "u"}:
        errors.append(f"G2 {loc}: unknown row keys {sorted(set(data) - {'t', 'g', 'm', 'span', 'u'})}")
    if sr.two_slots and data.get("span") != [sr.first.word_id, sr.last.word_id]:
        errors.append(f"G1 {loc}: span field")
    if not sr.two_slots and "span" in data:
        errors.append(f"G1 {loc}: span field on a one-slot span")
    return errors


def check_rows(inp: Inputs, spans: list[SpanReadings], rows: list[tuple]) -> list[str]:
    """Gates G1 (row placement), G2-G6 of `rows` (a fresh build's or the
    committed index's) against the inputs."""
    errors: list[str] = []
    by_id = {s.word_id: s for s in inp.slots}
    by_word: dict[int, dict] = {}
    for verse_key, position, word_id, text in rows:
        s = by_id.get(word_id)
        if s is None or (verse_key, position) != (f"{s.surah}:{s.ayah}", s.word):
            errors.append(f"G1 row {verse_key}:{position} (word {word_id}): not that content slot")
            continue
        try:
            data = json.loads(text)
            if not isinstance(data, dict) or not isinstance(data.get("t"), list) or not isinstance(data.get("g"), list):
                raise ValueError("no t / g")
        except ValueError as e:
            errors.append(f"G1 {s.location}: malformed row JSON ({e})")
            continue
        by_word[word_id] = data
    issue_rids = {(i["location"], i["rid"]) for i in inp.issues}
    groups_at: dict[str, list[list[str]]] = {}
    for sr in spans:
        loc = sr.first.location
        span_slots = inp.slots[sr.first.index : sr.last.index + 1]
        datas = [by_word.get(s.word_id) for s in span_slots]
        if any(d != datas[0] for d in datas[1:]):
            errors.append(f"G1 {loc}: the slots of a span have different rows")
        data = datas[0]
        if data is None:
            # G5 completeness
            for rid in MEMBERS[1:]:
                mem = sr.members[rid]
                if mem.tinted or mem.silah or not mem.text:
                    errors.append(f"G5 {loc} {rid}: no row, but tinted / silah / blank")
                if mem.words != sr.members["hafs"].words or mem.verse_end is not None:
                    errors.append(f"G5 {loc} {rid}: no row, but another word count or verse end")
            if sr.two_slots or (sr.first.surah, sr.first.ayah) == (1, 1):
                errors.append(f"G5 {loc}: a two-slot span or al-Fatiha's basmala without a row")
            groups_at[loc] = [list(MEMBERS)]
            continue
        try:
            errors.extend(_check_span_row(inp, sr, data, issue_rids))
            groups_at[loc] = [[MEMBERS[x] for x in ms] for _, _, ms in data["g"]]
        except (KeyError, IndexError, TypeError, ValueError) as e:
            errors.append(f"G2 {loc}: malformed row ({type(e).__name__}: {e})")
    # G6 reviewed cases
    for section in ("groups", "toConfirm"):
        for entry in inp.cases.get(section, []):
            label = entry.get("rule") or entry.get("question") or "?"
            for loc, want in entry.get("spans", {}).items():
                got = groups_at.get(loc)
                if got is None:
                    errors.append(f"G6 {section} {loc}: not the first slot of a span")
                elif got != want:
                    errors.append(f"G6 {section} {loc}: {got} != {want} ({label[:60]}...)")
    return errors


def check_issues(inp: Inputs) -> list[str]:
    """G7: every misprint entry still matches the stored, tinted text."""
    errors: list[str] = []
    by_loc = {s.location: s for s in inp.slots}
    seen: set[tuple[str, str]] = set()
    for issue in inp.issues:
        rid, loc = issue.get("rid"), issue.get("location")
        if (rid, loc) in seen:
            errors.append(f"G7 {rid} {loc}: listed twice")
        seen.add((rid, loc))
        s = by_loc.get(loc)
        if rid not in MEMBERS[1:] or s is None:
            errors.append(f"G7 {rid} {loc}: unknown rewayah or location")
            continue
        stored = " ".join(s.words[rid])
        if stored != issue.get("text"):
            errors.append(f"G7 {rid} {loc}: stored text {stored!r} != {issue.get('text')!r} (stale entry)")
        if loc not in inp.tint[rid]:
            errors.append(f"G7 {rid} {loc}: not tinted any more (stale entry)")
        if issue.get("sibling") != SIBLING.get(rid):
            errors.append(f"G7 {rid} {loc}: sibling {issue.get('sibling')!r} != {SIBLING.get(rid)!r}")
        if not issue.get("note"):
            errors.append(f"G7 {rid} {loc}: no note")
    return errors


def check_build(b: Build, again: Build) -> list[str]:
    """Every gate on a fresh build (G8: `again` is a second, independent build)."""
    errors = check_issues(b.inputs) + check_rows(b.inputs, b.spans, b.rows)
    if b.rows != again.rows or b.info != again.info:
        errors.append("G8 two builds differ")
    for r in b.rows:
        if canonical_json(json.loads(r[3])) != r[3]:
            errors.append(f"G8 {r[0]}:{r[1]}: row JSON is not canonical")
    if b.rows != sorted(b.rows, key=lambda r: r[2]):
        errors.append("G8 rows are not in word order")
    return errors


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------


def write_db(path: Path, b: Build) -> None:
    if path.exists():
        path.unlink()
    con = sqlite3.connect(path)
    try:
        con.execute("PRAGMA page_size = 4096")
        for sql in SCHEMA:
            con.execute(sql)
        con.executemany("INSERT INTO info (key, value) VALUES (?, ?)", b.info)
        con.executemany("INSERT INTO slots (verse_key, position, word_id, data) VALUES (?, ?, ?, ?)", b.rows)
        con.commit()
        con.execute("VACUUM")
    finally:
        con.close()


def db_content(path: Path) -> tuple[list, list, list]:
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        schema = con.execute("SELECT type, name, sql FROM sqlite_master ORDER BY name").fetchall()
        info = con.execute("SELECT key, value FROM info ORDER BY key").fetchall()
        rows = con.execute("SELECT verse_key, position, word_id, data FROM slots ORDER BY word_id").fetchall()
    finally:
        con.close()
    return schema, info, rows


def committed_content(path: Path) -> tuple[list, list, list] | None:
    """db_content of an existing index, or None when it is missing or unreadable."""
    if not path.exists():
        return None
    try:
        return db_content(path)
    except sqlite3.Error:
        return None


def sqlite_version(path: Path) -> int:
    with open(path, "rb") as f:
        header = f.read(100)
    return int.from_bytes(header[96:100], "big")


def make_temp_dir(near: Path) -> Path:
    root = BUILD_ROOT
    try:
        root.mkdir(exist_ok=True)
        if os.stat(root).st_dev != os.stat(near).st_dev:
            root = near
    except OSError:
        root = near
    return Path(tempfile.mkdtemp(prefix=f".readings-build-{os.getpid()}-", dir=root))


# ---------------------------------------------------------------------------
# Review list (Markdown, committed as reading_review.md)
# ---------------------------------------------------------------------------


def _names(rids: list[str]) -> str:
    return ", ".join(NAMES[r] for r in rids)


def _group_line(sr: SpanReadings, g: Group) -> str:
    kind = {"h": "as Hafs", "d": "differs", "o": "not read"}[g.kind]
    own = [f"{NAMES[r]} `{sr.own_text(r)}`" for r in g.members if sr.own_text(r) is not None]
    text = f"`{g.text}`" if g.text else "(no word)"
    extra = f"; own text: {'; '.join(own)}" if own else ""
    return f"{text} ({kind}): {_names(g.members)}{extra}"


def review_markdown(b: Build) -> str:
    inp = b.inputs
    row_words = {r[2] for r in b.rows}
    indexed = [sr for sr in b.spans if sr.first.word_id in row_words]
    multi = [sr for sr in indexed if len(sr.groups) >= 2]
    three = [sr for sr in indexed if len(sr.groups) >= 3]
    bases = Counter(j[2] for sr in b.spans for j in sr.joins)
    oneway = [(sr, j) for sr in b.spans for j in sr.joins if j[2] == "oneway"]
    lines = [
        "<!-- Generated by scripts/rewayah/build_readings_index.py; do not edit by hand. -->",
        "# Per-word readings: review list",
        "",
        "The grouping of the 8 rewayat in `data/mushaf/digitalkhatt/dk_readings.db`, for a",
        "qualified reader to sign off before release (docs/features/rewayat.md, Per-word readings).",
        "Which rewayat read a word as Hafs does is the reviewed highlight decision of",
        "`<id>-diff.json`. What is new, and listed here, is how the rewayat that differ from",
        "Hafs are grouped among themselves (`highlights.reads_alike`), and the misprints read",
        "with their sibling. A decision goes into `reading_groups_cases.json` (a group per",
        "rule); a change of grouping is a change to `highlights.py` or the issue list.",
        "",
        "How a differing rewayah is placed: it joins the group of the other narrator of its",
        "reader when they store the same words or the reviewed sibling rule says they read",
        "alike; otherwise the first group whose first member it reads alike; otherwise it",
        "starts a group. A doubt splits (an extra reading), it never merges. General rules",
        "(madd, tashil, ibdal, imala, naql, idgham) and silah never separate two rewayat: a",
        "member's own text is shown under its group when it differs, with its silah in colour.",
        "",
        "**Status:** not yet reviewed.",
        "",
        "## Summary",
        "",
        "| | count |",
        "|---|---|",
        f"| Spans with a row | {len(indexed):,} |",
        f"| Rows (a two-slot span has two) | {len(b.rows):,} |",
        f"| Spans with 2 or more readings | {len(multi):,} |",
        f"| Spans with 3 or more readings (section 4) | {len(three):,} |",
    ]
    for basis in HL.ALIKE_BASES:
        lines.append(f"| Joins of a differing rewayah to a group: {basis} | {bases.get(basis, 0):,} |")
    lines += [
        "",
        "Join bases (`highlights.ALIKE_BASES`): `same` stored words; `sibling` the reviewed",
        "sibling rule (Warsh / Qalun, al-Susi / al-Duri); `both` each reads like the other under",
        "the other's rules; `across` one reads like the other under rules that read only one of",
        "the two encodings; `oneway` both directions can be checked and only one holds, i.e. one",
        "rewayah's general rule excused the difference (section 3).",
        "",
        "## 1. Suspected KFGQPC misprints read with their sibling",
        "",
        "Decision (docs/plans/2026-11-14-word-study/README.md): each is placed in its sibling",
        "narrator's group and is not shown as a reading of its own; the app shows no note.",
        "Source: `reading_upstream_issues.json`.",
        "",
        "| Rewayah | Hafs word | Stored text | Read with | Group |",
        "|---|---|---|---|---|",
    ]
    by_first = {s.location: sr for sr in b.spans for s in inp.slots[sr.first.index : sr.last.index + 1]}
    for issue in inp.issues:
        sr = by_first[issue["location"]]
        g = next(g for g in sr.groups if issue["rid"] in g.members)
        lines.append(
            f"| {NAMES[issue['rid']]} | {issue['location']} | `{issue['text']}` | {NAMES[issue['sibling']]} | {_group_line(sr, g)} |"
        )
    lines += ["", "## 2. To confirm", ""]
    for entry in inp.cases.get("toConfirm", []):
        lines.append(f"- {entry['question']}")
        for loc in entry["spans"]:
            sr = by_first[loc]
            for g in sr.groups:
                lines.append(f"  - {loc}: {_group_line(sr, g)}")
    lines += [
        "",
        "## 3. Joins where one rewayah's general rules excused the difference",
        "",
        "`oneway`: one of the two texts, read under the other rewayah's rules, reads as that",
        "rewayah's text, but not the other way round: a general rule of one of them excused",
        "the difference.",
        "",
        "| Hafs word | Joins | Its text | Compared with | Its text |",
        "|---|---|---|---|---|",
    ]
    for sr, (rid, first, _) in oneway:
        lines.append(
            f"| {sr.first.location} | {NAMES[rid]} | `{sr.members[rid].text}` | {NAMES[first]} | `{sr.members[first].text}` |"
        )
    lines += ["", "## 4. Spans with 3 or more readings", ""]
    for sr in three:
        loc = sr.first.location if not sr.two_slots else f"{sr.first.location}-{sr.last.word}"
        lines.append(f"- **{loc}**")
        for g in sr.groups:
            lines.append(f"  - {_group_line(sr, g)}")
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def run_build() -> tuple[Build, list[str]]:
    inp = load_inputs()
    b = build(inp)
    again = build(load_inputs())
    return b, check_build(b, again)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="rebuild, run the gates and compare with the committed files")
    mode.add_argument("--report", action="store_true", help="print the review list (Markdown) and exit")
    ap.add_argument("--out", type=Path, help="write the index here instead of data/mushaf/digitalkhatt/dk_readings.db")
    a = ap.parse_args(argv)

    try:
        b, errors = run_build()
    except (GateError, N.SourceError) as e:
        print(f"FAILED: {e}", file=sys.stderr)
        return 1
    if errors:
        for e in errors[:50]:
            print(f"  {e}", file=sys.stderr)
        if len(errors) > 50:
            print(f"  ... {len(errors) - 50} more", file=sys.stderr)
        print(f"FAILED: {len(errors)} gate failure(s); nothing was written", file=sys.stderr)
        return 1
    review = review_markdown(b)
    if a.report:
        sys.stdout.write(review)
        return 0

    multi = sum(1 for sr in b.spans if len(sr.groups) >= 2)
    print(f"gates G1-G8 ok: {len(b.rows):,} rows, {multi:,} spans with 2 or more readings")
    out = (a.out or OUT_DB).resolve()
    tmp = make_temp_dir(out.parent)
    try:
        fresh = tmp / out.name
        write_db(fresh, b)
        committed = committed_content(out)
        if a.check:
            bad = 0
            if committed is None:
                print(f"DIFF {out.name}: missing or unreadable", file=sys.stderr)
                bad += 1
            else:
                # the gates also judge the committed rows, so a hand-edited row
                # fails the gate it breaks, not only the comparison below
                errors = check_rows(b.inputs, b.spans, committed[2])
                for e in errors[:50]:
                    print(f"  committed {out.name}: {e}", file=sys.stderr)
                bad += len(errors)
                if db_content(fresh) != committed:
                    print(f"DIFF {out.name}: the committed index is not what the build produces", file=sys.stderr)
                    bad += 1
                elif sqlite_version(fresh) == sqlite_version(out) and fresh.read_bytes() != out.read_bytes():
                    print(f"DIFF {out.name}: same rows and SQLite version but different bytes", file=sys.stderr)
                    bad += 1
            if a.out is None and (not REVIEW_FILE.exists() or REVIEW_FILE.read_text(encoding="utf-8") != review):
                print(f"DIFF {REVIEW_FILE.name}: the committed review list is not what the build produces", file=sys.stderr)
                bad += 1
            print("OK: committed readings index and review list match a fresh build" if not bad else f"FAILED: {bad} difference(s)")
            return 1 if bad else 0
        if committed is not None and db_content(fresh) == committed:
            print(f"unchanged: {out}")
        else:
            os.replace(fresh, out)
            print(f"wrote {out} ({out.stat().st_size:,} bytes)")
        if a.out is None:
            if REVIEW_FILE.exists() and REVIEW_FILE.read_text(encoding="utf-8") == review:
                print(f"unchanged: {REVIEW_FILE}")
            else:
                REVIEW_FILE.write_text(review, encoding="utf-8")
                print(f"wrote {REVIEW_FILE}")
            print("Then: node scripts/rewayah/gen-manifest.mjs (the app names its copy by the index's sha256)")
        return 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
