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
- Known upstream issues, not corrected (details in `SOURCES.md`): Qunbul 4:135 (Hafs 4:136) `أُنزَلَ` in both official Qunbul artifacts, where Ibn Kathir reads `أُنزِلَ`; Qalun 17:62 `قَالْ` (a sukun on the lam) in both official Qalun JSONs, where every reading has `قَالَ`; Warsh 43:58 `جَدَلاَ` without the iqlab meem (no tanween as written) in both official Warsh JSONs and the Warsh Word file, where Qalun has `جَدَلاَۢ`; al-Duri 43:78 `لَقَدۡ جِّئۡنَٰكُم`, a sukun on the dal before the doubled jim it merges into, in both official al-Duri JSONs and the al-Duri Word file (al-Susi: `لَقَد جِّينَٰكُم`).
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
3. **Convert** each token (`normalize.dk_tokens`): KFGQPC → DigitalKhatt encoding conventions (sukun shapes, open tanween, decomposed hamza, `ـَٔا`) plus the per-rewayah [render policy](#render-policy). The token read before it is passed as context, because the KFGQPC dot U+06DF has two meanings (below).
4. **Align** each surah's Hafs word slots with the rewayah tokens on their rasm skeleton: skeleton-equality anchors and a banded dynamic programme (moves 1:1, 1:0, 0:1, 2:1, 1:2). Hafs text never leaks into a slot and no rewayah word is dropped.
5. **Assign** with declared policies: Hafs-only word → `''` (Nafi' 57:24 `هُوَ`); one token over two slots → first slot (15:7, 27:20, 36:22, 40:26, 73:20, 75:1); extra token → previous slot (9:100); 37:130 keeps both words; sources without a basmala verse (Madani / Basri counts) keep the exact Hafs basmala, unnumbered, in 1:1, and number from al-hamdu (`۝٦` inline after `عَلَيْهِمْ`).
6. **Markers**: a Hafs marker slot receives the rewayah marker whose verse ends there, else `''`; rewayah verse ends without a Hafs slot are written inline.
7. **Emit** the words DB (fresh `CREATE TABLE` + `INSERT` + `VACUUM`, deterministic bytes), the highlight map and the verse map from the same assignment; run the validator and the sibling gate; replace the committed files only if every rewayah passes. A words DB whose rows did not change keeps its committed bytes (another SQLite version would write other bytes for the same rows; the committed DBs come from SQLite 3.53.3). The build directory is under `scripts/rewayah/.build/` (git-ignored).

After a rebuild that changes data, the runtime's asset manifest (`services/mushaf/rewayahDataManifest.ts`, `node scripts/rewayah/gen-manifest.mjs`) must be regenerated so installed apps re-import the new DBs (content-addressed on-device names).

## Render policy

The DigitalKhatt font is a Madani font: some KFGQPC riwayah marks have no glyph in it, and a few are drawn with a different meaning. `normalize.RENDER_POLICY` lists each one with its meaning, what DK draws, the decision and the evidence (`python3 scripts/rewayah/normalize.py --policy`):

| Mark | Rewayat | Decision |
|---|---|---|
| U+06DF dot in place of a softened or changed hamza (`أَ۟ذَا`, Qalun `أَٰ۟نَّكَ`, `هَٰؤُلَآ۟`, Qunbul `جَآءَ ا۟لَ`) | Warsh 26, Qalun 39, Bazzi 46, Qunbul 33, Duri 32, Susi 32 | → U+06EC, DK's tashil dot (Hafs 41:44); DK draws U+06DF as the Madani circle 'this letter is never pronounced', which inverted the meaning. The KFGQPC Bazzi / Qunbul / Duri / Susi texts themselves write the 23:44 tashil with U+06EC. Which of the two uses applies is decided from the token and the word before it (`side_dot_kinds`, checked against a Hafs-alignment oracle on all 877 U+06DF). A waqf sign written after the dot is moved before it (DK would attach the sign to the dot and draw both on the line): al-Bazzi 34:9 `ٱلسَّمَآۚ۬` and 46:31 (Hafs 46:32) `أَوْلِيَآۚ۬`; Qalun's two (same places) carry the Habti sign, which is omitted (below) |
| U+06DF start-with-damma dot beside a silent alef (hamzat al-wasl, 138 per far rewayah; Warsh naql `كُفَّارٌ ا۟وْلَٰٓئِكَ`, 117) | Warsh, Qalun, Duri, Susi | kept: DK draws its circle above the alef (silent in connected reading, as the alef is); the start vowel is lost |
| sukun + small high seen (69:28) | Bazzi, Qunbul, Shu'bah | CGJ inserted between them, as the DK Hafs DB writes 69:28 / 75:27 / 83:14 (otherwise DK stacks the sukun on the seen) |
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
| Maghribi wasl alef: alef + connecting vowel (+ start dot), also Warsh's naql alef (words with such a cluster: Warsh 12,597, Qalun 10,682, Duri / Susi 12,767) | Warsh, Qalun, Duri, Susi | kept verbatim (as on develop). The KFGQPC fonts draw the connecting vowel as a stroke beside the alef; DK draws a Madani fatha / damma / kasra on it, so a Madani reader sees a pronounced, hamzated vowel (Warsh 1:5 `اُٜه۟دِنَا`). Evaluated alternatives: (A) DK's `ٱ` with no connecting vowel or start dot (Madani convention; the start vowel is not shown; changes a letter), (B) a bare alef with the start dot only (closest to the KFGQPC drawing; the start-with-damma dot then shows as DK's circle) |

Letters change only through the three listed mappings (U+06D2, U+066E, `ضظ`); the letter gate enforces it. The decisions that change what a reader sees (tashil dot, start-with-damma dot, Habti sign omitted, wasl start-with-kasra dot, 81:24 `ظ`, the wasl alef with its connecting vowel) are flagged `confirm` in the policy table and await a qualified reader's sign-off.

## Highlight model

The diff JSON is format 2: `{"__format": 2, "s:a": {category: [[wordPos, [charIdx, ...]], ...]}}`, Hafs verse keys and word positions; the loader skips `__format`.

| Category | Rewayat | Channel | Meaning |
|---|---|---|---|
| `major` | Shu'bah, Bazzi, Qunbul | background tint, whole word (`[]`) | the word is read differently from the Hafs word in that slot |
| `mukhtalif` | Warsh, Qalun, Duri, Susi | background tint, whole word (`[]`) | same |
| `silah` | all with differences | foreground, explicit char indices | silah marks (ۥ ۦ and their damma / kasra) this rewayah pronounces where Hafs does not |

"Read differently" means different letters (including a hamza Hafs does not have, and a letter the rewayah never pronounces: Qunbul 75:1 `لَا۟`), long vowels (the dagger alef counts: 1:4 `مَلِكِ` vs `مَٰلِكِ`; 33:14 `لَأَتَوْهَا` vs `لَـَٔاتَوْهَا`; an alef Hafs reads in waqf only, which Nafi' and Shu'bah also read in wasl: 33:10 `ٱلظُّنُونَا`, 33:66 `ٱلرَّسُولَا`, 33:67 `ٱلسَّبِيلَا`), doubling (5:89 `عَقَدتُّمُ`, `تَذَّكَّرُونَ`, al-Bazzi's doubled first ta' in wasl, his 31 ta's: `وَلَآ تَّيَمَّمُوا۟`), vowels or case ending (2:284 `فَيَغْفِرْ`, the ya' al-idafa `إِنِّيَ` vs `إِنِّيٓ`, the ha' al-kinaya `يُؤَدِّهْ`, al-Duri 32:7 `خَلْقَهُۥ`), a question read as a statement or the reverse (7:123 `ءَاٰ۬مَنتُم` vs Hafs `ءَامَنتُم`, al-Duri 38:63 `اِتَّخَذْنَٰهُمْ`), and a hamzat qat' read as a wasl alef (Nafi' / Ibn Kathir 20:77 `ٱسْرِ`); in Shu'bah, al-Bazzi and Qunbul an imala dot also counts (Shu'bah `رٜءٜا`). Encoding conventions (wasl writing, sukun shapes, tanween placement, ى/ي, shadda, the hamza's seat, the unmarked doubled lam of the article in `الذين` / `لله`, the Hafs small low seen of 52:37 `ٱلْمُصَۣيْطِرُونَ`, read with sad, and three reviewed Nafi' spellings of the same reading: 14:5 `بِأَييَّٰمِ`, 51:47 `بِأَيَي۟دࣲ`, 55:54 `وَجَنَا`) and general rules marked only by diacritics or by the hamza's carrier are not tinted: madd length, imala / taqlil dots, the two-hamza rules (tashil, ibdal, isqat, and idkhal, the alef Qalun and Abu 'Amr insert between two hamzas: never tinted, 2:6 `ءَٰا۬نذَرْتَهُمْ`), Warsh's and al-Susi's ibdal of a vowelless hamza, Warsh's naql, and idgham. `scripts/rewayah/highlights.py` defines the rules.

The two-hamza rules compare the second hamza as one unit whatever its form (the tashil dot on its seat, a written hamza, Warsh's long alef), so a hamza + long a (Hafs `ءَامَنتُم`, a statement) still differs from two hamzas + long a (`ءَاٰ۬مَنتُم`, a question). Warsh's own hamza rules are his general ones only (a vowelless hamza, the ibdal the KFGQPC text marks with the dot `مُوَ۬جَّلًا` / `لِيَ۬لَّا`, the naql of the article's lam), so the word-specific hamza readings of Nafi' are tinted in Warsh as in Qalun: `أَرَءَيْتَ` (34 words), `ٱلْأَنۢبِئَآءَ`, 19:19 `لِيَهَبَ`.

Rules that work across words apply only in their context (the words before and after in Hafs and in the rewayah, across verse ends; across surah ends only where the official text joins them): the second of two hamzas across words may lose its hamza at the start of a word only right after a word that ends in a voweled hamza (never after a basmala); Warsh's naql excuses a hamza dropped at the start of a word only when the previous word takes its vowel (or ends in a tanween), and a vowel added on a final consonant when the next word's hamza, dropped by Warsh, carries that vowel (`قَدَ اَف۟لَحَ`); al-Susi's idgham kabir excuses a dropped final vowel or silah when the letter merges into the next word (a doubled first letter `ٱلرَّحِيم مَّلِكِ`, a meem concealed before ba `أَعْلَم بِمَا`, a ba before the next surah's basmala at 13:43 and 14:52, which the signed al-Susi Word file writes `بِّسۡمِ`). Anywhere else the dropped hamza or the added or dropped vowel is a reading difference. A doubled first letter that Hafs does not have is an idgham with the previous word (usul, and that word carries any difference itself) only when the previous word really merges into it: a nun or tanween before ي ر م ل و ن (`مَن۟ يَّقُولُ`), a letter written without vowel or sukun (`قَد جَّآءَكُم`, `إِذ تَّبَرَّأَ`, `قُل رَّبِّي`), al-Susi's idgham kabir (`غَفَرَ لِّي`), a waw / ya into itself. After an alef, a sukun, a vowel, or a nun or tanween before another letter it is the word's own doubling: al-Bazzi's ta' (`وَلَآ تَّيَمَّمُوا۟`, `هَلْ تَّرَبَّصُونَ`, `فَإِن تَّوَلَّوْا۟`, `نَارࣰا تَّلَظَّىٰ`). The first of two hamzas across words changed into the waw before it and merged (Qalun and al-Bazzi 12:53 `بِالسُّوِّ إِلَّا`) is a two-hamza rule like Abu 'Amr's dropping of it, and a final long a that no reading pronounces before a wasl alef is not a difference when the text leaves out its dagger alef (Warsh 20:135 `اِٜه۟تَدَى`, joined to 21:1). Two narrators of one reader read the same words the same way, so Warsh and al-Susi also take the whole-word tint Qalun and al-Duri give to the same reading (the same stored words, or words that differ only in encoding under the sibling's own rules, or in al-Susi the same word with its final vowel merged by the idgham kabir): hamza-only farsh that their own hamza rules would hide (`يَاجُوجَ`, Nafi' `مُوصَدَةٌ` at 90:20 and 104:8), Abu 'Amr's 2:284 jazm and case endings at 6:27 `نُكَذِّبُ` and 16:12 `وَٱلنُّجُومَ` (al-Susi `نُكَذِّب بِّـَٔايَٰتِ`), and the naql of both Nafi' narrators in Yunus' `آلآن` (10:51, 10:91; elsewhere Qalun reads `ٱلْـَٰٔنَ` with its hamza and Warsh's naql is his own rule). The validator's sibling gate checks every pair, and its `cases` gate checks the reviewed decisions in `scripts/rewayah/highlight_cases.json` (546 decisions in 47 groups, one rule each). Whole-word entries per rewayah: Warsh 1,008, Qalun 1,285, al-Duri 1,283, al-Susi 1,284, al-Bazzi 1,089, Qunbul 1,103, Shu'bah 632. Silah entries: al-Bazzi 7,260, Qunbul 7,263, Warsh 945, others under 50.

Decisions to confirm with a qualified reader (each is one rule in `highlights.py` and one group in `highlight_cases.json`): idkhal is never tinted (it is a two-hamza rule); the alef of `أَنَا` that Nafi' pronounces before a hamza with fatha or damma (12 words, Warsh writes `أَنَآ`) is not tinted (Qalun's text does not mark it); Warsh takes Qalun's tint for the same reading (10:51, 10:91, 90:20); Nafi' `أَرَءَيْتَ` (34 words) is tinted in Warsh too, as a word-specific hamza reading outside his general rules; 52:37 `ٱلْمُصَيْطِرُونَ` counts Hafs's preferred sad (the small low seen allows a seen too), so the six sad readers are not tinted and Qunbul's seen is; 69:28 `مَالِيَه`: Hafs prints the sakt, the far rewayat's texts print the idgham into `هَّلَكَ` (both are valid for every reader) and are tinted as printed; Shu'bah 41:44 `ءَأَعْجَمِيٌّ` (both hamzas, where Hafs softens the second) is tinted; a ha' al-kinaya with sukun in Hafs that the rewayah reads with kasra and silah (Warsh 7:111, 26:36 `أَر۟جِهِۦ`; Ibn Kathir 27:28 `فَأَلْقِهِۦ`) gets the silah colour only, while Qalun's kasra without silah at the same words gets the whole-word tint; the suspected upstream errors (Qalun 17:62, Warsh 43:58, al-Duri 43:78) are tinted as written.

Release 1 does not emit the letter-level categories `tashil`, `madd`, `ibdal`, `taghliz` or `minor`: an audit found them 84-99% false or never produced, and the legend must not advertise them. A whole-word tint must not cover a trailing inline marker (`' ۝N'`), and `silah` comes from the JSON, not from scanning the stored text (format 2).

## Runtime architecture

### DigitalKhattDataService: multi-rewayah read API

The service (`services/mushaf/DigitalKhattDataService.ts`) is a singleton with one "active" rewayah that the mushaf page follows. For non-mushaf surfaces that need text from a different rewayah (e.g., the player rendering the reciter's reading while the mushaf shows a different one):

- `getVerseText(verseKey, rewayah?)` / `getVerseWords(verseKey, rewayah?)` accept an optional rewayah that reads from a side cache instead of mutating the active one.
- `ensureRewayahLoaded(rewayah)` lazy-imports and caches a non-active rewayah's words DB.

Blank slots contribute nothing (no separator) and a multi-token slot is one word unit; derived caches (verse map, tajweed maps, Allah-name memos, page memos) are keyed by the active rewayah and the data version.

**Data / runtime compatibility.** The Release 1 data depends on these runtime rules and on the format-2 loader (silah from the JSON, whole-word ranges that stop before an inline `۝N`). A runtime that predates Release 1 adds a separator for every blank slot, scans silah from the stored text and lets a whole-word range cover an inline marker, which misplaces taps and highlights around the 57-67 content slots per rewayah that end with an inline marker and the 76-83 blank marker slots. The data and the Release 1 runtime must ship in the same build, together with the regenerated asset manifest (`services/mushaf/rewayahDataManifest.ts`).

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
- a malformed slot, a code point outside the DigitalKhatt cmap, or a token that starts with a combining mark;
- any difference between the slot tokens read in id order and the normalized official tokens of each surah (content and verse markers, P10 and A2 the only allowed exceptions);
- verse numbers that are not 1..N per surah, or a verse number that is not in the first slot that can hold it (the Hafs marker slot right after the verse's last word; inline only when another word comes before the next Hafs marker slot);
- a stored token whose base letters differ from its official token (outside the listed mappings);
- a word in the wrong slot: every content slot must hold one rewayah word within a rasm-skeleton distance of 1/3 of the Hafs word in that slot, except the declared non-1:1 placements (P2 / P3 / P4 / 1:2 per rewayah), so a word moved to a neighbouring slot fails even when the reading order is intact;
- a diff entry that is not on an existing non-blank content slot whose words (without an inline marker) differ from Hafs, or a silah index that is not on a silah mark before any inline marker;
- a verse map that differs from the one re-derived from the DB;
- two narrators of one reader (Warsh / Qalun, al-Duri / al-Susi, al-Bazzi / Qunbul) whose DBs hold the same words in a slot but whose diff JSONs disagree on the whole-word tint there;
- a reviewed highlight decision in `scripts/rewayah/highlight_cases.json` that the diff JSON breaks (gate `cases`: e.g. 7:123 `ءَاٰ۬مَنتُم` tinted in all seven rewayat, idkhal untinted, Warsh `أَرَءَيْتَ` tinted, al-Bazzi's doubled ta' tinted while an idgham's doubled first letter is not, Nafi' `ٱلظُّنُونَا` tinted; a group per rule, added when a review settles a reading);
- with `--glyphs` (HarfBuzz, DigitalKhattFont.otf and the V1 font, pinned `uharfbuzz` / `fonttools`): any `.notdef`; any cluster (base + mark sequence) absent from the DK Hafs DB that is not in `scripts/rewayah/render_review.json`, the list of 259 clusters rendered next to the official KFGQPC fonts and reviewed; a mark without an anchor or turned into a spacing glyph outside a reviewed cluster and context; a review entry no DB uses. (The DK fonts have no dotted-circle glyph, so broken clusters are checked on the text.)

`validate.py` proves the convention map on the official Hafs text (77,388 of 77,429 words identical to the DK Hafs DB; the rest are 22 listed verses with DK-only encodings). `compare_outputs.py` checks that the committed files are what a fresh build produces. Two builds are byte-identical.

## Known limits

- **Hafs layout.** Release 1 keeps the Hafs word slots and page lines: line breaks, page starts and word slots follow the Hafs mushaf, not the printed riwayah mushaf. Merged / split words leave blank or multi-token slots; rewayah-only verse ends appear inline.
- **DigitalKhatt cannot draw some riwayah marks** (each case is a `limitation` family in `render_review.json`):
  - the Maghribi wasl alef (connecting vowel + start dot) and Warsh's naql alef are drawn with Madani vowel marks, so they can look like a hamzat qat' (about 48,000 words in the four far rewayat; the alternatives are listed under [Render policy](#render-policy) and await a decision);
  - the start-with-damma dot beside a silent alef is drawn as DK's small circle above it, so the start vowel is not shown;
  - the tashil dot is drawn above the letter (Madani position); where DK has no anchor for it (after a joined alef or alef madda, on a waw / ya / dal / seen / ain / ha) it falls on the line at the foot of the letter, where the KFGQPC fonts draw their own tashil dot, never above a dal or ain where it could read as ذ / غ; in Warsh 23:44 `اُ۬مَّةً` it overlaps the damma;
  - a dagger alef that carries the tashil dot or follows an alef is drawn as a small standing alef: Qalun `أَرَٰ۬يْتَ` (34 words) and Qalun / Duri / Susi `أَٰ۬ذَا` (80) show the dot on the small alef instead of above it, `ءَاٰ۬مَنتُمْ` / `ءَاٰ۬لِهَتُنَا` (7:123, 20:71, 26:49, 43:58 in six rewayat) likewise, and Warsh's naql `اٰمَنَ` / `آٰنتُمْ` (177 words) shows a second small alef where KFGQPC draws a madd stroke;
  - taqlil and imala share one filled dot; the Habti waqf signs are omitted;
  - the hamza below a tatweel (Nafi' `خَٰسِـِٕينَ`) is drawn on the tatweel line; Qunbul's small seen on `صِۜرَٰطَ` and the small noon of 12:110 have no anchor but sit above their letter;
  - 81:24 shows `ظ` instead of ض with a small ظ.
- **Upstream text.** Qunbul 4:135 (Hafs 4:136) `أُنزَلَ` is kept as both official Qunbul artifacts write it, although Ibn Kathir reads `أُنزِلَ` (as the official al-Bazzi text has it). Qalun 17:62 `قَالْ` (a sukun on the lam, in both official Qalun JSONs) is kept and tinted as written, although every reading has `قَالَ`. Warsh 43:58 `جَدَلاَ` (no iqlab meem, so no tanween as written, in both official Warsh JSONs and the Word file) and al-Duri 43:78 `لَقَدۡ جِّئۡنَٰكُم` (a sukun on the dal that the doubled jim says is merged, in both official al-Duri JSONs and the Word file) are kept and tinted as written. A qualified reader should decide all four before release (and, ideally, they are reported to KFGQPC); a correction is one entry in `sources/errata.json`.
- **Highlights** cover whole-word reading differences and silah only; letter-level rules (madd, tashil, ibdal, taghliz, taqlil, naql) are not highlighted in Release 1.
- **Omitted words** have no highlight: a word the rewayah does not read leaves its Hafs slot blank (Nafi' 57:24 `هُوَ`, Hafs `هُوَ ٱلْغَنِيُّ`), and nothing on the page marks the omission. Signalling it (e.g. a marker on the neighbouring word) is a decision to confirm.
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
