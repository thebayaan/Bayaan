# Continuous Scroll Mushaf — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the horizontal page-swipe mushaf with a single continuous vertical scroll from Al-Fatiha to An-Nas, with two sub-modes (Mushaf Scroll and Verse Scroll).

**Architecture:** A vertical FlashList replaces the horizontal FlatList in `components/mushaf/main.tsx`. The FlashList renders different item types per mode: Skia pages for mushaf scroll, or verse items / paragraph chunks for verse scroll. Navigation, playback, and position tracking all resolve through verse keys mapped to FlashList indices.

**Tech Stack:** FlashList (`@shopify/flash-list`), React Native Skia (existing), Zustand (existing stores), expo-audio (existing playback).

**Design doc:** `docs/plans/2026-03-04-continuous-scroll-design.md`

---

### Task 1: Update Settings Store — Replace viewMode with scrollMode

**Files:**
- Modify: `store/mushafSettingsStore.ts`

**Step 1: Update types and state**

Replace `MushafViewMode = 'mushaf' | 'reading'` with `MushafScrollMode = 'mushaf' | 'verse'`.

In the interface:
- Rename `viewMode` → `scrollMode` (type: `MushafScrollMode`)
- Rename `setViewMode` → `setScrollMode`
- Remove `pageLayout` and `setPageLayout` (no more book/fullscreen distinction — continuous scroll is always fullscreen)
- Change `recentPages: RecentRead[]` to store `verseKey: string` instead of `page: number` in `RecentRead`

```typescript
export type MushafScrollMode = 'mushaf' | 'verse';

export interface RecentRead {
  surahId: number;
  verseKey: string;  // was: page: number
  timestamp: number;
}
```

**Step 2: Update default values and actions**

- Default `scrollMode: 'mushaf'`
- `updateActiveChain(surahId, verseKey)` — store verseKey instead of page
- `startNewChain(surahId, verseKey)` — same
- Remove `setPageLayout` action

**Step 3: Bump persist version and add migration**

Add `version: 9` migration:
```typescript
if (version < 9) {
  // Migrate viewMode → scrollMode
  state.scrollMode = state.viewMode === 'reading' ? 'verse' : 'mushaf';
  delete state.viewMode;
  delete state.pageLayout;
  // Migrate recentPages: page → verseKey (best-effort: use 'surahId:1' as fallback)
  if (Array.isArray(state.recentPages)) {
    state.recentPages = state.recentPages.map(r => ({
      ...r,
      verseKey: r.verseKey || `${r.surahId}:1`,
    }));
  }
}
```

**Step 4: Verify**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: Type errors in files that reference `viewMode` / `setViewMode` / `pageLayout` — these will be fixed in later tasks.

**Step 5: Commit**

```bash
git add store/mushafSettingsStore.ts
git commit -m "refactor(store): replace viewMode with scrollMode, migrate recentPages to verseKey"
```

---

### Task 2: Create Data Utilities — Build FlashList Arrays

**Files:**
- Create: `utils/continuousScrollData.ts`
- Read (reference only): `utils/mushafPageVerses.ts`, `services/mushaf/MushafVerseMapService.ts`, `services/mushaf/DigitalKhattDataService.ts`

**Step 1: Define item types**

```typescript
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {enhancedVersesBySurah, type EnhancedVerse} from './enhancedVerseData';

const surahData = require('@/data/surahData.json') as Array<{
  id: number;
  name: string;
  bismillah_pre: boolean;
}>;

export type MushafScrollItem = {
  type: 'mushaf-page';
  pageNumber: number;
  key: string;
};

export type VerseScrollItem =
  | {type: 'surah-divider'; surahNumber: number; showBismillah: boolean; key: string}
  | {type: 'verse-item'; verse: EnhancedVerse; pageNumber: number; key: string}
  | {type: 'page-marker'; pageNumber: number; key: string}
  | {type: 'paragraph-chunk'; pageNumber: number; verseKeys: string[]; arabicText: string; key: string};

export type ScrollItem = MushafScrollItem | VerseScrollItem;
```

