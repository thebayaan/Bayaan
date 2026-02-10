# Feature: Verse-Level Interactions

**Status:** Architecture Complete, Implementation Pending
**Priority:** High
**Complexity:** High
**Created:** 2026-02-10

## Overview

Verse-level interactions enable users to bookmark, annotate, highlight, copy, share, and read tafseer for individual Quran verses (ayahs). This builds a shared architecture that both the existing list view and a future mushaf (page) view can use seamlessly.

Currently, all Bayaan features (loved tracks, downloads, playlists) operate at the **surah level**. The `handleVersePress` stub in `PlayerContent/index.tsx` only logs to console. This feature introduces the first ayah-level interaction layer.

### Motivation

A mushaf (page) view with individual ayah selection is being built separately. By building the shared verse interaction architecture now using the existing list view, we ensure the mushaf view plugs into the same system when it lands.

## Feature Scope

### Included (v1)

| Feature | Description |
|---------|-------------|
| Bookmark | Toggle bookmark on any verse |
| Note | Add/edit/delete a text note on any verse |
| Highlight | Apply one of 6 highlight colors to a verse |
| Copy | Copy verse text with configurable options |
| Share | Share verse text via system share sheet |
| Translation | View verse translation (Saheeh International, Clear Quran) |
| Tafseer | Read tafseer from Quran.com API (Ibn Kathir default) |

### Deferred

| Feature | Reason |
|---------|--------|
| Play-from-verse | Blocked on ayah-level timestamp data |
| Repeat verse | Blocked on ayah-level timestamp data |
| Bookmark folders | v1 uses flat list; folders added later based on usage |

### Selection UX

- **Long-press** to select a verse (opens action sheet)
- **Tap** reserved for future play-from-verse

## Architecture

### Layer Overview

```
Types (verse-annotations.ts)
  ↓
SQLite Database (VerseAnnotationDatabaseService.ts)
  ↓
Service Layer (VerseAnnotationService.ts)
  ↓
Zustand Stores (verseSelectionStore.ts, verseAnnotationsStore.ts)
  ↓
Hooks (useVerseSelection, useVerseAnnotations, useVerseActions)
  ↓
UI (VerseItem, QuranView, Bottom Sheets)
```

Both the list view and future mushaf view read/write to the same stores and service layer.

---

## 1. Types — `types/verse-annotations.ts`

```typescript
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange' | 'purple';

export const HIGHLIGHT_COLORS: Record<HighlightColor, string> = {
  yellow: '#FFF3B0',
  green: '#B8F0C0',
  blue: '#B0D4FF',
  pink: '#FFB0D4',
  orange: '#FFD4B0',
  purple: '#D4B0FF',
};

export interface VerseBookmark {
  id: string;
  verseKey: string;        // "2:255"
  surahNumber: number;
  ayahNumber: number;
  createdAt: number;
}

export interface VerseNote {
  id: string;
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface VerseHighlight {
  id: string;
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  color: HighlightColor;
  createdAt: number;
}
```

---

## 2. Database — `services/database/VerseAnnotationDatabaseService.ts`

Follows the existing `DatabaseService.ts` singleton pattern (private `db`, `initPromise`, WAL mode).

**Database file:** `verse-annotations.db` (separate from main app DB)

### Schema

```sql
bookmarks (
  id TEXT PRIMARY KEY,
  verse_key TEXT NOT NULL UNIQUE,
  surah_number INTEGER NOT NULL,
  ayah_number INTEGER NOT NULL,
  created_at INTEGER NOT NULL
)
-- Index: idx_bookmarks_surah ON bookmarks(surah_number)

notes (
  id TEXT PRIMARY KEY,
  verse_key TEXT NOT NULL UNIQUE,
  surah_number INTEGER NOT NULL,
  ayah_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)
-- Index: idx_notes_surah ON notes(surah_number)

highlights (
  id TEXT PRIMARY KEY,
  verse_key TEXT NOT NULL UNIQUE,
  surah_number INTEGER NOT NULL,
  ayah_number INTEGER NOT NULL,
  color TEXT NOT NULL,
  created_at INTEGER NOT NULL
)
-- Index: idx_highlights_surah ON highlights(surah_number)
```

### Key Decisions

- **UNIQUE on `verse_key`** for all tables — one bookmark/note/highlight per verse
- **`surah_number` indexed** for efficient per-surah batch queries
- **Separate DB file** follows existing pattern of isolated databases per domain

---

## 3. Service Layer — `services/verse-annotations/VerseAnnotationService.ts`

Thin service wrapping the database. Exported as singleton `verseAnnotationService`.

### Methods

