import React, {
  useEffect,
  useMemo,
  useCallback,
  useState, // @ai
  useSyncExternalStore, // @ai
} from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Pressable, // @ai
  Text, // @ai
} from 'react-native';
import {Stack, useLocalSearchParams} from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import {useTheme} from '@/hooks/useTheme';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService'; // @ai
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
// @ai-start
import {
  mushafVerseMapService,
  selectionForAnchor,
  whenShownVerseUnitsResolved,
} from '@/services/mushaf/MushafVerseMapService';
// @ai-end
import {mushafSessionStore} from '@/services/mushaf/MushafSessionStore';
import {
  formatPlaybackInfo, // @ai
  getPlaybackNotice, // @ai
  useMushafPlayerStore,
} from '@/store/mushafPlayerStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore'; // @ai
import {showToast} from '@/utils/toastUtils'; // @ai
import {mushafAudioService} from '@/services/audio/MushafAudioService';
import {SheetManager} from 'react-native-actions-sheet';
import {SURAHS} from '@/data/surahData';
import MushafViewer from '@/components/mushaf/main';
import {USE_GLASS} from '@/hooks/useGlassProps';

export type MushafScreenParams = {
  surah?: string;
  page?: string;
  ayah?: string;
  // @ai-start
  // A stored Hafs anchor ('S:A' or 'S:A:W': a bookmark / note / highlight
  // row's verse_key). When given, the flash selects exactly the shown
  // rewayah's verse holding that slot (verse-units contract 4.4) instead of
  // every verse holding Hafs `surah`:`ayah`. Never a rewayah verse number.
  anchor?: string;
  // @ai-end
};

