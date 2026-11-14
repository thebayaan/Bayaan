<!-- @ai-generated -->
# Word study data: gharib and rasm

Two optional bundled databases feed the word view's *Arabic meaning* and
*Rasm* sections (design: [docs/plans/2026-11-14-word-study/04-gharib-rasm.md](../../docs/plans/2026-11-14-word-study/04-gharib-rasm.md),
decisions: [README.md](../../docs/plans/2026-11-14-word-study/README.md)):

| File | Built by | Holds |
|---|---|---|
| `assets/data/gharib-v1.db` | `build-gharib-db.ts` | Entries of gharib books, placed on the app's words |
| `assets/data/rasm-v1.db` | `build-rasm-db.ts` | Every word whose mushaf spelling differs from a standard (imla'i) spelling, with the differences |

Both are keyed by Hafs `s:a:w` in the app's word-by-word (i'rab) numbering,
the numbering of `data/wbw/wbw-en.db`. The app reads them through
`services/wordStudy/WordStudyDataService.ts`; `services/wordStudy/wordStudyFormat.ts`
is the format both sides share.

## Building

The inputs are downloads that are not committed. `SOURCES.md` says where
each comes from; `sources.lock.json` pins its SHA-256, and the builds refuse
any other file.

```bash
npx tsx scripts/word-study/build-gharib-db.ts --input <dir>/meanings.json.gz \
  [--out assets/data/gharib-v1.db] [--report /tmp/gharib-report.md]
npx tsx scripts/word-study/build-rasm-db.ts --input <dir>/quran-simple.txt \
  [--out assets/data/rasm-v1.db] [--report /tmp/rasm-report.md]
```

Add `--check` to rebuild into a temporary file and compare it, table by
table, with the committed DB: it prints `check: … matches a rebuild` or the
rows that differ and exits with 1. Run it after any change to the modules
below and before committing a DB.

The CLIs are not run in CI, because their inputs are not committed (as with
`scripts/irab/build-irab-db.ts`). Their logic lives in tested modules:

| Module | What | Tests |
|---|---|---|
| `arabic.ts` | Letter model: `plene`, matching keys, `hamzaKey`, `looseKey`, `rasmLetters` | `scripts/__tests__/wordStudyArabic.test.ts` |
| `rasm.ts` | Tanzil reader, merge rules, `groupVerse`, `diffGroup`, pattern rules, reviewed list | `scripts/__tests__/wordStudyRasm.test.ts` |
| `gharib.ts` | Adapters, cleaning, placement tiers | `scripts/__tests__/wordStudyGharib.test.ts` |
| `db.ts` | Writers and `compareDbs` | `scripts/__tests__/wordStudyDb.test.ts` |
| `appWords.ts`, `lock.ts` | The app's words (Digital Khatt text for the 55 damaged ones), the lock | through the DB tests |

The committed DBs are pinned by `services/wordStudy/__tests__/gharibDatabase.test.ts`
and `rasmDatabase.test.ts`: row counts, sources, texts, and lines checked by hand.

## Gharib

Each entry's headword is compared with every run of 1 to n+2 consecutive
words of its verse, spaces ignored. The first tier that matches wins:

| Tier | Comparison | Shown on words |
|---|---|---|
| 1 | `matchKey`, each word read plene or as written | yes |
| 2 | `hamzaKey`: no alif of length, every hamza one ء | yes |
| 3 | tier 2 after one proclitic and/or one enclitic, on either side | yes |
| 4 | `looseKey`, 3+ letters, one place in the verse | no (verse level) |
| moved | tiers 1–3 in a verse up to 3 before or after | no (verse level) |
| 5 | `gharib-reviewed.json` | yes, or verse level |

Tier 4 and neighbouring-verse matches keep their match in the `candidate`
column for review; v1 shows none of them. Among several spans of the winning
tier, the first one after the previous placed entry of the same book in that
verse wins.

Gates: every input locked by SHA-256 and version; no markup, link, Latin
letter, digit, bracket or U+FFFD in a headword, gloss or note after cleaning
(the editor's `[…]` insertions and footnote markers are removed); every span
on real words; each book's share of entries on words at least its `minPlaced`.

`--report` lists tier-3, tier-2 and ambiguous placements (shown), and tier-4,
moved and unplaced entries (not shown). To place an entry by hand, add to
`gharib-reviewed.json`:

```json
{"__format": 1, "entries": {"327 2:5 لاريبفيه": {"span": "2:2:3-5"}}}
```

The key is the source id, the verse the source gives, and `matchKey` of the
headword; the value is a span or `{"verseLevel": true}`.

## Rasm

1. **Pair.** Every app word gets its standard tokens by the merge rules: a
   vocative يا / وَيَا / ها joins the next token; 20:94:2 takes three
   tokens; the app positions holding two written words (بَعْدَ مَا at 2:181:3,
   8:6:4, 13:37:8 and إِلْ يَاسِينَ at 37:130:3) take two; 72:16:1 takes
   وَأَن لَّوِ. The stray space of 5:52:12 in `wbw-en.db` is removed. Each
   pair must have the same `looseKey`, and `groupVerse`, which knows none of
   the rules, must pair the verse the same way.
2. **Diff.** `diffGroup` aligns the letters, counting the mushaf's small
   signs as letters of their own, and names each difference: hadhf (الحذف),
   ziyada (الزيادة), badal (البدل), hamz (الهمز), and wasl or fasl for the
   word division.
3. **Trust.** A note is shown only when it is confirmed by
   - the mushaf's own signs: the small letter in the gap, ۟ or ۠ on an extra
     letter, ٰ on و or inside-word ى, ۜ on ص, or the hamza as the mushaf
     writes it;
   - a named pattern rule: `lamAssimilated` (ٱلَّيْل), `alifAfterWawJama`
     (فَآءُو), `doubleYa` (يُحْىِ), `vocativeJoined` (يَـٰٓأَيُّهَا);
   - or `rasm-reviewed.json`.

   Every other note is stored with basis `unconfirmed` and hidden.

Gates: the input locked by SHA-256; every verse paired with equal skeletons
and the same grouping both ways; the two-word app positions are exactly the
known four; reviewed words still derive the notes that were reviewed; note
letters from the display set; marks on letters of `imlaei`.

`--report` lists each unit with hidden notes, followed by a ready-to-edit
`rasm-reviewed.json` entry:

```json
{"__format": 1, "words": {"12:25:9": {"derived": [["b", "ى", "ا", 4, 5]], "confirm": true, "why": "لدا الباب"}}}
```

`derived` must equal what the build derives (the build fails when it
changes); then one of `"confirm": true` (show the derived notes), `"notes"`
(replace them, `[code, standard, mushaf, markFrom, markTo]`) or `"skip": true`.

The standard text keeps the mushaf's spelling in some classical categories
(ta maftuha, most wasl and fasl, the alif for nun), so those give no notes:
the app speaks of differences from "the standard spelling", not of rasm
doctrine.

## Updating a source

1. Download the new file, check it against the publisher, record it in
   `SOURCES.md` and `sources.lock.json` (URL, version, SHA-256, licence).
2. Build with `--report` and read the report; update the reviewed lists until
   the gates pass. A reviewed rasm word whose notes changed fails the build
   on purpose: review it again.
3. Ship the result under a new file name (`gharib-v2.db`) with the old name in
   `services/wordStudy/bundledWordStudy.ts` (`old`), so installed apps import it.
4. Update the pinned counts in the DB tests, `THIRD_PARTY_LICENSES.md` and the
   Credits screen.
