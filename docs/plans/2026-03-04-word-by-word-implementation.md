> **SHIPPED — This feature is implemented.** Implementation reference plan; the feature shipped. See `WBWDataService`, `WBWVerseView`, and `mushafSettingsStore`.

# Word-by-Word Translation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add inline word-by-word translation to scroll mode, with configurable per-word translation/transliteration, subtle underlines, and a long-press word detail sheet.

**Architecture:** New `WBWDataService` singleton loads word data from bundled SQLite (`wbw-en.db`). A new `WBWVerseView` component renders the RTL flex-wrap word grid, replacing the Arabic text block in `VerseItem` when WBW is enabled. Settings stored in existing `mushafSettingsStore`. Long-press opens a new `WordDetailSheet` bottom sheet.

**Tech Stack:** expo-sqlite, Zustand, react-native-actions-sheet, expo-audio (for per-word playback)

**Design doc:** `docs/plans/2026-03-04-word-by-word-translation-design.md`

**IMPORTANT:** Use `frontend-design` skill for all UI/styling decisions. Follow the app's alpha-based design system from CLAUDE.md.

---

### Task 1: Add WBW State to mushafSettingsStore

**Files:**

- Modify: `store/mushafSettingsStore.ts`

**Step 1: Add WBW fields to the interface**

Add to `MushafSettingsState` interface (after line 37, below `showTajweed`):

```typescript
// Word-by-word settings
showWBW: boolean;
wbwShowTranslation: boolean;
wbwShowTransliteration: boolean;
```

Add actions (after line 66, below `toggleTajweed`):

```typescript
toggleWBW: () => void;
toggleWBWTranslation: () => void;
toggleWBWTransliteration: () => void;
```

**Step 2: Add defaults and action implementations**

In the `persist` create block (after line 88, below `showTajweed: false`):

```typescript
showWBW: false,
wbwShowTranslation: true,
wbwShowTransliteration: false,
```

Actions (after line 105, below `toggleTajweed`):

```typescript
toggleWBW: () => set(state => ({ showWBW: !state.showWBW })),
toggleWBWTranslation: () => set(state => ({ wbwShowTranslation: !state.wbwShowTranslation })),
toggleWBWTransliteration: () => set(state => ({ wbwShowTransliteration: !state.wbwShowTransliteration })),
```

**Step 3: Bump store version and add migration**

Change `version: 7` to `version: 8`. Add migration case after the `version < 7` block:

```typescript
if (version < 8) {
  state.showWBW = false;
  state.wbwShowTranslation = true;
  state.wbwShowTransliteration = false;
}
```

**Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 5: Commit**

```
feat(store): add word-by-word settings to mushafSettingsStore
```

---

### Task 2: Create WBWDataService

**Files:**

- Create: `services/wbw/WBWDataService.ts`

**Step 1: Create the service**

```typescript
import * as SQLite from 'expo-sqlite';

export interface WBWWord {
  position: number;
  translation: string;
  transliteration: string;
  audioUrl: string;
}

class WBWDataService {
  private db: SQLite.SQLiteDatabase | null = null;
  private cache: Map<string, WBWWord[]> = new Map();
  private _initialized = false;
  private _initializing: Promise<void> | null = null;

  get initialized(): boolean {
    return this._initialized;
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;
    if (this._initializing) return this._initializing;
    this._initializing = this._doInit();
    return this._initializing;
  }

  private async _doInit(): Promise<void> {
    try {
      const dbName = 'wbw-en.db';
      let db = await SQLite.openDatabaseAsync(dbName);

      const tableCheck = await db
        .getFirstAsync<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='words';",
        )
        .catch(() => null);

      if (!tableCheck) {
        await db.closeAsync();
        await SQLite.deleteDatabaseAsync(dbName);
        await SQLite.importDatabaseFromAssetAsync(dbName, {
          assetId: require('../../data/wbw/wbw-en.db'),
        });
        db = await SQLite.openDatabaseAsync(dbName);
      }

      this.db = db;
      this._initialized = true;
      console.log('[WBWDataService] Initialized');
    } catch (error) {
      console.error('[WBWDataService] Initialization failed:', error);
      this._initializing = null;
      throw error;
    }
  }

  async getVerseWords(verseKey: string): Promise<WBWWord[]> {
    const cached = this.cache.get(verseKey);
    if (cached) return cached;

    if (!this.db) return [];

    const rows = await this.db.getAllAsync<{
      position: number;
      translation: string;
      transliteration: string;
      audio_url: string;
    }>(
      'SELECT position, translation, transliteration, audio_url FROM words WHERE verse_key = ? ORDER BY position',
      [verseKey],
    );

    const words: WBWWord[] = rows.map(row => ({
      position: row.position,
      translation: row.translation,
      transliteration: row.transliteration,
      audioUrl: row.audio_url,
    }));

    this.cache.set(verseKey, words);
    return words;
  }
}

export const wbwDataService = new WBWDataService();
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```
feat(wbw): create WBWDataService for word-by-word SQLite lookups
```

---

### Task 3: Register WBWDataService in AppInitializer

**Files:**

- Modify: `services/AppInitializer.ts`

**Step 1: Add import**

Add after the tafseerDbService import (line 9):

```typescript
import {wbwDataService} from '@/services/wbw/WBWDataService';
```

**Step 2: Register service**

Add after the Tafseer DB registration block (after line 390):

```typescript
/**
 * WBW Data Service (Priority 10)
 * Opens wbw-en.db for word-by-word translations.
 * Non-critical — WBW features degrade gracefully without it.
 */
