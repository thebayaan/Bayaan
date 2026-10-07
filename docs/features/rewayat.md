# Feature: Rewayat (Multi-Qira'at Support)

**Status:** Shipped (2026-04); data rebuilt from the official KFGQPC v2.x texts with exact-match gates (Release 1, 2026-10).
**Source:** King Fahd Glorious Qur'an Printing Complex (KFGQPC) developer data v2.x, vendored and checksum-locked in `scripts/rewayah/sources/` (see `scripts/rewayah/sources/SOURCES.md`).
**Complexity:** High: multi-DB architecture, per-rewayah verse numbering on a shared Hafs layout, highlight maps, cross-surface propagation.

## Overview

Bayaan supports the 8 KFGQPC rewayat as interchangeable reading modes. Users switch rewayah in Mushaf Settings; the mushaf rerenders in the selected reading, and the switch ripples into the audio player, share/copy surfaces and saved user annotations.

Quran text is zero-tolerance: every word and every verse number of a non-Hafs rewayah must equal the official KFGQPC text. This is enforced by automated gates in the build and in CI (see [Verification](#verification)).

## Supported rewayat

| Rewayah | File id | Verse count (system) | Highlight categories |
|---|---|---|---|
| Hafs 'an 'Asim | (`digital-khatt-v2.db`) | 6236 (Kufi) | none (baseline) |
| Shu'bah 'an 'Asim | `shouba` | 6236 (Kufi) | `major`, `silah` |
| al-Bazzi 'an Ibn Kathir | `bazzi` | 6220 (Makki) | `major`, `silah` |
| Qunbul 'an Ibn Kathir | `qumbul` | 6220 (Makki) | `major`, `silah` |
| Warsh 'an Nafi' | `warsh` | 6214 (Madani al-Akhir) | `mukhtalif`, `silah` |
| Qalun 'an Nafi' | `qaloon` | 6214 (Madani al-Akhir) | `mukhtalif`, `silah` |
| al-Duri 'an Abi 'Amr | `doori` | 6217 (as printed by KFGQPC) | `mukhtalif`, `silah` |
| al-Susi 'an Abi 'Amr | `soosi` | 6217 (as printed by KFGQPC) | `mukhtalif`, `silah` |

App `RewayahId` → file id: `warsh`→`warsh`, `qalun`→`qaloon`, `al-bazzi`→`bazzi`, `qunbul`→`qumbul`, `al-duri-abi-amr`→`doori`, `al-susi`→`soosi`, `shubah`→`shouba`.

## Data architecture (Release 1)

Every rewayah ships as a Hafs-layout sibling:

- **Shared layout** (`digital-khatt-15-lines.db`): the 604-page Madinah Hafs geometry, by Hafs word id.
- **Per-rewayah words DB** (`dk_words_<id>.db`): the same schema and the same 83,668 rows as `digital-khatt-v2.db` (id, location, surah, ayah, word unchanged). Only `words.text` differs:
  - `''`: a blank slot, renders nothing and adds no separator (a Hafs-only word, the second half of a merged word, or a Hafs verse end the rewayah does not have);
  - one token, or several tokens joined by single spaces: one word unit for layout, taps and highlights (e.g. 37:130 `إِلْ يَاسِينَ`, Ibn Kathir 9:100 `تَجْرِي مِن`);
  - a content slot may end with an inline verse marker, `عَلَيْهِمْ ۝٦`, for a rewayah verse end that has no Hafs marker slot (Warsh/Qalun 59, Bazzi/Qunbul 67, Duri/Susi 57);
  - a Hafs marker slot holds the rewayah's `۝N`, or `''` (Warsh/Qalun 81, Bazzi/Qunbul 83, Duri/Susi 76, Shu'bah 0);
  - `۞` is attached to the following word.
- **Highlight map** (`<id>-diff.json`, format 2) and **verse map** (`<id>-versemap.json`, format 1), both keyed by Hafs verse keys and word positions.
- **Fonts**: the DigitalKhatt fonts draw every rewayah. The KFGQPC per-riwayah fonts would need per-riwayah layouts (Release 2).

Every surah of every rewayah displays its verse numbers 1..N exactly as the official text numbers them. Data stays keyed by the Hafs verse; `<id>-versemap.json` translates (`r2h`: rewayah verse → Hafs verse keys holding its words, `h2r`: the inverse).

## Sources and provenance

`scripts/rewayah/sources/<id>.json` are the official KFGQPC JSON files, byte for byte (Warsh v2.1, Qalun v2.1, al-Duri v2.0, al-Susi v2.0, Shu'bah v2.0, al-Bazzi and Qunbul v2.0 qc2 data). Each package matches the MD5 and SHA-1 KFGQPC publishes on its developer page; `sources.lock.json` pins every SHA-256. The KFGQPC hosts were unreachable when the files were vendored, so they came from Internet Archive raw captures of the official URLs (listed in `SOURCES.md`).

- The al-Bazzi and Qunbul texts were cross-checked against the KFGQPC-signed Word files: al-Bazzi is identical; Qunbul differs only at 67:17 (Makki), where the JSON lost a verse-initial small waw. `sources/errata.json` restores it from the signed Word file (the only erratum).
- `UthmanicQunbul_v2-0.zip` is NOT used: its JSON holds the al-Bazzi text.
- Known upstream issue, not corrected: Qunbul 4:135 (Hafs 4:136) `أُنزَلَ` in both official Qunbul artifacts, where Ibn Kathir reads `أُنزِلَ`.
- `sources/hafs.json` (Hafs v2.0) is only used to prove the KFGQPC → DigitalKhatt convention map.

## Build pipeline

```sh
python3 scripts/rewayah/vendor_sources.py --check
python3 scripts/rewayah/build_sibling_rewayah.py
python3 scripts/rewayah/validate_rewayah_db.py --glyphs
```

`scripts/rewayah/README.md` documents every step. In short:

1. **Verify** each source against `sources.lock.json`.
2. **Tokenize** (`normalize.parse_verse`): the v2.x verse number (one code point U+FC00 + n − 1, or digits) is checked against `aya_no` and removed; NBSP is a space; RLM dropped; a standalone `۞` is attached to the next word; a letterless token is glued to the previous word.
3. **Convert** each token (`normalize.dk_token`): KFGQPC → DigitalKhatt encoding conventions (sukun shapes, open tanween, decomposed hamza, `ـَٔا`) plus the per-rewayah [render policy](#render-policy).
4. **Align** each surah's Hafs word slots with the rewayah tokens on their rasm skeleton: skeleton-equality anchors and a banded dynamic programme (moves 1:1, 1:0, 0:1, 2:1, 1:2). Hafs text never leaks into a slot and no rewayah word is dropped.
5. **Assign** with declared policies: Hafs-only word → `''` (Nafi' 57:24 `هُوَ`); one token over two slots → first slot (15:7, 27:20, 36:22, 40:26, 73:20, 75:1); extra token → previous slot (9:100); 37:130 keeps both words; sources without a basmala verse (Madani / Basri counts) keep the exact Hafs basmala, unnumbered, in 1:1, and number from al-hamdu (`۝٦` inline after `عَلَيْهِمْ`).
6. **Markers**: a Hafs marker slot receives the rewayah marker whose verse ends there, else `''`; rewayah verse ends without a Hafs slot are written inline.
7. **Emit** the words DB (fresh `CREATE TABLE` + `INSERT` + `VACUUM`, deterministic bytes), the highlight map and the verse map from the same assignment; run the validator; replace the committed files only if every rewayah passes.

After a rebuild the runtime's asset manifest (`services/mushaf/rewayahDataManifest.ts`, `node scripts/rewayah/gen-manifest.mjs`) must be regenerated so installed apps re-import the new DBs (content-addressed on-device names).

## Render policy

The DigitalKhatt font is a Madani font: some KFGQPC riwayah marks have no glyph in it, and a few are drawn with a different meaning. `normalize.RENDER_POLICY` lists each one with its meaning, what DK draws, the decision and the evidence (`python3 scripts/rewayah/normalize.py --policy`):

| Mark | Rewayat | Decision |
|---|---|---|
| U+06D2 yeh barree | Warsh, Qalun | → U+0649 alef maksura |
| U+0652 Maghribi sukun (circle) | Warsh, Qalun | → U+06DF (DK's circle) |
| U+06D6 Habti waqf `ص` | Warsh, Qalun | omitted: DK draws the Madani `صلى` (continuing preferred), the opposite advice |
| U+06E4 sajdah overline | Shu'bah, Bazzi, Qunbul, Duri, Susi | dropped (`۩` kept) |
| U+06EA dot below | all | → U+065C dot below (imala / taqlil / tashil dots and the wasl-alef start-with-kasra dot) |
| U+06ED hollow taqlil dot | Duri, Susi | → U+065C (DK has no hollow dot) |
| kasra + U+06E2 | Warsh, Qalun, Duri, Susi | → kasra + U+06ED: the iqlab meem drawn below, as KFGQPC draws it |
| U+200D hamza seat (17:7) | Duri, Susi | → U+0640 tatweel seat |
| U+066E dotless tooth (6:19) | Bazzi, Qunbul | → U+0649 |
| `ضظ` (81:24) | Bazzi, Qunbul, Duri, Susi | → `ظ`: KFGQPC draws ض with a small ظ (read ظ); DK has no small ظ |

Letters change only through the three listed mappings (U+06D2, U+066E, `ضظ`); the letter gate enforces it.

## Highlight model

The diff JSON is format 2: `{"__format": 2, "s:a": {category: [[wordPos, [charIdx, ...]], ...]}}`, Hafs verse keys and word positions; the loader skips `__format`.

| Category | Rewayat | Channel | Meaning |
|---|---|---|---|
| `major` | Shu'bah, Bazzi, Qunbul | background tint, whole word (`[]`) | the word is read differently from the Hafs word in that slot |
| `mukhtalif` | Warsh, Qalun, Duri, Susi | background tint, whole word (`[]`) | same |
| `silah` | all with differences | foreground, explicit char indices | silah marks (ۥ ۦ and their damma / kasra) this rewayah pronounces where Hafs does not |

"Read differently" means different letters (including a hamza Hafs does not have), long vowels (the dagger alef counts: 1:4 `مَلِكِ` vs `مَٰلِكِ`), vowels or case ending. Encoding conventions (wasl writing, sukun shapes, tanween placement, ى/ي, shadda) and general rules marked only by diacritics or by the hamza's carrier (madd length, imala / taqlil dots, two-hamza tashil, and for Warsh / al-Susi the softened hamza, naql and idgham kabir) are not tinted; `scripts/rewayah/highlights.py` defines the rules. Whole-word entries per rewayah: Warsh 719, Qalun 1,263, al-Duri 1,203, al-Susi 1,031, al-Bazzi 999, Qunbul 1,038, Shu'bah 524. Silah entries: al-Bazzi 7,260, Qunbul 7,263, Warsh 945, others under 50.

Release 1 does not emit the letter-level categories `tashil`, `madd`, `ibdal`, `taghliz` or `minor`: an audit found them 84-99% false or never produced, and the legend must not advertise them. A whole-word tint must not cover a trailing inline marker (`' ۝N'`), and `silah` comes from the JSON, not from scanning the stored text (format 2).

## Runtime architecture

### DigitalKhattDataService: multi-rewayah read API

The service (`services/mushaf/DigitalKhattDataService.ts`) is a singleton with one "active" rewayah that the mushaf page follows. For non-mushaf surfaces that need text from a different rewayah (e.g., the player rendering the reciter's reading while the mushaf shows a different one):

- `getVerseText(verseKey, rewayah?)` / `getVerseWords(verseKey, rewayah?)` accept an optional rewayah that reads from a side cache instead of mutating the active one.
- `ensureRewayahLoaded(rewayah)` lazy-imports and caches a non-active rewayah's words DB.

Blank slots contribute nothing (no separator) and a multi-token slot is one word unit; derived caches (verse map, tajweed maps, Allah-name memos, page memos) are keyed by the active rewayah and the data version.

### RewayahDiffService: highlight map loader

`services/mushaf/RewayahDiffService.ts` loads `<id>-diff.json` and exposes background ranges (`major` + `mukhtalif`) and foreground char indices (`silah`) per page line and per verse. It also accepts the legacy pre-format-2 shapes.

### Hooks

- `hooks/useMushafVerseText` / `useMushafVerseWords`: mushaf-scoped, follow `useMushafSettingsStore.rewayah`.
- `hooks/useVerseTextInRewayah` / `useVerseWordsInRewayah`: take an explicit rewayah, trigger lazy load, re-render when the load completes.
- `hooks/useCurrentTrackRewayah`: resolves the rewayah of the currently-playing track from the reciter record.

### Rewayah name mapping

`utils/rewayahLabels.ts::mapRewayatNameToRewayahId` normalizes Supabase `rewayat.name` strings ("Hafs A'n Assem", "Warsh A'n Nafi'") to the 8 canonical `RewayahId` values via keyword matching. Unsupported rewayat (e.g., Khalaf 'an Hamzah) return `null` and callers fall back to Hafs. `getRewayahShortLabel(id)` returns the short display label (Hafs, Shu'bah, Al-Bazzi, Qunbul, Warsh, Qalun, Al-Duri, Al-Susi).

## Surface integration

| Surface | Reads from | Disclosure |
|---|---|---|
| Mushaf page (SkiaPage) | active mushaf rewayah | Header meta: `Page N · Juz M · <Rewayah>`; toast on switch |
| Mushaf Settings | active mushaf rewayah | Show Differences switch + color legend per rewayah |
| List / reading views | active mushaf rewayah via DK hooks | none |
| Copy verse | payload rewayah ?? mushaf rewayah | Appends `Quran X:Y · <Rewayah>` when non-Hafs |
| Share as text | same | Appends `-- Quran X:Y · <Rewayah>` |
| Share as image | same | Small rewayah label paragraph above watermark when non-Hafs |
| Share link URL | same | `?rewayah=<id>` query param when non-Hafs |
| Player verse list | currently-playing track's rewayah | Reciter rewayat name already shown in TrackInfo |
| Word-by-word view | **Hafs only**: WBW data is Hafs-aligned | "Word-by-word shown in Hafs" notice when context rewayah isn't Hafs |
| Verse bookmarks / notes / highlights | stamp rewayah at save time | Short label pill on list items; silent `switchRewayah` + toast on tap |

## User-generated content stamping

Verse annotations (bookmarks, notes, highlights) capture the rewayah the user was in at save time in a nullable `rewayah_id` column on each SQLite table. Legacy rows created before rewayah support are backfilled to `'hafs'` in `VerseAnnotationDatabaseService.createTables()`. Opening a saved item from the collection silently restores the saved rewayah via `digitalKhattDataService.switchRewayah` + toast before routing to `/mushaf`.

Audio-side UGC (loved tracks, downloads, playlists, recently played) already stamped `rewayatId` pre-feature; no migration needed.

## Verification

`scripts/rewayah/validate_rewayah_db.py` (also run by the builder before it replaces any file, and by CI in `.github/workflows/quran-data.yml`) fails on:

- a source that does not match `sources.lock.json`;
- a DB whose schema or rows (other than `text`) differ from `digital-khatt-v2.db`;
- a malformed slot or a code point outside the DigitalKhatt cmap;
- any difference between the slot tokens read in id order and the normalized official tokens of each surah (content and verse markers, P10 and A2 the only allowed exceptions);
- verse numbers that are not 1..N per surah;
- a stored token whose base letters differ from its official token (outside the listed mappings);
- a diff entry that is not on an existing non-blank content slot whose text differs from Hafs, or a silah index that is not on a silah mark before any inline marker;
- a verse map that differs from the one re-derived from the DB;
- with `--glyphs`: any `.notdef` or dotted circle when shaping every stored word with DigitalKhattFont.otf and the V1 font (HarfBuzz), or an unattached mark outside the listed render limitations.

`validate.py` proves the convention map on the official Hafs text (77,385 of 77,429 words identical to the DK Hafs DB; the rest are 25 listed verses with DK-only encodings). `compare_outputs.py` checks that the committed files are what a fresh build produces. Two builds are byte-identical.

## Known limits

- **Hafs layout.** Release 1 keeps the Hafs word slots and page lines: line breaks, page starts and word slots follow the Hafs mushaf, not the printed riwayah mushaf. Merged / split words leave blank or multi-token slots; rewayah-only verse ends appear inline.
- **DigitalKhatt cannot draw some riwayah marks.** The Maghribi wasl alef (connecting vowel + start dot) is drawn with Madani vowel marks, so it can look like a hamzat qat'; the side dot (U+06DF) is drawn as a small circle above; taqlil and imala share one filled dot; the Habti waqf signs are omitted; KFGQPC dots on a waw / ya / ain / ha / dal / seen, the hamza below a tatweel and Qunbul's small seen on `صِرَٰطَ` have no anchor and sit at their default position (listed in the validator); 81:24 shows `ظ` instead of ض with a small ظ.
- **Highlights** cover whole-word reading differences and silah only; letter-level rules (madd, tashil, ibdal, taghliz, taqlil, naql) are not highlighted in Release 1.
- **Word-by-word** translation and transliteration remain Hafs-only.

## Release 2 plan

Per-riwayah official layouts (page / line / word from the KFGQPC data and print files) rendered with the KFGQPC riwayah fonts, which draw every mark of the official text (Maghribi wasl and waqf signs, hollow taqlil dot, small ظ), with riwayah-native word ids and verse keys. Release 1's sources, render policy and gates are the starting point.

## Key files

- `scripts/rewayah/` (README, sources, builder, validator, render policy, highlight rules).
- `services/mushaf/DigitalKhattDataService.ts`: multi-rewayah words DB loading + side cache.
- `services/mushaf/RewayahDiffService.ts`: diff JSON loader + render-time category queries.
- `store/mushafSettingsStore.ts`: `RewayahId` union, active rewayah persistence.
- `hooks/useVerseForRewayah.ts`: mushaf and explicit-rewayah read hooks.
- `hooks/useCurrentTrackRewayah.ts`: player-context rewayah resolver.
- `utils/rewayahLabels.ts`: short labels + DB-name mapping.
- `components/MushafSettingsContent.tsx`: rewayah picker + legend.
- `components/mushaf/skia/SkiaPage.tsx`: highlight rendering.
- `components/sheets/VerseActionsSheet.tsx`: copy/share rewayah disclosure.
- `services/database/VerseAnnotationDatabaseService.ts`: `rewayah_id` column + backfill migration.
- `data/mushaf/digitalkhatt/dk_words_<id>.db`, `<id>-diff.json`, `<id>-versemap.json`: per-rewayah data.