| Category | Method | Return |
|----------|--------|--------|
| Init | `initialize()` | `Promise<void>` |
| Bookmarks | `toggleBookmark(verseKey, surahNum, ayahNum)` | `Promise<boolean>` (true = added) |
| Bookmarks | `getBookmark(verseKey)` | `Promise<VerseBookmark \| null>` |
| Bookmarks | `getAllBookmarks()` | `Promise<VerseBookmark[]>` |
| Bookmarks | `getBookmarksBySurah(surahNum)` | `Promise<VerseBookmark[]>` |
| Notes | `upsertNote(verseKey, surahNum, ayahNum, content)` | `Promise<VerseNote>` |
| Notes | `getNote(verseKey)` | `Promise<VerseNote \| null>` |
| Notes | `deleteNote(verseKey)` | `Promise<void>` |
| Notes | `getNotesBySurah(surahNum)` | `Promise<VerseNote[]>` |
| Highlights | `setHighlight(verseKey, surahNum, ayahNum, color)` | `Promise<VerseHighlight>` |
| Highlights | `removeHighlight(verseKey)` | `Promise<void>` |
| Highlights | `getHighlightsBySurah(surahNum)` | `Promise<VerseHighlight[]>` |
| Batch | `getAnnotationsForSurah(surahNum)` | `Promise<{ bookmarks[], notes[], highlights[] }>` |

### AppInitializer Registration

Registered at priority 7, non-critical:

```typescript
appInitializer.registerService({
  name: 'Verse Annotations',
  priority: 7,
  critical: false,
  initialize: async () => {
    await verseAnnotationService.initialize();
  },
});
```

---

## 4. State Management

### 4a. `store/verseSelectionStore.ts` — Ephemeral UI State

Not persisted. Both list view and future mushaf view share this store.

```typescript
interface VerseSelectionState {
  selectedVerseKey: string | null;
  selectedSurahNumber: number | null;
  selectedAyahNumber: number | null;
  selectVerse(verseKey: string, surahNumber: number, ayahNumber: number): void;
  clearSelection(): void;
}
```

### 4b. `store/verseAnnotationsStore.ts` — Cached Annotations from SQLite

```typescript
interface VerseAnnotationsState {
  loadedSurah: number | null;
  bookmarkedVerseKeys: Set<string>;          // O(1) lookup
  notedVerseKeys: Set<string>;               // O(1) lookup
  highlights: Record<string, HighlightColor>; // verseKey -> color
  loading: boolean;

  // Load all annotations for a surah (called on surah change)
  loadAnnotationsForSurah(surahNumber: number): Promise<void>;

  // Mutations (optimistic update + async SQLite write)
  toggleBookmark(verseKey: string, surahNumber: number, ayahNumber: number): Promise<boolean>;
  upsertNote(verseKey: string, surahNumber: number, ayahNumber: number, content: string): Promise<void>;
  deleteNote(verseKey: string): Promise<void>;
  setHighlight(verseKey: string, surahNumber: number, ayahNumber: number, color: HighlightColor): Promise<void>;
  removeHighlight(verseKey: string): Promise<void>;

  // Query helpers (used in renderItem)
  isBookmarked(verseKey: string): boolean;
  hasNote(verseKey: string): boolean;
  getHighlightColor(verseKey: string): HighlightColor | null;
}
```

### Sync Strategy

- **On surah change:** Single batch query `getAnnotationsForSurah()` populates Sets/Records
- **On mutation:** Optimistic update to Zustand (instant UI) + async SQLite write
- **No startup pre-loading:** Loads on-demand when the player opens a surah

---

## 5. Hooks

### `hooks/useVerseSelection.ts`

Thin wrapper over `verseSelectionStore`. Returns `selectedVerseKey`, `selectVerse`, `clearSelection`, `isSelected(verseKey)`.

### `hooks/useVerseActions.ts`

Zero-re-render action-only hook (follows `usePlayerActions` pattern). Returns memoized functions: `toggleBookmark`, `upsertNote`, `deleteNote`, `setHighlight`, `removeHighlight`, `showActionsSheet`.

### `hooks/useVerseAnnotations.ts`

Used by QuranView. Takes `surahNumber`, calls `loadAnnotationsForSurah` on change, returns `isBookmarked`, `hasNote`, `getHighlightColor` functions.

---

## 6. UI Components

### 6a. VerseItem Changes

**File:** `components/player/v2/PlayerContent/QuranView/VerseItem.tsx`

New props added to `VerseItemProps`:

```typescript
isSelected: boolean;
highlightColor: string | null;  // hex from HIGHLIGHT_COLORS
hasBookmark: boolean;
hasNote: boolean;
onLongPress: () => void;
```

Visual changes:
- `isSelected` — subtle background tint + left border accent
- `highlightColor` — applied as background on the Arabic text container
- `hasBookmark` / `hasNote` — small indicator icons next to the verse pill
- `onLongPress` wired to the `Pressable` component

Existing `onPress` remains as a stub, reserved for future play-from-verse.

### 6b. QuranView Changes

**File:** `components/player/v2/PlayerContent/QuranView/index.tsx`

- Subscribe to `useVerseSelection` and `useVerseAnnotations(currentSurah)`
- Call `loadAnnotationsForSurah` when `currentSurah` changes
- Pass annotation props to each VerseItem in `renderItem`
- `onLongPress` calls `selectVerse()` + `SheetManager.show('verse-actions', { payload })`

### 6c. PlayerContent Changes

**File:** `components/player/v2/PlayerContent/index.tsx`