appInitializer.registerService({
  name: 'WBW Data',
  priority: 10,
  critical: false,
  initialize: async () => {
    await wbwDataService.initialize();
  },
});
```

**Step 3: Commit**

```
feat(wbw): register WBWDataService in AppInitializer
```

---

### Task 4: Create WBWVerseView Component

**Files:**

- Create: `components/player/v2/PlayerContent/QuranView/WBWVerseView.tsx`

**IMPORTANT:** Invoke `frontend-design` skill before writing this component. Follow the alpha-based design system.

This is the core visual component — the RTL flex-wrap grid of word units.

**Key requirements:**

- `flexDirection: 'row-reverse'` + `flexWrap: 'wrap'` for RTL flow
- Each word unit: Arabic (top) → subtle hairline → transliteration (optional) → translation (optional)
- Subtle line under each Arabic word: `Color(theme.colors.text).alpha(0.06)`, `StyleSheet.hairlineWidth`
- No backgrounds or borders on individual word units — spacing creates grouping
- Arabic: same font as current Mushaf settings (DK font family, user's arabicFontSize)
- Translation: `Manrope-Regular`, `ms(11)`, `Color(theme.colors.text).alpha(0.7)`
- Transliteration: `Manrope-Regular`, `ms(10.5)`, `Color(theme.colors.textSecondary).alpha(0.5)`, italic
- Word units centered-aligned internally, with consistent padding/gap
- `onWordLongPress(position)` callback for opening detail sheet
- Each word unit is a `Pressable` with `onLongPress`

**Props interface:**

```typescript
interface WBWVerseViewProps {
  verseKey: string;
  textColor: string;
  arabicFontSize: number;
  dkFontFamily: string;
  showTranslation: boolean;
  showTransliteration: boolean;
  onWordLongPress: (position: number) => void;
}
```

**Data loading pattern:**

- Use `useState` + `useEffect` to call `wbwDataService.getVerseWords(verseKey)`
- Match WBW positions to `digitalKhattDataService.getVerseWords(verseKey)` for Arabic text
- Render each word as a vertical stack

**Step 1: Write the component**

Use `frontend-design` skill for exact styling decisions. The component should:

- Map DKWordInfo + WBWWord arrays by matching `wordPositionInVerse === position`
- Filter out verse end markers (DK words without matching WBW position)
- Render with `flexDirection: 'row-reverse'`, `flexWrap: 'wrap'`, `gap: moderateScale(16)`
- Each word unit: `alignItems: 'center'`, `marginBottom: verticalScale(12)`
- Haptic feedback on long press via `mediumHaptics()`

**Step 2: Run type check**

**Step 3: Commit**

```
feat(wbw): create WBWVerseView component with RTL flex-wrap grid
```

---

### Task 5: Add WBW Card to MushafSettingsContent

**Files:**

- Modify: `components/MushafSettingsContent.tsx`

**IMPORTANT:** Invoke `frontend-design` skill. Match the exact card/switch pattern used by existing Transliteration card (lines 644-670).

**Step 1: Add store subscriptions**

Add `showWBW`, `wbwShowTranslation`, `wbwShowTransliteration`, `toggleWBW`, `toggleWBWTranslation`, `toggleWBWTransliteration` to the destructured `useMushafSettingsStore()` call at line 397.

**Step 2: Add WBW settings card**

Insert ABOVE the Transliteration card (before line 644), inside the `(context !== 'mushaf' || viewMode === 'reading')` conditional:

```tsx
<View style={styles.card}>
  <View style={styles.optionRow}>
    <Text style={styles.optionLabel}>Word by Word</Text>
    <Switch
      trackColor={trackColor}
      thumbColor="#FFFFFF"
      ios_backgroundColor={trackColor.false}
      onValueChange={toggleWBW}
      value={showWBW}
      style={styles.switchStyle}
    />
  </View>
  <Text style={styles.helperText}>
    Inline word translations under each Arabic word
  </Text>
  {showWBW && (
    <>
      <View style={styles.divider} />
      {/* Sub-toggle: Translation */}
      <Pressable
        style={({pressed}) => [styles.optionRow, pressed && styles.pressed]}
        onPress={toggleWBWTranslation}>
        <Text style={styles.optionLabel}>Translation</Text>
        <View style={[styles.checkbox, wbwShowTranslation && styles.checkboxActive]}>
          {wbwShowTranslation && (
            <Feather name="check" size={moderateScale(12)} color={theme.colors.background} />
          )}
        </View>
      </Pressable>
      <View style={styles.divider} />
      {/* Sub-toggle: Transliteration */}
      <Pressable
        style={({pressed}) => [styles.optionRow, pressed && styles.pressed]}
        onPress={toggleWBWTransliteration}>
        <Text style={styles.optionLabel}>Transliteration</Text>
        <View style={[styles.checkbox, wbwShowTransliteration && styles.checkboxActive]}>
          {wbwShowTransliteration && (
            <Feather name="check" size={moderateScale(12)} color={theme.colors.background} />
          )}
        </View>
      </Pressable>
    </>
  )}
