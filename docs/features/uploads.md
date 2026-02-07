# Uploads Feature - Planning Document

> Allow users to upload personal recitations to Bayaan.

**Status:** Ready for implementation

---

## Overview

Allow users to upload audio recitations from their device for playback within the app. Supports:

1. Recitations of reciters not in the app
2. Alternative/missing recitations of existing reciters
3. Personal recitations (self-recorded)

---

## Core Principles

- **Easy In, Gentle Organize**: Upload should be friction-free. Organization is available but not required.
- **UX First**: Don't clutter the existing experience. User uploads integrate cleanly.
- **Local First**: All storage is local (app sandbox). Cloud sync (iCloud/Google Drive) is a future enhancement.
- **Phased Rollout**: Start simple, add complexity over time.

---

## Upload Entry Points

### 1. From Outside the App (Share Sheet)

User shares audio from Voice Memos, Files, WhatsApp, etc. → Bayaan appears as share target → App opens with upload flow.

**Technical requirements:**
- iOS: Share Extension or `CFBundleDocumentTypes` in Info.plist
- Android: Intent filter for audio MIME types
- Expo: `expo-share-intent` or custom native module

### 2. From Inside the App (Button)

Opens `expo-document-picker` filtered to audio files.

**Button locations:**
- Uploads screen header `[+]` - primary location
- Empty states (first-time onboarding)
- Reciter detail → Uploads section (contextual, pre-fills reciter)

**Accepted file types:**
```
audio/mpeg      (.mp3)
audio/mp4       (.m4a)
audio/x-m4a     (.m4a)
audio/wav       (.wav)
audio/aac       (.aac)
```

---

## Upload Flow

### Single File Upload

```
┌─────────────────────────────────────┐
│  ━━━                                │
│                                     │
│  ✓ Added to Uploads                 │
│                                     │
│  voice_memo_jan12.m4a               │
│  4:32                               │
│                                     │
│  [Organize]           [Done]        │
│                                     │
└─────────────────────────────────────┘
```

- "Done" adds to Uploads untagged
- "Organize" opens tagging sheet

### Bulk Upload

```
┌─────────────────────────────────────┐
│  ━━━                                │
│                                     │
│  ✓ Added 5 files to Uploads         │
│                                     │
│  [Done]                             │
│                                     │
└─────────────────────────────────────┘
```

- No tagging sheet for bulk (too much friction)
- User organizes later from Uploads screen

---

## UI Components

### 1. Collections Screen - Entry Points

**Filter pill** in FilterBar:
```
[Playlists] [Reciters] [Downloads] [Loved] [Uploads]
```
When active → Shows flat list of all uploads, sorted by date (newest first).

**Card in grid** (alongside LovedCard, DownloadCard):
```
┌─────────────────────────────────────┐
│                                     │
│           (microphone icon)         │
│                                     │
│          Uploads                    │
│       12 recitations                │
│                                     │
└─────────────────────────────────────┘
```
Tap → navigates to full Uploads screen.

