import React, {
  useEffect,
  useCallback,
  useContext, // @ai
} from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Pressable, // @ai
  Text, // @ai
} from 'react-native';
import {Stack, useLocalSearchParams} from 'expo-router';
import {usePhoneOrientation} from '@/hooks/usePhoneOrientation'; // @ai
import {useTheme} from '@/hooks/useTheme';
import {
  useMushafOpenTarget,
  type MushafOpenTarget,
} from '@/hooks/useMushafOpenTarget'; // @ai
import {useFirstContent} from '@/hooks/useFirstContent'; // @ai
import {useReaderLinkPage} from '@/hooks/useReaderLinkPage'; // @ai
// @ai-start
import {
  SELECTION_FLASH_MS,
  flashedSelectionClearer,
  useMushafVerseSelectionStore,
} from '@/store/mushafVerseSelectionStore';
// @ai-end
import {useMushafWordFlashStore} from '@/store/mushafWordFlashStore'; // @ai
// @ai-start
import {
  mushafVerseMapService,
  selectionForAnchor,
  whenShownVerseUnitsResolved,
} from '@/services/mushaf/MushafVerseMapService';
// @ai-end
import {mushafSessionStore} from '@/services/mushaf/MushafSessionStore';
import {ReaderRestoreContext} from '@/hooks/readerRestoreState'; // @ai
import {
  formatPlaybackInfo, // @ai
  getPlaybackNotice, // @ai
  useMushafPlayerStore,
} from '@/store/mushafPlayerStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore'; // @ai
import {showToast} from '@/utils/toastUtils'; // @ai
import {isRTL} from '@/utils/rtl'; // @ai
import {mushafAudioService} from '@/services/audio/MushafAudioService';
import {SURAHS} from '@/data/surahData';
import MushafViewer from '@/components/mushaf/main';
import {USE_GLASS, useGlassTint} from '@/hooks/useGlassProps';
import {
  peekOnPage,
  LIVE_MIC_COLOR,
  useRecitationMic,
  useRecitationStatusText,
} from '@/components/mushaf/RecitationMicButton';
import {stopRecitationTracking} from '@/services/recitation/RecitationTrackingService';
// @ai-start
import {playbackNoticeText} from '@/i18n/playback';
import {useTranslation} from 'react-i18next';
import {getSurahDisplayName, localizeDigits} from '@/i18n/format';
import {showSheet} from '@/components/sheets/sheetControl'; // @ai
// @ai-end

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
  // The rewayah a saved verse was saved in, sent with no page. The screen
  // restores it when the data is ready, then opens the page of the verse.
  rewayah?: string;
  // '1' from the player's Repeat, sent with no page. The screen shows the
  // player options when the page of the verse is known.
  playerOptions?: string;
  // @ai-end
  // @ai-start
  // Digital Khatt slots of Hafs verse `surah`:`ayah` to flash, comma-
  // separated ('3,4'): the words a Quran search matched. Sent with no page:
  // the screen opens the page of the first of them (useMushafOpenTarget).
  words?: string;
  // @ai-end
};

export default function MushafScreen() {
  const params = useLocalSearchParams<MushafScreenParams>(); // @ai
  // @ai-start
  // The data loads after the splash, so this screen can open first. The reader
  // mounts when the data, the fonts and its page are ready, and then stays.
  const open = useMushafOpenTarget(params);
  // A link to the open reader turns it to the link's page.
  useReaderLinkPage(params, open.state === 'ready');
  // The restore of this launch (app/_layout.tsx) waits for the first content:
  // the page that the reader opens on, or the failed view (it reports itself).
  const reportRestore = useContext(ReaderRestoreContext);
  const onFirstContent = useCallback(
    () => reportRestore('content'),
    [reportRestore],
  );
  // @ai-end

  // Phones may turn to landscape while the mushaf screen is open and go back
  // to portrait on exit. iPads aren't locked, so leaving the reader in
  // landscape keeps the app in landscape. @ai
  usePhoneOrientation('free'); // @ai

  // Track mushaf screen for session restore (MMKV — sync writes survive force-kill)
  useEffect(() => {
    mushafSessionStore.setLastScreenWasMushaf(true);
    return () => {
      mushafSessionStore.setLastScreenWasMushaf(false);
      // With no reader there is nothing to wait for: a return to Home renders
      // it at once. @ai
      reportRestore('closed'); // @ai
      // Reset UI state in store when leaving mushaf
      useMushafPlayerStore.setState({
        isImmersive: false,
        isSearchMode: false,
      });
    };
  }, [reportRestore]); // @ai

  // @ai-start
  if (open.state === 'ready') {
    // A load that fails later shows over the reader, which keeps its page.
    return (
      <>
        <MushafReader
          target={open.target}
          playerOptions={params.playerOptions === '1'}
          covered={open.data !== 'ready'}
          onFirstContent={onFirstContent}
        />
        {open.data !== 'ready' && (
          <View style={StyleSheet.absoluteFill}>
            {open.data === 'failed' ? (
              <MushafLoadFailed retry={open.retry} />
            ) : (
              <MushafLoading />
            )}
          </View>
        )}
      </>
    );
  }
  if (open.state === 'failed') return <MushafLoadFailed retry={open.retry} />;
  return <MushafLoading />;
  // @ai-end
}