**Step 2: Build mushaf scroll data**

```typescript
let mushafScrollDataCache: MushafScrollItem[] | null = null;

export function getMushafScrollData(): MushafScrollItem[] {
  if (mushafScrollDataCache) return mushafScrollDataCache;
  mushafScrollDataCache = Array.from({length: 604}, (_, i) => ({
    type: 'mushaf-page' as const,
    pageNumber: i + 1,
    key: `mp-${i + 1}`,
  }));
  return mushafScrollDataCache;
}
```

**Step 3: Build verse scroll data (stacked cards — translation ON)**

Build a flat array: iterate pages 1-604, for each page get verse keys, insert surah dividers when surah changes, insert page markers between pages, and verse items for each verse.

```typescript
let verseStackedDataCache: VerseScrollItem[] | null = null;

export function getVerseStackedData(): VerseScrollItem[] {
  if (verseStackedDataCache) return verseStackedDataCache;
  const items: VerseScrollItem[] = [];
  let lastSurahNumber = 0;

  for (let page = 1; page <= 604; page++) {
    // Page marker between pages (not before page 1)
    if (page > 1) {
      items.push({type: 'page-marker', pageNumber: page - 1, key: `pm-${page - 1}`});
    }

    const verseKeys = mushafVerseMapService.getOrderedVerseKeysForPage(page);
    for (const vk of verseKeys) {
      const [surahStr, ayahStr] = vk.split(':');
      const surahNumber = parseInt(surahStr, 10);
      const ayahNumber = parseInt(ayahStr, 10);

      if (surahNumber !== lastSurahNumber) {
        const surah = surahData.find(s => s.id === surahNumber);
        items.push({
          type: 'surah-divider',
          surahNumber,
          showBismillah: surah?.bismillah_pre ?? false,
          key: `sd-${surahNumber}`,
        });
        lastSurahNumber = surahNumber;
      }

      const surahVerses = enhancedVersesBySurah[surahNumber];
      const verse = surahVerses?.find(v => v.ayah_number === ayahNumber);
      if (verse) {
        items.push({type: 'verse-item', verse, pageNumber: page, key: `vi-${vk}`});
      }
    }
  }

  verseStackedDataCache = items;
  return items;
}
```

**Step 4: Build verse scroll data (inline flow — translation OFF)**

Group verses by page into paragraph chunks. Each chunk = all verses on one page concatenated with verse-end markers.

```typescript
let verseInlineDataCache: VerseScrollItem[] | null = null;

export function getVerseInlineData(): VerseScrollItem[] {
  if (verseInlineDataCache) return verseInlineDataCache;
  const items: VerseScrollItem[] = [];
  let lastSurahNumber = 0;

  for (let page = 1; page <= 604; page++) {
    const verseKeys = mushafVerseMapService.getOrderedVerseKeysForPage(page);
    // Group by surah within this page (surah divider needed if surah changes)
    let currentChunkVerseKeys: string[] = [];
    let currentChunkText = '';

    for (const vk of verseKeys) {
      const [surahStr, ayahStr] = vk.split(':');
      const surahNumber = parseInt(surahStr, 10);
      const ayahNumber = parseInt(ayahStr, 10);

      if (surahNumber !== lastSurahNumber) {
        // Flush current chunk before surah divider
        if (currentChunkText) {
          items.push({
            type: 'paragraph-chunk',
            pageNumber: page,
            verseKeys: currentChunkVerseKeys,
            arabicText: currentChunkText.trim(),
            key: `pc-${page}-${currentChunkVerseKeys[0]}`,
          });
          currentChunkVerseKeys = [];
          currentChunkText = '';
        }
        const surah = surahData.find(s => s.id === surahNumber);
        items.push({
          type: 'surah-divider',
          surahNumber,
          showBismillah: surah?.bismillah_pre ?? false,
          key: `sd-${surahNumber}`,
        });
        lastSurahNumber = surahNumber;
      }

      const surahVerses = enhancedVersesBySurah[surahNumber];
      const verse = surahVerses?.find(v => v.ayah_number === ayahNumber);
      if (verse) {
        // Arabic verse text + verse-end marker with Arabic-Indic numeral
        const marker = toArabicIndic(ayahNumber);
        currentChunkText += `${verse.text_uthmani} \u06DD${marker} `;
        currentChunkVerseKeys.push(vk);
      }
    }

    // Flush remaining chunk for this page
    if (currentChunkText) {
      items.push({
        type: 'paragraph-chunk',
        pageNumber: page,
        verseKeys: currentChunkVerseKeys,
        arabicText: currentChunkText.trim(),
        key: `pc-${page}-${currentChunkVerseKeys[0]}`,
      });
    }
  }

  verseInlineDataCache = items;
  return items;
}

function toArabicIndic(num: number): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).split('').map(d => arabicDigits[parseInt(d, 10)]).join('');
}
```