**Styling note:** Follow the existing card color patterns (LovedCard uses #FF6B6B, DownloadCard uses #10AC84). Do not use the app accent/primary color for the uploads card.

---

### 2. Uploads Screen

```
┌─────────────────────────────────────┐
│  ←  Uploads                  [+]    │  ← Sticky blur header
├─────────────────────────────────────┤
│ [Untagged (8)] [Reciters] [Other]   │  ← FilterBar pills
├─────────────────────────────────────┤
│                                     │
│  Content based on selected pill     │
│  (LegendList)                       │
│                                     │
└─────────────────────────────────────┘
```

**Untagged selected:**
Flat list of untagged files, sorted by date added.

**Reciters selected:**
Grid of CircularReciterCards (system reciters with uploads + custom reciters).

**Other selected:**
Flat list of du'a, lectures, tafsir, etc.

> **V2:** "Me" pill for personal recordings (deferred — `is_personal` field kept in schema for future use).

---

### 3. Upload Item Card

Matches TrackCard pattern with spring animation:

```
┌───┬─────────────────────────────────┐
│ ▶ │ voice_memo.m4a            4:32  │
│   │ Untagged                        │
└───┴─────────────────────────────────┘

┌───┬─────────────────────────────────┐
│ ▶ │ Al-Baqarah (255-257)      4:32  │  ← verse badge if partial
│   │ Sheikh Muhammad                 │
└───┴─────────────────────────────────┘
```

**Interactions:**
- Tap → Play (queues all in context)
- Long press → Context menu

**Context menu:**
```
┌─────────────────────────────────────┐
│  Play Now                           │
│  Add to Queue                       │
│  ───────────────────                │
│  Organize                           │
│  Delete                             │
└─────────────────────────────────────┘
```

---

### 4. Reciter Detail - Uploads Section

Appears at bottom of surah list (Spotify-style):

```
┌─────────────────────────────────────┐
│  ←  Sheikh Abdul Basit        ♡     │
├─────────────────────────────────────┤
│  [header, rewayat, play button]     │
├─────────────────────────────────────┤
│  Al-Fatiha                     ▶    │
│  Al-Baqarah                    ▶    │
│  ...                                │
│  An-Nas                        ▶    │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  Uploads                       (5)  │
│  ┌─────────────────────────────────┐│
│  │ Al-Fatiha (alt)            1:02 ││
│  │ Surah Yasin               12:30 ││
│  │ Al-Mulk                    8:45 ││
│  └─────────────────────────────────┘│
│  See all (12)                       │  ← if more than 5
│                                     │
│  [+ Add Recitation]                 │  ← pre-fills reciter
│                                     │
└─────────────────────────────────────┘
```

- Max 5 shown, then "See all" link
- Empty = section hidden
- "Add Recitation" pre-fills reciter in organize sheet

---

### 5. Organize Sheet (Bottom Sheet)

Using `react-native-actions-sheet`:

```
┌─────────────────────────────────────┐
│  ━━━                                │
│  Organize                   [Save]  │
├─────────────────────────────────────┤
│  voice_memo.m4a  ·  4:32            │
│                                     │
│  Type                               │
│  [Surah]  [Other]                   │  ← chip selection
│                                     │
│  ┌─ If Surah ─────────────────────┐ │
│  │                                │ │
│  │  Surah                         │ │
│  │  ┌─────────────────────────┐   │ │
│  │  │ Search surahs...     🔍 │   │ │
│  │  └─────────────────────────┘   │ │
│  │                                │ │
│  │  Verses (optional)             │ │
│  │  ┌────────┐  ┌────────┐        │ │
│  │  │From: __│  │To:   __│        │ │
│  │  └────────┘  └────────┘        │ │
│  │                                │ │
│  └────────────────────────────────┘ │
│                                     │
│  ┌─ If Other ─────────────────────┐ │
│  │                                │ │
│  │  Title                         │ │
│  │  ┌─────────────────────────┐   │ │
│  │  │ Morning Adhkar          │   │ │
│  │  └─────────────────────────┘   │ │
│  │                                │ │
│  │  Category                      │ │
│  │  [Du'a] [Lecture] [Tafsir] [Other] │
│  │                                │ │
│  └────────────────────────────────┘ │
│                                     │
│  Reciter                            │
│  ┌─────────────────────────────────┐│
│  │ Search or create...          🔍 ││
│  └─────────────────────────────────┘│
│                                     │
│  Rewayah (optional)                 │
│  ┌─────────────────────────────────┐│
│  │ Hafs A'n Asim                ▼  ││
│  └─────────────────────────────────┘│
│                                     │
│  ─────────────────────────────────  │
│  [Delete]                           │
└─────────────────────────────────────┘
```

**Notes:**
- If verses filled in → item shows "partial" badge on card
- Registered as `registerSheet('organize-recitation', OrganizeRecitationSheet)`

---

### 6. Reciter Search (within Organize Sheet)

```
┌─────────────────────────────────────┐
│  ←  Select Reciter                  │
├─────────────────────────────────────┤
│  ┌─────────────────────────────────┐│
│  │ 🔍 Search...                    ││
│  └─────────────────────────────────┘│
│                                     │
│  Recent                             │
│  Sheikh Abdul Basit                 │
│  Mishary Rashid                     │
│                                     │
│  All Reciters                       │
│  ...                                │
└─────────────────────────────────────┘
```

**No results:**
```
┌─────────────────────────────────────┐
│  No results for "Sheikh Muhammad"   │
│                                     │
│  ┌─────────────────────────────────┐│
│  │ + Create "Sheikh Muhammad"      ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

---

### 7. Player Screen - Untagged Files

When playing an untagged upload (no surah):

```
┌─────────────────────────────────────┐
│                                     │
│           (microphone icon)         │
│                                     │
│  morning_recitation.m4a             │
│  Uploads                            │
│                                     │
│   ═══════════════════════════════   │
│                                     │
│   (progress bar)                    │
│                                     │
│  [◀◀]      [▶]      [▶▶]           │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  Tag this recitation to see         │
│  surah text and details             │
│                                     │
│  [Organize]                         │
│                                     │
└─────────────────────────────────────┘
```

---

## Where Tagged Items Appear

| Tagged with | Shows up in |
|-------------|-------------|
| Surah + existing reciter | Reciter detail → Uploads section |
| Surah + new custom reciter | Uploads → Reciters → custom reciter detail |
| Partial (verses filled) | Same as above, with verse badge on card |
| Other (du'a, etc.) | Uploads → Other |
| Untagged | Uploads → Untagged |

---

## Data Model

### SQLite Tables

```sql
CREATE TABLE user_recitations (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,           -- relative filename only (e.g., '{uuid}.mp3')
  original_filename TEXT NOT NULL,
  duration INTEGER, -- seconds
  date_added INTEGER NOT NULL,

  -- Tagging (all nullable for untagged state)
  type TEXT, -- 'surah' | 'other' | null
  surah_number INTEGER,
  start_verse INTEGER, -- null = full surah
  end_verse INTEGER,   -- null = full surah
  title TEXT, -- for 'other' type
  category TEXT, -- 'dua' | 'lecture' | 'tafsir' | 'other'
  reciter_id TEXT, -- FK to system reciters
  custom_reciter_id TEXT, -- FK to custom_reciters
  is_personal INTEGER DEFAULT 0,
  rewayah TEXT
);

CREATE TABLE custom_reciters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_uri TEXT,
  created_at INTEGER NOT NULL
);

