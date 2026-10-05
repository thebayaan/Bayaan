import {useSettings} from '@/hooks/useSettings';
import {getReadingThemeById} from '@/constants/readingThemes';
import {RECITERS} from '@/data/reciterData';
import {ALL_REWAYAH_IDS} from '@/services/rewayah/RewayahIdentity';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useAdhkarSettingsStore} from '@/store/adhkarSettingsStore';
import {useAmbientStore} from '@/store/ambientStore';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {
  getActualFontSize,
  getDisplayValue,
  useMushafSettingsStore,
} from '@/store/mushafSettingsStore';
import {useReciterStore} from '@/store/reciterStore';
import {useTafseerStore} from '@/store/tafseerStore';
import {useThemeStore} from '@/store/themeStore';
import {AMBIENT_SOUNDS} from '@/types/ambient';
import type {
  PreferenceMutation,
  SettingsDocumentKey,
} from './bayaanSettingsApiClient';

export type SettingsDocuments = Record<
  SettingsDocumentKey,
  Record<string, unknown>
>;

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const MUSHAF_RENDERERS = ['dk_v1', 'dk_v2', 'dk_indopak', 'qcf_v2'];
const VIEW_MODES = ['mushaf', 'list'];
const PAGE_LAYOUTS = ['fullscreen', 'book'];
const SCROLL_DIRECTIONS = ['horizontal', 'vertical'];
const TEXT_WEIGHTS = ['normal', 'medium', 'bold'];
const HIGHLIGHT_COLORS = ['gold', 'emerald', 'blue', 'rose'];

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function finiteBetween(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

function optionalString(value: unknown, max = 255): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' && value.length > 0 && value.length <= max)
  );
}

function safeStringMap(value: unknown): Record<string, string> | undefined {
  if (!isObject(value) || Object.keys(value).length > 200) return undefined;
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (key.length > 128 || typeof item !== 'string' || item.length > 128)
      return undefined;
    result[key] = item;
  }
  return result;
}

export function captureSettingsDocuments(): SettingsDocuments {
  const theme = useThemeStore.getState();
  const mushaf = useMushafSettingsStore.getState();
  const adhkar = useAdhkarSettingsStore.getState();
  const ambient = useAmbientStore.getState();
  const reciter = useReciterStore.getState();
  const mushafPlayer = useMushafPlayerStore.getState();
  const player = usePlayerStore.getState();
  const settings = useSettings.getState();

  return {
    appearance: {
      themeMode: theme.themeMode,
    },
    mushaf: {
      showTranslation: mushaf.showTranslation,
      showTransliteration: mushaf.showTransliteration,
      showThemes: mushaf.showThemes,
      showWBW: mushaf.showWBW,
      wbwShowTranslation: mushaf.wbwShowTranslation,
      wbwShowTransliteration: mushaf.wbwShowTransliteration,
      pageLayout: mushaf.pageLayout,
      transliterationFontSize: mushaf.transliterationFontSize,
      arabicTextWeight: mushaf.arabicTextWeight,
      showAllahNameHighlight: mushaf.showAllahNameHighlight,
      allahNameHighlightColor: mushaf.allahNameHighlightColor,
      arabicFontFamily: mushaf.arabicFontFamily,
      uthmaniFont: mushaf.uthmaniFont,
      mushafRenderer: mushaf.mushafRenderer,
      viewMode: mushaf.viewMode,
      scrollDirection: mushaf.scrollDirection,
      lightThemeId: mushaf.lightThemeId,
      darkThemeId: mushaf.darkThemeId,
      rewayah: mushaf.rewayah,
      showRewayahDiffs: mushaf.showRewayahDiffs,
      selectedTranslationId: mushaf.selectedTranslationId,
    },
    audio: {
      defaultReciterId: reciter.defaultReciter.id || null,
      askEveryTime: settings.askEveryTime,
      defaultReciterSelection: settings.defaultReciterSelection,
      reciterPreferences: settings.reciterPreferences,
      mushafRewayatId: mushafPlayer.rewayatId,
      mushafReciterName: mushafPlayer.reciterName,
      verseRepeatCount: mushafPlayer.verseRepeatCount,
      rangeRepeatCount: mushafPlayer.rangeRepeatCount,
      repeatMode: player.settings.repeatMode,
      shuffle: player.settings.shuffle,
      skipSilence: player.settings.skipSilence,
      ambientSound: ambient.currentSound,
      ambientVolume: ambient.volume,
    },
    adhkar: {
      showTranslation: adhkar.showTranslation,
      showTransliteration: adhkar.showTransliteration,
      arabicFontSize: adhkar.arabicFontSize,
      translationFontSize: adhkar.translationFontSize,
      transliterationFontSize: adhkar.transliterationFontSize,
    },
    browsing: {
      browseViewMode: settings.browseViewMode,
      browseSortOption: settings.browseSortOption,
      reciterProfileViewMode: settings.reciterProfileViewMode,
      reciterProfileSortOption: settings.reciterProfileSortOption,
    },
  };
}

