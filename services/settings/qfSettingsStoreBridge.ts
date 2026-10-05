import type {StoreApi, UseBoundStore} from 'zustand';
import {useSettings} from '@/hooks/useSettings';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useAdhkarSettingsStore} from '@/store/adhkarSettingsStore';
import {useAmbientStore} from '@/store/ambientStore';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useReciterStore} from '@/store/reciterStore';
import {useTafseerStore} from '@/store/tafseerStore';
import {useThemeStore} from '@/store/themeStore';
import type {
  PreferenceMutation,
  SettingsDocumentKey,
} from './bayaanSettingsApiClient';
import {
  applyRemotePreferences,
  applySettingsDocuments,
  capturePreferenceMutations,
  captureSettingsDocuments,
  sanitizeRemoteDocument,
  type SettingsDocuments,
} from './qfSettingsSnapshot';

type HydratableStore = UseBoundStore<StoreApi<unknown>> & {
  persist?: {
    hasHydrated(): boolean;
    onFinishHydration(callback: () => void): () => void;
  };
};

export interface QfSettingsStoreBridge {
  waitForHydration(): Promise<void>;
  subscribe(onChange: () => void): Array<() => void>;
  captureDocuments(): SettingsDocuments;
  capturePreferences(): PreferenceMutation[];
  applyDocuments(documents: Partial<SettingsDocuments>): void;
  applyPreferences(preferences: Record<string, unknown>): void;
  sanitizeDocument(
    key: SettingsDocumentKey,
    value: Record<string, unknown>,
  ): Record<string, unknown>;
}

const stores = [
  useThemeStore,
  useMushafSettingsStore,
  useAdhkarSettingsStore,
  useAmbientStore,
  useReciterStore,
  useTafseerStore,
  useMushafPlayerStore,
  usePlayerStore,
  useSettings,
];

function observePreference<TState>(
  store: {
    getState(): TState;
    subscribe(listener: (state: TState) => void): () => void;
  },
  signature: (state: TState) => string,
  onChange: () => void,
): () => void {
  let previous = signature(store.getState());
  return store.subscribe(state => {
    const next = signature(state);
    if (next === previous) return;
    previous = next;
    onChange();
  });
}

function values(...items: unknown[]): string {
  return JSON.stringify(items);
}

async function waitForStoreHydration(store: HydratableStore): Promise<void> {
  const persist = store.persist;
  if (!persist || persist.hasHydrated()) return;
  await new Promise<void>(resolve => {
    const unsubscribe = persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });
}

export const qfSettingsStoreBridge: QfSettingsStoreBridge = {
  waitForHydration: async () => {
    await Promise.all(
      (stores as unknown as HydratableStore[]).map(waitForStoreHydration),
    );
  },
  subscribe: onChange => [
    observePreference(
      useThemeStore,
      state => values(state.themeMode),
      onChange,
    ),
    observePreference(
      useMushafSettingsStore,
      state =>
        values(
          state.showTranslation,
          state.showTransliteration,
          state.showTajweed,
          state.showThemes,
          state.showWBW,
          state.wbwShowTranslation,
          state.wbwShowTransliteration,
          state.pageLayout,
          state.arabicFontSize,
          state.translationFontSize,
          state.transliterationFontSize,
          state.arabicTextWeight,
          state.showAllahNameHighlight,
          state.allahNameHighlightColor,
          state.arabicFontFamily,
          state.uthmaniFont,
          state.mushafRenderer,
          state.viewMode,
          state.scrollDirection,
          state.selectedTranslationId,
          state.lightThemeId,
          state.darkThemeId,
          state.rewayah,
          state.showRewayahDiffs,
        ),
      onChange,
    ),
    observePreference(
      useAdhkarSettingsStore,
      state =>
        values(
          state.showTranslation,
          state.showTransliteration,
          state.arabicFontSize,
          state.translationFontSize,
          state.transliterationFontSize,
        ),
      onChange,
    ),
    observePreference(
      useAmbientStore,
      state => values(state.currentSound, state.volume),
      onChange,
    ),
    observePreference(
      useReciterStore,
      state => values(state.defaultReciter.id),
      onChange,
    ),
    observePreference(
      useTafseerStore,
      state => values(state.selectedTafseerId),
      onChange,
    ),
    observePreference(
      useMushafPlayerStore,
      state =>
        values(
          state.rewayatId,
          state.reciterName,
          state.rate,
          state.verseRepeatCount,
          state.rangeRepeatCount,
        ),
      onChange,
    ),
    observePreference(
      usePlayerStore,
      state =>
        values(
          state.settings.repeatMode,
          state.settings.shuffle,
          state.settings.skipSilence,
        ),
      onChange,
    ),
    observePreference(
      useSettings,
      state =>
        values(
          state.askEveryTime,
          state.defaultReciterSelection,
          state.reciterPreferences,
          state.browseViewMode,
          state.browseSortOption,
          state.reciterProfileViewMode,
          state.reciterProfileSortOption,
        ),
      onChange,
    ),
  ],
  captureDocuments: captureSettingsDocuments,
  capturePreferences: capturePreferenceMutations,
  applyDocuments: applySettingsDocuments,
  applyPreferences: applyRemotePreferences,
  sanitizeDocument: sanitizeRemoteDocument,
};
