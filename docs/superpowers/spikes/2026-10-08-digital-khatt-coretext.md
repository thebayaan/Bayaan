# Digital Khatt CoreText shaping spike (2026-10-08)

## Verdict: PASS

Glyph selection is identical on 30/30 verses (CoreText vs HarfBuzz, the engine Skia uses). Mark positions were compared numerically on one verse (112:1) and visually on three (112:1, 12:4, 24:35), with no differences seen. Plan 1b can render Quran text in iOS widgets with SwiftUI `Text` and the custom font.

## Method

1. Text source: `data/mushaf/digitalkhatt/digital-khatt-v2.db` (the Hafs words DB used by `DigitalKhattDataService`; `dk_words.db` and `words.db` in that folder are 0-byte placeholders). Table `words(id, location, surah, ayah, word, text)`. Each verse was exported as its words joined by a space, ordered by `word`, which is the same Unicode the app feeds to the font. 30 keys: 2:255 2:282 3:7 4:12 4:176 5:3 6:151 7:54 9:30 11:44 12:4 17:1 18:109 20:39 24:35 27:30 33:56 36:82 39:23 48:29 55:13 57:4 59:22 59:23 59:24 67:1 73:20 96:1 108:1 112:1.
2. Visual check: rendered each verse with CoreText (`render.swift`, 44pt, RTL, via NSAttributedString drawing) and with `hb-view` (44pt).
3. Objective check: dumped the shaped glyph run from CoreText (`CTLineGetGlyphRuns`, font size 1000) and from `hb-shape` for all 30 verses, then compared the glyph ID sequences. Also spot-checked positions on 112:1.

## Results

- Glyph ID sequences: identical for 30 of 30 verses (29 to 1418 glyphs each, including stacked marks, small high letters, waqf signs and end-of-ayah ornaments).
- Positions (112:1): CoreText pen positions and mark offsets equal the HarfBuzz advances plus mark offsets (for example gid 43 at x=1023,y=603 equals base pen 965 plus HB offset 58,603; gid 45 at 1468,424 equals 1422 plus 46,424).
- Visual observations (images not committed):
  - 112:1: both engines show the same word shapes, fatha/damma stacks, small high letters and the ornamented ayah-number medallion in the same places.
  - 12:4: the long marks, shadda plus vowel stacks, small high alef and the end ornament match; only the canvas differs (CoreText wraps at 1400pt width and renders at 2x, HarfBuzz is one wide line).
  - 24:35 (Ayat an-Nur, dense mark-heavy): CoreText wraps to three lines; HarfBuzz is one 3743px line, which I cropped to inspect (right end viewed). Compared on the first line: the waqf signs (small jeem after الأرض, small seen-lam-ya over المصباح and الزجاجة) sit at the same height above the same letters; shadda plus vowel stacks (الزّجاجة, كأنّها), small high alef and small hamza after نوره, and the leading ornament all match. The ayah-number medallion at the verse end and the left half of the HarfBuzz line were not examined at crop resolution.
  - Remaining pairs were checked through the glyph-sequence comparison rather than by eye; I did not eyeball all 30 pairs.

## Export check against the app (1:1)

`DigitalKhattDataService.getVerseText` builds a verse as `words.map(w => w.text).join(' ')` from `SELECT id, text, location FROM words`, with words sorted by position within the verse (`parseInt(location.split(':')[2])`). My export uses the same table, same `text` column, ordered by `word`, joined with a space. For 1:1 the export yields the five words (بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ۝١) in locations 1:1:1 to 1:1:5, identical to what the service would produce. I did not run the RN app itself; this is a code and data comparison.

## Caveats for Plan 1b

- This validates shaping only. The app's mushaf pages use per-line justification and kashida from the DK layout DB; SwiftUI `Text` will not reproduce that, so widget text should be ragged or centered, not justified.
- macOS CoreText is the same engine as iOS but this was not run inside a widget extension. Plan 1b still needs to bundle the font in the widget target and register it (UIAppFonts).
- Line wrapping of long verses (2:282 is 1418 glyphs) is a layout concern, not a shaping one.
