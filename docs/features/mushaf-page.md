# Mushaf Page — Design Document

> **Status**: Blocked (waiting on mushaf text renderer from collaborator)
> **Branch**: TBD (off `develop`)
> **Created**: 2026-02-07

## 1. Core Concept: Dual-Mode PlayerSheet

The existing PlayerSheet becomes a dual-purpose container supporting both listening and reading.

| Aspect | Player Mode (current) | Reader Mode (new) |
|--------|----------------------|-------------------|
| **Primary action** | Listening | Reading |
| **Content area** | QuranView (verse list) + track info | Mushaf pages (text-rendered) |
| **Controls** | Full playback (play/pause, skip, progress, speed, sleep, queue) | Play/pause only, collapsible for more |
| **Entry trigger** | Tap FloatingPlayer or auto-play from reciter screen | Tap surah from SurahsView/Search |
| **Audio requirement** | Required (currentTrack must exist) | Optional (pure reading supported) |

### Mode Switch

Toggle button near the playback controls area (not in the header). Positioned alongside speed/sleep/queue buttons.

### Sheet State

Current `sheetMode: 'hidden' | 'full'` needs expansion:

```
sheetMode: 'hidden' | 'full'
sheetContentMode: 'player' | 'reader'
```

The sheet can be open (`full`) in either player or reader mode. The sheet must support rendering without a `currentTrack` when in reader mode.

---

## 2. Entry Points & Behaviors

### From SurahsView (Home tab)

- **Tap surah** → Opens sheet in **reader mode** at that surah
- **Long press / options button** → Shows options sheet with new "Read" option added
- This is a behavior change: current tap plays audio. New tap reads. Play moves to options.

### From Reciter Detail Screen

- **Tap surah** → Populates FloatingPlayer + starts playback (current behavior, unchanged)
- **Options menu** → Adds "Read in Mushaf" option that opens sheet in reader mode at that surah

### From Search Tab

- **Tap surah result** → Opens sheet in **reader mode** (consistent with SurahsView)
- **Long press / options** → Shows options sheet with Read + Play options
- **Tap reciter result** → Opens reciter profile (current behavior, unchanged)

### From FloatingPlayer

- **Tap when audio playing** → Opens sheet in **player mode** (current behavior)
- **Tap when "Continue reading" shown** → Opens sheet in **reader mode** at last read position

### From Collection Tab

- Bookmarked ayahs open sheet in reader mode at that position
- Downloaded surahs keep current play behavior

---

## 3. FloatingPlayer Adaptation

The FloatingPlayer needs to represent reading sessions, not just audio:

| State | Left side | Center | Right side |
|-------|-----------|--------|------------|
| **Audio playing** | Play/Pause | Track title + Reciter name | Heart + Surah glyph |
| **Reading (no audio)** | Book icon | Surah name + "Continue reading" | Surah glyph |
| **Reading + audio** | Play/Pause | Track title + Reciter name | Surah glyph |

FloatingPlayer currently only renders when `currentTrack` exists. It needs to also render when a reading session is active (tracked by `mushafReadingStore.isReaderActive`).

---

## 4. Reader Mode UX

### 4.1 Mushaf Rendering (Blocker — Friend Building)

- Text-rendered pages matching physical mushaf layout
- Uses fonts like KFGQPC or similar
- Friend is building this component — we design the container and integration points around it

### 4.2 Surah Picker

- Overlay/modal accessible from reader mode header
- Quick-access list of all 114 surahs
- Shows surah name (Arabic + English), verse count, page range
- Can reuse existing `SurahsView` component or a stripped-down version

### 4.3 Minimal Playback Controls (when audio is playing)

- Default: just play/pause button + thin progress indicator
- Collapsible expansion for additional controls (skip, speed)
- When no audio: controls area hidden entirely, maximum reading space

### 4.4 Settings

- Reuse existing `mushafSettingsStore` for font sizes, translations, tajweed
- Reuse `MushafSettingsContent` component (already works in both sheet and settings screen)
- Additional mushaf-specific settings may be needed later (page color/theme, margin size)

---

## 5. Audio Integration from Reader Mode

### 5.1 Playing from Mushaf

