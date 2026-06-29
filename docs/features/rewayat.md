# Feature: Rewayat (Multi-Qira'at Support)

**Status:** Shipped (2026-04) — 8 KFGQPC rewayat, mushaf + player + UGC integration.
**Source:** KFGQPC data via `quran-data-kfgqpc` mirror.
**Complexity:** High — multi-DB architecture, rule-based highlighting, cross-surface propagation.

## Overview

Bayaan supports all 8 canonical KFGQPC rewayat (transmissions) of the Quran as interchangeable reading modes. Users switch rewayah in Mushaf Settings; the mushaf rerenders in the selected reading, and the switch ripples into the audio player, share/copy surfaces, and saved user annotations.

## Supported rewayat

| Rewayah | Qari | Region | Highlight tier |
|---|---|---|---|
| Hafs 'an Asim | Asim al-Kufi | global default | — (baseline) |
| Shu'bah 'an Asim | Asim al-Kufi | scholarly | whole-word variant (bg tint) |
| Al-Bazzi 'an Ibn Kathir | Ibn Kathir | Mecca / Yemen | word variant + minor (teal) + silah (purple) |
| Qunbul 'an Ibn Kathir | Ibn Kathir | Mecca | word variant + minor + silah |
| Warsh 'an Nafi' | Nafi' al-Madani | North Africa | char-level madd / tashil / ibdal / taghliz / silah + word variant |
| Qalun 'an Nafi' | Nafi' al-Madani | Libya / Tunisia | char-level madd / tashil / ibdal / taghliz / silah + word variant |
| Al-Duri 'an Abu Amr | Abu Amr al-Basri | Sudan / W. Africa | word variant only (Abu Amr rule classifier deferred) |
| Al-Susi 'an Abu Amr | Abu Amr al-Basri | scholarly | word variant only |

## Highlight model

Two rendering channels, semantically distinct:

| Channel | Purpose | Visual |
|---|---|---|
| **Background tint** | Whole-word content variant from Hafs | Orange `rgba(255, 107, 53, 0.3)` block |
| **Foreground color** | Letter-level tajweed rule | Colored text at character granularity |

Foreground categories (see `constants/tajweedColors.ts`):
- `madd` — green, Madd al-Badal / Madd al-Lin
- `tashil` / `ibdal` — light blue, hamza softening or hamza→long-vowel substitution
- `taghliz` — dark blue, heavy lam in Allah after emphatic letters
- `silah` — purple, pronoun-lengthening marks (ۥ / ۦ) and their carrier vowel
- `minor` — teal, trailing-vowel / mood-shift (close-rewayah legacy)

The published-mushaf convention reserves background for whole-word variants and foreground for letter-level rules. Bayaan follows that split; `mukhtalif` (far rewayat) and `major` (close rewayat) are unified on the background channel.

## Data architecture

Every rewayah ships as a Hafs-layout sibling:

- **Shared layout DB** (`dk_layout.db`) — same 604-page Madinah mushaf geometry and ayah boundaries.
- **Per-rewayah words DB** (`dk_words_<id>.db`) — same word IDs as Hafs, different text strings.
- **Shared font** (DigitalKhatt OTF) — the per-qiraat KFGQPC font would need per-rewayah layout DBs; using one DK font keeps layout calculations reusable across all 8.

Total data footprint: ~20 MB across 7 non-Hafs word DBs + 7 diff JSONs.

## Build pipeline

`scripts/rewayah/build_sibling_rewayah.py` — generic KFGQPC-to-Bayaan builder.

For each rewayah:
1. **Normalize** KFGQPC JSON via `normalize.py` (codepoint substitutions, hamza decomposition, ayah marker placement).
2. **Align** target-rewayah words to Hafs's layout slots with `difflib.SequenceMatcher`. Unaligned Hafs slots keep Hafs text; unaligned rewayah words are dropped.
3. **Classify** each patched word into a highlight category using one of three classifier modes:
   - `close` — Shu'bah / Bazzi / Qumbul: two-tier `major` (bg) / `minor` (fg).
   - `nafi` — Warsh / Qalun: full published-mushaf classifier with letter-level char anchors derived from KFGQPC markers U+06E4, U+06EA, U+06EC.
   - `abu_amr` — Doori / Soosi: mukhtalif-only (genuine content variants). Abu Amr rule classifier deferred — no open data source covers their idgham kabeer / imalah rules at the letter level.