// @ai-start
function MushafLoading() {
  const {theme} = useTheme();
  return (
    <View style={[styles.loading, {backgroundColor: theme.colors.background}]}>
      <ActivityIndicator size="large" color={theme.colors.text} />
    </View>
  );
}

// When the mushaf text cannot be loaded (e.g. no storage left to copy it
// to the device), say so and offer a retry, not an endless spinner.
function MushafLoadFailed({retry}: {retry: () => void}) {
  const {theme} = useTheme();
  const {t} = useTranslation(['reader', 'common']);
  // The failed view is the first content of a restored launch, also when it
  // shows over the mounted reader before the reader's page drew.
  const reportRestore = useContext(ReaderRestoreContext);
  const onFirstContent = useCallback(
    () => reportRestore('content'),
    [reportRestore],
  );
  useFirstContent(true, onFirstContent);
  return (
    <View
      style={[styles.loading, {backgroundColor: theme.colors.background}]}
      accessibilityRole="alert">
      <Text style={[styles.errorTitle, {color: theme.colors.text}]}>
        {t('reader:mushaf.loadFailedTitle')}
      </Text>
      <Text style={[styles.errorBody, {color: theme.colors.text}]}>
        {t('reader:mushaf.loadFailedBody')}
      </Text>
      <Pressable
        onPress={retry}
        accessibilityRole="button"
        hitSlop={8}
        style={({pressed}) => [
          styles.retryButton,
          {borderColor: theme.colors.text},
          pressed && styles.retryButtonPressed,
        ]}>
        <Text style={[styles.retryText, {color: theme.colors.text}]}>
          {t('common:actions.tryAgain')}
        </Text>
      </Pressable>
    </View>
  );
}
// @ai-end

// @ai-start
// The reader at its open target. The target is fixed, so each effect here runs
// once: the player options open once, and the verse flashes once.
function MushafReader({
  target,
  playerOptions,
  covered,
  onFirstContent,
}: {
  target: MushafOpenTarget;
  /** The player's Repeat opened the reader: show the player options. */
  playerOptions: boolean;
  /**
   * The load error or its spinner shows over the reader. The native toolbar
   * would stay above it, so it goes, and a screen reader skips the pages.
   */
  covered: boolean;
  /** Called once, when the page of the target has content. */
  onFirstContent: () => void;
}) {
  const {theme} = useTheme();
  const {page, anchor, verseKey, words} = target;

  // The options of the player's Repeat need the page (VerseActionsSheet).
  useEffect(() => {
    if (!playerOptions) return;
    useMushafPlayerStore.setState({currentPage: page});
    showSheet('mushaf-player-options', {payload: {currentPage: page}});
  }, [playerOptions, page]);

  // Set verse highlight on mount, auto-clear after 3s, clear on unmount
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flash = () => {
      // The unit a stored anchor names, in the shown rewayah's numbering.
      const unitSelection = anchor ? selectionForAnchor(anchor) : null;
      if (!unitSelection && !verseKey) return;
      const selection = useMushafVerseSelectionStore.getState();
      if (unitSelection) {
        selection.selectUnits(unitSelection.rewayah, unitSelection.units, page);
      } else if (verseKey) {
        selection.selectVerse(verseKey, page);
      }
      // The words a Quran search matched flash with their verse.
      if (verseKey && words?.length) {
        useMushafWordFlashStore.getState().show(verseKey, words);
      }
      // Ends only this flash: a verse the reader long-pressed meanwhile
      // keeps its highlight.
      timer = setTimeout(flashedSelectionClearer(), SELECTION_FLASH_MS);
    };
    // Verse units are built after interactions, never here: right after a
    // rewayah switch (a bookmark saved in another rewayah) they may still
    // be building. Wait for them, so an anchor selects exactly its verse
    // rather than every verse holding its Hafs verse, and so the 3 s flash
    // of a Hafs verse starts once the pages can paint it (no verse layer is
    // painted while the units build) instead of running out unseen.
    if (
      (anchor || verseKey) &&
      mushafVerseMapService.isShownVerseUnitsPending()
    ) {
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
      useMushafWordFlashStore.getState().clear();
    };
  }, [anchor, verseKey, page, words]);

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}
      accessibilityElementsHidden={covered}
      importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}>
      {USE_GLASS && !covered && <MushafToolbar />}
      <MushafViewer
        pageNumber={page}
        initialSurahId={target.surahId}
        initialVerseKey={verseKey}
        onFirstContent={onFirstContent}
      />
    </View>
  );
}
// @ai-end

