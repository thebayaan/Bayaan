> **SHIPPED — This feature is implemented.** This was the design document for the word-by-word translation feature. See `services/wbw/WBWDataService.ts` and `mushafSettingsStore` (`showWBW`) for the implementation.

# Word-by-Word Translation — Design Document

**Date:** 2026-03-04
**Status:** Approved
**Scope:** Scroll mode only (reading view)

---

## Overview

Add inline word-by-word (WBW) translation to the scroll/reading mode. When enabled, the Arabic text area transforms from a single text block into an RTL flex-wrap grid where each Arabic word is paired with its English translation (and optionally transliteration) directly underneath.

## Data Source

- **Database:** `data/wbw/wbw-en.db` (8.14 MB, 77,429 words, all 6,236 verses)
- **Source:** Quran Foundation API v4 (`?words=true`)
- **Schema:** `(verse_key, position) -> translation, transliteration, audio_url`
- **Position mapping:** API `position` maps 1:1 to existing `DKWordInfo.wordPositionInVerse`
- **Fetch script:** `scripts/fetch-wbw-translations.js` (supports `--language` flag for other languages)

## Verse Layout (WBW ON)

```
┌──────────────────────────────────────────────────┐
│  1:1                                             │
│                                                  │
│   ٱلرَّحِيمِ      ٱلرَّحْمَـٰنِ      ٱللَّهِ        بِسْمِ   │
│   ──────     ──────     ──────     ──────   │  ← subtle line under each word
│   the Most    the Most   (of) Allah  In (the)  │
│   Merciful    Gracious                 name    │
│                                                  │
│  ─────────────────────────────────────────────── │
│  Transliteration block (if ON, unchanged)        │
│  ─────────────────────────────────────────────── │
│  Translation block (if ON, unchanged)            │
└──────────────────────────────────────────────────┘
```

### Layout Rules

- RTL flex-wrap: `flexDirection: 'row-reverse'`, `flexWrap: 'wrap'`
- Each word unit is a vertical stack: Arabic → subtle line → transliteration (optional) → translation (optional)
- No background or border on word units — spacing + alignment creates grouping
- Subtle hairline under each Arabic word for visual separation (same as app's divider token: `Color(text).alpha(0.06)`)
- Arabic uses current Mushaf font/size settings (DK V1/V2/IndoPak)
- Translation/transliteration in Manrope, smaller and subdued
- Verse end markers (position 51 in dk_words for the ayah number glyph) are excluded from WBW grid

### When WBW is OFF

Normal behavior — full Arabic text block, no changes.

## Settings UI

New **Word by Word** card in the PLAYER VIEW section, placed above Transliteration and Translation cards:

```
PLAYER VIEW

┌───────────────────────────────────────┐
│  Arabic Font Size    [-] 5 [+]       │
└───────────────────────────────────────┘

┌───────────────────────────────────────┐
│  Word by Word             [switch]   │
│  Inline word translations            │  ← helper text (always visible)
│  ─────────────────────────────────── │  ← divider (when ON)
│    Translation            [✓]       │  ← checkbox (when ON)
│    Transliteration        [✓]       │  ← checkbox (when ON)
└───────────────────────────────────────┘

┌───────────────────────────────────────┐
│  Transliteration          [switch]   │
└───────────────────────────────────────┘

┌───────────────────────────────────────┐
│  Translation              [switch]   │
└───────────────────────────────────────┘
```

Sub-toggles expand/collapse with WBW switch (same animation pattern as existing font size controls). All existing toggles remain independent and unchanged.

## Long-Press Word Modal

Long-pressing a word in the WBW grid opens a bottom sheet:

```
┌───────────────────────────────────────┐
│           ٱلرَّحْمَـٰنِ                   │  ← Large Arabic, centered
│          l-rahmani                   │  ← Transliteration
│       "the Most Gracious"            │  ← Translation
│                                       │
│          [ ▶ Play ]                  │  ← wbw audio from qurancdn.com
│                                       │
│  ─────────────────────────────────── │
│  Verse 1:1 · Word 3 of 4            │  ← Context
└───────────────────────────────────────┘
```

**v1:** Translation, transliteration, audio playback, verse/word position.
**Future:** Morphology, root/lemma, grammar (QUL resources).

## Store Changes

Add to `mushafSettingsStore`:

```typescript
// New state
showWBW: boolean;              // default: false
wbwShowTranslation: boolean;   // default: true
wbwShowTransliteration: boolean; // default: false

// New actions
toggleWBW: () => void;
toggleWBWTranslation: () => void;
toggleWBWTransliteration: () => void;
```

All persisted via AsyncStorage (same as existing settings).

## Data Flow

```
wbw-en.db (bundled asset)
    ↓ expo-sqlite importDatabaseFromAssetAsync
WBWDataService (new singleton, registered in AppInitializer)
    ↓ getVerseWords(verseKey) → { position, translation, transliteration, audioUrl }[]
    ↓ cached in memory after first load per verse
VerseItem component
    ↓ when showWBW: maps DKWordInfo[] positions to WBW translations
    ↓ renders RTL flex-wrap grid instead of single text block
Long-press handler
    ↓ opens WordDetailSheet with word data + audio playback
```

## New Files


| File                                                            | Purpose                             |
| --------------------------------------------------------------- | ----------------------------------- |
| `services/wbw/WBWDataService.ts`                                | SQLite service for WBW lookups      |
| `components/player/v2/PlayerContent/QuranView/WBWVerseView.tsx` | RTL flex-wrap word grid component   |
| `components/sheets/WordDetailSheet.tsx`                         | Long-press word detail bottom sheet |
| `data/wbw/wbw-en.db`                                            | Bundled WBW database                |


## Performance Considerations

- WBW data loaded lazily per-verse (not all 77K words at once)
- Each verse lookup is a single indexed SQLite query: `WHERE verse_key = ? ORDER BY position`
- FlashList virtualization still applies — only visible verses render WBW grids
- Word units are simple View + Text stacks, no heavy computation