export default function MushafScreen() {
  const {surah, page, ayah, anchor} =
    useLocalSearchParams<MushafScreenParams>(); // @ai
  const {theme} = useTheme();

  // Safety net — DK data is initialized at AppInitializer priority 4-5,
  // so in practice this is always true by the time MushafScreen mounts.
  // Capture it as a value so the hooks below run unconditionally.
  const dkReady = digitalKhattDataService.initialized;
  const surahStartPages = dkReady
    ? digitalKhattDataService.getSurahStartPages()
    : {};

  // Resolve page number from params
  const pageNumber = useMemo(() => {
    if (page) {
      const p = parseInt(page, 10);
      if (!isNaN(p) && p >= 1 && p <= 604) return p;
    }
    if (surah) {
      const s = parseInt(surah, 10);
      if (!isNaN(s) && surahStartPages[s]) return surahStartPages[s];
    }
    return 1;
  }, [page, surah, surahStartPages]);

  // @ai-start
  // The surah the user asked for, when the page was resolved from it. A page
  // can hold the end of one surah and the start of another (or three, on
  // 601-604), so the page number alone cannot name the surah — this keeps
  // the header honest until the reader turns the page.
  const initialSurahId = useMemo(() => {
    if (page || !surah) return undefined;
    const s = parseInt(surah, 10);
    return !isNaN(s) && surahStartPages[s] ? s : undefined;
  }, [page, surah, surahStartPages]);
  // @ai-end

  // Build initial verse key for highlight
  const initialVerseKey = useMemo(() => {
    if (surah && ayah) return `${surah}:${ayah}`;
    return undefined;
  }, [surah, ayah]);

  // Allow landscape while the mushaf screen is open; re-lock portrait on exit.
  useEffect(() => {
    ScreenOrientation.unlockAsync();
    return () => {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
      );
    };
  }, []);

  // Track mushaf screen for session restore (MMKV — sync writes survive force-kill)
  useEffect(() => {
    mushafSessionStore.setLastScreenWasMushaf(true);
    return () => {
      mushafSessionStore.setLastScreenWasMushaf(false);
      // Reset UI state in store when leaving mushaf
      useMushafPlayerStore.setState({
        isImmersive: false,
        isSearchMode: false,
      });
    };
  }, []);

  // @ai-start
  // Mushaf 1440 (qcf_v2) draws Hafs only and the settings store pins the
  // rewayah to Hafs there. The DigitalKhatt data service must agree: its
  // words feed the QCF Allah-name highlights now, and the DigitalKhatt pages
  // and their saved layouts after a later switch back. A path that switched
  // the service without the store (opening a bookmark saved in another
  // rewayah used to) would otherwise leave that rewayah's text under a Hafs
  // header, so put the service back on the store's rewayah.
  const mushafRenderer = useMushafSettingsStore(s => s.mushafRenderer);
  const settingsRewayah = useMushafSettingsStore(s => s.rewayah);
  useEffect(() => {
    if (mushafRenderer !== 'qcf_v2') return;
    if (!digitalKhattDataService.initialized) return;
    if (digitalKhattDataService.rewayah === settingsRewayah) return;
    digitalKhattDataService.switchRewayah(settingsRewayah).catch(error => {
      console.error('[MushafScreen] Failed to resync rewayah:', error);
    });
  }, [mushafRenderer, settingsRewayah]);
  // @ai-end

  // @ai-start
  // When the mushaf text cannot be loaded at all (e.g. no storage left to
  // copy it to the device), say so and offer a retry instead of an endless
  // spinner. The preload retries both the text and the fonts.
  const preloadState = useSyncExternalStore(subscribePreload, getPreloadState);
  const [retrying, setRetrying] = useState(false);
  const retryLoad = useCallback(() => {
    setRetrying(true);
    mushafPreloadService
      .initialize()
      .catch(() => undefined)
      .finally(() => setRetrying(false));
  }, []);
  // @ai-end

  // Set verse highlight on mount, auto-clear after 3s, clear on unmount
  useEffect(() => {
    // @ai-start
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flash = () => {
      // The unit a stored anchor names, in the shown rewayah's numbering.
      const unitSelection = anchor ? selectionForAnchor(anchor) : null;
      if (!unitSelection && !initialVerseKey) return;
      const selection = useMushafVerseSelectionStore.getState();
      if (unitSelection) {
        selection.selectUnits(
          unitSelection.rewayah,
          unitSelection.units,
          pageNumber,
        );
      } else if (initialVerseKey) {
        selection.selectVerse(initialVerseKey, pageNumber);
      }
      timer = setTimeout(() => {
        useMushafVerseSelectionStore.getState().clearSelection();
      }, 3000);
    };
    // Verse units are built after interactions, never here: right after a
    // rewayah switch (a bookmark saved in another rewayah) they may still
    // be building. Wait for them, so the anchor selects exactly its verse
    // rather than every verse holding its Hafs verse.
    if (anchor && mushafVerseMapService.isShownVerseUnitsPending()) {
      whenShownVerseUnitsResolved().then(() => {
        if (!cancelled) flash();
      });
    } else {
      flash();
    }
    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
      useMushafVerseSelectionStore.getState().clearSelection();
    };
    // @ai-end
  }, [anchor, initialVerseKey, pageNumber]); // @ai: anchor

  if (!dkReady) {
    // @ai-start
    if (preloadState === 'failed' && !retrying) {
      return (
        <View
          style={[styles.loading, {backgroundColor: theme.colors.background}]}
          accessibilityRole="alert">
          <Text style={[styles.errorTitle, {color: theme.colors.text}]}>
            Couldn&apos;t load the mushaf
          </Text>
          <Text style={[styles.errorBody, {color: theme.colors.text}]}>
            Check that your device has some free storage, then try again.
          </Text>
          <Pressable
            onPress={retryLoad}
            accessibilityRole="button"
            hitSlop={8}
            style={({pressed}) => [
              styles.retryButton,
              {borderColor: theme.colors.text},
              pressed && styles.retryButtonPressed,
            ]}>
            <Text style={[styles.retryText, {color: theme.colors.text}]}>
              Try again
            </Text>
          </Pressable>
        </View>
      );
    }
    // @ai-end
    return (
      <View
        style={[styles.loading, {backgroundColor: theme.colors.background}]}>
        <ActivityIndicator size="large" color={theme.colors.text} />
      </View>
    );
  }

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      {USE_GLASS && <MushafToolbar />}
      <MushafViewer
        pageNumber={pageNumber}
        initialSurahId={initialSurahId} // @ai
        initialVerseKey={initialVerseKey}
      />
    </View>
  );
}

// ============================================================================
// iOS Native Toolbar (Stack.Toolbar)
// ============================================================================

// @ai-start
const subscribePreload = (listener: () => void): (() => void) =>
  mushafPreloadService.subscribe(listener);
const getPreloadState = () => mushafPreloadService.state;

const surahNameOf = (surah: number): string =>
  surah >= 1 && surah <= 114 ? SURAHS[surah - 1].name : '';
// @ai-end

