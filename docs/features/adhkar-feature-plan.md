# Adhkar Feature Plan

**Status:** Implementation Complete
**Depends on:** Audio Player Migration (v1.0) completion
**Target Milestone:** v1.1
**Branch:** `feature/adhkar-feature`
**GitHub Issue:** #67

---

## Overview

Add a comprehensive Adhkar/Dhikr feature to Bayaan, providing users with the complete Hisnul Muslim (Fortress of the Muslim) collection with Arabic text, translation, transliteration, and audio.

**Reference:** https://lifewithallah.com/dhikr-dua/

---

## Content Scope

- **132 categories** from Hisnul Muslim
- **267 adhkar (dhikr items)** with full text content
- **268 audio files** (36MB bundled at 48kbps mono)
- **Broad tags** for grouping: daily, prayer, protection, health, travel, food, social, nature, spiritual, home, clothing, general

### Data Source

Curated dataset at: `/Users/osmansaeday/Bayaan/dua-audio-samples/`
- `final-hisnul-muslim.json` - Complete structured data
- `hisnmuslim-48k/` - Compressed audio files (48kbps, mono, 36MB total)

---

## User Flow

```
Home Screen (AdhkarView tab)
    │
    ├── TabSelector: Reciters | Surahs | Adhkar
    │
    └── Bento Grid Layout (super categories)
            │
            ├── Main Section (Morning/Evening, Salah, etc.)
            ├── Other Section (Home, Travel, etc.)
            │
            └── Super Category → Subcategory Screen (if multiple)
                    │
                    └── Category Detail Screen
                            │
                            └── List of adhkar in category
                                    │
                                    └── Dhikr Page (book-like, swipeable)
                                            │
                                            ├── Arabic text (beautiful typography)
                                            ├── Translation
                                            ├── Transliteration
                                            ├── Instruction (e.g., "Recite 3 times")
                                            ├── Audio player (lightweight)
                                            └── Tasbeeh counter
```

---

## Technical Architecture

### Database (SQLite)

```sql
-- Categories table (132 categories from Hisnul Muslim)
CREATE TABLE adhkar_categories (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    dhikr_count INTEGER DEFAULT 0
);

-- Broad tags for filtering
CREATE TABLE adhkar_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
);

-- Many-to-many: categories can have multiple tags
CREATE TABLE category_tags (
    category_id TEXT REFERENCES adhkar_categories(id),
    tag_id INTEGER REFERENCES adhkar_tags(id),
    PRIMARY KEY (category_id, tag_id)
);

-- Adhkar table (267 dhikr items)
CREATE TABLE adhkar (
    id TEXT PRIMARY KEY,
    category_id TEXT REFERENCES adhkar_categories(id),
    arabic TEXT NOT NULL,
    translation TEXT,
    transliteration TEXT,
    instruction TEXT,
    repeat_count INTEGER DEFAULT 1,
    audio_file TEXT,
    sort_order INTEGER DEFAULT 0
);

-- Super categories (Life With Allah-style groupings)
CREATE TABLE super_categories (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    arabic_title TEXT,
    color TEXT NOT NULL,
    height_multiplier REAL DEFAULT 1,
    column TEXT DEFAULT 'left',
    sort_order INTEGER DEFAULT 0,
    section TEXT DEFAULT 'main',
    category_ids TEXT NOT NULL
);

-- User favorites
CREATE TABLE dhikr_favorites (
    dhikr_id TEXT PRIMARY KEY REFERENCES adhkar(id),
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Tasbeeh counter per dhikr
CREATE TABLE dhikr_counts (
    dhikr_id TEXT PRIMARY KEY REFERENCES adhkar(id),
    count INTEGER DEFAULT 0,
    last_updated INTEGER
);
```

### Audio Player

- **Lightweight instance** using expo-audio (separate from Quran player)
- No queue management (adhkar are short, play one at a time)
- No background playback / lock screen controls needed
- Simple: play, pause, seek, position tracking
- Audio bundled at `assets/audio/duas/dua_{id}.mp3`

### Services

- `AdhkarDatabaseService.ts` - SQLite operations
- `AdhkarService.ts` - Business logic layer
- Register in `AppInitializer.ts`

### State Management (Zustand)

```typescript
interface AdhkarState {
  // Categories grouped by tag
  groupedCategories: Record<AdhkarBroadTag, AdhkarCategory[]>;

  // Super categories (bento layout)
  mainSuperCategories: SuperCategory[];
  otherSuperCategories: SuperCategory[];

  // Current category view
  selectedCategory: AdhkarCategory | null;
  adhkarInCategory: Dhikr[];

  // Current dhikr view
  currentDhikr: Dhikr | null;
  currentDhikrIndex: number;

  // Favorites
  favorites: Set<string>;

  // Tasbeeh counts
  dhikrCounts: Record<string, number>;
}
```

---

## Features

### v1.1 (Initial Release) ✓

- [x] All 267 adhkar with Arabic, translation, transliteration
- [x] Audio playback for all adhkar (bundled)
- [x] 132 categories with super category groupings
- [x] Bento grid layout (Life With Allah-style)
- [x] Tasbeeh counter with haptic feedback
- [x] Favorites functionality
- [x] Swipeable dhikr navigation within category
- [x] Layout settings sheet (font sizes, show/hide translation)
- [x] Copy options sheet

### Deferred (v1.2+)

- [ ] Search across adhkar
- [ ] Reminders / notifications
- [ ] Multi-language translations
- [ ] Custom playlists / routines
- [ ] Widget for daily dhikr

---

## File Structure

```
app/
  (tabs)/
    (a.home)/
      adhkar/
        _layout.tsx
        [categoryId].tsx        # Category detail (dhikr list)
        category/
          [superId].tsx         # Super category → subcategories
        dhikr/
          _layout.tsx
          [dhikrId].tsx         # Dhikr page (book-like)

components/
  AdhkarView.tsx
  adhkar/
    CategoryCard.tsx
    DhikrListItem.tsx
    DhikrReader.tsx
    AdhkarAudioControls.tsx
    TasbeehCounter.tsx
    AdhkarBentoCard.tsx
  sheets/
    AdhkarLayoutSheet.tsx
    AdhkarCopyOptionsSheet.tsx

services/
  database/
    AdhkarDatabaseService.ts
  adhkar/
    AdhkarService.ts

store/
  adhkarStore.ts
  adhkarSettingsStore.ts

hooks/
  useAdhkar.ts
  useAdhkarAudio.ts

utils/
  adhkarAudio.ts

constants/
  adhkarColors.ts

types/
  adhkar.ts

assets/
  audio/
    duas/
      dua_1.mp3
      dua_2.mp3
      ...
      dua_267.mp3

data/
  adhkar.json              # Seed data for SQLite
```

---

## Dependencies

- expo-audio (for lightweight player)
- expo-sqlite (existing)
- expo-haptics (for tasbeeh counter)
- react-native-pager-view (for swipeable dhikr navigation)

---

## Terminology

| Term | Meaning |
|------|---------|
| Adhkar (أذكار) | Plural of dhikr - remembrances of Allah |
| Dhikr (ذكر) | A single remembrance/supplication |
| Tasbeeh (تسبيح) | Counter for reciting dhikr |

---

*Created: 2026-01-29*
*Updated: 2026-02-02 (Terminology refactor: dua → adhkar/dhikr)*
