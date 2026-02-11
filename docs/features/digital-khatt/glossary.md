# Digital Khatt Glossary

Short definitions used across Digital Khatt documentation and code.

## Terms

- `DigitalKhatt`: the Uthmani font/rendering path used by Bayaan's Skia Mushaf.
- `DKLine`: one layout row from `dk_layout.db` (`surah_name`, `basmallah`, or `ayah`).
- `lineType`:
  - `0` = ayah
  - `1` = surah_name
  - `2` = basmallah
- `lineWidthRatio`: multiplicative width factor for special lines/pages.
- `lineTextInfo`: tokenized line data from `QuranTextService` (words + spaces + indexes).
- `SpaceType.Simple`: regular word separator spacing.
- `SpaceType.Aya`: spacing around ayah marker context.
- `base letter`: Arabic base character used in joining/terminal checks.
- `isLastBase`: check whether a base character is terminal in its word.
- `JustResultByLine`: line-level shaping output consumed by `SkiaLine`.
- `fontFeatures`: map of line char index -> OpenType feature array.
- `cv01`..`cv18`: custom stylistic/justification OpenType features in the font.
- `basm`: OpenType feature used for basmallah styling on specific lines.
- `kashida` (in this codebase): practical term for glyph expansion behavior achieved via feature alternates, not literal tatweel insertion.
- `matchingCondition`: lookup-level validator deciding whether a regex match is eligible.
- `condition`: final gate that can block a matched lookup before applying actions.
- `shapeWord`: re-shapes one word with candidate features to validate width changes.
- `desiredWidth`: target synthetic width for one line in justification engine.
- `fontSizeRatio`: fallback shrink ratio when line overflows target width.
- `dk_layout_*`: AsyncStorage namespace for persisted justification layouts.

## Component Names

- `MushafViewer`: top-level reader container choosing Uthmani vs Indopak.
- `UthmaniPageView`: Uthmani page component that combines `SkiaPage` + header overlays.
- `SkiaPage`: page orchestrator handling geometry and per-line layout retrieval.
- `SkiaLine`: line renderer that builds and draws Skia paragraph objects.

## Data Stores

- `dk_words.db`: runtime SQLite DB for word text rows.
- `dk_layout.db`: runtime SQLite DB for page/line layout rows.
- `wordsById`: in-memory map from word id to text.
- `pageLines`: in-memory map from page number to list of `DKLine`.
- `surahStartPages`: map of surah number to first page.
- `pageToSurah`: map of page number to owning surah.

