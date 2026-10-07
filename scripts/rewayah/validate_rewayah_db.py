#!/usr/bin/env python3
"""
Exact-match validator for Bayaan's non-Hafs DigitalKhatt words DBs, highlight
maps and verse maps (Release 1, zero tolerance). Independent of the builder:
it only shares normalize.py, the definition of "the normalized official
source", and re-derives everything else from the files.

Usage (from the repo root):
  python3 scripts/rewayah/validate_rewayah_db.py              # all 7 rewayat
  python3 scripts/rewayah/validate_rewayah_db.py warsh bazzi
  python3 scripts/rewayah/validate_rewayah_db.py --glyphs     # + HarfBuzz glyph gate (needs uharfbuzz, fonttools)
  python3 scripts/rewayah/validate_rewayah_db.py --db-dir DIR # validate files in another directory
  python3 scripts/rewayah/validate_rewayah_db.py --marks      # + per-codepoint mark accounting report

Gates (each failure is reported; exit code 1 if any gate fails):
  sources     sources/<id>.json SHA-256 == sources/sources.lock.json
  rows        same schema and the same 83,668 rows as digital-khatt-v2.db
              (id, location, surah, ayah, word identical); only text differs
  slots       every text is '' or tokens joined by single U+0020; a Hafs
              marker slot holds '' or one '۝N'; a content slot may end with
              one inline '۝N'; every code point is in the DigitalKhatt cmap
  stream      per surah, the slot tokens read in id order are EXACTLY the
              normalized source tokens (content + verse markers). Allowed:
              Fatiha basmala exception (P10) and declared A2 joins
  numbers     the displayed verse numbers of every surah are 1..N of the source
  letters     every stored token has the base letters of its raw official
              token (after hamza decomposition and the listed letter mappings)
  diff        <id>-diff.json format 2: valid keys / categories / entries, each
              on an existing non-blank content slot whose text differs from
              Hafs, whole-word entries [] and silah indices on silah marks
              before any inline marker
  versemap    <id>-versemap.json format 1 equals the map re-derived from the DB
  glyphs      (--glyphs) every unique stored token shaped with DigitalKhattFont
              (and the V1 font): 0 .notdef, 0 dotted circles, and no
              unattached / orphan mark beyond the known render limitations
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import sys
import unicodedata
from collections import Counter
from pathlib import Path
from typing import TextIO

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import normalize as N  # noqa: E402

REPO = HERE.parents[1]
DATA_DIR = REPO / "data" / "mushaf" / "digitalkhatt"
HAFS_DB = DATA_DIR / "digital-khatt-v2.db"
SOURCES_DIR = HERE / "sources"
LOCK_FILE = SOURCES_DIR / "sources.lock.json"
FONT_V2 = DATA_DIR / "DigitalKhattFont.otf"
FONT_V1 = REPO / "data" / "mushaf" / "legacy" / "DigitalKhattQuranicV1.otf"

EXPECTED_ROWS = 83668
WHOLE_WORD = {rid: ("major" if rid in N.CLOSE else "mukhtalif") for rid in N.REWAYAT}
SILAH_CHARS = frozenset("\u06E5\u06E6")
SILAH_CARRIER_VOWELS = frozenset("\u064F\u0650")

# The 90 code points of the DigitalKhatt V1/V2 cmap (identical in both fonts).
DK_CMAP = frozenset(
    chr(int(x, 16))
    for x in (
        "000A 0020 034F 0621 0622 0623 0624 0625 0626 0627 0628 0629 062A 062B 062C 062D 062E 062F "
        "0630 0631 0632 0633 0634 0635 0636 0637 0638 0639 063A 0640 0641 0642 0643 0644 0645 0646 "
        "0647 0648 0649 064A 064B 064C 064D 064E 064F 0650 0651 0652 0653 0654 0655 065C 0660 0661 "
        "0662 0663 0664 0665 0666 0667 0668 0669 0670 0671 06D6 06D7 06D8 06D9 06DA 06DB 06DC 06DD "
        "06DE 06DF 06E0 06E1 06E2 06E3 06E5 06E6 06E7 06E8 06E9 06EC 06ED 08F0 08F1 08F2 08F3 200D"
    ).split()
)

# Words the DigitalKhatt fonts shape with a mark left at its default position
# (no anchor). Visually checked against the official KFGQPC fonts: the marks
# stay legible next to their letter. Any NEW unattached / orphan mark fails
# the glyph gate. Keyed by the mark code point and the base letter before it.
KNOWN_UNATTACHED = {
    ("\u06EC", "\u0648"): "KFGQPC dot (ibdal / tashil sign) on a waw, e.g. 2:225 yu-akhidhukum, 3:15",
    ("\u06EC", "\u064A"): "KFGQPC dot on a ya, e.g. Warsh 2:150 li-alla",
    ("\u06EC", "\u0627"): "KFGQPC dot after a lam-alef / ha-alef, e.g. 2:220 la-a'natakum, 3:66 ha-antum, 19:19",
    ("\u06EC", "\u0639"): "KFGQPC ikhfa dot on an ain, Qalun 4:154 ta'adu",
    ("\u06EC", "\u0647"): "KFGQPC ikhfa dot on a ha, 10:35 yahiddi",
    ("\u06EC", "\u062F"): "KFGQPC ishmam dot on a dal, Shu'bah 18:2 / 18:76 ladnihi / ladni",
    ("\u06EC", "\u0633"): "KFGQPC ishmam dot on a seen, Nafi' 11:77 / 29:33 / 67:27 si'a",
    ("\u0655", "\u0640"): "hamza below a tatweel seat, Nafi' khasi'ina / muttaki'ina: drawn on the tatweel line",
    ("\u06DC", "\u0635"): "small high seen on a sad (Qunbul sirat with seen): drawn above the sad, unanchored",
    ("\u06E8", "\u0640"): "small high noon on a tatweel, 12:110 fa-nunji: drawn on the tatweel",
}


class Report:
    def __init__(self, rid: str, out: TextIO, max_examples: int = 8) -> None:
        self.rid = rid
        self.out = out
        self.max = max_examples
        self.failures: dict[str, list[str]] = {}
        self.info: list[str] = []

    def fail(self, gate: str, msg: str) -> None:
        self.failures.setdefault(gate, []).append(msg)

    def note(self, msg: str) -> None:
        self.info.append(msg)

    @property
    def ok(self) -> bool:
        return not self.failures

    def emit(self, gates: list[str]) -> None:
        print(f"== {self.rid}: {'PASS' if self.ok else 'FAIL'}", file=self.out)
        for g in gates:
            errs = self.failures.get(g, [])
            status = "ok" if not errs else f"FAIL ({len(errs)})"
            print(f"   {g:9s} {status}", file=self.out)
            for e in errs[: self.max]:
                print(f"      - {e}", file=self.out)
            if len(errs) > self.max:
                print(f"      ... {len(errs) - self.max} more", file=self.out)
        for i in self.info:
            print(f"   info: {i}", file=self.out)


# ---------------------------------------------------------------------------
# Independent helpers (not imported from the builder)
# ---------------------------------------------------------------------------

_LETTERS = {chr(c) for c in range(0x0621, 0x064B)} | {"\u0671"}
_SKEL_VARIANT = {
    "\u0671": "\u0627", "\u0622": "\u0627", "\u0623": "\u0627", "\u0625": "\u0627",
    "\u0649": "\u064A", "\u0626": "\u064A", "\u0624": "\u0648", "\u0629": "\u0647",
}
_NONJOIN = set("\u0627\u0623\u0625\u0622\u0671\u062F\u0630\u0631\u0632\u0648\u0624")


def _skel(t: str) -> str:
    return "".join(_SKEL_VARIANT.get(c, c) for c in t if c in _LETTERS and c not in ("\u0621", "\u0640"))


def _a2_allowed(t1: str, t2: str, hafs_slot: str) -> bool:
    last = next((c for c in reversed(t1) if c in _LETTERS), "")
    return " " not in hafs_slot and last in _NONJOIN and _skel(t1 + t2) == _skel(hafs_slot)


_HAMZA_DECOMPOSE = {
    "\u0623": "\u0627\u0654", "\u0625": "\u0627\u0655", "\u0624": "\u0648\u0654", "\u0626": "\u064A\u0654",
}


def canonical_letters(token: str) -> str:
    """Base letters of a token for the letter-preservation gate."""
    t = token
    for src, dst in _HAMZA_DECOMPOSE.items():
        t = t.replace(src, dst)
    for maps in N.LETTER_MAPPINGS.values():
        for src, dst in maps:
            t = t.replace(src, dst)
    return "".join(c for c in t if c != "\u0640" and unicodedata.category(c) in ("Lo", "Lm"))


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def check_source_lock(rid: str, source_path: Path, rep: Report) -> None:
    try:
        lock = json.loads(LOCK_FILE.read_text(encoding="utf-8"))
    except FileNotFoundError:
        rep.fail("sources", f"{LOCK_FILE} missing")
        return
    entry = lock.get("sources", {}).get(rid)
    if entry is None:
        rep.fail("sources", f"no {rid} entry in {LOCK_FILE.name}")
        return
    if source_path.resolve() != (SOURCES_DIR / entry["file"]).resolve():
        rep.note(f"source {source_path} is not the locked file; lock check skipped")
        return
    got = sha256_file(source_path)
    if got != entry["sha256"]:
        rep.fail("sources", f"{source_path.name}: sha256 {got} != locked {entry['sha256']}")
    errata = lock.get("errata", {})
    if errata.get("sha256") and sha256_file(SOURCES_DIR / errata["file"]) != errata["sha256"]:
        rep.fail("sources", f"{errata['file']} sha256 differs from {LOCK_FILE.name}")


# ---------------------------------------------------------------------------
# Main validation
# ---------------------------------------------------------------------------


def _rows(db: Path) -> tuple[list[tuple], str]:
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    try:
        rows = con.execute("SELECT id, location, surah, ayah, word, text FROM words ORDER BY id").fetchall()
        schema = [r[0] for r in con.execute("SELECT sql FROM sqlite_master ORDER BY name")]
    finally:
        con.close()
    return rows, "\n".join(s or "" for s in schema)


def validate(
    rid: str,
    db_path: Path,
    diff_path: Path,
    versemap_path: Path,
    source_path: Path,
    hafs_db: Path = HAFS_DB,
    glyphs: bool = False,
    marks: bool = False,
    out: TextIO = sys.stdout,
) -> bool:
    rep = Report(rid, out)
    gates = ["sources", "rows", "slots", "stream", "numbers", "letters", "diff", "versemap"]
    if glyphs:
        gates.append("glyphs")

    check_source_lock(rid, source_path, rep)

    # --- rows ---------------------------------------------------------------
    hafs, hafs_schema = _rows(hafs_db)
    try:
        db, db_schema = _rows(db_path)
    except sqlite3.Error as e:
        rep.fail("rows", f"cannot read {db_path}: {e}")
        rep.emit(gates)
        return False
    if db_schema != hafs_schema:
        rep.fail("rows", f"schema differs from Hafs: {db_schema!r}")
    if len(db) != EXPECTED_ROWS or len(hafs) != EXPECTED_ROWS:
        rep.fail("rows", f"row count {len(db)} (Hafs {len(hafs)}), expected {EXPECTED_ROWS}")
    for h, d in zip(hafs, db):
        if h[:5] != d[:5]:
            rep.fail("rows", f"row differs from Hafs at id {h[0]}: {d[:5]} vs {h[:5]}")
            break
    if not rep.ok:
        rep.emit(gates)
        return False
    hafs_text = {h[0]: h[5] for h in hafs}
    is_hafs_marker = {h[0]: N.is_marker(h[5]) for h in hafs}
    loc_to_id = {(h[2], h[3], h[4]): h[0] for h in hafs}

    # --- slots --------------------------------------------------------------
    stats = Counter()
    for wid, loc, s, a, w, text in db:
        if text == "":
            stats["blank marker slots" if is_hafs_marker[wid] else "blank content slots"] += 1
            continue
        toks = text.split(" ")
        if any(t == "" for t in toks) or text != text.strip():
            rep.fail("slots", f"{loc}: bad spacing {text!r}")
            continue
        bad = sorted({c for c in text if c not in DK_CMAP})
        if bad:
            rep.fail("slots", f"{loc}: code points outside the DK cmap {[f'U+{ord(c):04X}' for c in bad]} in {text!r}")
        markers = [k for k, t in enumerate(toks) if N.is_marker(t)]
        if is_hafs_marker[wid]:
            if len(toks) != 1 or not markers:
                rep.fail("slots", f"{loc}: Hafs marker slot holds {text!r}")
        else:
            if markers and (len(markers) > 1 or markers[0] != len(toks) - 1 or len(toks) == 1):
                rep.fail("slots", f"{loc}: inline marker not alone at the end of a content slot: {text!r}")
            if markers:
                stats["content slots with an inline marker"] += 1
            if len(toks) - len(markers) > 1:
                stats["multi-token content slots"] += 1

    # --- expected stream ----------------------------------------------------
    try:
        verses = N.load_source(source_path, rid)
    except N.SourceError as e:
        rep.fail("stream", f"source: {e}")
        rep.emit(gates)
        return False
    counts = N.verse_counts(verses)
    expected: dict[int, list[tuple[str, int, str]]] = {}  # (dk token, verse, raw token)
    for v in verses:
        lst = expected.setdefault(v.surah, [])
        for raw in v.tokens:
            lst.append((N.dk_token(raw, rid), v.ayah, raw))
        lst.append((N.marker(v.ayah), v.ayah, ""))
    actual: dict[int, list[tuple[str, int]]] = {}  # (token, word id)
    for wid, loc, s, a, w, text in db:
        if text:
            actual.setdefault(s, []).extend((t, wid) for t in text.split(" "))

    fatiha_exception = False
    first = verses[0]
    if _skel(N.dk_token(first.tokens[0], rid)) != "\u0628\u0633\u0645":
        basmala_ids = [loc_to_id[(1, 1, k)] for k in (1, 2, 3, 4)]
        act1 = actual.get(1, [])
        if [t for t, _ in act1[:4]] == [hafs_text[i] for i in basmala_ids] and [i for _, i in act1[:4]] == basmala_ids:
            actual[1] = act1[4:]
            fatiha_exception = True
            marker_11 = loc_to_id[(1, 1, 5)]
            if dict((r[0], r[5]) for r in db)[marker_11] != "":
                rep.fail("stream", "P10: the Hafs 1:1 marker slot must be blank")
        else:
            rep.fail("stream", "P10: source has no basmala verse but 1:1:1-4 are not the exact Hafs basmala words")

    # pair every DB token with expected tokens (A2 joins consume two)
    token_verse: dict[int, list[int]] = {}  # word id -> rewayah verse numbers of its tokens
    a2_joins = 0
    letters_checked = 0
    for s in range(1, 115):
        exp = expected.get(s, [])
        act = actual.get(s, [])
        i = j = 0
        while i < len(act) and j < len(exp):
            tok, wid = act[i]
            if tok == exp[j][0]:
                if exp[j][2]:
                    letters_checked += 1
                    if canonical_letters(tok) != canonical_letters(exp[j][2]):
                        rep.fail("letters", f"{s}: stored {tok!r} vs source {exp[j][2]!r}")
                if not N.is_marker(tok):
                    token_verse.setdefault(wid, []).append(exp[j][1])
                i += 1
                j += 1
                continue
            if (
                j + 1 < len(exp)
                and tok == exp[j][0] + exp[j + 1][0]
                and exp[j][1] == exp[j + 1][1]
                and not N.is_marker(exp[j + 1][0])
                and _a2_allowed(exp[j][0], exp[j + 1][0], hafs_text[wid])
            ):
                a2_joins += 1
                token_verse.setdefault(wid, []).append(exp[j][1])
                if canonical_letters(tok) != canonical_letters(exp[j][2] + exp[j + 1][2]):
                    rep.fail("letters", f"{s}: stored {tok!r} vs source {exp[j][2] + exp[j + 1][2]!r}")
                i += 1
                j += 2
                continue
            ctx = " ".join(t for t, _, _ in exp[max(0, j - 3) : j])
            rep.fail(
                "stream",
                f"surah {s}: DB token #{i} {tok!r} (word id {wid}) != source {exp[j][0]!r} (after: {ctx[-60:]!r})",
            )
            break
        else:
            if i != len(act) or j != len(exp):
                rep.fail("stream", f"surah {s}: DB has {len(act) - i} extra / source {len(exp) - j} missing tokens at the end")
        # numbers
        nums = [N.marker_number(t) for t, _ in act if N.is_marker(t)]
        if nums != list(range(1, counts[s] + 1)):
            rep.fail("numbers", f"surah {s}: displayed {len(nums)} numbers, expected 1..{counts[s]}")
    stats["A2 joins"] = a2_joins
    stats["tokens letter-checked"] = letters_checked

    # --- diff JSON ------------------------------------------------------------
    db_text = {r[0]: r[5] for r in db}
    try:
        diff = json.loads(Path(diff_path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        rep.fail("diff", f"cannot read {diff_path}: {e}")
        diff = {}
    if diff and diff.get("__format") != 2:
        rep.fail("diff", f"__format {diff.get('__format')!r} != 2")
    allowed = {WHOLE_WORD[rid], "silah"}
    seen_entries: set[tuple[str, str, int]] = set()
    cat_counts = Counter()
    for vk, cats in diff.items():
        if vk == "__format":
            continue
        try:
            s, a = (int(x) for x in vk.split(":"))
        except ValueError:
            rep.fail("diff", f"bad key {vk!r}")
            continue
        if not isinstance(cats, dict) or not cats:
            rep.fail("diff", f"{vk}: categories must be a non-empty object")
            continue
        for cat, entries in cats.items():
            if cat not in allowed:
                rep.fail("diff", f"{vk}: category {cat!r} not allowed for {rid}")
                continue
            for e in entries:
                if not (isinstance(e, list) and len(e) == 2 and isinstance(e[0], int) and isinstance(e[1], list)):
                    rep.fail("diff", f"{vk}/{cat}: malformed entry {e!r}")
                    continue
                w, chars = e
                wid = loc_to_id.get((s, a, w))
                if wid is None:
                    rep.fail("diff", f"{vk}:{w} is not a Hafs word slot")
                    continue
                if (vk, cat, w) in seen_entries:
                    rep.fail("diff", f"{vk}:{w} duplicated in {cat}")
                seen_entries.add((vk, cat, w))
                cat_counts[cat] += 1
                text = db_text[wid]
                if is_hafs_marker[wid]:
                    rep.fail("diff", f"{vk}:{w} ({cat}) is a verse-marker slot")
                    continue
                if text == "":
                    rep.fail("diff", f"{vk}:{w} ({cat}) is a blank slot")
                    continue
                if text == hafs_text[wid]:
                    rep.fail("diff", f"{vk}:{w} ({cat}) equals the Hafs text")
                content = text
                toks = text.split(" ")
                if N.is_marker(toks[-1]):
                    content = " ".join(toks[:-1])
                if cat == WHOLE_WORD[rid]:
                    if chars:
                        rep.fail("diff", f"{vk}:{w} whole-word entry has char indices {chars}")
                    continue
                # silah
                if not chars or chars != sorted(set(chars)):
                    rep.fail("diff", f"{vk}:{w} silah indices must be a sorted non-empty set: {chars}")
                    continue
                for c in chars:
                    if not (0 <= c < len(content)):
                        rep.fail("diff", f"{vk}:{w} silah index {c} outside the word (before any inline marker): {text!r}")
                        break
                    ch = content[c]
                    nxt = content[c + 1] if c + 1 < len(content) else ""
                    if not (ch in SILAH_CHARS or (ch in SILAH_CARRIER_VOWELS and nxt in SILAH_CHARS)):
                        rep.fail("diff", f"{vk}:{w} silah index {c} is not a silah mark or its carrier: {text!r}")
                        break
    for cat, n in sorted(cat_counts.items()):
        stats[f"diff {cat}"] = n

    # --- verse map ------------------------------------------------------------
    r2h_full: dict[str, list[str]] = {}
    for wid, loc, s, a, w, text in db:
        for vn in token_verse.get(wid, []):
            lst = r2h_full.setdefault(f"{s}:{vn}", [])
            hk = f"{s}:{a}"
            if hk not in lst:
                lst.append(hk)
    h2r_full: dict[str, list[str]] = {}
    for rk, hks in r2h_full.items():
        for hk in hks:
            h2r_full.setdefault(hk, []).append(rk)
    hafs_keys = list(dict.fromkeys(f"{h[2]}:{h[3]}" for h in hafs))
    exp_r2h = {k: v for k, v in r2h_full.items() if v != [k]}
    exp_h2r = {k: h2r_full.get(k, []) for k in hafs_keys if h2r_full.get(k, []) != [k]}
    try:
        vm = json.loads(Path(versemap_path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        rep.fail("versemap", f"cannot read {versemap_path}: {e}")
        vm = None
    if vm is not None:
        if vm.get("__format") != 1:
            rep.fail("versemap", f"__format {vm.get('__format')!r} != 1")
        if vm.get("rewayah") != rid:
            rep.fail("versemap", f"rewayah {vm.get('rewayah')!r} != {rid!r}")
        if vm.get("verseCounts") != {str(s): counts[s] for s in range(1, 115)}:
            rep.fail("versemap", "verseCounts != the source verse counts")
        if vm.get("r2h") != exp_r2h:
            bad = [k for k in set(exp_r2h) | set(vm.get("r2h", {})) if exp_r2h.get(k) != vm.get("r2h", {}).get(k)]
            rep.fail("versemap", f"r2h differs from the DB at {sorted(bad)[:10]}")
        if vm.get("h2r") != exp_h2r:
            bad = [k for k in set(exp_h2r) | set(vm.get("h2r", {})) if exp_h2r.get(k) != vm.get("h2r", {}).get(k)]
            rep.fail("versemap", f"h2r differs from the DB at {sorted(bad)[:10]}")
        all_r = {f"{s}:{a}" for s in range(1, 115) for a in range(1, counts[s] + 1)}
        missing = all_r - set(r2h_full)
        if missing:
            rep.fail("versemap", f"rewayah verses with no word in the DB: {sorted(missing)[:10]}")
        stats["versemap r2h entries"] = len(exp_r2h)
        stats["versemap h2r entries"] = len(exp_h2r)

    # --- glyph gate -------------------------------------------------------------
    if glyphs:
        glyph_gate(rid, db, rep, stats)

    if marks:
        mark_report(rid, verses, db, rep)

    rep.note(
        ", ".join(f"{k}={v}" for k, v in sorted(stats.items()))
        + f", fatiha_basmala_exception={'used' if fatiha_exception else 'no'}"
    )
    rep.emit(gates)
    return rep.ok


# ---------------------------------------------------------------------------
# Glyph gate
# ---------------------------------------------------------------------------

_FONT_CACHE: dict = {}


def _font(path: Path):
    if path not in _FONT_CACHE:
        import uharfbuzz as hb
        from fontTools.ttLib import TTFont

        tt = TTFont(str(path), lazy=True)
        classes = tt["GDEF"].table.GlyphClassDef.classDefs
        order = tt.getGlyphOrder()
        dotted = tt.getBestCmap().get(0x25CC)
        _FONT_CACHE[path] = (hb.Font(hb.Face(hb.Blob.from_file_path(str(path)))), classes, order, dotted)
    return _FONT_CACHE[path]


def shape_issues(path: Path, text: str) -> list[tuple[str, int]]:
    """[(issue, cluster index)] for one token."""
    import uharfbuzz as hb

    font, classes, order, dotted = _font(path)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.direction = "rtl"
    buf.script = "Arab"
    buf.language = "ar"
    hb.shape(font, buf, {})
    by_cluster: dict[int, list[int]] = {}
    for gi in buf.glyph_infos:
        by_cluster.setdefault(gi.cluster, []).append(gi.codepoint)
    issues = []
    for gi, gp in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[gi.codepoint]
        if gi.codepoint == 0:
            issues.append(("notdef", gi.cluster))
        elif dotted is not None and name == dotted:
            issues.append(("dotted_circle", gi.cluster))
        elif classes.get(name) == 3 and gp.x_offset == 0 and gp.y_offset == 0:
            base = any(classes.get(order[g]) != 3 for g in by_cluster[gi.cluster])
            issues.append(("unattached_mark" if base else "orphan_mark", gi.cluster))
    return issues


def _mark_context(text: str, cluster: int) -> list[tuple[str, str]]:
    """(mark, base letter) pairs of the marks in the cluster starting at `cluster`."""
    out = []
    base = ""
    i = cluster
    j = i
    while j > 0 and unicodedata.category(text[j]).startswith("M"):
        j -= 1
    base = text[j]
    k = i
    while k < len(text) and (k == i or unicodedata.category(text[k]).startswith("M")):
        if unicodedata.category(text[k]).startswith("M"):
            out.append((text[k], base))
        k += 1
    return out


def glyph_gate(rid: str, db: list[tuple], rep: Report, stats: Counter) -> None:
    import importlib.util

    if importlib.util.find_spec("uharfbuzz") is None or importlib.util.find_spec("fontTools") is None:
        rep.fail("glyphs", "uharfbuzz / fonttools not installed (pip install uharfbuzz fonttools)")
        return
    words = Counter(t for r in db for t in r[5].split(" ") if r[5])
    fonts = [FONT_V2] + ([FONT_V1] if FONT_V1.exists() else [])
    for fp in fonts:
        occ = Counter()
        limitations: Counter = Counter()
        for w, n in words.items():
            for issue, cl in shape_issues(fp, w):
                occ[issue] += n
                if issue in ("notdef", "dotted_circle"):
                    rep.fail("glyphs", f"{fp.name}: {issue} in {w!r}")
                    continue
                pairs = _mark_context(w, cl)
                known = [p for p in pairs if p in KNOWN_UNATTACHED]
                if known:
                    for p in known:
                        limitations[p] += n
                else:
                    rep.fail("glyphs", f"{fp.name}: new {issue} in {w!r} (marks {[(f'U+{ord(m):04X}', b) for m, b in pairs]})")
        stats[f"glyphs {fp.stem} unique words"] = len(words)
        for issue, n in sorted(occ.items()):
            stats[f"glyphs {fp.stem} {issue} occurrences"] = n
        if fp == FONT_V2:
            for (m, b), n in sorted(limitations.items()):
                rep.note(f"render limitation U+{ord(m):04X} on {b}: {n} occurrences ({KNOWN_UNATTACHED[(m, b)]})")


# ---------------------------------------------------------------------------
# Mark accounting
# ---------------------------------------------------------------------------


def mark_report(rid: str, verses: list[N.Verse], db: list[tuple], rep: Report) -> None:
    src = Counter()
    for v in verses:
        for t in v.tokens:
            src.update(c for c in t if unicodedata.category(c).startswith("M") or c in "\u06DE\u06E9\u0640\u200D")
    stored = Counter()
    for r in db:
        for t in r[5].split(" "):
            if t and not N.is_marker(t):
                stored.update(c for c in t if unicodedata.category(c).startswith("M") or c in "\u06DE\u06E9\u0640\u200D")
    lines = []
    for c in sorted(set(src) | set(stored)):
        if src[c] != stored[c]:
            lines.append(f"U+{ord(c):04X} {src[c]}->{stored[c]}")
    rep.note("mark accounting (source -> stored, changed only; Hafs basmala words in P10 count as stored): " + ", ".join(lines))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("rewayat", nargs="*", help=f"subset of {', '.join(N.REWAYAT)} (default: all)")
    ap.add_argument("--db-dir", type=Path, default=DATA_DIR, help="directory with dk_words_<id>.db, <id>-diff.json, <id>-versemap.json")
    ap.add_argument("--hafs-db", type=Path, default=HAFS_DB)
    ap.add_argument("--glyphs", action="store_true", help="run the HarfBuzz glyph gate")
    ap.add_argument("--marks", action="store_true", help="print the mark accounting report")
    a = ap.parse_args(argv)
    rids = a.rewayat or list(N.REWAYAT)
    unknown = [r for r in rids if r not in N.REWAYAT]
    if unknown:
        print(f"unknown rewayah id(s): {unknown}", file=sys.stderr)
        return 2
    ok = True
    for rid in rids:
        ok &= validate(
            rid,
            db_path=a.db_dir / f"dk_words_{rid}.db",
            diff_path=a.db_dir / f"{rid}-diff.json",
            versemap_path=a.db_dir / f"{rid}-versemap.json",
            source_path=SOURCES_DIR / f"{rid}.json",
            hafs_db=a.hafs_db,
            glyphs=a.glyphs,
            marks=a.marks,
        )
    print("ALL PASS" if ok else "VALIDATION FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
