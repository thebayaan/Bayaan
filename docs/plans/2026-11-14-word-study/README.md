<!-- @ai-generated -->
# Word study and Quran search: plan

**Date:** 2026-11-14
**Baseline:** `develop` at `b0a151ce`
**Background:** [docs/research/surah-app-feature-gaps.md](../../research/surah-app-feature-gaps.md) (the Word level and Search rows)

This plan covers five features, each with its own design doc:

| # | Feature | Design |
|---|---|---|
| 1 | **Word Study**: one word view inside the ayah selection | [01-word-view.md](01-word-view.md) |
| 2 | **Readings**: how each of the 8 rewayat reads the word | [02-word-readings.md](02-word-readings.md) |
| 3 | **Quran search**: word, phrase and root search | [03-word-search.md](03-word-search.md) |
| 4 | **Arabic word meanings (gharib)** | [04-gharib-rasm.md](04-gharib-rasm.md) |
| 5 | **Rasm** | [04-gharib-rasm.md](04-gharib-rasm.md) |

The design docs were written by read-only design agents. **Where this README disagrees with a design doc, this README wins.**

## Product decisions (from the product owner)

1. **Word Study inside the ayah selection.** The user selects an ayah as today, then goes word by word inside that selection. There is no new per-word gesture on the mushaf page.
2. **Readings.** From the word view, show at a glance how every bundled rewayah reads the word.
3. **Quran search.** Search the Arabic text by word or phrase, tolerant of diacritics and spelling, plus search by root, in the Search tab and in the mushaf search.
4. **Gharib and rasm sources: classical or openly licensed only.**
   - **Gharib:** Ibn al-Ha'im (d. 815 AH), *al-Tibyan fi Tafsir Gharib al-Qur'an*, from Quranpedia's `meanings` dump (book 327).
   - **Rasm:** Tanzil Quran Text, Simple v1.1 (the imla'i spelling), aligned to Bayaan's word positions. The rasm differences are derived by comparing it with the mushaf text.
   - **Not used:**
     - the Tafsir Center's datasets (the organisation behind the Surah app);
     - Quran.com / Quran Foundation API data (its developer terms forbid bundling);
     - QUL downloads (they need a login, state no licence, and Tarteel's terms forbid scripted access);
     - contemporary gharib books (al-Khudayri, Makhluf, KFGQPC al-Muyassar);
     - OpenITI (non-commercial licence).
5. **Out of scope:** word pictures, places, and every other item in the gap list.

## Decisions on the designs' open questions

### Word Study (01)
- **Name:** *Word Study* / *دراسة الكلمات*.
  - It replaces the I'rab screen: `ActiveScreen 'irab'` becomes `'words'`.
  - Tabs: *Words / الكلمات* and *I'rab books / كتب الإعراب*.
- **Step bar:** Previous / Next follows the Quran's reading direction in both UI languages.
- **Header:** always shows the transliteration and the English meaning.
- **Sections:** open/closed state resets each time the screen opens.
- **`WordDetailSheet` is retired (01 T9).**
  - A word long-press in a list or the player opens the verse sheet on Word Study at that word.
  - A long-press in the Word by Word screen does the same (01 T10).
  - Arrow-key stepping on iPad is in scope (01 T12).
- **Readings section:** comes from 02 (`WordReadingsSection`). 01's `WordReadings.tsx` and `mergeSlotReadings` are **dropped**.
- **Root chip:**
  - It opens a new `root` sub-screen of `VerseActionsSheet` that renders 03's `RootResults`.
  - A verse tap closes the sheet and pushes `/mushaf` with 03's `quranHitLinkParams`.
- **Gharib and rasm sections:** come from 04 (`GharibSection`, `RasmSection`), fed by `wordStudyDataService` with Hafs keys `s:a:w` in word-by-word (i'rab) numbering.
  - 01's `wordView.gharib.*` / `wordView.rasm.*` keys are dropped.
  - 04 owns those strings under `sheets:wordStudy.*`.

### Readings (02)
- **The 4 suspected KFGQPC misprints** are folded into their sibling's group (they are not shown as readings of their own). Each is recorded in `scripts/rewayah/reading_upstream_issues.json`. No UI note.
- **Not listed per word:** general-rule differences (madd, tashil, ibdal, imala, naql).
- **Group order:** the Hafs group first; the rewayah shown in the mushaf is marked *Current*.
- **Review:** the grouping review list (`--report`) is committed with the data. A qualified reader signs it off before release; it does not block merging.
- **Hands off `WBWVerseView.tsx`:** 01 owns it, so 02 T7 does not extract a paragraph builder from it. `ReadingText` uses `SkiaVerseText` or a small local helper.
- **Not in scope:** no marker on the word grid, no switching rewayah or playing audio from the readings section, no tawjih.

### Quran search (03)
- **Spellings:** Hafs only in v1 (the other-rewayat flag bit stays reserved).
- **Ranking:** relevance tiers, then mushaf order.
- **Matching:**
  - the "all words in one ayah" fallback is on;
  - the last word matches as a prefix from 3 letters;
  - no typo tolerance and no Latin verse search.
- **Recents:** store the opened verse.
- **Roots:**
  - Counts are word counts.
  - Root queries work in the Search tab (`root:` / `جذر:` / spaced letters).
  - The word view embeds `RootResults`.
- **No imla'i input in v1:** spellings come from the Uthmani text by rule. The `--imlaei` seam stays for later; a Tanzil-fed index would need the same licence notice as rasm.

### Gharib and rasm (04)
- **Gharib:**
  - One book, Ibn al-Ha'im's *al-Tibyan*.
  - Strip the editor's bracketed insertions (`[…]`).
  - Placement tiers 1–3 show on words. Tier 4 (loose) and neighbouring-verse placements stay at verse level and are **not shown in v1** (04 T10a skipped).
- **Rasm:**
  - The input is Tanzil Simple v1.1 without pause marks.
  - Tokens are stored verbatim (letters unchanged) with Tanzil's copyright block in the DB `meta` table.
  - Map tokens to positions with the merge rules from the source research: a vocative يا / ها joins the next token; 20:94:2 takes three tokens; the 4 Bayaan positions with a space take two; 72:16:1 takes وَأَن لَّوِ. Assert the skeletons match.
  - Show a note only when the mushaf's small signs, one of the named pattern rules or the reviewed list confirms it. Unconfirmed notes are stored but hidden; the reviewed list starts empty.
  - No "qira'atan" note (04 T10b skipped).
- **Section titles:** *Arabic meaning / معنى الكلمة* and *Rasm / الرسم*, each with a source line.
- **Normalisation:** the build-time letter model stays in `scripts/word-study/arabic.ts`; it does not share `utils/search`.
- **Credits:** add Tanzil Simple v1.1 and Quranpedia's *al-Tibyan* to `THIRD_PARTY_LICENSES.md` and the Credits screen.
  - Quote Tanzil's terms verbatim, including "CHANGING IT IS NOT ALLOWED".
  - Note the open question of the Tanzil FAQ's "non-commercial" line, as the file already does for the Tanzil transliteration.

## Tracks and file ownership

Each track works on its own branch, `wip/<track>`, cut from this commit. A track does not touch another track's files; where it must (shared files below), it adds its own block and leaves the rest alone.

| Track | Tasks | Owns |
|---|---|---|
| **readings** | 02 T1–T8, T10 | `scripts/rewayah/highlights.py` (additions), `scripts/rewayah/build_readings_index.py`, `scripts/rewayah/reading_*.json`, `data/mushaf/digitalkhatt/dk_readings.db`, `services/mushaf/wordReadingsFormat.ts`, `services/mushaf/WordReadingsService.ts`, `hooks/useWordReadings.ts`, `services/rewayah/RewayahIdentity.ts` (additions), `components/sheets/verse-actions/{WordReadingsSection,ReadingText}.tsx`, `wordReadingsLabels.ts`, i18n `sheets:wordReadings.*` |
| **word-data** | 04 T1–T7, T9 (with the sources above) | `scripts/word-study/**`, `services/wordStudy/**`, `assets/data/gharib-v1.db`, `assets/data/rasm-v1.db`, `components/sheets/verse-actions/word-study/**`, `test-utils/mockExpoSqlite.ts`, i18n `sheets:wordStudy.*`, the Credits screen entries |
| **search** | 03 T1–T11 | `utils/search/{quranText,quranSearch,quranIndexFormat,verseSnippet}.ts`, `utils/quranWordPositions.ts`, `scripts/search/**`, `assets/data/quran-search-v1.db`, `services/search/**`, `hooks/useQuranSearch.ts`, `components/search/quran/**`, `store/mushafWordFlashStore.ts`, `components/mushaf/skia/useWordFlashHighlights.ts`, `utils/quranLink.ts` (`quranHitLinkParams`), the search changes in `SearchView`, `TabletSearchResults`, `app/(tabs)/(b.search)/index.tsx`, `MushafSearchView`, `app/mushaf.tsx` (`words` param), i18n `home:` / `reader:` search keys, `docs/features/quran-search.md` |
| **word-view-core** | 01 T1, T2, T3, T5 | `services/wbw/wordAlignment.ts` (and its use in `WBWVerseView.tsx`), `services/wbw/wordAudio.ts`, `hooks/useWordAudio.ts`, `verseUnitScreens.ts` (`selectionWordParts`), `components/sheets/verse-actions/wordStudy.ts`, `services/irab/irabFormat.ts` (`MORPH_*`), the `IrabContent.tsx` building blocks |
| **word-view-ui** (after the four above are merged) | 01 T4, T6–T12, 02 T9 | `WordCard.tsx`, `WordStudyContent.tsx`, `useWordStudyData.ts`, `VerseActionsSheet.tsx` (`words` and `root` screens), `sheets.tsx`, `VerseItem.tsx`, `WBWContent.tsx`, retiring `WordDetailSheet.tsx`, i18n `sheets:verseActions.wordStudy` and `sheets:wordView.*`, `docs/design/screen-inventory.md` |

**Shared files.** The integrator resolves these:
- `services/mushaf/DigitalKhattDataService.ts`: readings adds `readAuxDb`; search adds `getPageForWord`.
- `THIRD_PARTY_LICENSES.md`: each track appends its own section.
- `i18n/locales/{en,ar}/*.json`: each track adds keys only in its own namespace.

## Interfaces between tracks

```ts
// readings (02 §6): services/mushaf/WordReadingsService.ts, hooks/useWordReadings.ts
export function useWordReadings(verseKey: string, wbwPosition: number): WordReadingsResult;
// components/sheets/verse-actions/WordReadingsSection.tsx — self-loading; one prop set:
export function WordReadingsSection(props: {verseKey: string; wbwPosition: number; currentRewayah: RewayahId}): JSX.Element | null;

// word-data (04 §2.6): services/wordStudy/WordStudyDataService.ts
wordStudyDataService.getVerse(verseKey): Promise<VerseWordStudy>;     // never rejects
wordStudyDataService.getGharib('s:a:w'): Promise<GharibEntry[]>;       // [] hides the section
wordStudyDataService.getRasm('s:a:w'): Promise<WordRasm | null>;       // null hides the section
// components/sheets/verse-actions/word-study/GharibSection.tsx, RasmSection.tsx (04 §3)
GharibSection: React.FC<{entries: GharibEntry[]; position: number; wordTextOf: (position: number) => string | undefined}>;
RasmSection: React.FC<{rasm: WordRasm | null; uthmani: string | undefined}>;

// search (03): components/search/quran/RootResults.tsx, utils/quranLink.ts
RootResults: React.FC<{root: string; initialLemma?: string; onVersePress: (hit: QuranVerseHit) => void}>;
quranHitLinkParams(verseKey: string, positions: readonly number[], ...): QuranLinkParams & {anchor: string; words: string};

// word-view-core (01 §6): services/wbw/wordAlignment.ts, components/sheets/verse-actions/wordStudy.ts
alignDkWithWbw(dk, wbw): DkWbwAlignment; selectionWordParts(selection): WordStudyPart[];
buildWordSequence(parts, words): StudyWord[]; summarizeMorph(facts): MorphSummary; rootSearchKey(root): string;
```

## Rules for every track

- **Worktree setup:** run `ln -s /home/user/Bayaan/node_modules node_modules` in the worktree root. `.git/info/exclude` ignores it. Never commit it, and `git add` explicit paths only.
- **Code:**
  - Follow `CONTRIBUTING.md`.
  - Mark AI code per `docs/contributing/ai-guidelines.md`.
  - Follow the MUST rules of `docs/design/ipad-standards.md` and the checklist for UI.
  - Add English and Arabic strings and follow the RTL rules of `docs/i18n/README.md`.
- **Commits:**
  - Small conventional commits per task (`feat(search): …`, `test(readings): …`), each ending with the session trailer lines.
  - The author comes from the repo config (OKKHALIL3); do not change it.
- **Before a track reports done:**
  - `npx tsc --noEmit` is clean.
  - `npx jest <touched areas> --watchAll=false` passes.
  - `npx eslint <changed files>` and `npx prettier --check <changed files>` are clean.
  - For touched namespaces, `npx i18next-cli extract --ci --dry-run`, `npx i18next-cli lint` and `npx i18next-cli status --unused` pass.
  - Every data build's `--check` mode passes.
- **Do not push.** The integrator merges the `wip/*` branches into `claude/youthful-dijkstra-nqb3yg`, runs the full suite and pushes.
