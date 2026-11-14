<!-- @ai-generated -->
# Per-word readings across the 8 rewayat

> Design written against `develop` at `b0a151ce` (2026-11-14) by a read-only design agent. Decisions that override it are in [README.md](README.md); where they disagree, README.md wins.

## Summary

Ship a build-time per-word readings index, data/mushaf/digitalkhatt/dk_readings.db (SQLite, 1.55 MB, 229 KB gzipped). scripts/rewayah/build_readings_index.py writes it from the committed words DBs and diff JSONs, and it groups the rewayat with the already-reviewed highlights.py comparison code, so no new TypeScript comparison logic is needed.
Only words with something to show get a row: 9,499 spans (12.3% of words). 2,242 have 2–4 distinct readings, 7,089 differ only in silah, 160 only in where a verse ends, and 8 are notes (al-Fatiha's basmala, words written joined or apart). A word with no row reads the same way in all 8 rewayat.
Groups are built in three steps. (1) 'asHafs': Hafs plus every rewayah the diff files leave untinted (a reviewed decision). (2) 'differs': the tinted rewayat, split among themselves by a new highlights.reads_alike that trusts a comparison only when it can read the other text's encoding. (3) 'notRead': only at 57:24:10, where Warsh and Qalun omit the word. A span covers two Hafs slots wherever any rewayah merges them into one word (P3). Per-member details: the rewayah's own text, silah positions, verse-end differences, joined/apart spelling, and the 4 suspected KFGQPC misprints.
At runtime the file goes through a new additive DigitalKhattDataService.readAuxDb('readings'), so it is delivered like the words DBs: content-addressed copy, md5 check, re-import if damaged. WordReadingsService reads one Hafs verse per query and caches it. API: getWordReadings('s:a:w'), getWbwWordReadings(verseKey, wbwPos), request/peek/subscribe; hook: useWordReadings.
UI: WordReadingsSection in the word card shows rows such as «مَٰلِكِ — حفص، شعبة (عاصم)», with the Quran text drawn by Skia in the DigitalKhatt font, a 'Your mushaf' / 'This recitation' badge, notes and a scope footer. New sheets:wordReadings.* keys in en and ar; reader and narrator names reuse content:rewayat.people.*.
Rejected: opening the 7 DBs lazily (24.8 MB of copies, full-table scans, and the grouping rules would have to be rewritten in TypeScript without review), side caches (about 49 MB), and a JSON file inside the JS bundle.
Safeguards: build_readings_index.py --check in quran-data.yml, a Jest *.alldbs check over every slot plus input hashes, a runtime check that the index matches the bundled words DBs, and a reviewed reading_groups_cases.json.

## Current state

## Rewayah data on develop (checked with python3 -I against the committed files)

**The Hafs-location alignment holds.** All 83,668 rows (id, location, surah, ayah, word) are identical in `digital-khatt-v2.db` and the 7 `dk_words_<id>.db` files. Ids run 1..83,668 without gaps: 77,432 content slots and 6,236 verse-marker slots. Only `text` differs (scripts/rewayah/README.md:70-85, docs/features/rewayat.md:28-43).

**Slot grammar.** A slot holds one of:
- `''` (blank);
- several tokens joined by spaces;
- a word ending in an inline `۝N`;
- a Hafs marker slot holding `۝N` or `''`.

Counts match README:124-126:
- blank Hafs marker slots: Warsh/Qalun 81, al-Bazzi/Qunbul 83, al-Duri/al-Susi 76, Shu'bah 0;
- inline markers: 59 / 67 / 57 / 0.

Verse splits and merges seen in the data:
- Warsh and al-Duri 1:7:4 `عَلَي۟هِم۟ ۝٦` (Hafs 1:7 split in two);
- 1:1:5 blank in Warsh, Qalun, al-Duri, al-Susi (basmala unnumbered, P10);
- 2:1:2 blank in al-Bazzi, Warsh, al-Duri (Hafs 2:1-2 merged).

**Blank content slots: exactly 7 locations, none of them in a diff file.**
- P2 (Hafs-only word): 57:24:10 `هُوَ` in Warsh and Qalun.
- P3 (second half of a merged word):
  - 15:7:2 `لَّوْمَا` in all 7;
  - 27:20:5 `مَالِيَ`/`مَالِى`;
  - 36:22:2;
  - 40:26:14 `وَأَن` in Ibn Kathir, Nafi', Abu 'Amr;
  - 73:20:22 `أَلَّن` in Abu 'Amr;
  - 75:1:2 al-Bazzi `لَأُا۟قْسِمُ`.

These, plus P4 9:100:17 (Ibn Kathir `تَجْرِي مِن`) and the two-words-in-one-slot (1:2) cases 37:130:3 / 72:16:1, are declared in `PLACEMENT_EVENTS` (scripts/rewayah/validate_rewayah_db.py:122-136, gate doc at :15-78).

**Raw text is not a reading.** 51,639 of 77,432 content slots differ from Hafs in at least one rewayah, inline markers ignored: Qalun 47,171, Warsh 46,584, al-Susi 21,955, al-Duri 16,519, al-Bazzi/Qunbul 12,467, Shu'bah 663. Most of it is orthography (Maghribi sukun U+06DF, wasl alef `اِ۬`). Even the 1:4:1 example would split, because al-Susi stores `مَّلِكِ` (idgham kabir from ٱلرَّحِيم).

**Diff files, format 2** (services/mushaf/RewayahDiffService.ts:36-57, :75-76, :88-106):
- keys are Hafs `s:a`; word positions are 1-based Hafs DK positions (1:4 → `[[1, []]]`);
- char indices are 0-based UTF-16 into the slot text without its inline marker (scripts/rewayah/highlights.py:1239-1245);
- `major` (close rewayat) and `mukhtalif` (far) mean "read differently at word level"; encoding and general rules (madd, tashil, ibdal, imala, naql, idgham) are excluded (highlights.py:1-158, rewayat.md:98-116);
- letter-level categories exist only in legacy files.

Measured: 2,241 slots carry a whole-word tint in at least one rewayah, and 7,308 carry silah (7,089 of those only silah). Whole-word tints carry decisions still to confirm (rewayat.md:114), and the 4 suspected upstream misprints are tinted as written (rewayat.md:198).

**Hafs words source.** `digital-khatt-v2.db` is loaded as `dk_words.<sha8>.db` (services/mushaf/DigitalKhattDataService.ts:70-77). Its rows are not stored in id order (83,663 have rowid≠id), and no words DB has an index on `id`, so `WHERE id=?` scans the whole table. The 7 others are stored in id order.

The word-by-word data (quran.com `text_uthmani`) uses another encoding. Its positions equal DK positions except 2:181:3, 8:6:4 and 13:37:8, where one WBW `بَعْدَ مَا` covers two DK slots (aligned by text in components/player/v2/PlayerContent/QuranView/WBWVerseView.tsx:403-468).

## Loading and memory today

**DigitalKhattDataService**
- Assets: `DK_DB_ASSETS` (DigitalKhattDataService.ts:28-38) and `REWAYAH_DATA` (:70-127).
- On-device copies are content-addressed, `<base>.<sha8>.db` (:167-231), from the generated manifest. scripts/rewayah/gen-manifest.mjs:48-49 scans this file's `require()` calls, and every EAS build runs the check (package.json `eas-build-pre-install`).
- A copy is imported on first use, md5-checked once per session and re-imported once if damaged (:1362-1488). Stale copies are swept (:1496-1572).
- A whole words DB is read into memory: `SELECT id, text, location FROM words` (:615-636). The main cache is about 14 MB; side caches are about 7 MB each, with at most 1 idle (:684-688, :710-716).
- Other readers: `ensureRewayahLoaded` (:1662-1714), `tryGetVerseWords` (:1851-1855).

**Other services**
- RewayahDiffService holds ONE rewayah's diff at a time (`loadForRewayah` :164-211, `loadDiffAsset` :542-561). Nothing answers "how does every rewayah read word X".
- RewayahVerseUnits is a pure verse-unit model over the slots (RewayahVerseUnits.ts:1-46; marker parsing :60-72). The unnumbered Fatiha basmala belongs to no unit (:20-24, :389-394, :839-848). The service builds one DB's units in about 50 ms under Node (RewayahVerseUnitsService.ts:7-10).
- Other bundled DBs:
  - `assets/data/irab-v1.db` uses a versioned file name (services/irab/IrabDataService.ts:9-16, :47);
  - `wbw-en.db` is imported once with no versioning (services/wbw/WBWDataService.ts:28-56).

## Identity, names, selection, fonts

**Rewayah ids and names**
- RewayahId has 20 slugs (services/rewayah/RewayahIdentity.ts:20-65).
- `hasTextData` covers 8 (:127-140); `RewayahWithDiffs` (:145-166).
- Short and long labels come from `content:rewayah.short|long` (:174-186; en/ar content.json:289-356).

**Readers and narrators** exist only as the registry's `teacher`/`student` strings (data/rewayat.ts:37-348) and as `content:rewayat.people.*` labels in en and ar (data/rewayat.ts:368-410, content.json:444+). There is no RewayahId → reader helper; `CANONICAL_ID_TO_REWAYAH_ID` is private (RewayahIdentity.ts:73-97).

**Selected rewayah**
- The mushaf's is `useMushafSettingsStore.rewayah` (store/mushafSettingsStore.ts:175-186; setter :391-411). Mushaf 1440 pins Hafs (:65-67).
- The verse sheet's is `payload.rewayah ?? mushafRewayah` (components/sheets/VerseActionsSheet.tsx:235-236), with `payload.source` set to 'player' or 'mushaf' (components/sheets/sheets.tsx:213). It is passed to IrabContent (VerseActionsSheet.tsx:867-875).

**Fonts**
- Quran text is drawn with Skia in DigitalKhatt (`getDkFontFamily`, mushafSettingsStore.ts:82-92; IndoPak draws Hafs only). DigitalKhattV1/V2 are also registered for RN Text (services/AppInitializer.ts:379-390).
- WordDetailSheet uses RN Text with the 'Uthmani' font (WordDetailSheet.tsx:268-270).

## Word view today
- IrabContent selects `{verseKey, position}` by WBW position (components/sheets/verse-actions/IrabContent.tsx:102-104). The grid is WBWVerseView (:297-321) and the word card is at :206-250. It is Hafs-aligned (:1-9).
- WordDetailSheet is separate (WordDetailSheet.tsx:46-62). There are no readings anywhere per word (docs/research/surah-app-feature-gaps.md:113).

## Pipeline, CI, licence

**Pipeline.** scripts/rewayah holds the builder, the independent validator, compare_outputs and the reviewed highlight_cases.json.

**CI**
- .github/workflows/quran-data.yml runs: lock check, validate.py, `validate_rewayah_db.py --glyphs`, then a rebuild compared with the committed files.
- .github/workflows/test.yml runs Jest on Node 22 with `BAYAAN_OVERLAY_DB_DIR=bundled`, which enables the *.alldbs suites (node:sqlite via services/mushaf/__fixtures__/bundledDkSqlite.ts, enforced by test-utils/__tests__/allDbSuitesInCi.test.ts).
- Fixtures come from Python generators such as services/mushaf/__fixtures__/gen_verse_units_fixture.py.

**Licence.** No KFGQPC licence or written permission is recorded for the rewayah texts (THIRD_PARTY_LICENSES.md:48-52).

## Design

## 0. Scope

This design covers decision 3: per-word readings of the 8 bundled rewayat, shown in a "Readings" section of decision 2's single word view.
- **How users get there:** only ayah selection, then the word view. There is no new gesture on the mushaf page.
- **Out of scope:** places (decision 5, and the user's message), pictures, tawjih, and the other 6 readers. Gharib and rasm are separate topics.

## 1. Measurements behind the design

| Measure | Value |
|---|---|
| Content slots whose stored text ≠ Hafs (inline marker ignored) | 51,639 (66.7%), in at least one rewayah |
| Slots with a whole-word tint in ≥1 rewayah | 2,241 |
| Number of rewayat tinted per slot | 1→283, 2→705, 3→328, 4→312, 5→122, 6→288, 7→203 |
| Slots with silah | 7,308 (7,089 silah only) |
| Spans in the index (§3) | 9,499 (9,505 rows, 12.3% of words) |

Breakdown of the 9,499 spans:
- 2,242 have ≥2 readings: 2,140 with 2, 95 with 3 and 7 with 4. The 7 are 3:66:1, 3:119:1, 4:109:1 and 47:38:1 هَٰٓأَنتُمْ, 10:35:22, 12:12:4 and 18:77:22.
- 7,089 are silah only.
- 160 differ only in where a verse ends.
- 4 are al-Fatiha's basmala.
- 4 differ only in being written joined or apart.

## 2. Loading strategy

**Decision: a build-time SQLite index.**

| | A. Open the 7 DBs lazily | B. Side-cache all 7 | C. JSON in the JS bundle | **D. `dk_readings.db` (chosen)** |
|---|---|---|---|---|
| First use | Imports up to 7×3.5 MB = 24.8 MB of copies | 7 full reads | Parse about 1.4 MB | Import one 1.55 MB copy (229 KB gzipped) |
| Per word | 8 queries, each a full table scan (no index on id): 31 ms for 8 DBs here, warm; estimate 100–300 ms on a phone | Synchronous | Synchronous | One primary-key-prefix query per Hafs verse (`SEARCH slots USING PRIMARY KEY (verse_key=?)`); 2,000 verse queries take 13.7 ms here |
| Memory | Low | About 49 MB (DigitalKhattDataService.ts:684-688) | About 10 MB of JS heap | One LRU of verses |
| Grouping | Must be rewritten in TypeScript, without review, plus 515 KB of diff JSON in memory | Same as A | Reviewed (Python) | Reviewed (Python) |

D is delivered exactly like the words DBs, by adding it to `DK_DB_ASSETS`. The manifest generator then picks it up automatically.

The `irab-v1.db` pattern (a version in the file name) was rejected. The index changes whenever an erratum changes a words DB, and a forgotten version bump would leave installed apps on a stale index.

## 3. Reading groups

**Spans.** A span is one Hafs content slot, or two when any rewayah has a P3 event there: 15:7:1-2, 27:20:4-5, 36:22:1-2, 40:26:13-14, 73:20:21-22 and 75:1:1-2.
- Each rewayah's span text is its non-blank slot texts joined by one space, with any inline `۝N` removed.
- Both slots of a span get the same readings.
- The builder fails if spans overlap or cross a Hafs verse.

**Groups, in display order:**
1. **asHafs.** Hafs, plus every rewayah with no `major`/`mukhtalif` entry on any slot of the span and a non-blank text. This is the reviewed tint decision. The group's text is Hafs's DK text.
2. **differs.** The tinted rewayat, taken in member order. Each one joins the first group whose first member it `reads_alike`; otherwise it starts a new group. The group's text is the first member's exact text.
3. **notRead.** The span text is blank and the slot is a P2 event. This happens only at 57:24:10, for Warsh and Qalun.

**Member details:**
- `ownText`: for a differs member whose text ≠ the group text, and for any member with silah.
- `silahChars`: copied from the diff file, offset across a span.
- `verseEnd`: the rewayah's own verse number when it ends a verse after the span and Hafs does not; 0 when Hafs ends one there and it does not.
- `wordCount`: for an asHafs member that writes the span as more or fewer words (15:7 `لَّوْمَا`, 72:16 `وَأَن لَّوِ`).
- `questioned`: the text is listed as a suspected misprint (§5.3).

**Results on real data (prototype run against develop's files):**
- 1:4:1: `مَٰلِكِ` Hafs, Shu'bah | `مَلِكِ` al-Bazzi, Qunbul, Warsh, Qalun, al-Duri, al-Susi (al-Susi's own text is `مَّلِكِ`).
- 2:9:6: `يَخْدَعُونَ` Hafs, Shu'bah | `يُخَٰدِعُونَ` the other six.
- 12:12:4: four groups, one per reader: `يَرْتَعْ` / `نَّرْتَعِ` / `يَر۟تَعِ` / `نَّرْتَعْ`.
- 10:35:22: `يَهِدِّيٓ` Hafs | `يِهِدِّيٓ` Shu'bah | `يَهَدِّي` al-Bazzi, Qunbul, Warsh | `يَه۬دِّى` Qalun, al-Duri, al-Susi.
- 40:26:13 and :14: `أَوْ أَن` | `وَأَن`.
- 75:1:1-2: al-Bazzi `لَأُا۟قْسِمُ` and Qunbul `لَا۟ أُقْسِمُ` in one group.
- 57:24:10: notRead for Warsh and Qalun.
- 2:85:18: al-Bazzi and Qunbul (with silah) together with al-Duri and al-Susi.

**Why the new comparison is safe.**
- The line between asHafs and differs is the reviewed tint. Only how the differing rewayat split among themselves is new.
- `reads_alike` (§5.1) trusts the reviewed `_word_differs` (highlights.py:1053-1113) only when the target's rules can read the reference text's encoding. When in doubt it splits, which shows an extra group, and never merges.

How the prototype joined two rewayat into one group:

| Basis | Joins |
|---|---|
| Identical text | 3,638 |
| Both directions agree | 147 |
| One direction, across encodings (e.g. Warsh `عَه۟دِيَ` with Shu'bah `عَهْدِيَ`, 2:124:18) | 1,484 |
| One direction, both encodings readable, i.e. a general rule excuses the difference (al-Susi `مَّلِكِ`, `يَامُرْكُمْ` 2:67:7) | 65 |

The last 65 are the review list (§5.3).

## 4. Index file: `data/mushaf/digitalkhatt/dk_readings.db`

### Schema

```sql
CREATE TABLE info (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
-- format  = '1'
-- rewayat = 'hafs,shubah,al-bazzi,qunbul,warsh,qalun,al-duri-abi-amr,al-susi'   (member order = ALL_REWAYAH_IDS order)
-- inputs  = JSON {"digital-khatt-v2.db": sha256, "dk_words_<id>.db": sha256 ×7, "<id>-diff.json": sha256 ×7}
CREATE TABLE slots (
  verse_key TEXT NOT NULL,     -- Hafs "s:a"
  position  INTEGER NOT NULL,  -- Hafs DK word position (1-based; marker slots never stored)
  word_id   INTEGER NOT NULL,  -- words.id (same in every words DB)
  data      TEXT NOT NULL,     -- row JSON, format 1
  PRIMARY KEY (verse_key, position)
) WITHOUT ROWID;
```

A word with no row reads the same way in all 8 rewayat at word level. The file is rewritten only when its rows change, the policy the words DBs already follow (scripts/rewayah/README.md:48-60).

### Row JSON, format 1

`member` is an index into `info.rewayat`.

```ts
interface ReadingsRow {
  t: string[];                                  // exact stored span texts ('' only for a notRead group)
  g: [kind: 'h' | 'd' | 'o', text: number, members: number[]][]; // g[0] is 'h' and contains 0 (Hafs)
  m?: Record<string, {x?: number; s?: number[]; v?: number; w?: number; q?: 1}>;
  span?: [firstWordId: number, lastWordId: number];
  u?: number[];                                 // 1:1:1-4 only: members that do not number the Fatiha basmala
}
```

Real rows from the prototype:
- 1:4:1: `{"t":["مَٰلِكِ","مَلِكِ","مَّلِكِ"],"g":[["h",0,[0,1]],["d",1,[2,3,4,5,6,7]]],"m":{"7":{"x":2}}}`
- 57:24:10: `{"t":["هُوَ",""],"g":[["h",0,[0,1,2,3,6,7]],["o",1,[4,5]]]}`
- 40:26:13 and :14: `{"t":["أَوْ أَن","وَأَن","وَأَن۟"],"g":[["h",0,[0,1]],["d",1,[2,3,4,5,6,7]]],"m":{"4":{"x":2},"5":{"x":2}},"span":[64679,64680]}`
- 1:7:4: `{"t":["عَلَيْهِمْ","عَلَيْهِمُۥ"],"g":[["h",0,[0,1,2,3,4,5,6,7]]],"m":{"2":{"x":1,"s":[9,10]},"3":{"x":1,"s":[9,10]},"4":{"v":6},"5":{"v":6},"6":{"v":6},"7":{"v":6}}}`
- 1:1:1: `{"t":["بِسْمِ"],"g":[["h",0,[0,1,2,3,4,5,6,7]]],"u":[4,5,6,7]}`

## 5. Build side (Python, `# @ai-generated` / `# @ai-start…end`)

### 5.1 `scripts/rewayah/highlights.py`

New code only; `classify` is unchanged.

```python
ENCODING = {"shouba": "hafs", "bazzi": "hafs", "qumbul": "hafs",
            "doori": "abuamr", "soosi": "abuamr", "warsh": "nafi", "qaloon": "nafi"}
READABLE = {"hafs": frozenset({"hafs"}), "abuamr": frozenset({"hafs", "abuamr"}),
            "nafi": frozenset({"hafs", "abuamr", "nafi"})}  # only the Nafi' rules read U+06DF as a sukun

@dataclass(frozen=True)
class Side:
    rid: str
    text: str            # span words, inline marker removed
    prev: str = ""       # Context conventions (build_sibling_rewayah.py:524-556)
    next: str = ""
    basmala_next: str = ""

def reads_alike(a: Side, b: Side, surah_start: bool = False) -> bool:
    """Same stored words; or reads_like_sibling() (siblings, highlights.py:1184-1209); or, for (x, y) in
    ((a, b), (b, a)): ENCODING[x.rid] in READABLE[ENCODING[y.rid]] and not _word_differs(x.text, y.text,
    y.rid, Context(x.next, y.next, y.basmala_next, x.prev, y.prev, surah_start))."""
```

### 5.2 `scripts/rewayah/build_readings_index.py` (new)

Usage: `python3 -B scripts/rewayah/build_readings_index.py [--check] [--out PATH] [--report]`.

**Inputs:**
- the 8 committed DBs (asserts identical rows);
- the 7 diffs (asserts `__format == 2` and only the categories major, mukhtalif and silah; anything else fails);
- `validate_rewayah_db.PLACEMENT_EVENTS`;
- `sources/basmala.json` through normalize, for `basmala_next`;
- the two reviewed files in §5.3.

**Gates. The build fails on any of these:**
- **G1** Row identity.
- **G2** Partition: every member appears in exactly one group. `'h'` holds Hafs and exactly the untinted non-blank rewayat, `'d'` exactly the tinted ones, `'o'` exactly the P2 blanks.
- **G3** Every referenced `t` entry equals a member's database text. Text is never synthesised.
- **G4** `s` equals the diff silah entries (offset across a span) and points at U+06E5/U+06E6 or its carrier vowel.
- **G5** Completeness. Every content slot without a row has no tint, no silah and no blank, the same token count as Hafs and the same verse-end presence, and is not in 1:1.
- **G6** `reading_groups_cases.json` holds.
- **G7** Every misprint entry still matches the stored text, so a stale entry fails.
- **G8** Output is deterministic: rows sorted, `json.dumps(sort_keys=True, separators=(',', ':'), ensure_ascii=False)`.

**Modes:**
- Default: write the DB through a temp file and `os.replace`.
- `--check`: rebuild in memory, run the gates, then compare schema and rows with the committed DB in compare_outputs.py style (bytes compared only when the same SQLite version wrote both).
- `--report`: Markdown for the qualified reader. It lists the 102 spans with ≥3 readings, the 65 joins where one rewayah's general rules excused the difference, and every `toConfirm` entry.

### 5.3 Reviewed data files (new)

**`scripts/rewayah/reading_groups_cases.json`** has the shape `{"__doc", "groups":[{"rule", "spans":{"1:4:1":[["hafs","shouba"],["bazzi","qumbul","warsh","qaloon","doori","soosi"]]}}], "toConfirm":[...]}` and uses file ids, like highlight_cases.json. Seed groups:
- General rules do not split a reading: 1:4:1, 2:67:7, 2:85:18.
- Distinct readings stay apart: 12:12:4, 10:35:22, 3:66:1, 18:77:22.
- Spans: 15:7:1, 40:26:13, 75:1:1.
- Not read: 57:24:10.
- `toConfirm`: 33:4:12, 58:2:12, 65:4:1, 65:4:12. The prototype puts Warsh `اُ۬لٜى۟` with al-Bazzi and Abu 'Amr there.

**`scripts/rewayah/reading_upstream_issues.json`** lists the four suspected KFGQPC misprints (rewayat.md:198). Each entry is `{rid, location, text, note}`:

| Rewayah | Location | Stored text |
|---|---|---|
| Qunbul | 4:136:14 | `أُنزَلَ` |
| Qalun | 17:62:1 | `قَال۟` |
| Warsh | 43:58:10 | `جَدَلاَ` |
| al-Duri | 43:78:2 | `جِّئْنَٰكُم` |

All four currently form their own reading groups. Each entry sets `q:1` on that member.

### 5.4 CI, docs and licence

- quran-data.yml: add a step after the rebuild compare, `python -B scripts/rewayah/build_readings_index.py --check`.
- scripts/rewayah/README.md: add the new files to the Files table, and add "Rebuild: builder → build_readings_index.py → `node scripts/rewayah/gen-manifest.mjs`".
- docs/features/rewayat.md: a new "Per-word readings" section and a Key files entry.
- THIRD_PARTY_LICENSES.md:50: list `dk_readings.db` among the KFGQPC-derived files.

## 6. Runtime (TypeScript)

### 6.1 `services/mushaf/DigitalKhattDataService.ts` (additive, `// @ai-start/end`)

```ts
// DK_DB_ASSETS (:28-38) gains:
'dk_readings.db': require('../../data/mushaf/digitalkhatt/dk_readings.db'),
export type DkAuxDbId = 'readings';
const AUX_DB_DATA: Readonly<Record<DkAuxDbId, {dbName: string; assetFile: DkDbAssetFile; table: BundledDbSpec['table']}>> =
  {readings: {dbName: 'dk_readings.db', assetFile: 'dk_readings.db', table: 'slots'}};
// BundledDbSpec.table (:345): 'words' | 'pages' | 'slots'
// getCurrentDbNamesByBase() (:316-337) also maps the AUX_DB_DATA bases, so sweeps and resetDatabases cover old copies.
export function getAuxDbIdentity(id: DkAuxDbId): string;              // sha8 of the asset
export function getBundledAssetSha256(file: string): string | null;    // REWAYAH_DATA_MANIFEST lookup
class DigitalKhattDataService {
  /** Runs `read` on the verified on-device copy of an auxiliary DB (content-addressed import, md5 once per
   *  session, delete + re-import once when unreadable), opened for this call under the per-file lock.
   *  Rejects when it stays unreadable. Never touches the main or side caches. */
  readAuxDb<T>(id: DkAuxDbId, read: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T>;
}
```

Then run `node scripts/rewayah/gen-manifest.mjs`.

### 6.2 `services/mushaf/wordReadingsFormat.ts` (new, `@ai-generated`, pure)

This mirrors the irabFormat/IrabDataService split.

```ts
export const READINGS_FORMAT = 1;
export const READINGS_REWAYAT = ['hafs','shubah','al-bazzi','qunbul','warsh','qalun','al-duri-abi-amr','al-susi'] as const;
export type ReadingsRewayah = (typeof READINGS_REWAYAT)[number];
export const WHOLE_WORD_CATEGORY: Readonly<Record<Exclude<ReadingsRewayah,'hafs'>, 'major' | 'mukhtalif'>>; // close → major, far → mukhtalif
export type ReadingGroupKind = 'asHafs' | 'differs' | 'notRead';
export interface ReadingMember {
  readonly rewayah: ReadingsRewayah;
  readonly ownText: string | null;           // exact text when not the group's
  readonly category: 'major' | 'mukhtalif' | null; // diff-file category (differs members)
  readonly silahChars: readonly number[];    // UTF-16 into ownText ?? group text
  readonly verseEnd: number | null;          // own verse number / 0 / null = as Hafs
  readonly wordCount: number | null;         // written as N words when ≠ Hafs (asHafs only)
  readonly questioned: boolean;              // suspected misprint under review
}
export interface ReadingGroup { readonly kind: ReadingGroupKind; readonly text: string; readonly members: readonly ReadingMember[] }
export interface WordReadings {
  readonly verseKey: string;                 // Hafs verse key
  readonly positions: readonly number[];     // Hafs DK positions the groups cover (span)
  readonly hafsText: string | null;          // asHafs text; null for a word with no row
  readonly groups: readonly ReadingGroup[];  // asHafs, differs…, notRead
  readonly alike: boolean;                   // one group, no member detail, no basmala note
  readonly basmalaUnnumberedIn: readonly ReadingsRewayah[];
}
export class ReadingsFormatError extends Error { readonly location: string }
export function parseReadingsInfo(rows: readonly {key: string; value: string}[]): {format: number; rewayat: readonly string[]; inputs: Readonly<Record<string, string>>};
export function decodeReadingsRow(verseKey: string, position: number, wordId: number, data: string): WordReadings; // validates every invariant of §4, throws ReadingsFormatError
export function alikeReadings(verseKey: string, positions: readonly number[]): WordReadings;
export function combineReadings(parts: readonly WordReadings[]): WordReadings;  // a WBW word over two DK slots
export const WBW_JOINED_WORDS: Readonly<Record<string, number>> = {'2:181': 3, '8:6': 4, '13:37': 8};
export function dkPositionsForWbwWord(verseKey: string, wbwPosition: number): number[];
export function findGroup(readings: WordReadings, rewayah: RewayahId): ReadingGroup | null;
```

### 6.3 `services/mushaf/WordReadingsService.ts` and `hooks/useWordReadings.ts` (new, `@ai-generated`)

```ts
export interface ReadingsSlotRecord { position: number; word_id: number; data: string }
export interface ReadingsDbReader {
  readInfo(): Promise<readonly {key: string; value: string}[]>;
  readVerse(hafsVerseKey: string): Promise<readonly ReadingsSlotRecord[]>; // SELECT position, word_id, data FROM slots WHERE verse_key = ?
}
export const dkReadingsDbReader: ReadingsDbReader; // via digitalKhattDataService.readAuxDb('readings', …)
export interface VerseReadings { readonly verseKey: string; readonly byPosition: ReadonlyMap<number, WordReadings> }
export type VerseReadingsStatus = 'idle' | 'loading' | 'ready' | 'error';
export class WordReadingsService {
  constructor(reader?: ReadingsDbReader, options?: {maxVerses?: number /* LRU, 64 */; expectedInputs?: () => Readonly<Record<string, string>>});
  request(verseKey: string): Promise<VerseReadings | null>;  // one query; never rejects
  peek(verseKey: string): VerseReadings | null;              // safe to call during render
  getStatus(verseKey: string): VerseReadingsStatus;
  getError(verseKey: string): unknown;
  retry(verseKey: string): Promise<VerseReadings | null>;
  getWordReadings(hafsLocation: string): Promise<WordReadings>;                      // "s:a:w"; rejects on error
  getWbwWordReadings(verseKey: string, wbwPosition: number): Promise<WordReadings>;
  readonly subscribe: (listener: () => void) => () => void;  // useSyncExternalStore
  readonly getVersion: () => number;
}
export function readingsAt(verse: VerseReadings, positions: readonly number[]): WordReadings;
export const wordReadingsService: WordReadingsService;
// hooks/useWordReadings.ts (pattern of hooks/useRewayahVerseUnits.ts:106-151)
export type WordReadingsResult =
  | {status: 'loading'}
  | {status: 'ready'; readings: WordReadings; dkPositions: readonly number[]}
  | {status: 'error'; retry: () => void};
export function useWordReadings(verseKey: string, wbwPosition: number): WordReadingsResult;
```

**Runtime guard.** Once per service instance it checks that `format === READINGS_FORMAT`, that `rewayat` equals `READINGS_REWAYAT`, and that `inputs` for the 8 words DB assets equal `REWAYAH_DATA_MANIFEST`. If any check fails, every verse reports 'error' and a console.error is logged. Readings from another data build are never shown.

Malformed rows:
- A malformed row fails that word only: its readings are not shown, and nothing is guessed.
- A position with no row gets `alikeReadings`.

### 6.4 `services/rewayah/RewayahIdentity.ts` (additions)

```ts
export type QariId = 'nafi' | 'ibnKathir' | 'abuAmr' | 'ibnAmir' | 'asim' | 'hamzah' | 'kisai' | 'abuJafar' | 'yaqub' | 'khalafAlBazzar';
export function getQari(id: RewayahId): QariId;           // total over all 20 slugs
export function getQariLabel(qari: QariId): string;       // i18n.t(`content:rewayat.people.${qari}`)
export function getNarratorLabel(id: RewayahId): string;  // people key: hafs, shubah, bazzi, qunbul, warsh, qalun, duri, susi, …
```

`getNarratorLabel` returns "Al-Duri", not the short label "Al-Duri (Abu Amr)", which avoids doubled parentheses inside a reader cluster.

## 7. Readings section (UI)

### 7.1 Files

| File | Contents |
|---|---|
| `components/sheets/verse-actions/WordReadingsSection.tsx` (new) | `React.FC<{verseKey: string; wbwPosition: number; contextRewayah: RewayahId; contextSource: 'mushaf' \| 'player'}>` |
| `components/sheets/verse-actions/ReadingText.tsx` (new) | `{text; rewayah: ReadingsRewayah; fontSize; silahChars?; maxWidth; accessibilityLabel?}` |
| `components/sheets/verse-actions/wordReadingsLabels.ts` (new, pure) | `clusterByQari`, `formatNarrators(rewayat, t)`, `formatNames(rewayat, t)`, `readingNotes(readings, dkPositions): {span: 'next' \| 'previous' \| null; joined; apart; verseEnds: {verse; rewayat}[]; noVerseEnd; basmalaUnnumbered; questioned}` |

`ReadingText` uses Skia and the DigitalKhatt font through `getDkFontFamily(mushafRenderer, rewayah)`. It reuses `buildWordParagraph`, moved unchanged from WBWVerseView.tsx:152-219 into `components/player/v2/PlayerContent/QuranView/wordParagraph.ts`. Silah characters get `charToRule = 'silah'`, which paints them in `tajweedColors.silah`. Until the font manager is ready it shows an empty placeholder of the line height; it never falls back to another font.

### 7.2 Placement and fast access

- The section sits in the word card in decision 2's order: … i'rab, morphology, **Readings**, gharib, rasm.
- When the word view opens it calls `wordReadingsService.request(part.verseKey)` for each Hafs part (`wbwParts`, verseUnitScreens.ts:151-162). Tapping a word then renders its readings from the cache.
- A "Readings" chip in the card header appears when there are ≥2 readings and scrolls to the section.
- Optional: a dot under such words in the grid.

### 7.3 Layout

1. A small uppercase header `wordReadings.title` (`latinLetterSpacing`).
2. A summary line: `alike`, `alikeWithSilah` or `differs`.
3. A span note, `readTogetherNext` or `readTogetherPrevious`, when the readings cover more positions than the selected word.
4. A card (card pattern, CONTRIBUTING.md:248-260) with one row per group:
   - `ReadingText` for the group text;
   - a narrators line built with `formatNarrators`: clusters `{{narrators}} ({{reader}})` joined by ` · `, for example «حفص، شعبة (عاصم)»;
   - badges.
   - **differs rows** add a 3pt leading bar in `REWAYAH_DIFF_BACKGROUND` (no new hex value) and a caption `differsFromHafs`. Under them, one line per member with its own text: the narrator label, then that member's `ReadingText` with silah coloured.
   - **notRead rows** show the `notRead` label instead of Quran text.
5. Notes: joined or apart spelling, verse ends, Fatiha basmala, questioned texts, context not covered.
6. A footer with `scope` and `source`.

**States:**
- Loading: ActivityIndicator, minHeight 44.
- Error: `loadFailed`, plus a 44pt Pressable "Try again" (`common:actions.tryAgain`, `accessibilityRole='button'`, `useHover()`).
- A word with no row: the summary `alike`. When the context rewayah ≠ Hafs and its words are in memory (`tryGetVerseWords`), also one row "Your mushaf (Warsh)" with its slot text. A Warsh reader then sees `يُومِنُونَ`, not only the Hafs word in the header.

### 7.4 Context badges

- "Your mushaf" goes on `useMushafSettingsStore.rewayah`. That is Hafs under Mushaf 1440, and the Hafs shown during a startup fallback.
- "This recitation" goes on the sheet's rewayah when `contextSource === 'player'` and it differs from the mushaf's.
- If the context rewayah has no text data: show the note `contextNotCovered`.
- Group order never changes: Hafs first, as in the task's example.

### 7.5 Design standards

| Rule | Where | How the section meets it |
|---|---|---|
| Quran text only in DigitalKhatt, never in a UI font | ipad-standards.md:118 | All Quran text goes through `ReadingText` |
| Arabic line pitch ≥ 2.0× | :133 | Reading scale: about moderateScale(24) on phones, 28 on tablets; member lines at 0.8× |
| Labels from the type ramp | — | callout for narrators, footnote for notes, caption for badges |
| Rows grow with Dynamic Type, no fixed heights | :140 | minHeight only |
| Lay out from the sheet's width | :301 | `useSheetWidth()` |
| Secondary text ≥ 0.8 alpha | :422 | Applied to captions, notes and footer |
| RTL with start/end and row flexDirection | :426 | No hard-coded left/right |
| Accessible rows | — | Each group row is `accessible`, labelled `groupA11y` |
| 44pt targets | :244 | Rows are not interactive; only Retry is, at 44pt |

### 7.6 Names

| Where | Source |
|---|---|
| Narrators inside a cluster | `getNarratorLabel` |
| Readers | `getQariLabel` |
| Standalone lists in notes | `getShortLabel` (content:rewayah.short.*) |

Lists are joined with `listSeparator`. All of these keys already exist in en and ar (content.json:289-356 and 444+).

## 8. New i18n keys (namespace `sheets`)

en:
```json
"wordReadings": {
  "title": "Readings",
  "alike": "Read the same way in all 8 rewayat",
  "alikeWithSilah": "Read the same way in all 8 rewayat; silah in {{names}}",
  "differs": "Read differently across the rewayat",
  "narrators": "{{narrators}} ({{reader}})",
  "listSeparator": ", ",
  "clusterSeparator": " · ",
  "differsFromHafs": "Differs from Hafs",
  "notRead": "Not read",
  "silah": "Silah",
  "inMushaf": "Your mushaf",
  "inRecitation": "This recitation",
  "readTogetherNext": "Read together with the next word",
  "readTogetherPrevious": "Read together with the previous word",
  "writtenJoined": "Written as one word in {{names}}",
  "writtenApart": "Written as two words in {{names}}",
  "verseEndHere": "Verse {{verse}} ends after this word in {{names}}",
  "noVerseEndHere": "No verse ends after this word in {{names}}",
  "basmalaUnnumbered": "Bismillah is not counted as a verse of al-Fatiha in {{names}}",
  "questioned": "As printed in the KFGQPC text of {{names}}; a suspected misprint under review",
  "contextNotCovered": "{{rewayah}} is not one of the 8 rewayat covered",
  "scope": "Covers 8 rewayat from 4 of the 10 readers. Differences in pronunciation rules, such as madd length, tashil and imala, are not listed.",
  "source": "Text of each rewayah from the KFGQPC riwayah editions.",
  "loadFailed": "Couldn't load the readings.",
  "groupA11y": "{{text}}, read by {{narrators}}"
}
```

ar:
```json
"wordReadings": {
  "title": "القراءات",
  "alike": "تُقرأ بوجه واحد في الروايات الثماني",
  "alikeWithSilah": "تُقرأ بوجه واحد في الروايات الثماني، مع الصلة عند {{names}}",
  "differs": "تختلف قراءتها بين الروايات",
  "narrators": "{{narrators}} ({{reader}})",
  "listSeparator": "، ",
  "clusterSeparator": " · ",
  "differsFromHafs": "تختلف عن حفص",
  "notRead": "لا تُقرأ",
  "silah": "الصلة",
  "inMushaf": "مصحفك",
  "inRecitation": "هذه التلاوة",
  "readTogetherNext": "تُقرأ مع الكلمة التي بعدها",
  "readTogetherPrevious": "تُقرأ مع الكلمة التي قبلها",
  "writtenJoined": "تُكتب كلمةً واحدة عند {{names}}",
  "writtenApart": "تُكتب كلمتين عند {{names}}",
  "verseEndHere": "تنتهي الآية {{verse}} بعد هذه الكلمة عند {{names}}",
  "noVerseEndHere": "لا تنتهي آيةٌ بعد هذه الكلمة عند {{names}}",
  "basmalaUnnumbered": "لا تُعدّ البسملة آيةً من الفاتحة عند {{names}}",
  "questioned": "كما طُبعت في نص مجمع الملك فهد لرواية {{names}}؛ ويُشتبه في خطأ مطبعي قيد المراجعة",
  "contextNotCovered": "رواية {{rewayah}} ليست من الروايات الثماني المشمولة",
  "scope": "تشمل ثماني روايات لأربعة من القرّاء العشرة. ولا تُذكر الفروق في أحكام الأداء كمقادير المد والتسهيل والإمالة.",
  "source": "نص كل رواية من إصدارات مجمع الملك فهد لطباعة المصحف الشريف.",
  "loadFailed": "تعذّر تحميل القراءات.",
  "groupA11y": "{{text}}، بقراءة {{narrators}}"
}
```

None of these keys is a plural key. Quran text is never stored in locale files; it is drawn by `ReadingText` (docs/i18n/README.md rule 3).

## 9. Edge cases

| Case | Data | Index | UI |
|---|---|---|---|
| Silah only (7,089 slots) | diff `silah` | one 'h' group; members get `x` and `s` | `alikeWithSilah` plus a row with the silah coloured |
| Hafs-only silah (Warsh 25:69 `فِيهِ`) | classified as a whole-word difference | 'd' | Normal differs row |
| Letter-level legacy categories | Not in Release 1 | The builder refuses a non-format-2 file or any other category; the app never reads the diff files for readings | Never shown |
| P2 blank | 57:24:10 | 'o' | "Not read" with Warsh, Qalun (Nafi') |
| P3 merged words | The 6 pairs | `span`, texts of both slots | `readTogether*` note; `writtenJoined` |
| P4 / 1:2 | 9:100:17 (differs); 37:130:3; 72:16:1 | Text as stored; `w` | `writtenApart` (72:16) |
| Inline `۝N` | 57–67 per rewayah | Stripped; `v` | `verseEndHere` |
| Blank Hafs marker slot | 76–83 per rewayah | `v: 0` on the word before | `noVerseEndHere` |
| Fatiha basmala, Madani/Basri counts | 1:1:5 blank in 4 DBs; untinted by design | `u` | `basmalaUnnumbered`. Not reachable from a Warsh mushaf, because it belongs to no unit (RewayahVerseUnits.ts:389-394) |
| Marker slots as words | — | Never stored | Not selectable |
| WBW `بَعْدَ مَا` (2:181:3, 8:6:4, 13:37:8) | One WBW word = two DK slots | — | `dkPositionsForWbwWord` → `combineReadings` |
| Suspected misprints | 4 texts | `q` | `questioned` note |
| Context rewayah without text (e.g. a Hisham track) | — | — | `contextNotCovered` |
| Index unreadable or from another build | — | — | Error and Retry; never partial data |

## 10. Tests and fixtures

**Python (run in CI by quran-data.yml)**
- `build_readings_index.py --check`: gates G1–G8 and rows equal to the committed DB.
- The existing validator and compare_outputs must stay green after the highlights.py addition, which proves `classify` did not change.

**Fixture**
- `services/mushaf/__fixtures__/gen_word_readings_fixture.py`, run as `python3 -I … --db-dir data/mushaf/digitalkhatt --out wordReadingsFixture.json`, writes `wordReadingsFixture.json`.
- It contains `info` plus the rows for 1:1:1, 1:1:4, 1:4:1, 1:7:4, 2:1:1, 2:9:6, 2:54:16, 2:67:7, 2:85:18, 3:66:1, 9:100:17, 10:35:22, 12:12:4, 15:7:1-2, 27:20:4-5, 37:130:3, 40:26:13-14, 57:24:10, 72:16:1, 73:20:21-22, 75:1:1-2, 17:62:1, and the unindexed 2:181:3-4.
- Next to each row it writes the EXPECTED groups, computed independently from the DBs and diffs (not from the index).

**Jest**

| Test file | What it checks |
|---|---|
| `services/mushaf/__tests__/wordReadingsFormat.test.ts` | Decoding against the fixture's expectations. Malformed rows (bad JSON, unknown kind, duplicate or missing member, index out of range, first group not 'h', silah index out of range, unknown format) → `ReadingsFormatError`. `combineReadings`. `dkPositionsForWbwWord`. |
| `services/mushaf/__tests__/WordReadingsService.test.ts` (fake reader) | One query per verse and caching. A missing row reads alike. Read failure → 'error' → retry. Info mismatch → every verse 'error'. A malformed row fails only its word. LRU eviction. Subscribers are notified. |
| `hooks/__tests__/useWordReadings.test.tsx` | Loading, then ready; error, then retry. |
| `services/mushaf/__tests__/dkReadingsIndex.alldbs.test.ts` (node:sqlite; skips like the other *.alldbs suites) | Every row decodes. For every content slot: groups agree with the 7 diff files, text equality with the DBs, and the conditions for slots with no row. `info.inputs` equals the sha256 of the files. WBW/DK position mismatches are exactly `WBW_JOINED_WORDS`, checked against `data/wbw/wbw-en.db`. |
| `services/mushaf/__tests__/DigitalKhattDataService.test.ts` (extend the fake SQLite) | `readAuxDb` imports `dk_readings.<sha8>.db`, re-imports a damaged copy once, sweeps old readings copies but never an open one, and never changes `cacheVersion`. |
| `rewayahDataManifest.test.ts` | Unchanged; passes once the manifest is regenerated. |
| `services/rewayah/__tests__/RewayahIdentity.qari.test.ts` | `getQari` covers all 20 slugs; the labels resolve in en and ar. |
| `components/sheets/verse-actions/__tests__/wordReadingsLabels.test.ts` | Cluster order; separators; no doubled parentheses; `readingNotes`. |
| `components/sheets/verse-actions/__tests__/WordReadingsSection.test.tsx` | Mocks `ReadingText` the way SimilarVersesContent.rewayah.test.tsx mocks SkiaVerseText. Covers groups and labels in en and ar, the badge on the right member for 'mushaf' and 'player', notRead, the span note, verse-end, basmala and questioned notes, `contextNotCovered`, loading, error and retry, and that Quran text never goes through a `Text` node. |
| Existing WBWVerseView tests | Still pass after `buildWordParagraph` is moved. |
| `npx jest i18n/` and `npm run i18n:check` | All keys present in en and ar. |

## Tasks

### T1. Add the cross-rewayah comparison to highlights.py

Add ENCODING, READABLE, Side and reads_alike() to scripts/rewayah/highlights.py, marked with # @ai-start/# @ai-end. This is the only new linguistic logic: _word_differs (highlights.py:1053-1113) is reused, but only in directions where the target's rules can read the reference text's encoding, and reads_like_sibling (highlights.py:1184-1209) is also accepted. The docstring states the rule: a doubt splits, it never merges. classify() and the diff outputs stay unchanged.

- **Files:** `scripts/rewayah/highlights.py`
- **Depends on:** none
- **Tests:** python -B scripts/rewayah/validate_rewayah_db.py --glyphs and the CI rebuild + compare_outputs.py must stay green (classify is untouched). reads_alike is exercised through the reviewed cases gate of T2 (1:4:1, 2:67:7, 2:85:18 merge; 12:12:4, 10:35:22, 3:66:1, 18:77:22 stay apart).

### T2. Build the readings index, its gates and the reviewed data files

New script scripts/rewayah/build_readings_index.py (# @ai-generated), with three modes: build, --check and --report. It reads the 8 committed words DBs, the 7 format-2 diff files, PLACEMENT_EVENTS and the basmala context, and computes spans, groups and member details exactly as in design §3–§5. It writes data/mushaf/digitalkhatt/dk_readings.db (tables info and slots, primary key (verse_key, position), WITHOUT ROWID), replacing it atomically and only when rows change. Gates G1–G8: row identity, partition, exact texts, silah, completeness, reviewed cases, misprint entries, determinism. Also add scripts/rewayah/reading_groups_cases.json (seed cases plus toConfirm) and scripts/rewayah/reading_upstream_issues.json (the 4 suspected misprints). Add a --check step to quran-data.yml. Update scripts/rewayah/README.md (Files table, rebuild order), docs/features/rewayat.md (new 'Per-word readings' section) and THIRD_PARTY_LICENSES.md:50 (list dk_readings.db as KFGQPC-derived). Attach the --report output to the PR for the qualified reader.

- **Files:** `scripts/rewayah/build_readings_index.py`, `scripts/rewayah/reading_groups_cases.json`, `scripts/rewayah/reading_upstream_issues.json`, `data/mushaf/digitalkhatt/dk_readings.db`, `scripts/rewayah/README.md`, `docs/features/rewayat.md`, `THIRD_PARTY_LICENSES.md`, `.github/workflows/quran-data.yml`
- **Depends on:** T1
- **Tests:** `python -B scripts/rewayah/build_readings_index.py --check` passes in CI. Two builds give identical rows. Manual negative checks on a temp copy: a hand-edited row (wrong member, synthesised text, silah index moved), a stale misprint entry and an altered case must each fail their gate. Expected counts: 9,499 spans / 9,505 rows; 2,242 spans with ≥2 readings.

### T3. Deliver the index through DigitalKhattDataService

An additive change, marked // @ai-start/@ai-end. Add 'dk_readings.db' to DK_DB_ASSETS (DigitalKhattDataService.ts:28-38); add DkAuxDbId and AUX_DB_DATA; widen BundledDbSpec.table to include 'slots' (:345); make getCurrentDbNamesByBase (:316-337) include the aux bases so stale-copy sweeps and resetDatabases cover them. Add getAuxDbIdentity, getBundledAssetSha256 and the public readAuxDb<T>(id, read), built on the private readBundledDb (:1362-1372). Then regenerate services/mushaf/rewayahDataManifest.ts with `node scripts/rewayah/gen-manifest.mjs`.

- **Files:** `services/mushaf/DigitalKhattDataService.ts`, `services/mushaf/rewayahDataManifest.ts`, `services/mushaf/__tests__/DigitalKhattDataService.test.ts`
- **Depends on:** T2
- **Tests:** Extend the fake-SQLite suite in DigitalKhattDataService.test.ts: content-addressed import of dk_readings.<sha8>.db on first readAuxDb; one delete + re-import of an unreadable copy, then rejection; sweep of dk_readings.db and other dk_readings.<hash>.db copies, never one that is open or busy; readAuxDb leaves cacheVersion, the main cache and the side caches untouched. rewayahDataManifest.test.ts and `npm run check:rewayah-manifest` pass.

### T4. Add reader (qari) and narrator helpers to RewayahIdentity

Add QariId, getQari (total over all 20 RewayahId slugs, consistent with the data/rewayat.ts teacher fields), getQariLabel (content:rewayat.people.<qari>) and getNarratorLabel (people key per rewayah: duri for both al-Duri narrators, susi, etc.), marked // @ai-start/@ai-end. Existing keys only; no new locale strings.

- **Files:** `services/rewayah/RewayahIdentity.ts`, `services/rewayah/__tests__/RewayahIdentity.qari.test.ts`
- **Depends on:** none
- **Tests:** New RewayahIdentity.qari.test.ts: getQari defined for every ALL_REWAYAH_IDS entry and equal to the registry teacher of its CANONICAL_ID entry; getQariLabel/getNarratorLabel resolve to non-key strings in en and ar (setupI18n); al-duri-abi-amr narrator label has no parentheses.

### T5. Pure row decoder and test fixture

New services/mushaf/wordReadingsFormat.ts (// @ai-generated): READINGS_FORMAT, READINGS_REWAYAT, WHOLE_WORD_CATEGORY, the types, parseReadingsInfo, decodeReadingsRow (checks every invariant of design §4 and throws ReadingsFormatError), alikeReadings, combineReadings, WBW_JOINED_WORDS, dkPositionsForWbwWord, findGroup. New fixture generator services/mushaf/__fixtures__/gen_word_readings_fixture.py (# @ai-generated, run with python3 -I). It reads the committed DB rows for the listed locations and computes the expected groups independently from the words DBs and diffs.

- **Files:** `services/mushaf/wordReadingsFormat.ts`, `services/mushaf/__fixtures__/gen_word_readings_fixture.py`, `services/mushaf/__fixtures__/wordReadingsFixture.json`, `services/mushaf/__tests__/wordReadingsFormat.test.ts`
- **Depends on:** T2
- **Tests:** wordReadingsFormat.test.ts: decoded readings equal the fixture's expected groups for 1:1:1, 1:1:4, 1:4:1, 1:7:4, 2:1:1, 2:9:6, 2:54:16, 2:67:7, 2:85:18, 3:66:1, 9:100:17, 10:35:22, 12:12:4, 15:7:1-2, 17:62:1, 27:20:4-5, 37:130:3, 40:26:13-14, 57:24:10, 72:16:1, 73:20:21-22 and 75:1:1-2 (groups, member order, ownText, category, silahChars, verseEnd, wordCount, questioned, basmala). Every malformed-row variant throws. combineReadings over 2:181:3-4 gives alike readings; dkPositionsForWbwWord maps 2:181 positions 1..N correctly.

### T6. WordReadingsService, useWordReadings hook and the full-data check

New services/mushaf/WordReadingsService.ts (// @ai-generated): a ReadingsDbReader over digitalKhattDataService.readAuxDb('readings'), one query per Hafs verse, LRU of 64 verses, status/error/retry, subscribe/getVersion, getWordReadings('s:a:w') and getWbwWordReadings. It runs the runtime guard once (format, rewayat, inputs equal to REWAYAH_DATA_MANIFEST) and fails closed. New hooks/useWordReadings.ts on useSyncExternalStore plus one requesting effect (the useRewayahVerseUnits pattern). New *.alldbs suite reading the real files with node:sqlite.

- **Files:** `services/mushaf/WordReadingsService.ts`, `hooks/useWordReadings.ts`, `services/mushaf/__tests__/WordReadingsService.test.ts`, `hooks/__tests__/useWordReadings.test.tsx`, `services/mushaf/__tests__/dkReadingsIndex.alldbs.test.ts`
- **Depends on:** T3, T5
- **Tests:** WordReadingsService.test.ts (fake reader): exactly one readVerse per verse across words and repeat calls; a position with no row → alike; reader rejection → status 'error', getWordReadings rejects, retry recovers; an info mismatch (format, rewayat order, inputs hash) → 'error' for all verses; a malformed row fails only its word; LRU eviction; listeners notified. useWordReadings.test.tsx: loading → ready, error → retry. dkReadingsIndex.alldbs.test.ts (BAYAAN_OVERLAY_DB_DIR=bundled, Node ≥ 22.13): every row decodes; for all 77,432 content slots, group membership matches the 7 diff files, texts equal the DB texts and slots with no row meet the 'alike' conditions; info.inputs equals the files' sha256; WBW/DK position mismatches are exactly WBW_JOINED_WORDS (data/wbw/wbw-en.db versus digital-khatt-v2.db).

### T7. Shared paragraph builder and the ReadingText Skia component

Move buildParagraph out of WBWVerseView.tsx:152-219, unchanged, into components/player/v2/PlayerContent/QuranView/wordParagraph.ts as buildWordParagraph, and import it back into WBWVerseView. New components/sheets/verse-actions/ReadingText.tsx (// @ai-generated): one Skia paragraph in the DigitalKhatt font from getDkFontFamily(mushafRenderer, rewayah); silah indices passed as charToRule 'silah' (tajweedColors.silah); width capped at maxWidth (from useSheetWidth); RTL; accessibilityLabel set to the text; an empty placeholder while useMushafFontMgr() is null, and never a UI font.

- **Files:** `components/player/v2/PlayerContent/QuranView/wordParagraph.ts`, `components/player/v2/PlayerContent/QuranView/WBWVerseView.tsx`, `components/sheets/verse-actions/ReadingText.tsx`, `components/sheets/verse-actions/__tests__/ReadingText.test.tsx`
- **Depends on:** none
- **Tests:** The existing QuranView/WBWVerseView tests pass unchanged. ReadingText.test.tsx (Skia mocked): the font family follows getDkFontFamily (IndoPak + non-Hafs → DigitalKhattV2); silah indices reach the paragraph builder as 'silah'; nothing is drawn and no RN Text appears without a fontMgr; the accessibility label is the text.

### T8. WordReadingsSection, label helpers and i18n

New components/sheets/verse-actions/wordReadingsLabels.ts (pure: clusterByQari, formatNarrators, formatNames, readingNotes) and WordReadingsSection.tsx (// @ai-generated), implementing design §7: summary, span note, group rows with the diff-tint bar and the 'Differs from Hafs' caption, own-text lines, the notRead row, 'Your mushaf' / 'This recitation' badges, notes, scope and source footer, loading/error/retry states, and the 'Your mushaf (Warsh)' row for words with no index row. Built from useSheetWidth, ramp roles, ≥0.8 alpha secondary text, minHeight rows, an accessible group label and a 44pt Retry button with useHover. Add the sheets:wordReadings.* keys in i18n/locales/en and ar.

- **Files:** `components/sheets/verse-actions/wordReadingsLabels.ts`, `components/sheets/verse-actions/WordReadingsSection.tsx`, `components/sheets/verse-actions/__tests__/wordReadingsLabels.test.ts`, `components/sheets/verse-actions/__tests__/WordReadingsSection.test.tsx`, `i18n/locales/en/sheets.json`, `i18n/locales/ar/sheets.json`
- **Depends on:** T4, T6, T7
- **Tests:** wordReadingsLabels.test.ts: clusters in member order ('Hafs, Shu'bah (Asim)'; 'حفص، شعبة (عاصم)'); no doubled parentheses for al-Duri; readingNotes for the 1:7:4 verse end, 2:1:1 no verse end, 15:7 joined, 72:16:1 apart, 1:1:4 basmala, 17:62:1 questioned, and the span next/previous note. WordReadingsSection.test.tsx (ReadingText mocked and recorded): 1:4:1 shows two groups with the right texts and narrators in en and ar; the 'Your mushaf' badge sits on Warsh for a Warsh mushaf and on Hafs under qcf_v2; the player source adds 'This recitation'; 57:24:10 shows 'Not read'; a word with no row shows 'alike' plus the context row; contextNotCovered for 'hisham'; loading and error with retry; Quran text is never inside a Text node. `npx jest i18n/` and `npm run i18n:check` pass.

### T9. Put the section into the word view

Mount WordReadingsSection in the single word view's word card, after morphology, as decision 2 orders it (this view is owned by the word-view design, which is built on IrabContent.tsx:206-250). Pass the Hafs verseKey and WBW position of the selection, contextRewayah (VerseActionsSheet resolvedRewayah, :235-236, already passed to IrabContent as `rewayah`) and contextSource (payload.source). When the word view opens, prefetch with wordReadingsService.request for every wbwParts verse. Add the 'Readings' header chip that scrolls to the section; marking words in the grid is optional. No change to the mushaf page gestures.

- **Files:** `components/sheets/verse-actions/IrabContent.tsx`, `components/sheets/VerseActionsSheet.tsx`, `components/sheets/verse-actions/__tests__/IrabContent.readings.test.tsx`
- **Depends on:** T8
- **Tests:** IrabContent.readings.test.tsx: opening the word view requests readings once per Hafs part; selecting a word renders the section with that word's DK positions (including WBW 2:181:3 → DK 3-4); a Warsh verse unit spanning two Hafs verses prefetches both; the 'mushaf' versus 'player' source reaches the section. Existing VerseActionsSheet units and end-to-end suites still pass. Attach the UI checklist screenshots (iPad 13" portrait and landscape, iPad mini, iPhone, dark theme, Arabic UI).

### T10. Final docs and review before release

Record the feature in docs/features/rewayat.md (Surface integration table: a 'Word view › Readings' row) and in docs/design/screen-inventory.md if the word view adds a screen. Have a qualified reader review the --report output (102 spans with ≥3 readings, the 65 joins excused by a general rule, toConfirm, the 4 misprints) and turn the decisions into reading_groups_cases.json groups. Record in THIRD_PARTY_LICENSES.md that the licence question also covers the new derived file.

- **Files:** `docs/features/rewayat.md`, `docs/design/screen-inventory.md`, `scripts/rewayah/reading_groups_cases.json`, `THIRD_PARTY_LICENSES.md`
- **Depends on:** T2, T9
- **Tests:** build_readings_index.py --check stays green with the new reviewed cases; any change to the grouping that the reviewer requests appears as a cases-gate change in the PR diff.

## Risks

- Grouping the differing rewayat among themselves is new linguistic logic. Only the asHafs/differs line is a reviewed decision. reads_alike reuses _word_differs outside its tested setting (a non-Hafs reference). Before release a qualified reader must review: 65 joins where one rewayah's general rules excused the difference, 102 spans with ≥3 readings, and hard cases such as 33:4:12 / 58:2:12 / 65:4 (Warsh اُ۬لٜى۟ grouped with al-Bazzi and Abu 'Amr). It is built to fail safe (an extra group rather than a wrong merge), but a wrong merge is still possible wherever one direction's excuse is too permissive.
- The four suspected KFGQPC misprints currently appear as readings of their own: Qunbul 4:136:14 أُنزَلَ, Qalun 17:62:1 قَال۟, Warsh 43:58:10 جَدَلاَ, al-Duri 43:78:2 جِّئْنَٰكُم. The 'questioned' note helps, but showing a likely misprint as a reading of the Quran is sensitive. rewayat.md:198 already asks for a decision before release.
- Highlight decisions marked 'to confirm' (rewayat.md:114: idkhal, Nafi' أَرَءَيْتَ, 69:28, 52:37, Shu'bah 41:44, …) become explicit, named reading groups. That is far more prominent than a background tint, so any of them that is wrong becomes more visible.
- Licence: the index redistributes KFGQPC riwayah text in a new derived file. No licence or written permission is recorded (THIRD_PARTY_LICENSES.md:52).
- The index can drift from the words DBs or diffs when an erratum rebuild forgets to rebuild it. Three checks catch this: CI --check, the Jest inputs-hash check, and a runtime guard that refuses mismatched inputs. If the guard fires in a shipped build, the section shows an error rather than readings.
- DigitalKhattDataService is the mushaf's critical path. The aux DB shares its lock, sweep and manifest code. A mistake in getCurrentDbNamesByBase or the sweep could delete or block a words copy; this needs the fake-SQLite tests in T3.
- Each rewayah has exactly one text, the KFGQPC edition. Alternative ways of reading within one rewayah (e.g. Hafs ضَعْف/ضُعْف 30:54, Warsh's optional taqlil or two-hamza options) are not shown. General-rule differences (madd, tashil, ibdal, imala, naql) are deliberately not listed, so a Warsh learner could read 'same in all 8' for يُؤْمِنُونَ. The scope footer and the 'Your mushaf' row only partly offset this.
- Release 1 still uses the Hafs layout, and that shows: where any rewayah merges two words (P3), the readings for both words appear together; omitted words exist only at 57:24:10.
- Font limits: DigitalKhatt draws some Maghribi marks with Madani meanings (wasl alef vowels, start-dot circle, kasra under the dot below; render_review 'limitation' families). The readings section shows these far-rewayah texts as prominently as the mushaf does.
- Size: +1.55 MB asset (about 229 KB compressed) and +1.55 MB on-device copy on first use.
- The builder depends on highlights.py internals (_word_differs, Context, _units). reads_alike becomes their public contract and must be kept in sync whenever the classifier changes.

## Open questions (answered in README.md)

- Suspected misprints (4 texts): show them as their own reading with the 'questioned' note (proposed), fold them into the sibling's group with a note, or hide them until a qualified reader or KFGQPC decides?
- Should general-rule differences (madd length, tashil, ibdal, imala, Warsh's naql) ever be listed per word? Release 1 says no: the letter-level categories audited 84–99% false (rewayat.md:116). A per-rewayah explainer of its general rules is the alternative.
- Group order: Hafs group first (as proposed and in the task's example), or the group of the rewayah shown in the mushaf first?
- Who signs off the grouping review list (the --report output), and should it gate the UI PR or only the release? Proposed: the same qualified reader as the highlight decisions, gating the release.
- Should the readings section let the user switch the mushaf to a rewayah, or play that rewayah's word? Not proposed: it risks accidental mushaf switches, and word audio exists only for Hafs.
- Should the word grid mark words with ≥2 readings, given the verse prefetch makes it cheap? It may be visual noise in the far rewayat; proposed as optional.
- Decision 5 puts explaining the readings (tawjih) out of scope. Should the section at least link to the I'rab Books tab, whose al-'Ukbari / al-Nahhas passages often discuss these readings?
- The word view header shows the quran.com (WBW) spelling in the Uthmani font, while the readings section shows DigitalKhatt Hafs text. Should the header switch to the DigitalKhatt Hafs text (the grid already uses it) so the two match? This belongs to the word-view design.
- Ship order: data first (T1–T2, with the review report attached) in its own PR before the runtime and UI PRs? Proposed, so the grouping can be audited without UI noise.
