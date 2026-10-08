import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getReadingThemeById} from '@/constants/readingThemes';
import {
  migratePersistedId,
  type RewayahId,
} from '@/services/rewayah/RewayahIdentity';

// Re-exported for backward compat with existing imports across the app.
// RewayahIdentity is the canonical source; do not redefine the union here.
export type {RewayahId};

// Constants for font sizing
export const DISPLAY_MIN = 1;
export const DISPLAY_MAX = 10;
export const ACTUAL_MIN_FONT_SIZE = 10;
export const ACTUAL_FONT_STEP = 4;

// Calculate actual font size from display value (1-10)
export const getActualFontSize = (displayValue: number): number => {
  return ACTUAL_MIN_FONT_SIZE + (displayValue - 1) * ACTUAL_FONT_STEP;
};

// Calculate display value (1-10) from actual font size
export const getDisplayValue = (actualFontSize: number): number => {
  return Math.round(
    1 + (actualFontSize - ACTUAL_MIN_FONT_SIZE) / ACTUAL_FONT_STEP,
  );
};

export type MushafRenderer = 'dk_v1' | 'dk_v2' | 'dk_indopak' | 'qcf_v2';

// @ai-start
// Renderer gating for non-Hafs rewayat.
//
// Mushaf 1440 (qcf_v2) draws Hafs glyph pages only, so it pins the rewayah to
// Hafs: it can be chosen only while Hafs is shown, and no other rewayah can
// be set under it (setMushafRenderer / setRewayah / persist v16 below).
// IndoPak is the opposite case: its font lacks marks every non-Hafs rewayah
// needs (the wasl dot U+06EC, the small waw U+06E5, U+06D7, U+06E0, U+06E7,
// ...), so about one word in seven would come from a fallback font. Here the
// rewayah wins: choosing a non-Hafs rewayah while IndoPak is selected moves
// the renderer to a Madani DigitalKhatt font, and IndoPak cannot be chosen
// while a non-Hafs rewayah is active.
export const REWAYAH_FALLBACK_RENDERER: MushafRenderer = 'dk_v2';
/** User-facing name of REWAYAH_FALLBACK_RENDERER (matches the font picker). */
export const REWAYAH_FALLBACK_RENDERER_LABEL = 'Madani 1421';

/** Whether `renderer` can draw `rewayah` text without fallback glyphs. */
export function isRendererCompatibleWithRewayah(
  renderer: MushafRenderer,
  rewayah: RewayahId,
): boolean {
  return rewayah === 'hafs' || renderer === 'dk_v1' || renderer === 'dk_v2';
}

/**
 * Whether `renderer` pins the rewayah to Hafs (Mushaf 1440 draws Hafs glyph
 * pages only): the store then names Hafs, and the DigitalKhatt data service
 * must serve Hafs too.
 */
export function rendererPinsHafs(renderer: MushafRenderer): boolean {
  return renderer === 'qcf_v2';
}

export type DkFontFamily =
  | 'DigitalKhattV1'
  | 'DigitalKhattV2'
  | 'DigitalKhattIndoPak';

/**
 * Skia font family for drawing `rewayah` text under the user's renderer.
 * Surfaces that can show a rewayah other than the active mushaf one (a
 * reciter's rewayah in the player, a bookmark saved in another rewayah) must
 * use this rather than mapping the renderer directly: IndoPak draws Hafs only.
 * qcf_v2 has no DigitalKhatt face of its own, so it maps to Madani 1421 as
 * before.
 */
export function getDkFontFamily(
  renderer: MushafRenderer,
  rewayah: RewayahId,
): DkFontFamily {
  if (renderer === 'dk_v1') return 'DigitalKhattV1';
  if (renderer === 'dk_indopak' && rewayah === 'hafs') {
    return 'DigitalKhattIndoPak';
  }
  return 'DigitalKhattV2';
}

const uthmaniFontForRenderer = (renderer: MushafRenderer): 'v1' | 'v2' =>
  renderer === 'dk_v1' ? 'v1' : 'v2';
// @ai-end