**Step 5: Add index lookup helpers**

```typescript
// Build a verseKey → index map for fast scrollToIndex lookups
export function buildVerseKeyToIndex(data: VerseScrollItem[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (item.type === 'verse-item') {
      map.set(item.verse.verse_key, i);
    } else if (item.type === 'paragraph-chunk') {
      for (const vk of item.verseKeys) {
        if (!map.has(vk)) map.set(vk, i);
      }
    }
  }
  return map;
}

// For mushaf scroll: verseKey → page index
export function getPageIndexForVerse(verseKey: string): number {
  const page = digitalKhattDataService.getPageForVerse(verseKey);
  return page ? page - 1 : 0; // FlashList is 0-indexed
}
```

**Step 6: Add cache invalidation**

```typescript
export function invalidateScrollDataCaches() {
  mushafScrollDataCache = null;
  verseStackedDataCache = null;
  verseInlineDataCache = null;
}
```

**Step 7: Verify**

Run: `npx tsc --noEmit 2>&1 | grep continuousScrollData`
Expected: No errors from this file (other files may still have errors from Task 1).

**Step 8: Commit**

```bash
git add utils/continuousScrollData.ts
git commit -m "feat(scroll): add data utilities for continuous scroll FlashList arrays"
```

---

### Task 3: Create PageMarker Component

**Files:**
- Create: `components/mushaf/continuous/PageMarker.tsx`

**Step 1: Implement component**

```typescript
import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import Color from 'color';

interface PageMarkerProps {
  pageNumber: number;
  textColor: string;
}

const PageMarker: React.FC<PageMarkerProps> = ({pageNumber, textColor}) => (
  <View style={styles.container}>
    <Text style={[styles.text, {color: Color(textColor).alpha(0.15).toString()}]}>
      · {pageNumber} ·
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: moderateScale(4),
  },
  text: {
    fontFamily: 'Manrope-Regular',
    fontSize: moderateScale(10),
  },
});

export default React.memo(PageMarker);
```

**Step 2: Commit**

```bash
git add components/mushaf/continuous/PageMarker.tsx
git commit -m "feat(scroll): add PageMarker component for subtle page indicators"
```

---

### Task 4: Create ParagraphChunk Component (Inline Flow)

**Files:**
- Create: `components/mushaf/continuous/ParagraphChunk.tsx`

This renders a block of Arabic text as a continuous RTL paragraph with inline verse-end markers.

**Step 1: Implement component**

```typescript
import React from 'react';
import {Text, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';

interface ParagraphChunkProps {
  arabicText: string;
  textColor: string;
  fontSize: number;
  onPress?: () => void;
}

const ParagraphChunk: React.FC<ParagraphChunkProps> = ({
  arabicText,
  textColor,
  fontSize,
  onPress,
}) => (
  <Text
    style={[
      styles.text,
      {
        color: textColor,
        fontSize,
        lineHeight: fontSize * 2.2,
      },
    ]}
    onPress={onPress}>
    {arabicText}
  </Text>
);

const styles = StyleSheet.create({
  text: {
    fontFamily: 'DigitalKhattV1',
    writingDirection: 'rtl',
    textAlign: 'right',
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(4),
  },
});

export default React.memo(ParagraphChunk);
```

