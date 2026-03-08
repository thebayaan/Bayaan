import React, {useEffect, useMemo, useCallback} from 'react';
import {View, ActivityIndicator, StyleSheet, Platform} from 'react-native';
import {Stack, useLocalSearchParams} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
import {mushafSessionStore} from '@/services/mushaf/MushafSessionStore';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {mushafAudioService} from '@/services/audio/MushafAudioService';
import {SheetManager} from 'react-native-actions-sheet';
import {SURAHS} from '@/data/surahData';
import MushafViewer from '@/components/mushaf/main';

export type MushafScreenParams = {
  surah?: string;
  page?: string;
  ayah?: string;
};

export default function MushafScreen() {
  const {surah, page, ayah} = useLocalSearchParams<MushafScreenParams>();
  const {theme} = useTheme();

  // Safety net — DK data is initialized at AppInitializer priority 4-5
  if (!digitalKhattDataService.initialized) {
    return (
      <View
        style={[styles.loading, {backgroundColor: theme.colors.background}]}>
        <ActivityIndicator size="large" color={theme.colors.text} />
      </View>
    );
  }

  const surahStartPages = digitalKhattDataService.getSurahStartPages();

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

  // Build initial verse key for highlight
  const initialVerseKey = useMemo(() => {
    if (surah && ayah) return `${surah}:${ayah}`;
    return undefined;
  }, [surah, ayah]);

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

  // Set verse highlight on mount, auto-clear after 3s, clear on unmount
  useEffect(() => {
    if (initialVerseKey) {
      useMushafVerseSelectionStore
        .getState()
        .selectVerse(initialVerseKey, pageNumber);
      const timer = setTimeout(() => {
        useMushafVerseSelectionStore.getState().clearSelection();
      }, 3000);
      return () => {
        clearTimeout(timer);
        useMushafVerseSelectionStore.getState().clearSelection();
      };
    }
    return () => {
      useMushafVerseSelectionStore.getState().clearSelection();
    };
  }, [initialVerseKey, pageNumber]);

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      {Platform.OS === 'ios' && <MushafToolbar />}
      <MushafViewer pageNumber={pageNumber} initialVerseKey={initialVerseKey} />
    </View>
  );
}

// ============================================================================
// iOS Native Toolbar (Stack.Toolbar)
// ============================================================================

function MushafToolbar() {
  const playbackState = useMushafPlayerStore(s => s.playbackState);
  const currentPage = useMushafPlayerStore(s => s.currentPage);
  const currentSurah = useMushafPlayerStore(s => s.currentSurah);
  const currentAyah = useMushafPlayerStore(s => s.currentAyah);
  const isImmersive = useMushafPlayerStore(s => s.isImmersive);
  const isSearchMode = useMushafPlayerStore(s => s.isSearchMode);

  const isIdle = playbackState === 'idle';
  const isPlaying = playbackState === 'playing';
  const isLoading = playbackState === 'loading';

  const surahName =
    currentSurah >= 1 && currentSurah <= 114
      ? SURAHS[currentSurah - 1].name
      : '';
  const verseLabel =
    !isIdle && surahName ? `${surahName} ${currentSurah}:${currentAyah}` : '';

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
      <Stack.Toolbar.Button icon="backward.end.fill" onPress={handlePrev} />
      <Stack.Toolbar.Button
        icon={isPlaying ? 'pause.fill' : 'play.fill'}
        onPress={handlePlayPause}
        disabled={isLoading}>
        {verseLabel}
      </Stack.Toolbar.Button>
      <Stack.Toolbar.Button icon="forward.end.fill" onPress={handleNext} />
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
});