export type MushafPageLayout = 'fullscreen' | 'book';
export type MushafViewMode = 'mushaf' | 'list';
export type MushafScrollDirection = 'horizontal' | 'vertical';
export type MushafArabicTextWeight = 'normal' | 'medium' | 'bold';
export type MushafAllahNameHighlightColor =
  | 'gold'
  | 'emerald'
  | 'blue'
  | 'rose';
export interface RecentRead {
  surahId: number;
  page: number;
  timestamp: number;
}

interface MushafSettingsState {
  // Display settings
  showTranslation: boolean;
  showTransliteration: boolean;
  showTajweed: boolean;
  showThemes: boolean;

  // RFC-018 — inline community reflections under each ayah. Opt-in,
  // default off. The toggle row only renders when a fork supplies
  // `branding.communityReflectionsProvider`; inert for Bayaan.
  showCommunityReflections: boolean;

  // Word-by-word settings
  showWBW: boolean;
  wbwShowTranslation: boolean;
  wbwShowTransliteration: boolean;

  // Mushaf page layout
  pageLayout: MushafPageLayout;

  // Font sizes (actual values in points)
  arabicFontSize: number;
  translationFontSize: number;
  transliterationFontSize: number;
  arabicTextWeight: MushafArabicTextWeight;
  showAllahNameHighlight: boolean;
  allahNameHighlightColor: MushafAllahNameHighlightColor;

  // Font family (legacy — kept for backward compatibility)
  arabicFontFamily: 'Uthmani';
  uthmaniFont: 'v1' | 'v2';

  // Mushaf renderer selection
  mushafRenderer: MushafRenderer;

  // View mode (mushaf pages vs list view)
  viewMode: MushafViewMode;

  // Scroll direction (horizontal paging vs vertical continuous scroll)
  scrollDirection: MushafScrollDirection;

  // Recently read positions (last 10, chain-based — not deduplicated by surahId)
  recentPages: RecentRead[];

  // Active translation (bundled or downloaded remote)
  selectedTranslationId: string;

  // Reading theme (mushaf-only, does not affect global app theme)
  lightThemeId: string;
  darkThemeId: string;

  // Rewayah (qiraat transmission) selection
  rewayah: RewayahId;
  showRewayahDiffs: boolean;
  // @ai-start
  /**
   * The saved rewayah that could not be loaded at startup while Hafs is shown
   * in its place (DigitalKhattDataService's startup fallback), else null.
   * `rewayah` always names the text on screen, so it is 'hafs' meanwhile.
   * Never persisted; while it is set, this saved rewayah (not the Hafs shown)
   * is what gets persisted, so the next launch tries it again.
   */
  rewayahFallbackFrom: RewayahId | null;
  // @ai-end

  // Actions
  toggleTranslation: () => void;
  toggleTransliteration: () => void;
  toggleTajweed: () => void;
  toggleThemes: () => void;
  toggleCommunityReflections: () => void;
  toggleWBW: () => void;
  toggleWBWTranslation: () => void;
  toggleWBWTransliteration: () => void;
  toggleAllahNameHighlight: () => void;
  setArabicFontSize: (size: number) => void;
  setTranslationFontSize: (size: number) => void;
  setTransliterationFontSize: (size: number) => void;
  setArabicTextWeight: (weight: MushafArabicTextWeight) => void;
  setAllahNameHighlightColor: (color: MushafAllahNameHighlightColor) => void;
  setArabicFontFamily: (font: 'Uthmani') => void;
  setUthmaniFont: (font: 'v1' | 'v2') => void;
  setMushafRenderer: (renderer: MushafRenderer) => void;
  setPageLayout: (layout: MushafPageLayout) => void;
  setViewMode: (mode: MushafViewMode) => void;
  setScrollDirection: (direction: MushafScrollDirection) => void;
  updateActiveChain: (surahId: number, page: number) => void;
  startNewChain: (surahId: number, page: number) => void;
  resumeChain: (index: number) => void;
  clearRecentPages: () => void;
  setSelectedTranslationId: (id: string) => void;
  setReadingTheme: (themeId: string) => void;
  setRewayah: (rewayah: RewayahId) => void;
  toggleRewayahDiffs: () => void;
  // @ai-start
  /** Records that the saved rewayah `from` failed to load and Hafs is shown. */
  startRewayahFallback: (from: RewayahId) => void;
  /** Ends a startup fallback, making Hafs the saved rewayah. */
  clearRewayahFallback: () => void;
  // @ai-end
}