export function capturePreferenceMutations(): PreferenceMutation[] {
  const mushaf = useMushafSettingsStore.getState();
  const tafseer = useTafseerStore.getState();
  const mushafPlayer = useMushafPlayerStore.getState();
  const playbackRate = PLAYBACK_RATES.includes(mushafPlayer.rate)
    ? mushafPlayer.rate
    : 1;

  return [
    {
      group: 'quranReaderStyles',
      key: 'quranTextFontScale',
      value: Math.max(1, Math.min(10, getDisplayValue(mushaf.arabicFontSize))),
    },
    {
      group: 'quranReaderStyles',
      key: 'translationFontScale',
      value: Math.max(
        1,
        Math.min(10, getDisplayValue(mushaf.translationFontSize)),
      ),
    },
    {
      group: 'quranReaderStyles',
      key: 'showTajweedRules',
      value: mushaf.showTajweed,
    },
    {
      group: 'tafsirs',
      key: 'selectedTafsirs',
      value: tafseer.selectedTafseerId ? [tafseer.selectedTafseerId] : [],
    },
    {
      group: 'audio',
      key: 'playbackRate',
      value: playbackRate,
    },
  ];
}

export function applyRemotePreferences(
  preferences: Record<string, unknown>,
): void {
  const styles = isObject(preferences.quranReaderStyles)
    ? preferences.quranReaderStyles
    : {};
  const mushafPatch: Record<string, unknown> = {};
  if (
    finiteBetween(styles.quranTextFontScale, 1, 10) &&
    Number.isInteger(styles.quranTextFontScale)
  ) {
    mushafPatch.arabicFontSize = getActualFontSize(styles.quranTextFontScale);
  }
  if (
    finiteBetween(styles.translationFontScale, 1, 10) &&
    Number.isInteger(styles.translationFontScale)
  ) {
    mushafPatch.translationFontSize = getActualFontSize(
      styles.translationFontScale,
    );
  }
  if (typeof styles.showTajweedRules === 'boolean') {
    mushafPatch.showTajweed =
      useMushafSettingsStore.getState().mushafRenderer === 'qcf_v2'
        ? false
        : styles.showTajweedRules;
  }

  if (Object.keys(mushafPatch).length > 0) {
    useMushafSettingsStore.setState(mushafPatch);
  }

  const tafsirs = isObject(preferences.tafsirs) ? preferences.tafsirs : {};
  if (
    Array.isArray(tafsirs.selectedTafsirs) &&
    tafsirs.selectedTafsirs.length <= 10 &&
    tafsirs.selectedTafsirs.every(item => typeof item === 'string')
  ) {
    useTafseerStore.setState({
      selectedTafseerId: tafsirs.selectedTafsirs[0] ?? null,
    });
  }

  const audio = isObject(preferences.audio) ? preferences.audio : {};
  if (
    typeof audio.playbackRate === 'number' &&
    PLAYBACK_RATES.includes(audio.playbackRate)
  ) {
    useMushafPlayerStore.getState().setRate(audio.playbackRate);
  }
}