Note: The font family should match the selected mushafRenderer. We'll pass it as a prop. The `arabicText` already has verse-end markers baked in from the data utility.

**Step 2: Commit**

```bash
git add components/mushaf/continuous/ParagraphChunk.tsx
git commit -m "feat(scroll): add ParagraphChunk component for inline Arabic flow"
```

---

### Task 5: Create ContinuousMushafScroll Component

**Files:**
- Create: `components/mushaf/continuous/ContinuousMushafScroll.tsx`
- Read (reference): `components/mushaf/main.tsx`, `components/mushaf/skia/SkiaPage.tsx`

This is the core component — a vertical FlashList that renders all items for the selected mode.

**Step 1: Implement the component**

The component:
1. Reads `scrollMode` and `showTranslation` from settings store
2. Builds the appropriate data array using utilities from Task 2
3. Renders a FlashList with `getItemType` for mixed content
4. Fires `onViewableItemsChanged` to report topmost visible verse key to parent
5. Exposes a `scrollToVerse(verseKey)` method via `forwardRef`/`useImperativeHandle`

Key implementation details:
- For `mushaf` mode: each item is a SkiaPage (existing component) rendered without page labels/metadata (those are now in the header)
- For `verse` mode with translation ON: VerseItem + SurahDivider + PageMarker
- For `verse` mode with translation OFF: ParagraphChunk + SurahDivider
- `getItemType` returns the `type` field from each item
- `estimatedItemSize` varies per mode: ~SCREEN_HEIGHT for mushaf pages, ~120 for verse items, ~300 for paragraph chunks
- `onViewableItemsChanged` extracts the verse key from the topmost item and calls parent callback

```typescript
import React, {useCallback, useMemo, useRef, forwardRef, useImperativeHandle} from 'react';
import {View, ViewToken} from 'react-native';
import {FlashList, type FlashListRef} from '@shopify/flash-list';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {
  getMushafScrollData,
  getVerseStackedData,
  getVerseInlineData,
  buildVerseKeyToIndex,
  getPageIndexForVerse,
  type MushafScrollItem,
  type VerseScrollItem,
  type ScrollItem,
} from '@/utils/continuousScrollData';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import SkiaPage from '../skia/SkiaPage';
import {VerseItem} from '@/components/player/v2/PlayerContent/QuranView/VerseItem';
import SurahDivider from '@/components/player/v2/PlayerContent/QuranView/SurahDivider';
import BasmalaHeader from '@/components/player/v2/PlayerContent/QuranView/BasmalaHeader';
import PageMarker from './PageMarker';
import ParagraphChunk from './ParagraphChunk';
import {SCREEN_HEIGHT, CONTENT_HEIGHT} from '../constants';
// ...additional imports for theme, settings, etc.
```

The full implementation is complex (~200-300 lines). Key render logic:

```typescript
const renderItem = useCallback(({item}: {item: ScrollItem}) => {
  switch (item.type) {
    case 'mushaf-page':
      return (
        <SkiaPage
          pageNumber={item.pageNumber}
          textColor={textColor}
          onTap={onTap}
        />
      );
    case 'surah-divider':
      return (
        <View>
          <SurahDivider ... />
          <BasmalaHeader visible={item.showBismillah} ... />
        </View>
      );
    case 'verse-item':
      return <VerseItem verse={item.verse} ... />;
    case 'page-marker':
      return <PageMarker pageNumber={item.pageNumber} textColor={textColor} />;
    case 'paragraph-chunk':
      return <ParagraphChunk arabicText={item.arabicText} ... />;
  }
}, [/* deps */]);

const getItemType = useCallback((item: ScrollItem) => item.type, []);
```

The component exposes `scrollToVerse` via ref:
```typescript
export interface ContinuousScrollRef {
  scrollToVerse: (verseKey: string, animated?: boolean) => void;
  scrollToIndex: (index: number, animated?: boolean) => void;
}
```

**Step 2: Wire up onViewableItemsChanged**