</View>
```

**Step 3: Add checkbox styles**

Add to `createStyles` — use `frontend-design` for exact tokens:

```typescript
checkbox: {
  width: moderateScale(20),
  height: moderateScale(20),
  borderRadius: moderateScale(4),
  borderWidth: 1.5,
  borderColor: Color(theme.colors.text).alpha(0.2).toString(),
  alignItems: 'center',
  justifyContent: 'center',
},
checkboxActive: {
  backgroundColor: theme.colors.text,
  borderColor: theme.colors.text,
},
pressed: {
  backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
},
```

**Step 4: Format and type check**

Run: `npx prettier --write components/MushafSettingsContent.tsx && npx tsc --noEmit`

**Step 5: Commit**

```
feat(wbw): add Word by Word settings card with sub-toggles
```

---

### Task 6: Integrate WBW into VerseItem

**Files:**

- Modify: `components/player/v2/PlayerContent/QuranView/VerseItem.tsx`

**Step 1: Add WBW props to VerseItemProps**

Add to the interface (after line 77):

```typescript
showWBW?: boolean;
wbwShowTranslation?: boolean;
wbwShowTransliteration?: boolean;
```

Add to destructured props in the component.

**Step 2: Conditionally render WBWVerseView**

Replace the Arabic text rendering block (lines 384-405). When `showWBW` is true, render `WBWVerseView` instead of the Skia/QPC/fallback block:

```tsx
{showWBW ? (
  <WBWVerseView
    verseKey={verseKey}
    textColor={textColor}
    arabicFontSize={arabicFontSize}
    dkFontFamily={dkFontFamily}
    showTranslation={wbwShowTranslation ?? true}
    showTransliteration={wbwShowTransliteration ?? false}
    onWordLongPress={handleWordLongPress}
  />
) : (
  <View onLayout={handleArabicLayout}>
    {/* existing Skia/QPC/fallback rendering unchanged */}
  </View>
)}
```

**Step 3: Add handleWordLongPress callback**

```typescript
const handleWordLongPress = useCallback(
  (position: number) => {
    mediumHaptics();
    SheetManager.show('word-detail', {
      payload: { verseKey, position },
    });
  },
  [verseKey],
);
```

**Step 4: Format and type check**

**Step 5: Commit**

```
feat(wbw): integrate WBWVerseView into VerseItem with conditional rendering
```

---

### Task 7: Wire WBW Props Through QuranView

**Files:**

- Modify: `components/player/v2/PlayerContent/QuranView/index.tsx`

**Step 1: Add store subscriptions**

Add after the `showTajweed` selector (line 110):

```typescript
const showWBW = useMushafSettingsStore(s => s.showWBW);
const wbwShowTranslation = useMushafSettingsStore(s => s.wbwShowTranslation);
const wbwShowTransliteration = useMushafSettingsStore(s => s.wbwShowTransliteration);
```

**Step 2: Pass props to VerseItem**

Add to the `<VerseItem>` JSX in `renderItem` (after `translationId` prop, around line 200):

```tsx
showWBW={showWBW}
wbwShowTranslation={wbwShowTranslation}
wbwShowTransliteration={wbwShowTransliteration}
```

Add the three variables to the `renderItem` dependency array.

**Step 3: Format and type check**

**Step 4: Commit**

```
feat(wbw): wire WBW store state through QuranView to VerseItem
```

---

### Task 8: Create WordDetailSheet

**Files:**

- Create: `components/sheets/WordDetailSheet.tsx`
- Modify: `components/sheets/sheets.tsx`

**IMPORTANT:** Invoke `frontend-design` skill. Follow existing sheet patterns (see `SimilarVersesSheet.tsx` or `VerseActionsSheet.tsx` for reference).

**Step 1: Create the sheet component**

The sheet receives `{ verseKey, position }` as payload. It should:

- Look up word data from `wbwDataService.getVerseWords(verseKey)` — find by position
- Look up Arabic text from `digitalKhattDataService.getVerseWords(verseKey)` — find by `wordPositionInVerse`
- Display: large Arabic word (centered), transliteration, translation
- Play button that loads audio from `https://audio.qurancdn.com/${audioUrl}`
- Footer: "Verse X:Y · Word N of M"
- Use `ActionSheet` from `react-native-actions-sheet` as the container
- Style: alpha-based design system, centered layout