export const useMushafSettingsStore = create<MushafSettingsState>()(
  persist(
    set => ({
      // Default values
      showTranslation: true,
      showTransliteration: false,
      showTajweed: false,
      showThemes: false,
      showCommunityReflections: false,
      showWBW: false,
      wbwShowTranslation: true,
      wbwShowTransliteration: false,
      arabicFontSize: getActualFontSize(5), // Default: middle of scale
      translationFontSize: getActualFontSize(3),
      transliterationFontSize: getActualFontSize(3),
      arabicTextWeight: 'normal' as MushafArabicTextWeight,
      showAllahNameHighlight: false,
      allahNameHighlightColor: 'gold' as MushafAllahNameHighlightColor,
      arabicFontFamily: 'Uthmani', // Default font
      uthmaniFont: 'v1', // Default to V1
      mushafRenderer: 'dk_v1' as MushafRenderer, // Default to DK V1 (Madani 1405)
      viewMode: 'mushaf' as MushafViewMode,
      scrollDirection: 'horizontal' as MushafScrollDirection,
      pageLayout: 'book' as MushafPageLayout, // Default to book page view
      recentPages: [],
      selectedTranslationId: 'saheeh',
      lightThemeId: 'default',
      darkThemeId: 'dark-default',
      rewayah: 'hafs' as RewayahId,
      showRewayahDiffs: true,
      rewayahFallbackFrom: null, // @ai

      // Actions
      toggleTranslation: () =>
        set(state => ({showTranslation: !state.showTranslation})),
      toggleTransliteration: () =>
        set(state => ({showTransliteration: !state.showTransliteration})),
      toggleTajweed: () =>
        set(state =>
          state.mushafRenderer === 'qcf_v2'
            ? state
            : {showTajweed: !state.showTajweed},
        ),
      toggleThemes: () => set(state => ({showThemes: !state.showThemes})),
      toggleCommunityReflections: () =>
        set(state => ({
          showCommunityReflections: !state.showCommunityReflections,
        })),
      toggleWBW: () => set(state => ({showWBW: !state.showWBW})),
      toggleWBWTranslation: () =>
        set(state => ({wbwShowTranslation: !state.wbwShowTranslation})),
      toggleWBWTransliteration: () =>
        set(state => ({wbwShowTransliteration: !state.wbwShowTransliteration})),
      toggleAllahNameHighlight: () =>
        set(state => ({showAllahNameHighlight: !state.showAllahNameHighlight})),
      setArabicFontSize: (size: number) => set({arabicFontSize: size}),
      setTranslationFontSize: (size: number) =>
        set({translationFontSize: size}),
      setTransliterationFontSize: (size: number) =>
        set({transliterationFontSize: size}),
      setArabicTextWeight: (weight: MushafArabicTextWeight) =>
        set({arabicTextWeight: weight}),
      setAllahNameHighlightColor: (color: MushafAllahNameHighlightColor) =>
        set({allahNameHighlightColor: color}),
      setArabicFontFamily: (font: 'Uthmani') => set({arabicFontFamily: font}),
      setUthmaniFont: (font: 'v1' | 'v2') => set({uthmaniFont: font}),
      // @ai-start
      setMushafRenderer: (renderer: MushafRenderer) =>
        set(state => {
          // IndoPak cannot draw non-Hafs text and Mushaf 1440 shows Hafs
          // only, and the rewayah is never changed from here: the DigitalKhatt
          // data service would keep the old rewayah's words under a Hafs
          // label. The settings UI disables IndoPak and switches the service
          // to Hafs before choosing Mushaf 1440 (selectMushafRenderer); this
          // keeps the pair valid for any other caller.
          if (
            (renderer === 'dk_indopak' || rendererPinsHafs(renderer)) &&
            state.rewayah !== 'hafs'
          ) {
            return state;
          }
          return {
            mushafRenderer: renderer,
            arabicFontFamily: 'Uthmani',
            showTajweed: renderer === 'qcf_v2' ? false : state.showTajweed,
            showRewayahDiffs:
              renderer === 'qcf_v2' ? false : state.showRewayahDiffs,
            uthmaniFont: uthmaniFontForRenderer(renderer),
            // A font that cannot draw the saved rewayah (IndoPak, Mushaf
            // 1440) ends a startup fallback: Hafs becomes the saved choice,
            // so the persisted pair stays valid.
            rewayahFallbackFrom:
              state.rewayahFallbackFrom &&
              isRendererCompatibleWithRewayah(
                renderer,
                state.rewayahFallbackFrom,
              )
                ? state.rewayahFallbackFrom
                : null,
          };
        }),
      // @ai-end
      setPageLayout: (layout: MushafPageLayout) => set({pageLayout: layout}),
      setViewMode: (mode: MushafViewMode) => set({viewMode: mode}),
      setScrollDirection: (direction: MushafScrollDirection) =>
        set({scrollDirection: direction}),
      updateActiveChain: (surahId: number, page: number) =>
        set(state => {
          const updated = [...state.recentPages];
          if (updated.length === 0) {
            updated.push({surahId, page, timestamp: Date.now()});
          } else {
            updated[0] = {surahId, page, timestamp: Date.now()};
          }
          return {recentPages: updated};
        }),
      startNewChain: (surahId: number, page: number) =>
        set(state => ({
          recentPages: [
            {surahId, page, timestamp: Date.now()},
            ...state.recentPages,
          ].slice(0, 10),
        })),
      resumeChain: (index: number) =>
        set(state => {
          if (index <= 0 || index >= state.recentPages.length) return state;
          const updated = [...state.recentPages];
          const [entry] = updated.splice(index, 1);
          updated.unshift({...entry, timestamp: Date.now()});
          return {recentPages: updated};
        }),
      clearRecentPages: () => set({recentPages: []}),
      setSelectedTranslationId: (id: string) =>
        set({selectedTranslationId: id}),
      setReadingTheme: (themeId: string) =>
        set(state => {
          const rt = getReadingThemeById(themeId);
          if (!rt) return state;
          return rt.mode === 'light'
            ? {lightThemeId: themeId}
            : {darkThemeId: themeId};
        }),
      // @ai-start
      setRewayah: (rewayah: RewayahId) =>
        set(state => {
          if (rendererPinsHafs(state.mushafRenderer)) return state;
          // Showing a non-Hafs rewayah ends a startup fallback (the text on
          // screen is a rewayah the reader chose again); showing Hafs is
          // what the fallback itself does, so it leaves it in place.
          const fallback =
            rewayah === 'hafs' ? {} : {rewayahFallbackFrom: null};
          // Callers switch the DigitalKhatt data service before writing the
          // store, so the rewayah is always accepted here and the renderer
          // follows it (see REWAYAH_FALLBACK_RENDERER).
          if (!isRendererCompatibleWithRewayah(state.mushafRenderer, rewayah)) {
            return {
              rewayah,
              mushafRenderer: REWAYAH_FALLBACK_RENDERER,
              uthmaniFont: uthmaniFontForRenderer(REWAYAH_FALLBACK_RENDERER),
              ...fallback,
            };
          }
          return {rewayah, ...fallback};
        }),
      // @ai-end
      toggleRewayahDiffs: () =>
        set(state =>
          state.mushafRenderer === 'qcf_v2'
            ? state
            : {showRewayahDiffs: !state.showRewayahDiffs},
        ),
      // @ai-start
      startRewayahFallback: (from: RewayahId) =>
        set(state =>
          // Mushaf 1440 pins Hafs, and a Hafs failure has nothing to fall
          // back to, so neither is ever a fallback.
          from === 'hafs' || state.mushafRenderer === 'qcf_v2'
            ? state
            : {rewayahFallbackFrom: from},
        ),
      clearRewayahFallback: () => set({rewayahFallbackFrom: null}),
      // @ai-end
    }),
    {
      name: 'mushaf-settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 18, // @ai
      // @ai-start
      // A startup fallback lasts one session: persist the reader's saved
      // rewayah rather than the Hafs shown in its place, and never the
      // fallback marker itself.
      partialize: state => {
        const {rewayahFallbackFrom, ...persisted} = state;
        return rewayahFallbackFrom
          ? {...persisted, rewayah: rewayahFallbackFrom}
          : persisted;
      },
      // @ai-end
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        if (version === 0) {
          // Migrate 'QPC' -> 'Uthmani'
          if (state.arabicFontFamily === 'QPC') {
            state.arabicFontFamily = 'Uthmani';
          }
        }
        if (version < 2) {
          state.uthmaniFont = 'v2';
        }
        if (version < 3) {
          // Derive mushafRenderer from legacy fields
          if (state.uthmaniFont === 'v1') {
            state.mushafRenderer = 'dk_v1';
          } else {
            state.mushafRenderer = 'dk_v2';
          }
          // Migrate any old Indopak users to Uthmani
          if (state.arabicFontFamily === 'Indopak') {
            state.arabicFontFamily = 'Uthmani';
          }
        }
        if (version < 4) {
          state.recentPages = [];
        }
        if (version < 5) {
          // lastScreenWasMushaf & lastReadPage moved to MMKV — drop stale keys
          delete state.lastScreenWasMushaf;
          delete state.lastReadPage;
        }
        if (version < 6) {
          state.selectedTranslationId = 'saheeh';
        }
        if (version < 7) {
          state.viewMode = 'mushaf';
        }
        if (version < 8) {
          state.showWBW = false;
          state.wbwShowTranslation = true;
          state.wbwShowTransliteration = false;
        }
        if (version < 9) {
          // Migrate viewMode: 'reading' → 'list', add scrollDirection
          if (state.viewMode === 'reading') {
            state.viewMode = 'list';
          }
          state.scrollDirection = 'horizontal';
        }
        if (version < 10) {
          state.showThemes = false;
        }
        if (version < 11) {
          state.lightThemeId = 'default';
          state.darkThemeId = 'dark-default';
        }
        if (version < 12) {
          state.rewayah = 'hafs';
          state.showRewayahDiffs = true;
        }
        if (
          version < 13 ||
          !['normal', 'medium', 'bold'].includes(
            state.arabicTextWeight as string,
          )
        ) {
          state.arabicTextWeight = 'normal';
        }
        if (version < 14) {
          state.showAllahNameHighlight = false;
          state.allahNameHighlightColor = 'gold';
        }
        if (version < 15) {
          state.rewayah = migratePersistedId(
            typeof state.rewayah === 'string' ? state.rewayah : 'hafs',
          );
        }
        if (version < 16 && state.mushafRenderer === 'qcf_v2') {
          state.showTajweed = false;
          state.rewayah = 'hafs';
          state.showRewayahDiffs = false;
        }
        if (version < 17) {
          // RFC-018 — new opt-in inline community reflections, default off.
          state.showCommunityReflections = false;
        }
        // @ai-start
        if (
          version < 18 &&
          state.mushafRenderer === 'dk_indopak' &&
          typeof state.rewayah === 'string' &&
          state.rewayah !== 'hafs'
        ) {
          // IndoPak + a non-Hafs rewayah drew thousands of fallback glyphs.
          // Keep the rewayah the reader chose (the text is what matters; the
          // data service loads it from this value at startup) and move only
          // the font.
          state.mushafRenderer = REWAYAH_FALLBACK_RENDERER;
          state.uthmaniFont = uthmaniFontForRenderer(REWAYAH_FALLBACK_RENDERER);
        }
        // @ai-end
        return state as unknown as MushafSettingsState;
      },
    },
  ),
);