-- Indexes
CREATE INDEX idx_recitations_surah ON user_recitations(surah_number);
CREATE INDEX idx_recitations_reciter ON user_recitations(reciter_id);
CREATE INDEX idx_recitations_custom_reciter ON user_recitations(custom_reciter_id);
CREATE INDEX idx_recitations_type ON user_recitations(type);
CREATE INDEX idx_recitations_untagged ON user_recitations(type) WHERE type IS NULL;
```

**Important:** `file_path` stores the **relative filename only** (e.g., `a1b2c3d4.mp3`), not the full URI. Absolute paths are resolved at runtime using `FileSystem.documentDirectory + 'user-recitations/' + filePath`. This matches the downloads pattern and is required for iOS, where the app container path changes between updates.

### TypeScript Interfaces

```typescript
interface UserRecitation {
  id: string;
  filePath: string;             // relative filename only
  originalFilename: string;
  duration: number | null;
  dateAdded: number;

  // Tagging (all nullable)
  type: 'surah' | 'other' | null;
  surahNumber: number | null;
  startVerse: number | null;    // null = full surah, filled = partial
  endVerse: number | null;
  title: string | null;
  category: 'dua' | 'lecture' | 'tafsir' | 'other' | null;
  reciterId: string | null;     // FK to system reciters
  customReciterId: string | null; // FK to custom_reciters
  isPersonal: boolean;          // reserved for v2
  rewayah: string | null;
}

interface CustomReciter {
  id: string;
  name: string;
  imageUri: string | null;
  createdAt: number;
}
```

### Row Type Mapping

Following the codebase convention (snake_case DB rows → camelCase TypeScript):

```typescript
interface UserRecitationRow {
  id: string;
  file_path: string;
  original_filename: string;
  duration: number | null;
  date_added: number;
  type: string | null;
  surah_number: number | null;
  start_verse: number | null;
  end_verse: number | null;
  title: string | null;
  category: string | null;
  reciter_id: string | null;
  custom_reciter_id: string | null;
  is_personal: number;
  rewayah: string | null;
}
```

---

## File Storage

Using `expo-file-system`:

```
documentDirectory/
└── user-recitations/
    ├── {uuid}.mp3
    ├── {uuid}.m4a
    └── {uuid}.wav