// On iOS 26 this toolbar replaces MushafPlayerBar, so it carries what the bar
// shows: the verse label in the numbering of the mushaf on screen, "Verse
// tracking unavailable" (with prev / next disabled), and, as one-off notices,
// refused playback requests.
export function MushafToolbar() {
  const playbackState = useMushafPlayerStore(s => s.playbackState);
  const currentPage = useMushafPlayerStore(s => s.currentPage);
  const currentSurah = useMushafPlayerStore(s => s.currentSurah);
  // @ai-start
  const currentVerseLabel = useMushafPlayerStore(s => s.currentVerseLabel);
  const numberingMode = useMushafPlayerStore(s => s.numberingMode);
  // @ai-end
  const isImmersive = useMushafPlayerStore(s => s.isImmersive);
  const isSearchMode = useMushafPlayerStore(s => s.isSearchMode);

  const isIdle = playbackState === 'idle';
  const isPlaying = playbackState === 'playing';
  const isLoading = playbackState === 'loading';

  // @ai-start
  const surahName = surahNameOf(currentSurah);
  const verseLabel =
    !isIdle && surahName
      ? formatPlaybackInfo(surahName, {currentVerseLabel, numberingMode})
      : '';
  const verseNavDisabled = numberingMode === 'disabled';

  // The player bar shows refusals and the tracking notice inline; this
  // toolbar has no room for text, so they surface as toasts.
  useEffect(
    () =>
      useMushafPlayerStore.subscribe((state, prev) => {
        const notice = getPlaybackNotice(prev, state, surahNameOf);
        if (notice) showToast(notice.title, notice.message, notice.preset);
      }),
    [],
  );
  // @ai-end

  const handlePlay = useCallback(() => {
    const page = useMushafPlayerStore.getState().currentPage || 1;
    useMushafPlayerStore.setState({currentPage: page});
    SheetManager.show('mushaf-player-options', {
      payload: {currentPage: page},
    });
  }, []);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      mushafAudioService.pause();
      useMushafPlayerStore.getState().setPlaybackState('paused');
    } else {
      mushafAudioService.play();
      useMushafPlayerStore.getState().setPlaybackState('playing');
    }
  }, [isPlaying]);

  const handleStop = useCallback(() => {
    useMushafPlayerStore.getState().stop();
  }, []);

  const handlePrev = useCallback(() => {
    mushafAudioService.seekToPreviousAyah();
  }, []);

  const handleNext = useCallback(() => {
    mushafAudioService.seekToNextAyah();
  }, []);

  const handleOptions = useCallback(() => {
    const page = useMushafPlayerStore.getState().currentPage || 1;
    SheetManager.show('mushaf-player-options', {
      payload: {currentPage: page},
    });
  }, []);

  const handleSearch = useCallback(() => {
    useMushafPlayerStore.setState({isSearchMode: true});
  }, []);

  // Hide toolbar in immersive or search mode
  if (isImmersive || isSearchMode) return null;

  if (isIdle) {
    // Idle: [Search] — spacer — [Play] — spacer — [Options]
    return (
      <Stack.Toolbar>
        <Stack.Toolbar.Button icon="magnifyingglass" onPress={handleSearch}>
          Search
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Spacer />
        <Stack.Toolbar.Button icon="play.fill" onPress={handlePlay}>
          Play
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Spacer />
        <Stack.Toolbar.Button icon="ellipsis.circle" onPress={handleOptions}>
          Options
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    );
  }

  // Active: [Stop] — spacer — [Prev] [Play/Pause] [Next] — spacer — [Options]
  return (
    <Stack.Toolbar>
      <Stack.Toolbar.Button icon="stop.fill" onPress={handleStop}>
        Stop
      </Stack.Toolbar.Button>
      <Stack.Toolbar.Spacer />
      <Stack.Toolbar.Button
        icon="backward.end.fill"
        onPress={handlePrev}
        disabled={verseNavDisabled} // @ai
      />
      <Stack.Toolbar.Button
        icon={isPlaying ? 'pause.fill' : 'play.fill'}
        onPress={handlePlayPause}
        disabled={isLoading}>
        {verseLabel}
      </Stack.Toolbar.Button>
      <Stack.Toolbar.Button
        icon="forward.end.fill"
        onPress={handleNext}
        disabled={verseNavDisabled} // @ai
      />
      <Stack.Toolbar.Spacer />
      <Stack.Toolbar.Button icon="ellipsis.circle" onPress={handleOptions}>
        Options
      </Stack.Toolbar.Button>
    </Stack.Toolbar>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // @ai-start
  errorTitle: {
    fontSize: 17,
    fontFamily: 'Manrope-SemiBold',
    textAlign: 'center',
    marginHorizontal: 24,
  },
  errorBody: {
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    opacity: 0.7,
    marginTop: 8,
    marginHorizontal: 32,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  retryButtonPressed: {
    opacity: 0.6,
  },
  retryText: {
    fontSize: 15,
    fontFamily: 'Manrope-SemiBold',
  },
  // @ai-end
});