- Long-press ayah → action sheet with "Play from here" option
- Triggers reciter selection (uses default reciter or asks via SelectReciterSheet)
- Audio starts, FloatingPlayer appears, reader mode stays open with sync enabled

### 5.2 Switching from Player to Reader Mode (audio playing)

- Prompt user: "Go to currently playing surah?" or "Continue where you left off reading?"
- If user chooses audio sync → mushaf navigates to the page containing current ayah

### 5.3 Timestamp-Synced Reading (when ayah timestamps available)

- **Default behavior**: Auto-highlight current ayah + auto-turn pages as audio progresses
- **User interruption**: If user swipes to a different page or long-presses an ayah, auto-follow pauses
- **Re-engage**: A "Follow along" toggle/button appears. Tapping it re-syncs to current audio position
- **Same pattern in QuranView** (verse list in player mode): identical follow-along behavior

### 5.4 Without Timestamps

- No ayah-level sync available
- Show surah-level association only (reader shows the surah that's playing)
- Mushaf doesn't highlight or auto-scroll — just shows the right surah

---

## 6. Ayah Interaction Model (Mushaf View)

### Tap

- In pure reading mode: no action (just reading)
- When follow-along is available but paused: could be used for tap-to-seek (TBD with timestamps)

### Long Press → Action Sheet

Full set of ayah-level actions:

1. **Play from here** — starts audio from this ayah (requires reciter selection if none active)
2. **Bookmark** — saves ayah to bookmarks (appears in Collection tab)
3. **Add note** — attach a personal note to this ayah
4. **Copy text** — copy Arabic text (+ translation if enabled) to clipboard
5. **Share** — share ayah text via system share sheet
6. **Loop range** — select start ayah (pre-filled from long press), pick end ayah, set repeat count
7. **Tafsir/Translation** — show detailed commentary or translation for this specific ayah

---

## 7. Reading State Management

### New Store: `mushafReadingStore`

```typescript
interface MushafReadingState {
  // Current position
  currentSurah: number | null;
  currentPage: number | null;

  // Auto-saved on navigate away
  lastReadPosition: {
    surahNumber: number;
    page: number;
    ayahNumber: number;
    timestamp: number;
  } | null;

  // Last 5 positions before navigating away (FIFO)
  readingHistory: Array<{
    surahNumber: number;
    page: number;
    ayahNumber: number;
    timestamp: number;
  }>;

  // Ayah bookmarks
  bookmarks: Array<{
    id: string;
    surahNumber: number;
    ayahNumber: number;
    verseKey: string; // "2:255"
    note?: string;
    createdAt: number;
  }>;

  // Ayah-level notes
  notes: Array<{
    id: string;
    verseKey: string;
    content: string;
    createdAt: number;
    updatedAt: number;
  }>;

  isReaderActive: boolean; // Whether a reading session is in progress
  followAlong: boolean;    // Auto-sync with audio playback
}
```

**Persistence**: Zustand + AsyncStorage (same pattern as other stores).

**Integration with Collection tab**: Bookmarks appear in the Collection screen, similar to loved tracks.

---

## 8. Performance Considerations

### Page Rendering

- Only render current page + 1 adjacent page in each direction (3 pages max in memory)
- Preload next page when user is 70%+ through current page
- Unload pages that are 2+ pages away

### Data

- All text data already bundled (quran.json ~1.2MB, translations ~500KB)
- Tajweed data pre-indexed at startup (existing system)
- No additional network requests for reading

### Transitions

- Mode switch (player ↔ reader) should be animated smoothly
- Use shared element transitions if possible for the surah title
- Page turns within mushaf should feel natural (swipe or tap edge)

### Memory

- `mushafReadingStore` is lightweight (positions + bookmarks)
- The mushaf renderer component should handle its own page virtualization
- Font rendering is the main cost — friend's renderer needs to optimize this

---

## 9. Integration with Existing Systems

### Reuse Directly

| System | File | What to reuse |
|--------|------|---------------|
| Mushaf settings | `store/mushafSettingsStore.ts` | Font sizes, translation/transliteration toggles, font family |
| Settings UI | `components/MushafSettingsContent.tsx` | Full settings panel for reader |
| Tajweed data | `store/tajweedStore.ts` | Color rules, indexed data |
| Sheet system | `components/sheets/sheets.tsx` | Register new sheets (ayah actions, surah picker) |
| Player actions | `hooks/usePlayerActions.ts` | `play()`, `seekTo()`, `updateQueue()` |
| Track creation | `utils/track.ts` | `createTrack()`, `createTracksForReciter()` |
| Reciter selection | `hooks/useReciterSelection.ts` | `playWithReciter()` |
| Surah data | `data/surahData.ts` | SURAHS array, Surah type |
| Quran text | `data/quran.json` | Verse text keyed by ID |
| Download state | `services/player/store/downloadStore.ts` | Check offline availability |

### Modify

| System | File | What changes |
|--------|------|-------------|
| PlayerSheet | `components/player/v2/PlayerSheet.tsx` | Support dual content mode, render without currentTrack |
| PlayerContent | `components/player/v2/PlayerContent/index.tsx` | Add reader mode content area, mode toggle |
| FloatingPlayer | `components/player/v2/FloatingPlayer/index.tsx` | Support reading session display |
| playerStore | `services/player/store/playerStore.ts` | Add `sheetContentMode` state |
| SurahsView | `components/SurahsView.tsx` | Change tap to open reader, add long-press/options |
| Search results | `app/(tabs)/(b.search)/index.tsx` | Change surah tap to reader, add options |
| Options sheets | Various | Add "Read in Mushaf" option |
| Collection | `app/(tabs)/(c.collection)/index.tsx` | Display bookmarks section |

### Create New

| System | Purpose |
|--------|---------|
| `store/mushafReadingStore.ts` | Reading position, bookmarks, notes, history |
| `components/mushaf/MushafContainer.tsx` | Container for friend's mushaf renderer |
| `components/mushaf/MushafControls.tsx` | Minimal playback controls for reader mode |
| `components/mushaf/SurahPickerSheet.tsx` | Surah navigation overlay |
| `components/sheets/AyahActionsSheet.tsx` | Long-press ayah action sheet |
| `hooks/useMushafNavigation.ts` | Navigation logic within mushaf |
| `hooks/useReadingSession.ts` | Manages reading session lifecycle |

---

## 10. Blockers & Dependencies

| Blocker | Status | Impact |
|---------|--------|--------|
| Friend's mushaf renderer | In progress | Cannot build actual page rendering. Can build everything around it. |
| Ayah timestamps feature | Designed, not implemented | Cannot build auto-highlight, tap-to-seek, range loop. Can build infrastructure. |
| Tafsir data source | Not started | Tafsir option in ayah actions will be placeholder until data is sourced |

---

## 11. What Can Be Built NOW (Before Renderer)

### Infrastructure (no renderer needed)

1. `mushafReadingStore` — reading state, bookmarks, notes, history
2. Entry point changes — SurahsView tap behavior, options sheet updates, search tab updates
3. FloatingPlayer reading session support
4. `sheetContentMode` state in playerStore
5. `AyahActionsSheet` — long-press actions (most work without renderer)
6. `SurahPickerSheet` — surah navigation modal
7. Shell `MushafContainer` component with loading/placeholder state
8. Bookmark integration with Collection tab
9. Mode toggle button in PlayerContent controls area

### Requires Renderer

- Actual page display
- Page turn gestures/animation
- Ayah position detection (for long-press targeting)
- Page-level navigation

### Requires Ayah Timestamps

- Auto-highlight current ayah
- Auto-page turn
- Follow-along toggle
- Play from specific ayah (precise seeking)
- Range loop

---

## 12. Open Questions

1. **Tafsir source**: Which tafsir(s) to integrate? Ibn Kathir, Jalalayn, etc.? Bundled or fetched?
2. **Reading plans**: What does a khatmah tracker look like?
3. **Multiple mushaf editions**: Should users choose between Madani, Indopak layouts (beyond font)?
4. **Landscape mode**: Should the mushaf support landscape for wider reading?
5. **iPad/tablet**: Two-page spread like a physical mushaf?
6. **Night mode for reading**: Separate from app dark mode? (Sepia, true black, etc.)
7. **Collapsible controls UX**: Exact interaction for expanding/collapsing playback controls in reader mode needs prototyping.
8. **Verse-list view in reader mode**: Currently decided as mushaf-only for reader mode. Revisit if users request it.