- Wire `clearSelection` to fire when surah changes or player closes

### 6d. Bottom Sheets

All lazy-loaded via `react-native-actions-sheet`:

| Sheet | File | Purpose |
|-------|------|---------|
| `verse-actions` | `VerseActionsSheet.tsx` | Main action grid |
| `verse-highlight` | `VerseHighlightSheet.tsx` | Color picker (6 circles) |
| `verse-note` | `VerseNoteSheet.tsx` | TextInput with Save/Delete |
| `verse-copy` | `VerseCopySheet.tsx` | Checkbox copy options |
| `verse-tafseer` | `VerseTafseerSheet.tsx` | Scrollable tafseer content |
| `verse-translation` | `VerseTranslationSheet.tsx` | Translation picker |

**VerseActionsSheet layout** (follows `SurahOptionsSheet` options grid pattern):

```
Header: "Al-Baqarah 2:255"
─────────────────────────────────
[Bookmark]  Bookmark     [Highlight]  Highlight
[Note]      Add Note     [Copy]       Copy
[Share]     Share         [Book]       Translation
[Tafseer]   Tafseer
```

- Actions that complete instantly (bookmark toggle, share) close the sheet
- Actions needing sub-sheets (highlight, note, copy, translation, tafseer) open the sub-sheet

**Share** uses React Native's `Share.share()`:

```
{arabic text}

{translation}

— Quran {surah}:{ayah}
```

All sheets registered in `components/sheets/sheets.tsx` using `lazySheet` + type declarations.

---

## 7. Tafseer Integration — Quran.com API

**Endpoint:** `GET https://api.quran.com/api/v4/tafsirs/{tafsir_id}/by_ayah/{verse_key}`

Example: `GET /api/v4/tafsirs/en-tafisr-ibn-kathir/by_ayah/2:255`

### Implementation (VerseTafseerSheet.tsx)

- Fetches tafseer on sheet open (loading spinner)
- Caches responses in memory (`Map<string, TafseerResponse>`) to avoid re-fetching during session
- Renders HTML content using `react-native-render-html` (already in the project)
- No SQLite caching (read-only reference data)
- v1 defaults to Ibn Kathir; tafsir source picker is a future enhancement

---

## 8. File Structure

### New Files

```
types/
  verse-annotations.ts

services/
  database/
    VerseAnnotationDatabaseService.ts
  verse-annotations/
    VerseAnnotationService.ts

store/
  verseSelectionStore.ts
  verseAnnotationsStore.ts

hooks/
  useVerseSelection.ts
  useVerseActions.ts
  useVerseAnnotations.ts

components/
  sheets/
    VerseActionsSheet.tsx
    VerseHighlightSheet.tsx
    VerseNoteSheet.tsx
    VerseCopySheet.tsx
    VerseTafseerSheet.tsx
    VerseTranslationSheet.tsx
```

### Modified Files

```
components/player/v2/PlayerContent/QuranView/VerseItem.tsx  — new props, visual states, onLongPress
components/player/v2/PlayerContent/QuranView/index.tsx      — wire selection + annotations
components/player/v2/PlayerContent/index.tsx                — clear selection on surah change
components/sheets/sheets.tsx                                — register 6 new sheets + types
services/AppInitializer.ts                                  — register verse annotations service
```

---

## 9. Implementation Order

### Step 1: Foundation

1. Create `types/verse-annotations.ts`
2. Create `VerseAnnotationDatabaseService` (SQLite)
3. Create `VerseAnnotationService` (singleton)
4. Register in `AppInitializer`
5. Create `verseSelectionStore`
6. Create `verseAnnotationsStore`

### Step 2: Selection UX

1. Create `useVerseSelection` hook
2. Create `useVerseAnnotations` hook
3. Create `useVerseActions` hook
4. Update `VerseItem` with selection/annotation props
5. Update `QuranView` to wire stores
6. Update `PlayerContent` to clear selection on surah change

### Step 3: Actions Sheet

1. Create `VerseActionsSheet` (main grid)
2. Register all sheets in `sheets.tsx`

### Step 4: Features

1. Copy (`VerseCopySheet`)
2. Bookmark toggle
3. Highlight (`VerseHighlightSheet`)
4. Notes (`VerseNoteSheet`)
5. Share (inline `Share.share()`)
6. Translation picker (`VerseTranslationSheet`)
7. Tafseer (`VerseTafseerSheet` + Quran.com API)

### Step 5: Polish

1. Bookmark/note indicators in `VerseItem`
2. Prettier + TypeScript checks

---

## 10. Performance Considerations

- **VerseItem** is already `React.memo()`. New props are primitives — only 2 items re-render per selection change (old + new)
- **Annotation lookups** use `Set.has()` and `Record` access — O(1) in the render path
- **Per-surah loading** keeps memory bounded regardless of total annotations
- **Optimistic updates** give instant visual feedback; SQLite writes are async
- **LegendList recycling** works correctly since annotation props are per-item in `renderItem`
- **Lazy-loaded sheets** add zero cost to startup

---

*Created: 2026-02-10*