```

- Files renamed to UUID on import (no collision issues)
- Original filename stored in metadata
- Files copied, not referenced (we own them)
- Only the filename is persisted in SQLite; full path resolved at runtime

**Path resolution utility:**
```typescript
function resolveRecitationPath(filePath: string): string {
  return `${FileSystem.documentDirectory}user-recitations/${filePath}`;
}
```

---

## Architecture

### Three-Layer Pattern

Following the existing codebase architecture (DatabaseService → Service → Store):

```
┌─────────────────────────────────────────────────────┐
│  UI Layer (Screens, Components, Hooks)              │
│  useUserRecitations() hook                          │
├─────────────────────────────────────────────────────┤
│  Zustand Store (useUserRecitationsStore)            │
│  Reactive UI state, cached query results            │
│  Tracks: current filter, upload progress            │
├─────────────────────────────────────────────────────┤
│  Service Layer (UserRecitationsService)             │
│  Business logic, file operations, validation        │
├─────────────────────────────────────────────────────┤
│  Database Layer (UserRecitationsDatabaseService)    │
│  SQLite operations, row↔domain mapping              │
└─────────────────────────────────────────────────────┘
```

**SQLite is the source of truth.** Zustand caches query results for reactivity and holds ephemeral state (upload progress, current filter). Mutations go through the service → DB, then the store re-fetches.

### Service Registration

```typescript
// In AppInitializer.ts
appInitializer.registerService({
  name: 'User Recitations',
  priority: 6,                    // after adhkar (priority 4-5)
  critical: false,                // app works without uploads
  initialize: async () => {
    await userRecitationsDatabaseService.initialize();
    await useUserRecitationsStore.getState().loadRecitations();
  },
});
```

### Storage Service

```typescript
// services/uploads/UserRecitationsService.ts

// Core operations
importFile(sourceUri: string): Promise<UserRecitation>
importFiles(sourceUris: string[]): Promise<UserRecitation[]>
updateTags(id: string, tags: Partial<UserRecitation>): Promise<void>
deleteRecitation(id: string): Promise<void>  // deletes file + record

// Queries
getAll(): Promise<UserRecitation[]>
getUntagged(): Promise<UserRecitation[]>
getBySurah(surahNumber: number): Promise<UserRecitation[]>
getByReciter(reciterId: string): Promise<UserRecitation[]>
getByCustomReciter(customReciterId: string): Promise<UserRecitation[]>
getOther(): Promise<UserRecitation[]>
getByReciterGrouped(): Promise<Map<string, UserRecitation[]>>
getTotalCount(): Promise<number>
getTotalStorageSize(): Promise<number>

// Custom reciters
createCustomReciter(name: string): Promise<CustomReciter>
getCustomReciters(): Promise<CustomReciter[]>
deleteCustomReciter(id: string): Promise<void>
```

---

## Storage Considerations

| Concern | Approach |
|---------|----------|
| File size | Warn at 100MB+, no hard limit |
| Duplicate detection | Skip for v1 (future enhancement) |
| Orphan cleanup | Weekly background check, non-blocking |
| Storage usage | Show total size in settings |

### Orphan File Cleanup

```typescript
const ORPHAN_CHECK_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days

async function maybeRunOrphanCheck() {
  const lastCheck = await getLastOrphanCheck();
  const now = Date.now();

  if (now - lastCheck > ORPHAN_CHECK_INTERVAL) {
    setTimeout(() => cleanupOrphanFiles(), 3000);
    await setLastOrphanCheck(now);
  }
}
```

---

## Player Integration

### Track Type Extension

The current `Track` interface extends `RNTrackPlayerTrack` with `reciterId`, `reciterName`, `surahId?`, `rewayatId?`. For user uploads, extend with:

```typescript
export interface Track extends RNTrackPlayerTrack {
  reciterId: string;
  reciterName: string;
  surahId?: string;
  rewayatId?: string;

  // User uploads
  isUserUpload?: boolean;
  userRecitationId?: string;
}
```

### Track Object for User Recitations

```typescript
function createUserUploadTrack(recitation: UserRecitation): Track {
  return {
    id: `user-${recitation.id}`,
    url: resolveRecitationPath(recitation.filePath),
    title: getRecitationTitle(recitation),
    artist: getRecitationArtist(recitation),
    artwork: getRecitationArtwork(recitation),
    reciterId: recitation.reciterId || recitation.customReciterId || 'user-upload',
    reciterName: getRecitationArtist(recitation),
    surahId: recitation.surahNumber?.toString(),
    isUserUpload: true,
    userRecitationId: recitation.id,
  };
}
```

### Fallback Hierarchy for Display

| Field | Fallback |
|-------|----------|
| Title | `surahName` → `title` (for "other") → `originalFilename` |
| Artist | `reciterName` → `customReciterName` → `"Uploads"` |
| Subtitle | `rewayah` → hide if empty |

### Playback Behavior

- Tapping a file queues all files in that context (consistent with system behavior)
- User uploads can be mixed with system tracks in queue
- Player handles both `https://` and `file://` URLs (already proven with downloads)

### Player Screen Behavior

| Tagged state | Player shows |
|--------------|--------------|
| Has surah tag | Full experience (surah text + summary) |
| No surah tag | Simplified player with organize nudge |