The callback extracts verse info from the topmost visible item and reports it to the parent:

```typescript
interface VisibleVerseInfo {
  verseKey: string;
  pageNumber: number;
  surahId: number;
}

// onVisibleVerseChanged prop called with debounced (200ms) verse info
```

For mushaf-page items: derive first verse key from `mushafVerseMapService.getOrderedVerseKeysForPage(pageNumber)`.
For verse-item: directly use `verse.verse_key`.
For paragraph-chunk: use first `verseKeys[0]`.

**Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | grep ContinuousMushafScroll`
Expected: Clean (possibly some warnings about unused imports that will be connected in Task 7).

**Step 4: Commit**

```bash
git add components/mushaf/continuous/ContinuousMushafScroll.tsx
git commit -m "feat(scroll): add ContinuousMushafScroll FlashList component"
```

---

### Task 6: Refactor Auto-Scroll Hook

**Files:**
- Modify: `hooks/useMushafAutoPageTurn.ts` → rename to `hooks/useMushafAutoScroll.ts`

**Step 1: Refactor the hook**

Instead of navigating to a page number, the hook now calls `scrollToVerse(verseKey)` on the ContinuousScrollRef.

```typescript
import {useEffect, useRef} from 'react';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import type {ContinuousScrollRef} from '@/components/mushaf/continuous/ContinuousMushafScroll';