export function sanitizeRemoteDocument(
  key: SettingsDocumentKey,
  value: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const boolean = (name: string) => {
    if (typeof value[name] === 'boolean') result[name] = value[name];
  };
  const number = (name: string, min: number, max: number) => {
    if (finiteBetween(value[name], min, max)) result[name] = value[name];
  };
  const enumeration = (name: string, allowed: readonly string[]) => {
    if (enumValue(value[name], allowed)) result[name] = value[name];
  };

  if (key === 'appearance') {
    enumeration('themeMode', ['system', 'light', 'dark']);
  } else if (key === 'mushaf') {
    [
      'showTranslation',
      'showTransliteration',
      'showThemes',
      'showWBW',
      'wbwShowTranslation',
      'wbwShowTransliteration',
      'showAllahNameHighlight',
      'showRewayahDiffs',
    ].forEach(boolean);
    enumeration('pageLayout', PAGE_LAYOUTS);
    number('transliterationFontSize', 10, 46);
    enumeration('arabicTextWeight', TEXT_WEIGHTS);
    enumeration('allahNameHighlightColor', HIGHLIGHT_COLORS);
    enumeration('arabicFontFamily', ['Uthmani']);
    enumeration('uthmaniFont', ['v1', 'v2']);
    enumeration('mushafRenderer', MUSHAF_RENDERERS);
    enumeration('viewMode', VIEW_MODES);
    enumeration('scrollDirection', SCROLL_DIRECTIONS);
    if (
      typeof value.lightThemeId === 'string' &&
      getReadingThemeById(value.lightThemeId)?.mode === 'light'
    ) {
      result.lightThemeId = value.lightThemeId;
    }
    if (
      typeof value.darkThemeId === 'string' &&
      getReadingThemeById(value.darkThemeId)?.mode === 'dark'
    ) {
      result.darkThemeId = value.darkThemeId;
    }
    enumeration('rewayah', ALL_REWAYAH_IDS);
    if (
      typeof value.selectedTranslationId === 'string' &&
      value.selectedTranslationId.length > 0 &&
      value.selectedTranslationId.length <= 255
    ) {
      result.selectedTranslationId = value.selectedTranslationId;
    }
  } else if (key === 'audio') {
    if (optionalString(value.defaultReciterId, 128))
      result.defaultReciterId = value.defaultReciterId;
    boolean('askEveryTime');
    if (optionalString(value.defaultReciterSelection, 128)) {
      result.defaultReciterSelection = value.defaultReciterSelection;
    }
    const reciterPreferences = safeStringMap(value.reciterPreferences);
    if (reciterPreferences) result.reciterPreferences = reciterPreferences;
    if (optionalString(value.mushafRewayatId, 128))
      result.mushafRewayatId = value.mushafRewayatId;
    if (optionalString(value.mushafReciterName, 255))
      result.mushafReciterName = value.mushafReciterName;
    number('verseRepeatCount', 1, 100);
    number('rangeRepeatCount', 1, 100);
    enumeration('repeatMode', ['none', 'queue', 'track']);
    boolean('shuffle');
    boolean('skipSilence');
    if (
      value.ambientSound === null ||
      (typeof value.ambientSound === 'string' &&
        value.ambientSound in AMBIENT_SOUNDS)
    ) {
      result.ambientSound = value.ambientSound;
    }
    number('ambientVolume', 0, 1);
  } else if (key === 'adhkar') {
    boolean('showTranslation');
    boolean('showTransliteration');
    number('arabicFontSize', 10, 46);
    number('translationFontSize', 10, 46);
    number('transliterationFontSize', 10, 46);
  } else {
    enumeration('browseViewMode', ['card', 'list']);
    enumeration('browseSortOption', ['asc', 'desc', 'revelation']);
    enumeration('reciterProfileViewMode', ['card', 'list']);
    enumeration('reciterProfileSortOption', ['asc', 'desc', 'revelation']);
  }
  return result;
}

