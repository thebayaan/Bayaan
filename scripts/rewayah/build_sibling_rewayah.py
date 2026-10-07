#!/usr/bin/env python3
"""
Build Bayaan's non-Hafs DigitalKhatt words DBs, highlight maps and verse maps
from the official KFGQPC v2.x texts (Release 1: every rewayah keeps the Hafs
word ids, verse keys and 604-page layout; only words.text changes).

Usage (from the repo root):
  python3 scripts/rewayah/build_sibling_rewayah.py              # all 7 rewayat
  python3 scripts/rewayah/build_sibling_rewayah.py warsh bazzi  # a subset
  python3 scripts/rewayah/build_sibling_rewayah.py --out-dir DIR   # write elsewhere, repo untouched
  python3 scripts/rewayah/build_sibling_rewayah.py --report     # also print every non-trivial alignment

For each rewayah <id> the builder writes, into a fresh temporary directory:
  dk_words_<id>.db     CREATE TABLE + INSERT in id order + VACUUM (deterministic bytes)
  <id>-diff.json       highlight map, format 2 (contract C2)
  <id>-versemap.json   rewayah <-> Hafs verse map, format 1 (contract C3)
then runs the hard validator (validate_rewayah_db.validate, plus the sibling
gate for every narrator pair it touches) on them and only if everything
passes replaces the files in data/mushaf/digitalkhatt/ atomically
(os.replace). Any failure exits non-zero and leaves the repo files untouched.
Running the builder twice produces byte-identical files.

Algorithm (the reconciled prototype of the 2026-10 audit, adapted to v2.x)
--------------------------------------------------------------------------
1. Sources: scripts/rewayah/sources/<id>.json, verified against
   sources/sources.lock.json (SHA-256) before anything is read.
   normalize.load_source/parse_verse tokenize each verse; normalize.dk_tokens
   converts each token to DK encoding (conventions + RENDER_POLICY), with the
   token read before it as context (the KFGQPC dot U+06DF).
2. Alignment key = rasm skeleton (base letters only; hamza seats, wasla/madda
   alef and final ya unified; hamza and tatweel dropped).
3. Per surah: skeleton-equality anchors (difflib matching blocks) + a banded
   dynamic programme between anchors with the moves 1:1, 1:0, 0:1, 2:1, 1:2
   (1:1 cost = normalized Levenshtein of the skeletons, gap 0.7, merges cost
   of the concatenation + 0.2).
4. Slot text = the target tokens assigned to the Hafs slot, joined by one
   space. Policies:
     P2  a Hafs-only word -> blank slot ''          (Hafs text never leaks)
     P3  one target token over two Hafs slots -> first slot, second blank
     P4  an extra target token -> appended to the previous slot
     A2  two target tokens in one Hafs slot are joined WITHOUT a space only
         when the Hafs slot is one word, skel(t1+t2) == skel(Hafs) and t1 ends
         in a right-non-joining letter; otherwise one space
     P12 37:130 'إِلْ يَاسِينَ' (a Hafs slot with a space) keeps both words
     P10 Fatiha, sources without a basmala verse (Madani/Basri counts): the
         exact Hafs basmala words stay in 1:1:1-4, the 1:1 marker is blank and
         numbering starts at al-hamdu
5. Markers: a Hafs marker slot receives the target marker of verse v iff the
   last target token consumed so far is the last token of v; otherwise ''
   (P7). A target verse end with no Hafs marker slot is written inline after
   the verse's last token inside its slot ('عَلَيْهِمْ ۝٦', P6), so every surah
   displays 1..N.
6. Highlights (format 2) and the verse map are computed from the same final
   assignment (see make_diff / make_versemap). The highlight classifier
   (highlights.py) gets each slot's next word in Hafs and in the rewayah, and
   Warsh / al-Susi also get the whole-word tint that Qalun / al-Duri give to
   the same stored words (highlights.SIBLING_BASE), so the builder aligns that
   sibling too.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sqlite3
import sys
import tempfile
from collections import Counter
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from functools import lru_cache
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import highlights as HL  # noqa: E402
import normalize as N  # noqa: E402

REPO = HERE.parents[1]
DATA_DIR = REPO / "data" / "mushaf" / "digitalkhatt"
HAFS_DB = DATA_DIR / "digital-khatt-v2.db"
SOURCES_DIR = HERE / "sources"
LOCK_FILE = SOURCES_DIR / "sources.lock.json"

DIFF_FORMAT = 2
VERSEMAP_FORMAT = 1
WHOLE_WORD_CATEGORY = {rid: ("major" if rid in N.CLOSE else "mukhtalif") for rid in N.REWAYAT}

# ---------------------------------------------------------------------------
# Skeleton key
# ---------------------------------------------------------------------------

_LETTERS = {chr(c) for c in range(0x0621, 0x064B)} | {"\u0671"}
_VARIANT = {
    "\u0671": "\u0627",  # ٱ
    "\u0622": "\u0627",  # آ
    "\u0623": "\u0627",  # أ
    "\u0625": "\u0627",  # إ
    "\u0649": "\u064A",  # ى
    "\u0626": "\u064A",  # ئ
    "\u0624": "\u0648",  # ؤ
    "\u0629": "\u0647",  # ة
}
_DROP = {"\u0621", "\u0640"}  # ء, tatweel
# Letters that do not join to the following letter (A2).
_NONJOIN = set("\u0627\u0623\u0625\u0622\u0671\u062F\u0630\u0631\u0632\u0648\u0624")


def skel(text: str) -> str:
    return "".join(_VARIANT.get(c, c) for c in text if c in _LETTERS and c not in _DROP)


def _last_letter(text: str) -> str:
    for c in reversed(text):
        if c in _LETTERS:
            return c
    return ""


def can_join(t1: str, t2: str, hafs_slot_text: str) -> bool:
    """A2: join two target tokens without a space inside one Hafs slot."""
    return " " not in hafs_slot_text and _last_letter(t1) in _NONJOIN and skel(t1 + t2) == skel(hafs_slot_text)


# ---------------------------------------------------------------------------
# Alignment
# ---------------------------------------------------------------------------

GAP = 0.7
MERGE = 0.2
BAND = 60


@lru_cache(maxsize=None)
def _cost(a: str, b: str) -> float:
    if a == b:
        return 0.0
    if not a or not b:
        return 1.0
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i] + [0] * len(b)
        for j, cb in enumerate(b, 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb))
        prev = cur
    return prev[-1] / max(len(a), len(b))


def _align_dp(h: list[str], t: list[str]) -> list[tuple[int, int]]:
    """Banded DP between two skeleton lists. Returns the moves (di, dj)."""
    n, m = len(h), len(t)
    if n == 0 or m == 0:
        return [(1, 0)] * n + [(0, 1)] * m
    inf = float("inf")
    lo = [0] * (n + 1)
    hi = [0] * (n + 1)
    for i in range(n + 1):
        c = round(i * m / n)
        lo[i] = max(0, c - BAND)
        hi[i] = min(m, c + BAND)
    dist = [[inf] * (hi[i] - lo[i] + 1) for i in range(n + 1)]
    back: list[list[tuple[int, int] | None]] = [[None] * (hi[i] - lo[i] + 1) for i in range(n + 1)]

    def get(i: int, j: int) -> float:
        if i < 0 or j < lo[i] or j > hi[i]:
            return inf
        return dist[i][j - lo[i]]

    dist[0][0] = 0.0
    for i in range(n + 1):
        for j in range(lo[i], hi[i] + 1):
            if i == 0 and j == 0:
                continue
            best, arg = inf, None
            if i >= 1 and j >= 1:
                v = get(i - 1, j - 1)
                if v < inf:
                    v += _cost(h[i - 1], t[j - 1])
                    if v < best:
                        best, arg = v, (1, 1)
            if i >= 1:
                v = get(i - 1, j)
                if v + GAP < best:
                    best, arg = v + GAP, (1, 0)
            if j >= 1:
                v = get(i, j - 1)
                if v + GAP < best:
                    best, arg = v + GAP, (0, 1)
            if i >= 2 and j >= 1:
                v = get(i - 2, j - 1)
                if v < inf:
                    v += _cost(h[i - 2] + h[i - 1], t[j - 1]) + MERGE
                    if v < best:
                        best, arg = v, (2, 1)
            if i >= 1 and j >= 2:
                v = get(i - 1, j - 2)
                if v < inf:
                    v += _cost(h[i - 1], t[j - 2] + t[j - 1]) + MERGE
                    if v < best:
                        best, arg = v, (1, 2)
            dist[i][j - lo[i]] = best
            back[i][j - lo[i]] = arg
    if get(n, m) == inf:
        raise BuildError("alignment band too narrow")
    moves: list[tuple[int, int]] = []
    i, j = n, m
    while i or j:
        mv = back[i][j - lo[i]]
        assert mv is not None
        moves.append(mv)
        i, j = i - mv[0], j - mv[1]
    moves.reverse()
    return moves


def align(h: list[str], t: list[str]) -> list[tuple[int, int]]:
    """Skeleton-equality anchors (difflib matching blocks), banded DP between them."""
    sm = SequenceMatcher(a=h, b=t, autojunk=False)
    moves: list[tuple[int, int]] = []
    pi = pj = 0
    for a, b, size in sm.get_matching_blocks():
        if a > pi or b > pj:
            moves.extend(_align_dp(h[pi:a], t[pj:b]))
        moves.extend([(1, 1)] * size)
        pi, pj = a + size, b + size
    return moves


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------


class BuildError(Exception):
    pass


@dataclass(frozen=True)
class HafsRow:
    id: int
    location: str
    surah: int
    ayah: int
    word: int
    text: str

    @property
    def is_marker(self) -> bool:
        return N.is_marker(self.text)


@dataclass
class Token:
    raw: str  # KFGQPC token ('' for the P10 pseudo basmala words)
    dk: str  # stored DK text
    verse: int  # target ayah number; 0 for the P10 basmala words
    last_of_verse: bool


@dataclass
class SlotInfo:
    tokens: list[int] = field(default_factory=list)  # target token indexes (surah-local)
    covers_next: bool = False  # P3: this slot's token also covers the next Hafs slot


@dataclass
class Assignment:
    """The final slot assignment of one rewayah (steps 1-5)."""

    rid: str
    verses: list[N.Verse]
    texts: dict[int, str]  # word id -> stored text
    # word id -> (surah, ayah, word, Hafs text, stored words, next words) for
    # every non-blank content slot whose words differ from the Hafs slot
    hl_inputs: dict[int, tuple[int, int, int, str, str, HL.Context]]
    r2h: dict[str, list[str]]
    stats: Counter
    events: list[str]


@dataclass
class Result:
    rid: str
    texts: dict[int, str]  # word id -> stored text
    diff: dict
    versemap: dict
    stats: Counter
    events: list[str]


def load_hafs(db: Path = HAFS_DB) -> list[HafsRow]:
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    try:
        rows = [HafsRow(*r) for r in con.execute("SELECT id, location, surah, ayah, word, text FROM words ORDER BY id")]
    finally:
        con.close()
    if [r.id for r in rows] != list(range(1, len(rows) + 1)):
        raise BuildError("Hafs DB ids are not 1..N")
    return rows


def hafs_schema(db: Path = HAFS_DB) -> str:
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    try:
        (sql,) = con.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='words'").fetchone()
        others = con.execute("SELECT name FROM sqlite_master WHERE name != 'words'").fetchall()
    finally:
        con.close()
    if others:
        raise BuildError(f"Hafs DB has unexpected schema objects {others}")
    return sql


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def verify_source(rid: str) -> Path:
    """Check sources/<rid>.json against sources.lock.json before it is read."""
    lock = json.loads(LOCK_FILE.read_text(encoding="utf-8"))
    entry = lock["sources"].get(rid)
    if entry is None:
        raise BuildError(f"{rid}: no entry in {LOCK_FILE.name}")
    path = SOURCES_DIR / entry["file"]
    got = sha256_file(path)
    if got != entry["sha256"]:
        raise BuildError(f"{rid}: {path.name} sha256 {got} != locked {entry['sha256']}")
    errata = lock.get("errata", {})
    if errata.get("sha256") and sha256_file(SOURCES_DIR / errata["file"]) != errata["sha256"]:
        raise BuildError(f"{errata['file']} sha256 differs from {LOCK_FILE.name}")
    return path


def assign(rid: str, hafs: list[HafsRow], source: Path | None = None) -> Assignment:
    """Align the official text of `rid` to the Hafs slots (steps 1-5)."""
    source = source if source is not None else verify_source(rid)
    verses = N.load_source(source, rid)
    dk_of = dict(zip(((v.surah, v.ayah) for v in verses), N.dk_tokens(verses, rid)))
    by_surah_t: dict[int, list[N.Verse]] = {}
    for v in verses:
        by_surah_t.setdefault(v.surah, []).append(v)
    by_surah_h: dict[int, list[HafsRow]] = {}
    for r in hafs:
        by_surah_h.setdefault(r.surah, []).append(r)

    texts: dict[int, str] = {}
    stats: Counter = Counter()
    events: list[str] = []
    hl_inputs: dict[int, tuple[int, int, int, str, str, HL.Context]] = {}
    r2h: dict[str, list[str]] = {}
    mushaf: list[tuple[HafsRow, SlotInfo]] = []  # every content slot, in reading order

    for surah in range(1, 115):
        rows = by_surah_h[surah]
        content = [r for r in rows if not r.is_marker]
        tverses = by_surah_t[surah]

        # --- target token stream -------------------------------------------
        toks: list[Token] = []
        if surah == 1 and skel(dk_of[(1, 1)][0]) != "\u0628\u0633\u0645":
            # P10: keep the exact Hafs basmala words, unnumbered.
            basmala = [r for r in rows if r.ayah == 1 and not r.is_marker]
            for r in basmala:
                toks.append(Token("", r.text, 0, False))
            stats["P10 fatiha basmala words kept"] += len(basmala)
        for v in tverses:
            dks = dk_of[(v.surah, v.ayah)]
            for k, raw in enumerate(v.tokens):
                toks.append(Token(raw, dks[k], v.ayah, k == len(v.tokens) - 1))
        last_tok_of_verse = {t.verse: i for i, t in enumerate(toks) if t.last_of_verse}

        # --- alignment ------------------------------------------------------
        h_sk = [skel(r.text) for r in content]
        t_sk = [skel(t.dk) for t in toks]
        moves = align(h_sk, t_sk)
        slots = [SlotInfo() for _ in content]
        i = j = 0
        for di, dj in moves:
            if (di, dj) == (1, 1):
                slots[i].tokens.append(j)
                if h_sk[i] != t_sk[j]:
                    stats["1:1 different skeleton"] += 1
                    events.append(f"1:1  {content[i].location} hafs={content[i].text} target={toks[j].dk}")
                else:
                    stats["1:1 same skeleton"] += 1
            elif (di, dj) == (1, 0):
                stats["P2 1:0 Hafs-only slot left blank"] += 1
                events.append(f"1:0  {content[i].location} hafs={content[i].text} -> ''")
            elif (di, dj) == (0, 1):
                tgt = max(i - 1, 0)
                slots[tgt].tokens.append(j)
                stats["P4 0:1 extra target token appended to previous slot"] += 1
                events.append(f"0:1  {content[tgt].location} += {toks[j].dk}")
            elif (di, dj) == (2, 1):
                slots[i].tokens.append(j)
                slots[i].covers_next = True
                stats["P3 2:1 one target token over two Hafs slots"] += 1
                events.append(
                    f"2:1  {content[i].location}+{content[i + 1].location} "
                    f"hafs={content[i].text} {content[i + 1].text} target={toks[j].dk}"
                )
            elif (di, dj) == (1, 2):
                slots[i].tokens.extend([j, j + 1])
                stats["1:2 two target tokens in one Hafs slot"] += 1
                events.append(f"1:2  {content[i].location} hafs={content[i].text} target={toks[j].dk} {toks[j + 1].dk}")
            i += di
            j += dj
        if i != len(content) or j != len(toks):
            raise BuildError(f"{rid} surah {surah}: alignment did not consume both streams")
        for s in slots:
            s.tokens.sort()

        # --- markers on Hafs marker slots (P7) -----------------------------
        placed: set[int] = set()
        run = -1
        k = -1
        running_max: list[int] = []
        for s in slots:
            if s.tokens:
                run = max(run, s.tokens[-1])
            running_max.append(run)
        last_to_verse = {idx: vn for vn, idx in last_tok_of_verse.items()}
        for r in rows:
            if r.is_marker:
                p = running_max[k] if k >= 0 else -1
                vn = last_to_verse.get(p)
                if vn is not None and vn not in placed:
                    texts[r.id] = N.marker(vn)
                    placed.add(vn)
                    stats["Hafs marker slot <- target marker"] += 1
                else:
                    texts[r.id] = ""
                    stats["P7 Hafs marker slot blank (no target verse end here)"] += 1
            else:
                k += 1

        # --- content slot texts (A2 joins, P6 inline markers) ---------------
        for ci, (row, s) in enumerate(zip(content, slots)):
            parts: list[str] = []
            content_parts: list[str] = []
            idx = 0
            while idx < len(s.tokens):
                tj = s.tokens[idx]
                text = toks[tj].dk
                step = 1
                if (
                    idx + 1 < len(s.tokens)
                    and s.tokens[idx + 1] == tj + 1
                    and toks[tj].verse != 0
                    and not toks[tj].last_of_verse
                    and can_join(toks[tj].dk, toks[tj + 1].dk, row.text)
                ):
                    text = toks[tj].dk + toks[tj + 1].dk
                    step = 2
                    stats["A2 token pairs joined without a space"] += 1
                    events.append(f"A2   {row.location} hafs={row.text} -> {text}")
                parts.append(text)
                content_parts.append(text)
                vn = last_to_verse.get(tj + step - 1)
                if vn is not None and vn not in placed:
                    parts.append(N.marker(vn))
                    placed.add(vn)
                    stats["P6 target-only verse number written inline"] += 1
                    events.append(f"P6   {row.location} inline {N.marker(vn)}")
                idx += step
            texts[row.id] = " ".join(parts)
            if len(content_parts) > 1:
                stats["multi-token slots"] += 1
            if not s.tokens:
                stats["blank content slots"] += 1

        missing = set(last_tok_of_verse) - placed
        if missing:
            raise BuildError(f"{rid} surah {surah}: verse markers never placed: {sorted(missing)}")

        # --- verse map (r2h: rewayah verse -> Hafs verse keys, in order) -----
        tv_hafs: dict[int, list[str]] = {}
        for row, s in zip(content, slots):
            hk = f"{row.surah}:{row.ayah}"
            for tj in s.tokens:
                vn = toks[tj].verse
                if vn == 0:
                    continue
                lst = tv_hafs.setdefault(vn, [])
                if hk not in lst:
                    lst.append(hk)
        for vn in sorted(tv_hafs):
            r2h[f"{surah}:{vn}"] = tv_hafs[vn]

        mushaf.extend(zip(content, slots))

    # --- highlight inputs: stored words + the words read after the slot ----
    # (across verse and surah ends: the KFGQPC texts join surahs, e.g. Warsh
    # 93:11 'فَحَدِّثَ اَلَم۟', al-Susi's idgham into the next basmala)
    target_next = [""] * len(mushaf)
    following = ""
    for k in range(len(mushaf) - 1, -1, -1):
        target_next[k] = following
        words = [t for t in texts[mushaf[k][0].id].split(" ") if t and not N.is_marker(t)]
        if words:
            following = words[0]
    for k, (row, s) in enumerate(mushaf):
        if not s.tokens:
            continue
        words_text = " ".join(t for t in texts[row.id].split(" ") if not N.is_marker(t))
        if words_text == row.text:
            continue  # an inline verse marker alone is no reading difference
        base = row.text if not s.covers_next else row.text + " " + mushaf[k + 1][0].text
        hn = k + (2 if s.covers_next else 1)
        hafs_next = mushaf[hn][0].text.split(" ")[0] if hn < len(mushaf) else ""
        surah_end = hn >= len(mushaf) or mushaf[hn][0].surah != row.surah
        basmala_next = surah_end and row.surah < 114 and row.surah + 1 != 9
        ctx = HL.Context(hafs_next, target_next[k], basmala_next)
        hl_inputs[row.id] = (row.surah, row.ayah, row.word, base, words_text, ctx)

    return Assignment(rid, verses, texts, hl_inputs, r2h, stats, events)


def _whole_word(cats: list[tuple[str, list[int]]]) -> bool:
    return any(c == "word" for c, _ in cats)


def make_diff(a: Assignment, sibling: Assignment | None = None) -> tuple[dict, Counter]:
    """Highlight map (contract C2, format 2) of an assignment. `sibling` is
    the assignment of highlights.SIBLING_BASE[a.rid]: a slot with the same
    stored words also gets its whole-word tint."""
    category = WHOLE_WORD_CATEGORY[a.rid]
    stats: Counter = Counter()
    entries: dict[tuple[int, int], dict[str, list]] = {}
    for wid in sorted(a.hl_inputs):
        surah, ayah, word, base, words, ctx = a.hl_inputs[wid]
        cats = HL.classify(base, words, a.rid, ctx)
        if sibling is not None and not _whole_word(cats):
            sib = sibling.hl_inputs.get(wid)
            if sib is not None and sib[4] == words and _whole_word(HL.classify(sib[3], sib[4], sibling.rid, sib[5])):
                cats.insert(0, ("word", []))
                stats[f"whole-word tint from {sibling.rid} (same stored words)"] += 1
        if not cats:
            stats["differs from Hafs, encoding only (no highlight)"] += 1
            continue
        for cat, chars in cats:
            cat_name = category if cat == "word" else cat
            entries.setdefault((surah, ayah), {}).setdefault(cat_name, []).append([word, chars])
            stats[f"highlight {cat_name}"] += 1
    diff: dict = {"__format": DIFF_FORMAT}
    for key in sorted(entries):
        ordered = {}
        for cat in (category, "silah"):
            if cat in entries[key]:
                ordered[cat] = sorted(entries[key][cat], key=lambda e: e[0])
        diff[f"{key[0]}:{key[1]}"] = ordered
    return diff, stats


def build(
    rid: str,
    hafs: list[HafsRow] | None = None,
    source: Path | None = None,
    cache: dict[str, Assignment] | None = None,
) -> Result:
    """Words DB texts, highlight map and verse map of one rewayah. `cache`
    (rid -> Assignment) lets one run align every rewayah only once."""
    hafs = hafs if hafs is not None else load_hafs()
    cache = {} if cache is None else cache
    if source is not None:
        a = assign(rid, hafs, source)
    else:
        if rid not in cache:
            cache[rid] = assign(rid, hafs)
        a = cache[rid]
    sibling = None
    sib_rid = HL.SIBLING_BASE.get(rid)
    if sib_rid is not None:
        if sib_rid not in cache:
            cache[sib_rid] = assign(sib_rid, hafs)
        sibling = cache[sib_rid]
    diff, diff_stats = make_diff(a, sibling)
    versemap = make_versemap(rid, a.verses, a.r2h, hafs)
    return Result(rid, a.texts, diff, versemap, a.stats + diff_stats, list(a.events))


def make_versemap(rid: str, verses: list[N.Verse], r2h_full: dict[str, list[str]], hafs: list[HafsRow]) -> dict:
    counts = N.verse_counts(verses)
    h2r_full: dict[str, list[str]] = {}
    for rk, hks in r2h_full.items():
        for hk in hks:
            h2r_full.setdefault(hk, []).append(rk)
    # Contract C3: entries equal to [same key] are omitted; an empty h2r list
    # is kept for a Hafs verse with no rewayah words (e.g. 1:1 for P10).
    r2h = {k: v for k, v in r2h_full.items() if v != [k]}
    h2r: dict[str, list[str]] = {}
    for hk in dict.fromkeys(f"{r.surah}:{r.ayah}" for r in hafs):
        got = h2r_full.get(hk, [])
        if got != [hk]:
            h2r[hk] = got

    def order(k: str) -> tuple[int, int]:
        s, a = k.split(":")
        return int(s), int(a)

    return {
        "__format": VERSEMAP_FORMAT,
        "rewayah": rid,
        "verseCounts": {str(s): counts[s] for s in range(1, 115)},
        "r2h": {k: r2h[k] for k in sorted(r2h, key=order)},
        "h2r": {k: h2r[k] for k in sorted(h2r, key=order)},
    }


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------


def write_db(path: Path, hafs: list[HafsRow], texts: dict[int, str], schema_sql: str) -> None:
    if path.exists():
        path.unlink()
    con = sqlite3.connect(path)
    try:
        con.execute("PRAGMA page_size = 4096")
        con.execute(schema_sql)
        con.executemany(
            "INSERT INTO words (id, location, surah, ayah, word, text) VALUES (?, ?, ?, ?, ?, ?)",
            [(r.id, r.location, r.surah, r.ayah, r.word, texts[r.id]) for r in hafs],
        )
        con.commit()
        con.execute("VACUUM")
    finally:
        con.close()


def write_json(path: Path, obj: dict) -> None:
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def output_names(rid: str) -> tuple[str, str, str]:
    return f"dk_words_{rid}.db", f"{rid}-diff.json", f"{rid}-versemap.json"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("rewayat", nargs="*", help=f"subset of {', '.join(N.REWAYAT)} (default: all)")
    ap.add_argument("--out-dir", type=Path, help="write the outputs here instead of data/mushaf/digitalkhatt")
    ap.add_argument("--report", action="store_true", help="print every non-trivial alignment event")
    a = ap.parse_args(argv)

    rids = a.rewayat or list(N.REWAYAT)
    unknown = [r for r in rids if r not in N.REWAYAT]
    if unknown:
        print(f"unknown rewayah id(s): {unknown}", file=sys.stderr)
        return 2
    out_dir = (a.out_dir or DATA_DIR).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    import validate_rewayah_db as V  # noqa: E402

    hafs = load_hafs()
    schema = hafs_schema()
    tmp = Path(tempfile.mkdtemp(prefix=".rewayah-build-", dir=out_dir))
    cache: dict[str, Assignment] = {}
    try:
        failures = 0
        for rid in rids:
            try:
                res = build(rid, hafs, cache=cache)
            except (BuildError, N.SourceError) as e:
                print(f"[{rid}] BUILD FAILED: {e}", file=sys.stderr)
                failures += 1
                continue
            db_name, diff_name, map_name = output_names(rid)
            write_db(tmp / db_name, hafs, res.texts, schema)
            write_json(tmp / diff_name, res.diff)
            write_json(tmp / map_name, res.versemap)
            print(f"[{rid}] built:")
            for k, v in sorted(res.stats.items()):
                print(f"    {k}: {v}")
            if a.report:
                for ev in res.events:
                    print(f"    | {ev}")
            ok = V.validate(
                rid,
                db_path=tmp / db_name,
                diff_path=tmp / diff_name,
                versemap_path=tmp / map_name,
                source_path=SOURCES_DIR / f"{rid}.json",
                hafs_db=HAFS_DB,
                glyphs=False,
                out=sys.stdout,
            )
            if not ok:
                failures += 1
        # sibling gate for every narrator pair this run touches (the other
        # member's current files when it was not rebuilt)
        for pair in V.SIBLING_PAIRS:
            if not set(pair) & set(rids):
                continue
            where = {r: (tmp if r in rids else out_dir) for r in pair}
            files = {r: (where[r] / output_names(r)[0], where[r] / output_names(r)[1]) for r in pair}
            missing = [r for r in pair if not all(p.exists() for p in files[r])]
            if missing:
                print(f"== siblings {pair[0]}/{pair[1]}: skipped (no files for {', '.join(missing)} in {where[missing[0]]})")
                continue
            if not V.validate_siblings(pair, files, hafs_db=HAFS_DB, out=sys.stdout):
                failures += 1
        if failures:
            print(f"FAILED: {failures} rewayah build(s) failed; nothing was replaced in {out_dir}", file=sys.stderr)
            return 1
        for rid in rids:
            for name in output_names(rid):
                os.replace(tmp / name, out_dir / name)
        print(f"OK: wrote {len(rids) * 3} files to {out_dir}")
        return 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
