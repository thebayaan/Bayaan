# Mushaf Thematic Highlighting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a toggle in mushaf settings that enables alternating theme highlights on Quran verses (zebra-stripe by theme passage), and a "Theme" option in the verse actions sheet showing theme name + passage range.

**Architecture:** New `ThemeDataService` singleton loads `data/quran-themes.json` and builds O(1) lookup maps (verse→theme, page→themes). Mushaf settings store gets a `showThemes` boolean toggle. Both Skia mushaf mode and reading (list) mode render alternating background colors per theme passage. Verse actions sheet gets a new "Theme" screen.

**Tech Stack:** React Native, Zustand (persisted), Skia canvas highlights, expo-router

---

### Task 1: Create ThemeDataService

**Files:**
- Create: `services/mushaf/ThemeDataService.ts`
- Reference: `data/quran-themes.json`

**Step 1: Create the service file**

```typescript
// services/mushaf/ThemeDataService.ts
import {digitalKhattDataService} from './DigitalKhattDataService';
import {mushafVerseMapService} from './MushafVerseMapService';

const themesData = require('@/data/quran-themes.json');

interface ThemeEntry {
  theme: string;
  surah: number;
  ayahFrom: number;
  ayahTo: number;
  verseKeyFrom: string;
  verseKeyTo: string;
  totalAyahs: number;
}

interface VerseThemeInfo {
  theme: string;
  surah: number;
  ayahFrom: number;
  ayahTo: number;
  verseKeyFrom: string;
  verseKeyTo: string;
  themeIndex: number; // sequential within surah, for zebra striping
}

class ThemeDataService {
  private verseMap = new Map<string, VerseThemeInfo>();
  private initialized = false;

  init() {
    if (this.initialized) return;
    const themes: ThemeEntry[] = themesData.themes;

    // Track theme index per surah for zebra striping
    let currentSurah = 0;
    let surahThemeIndex = 0;

    for (const entry of themes) {
      if (entry.surah !== currentSurah) {
        currentSurah = entry.surah;
        surahThemeIndex = 0;
      }

      const info: VerseThemeInfo = {
        theme: entry.theme,
        surah: entry.surah,
        ayahFrom: entry.ayahFrom,
        ayahTo: entry.ayahTo,
        verseKeyFrom: entry.verseKeyFrom,
        verseKeyTo: entry.verseKeyTo,
        themeIndex: surahThemeIndex,
      };

      // Map every verse in the range to this theme
      for (let ayah = entry.ayahFrom; ayah <= entry.ayahTo; ayah++) {
        this.verseMap.set(`${entry.surah}:${ayah}`, info);
      }

      surahThemeIndex++;
    }

    this.initialized = true;
  }

  getThemeForVerse(verseKey: string): VerseThemeInfo | undefined {
    if (!this.initialized) this.init();
    return this.verseMap.get(verseKey);
  }

  /**
   * Get all themes that appear on a given mushaf page.
   * Returns unique theme entries in verse order.
   */
  getThemesForPage(
    pageNumber: number,
  ): Array<{theme: VerseThemeInfo; verseKeys: string[]}> {
    if (!this.initialized) this.init();
    const verseKeys =
      mushafVerseMapService.getOrderedVerseKeysForPage(pageNumber);
    const seen = new Map<string, {theme: VerseThemeInfo; verseKeys: string[]}>();

    for (const vk of verseKeys) {
      const info = this.verseMap.get(vk);
      if (!info) continue;
      const key = `${info.surah}:${info.ayahFrom}-${info.ayahTo}`;
      const existing = seen.get(key);
      if (existing) {
        existing.verseKeys.push(vk);
      } else {
        seen.set(key, {theme: info, verseKeys: [vk]});
      }
    }

    return Array.from(seen.values());
  }
}

export const themeDataService = new ThemeDataService();
```

**Step 2: Commit**

```bash
git add services/mushaf/ThemeDataService.ts
git commit -m "feat(themes): add ThemeDataService with verse→theme lookup"
```

---

### Task 2: Add showThemes toggle to mushaf settings store

**Files:**
- Modify: `store/mushafSettingsStore.ts`

**Step 1: Add the toggle**

In `MushafSettingsState` interface (line 34), add after `showTajweed: boolean;` (line 38):

```typescript
  showThemes: boolean;
```

In the actions section of the interface (after line 75 `toggleTajweed`):

```typescript
  toggleThemes: () => void;
```

In the default values (after line 101 `showTajweed: false,`):

```typescript
      showThemes: false,
```

In the actions (after line 122 `toggleTajweed`):

```typescript
      toggleThemes: () => set(state => ({showThemes: !state.showThemes})),
```

