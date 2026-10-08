# Rewayah data pipeline

Builds the seven non-Hafs DigitalKhatt words DBs, highlight maps and verse
maps in `data/mushaf/digitalkhatt/` from the official KFGQPC v2.x texts, and
proves them correct. Quran text is zero-tolerance: every word and every verse
number must match the official source exactly, and the gates below fail the
build or CI on any difference.

| file id | app `RewayahId` | source |
|---|---|---|
| `warsh` | `warsh` | Warsh v2.1 |
| `qaloon` | `qalun` | Qalun v2.1 |
| `bazzi` | `al-bazzi` | al-Bazzi v2.0 (qc2) |
| `qumbul` | `qunbul` | Qunbul v2.0 (qc2) + 1 erratum |
| `doori` | `al-duri-abi-amr` | al-Duri v2.0 |
| `soosi` | `al-susi` | al-Susi v2.0 |
| `shouba` | `shubah` | Shu'bah v2.0 |

## Files

| path | role |
|---|---|
| `sources/<id>.json` | official KFGQPC JSON, byte for byte (see `sources/SOURCES.md`) |
| `sources/errata.json` | corrections backed by another official KFGQPC artifact (one: Qunbul 67:17) |
| `sources/sources.lock.json` | SHA-256 of every source and of `errata.json`, plus provenance |
| `vendor_sources.py` | extracts and verifies the official zips; `--check` verifies the lock (CI) |
| `normalize.py` | the definition of "the normalized official source": parsing, tokenization, KFGQPC → DK conventions, per-rewayah render policy (`--policy` prints it) |
| `build_sibling_rewayah.py` | the builder (alignment, slot policies, markers, highlights, verse maps) |
| `highlights.py` | Release 1 highlight classification (diff JSON format 2) |
| `validate_rewayah_db.py` | independent exact-match validator (+ `--glyphs`, `--marks`) |
| `render_review.json` | the visually reviewed clusters the glyph gate accepts (see [Render review](#render-review)) |
| `highlight_cases.json` | reviewed whole-word highlight decisions the `cases` gate checks (one group per rule of `highlights.py`) |
| `validate.py` | round-trip self-test of the convention map against the DK Hafs DB |
| `compare_outputs.py` | a fresh build must equal the committed files (CI drift check) |
| `requirements-ci.txt` | pinned `uharfbuzz` / `fonttools` for the glyph gate |

## Rebuild

```sh
python3 scripts/rewayah/vendor_sources.py --check        # sources match the lock
python3 scripts/rewayah/build_sibling_rewayah.py         # all 7 (or: ... warsh bazzi)
python3 scripts/rewayah/validate_rewayah_db.py --glyphs  # needs: pip install -r scripts/rewayah/requirements-ci.txt
python3 scripts/rewayah/validate.py
```

The builder writes into a temporary directory (under `scripts/rewayah/.build/`,
git-ignored), runs the validator on the result (and the sibling gate for every
narrator pair it touches), and only then replaces `dk_words_<id>.db`,
`<id>-diff.json` and `<id>-versemap.json` (atomic `os.replace`). A failure
exits non-zero and leaves the committed files untouched. The output is
deterministic: two runs give byte-identical files (`--out-dir DIR` builds
elsewhere). A words DB whose schema and rows equal the existing file is not
replaced, because another SQLite version writes other bytes for the same rows
and the app names its DB copies by sha256 (the committed DBs were written by
SQLite 3.53.3). When the data does change, regenerate the asset manifest
(`node scripts/rewayah/gen-manifest.mjs`, owned by the runtime) so installed
apps re-import the new DBs.

To update a source: put the new official zip in a directory, add its entry
(URL, capture, SHA-256, published MD5 / SHA-1, member, SHA-256) to
`PACKAGES` in `vendor_sources.py`, run `vendor_sources.py --zip-dir DIR`,
rebuild, validate, and record the change in `sources/SOURCES.md`.

## Data model (Release 1)

Every rewayah DB has the same schema and the same 83,668 rows as
`digital-khatt-v2.db` (id, location, surah, ayah, word unchanged): the Hafs
word slots, verse keys and 604-page layout are shared. Only `words.text`
changes:

- `''`: a blank slot (renders nothing, no separator);
- one token, or several tokens joined by single spaces (one word unit for
  layout, taps and highlights);
- a content slot may END with an inline verse marker `۝N` (a rewayah verse end
  with no Hafs marker slot);
- a Hafs marker slot holds the rewayah's `۝N` or `''`;
- `۞` is attached to the following word.

## Algorithm

1. Tokenize each verse (`normalize.parse_verse`): NBSP is a space, RLM
   dropped, the trailing verse number checked against `aya_no`, a standalone
   `۞` attached to the next word, a letterless token glued to the previous
   word (A1).
2. Convert each token (`normalize.dk_tokens`): the KFGQPC → DK convention map
   and the per-rewayah render policy (below). The token read before it is
   passed as context: it decides which of its two meanings a KFGQPC U+06DF
   dot has (`normalize.side_dot_kinds`).
3. Align, per surah, the Hafs content slots with the rewayah tokens on their
   rasm skeleton: skeleton-equality anchors plus a banded dynamic programme
   with the moves 1:1, 1:0, 0:1, 2:1, 1:2.
4. Assign slots:
   - P2: a Hafs-only word leaves its slot `''`; Hafs text never leaks.
   - P3: a token covering two Hafs slots goes in the first, the second is `''`
     (15:7, 27:20, 36:22, 40:26, 73:20, 75:1).
   - P4: an extra token is appended to the previous slot (Ibn Kathir 9:100
     `تَجْرِي مِن`).
   - A2: two tokens in one slot are joined without a space only if the Hafs
     slot is one word, the skeletons match and the first ends in a
     non-joining letter (no case with the v2.x texts).
   - P12: 37:130 keeps both words in the Hafs slot `إِلْ يَاسِينَ`.
   - P10: a source without a basmala verse (Madani and Basri counts) keeps
     the exact Hafs basmala words in 1:1:1-4, the 1:1 marker slot is `''` and
     numbering starts at al-hamdu.
5. Markers: a Hafs marker slot gets `۝v` if the last token consumed so far
   ends rewayah verse v, otherwise `''` (P7). A rewayah verse end with no Hafs
   slot is written inline after its last word (P6), so every surah shows 1..N.
6. Highlights and the verse map are derived from the same assignment. The
   classifier gets each slot's next word in Hafs and in the rewayah (verse
   and surah ends crossed), and Warsh / al-Susi get the whole-word tint that
   Qalun / al-Duri give to the same stored words, so their sibling is aligned
   too.

Per rewayah: blank Hafs marker slots 81 (Nafi'), 83 (Ibn Kathir), 76 (Abu
'Amr), 0 (Shu'bah); inline verse numbers 59 / 67 / 57 / 0. Run the builder
with `--report` to list every non-trivial alignment.

## Render policy (DigitalKhatt font)

`normalize.RENDER_POLICY`; `python3 scripts/rewayah/normalize.py --policy`
prints the full table with meaning, what DK draws, decision and evidence.
Summary:

| rule | rewayat | decision |
|---|---|---|
| U+06DF dot for a softened / changed hamza (`أَ۟ذَا`, `هَٰؤُلَآ۟`) | all but Shu'bah | → U+06EC, DK's tashil dot (DK draws U+06DF as the 'silent letter' circle); a waqf sign after the dot is moved before it (al-Bazzi 34:9, 46:31; Qalun's two carry the omitted Habti sign) |
| U+06DF start-with-damma dot on a silent alef (wasl, Warsh naql) | far rewayat | kept: DK's circle (no dot beside a letter in DK) |
| sukun + U+06DC (69:28) | all | CGJ inserted, as the DK Hafs DB writes it |
| U+06D2 yeh barree | Warsh, Qalun | → U+0649 |
| U+0652 Maghribi sukun | Warsh, Qalun | → U+06DF (circle shape, kept) |
| U+06D6 Habti waqf `ص` | Warsh, Qalun | omitted (DK draws `صلى`, the opposite advice) |
| U+06E4 sajdah overline | all but Nafi' | dropped (`۩` kept) |
| U+06ED taqlil (hollow) dot | Duri, Susi | → U+065C dot below |
| U+06EA dot below | all | → U+065C, incl. the wasl-alef start dot |
| kasra + U+06E2 | far rewayat | → kasra + U+06ED (meem below, as KFGQPC draws it) |
| U+200D hamza seat (17:7) | Duri, Susi | → U+0640 |
| U+066E dotless tooth (6:19) | Bazzi, Qunbul | → U+0649 |
| `ضظ` (81:24) | Bazzi, Qunbul, Duri, Susi | → `ظ` (DK has no small ظ) |
| wasl alef: alef + connecting vowel (+ start dot) | far rewayat | kept verbatim; DK draws the connecting vowel as a Madani vowel (alternatives `ٱ` or alef + start dot evaluated; awaiting a decision) |

Letters are only changed by the three listed mappings (U+06D2, U+066E, `ضظ`);
the validator's letter gate enforces it. Rules marked `confirm` in
`--policy` change what a reader sees and await a qualified reader's decision.

## Highlights (`<id>-diff.json`, format 2)

`{"__format": 2, "s:a": {category: [[wordPos, [charIdx, ...]], ...]}}`, keyed by
Hafs verse and word position:

- `major` (Shu'bah, Bazzi, Qunbul) / `mukhtalif` (Warsh, Qalun, Duri, Susi):
  whole word (`[]`), for words read differently from the Hafs word in that
  slot (letters, including a letter the rewayah never pronounces; long
  vowels, doubling, vowels, case ending, ya' al-idafa and ha' al-kinaya
  vowels; a question read as a statement or the reverse; a hamzat qat' read
  as a wasl alef; imala dots in the close rewayat). Encoding conventions
  (including the hamza's seat) and general rules marked only by diacritics or
  by the hamza's carrier are not highlighted: madd length, imala / taqlil
  dots, the two-hamza rules (idkhal included), Warsh's and al-Susi's ibdal of
  a vowelless hamza, Warsh's naql. Each across-word rule applies only in its
  context: a word-initial hamza may be dropped only as the second of two
  hamzas across words (after a word ending in a voweled hamza) or by Warsh's
  naql (the previous word takes its vowel); a vowel added or dropped on the
  last letter is excused only by Warsh's naql into the next word or al-Susi's
  idgham kabir (a doubled first letter, a meem before ba, a ba before the next
  surah's basmala). Two narrators of one reader that read a slot the same way
  (the same stored words, or encoding-only differences under the sibling's
  rules) get the same decision. See the docstring of `highlights.py`; the
  reviewed decisions in `highlight_cases.json` pin every rule.
- `silah`: char indices (UTF-16 = code points here) of the silah marks
  U+06E5 / U+06E6 and their damma / kasra that this rewayah pronounces where
  Hafs does not.
- No `tashil` / `madd` / `ibdal` / `taghliz` / `minor` in Release 1.

## Verse map (`<id>-versemap.json`, format 1)

`{"__format": 1, "rewayah": id, "verseCounts": {...}, "r2h": {...}, "h2r": {...}}`:
`r2h["s:a"]` lists, in order, the Hafs verse keys of the slots holding that
rewayah verse's words; `h2r` is the inverse (an empty list for a Hafs verse
with no rewayah word, e.g. 1:1 under P10). Entries equal to `[same key]` are
omitted; Shu'bah's maps are empty.

## Gates (`validate_rewayah_db.py`)

- sources lock; row identity with the Hafs DB;
- slot format, DK cmap, no token starting with a combining mark;
- exact reading stream per surah (content and verse markers); verse numbers
  1..N; letter preservation;
- markers: a verse number sits in the first Hafs marker slot after its
  verse's last word (P7); inline only if another word comes before the next
  Hafs marker slot (P6);
- placement: every content slot holds one rewayah word within a skeleton
  distance of 1/3 of the Hafs word in that slot, except the declared
  `PLACEMENT_EVENTS` (P2 / P3 / P4 / 1:2), so a word moved to a neighbouring
  slot fails even if the reading order is intact;
- diff JSON integrity (an entry's words, without an inline marker, must differ
  from Hafs); verse map re-derived from the DB;
- siblings (when both rewayat of a pair are validated: Warsh / Qalun, al-Duri /
  al-Susi, al-Bazzi / Qunbul): a slot holding the same words in both DBs gets
  the same whole-word decision, unless listed in `SIBLING_EXCEPTIONS` (empty);
- cases: every reviewed decision in `highlight_cases.json` holds (the listed
  slots have, or lack, the rewayah's whole-word tint). Add a group when a
  review settles a reading; never edit one to make a build pass;
- `--glyphs` (HarfBuzz, DigitalKhattFont and the V1 font): 0 `.notdef`; every
  cluster absent from the DK Hafs DB is in `render_review.json`; a mark without
  an anchor or turned into a spacing glyph is accepted only for a reviewed
  cluster and context; with all 7 rewayat, an unused review entry fails.
  The DK fonts have no dotted-circle glyph, so broken clusters are checked on
  the text (slot gate).

CI runs all of them (`.github/workflows/quran-data.yml`).

## Render review

`render_review.json` lists every cluster (base letter + mark sequence, as hex
code points) of the rewayah DBs that never occurs in the DK Hafs DB, plus the
clusters the DK fonts draw with a mark left without an anchor (zero offset) or
turned into a spacing glyph. Each entry has a family with a verdict (`ok`:
drawn like the KFGQPC font; `limitation`: a known DK render limit) and, for an
accepted issue, the bases before the cluster (`^` = start of the word) where it
was reviewed, since the joining form decides whether DK has an anchor.

When the glyph gate reports an unreviewed cluster or context: render the word
in DigitalKhattFont (e.g. `hb-view --font-file=data/mushaf/digitalkhatt/DigitalKhattFont.otf`)
next to the official KFGQPC riwayah font, decide whether it reads correctly,
and add or extend the entry (or fix the render policy). Remove entries the
gate reports as unused.