**Audio playback:** Use `createAudioPlayer` from `expo-audio` for the word audio. Create a player on mount, clean up on unmount. Play button toggles play/pause.

**Step 2: Register sheet in sheets.tsx**

Add import:

```typescript
import {WordDetailSheet} from './WordDetailSheet';
```

Add registration:

```typescript
registerSheet('word-detail', WordDetailSheet);
```

Add type definition:

```typescript
'word-detail': SheetDefinition<{
  payload: {
    verseKey: string;
    position: number;
  };
}>;
```

**Step 3: Format and type check**

**Step 4: Commit**

```
feat(wbw): create WordDetailSheet with audio playback
```

---

### Task 9: Final Integration Testing and Polish

**Step 1: Test the full flow**

- Open app in scroll/reading mode
- Open Mushaf Settings → verify WBW card appears in PLAYER VIEW
- Toggle WBW ON → verify word grid renders RTL with subtle lines
- Toggle sub-options (translation, transliteration) → verify they show/hide per-word
- Long-press a word → verify detail sheet opens with correct data
- Test Play button in detail sheet → verify audio plays
- Toggle WBW OFF → verify normal Arabic text block returns
- Verify existing Translation/Transliteration blocks still work independently below

**Step 2: Run prettier on all modified files**

```bash
npx prettier --write store/mushafSettingsStore.ts services/wbw/WBWDataService.ts services/AppInitializer.ts components/MushafSettingsContent.tsx components/player/v2/PlayerContent/QuranView/VerseItem.tsx components/player/v2/PlayerContent/QuranView/index.tsx components/player/v2/PlayerContent/QuranView/WBWVerseView.tsx components/sheets/WordDetailSheet.tsx components/sheets/sheets.tsx
```

**Step 3: Run type check**

```bash
npx tsc --noEmit
```

**Step 4: Final commit**

```
feat(wbw): word-by-word translation integration complete
```