**Step 2: Bump version and add migration**

Change `version: 9` to `version: 10` (line 182).

After the `version < 9` block (after line 231), add:

```typescript
        if (version < 10) {
          state.showThemes = false;
        }
```

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 4: Commit**

```bash
git add store/mushafSettingsStore.ts
git commit -m "feat(themes): add showThemes toggle to mushaf settings store"
```

---

### Task 3: Add "Themes" toggle to MushafSettingsContent UI

**Files:**
- Modify: `components/MushafSettingsContent.tsx`

**Step 1: Subscribe to the new toggle**

In the destructured store values (around line 403-430), add:

```typescript
    showThemes,
    toggleThemes,
```

**Step 2: Add the toggle row**

After the Translation card (ends around line 770, the `</>` closing), before the `{/* FONT Section */}` comment (line 774), add a new Themes card:

```tsx
          <View style={styles.card}>
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Thematic Highlighting</Text>
              <Switch
                trackColor={trackColor}
                thumbColor="#FFFFFF"
                ios_backgroundColor={trackColor.false}
                onValueChange={toggleThemes}
                value={showThemes}
                style={styles.switchStyle}
              />
            </View>
            <Text style={styles.helperText}>
              Alternating highlights by thematic passage
            </Text>
          </View>
```

This uses the existing `styles.card`, `styles.optionRow`, `styles.optionLabel`, `styles.helperText`, and `styles.switchStyle` — no new styles needed.

Note: This toggle lives inside the `{(context !== 'mushaf' || viewMode === 'list') && (...)}` block so it's visible in list mode and player context, which matches the translation toggle pattern. It should also be visible in mushaf mode since themes apply there too. Place it **outside** that conditional, right before the FONT section, so it always appears.

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 4: Format**

Run: `npx prettier --write components/MushafSettingsContent.tsx`

**Step 5: Commit**

```bash
git add components/MushafSettingsContent.tsx
git commit -m "feat(themes): add Thematic Highlighting toggle in settings UI"
```

---

### Task 4: Add theme zebra highlights in Skia mushaf mode

**Files:**
- Modify: `components/mushaf/skia/SkiaPage.tsx`

**Step 1: Import the theme service and subscribe to setting**

At the top of SkiaPage.tsx, add import:

```typescript
import {themeDataService} from '@/services/mushaf/ThemeDataService';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
```

Inside the component, subscribe to the toggle:

```typescript
const showThemes = useMushafSettingsStore(s => s.showThemes);
```

**Step 2: Add theme highlight layer (Layer 0)**

In the `lineBackgroundHighlightsMap` useMemo (around line 495), **before** the early return on line 505:

1. Update the early return to include themes check:
```typescript
if (!hasAnnotations && !hasPlayback && !selectedSet && !showThemes) return EMPTY_BG_MAP;
```

2. After the `addVerseHighlight` helper (line 529), before Layer 1, add:

```typescript
    // Layer 0: Theme zebra highlights (lowest priority — painted first)
    if (showThemes) {
      const verseKeys = mushafVerseMapService.getOrderedVerseKeysForPage(pageNumber);
      const themeBgEven = Color(textColor).alpha(0.04).toString();
      for (const vk of verseKeys) {
        // Skip if this verse will be painted by a higher layer
        if (persistentHighlights[vk]) continue;
        if (playbackVerseKey === vk) continue;
        if (selectedSet?.has(vk)) continue;

        const info = themeDataService.getThemeForVerse(vk);
        if (!info) continue;
        // Only paint even-indexed themes; odd themes stay transparent (zebra)
        if (info.themeIndex % 2 !== 0) continue;

        addVerseHighlight(vk, themeBgEven);
      }
    }
```

3. Add `showThemes` and `textColor` to the useMemo dependency array (around line 553).

**Step 3: Import Color if not already imported**

Check if `Color` is imported in SkiaPage.tsx. If not:
```typescript
import Color from 'color';
```

**Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 5: Format**

Run: `npx prettier --write components/mushaf/skia/SkiaPage.tsx`

**Step 6: Commit**

```bash
git add components/mushaf/skia/SkiaPage.tsx
git commit -m "feat(themes): add zebra theme highlights in Skia mushaf mode"
```

---

### Task 5: Add theme zebra highlights in Reading (list) mode

**Files:**
- Modify: `components/mushaf/reading/ReadingPageView.tsx`

**Step 1: Import theme service and Color**

```typescript
import {themeDataService} from '@/services/mushaf/ThemeDataService';
import Color from 'color';
```

**Step 2: Subscribe to the setting**

After the other `useMushafSettingsStore` subscriptions (around line 82):