export function applySettingsDocuments(
  documents: Partial<SettingsDocuments>,
): void {
  if (documents.appearance) {
    const patch = sanitizeRemoteDocument('appearance', documents.appearance);
    if (typeof patch.themeMode === 'string') {
      useThemeStore.getState().setThemeMode(patch.themeMode as never);
    }
  }
  if (documents.mushaf) {
    const patch = sanitizeRemoteDocument('mushaf', documents.mushaf);
    if (typeof patch.mushafRenderer === 'string') {
      useMushafSettingsStore
        .getState()
        .setMushafRenderer(patch.mushafRenderer as never);
      delete patch.mushafRenderer;
    }
    useMushafSettingsStore.setState(patch);
    const state = useMushafSettingsStore.getState();
    if (state.mushafRenderer === 'qcf_v2') {
      useMushafSettingsStore.setState({
        showTajweed: false,
        rewayah: 'hafs',
        showRewayahDiffs: false,
      });
    }
  }
  if (documents.audio) {
    const patch = sanitizeRemoteDocument('audio', documents.audio);
    const defaultReciterId = patch.defaultReciterId;
    if (typeof defaultReciterId === 'string') {
      const reciter = RECITERS.find(item => item.id === defaultReciterId);
      if (reciter) useReciterStore.getState().setDefaultReciter(reciter);
    }
    useSettings.setState({
      ...(typeof patch.askEveryTime === 'boolean'
        ? {askEveryTime: patch.askEveryTime}
        : {}),
      ...(optionalString(patch.defaultReciterSelection, 128)
        ? {defaultReciterSelection: patch.defaultReciterSelection}
        : {}),
      ...(isObject(patch.reciterPreferences)
        ? {
            reciterPreferences: patch.reciterPreferences as Record<
              string,
              string
            >,
          }
        : {}),
    });
    useMushafPlayerStore.setState({
      ...(optionalString(patch.mushafRewayatId, 128)
        ? {rewayatId: patch.mushafRewayatId}
        : {}),
      ...(optionalString(patch.mushafReciterName, 255)
        ? {reciterName: patch.mushafReciterName}
        : {}),
      ...(typeof patch.verseRepeatCount === 'number'
        ? {verseRepeatCount: patch.verseRepeatCount}
        : {}),
      ...(typeof patch.rangeRepeatCount === 'number'
        ? {rangeRepeatCount: patch.rangeRepeatCount}
        : {}),
    });
    const currentPlayer = usePlayerStore.getState();
    usePlayerStore.setState({
      settings: {
        ...currentPlayer.settings,
        ...(typeof patch.repeatMode === 'string'
          ? {repeatMode: patch.repeatMode as never}
          : {}),
        ...(typeof patch.shuffle === 'boolean' ? {shuffle: patch.shuffle} : {}),
        ...(typeof patch.skipSilence === 'boolean'
          ? {skipSilence: patch.skipSilence}
          : {}),
      },
    });
    useAmbientStore.setState({
      ...(patch.ambientSound === null || typeof patch.ambientSound === 'string'
        ? {currentSound: patch.ambientSound as never}
        : {}),
      ...(typeof patch.ambientVolume === 'number'
        ? {volume: patch.ambientVolume}
        : {}),
    });
  }
  if (documents.adhkar) {
    useAdhkarSettingsStore.setState(
      sanitizeRemoteDocument('adhkar', documents.adhkar),
    );
  }
  if (documents.browsing) {
    useSettings.setState(
      sanitizeRemoteDocument('browsing', documents.browsing),
    );
  }
}