// ============================================================================
// iOS Native Toolbar (Stack.Toolbar)
// ============================================================================

// @ai-start
const surahNameOf = (surah: number): string =>
  surah >= 1 && surah <= 114 ? getSurahDisplayName(SURAHS[surah - 1]) : '';
// @ai-end

// On iOS 26 this toolbar replaces MushafPlayerBar, so it carries what the bar
// shows: the verse label in the numbering of the mushaf on screen, "Verse
// tracking unavailable" (with prev / next disabled), and, as one-off notices,
// refused playback requests.
export function MushafToolbar() {
  const {t} = useTranslation(['reader', 'common']);
  // @ai-start
  // iOS draws these glass circles; in dark mode the prominent style fills
  // them with the shared glass tint, so they darken with it.
  const isDark = useTheme().theme.isDarkMode;
  const glassTint = useGlassTint();
  const buttonLook = isDark
    ? ({variant: 'prominent', tintColor: glassTint} as const)
    : {};
  // @ai-end
  const playbackState = useMushafPlayerStore(s => s.playbackState);
  const currentPage = useMushafPlayerStore(s => s.currentPage);
  const mic = useRecitationMic(currentPage || 1);
  const recitationText = useRecitationStatusText();
  const hideText = useMushafSettingsStore(s => s.recitationHideText);
  const toggleHideText = useMushafSettingsStore(
    s => s.toggleRecitationHideText,
  );
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
      ? localizeDigits(
          formatPlaybackInfo(
            surahName,
            {currentVerseLabel, numberingMode},
            t('playback.trackingUnavailable'),
          ),
        )
      : '';
  const verseNavDisabled = numberingMode === 'disabled';

  // The player bar shows refusals and the tracking notice inline; this
  // toolbar has no room for text, so they surface as toasts.
  useEffect(
    () =>
      useMushafPlayerStore.subscribe((state, prev) => {
        const notice = getPlaybackNotice(
          prev,
          state,
          surahNameOf,
          playbackNoticeText(),
        );
        if (notice) showToast(notice.title, notice.message, notice.preset);
      }),
    [],
  );
  // @ai-end

  const handlePlay = useCallback(() => {
    const page = useMushafPlayerStore.getState().currentPage || 1;
    useMushafPlayerStore.setState({currentPage: page});
    showSheet('mushaf-player-options', {
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
    useMushafPlayerStore.getState().previousVerse(); // @ai
  }, []);

  const handleNext = useCallback(() => {
    useMushafPlayerStore.getState().nextVerse(); // @ai
  }, []);

  const handleOptions = useCallback(() => {
    const page = useMushafPlayerStore.getState().currentPage || 1;
    showSheet('mushaf-player-options', {
      payload: {currentPage: page},
    });
  }, []);

  const handleSearch = useCallback(() => {
    useMushafPlayerStore.setState({isSearchMode: true});
  }, []);

  // Hide toolbar in immersive or search mode
  if (isImmersive || isSearchMode) return null;

  if (recitationText !== null) {
    // Reciting: [Stop], peek icons when hiding, the live mic, then [eye].
    return (
      <Stack.Toolbar>
        <Stack.Toolbar.Button
          {...buttonLook} // @ai
          icon="stop.fill"
          onPress={() => void stopRecitationTracking()}>
          {t('recitation.stop')}
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Spacer />
        {hideText && (
          <Stack.Toolbar.Button
            {...buttonLook} // @ai
            icon="chevron.left.2"
            accessibilityLabel={t('recitation.nextAyah')}
            onPress={() => peekOnPage('ayah', currentPage || 1)}>
            {t('recitation.nextAyah')}
          </Stack.Toolbar.Button>
        )}
        {hideText && (
          <Stack.Toolbar.Button
            {...buttonLook} // @ai
            icon="chevron.left"
            accessibilityLabel={t('recitation.nextWord')}
            onPress={() => peekOnPage('word', currentPage || 1)}>
            {t('recitation.nextWord')}
          </Stack.Toolbar.Button>
        )}
        <Stack.Toolbar.Button
          icon="mic.fill"
          tintColor={LIVE_MIC_COLOR}
          accessibilityLabel={t('recitation.listeningLabel', {
            status: recitationText,
          })}
          onPress={() => void stopRecitationTracking()}>
          {t('recitation.listening')}
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Spacer />
        <Stack.Toolbar.Button
          {...buttonLook} // @ai
          icon={hideText ? 'eye.slash' : 'eye'}
          onPress={toggleHideText}>
          {hideText ? t('recitation.showText') : t('recitation.hideText')}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    );
  }

  if (isIdle) {
    // Idle: [Search] — spacer — [Play] — spacer — [Options]
    return (
      <Stack.Toolbar>
        <Stack.Toolbar.Button
          {...buttonLook}
          icon="magnifyingglass"
          onPress={handleSearch}>
          {t('common:actions.search')}
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Spacer />
        <Stack.Toolbar.Button
          {...buttonLook}
          icon="play.fill"
          onPress={handlePlay}>
          {t('common:actions.play')}
        </Stack.Toolbar.Button>
        {mic.enabled && (
          <Stack.Toolbar.Button
            {...buttonLook} // @ai
            icon={
              mic.busy
                ? 'hourglass'
                : mic.status === 'listening'
                  ? 'mic.fill'
                  : mic.status === 'paused'
                    ? 'mic.slash'
                    : 'mic'
            }
            onPress={mic.toggle}
            disabled={mic.busy}>
            {t('recitation.recite')}
          </Stack.Toolbar.Button>
        )}
        <Stack.Toolbar.Spacer />
        <Stack.Toolbar.Button
          {...buttonLook}
          icon="ellipsis"
          onPress={handleOptions}>
          {t('toolbar.options')}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    );
  }

  // @ai-start
  // The toolbar lays its items out from the leading edge, so in a
  // right-to-left app it reverses them, while the transport symbols do not
  // flip. Declared in reading order, Arabic showed ⏭ ▶ ⏮. Transport stays
  // left to right (docs/i18n/README.md, rule 8), so the two outer buttons are
  // declared the other way round there.
  const previousButton = (
    <Stack.Toolbar.Button
      {...buttonLook}
      icon="backward.end.fill"
      onPress={handlePrev}
      disabled={verseNavDisabled}
    />
  );
  const nextButton = (
    <Stack.Toolbar.Button
      {...buttonLook}
      icon="forward.end.fill"
      onPress={handleNext}
      disabled={verseNavDisabled}
    />
  );
  // @ai-end

  // Active: [Stop] — spacer — [Prev] [Play/Pause] [Next] — spacer — [Options]
  return (
    <Stack.Toolbar>
      <Stack.Toolbar.Button
        {...buttonLook}
        icon="stop.fill"
        onPress={handleStop}>
        {t('toolbar.stop')}
      </Stack.Toolbar.Button>
      <Stack.Toolbar.Spacer />
      {isRTL ? nextButton : previousButton /* @ai */}
      <Stack.Toolbar.Button
        {...buttonLook}
        icon={isPlaying ? 'pause.fill' : 'play.fill'}
        onPress={handlePlayPause}
        disabled={isLoading}>
        {verseLabel}
      </Stack.Toolbar.Button>
      {isRTL ? previousButton : nextButton /* @ai */}
      <Stack.Toolbar.Spacer />
      <Stack.Toolbar.Button
        {...buttonLook}
        icon="ellipsis"
        onPress={handleOptions}>
        {t('toolbar.options')}
      </Stack.Toolbar.Button>
    </Stack.Toolbar>
  );
}
// @ai-end

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