```typescript
const showThemes = useMushafSettingsStore(s => s.showThemes);
```

**Step 3: Apply theme background to verse items**

In the `renderItem` callback (around line 166), wrap the `VerseItem` return with a conditional background:

```tsx
      const themeInfo = showThemes
        ? themeDataService.getThemeForVerse(item.verse.verse_key)
        : undefined;
      const themeBg =
        themeInfo && themeInfo.themeIndex % 2 === 0
          ? Color(textColor).alpha(0.04).toString()
          : undefined;

      return (
        <View
          key={item.verse.verse_key}
          style={themeBg ? {backgroundColor: themeBg, borderRadius: 6} : undefined}>
          <VerseItem
            // remove key from VerseItem since it's on the wrapper now
            verse={item.verse}
            onVersePress={handleVersePress}
            textColor={textColor}
            borderColor={borderColor}
            showTranslation={showTranslation}
            showTransliteration={showTransliteration}
            showTajweed={showTajweed}
            arabicFontFamily="Uthmani"
            transliterationFontSize={transliterationFontSize}
            translationFontSize={translationFontSize}
            arabicFontSize={arabicFontSize}
            fontMgr={fontMgr}
            dkFontFamily={dkFontFamily}
            indexedTajweedData={indexedTajweedData}
            source="mushaf"
            translationName={translationName}
            translationId={selectedTranslationId}
            showWBW={showWBW}
            wbwShowTranslation={wbwShowTranslation}
            wbwShowTransliteration={wbwShowTransliteration}
          />
        </View>
      );
```

Add `showThemes` and `textColor` to the `renderItem` useCallback dependency array.

**Step 4: Run type check**

Run: `npx tsc --noEmit`

**Step 5: Format**

Run: `npx prettier --write components/mushaf/reading/ReadingPageView.tsx`

**Step 6: Commit**

```bash
git add components/mushaf/reading/ReadingPageView.tsx
git commit -m "feat(themes): add zebra theme highlights in reading list mode"
```

---

### Task 6: Create ThemeContent component for verse actions sheet

**Files:**
- Create: `components/sheets/verse-actions/ThemeContent.tsx`

**Step 1: Create the component**

```tsx
// components/sheets/verse-actions/ThemeContent.tsx
import React, {useMemo} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {themeDataService} from '@/services/mushaf/ThemeDataService';
import {ScrollView} from 'react-native-actions-sheet';

interface ThemeContentProps {
  surahNumber: number;
  ayahNumber: number;
  onBack: () => void;
}

const surahData = require('@/data/surahData.json') as Array<{
  id: number;
  name: string;
}>;

export const ThemeContent: React.FC<ThemeContentProps> = ({
  surahNumber,
  ayahNumber,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const verseKey = `${surahNumber}:${ayahNumber}`;
  const themeInfo = themeDataService.getThemeForVerse(verseKey);

  if (!themeInfo) {
    return (
      <View style={styles.container}>
        <Text style={styles.noData}>No thematic data for this verse.</Text>
      </View>
    );
  }

  const surah = surahData.find((s: {id: number}) => s.id === themeInfo.surah);
  const surahName = surah?.name ?? `Surah ${themeInfo.surah}`;
  const rangeText =
    themeInfo.ayahFrom === themeInfo.ayahTo
      ? `${themeInfo.surah}:${themeInfo.ayahFrom}`
      : `${themeInfo.surah}:${themeInfo.ayahFrom} – ${themeInfo.surah}:${themeInfo.ayahTo}`;
  const verseCount = themeInfo.ayahTo - themeInfo.ayahFrom + 1;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}>
      {/* Theme name */}
      <Text style={styles.themeTitle}>{themeInfo.theme}</Text>

      {/* Passage info card */}
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Surah</Text>
          <Text style={styles.infoValue}>{surahName}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Passage</Text>
          <Text style={styles.infoValue}>{rangeText}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Verses</Text>
          <Text style={styles.infoValue}>
            {verseCount} {verseCount === 1 ? 'verse' : 'verses'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: moderateScale(4),
      paddingTop: moderateScale(8),
      paddingBottom: moderateScale(20),
    },
    themeTitle: {
      fontSize: moderateScale(17),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginBottom: verticalScale(16),
      lineHeight: moderateScale(24),
    },
    card: {
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      borderRadius: moderateScale(14),
      overflow: 'hidden',
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: verticalScale(12),
      paddingHorizontal: moderateScale(14),
    },
    infoLabel: {
      fontSize: moderateScale(13.5),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
    },
    infoValue: {
      fontSize: moderateScale(13.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.text).alpha(0.85).toString(),
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      marginHorizontal: moderateScale(14),
    },
    noData: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      textAlign: 'center',
      marginTop: verticalScale(20),
    },
  });
```