export function useMushafAutoScroll(
  scrollRef: React.RefObject<ContinuousScrollRef | null>,
) {
  const playbackState = useMushafPlayerStore(s => s.playbackState);
  const currentVerseKey = useMushafPlayerStore(s => s.currentVerseKey);
  const lastScrolledVerse = useRef<string | null>(null);

  useEffect(() => {
    if (playbackState !== 'playing' || !currentVerseKey) return;
    if (currentVerseKey === lastScrolledVerse.current) return;

    lastScrolledVerse.current = currentVerseKey;
    scrollRef.current?.scrollToVerse(currentVerseKey, true);
  }, [playbackState, currentVerseKey, scrollRef]);
}
```

**Step 2: Delete old file, create new**

Delete `hooks/useMushafAutoPageTurn.ts`, create `hooks/useMushafAutoScroll.ts`.

**Step 3: Commit**

```bash
git add hooks/useMushafAutoScroll.ts
git rm hooks/useMushafAutoPageTurn.ts
git commit -m "refactor(hooks): replace useMushafAutoPageTurn with useMushafAutoScroll"
```

---

### Task 7: Rewrite MushafViewer (main.tsx)

**Files:**
- Modify: `components/mushaf/main.tsx`
- Read (reference): current `main.tsx` (preserve header, search, player bar)

This is the biggest single change. Replace the horizontal FlatList with ContinuousMushafScroll, update header to show live verse/page info, and wire up all navigation.

**Step 1: Replace FlatList with ContinuousMushafScroll**

Remove:
- `DKPageView` component (Skia page + book layout wrapper — no longer needed, SkiaPage is rendered directly by ContinuousMushafScroll)
- `PageEdgeDecoration` import and usage (no book layout)
- Horizontal FlatList and all related state (`pages` array, `getItemLayout`, `inverted`, `horizontal`, `pagingEnabled`)
- `pageLayout`, `isBookLayout`, `edgeBg`, `pageBg` variables
- `ReadingPageView` import

Add:
- `ContinuousMushafScroll` ref and component
- `useMushafAutoScroll` hook wired to the ref
- Visible verse tracking state: `currentVerseKey`, `currentPage`, `currentSurahId`

**Step 2: Update header to use verse-based state**

The `onVisibleVerseChanged` callback from ContinuousMushafScroll updates:
- `currentVerseKey` (for last-read saving)
- `currentPage` (for header display)
- `currentSurahId` (for header surah name)

Header display stays the same: surah name + page + juz.

**Step 3: Update navigation functions**

- `navigateToPage(page)` → resolve first verse on page, then `scrollRef.scrollToVerse(verseKey)`
- `navigateToSurah(surahId)` → get surah start page → first verse → scroll
- `navigateToVerse(verseKey)` → `scrollRef.scrollToVerse(verseKey)`
- `resumeChain(index, verseKey)` → `scrollRef.scrollToVerse(verseKey)`

**Step 4: Update last-read tracking**

- On `onVisibleVerseChanged`: call `useMushafSettingsStore.getState().updateActiveChain(surahId, verseKey)`
- On `startNewChain`: pass verseKey instead of page

**Step 5: Preserve immersive mode**

Pass `onTap={toggleImmersive}` to ContinuousMushafScroll, which passes it to SkiaPage / ParagraphChunk / VerseItem.

**Step 6: Preserve search mode overlay**

MushafSearchView stays the same — its `onNavigateToPage`, `onNavigateToSurah`, `onNavigateToVerse` callbacks just call the new navigation functions.

Update `onResumeChain` to pass verseKey instead of page.

**Step 7: Remove unused imports**

Remove: `PageEdgeDecoration`, `EDGE_BORDER_RADIUS`, `EDGE_HORIZONTAL_INSET`, `ReadingPageView`, `getPageEdgeLayout`, book layout related constants.

**Step 8: Verify**

Run: `npx tsc --noEmit 2>&1 | head -50`
Check for remaining type errors.

**Step 9: Commit**

```bash
git add components/mushaf/main.tsx
git commit -m "feat(scroll): rewrite MushafViewer with continuous vertical scroll"
```

---

### Task 8: Update MushafSettingsContent

**Files:**
- Modify: `components/MushafSettingsContent.tsx`

**Step 1: Update view mode selector**

Replace the two-option `viewMode` selector (Mushaf / Scroll) with `scrollMode` (Mushaf / Verse):
- Replace `viewMode` → `scrollMode`
- Replace `setViewMode` → `setScrollMode`
- Change labels: "Mushaf" stays, "Scroll" becomes "Verse"
- Update icon: keep `MushafPageIcon` for mushaf, `ScrollModeIcon` for verse

**Step 2: Remove page layout selector**

Remove the entire "PAGE LAYOUT" section (fullscreen / book options). Continuous scroll is always fullscreen.

**Step 3: Conditionally show translation/transliteration toggles**

These settings only apply in verse scroll mode. In mushaf scroll mode, hide the TRANSLATION section or show a hint that translations aren't available in mushaf mode.

Actually — per the existing pattern, translation toggles affect the player sheet too, not just mushaf. Keep them visible always. No change needed here.

**Step 4: Verify**

Run: `npx tsc --noEmit 2>&1 | grep MushafSettingsContent`
Expected: No errors.

**Step 5: Commit**

```bash
git add components/MushafSettingsContent.tsx
git commit -m "refactor(settings): update mushaf settings for continuous scroll modes"
```

---

### Task 9: Update MushafSearchView Navigation

**Files:**
- Modify: `components/mushaf/MushafSearchView.tsx`

**Step 1: Update navigation callbacks**

The search view already calls `onNavigateToPage`, `onNavigateToSurah`, `onNavigateToVerse`. These callbacks are re-implemented in the parent (Task 7) to use verse-based scrolling, so the search view itself may need minimal changes.

Check if `onResumeChain` passes page number — update to pass verseKey from the `RecentRead.verseKey` field.

**Step 2: Update recent reads display**

Recent reads now store `verseKey` instead of `page`. Update the display to show the verse reference (e.g., "Al-Baqarah 2:142") instead of or alongside the page number.

The page number can still be derived: `digitalKhattDataService.getPageForVerse(recentRead.verseKey)`.

**Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | grep MushafSearchView`
Expected: No errors.

**Step 4: Commit**

```bash
git add components/mushaf/MushafSearchView.tsx
git commit -m "refactor(search): update mushaf search for verse-based navigation"
```

---

### Task 10: Update app/mushaf.tsx Entry Point

**Files:**
- Modify: `app/mushaf.tsx`

**Step 1: Update initial position resolution**

Currently resolves to a page number. Change to resolve to a verse key:

- If `surah` and `ayah` params present: `initialVerseKey = '${surah}:${ayah}'`
- If `surah` param only: `initialVerseKey = '${surah}:1'`
- If `page` param: resolve first verse on that page via `mushafVerseMapService.getOrderedVerseKeysForPage(page)[0]`
- Default: `'1:1'` (Al-Fatiha verse 1)

**Step 2: Pass verseKey to MushafViewer**

Change `MushafViewerProps` to accept `initialVerseKey: string` instead of `pageNumber: number`.

**Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: Clean — all type errors resolved.

**Step 4: Format and lint**

Run: `npx prettier --write components/mushaf/ utils/continuousScrollData.ts store/mushafSettingsStore.ts hooks/useMushafAutoScroll.ts app/mushaf.tsx components/MushafSettingsContent.tsx`
Run: `npm run lint:fix`

**Step 5: Commit**

```bash
git add app/mushaf.tsx
git commit -m "refactor(mushaf): update entry point for verse-based continuous scroll"
```

---

### Task 11: Fix All Remaining Type Errors and References

**Files:**
- Any files that still reference `viewMode`, `pageLayout`, `useMushafAutoPageTurn`, or old types

**Step 1: Run full type check**

Run: `npx tsc --noEmit`

**Step 2: Fix each error**

Common fixes:
- Replace `viewMode` → `scrollMode` in any remaining file
- Replace `setViewMode` → `setScrollMode`
- Remove `pageLayout` / `setPageLayout` references
- Update `useMushafAutoPageTurn` → `useMushafAutoScroll` in any import
- Update `RecentRead.page` → `RecentRead.verseKey`

**Step 3: Verify clean**

Run: `npx tsc --noEmit`
Expected: Zero errors.

**Step 4: Format**

Run: `npx prettier --write $(git diff --name-only --diff-filter=M)`

**Step 5: Commit**

```bash
git add -A
git commit -m "fix: resolve all remaining type errors from continuous scroll migration"
```

---

### Task 12: Manual Verification

**Step 1: Start the app**

Run: `npm start` → launch on iOS simulator or device.

**Step 2: Verify mushaf scroll mode**

- Open mushaf → should see continuous vertical scroll of Skia pages
- Scroll smoothly through pages — no page breaks, seamless stitching
- Header updates surah name and page number as you scroll
- Tap to toggle immersive mode (header + player bar hide/show)
- Long-press a verse → VerseActionsSheet opens with selection

**Step 3: Verify verse scroll mode**

- Switch to verse mode in settings
- With translation OFF: see flowing Arabic paragraphs with verse markers
- Toggle translation ON: see stacked verse cards with page markers
- Tap a verse card → VerseActionsSheet
- Surah dividers appear between surahs

**Step 4: Verify navigation**

- Use search to jump to a surah → scrolls to correct position
- Use search to jump to a specific verse → scrolls precisely
- Recent reads show and navigate correctly
- Bookmarks navigate correctly

**Step 5: Verify playback**

- Start ayah-by-ayah playback → scroll auto-follows
- Manually scroll away → auto-scroll re-engages after pause

**Step 6: Verify mode switching preserves position**

- Scroll to a specific verse in mushaf mode
- Switch to verse mode → should land at the same verse
- Switch back → same verse

---

## Summary of Files

**Created:**
- `utils/continuousScrollData.ts`
- `components/mushaf/continuous/ContinuousMushafScroll.tsx`
- `components/mushaf/continuous/PageMarker.tsx`
- `components/mushaf/continuous/ParagraphChunk.tsx`
- `hooks/useMushafAutoScroll.ts`

**Modified:**
- `store/mushafSettingsStore.ts`
- `components/mushaf/main.tsx`
- `components/MushafSettingsContent.tsx`
- `components/mushaf/MushafSearchView.tsx`
- `app/mushaf.tsx`

**Deleted:**
- `hooks/useMushafAutoPageTurn.ts`
- `components/mushaf/reading/ReadingPageView.tsx` (replaced by ContinuousMushafScroll verse mode)