4. **Strip** classification-only markers (`U+06E4`, `U+06EA`) before DB insert so the DK font doesn't fall back to a system font for unrenderable glyphs. Keep `U+06EC` (silah carrier is the visible hamza mark).
5. **Emit** `dk_words_<id>.db` (words DB) and `<id>-diff.json` (highlight map).

The mukhtalif filter suppresses typographic-only diffs (ٱ vs ا, آ vs ا, ى vs ي) via a letter-skeleton normalizer so orthographic convention differences don't flood the page with red.

Final mukhtalif counts per far rewayah (genuine letter-level variants only):
- Warsh: 888, Qalun: 560, Doori: 252, Soosi: 318.

## Runtime architecture

### DigitalKhattDataService — multi-rewayah read API

The service (`services/mushaf/DigitalKhattDataService.ts`) is a singleton with one "active" rewayah that the mushaf page follows. For non-mushaf surfaces that need text from a different rewayah (e.g., player rendering the reciter's reading while the mushaf shows a different one):

- `getVerseText(verseKey, rewayah?)` / `getVerseWords(verseKey, rewayah?)` accept an optional rewayah that reads from a side cache instead of mutating the active one.
- `ensureRewayahLoaded(rewayah)` lazy-imports and caches a non-active rewayah's words DB. Up to 7 side caches can coexist (~4 MB worst case). Evicted from the side cache when promoted to active via `switchRewayah`.

### RewayahDiffService — highlight map loader

`services/mushaf/RewayahDiffService.ts`. Loads a per-rewayah diff JSON and exposes:

- `getCharsForCategory(cat, page, line)` — char indices on a line that belong to the category. Used for foreground coloring in SkiaPage's per-char rule pipeline.
- `getDiffRangesForLine(page, line)` — merged `major` + `mukhtalif` ranges. Used for background highlight rendering.
- `getSilahCharsForLine(page, line)` — silah marks scanned from stored text at render time.

Diff JSON supports three shapes for backward compatibility:
- Legacy flat array: `{verseKey: number[]}` → whole-word major.
- Two-tier: `{verseKey: {major: number[], minor: number[]}}` → whole-word per category.
- Char-level (new): `{verseKey: {cat: [[wordPos, [charIdx, ...]], ...]}}` — empty charIdx = whole word.

### Hooks

- `hooks/useMushafVerseText` / `useMushafVerseWords` — mushaf-scoped, follow `useMushafSettingsStore.rewayah`.
- `hooks/useVerseTextInRewayah` / `useVerseWordsInRewayah` — take an explicit rewayah, trigger lazy load, re-render when the load completes.
- `hooks/useCurrentTrackRewayah` — resolves the rewayah of the currently-playing track by looking up the reciter record and mapping its rewayat name to a canonical RewayahId.

### Rewayah name mapping

`utils/rewayahLabels.ts::mapRewayatNameToRewayahId` normalizes Supabase `rewayat.name` strings ("Hafs A'n Assem", "Warsh A'n Nafi'") to the 8 canonical `RewayahId` values via keyword matching. Unsupported rewayat (e.g., Khalaf 'an Hamzah from the 10 Qira'at) return `null` and callers fall back to Hafs.

`getRewayahShortLabel(id)` returns the short display label used across surfaces (Hafs, Shu'bah, Al-Bazzi, Qunbul, Warsh, Qalun, Al-Duri, Al-Susi).

## Surface integration

| Surface | Reads from | Disclosure |
|---|---|---|
| Mushaf page (SkiaPage) | active mushaf rewayah | Header meta: `Page N · Juz M · <Rewayah>`; toast on switch |
| Mushaf Settings | active mushaf rewayah | Show Differences switch + collapsible color legend per rewayah |
| List / reading views | active mushaf rewayah via DK hooks | — |
| Copy verse | payload rewayah ?? mushaf rewayah | Appends `Quran X:Y · <Rewayah>` when non-Hafs |
| Share as text | same | Appends `-- Quran X:Y · <Rewayah>` |
| Share as image | same | Small rewayah label paragraph above watermark when non-Hafs |
| Share link URL | same | `?rewayah=<id>` query param when non-Hafs |
| Player verse list | currently-playing track's rewayah | Reciter rewayat name already shown in TrackInfo |
| Word-by-word view | **Hafs only** — WBW data is Hafs-aligned | "Word-by-word shown in Hafs" notice when context rewayah isn't Hafs |
| Verse bookmarks / notes / highlights | stamp rewayah at save time | Short label pill on list items; silent `switchRewayah` + toast on tap |

## User-generated content stamping

Verse annotations (bookmarks, notes, highlights) capture the rewayah the user was in at save time in a nullable `rewayah_id` column on each SQLite table. Legacy rows created before rewayah support are backfilled to `'hafs'` in `VerseAnnotationDatabaseService.createTables()`. Opening a saved item from the collection silently restores the saved rewayah via `digitalKhattDataService.switchRewayah` + toast before routing to `/mushaf`.

Audio-side UGC (loved tracks, downloads, playlists, recently played) already stamped `rewayatId` pre-feature — no migration needed.

## Known limits

- **Alignment gaps** — unmatched Hafs slots where the rewayah word-count diverges. Counts: Shu'bah/Bazzi/Qumbul <20 each, Doori 36, Soosi 126, Qalun 1,131, Warsh 1,532. Gaps show up as Hafs words mixed into rewayah text (Nafi' is ~65% divergent from Hafs). Future pass: tighter per-surah aligner or a from-scratch Warsh base DB.
- **Nafi' rule coverage** — KFGQPC encodes madd al-badal, tashil/musahhala, and ibdal/taghliz (via heuristics). Taqlil, tarqiq ar-ra, and naql are not yet highlighted — no open dataset covers those per-letter. Author a rule classifier later.
- **Abu Amr rules** — only genuine content variants flagged. Idgham kabeer, imalah, and the hamza-treatment rules specific to Abu Amr would need either open data or a hand-written rule classifier.
- **WBW alignment** — translation/transliteration word positions are Hafs-only. WBW renders in Hafs regardless of context rewayah, with a disclosure.

## Key files

- `scripts/rewayah/build_sibling_rewayah.py` — build pipeline.
- `scripts/rewayah/normalize.py` — KFGQPC text normalization.
- `services/mushaf/DigitalKhattDataService.ts` — multi-rewayah words DB loading + side cache.
- `services/mushaf/RewayahDiffService.ts` — diff JSON loader + render-time category queries.
- `store/mushafSettingsStore.ts` — `RewayahId` union, active rewayah persistence.
- `hooks/useVerseForRewayah.ts` — mushaf and explicit-rewayah read hooks.
- `hooks/useCurrentTrackRewayah.ts` — player-context rewayah resolver.
- `utils/rewayahLabels.ts` — short labels + DB-name mapping.
- `components/MushafSettingsContent.tsx` — rewayah picker + legend.
- `components/mushaf/main.tsx` — header meta with rewayah suffix.
- `components/mushaf/skia/SkiaPage.tsx` — highlight rendering.
- `components/sheets/VerseActionsSheet.tsx` — copy/share rewayah disclosure.
- `services/database/VerseAnnotationDatabaseService.ts` — `rewayah_id` column + backfill migration.
- `data/mushaf/digitalkhatt/dk_words_<id>.db` — per-rewayah words DBs.
- `data/mushaf/digitalkhatt/<id>-diff.json` — per-rewayah highlight maps.