**Step 2: Commit**

```bash
git add components/sheets/verse-actions/ThemeContent.tsx
git commit -m "feat(themes): create ThemeContent component for verse actions"
```

---

### Task 7: Wire ThemeContent into VerseActionsSheet

**Files:**
- Modify: `components/sheets/VerseActionsSheet.tsx`

**Step 1: Import ThemeContent**

After the TafseerContent import (line 50):

```typescript
import {ThemeContent} from './verse-actions/ThemeContent';
```

**Step 2: Add 'theme' to ActiveScreen type**

On line 56, update:

```typescript
type ActiveScreen =
  | 'highlight'
  | 'note'
  | 'share'
  | 'similar'
  | 'phrases'
  | 'translation'
  | 'tafseer'
  | 'theme'
  | null;
```

**Step 3: Add screen title**

In `SCREEN_TITLES` (line 66), add:

```typescript
  theme: 'Theme',
```

**Step 4: Add handler**

After `handleTafseer` (around line 235):

```typescript
  const handleTheme = useCallback(() => {
    setActiveScreen('theme');
  }, []);
```

**Step 5: Update isFullScreen check**

On line 466-467, update:

```typescript
  const isFullScreen =
    activeScreen === 'translation' || activeScreen === 'tafseer' || activeScreen === 'theme';
```

**Step 6: Add ThemeContent rendering**

After the TafseerContent block (around line 517), add:

```tsx
                {activeScreen === 'theme' && (
                  <ThemeContent
                    surahNumber={surahNumber}
                    ayahNumber={ayahNumber}
                    onBack={handleBack}
                  />
                )}
```

**Step 7: Add Theme action button in EXPLORE card**

After the Tafseer pressable (around line 691, before the `{hasSimilarVerses` check), add:

```tsx
              {!isRange ? (
                <>
                  <View style={styles.divider} />
                  <Pressable
                    style={({pressed}) => [
                      styles.option,
                      pressed && styles.optionPressed,
                    ]}
                    onPress={handleTheme}>
                    <Feather
                      name="layers"
                      size={moderateScale(18)}
                      color={theme.colors.text}
                    />
                    <Text style={styles.optionText}>Theme</Text>
                  </Pressable>
                </>
              ) : null}
```

Note: Using Feather "layers" icon since it represents grouped/layered content. This is always visible (not gated behind `showThemes`) so users can discover what theme a verse belongs to.

**Step 8: Run type check**

Run: `npx tsc --noEmit`

**Step 9: Format**

Run: `npx prettier --write components/sheets/VerseActionsSheet.tsx`

**Step 10: Commit**

```bash
git add components/sheets/VerseActionsSheet.tsx
git commit -m "feat(themes): wire Theme option into verse actions sheet"
```

---

### Task 8: Initialize ThemeDataService in AppInitializer

**Files:**
- Modify: `services/AppInitializer.ts`

**Step 1: Import and register**

Add import:
```typescript
import {themeDataService} from './mushaf/ThemeDataService';
```

Register as a non-critical service at a suitable priority (after mushaf services). In the initialization list, add:

```typescript
{
  name: 'ThemeDataService',
  priority: 9,
  critical: false,
  init: () => themeDataService.init(),
},
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add services/AppInitializer.ts
git commit -m "feat(themes): register ThemeDataService in AppInitializer"
```

---

### Task 9: Final verification and formatting

**Step 1: Run type check on full project**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 2: Run Prettier on all modified files**

```bash
npx prettier --write \
  services/mushaf/ThemeDataService.ts \
  store/mushafSettingsStore.ts \
  components/MushafSettingsContent.tsx \
  components/mushaf/skia/SkiaPage.tsx \
  components/mushaf/reading/ReadingPageView.tsx \
  components/sheets/verse-actions/ThemeContent.tsx \
  components/sheets/VerseActionsSheet.tsx \
  services/AppInitializer.ts
```

**Step 3: Lint**

Run: `npm run lint`
Expected: No new lint errors

**Step 4: Manual test checklist**

- [ ] Open mushaf settings → "Thematic Highlighting" toggle appears
- [ ] Toggle ON → alternating subtle highlights visible on mushaf pages (Skia mode)
- [ ] Switch to list mode → alternating background on verse items
- [ ] Toggle OFF → highlights disappear
- [ ] Tap a verse → verse actions sheet → "Theme" option visible
- [ ] Tap "Theme" → shows theme name, passage range, verse count
- [ ] Existing highlights, playback, and selection override theme highlights
- [ ] App starts correctly (ThemeDataService initializes)