---

## Implementation Phases

### Phase 1: Foundation (Storage & Data Layer)

- [ ] Create `UserRecitationsDatabaseService` (SQLite tables, CRUD, row mapping)
- [ ] Create `custom_reciters` table
- [ ] Create `UserRecitationsService` (business logic, file copy, validation)
- [ ] Create `useUserRecitationsStore` (Zustand, cached queries, reactive state)
- [ ] File storage in `documentDirectory/user-recitations/`
- [ ] Orphan file cleanup (weekly background check)
- [ ] Register service in AppInitializer (priority 6, non-critical)
- [ ] Install `expo-document-picker`
- [ ] TypeScript types (`UserRecitation`, `CustomReciter`, row types)

### Phase 2: Basic UI & Playback

- [ ] Add `'upload'` type to `CollectionItem` discriminated union
- [ ] Create `UploadCard` component (follows LovedCard/DownloadCard pattern)
- [ ] Add "Uploads" card to Collections grid
- [ ] Add "Uploads" filter pill in FilterBar
- [ ] Create Uploads screen with FilterBar (Untagged, Reciters, Other)
- [ ] Create `UploadItemCard` component (TrackCard pattern, spring animation)
- [ ] Implement `[+]` button with `expo-document-picker`
- [ ] Import success sheet (single file + bulk)
- [ ] Extend `Track` interface with `isUserUpload`, `userRecitationId`
- [ ] Create `createUserUploadTrack()` utility
- [ ] Tap-to-play: queue all uploads in current context via `useUnifiedPlayer`
- [ ] Basic player display with fallback hierarchy (title, artist)

### Phase 3: Organize Sheet

- [ ] Register `organize-recitation` action sheet
- [ ] Type selection chips (Surah / Other)
- [ ] Surah search/picker
- [ ] Optional verse range inputs (From/To)
- [ ] Title + category selection for "Other" type
- [ ] Reciter search with "Create new" option (reuse SelectReciterSheet pattern)
- [ ] Rewayah dropdown
- [ ] Delete action
- [ ] Long-press context menu on UploadItemCards

### Phase 4: Reciter Integration

- [ ] Add "Uploads" section to ReciterProfile (below SurahList)
- [ ] Max 5 items + "See all" link
- [ ] Contextual "Add Recitation" button (pre-fills reciter)
- [ ] Custom reciters in Uploads → Reciters view
- [ ] CircularReciterCard grid for reciters with uploads

### Phase 5: Player Polish

- [ ] Simplified player screen for untagged files (no QuranView, microphone icon)
- [ ] "Organize" nudge on untagged player screen
- [ ] Full experience for tagged uploads (surah text + summary)

### Phase 6: Share Sheet (External Import)

- [ ] iOS: Configure `CFBundleDocumentTypes` in Info.plist for audio MIME types
- [ ] Android: Intent filter for audio MIME types in AndroidManifest
- [ ] Expo: Evaluate `expo-share-intent` or custom config plugin
- [ ] Handle incoming files from share sheet → route to import flow
- [ ] Dev client rebuild required (native config changes)

---

## New Dependencies

| Package | Purpose | Phase |
|---------|---------|-------|
| `expo-document-picker` | In-app file selection | 1 |
| `expo-share-intent` (evaluate) | Share sheet handling | 6 |

---

## Styling Notes

- Do not use the app accent/primary color for uploads UI
- Follow existing card color conventions (each card type gets its own muted color)
- Reference LovedCard (#FF6B6B), DownloadCard (#10AC84) for the pattern
- Look at existing screens for color palette inspiration

---

## Future Enhancements (Not V1)

- **"Me" Category**: Personal recording filter pill + organize flow (`is_personal` field ready in schema)
- **Cloud Sync**: iCloud/Google Drive backup
- **Duplicate Detection**: Hash files on import, warn if duplicate exists
- **Live Recording**: Record directly in-app
- **Reciter Images**: Allow custom images for custom reciters
- **Bulk Organize**: Tag multiple files at once
- **Search**: Search within Uploads

---

## Technical Notes

- Audio playback via `expo-audio` (current migration target)
- Player integration approach is player-agnostic
- Downloaded files already use `file://` URIs, so local playback is proven
- UI patterns: LegendList, CircularReciterCard, FilterBar, react-native-actions-sheet
- File paths stored as relative filenames, resolved at runtime (iOS compatibility)

---

*Document created during brainstorming session. Last updated: February 2026*
