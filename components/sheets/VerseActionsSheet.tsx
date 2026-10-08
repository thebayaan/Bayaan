import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  BackHandler,
  Platform,
  LayoutAnimation,
  UIManager,
  ActivityIndicator, // @ai
  type StyleProp, // @ai
  type ViewStyle, // @ai
} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import ActionSheet, {
  SheetProps,
  SheetManager,
  ScrollView,
} from 'react-native-actions-sheet';
import {Feather, MaterialCommunityIcons} from '@expo/vector-icons';
import {useVerseSelectionStore} from '@/store/verseSelectionStore';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
import {qulDataService} from '@/services/mushaf/QulDataService';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {lightHaptics} from '@/utils/haptics';
import {
  PlayIcon,
  RepeatIcon,
  StackedVolumesIcon,
  PageQuillIcon,
  MirrorWavesIcon,
  HighlightIcon,
  ChainLinksIcon,
  GroupedLinesIcon,
  BreakdownIcon,
  CopyIcon,
  ShareIcon,
} from '@/components/Icons';
import Color from 'color';
import {router} from 'expo-router';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {
  resolvePlayFromHere, // @ai
  useTimestampStore,
} from '@/store/timestampStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {getTranslationTextRaw} from '@/utils/translationLookup';
import * as Clipboard from 'expo-clipboard';
import {getRewayahShortLabel} from '@/utils/rewayahLabels';
// @ai-start
import {showToast} from '@/utils/toastUtils';
import {
  formatQuranCitation,
  hasNoOwnText,
  joinVerseTexts,
  noOwnTextMessage,
} from '@/components/share/rewayahVerseText';
import {
  formatVerseCopyText,
  joinTranslationParts,
  qulVerseKey,
  resolveSelectionTexts,
  selectionPlaybackKeys,
  selectionTranslationParts,
  type PendingVerseSelection,
  type ReadyVerseSelection,
  type VerseSelectionRequest,
} from '@/components/share/rewayahVerseSelection';
import {
  useRequireSelection,
  useSelectionVerseTexts,
  useVerseSelection,
} from '@/components/share/useVerseSelection';
import {
  setSelectionBookmarked,
  setSelectionHighlight,
  useSelectionBookmarked,
  useSelectionHighlightColor,
} from './verse-actions/selectionAnnotations';
// @ai-end
import branding from '@/config/branding';
import {HighlightContent} from './verse-actions/HighlightContent';
import {NoteContent} from './verse-actions/NoteContent';
import {ShareContent} from './verse-actions/ShareContent';
import {SimilarVersesContent} from './verse-actions/SimilarVersesContent';
import {TranslationContent} from './verse-actions/TranslationContent';
import {TafseerContent} from './verse-actions/TafseerContent';
import {ThemeContent} from './verse-actions/ThemeContent';
import {WBWContent} from './verse-actions/WBWContent';
import {CommunityReflectionsContent} from './verse-actions/CommunityReflectionsContent';

const surahData = require('@/data/surahData.json');

type ActiveScreen =
  | 'highlight'
  | 'note'
  | 'share'
  | 'similar'
  | 'phrases'
  | 'translation'
  | 'tafseer'
  | 'theme'
  | 'wbw'
  | 'community-reflections'
  | null;

const SCREEN_TITLES: Record<string, string> = {
  highlight: 'Highlight',
  note: 'Add Note',
  share: 'Share',
  similar: 'Similar Verses',
  phrases: 'Shared Phrases',
  translation: 'Translation',
  tafseer: 'Tafseer',
  theme: 'Theme',
  wbw: 'Word by Word',
  'community-reflections': 'Community Reflections',
};

const SHEET_HEIGHT = Dimensions.get('window').height * 0.85;

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// @ai-start
/**
 * In place of a screen while the selected verses of another rewayah cannot
 * be named: its verse units are loading or were refused, or the payload
 * names no verse of it (the unnumbered Fatiha basmala of the Madani and
 * Basri counts).
 */
function SelectionPendingView({
  selection,
  theme,
  style,
}: {
  selection: PendingVerseSelection;
  theme: Theme;
  style?: StyleProp<ViewStyle>;
}) {
  const label = getRewayahShortLabel(selection.rewayah);
  return (
    <View style={[pendingStyles.container, style]}>
      {selection.status === 'loading' ? (
        <ActivityIndicator size="small" color={theme.colors.textSecondary} />
      ) : (
        <Text
          style={[
            pendingStyles.text,
            {color: Color(theme.colors.text).alpha(0.6).toString()},
          ]}>
          {selection.status === 'invalid'
            ? `Not a numbered verse in ${label}.`
            : `Couldn't load the ${label} text.`}
        </Text>
      )}
    </View>
  );
}

const pendingStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(40),
    paddingHorizontal: moderateScale(16),
  },
  text: {
    fontSize: moderateScale(13),
    fontFamily: 'Manrope-Medium',
    textAlign: 'center',
  },
});
// @ai-end

export const VerseActionsSheet = (props: SheetProps<'verse-actions'>) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const [activeScreen, setActiveScreenRaw] = useState<ActiveScreen>(null);

  const setActiveScreen = useCallback((screen: ActiveScreen) => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(250, 'easeInEaseOut', 'opacity'),
    );
    setActiveScreenRaw(screen);
  }, []);

  const hideCurrentSheet = useCallback(() => {
    SheetManager.hide(props.sheetId).catch(error => {
      console.warn('[VerseActionsSheet] Failed to hide sheet:', error);
    });
  }, [props.sheetId]);

  const payload = props.payload;
  const verseKey = payload?.verseKey ?? '';
  const surahNumber = payload?.surahNumber ?? 0;
  const ayahNumber = payload?.ayahNumber ?? 0;
  const verseKeys = payload?.verseKeys;
  const unitKeys = payload?.unitKeys; // @ai
  const source = payload?.source;

  const selectedTranslationId = useMushafSettingsStore(
    s => s.selectedTranslationId,
  );

  const mushafRewayah = useMushafSettingsStore(s => s.rewayah);
  const resolvedRewayah = payload?.rewayah ?? mushafRewayah;

  // @ai-start
  // The verses this sheet acts on, in the shown rewayah's OWN numbering
  // (decision 3): the payload's unit keys, or the rewayah verses holding its
  // Hafs verses. Header, copy, share, bookmark / highlight / note rows and
  // playback all read this selection. Hafs: the payload's Hafs keys, as
  // before (see components/share/rewayahVerseSelection.ts).
  const selectionRequest = useMemo<VerseSelectionRequest>(
    () => ({
      rewayah: resolvedRewayah,
      verseKey,
      surahNumber,
      ayahNumber,
      verseKeys,
      unitKeys,
    }),
    [resolvedRewayah, verseKey, surahNumber, ayahNumber, verseKeys, unitKeys],
  );
  const selection = useVerseSelection(selectionRequest);
  const readySelection = selection.status === 'ready' ? selection : null;
  const isRange = readySelection
    ? readySelection.isRange
    : (unitKeys ?? verseKeys ?? []).length > 1;

  // Arabic text always comes from the resolved rewayah's words DB (loaded on
  // demand when it is not the active one), never from the static Hafs JSON
  // and never from a caller-supplied string of unknown rewayah. Another
  // rewayah's verses are its verse units: exactly their slots.
  const arabicTexts = useSelectionVerseTexts(selection);
  const [isCopying, setIsCopying] = useState(false);

  // Translations are Hafs-aligned: every Hafs verse the selection reads,
  // once, with a note under a Hafs verse the rewayah divides (contract 4.6).
  // The caller's translation (the player passes the one it shows) is its
  // verse's: used, as before, when the selection reads exactly that one
  // Hafs verse; any other selection uses the selected translation for every
  // Hafs verse, so one copy never mixes two translations.
  const translationFor = useCallback(
    (ready: ReadyVerseSelection) => {
      const parts = selectionTranslationParts(ready);
      const callerTranslation =
        parts.length === 1 && parts[0].hafsKey === verseKey
          ? payload?.translation
          : undefined;
      return joinTranslationParts(
        parts,
        hafsKey =>
          callerTranslation ||
          getTranslationTextRaw(hafsKey, selectedTranslationId) ||
          '',
      );
    },
    [verseKey, payload?.translation, selectedTranslationId],
  );

  // The selection for an action, waiting (bounded) for another rewayah's
  // verse units while they load; null after telling the user why nothing
  // could be done.
  const requireSelection = useRequireSelection(selection, selectionRequest);
  // @ai-end

  const surah = surahData.find(
    (s: {id: number; name: string}) => s.id === selection.surahNumber, // @ai
  );
  const surahName = surah?.name ?? '';

  // @ai-start
  // "2:1", "2:1-3" or "2:286 - 3:2" in the shown rewayah's numbering; no
  // number until its verses can be named (never a Hafs number under a
  // rewayah's name).
  const verseRefText = readySelection ? readySelection.label : '';

  // Rows are stored by each verse's Hafs anchor, and a verse is marked by
  // any row that names one of its slots, legacy rows included (contract
  // section 3; see verse-actions/selectionAnnotations.ts). Hafs: the Hafs
  // keys themselves, as before.
  const isBookmarked = useSelectionBookmarked(readySelection);
  const isHighlighted = useSelectionHighlightColor(readySelection) !== null;

  const pendingSelection: PendingVerseSelection | null =
    selection.status === 'ready' ? null : selection;
  // Where the pagers (translation, tafsir) and the Hafs-part screens (theme,
  // word by word) start in another rewayah; undefined for Hafs, whose
  // screens page Hafs verses as before.
  const unitStart = useMemo(
    () =>
      readySelection?.model && readySelection.units
        ? {model: readySelection.model, unit: readySelection.units[0]}
        : undefined,
    [readySelection],
  );
  // @ai-end

  const handleToggleBookmark = useCallback(async () => {
    lightHaptics();
    // @ai-start
    const ready = readySelection ?? (await requireSelection('saved'));
    if (!ready) return;
    // @ai-end
    // A persistence failure must never strand the sheet open: without this
    // guard a rejected write skipped both the optimistic store update and
    // SheetManager.hide, freezing the sheet with no feedback. The DB write is
    // now idempotent (INSERT OR IGNORE) so the duplicate case can't reject at
    // all; this is the belt-and-braces for anything else (disk, migration).
    // @ai
    try {
      // Removing deletes every row that marks a selected verse; adding
      // writes one row per verse at its anchor. @ai
      await setSelectionBookmarked(ready, !isBookmarked); // @ai
    } catch (error) {
      console.error('[VerseActionsSheet] Bookmark toggle failed:', error);
    }
    await SheetManager.hide(props.sheetId);
  }, [
    readySelection, // @ai
    requireSelection, // @ai
    isBookmarked,
    props.sheetId,
  ]);

  const handleHighlight = useCallback(async () => {
    // @ai-start
    // Highlighted implies a ready selection (its rows were looked up).
    // Removing deletes every row that marks a selected verse.
    if (isHighlighted && readySelection) {
      lightHaptics();
      await setSelectionHighlight(readySelection, null);
      hideCurrentSheet();
    } else {
      setActiveScreen('highlight');
    }
    // @ai-end
  }, [readySelection, isHighlighted, hideCurrentSheet]);

  const handleNote = useCallback(() => {
    setActiveScreen('note');
  }, []);

  // @ai-start
  const handleCopy = useCallback(async () => {
    if (isCopying) return;
    lightHaptics();
    setIsCopying(true);
    try {
      // Waits (bounded) for the rewayah's verses and words when they are
      // still loading.
      const ready = readySelection ?? (await requireSelection('copied'));
      if (!ready) return;
      const result =
        ready === selection && arabicTexts.status === 'ready'
          ? arabicTexts
          : await resolveSelectionTexts(ready);
      if (result.status !== 'ready') {
        showToast(
          `Couldn't load the ${getRewayahShortLabel(resolvedRewayah)} text`,
          'Nothing was copied. Please try again.',
          'error',
        );
        return;
      }
      if (hasNoOwnText(result.texts)) {
        showToast('Nothing to copy', noOwnTextMessage(result.rewayah), 'error');
        return;
      }
      // Each verse exactly as the mushaf shows it, with its own marker; the
      // citation in the rewayah's numbering ("Quran 2:1 · Warsh").
      await Clipboard.setStringAsync(
        formatVerseCopyText(
          joinVerseTexts(result.texts),
          translationFor(ready),
          formatQuranCitation(ready.label, result.rewayah),
        ),
      );
      await SheetManager.hide(props.sheetId);
    } finally {
      setIsCopying(false);
    }
  }, [
    isCopying,
    readySelection,
    requireSelection,
    selection,
    arabicTexts,
    resolvedRewayah,
    translationFor,
    props.sheetId,
  ]);
  // @ai-end

  const handleShare = useCallback(() => {
    lightHaptics();
    setActiveScreen('share');
  }, []);

  const handleTranslation = useCallback(() => {
    setActiveScreen('translation');
  }, []);

  const handleTafseer = useCallback(() => {
    setActiveScreen('tafseer');
  }, []);

  const handleTheme = useCallback(() => {
    setActiveScreen('theme');
  }, []);

  const handleWBW = useCallback(() => {
    setActiveScreen('wbw');
  }, []);

  // RFC-018 — open the community-reflections popup. Only reachable when a
  // fork wires branding.communityReflectionsProvider (the row is gated).
  const handleCommunityReflections = useCallback(() => {
    setActiveScreen('community-reflections');
  }, []);

  // QUL data: theme label and per-feature availability
  const [hasSimilarVerses, setHasSimilarVerses] = useState(false);
  const [hasSharedPhrases, setHasSharedPhrases] = useState(false);

  // @ai-start
  // QUL data is per Hafs verse: offered for a single verse that is exactly
  // one whole Hafs verse (Hafs: the payload's verse, as before).
  const qulKey = qulVerseKey(selection, {surahNumber, ayahNumber});

  useEffect(() => {
    if (!qulKey) return;
    let cancelled = false;
    const vk = qulKey;
    // @ai-end

    (async () => {
      const [similar, phrases] = await Promise.all([
        qulDataService.hasSimilarVerses(vk),
        qulDataService.hasSharedPhrases(vk),
      ]);
      if (cancelled) return;
      setHasSimilarVerses(similar);
      setHasSharedPhrases(phrases);
    })();

    return () => {
      cancelled = true;
    };
  }, [qulKey]); // @ai

  const handleSimilarVerses = useCallback(() => {
    setActiveScreen('similar');
  }, []);

  const handleSharedPhrases = useCallback(() => {
    setActiveScreen('phrases');
  }, []);

  const startPlaybackForSelection = useCallback(
    async (loop: boolean) => {
      lightHaptics();
      // @ai-start
      const ready = readySelection ?? (await requireSelection('played'));
      if (!ready) return;
      // Until the audio store takes verse units (area B), playback runs on
      // the Hafs verses holding the selection: from the Hafs verse holding
      // its first word to the last Hafs verse it reads. Hafs: the first and
      // last selected verses, as before.
      const {firstHafsKey: firstKey, lastHafsKey: lastKey} =
        selectionPlaybackKeys(ready);
      // @ai-end
      const store = useMushafPlayerStore.getState();

      if (!store.rewayatId) {
        const page =
          digitalKhattDataService.getPageForVerse(firstKey) ||
          store.currentPage ||
          1;
        useMushafPlayerStore.setState({
          currentPage: page,
          pendingStartVerseKey: firstKey,
        });
        await SheetManager.hide(props.sheetId);
        SheetManager.show('mushaf-player-options', {
          payload: {currentPage: page},
        });
        return;
      }

      const [startS, startA] = firstKey.split(':').map(Number);
      const [endS, endA] = lastKey.split(':').map(Number);

      const page =
        digitalKhattDataService.getPageForVerse(firstKey) ||
        store.currentPage ||
        1;

      store.stop();

      if (loop) {
        store.setRange(
          {surah: startS, ayah: startA},
          {surah: endS, ayah: endA},
        );
        // One Hafs verse repeats as a verse; several (a range, or one
        // rewayah verse spanning Hafs verses) loop as a range. @ai
        store.setVerseRepeatCount(firstKey !== lastKey ? 1 : 0);
        store.setRangeRepeatCount(0);
      } else {
        const surahInfo = surahData.find((s: {id: number}) => s.id === startS);
        const lastAyah = surahInfo?.verses_count ?? endA;
        store.setRange(
          {surah: startS, ayah: startA},
          {surah: startS, ayah: lastAyah},
        );
        store.setVerseRepeatCount(1);
        store.setRangeRepeatCount(1);
      }

      hideCurrentSheet();
      store.startPlayback(page, firstKey);
    },
    [readySelection, requireSelection, props.sheetId, hideCurrentSheet], // @ai
  );

  const handlePlaySelection = useCallback(
    () => startPlaybackForSelection(false),
    [startPlaybackForSelection],
  );

  const handleRepeatSelection = useCallback(
    () => startPlaybackForSelection(true),
    [startPlaybackForSelection],
  );

  const isCurrentTrackTimestamped = useCallback(() => {
    const playerState = usePlayerStore.getState();
    const currentTrack =
      playerState.queue.tracks[playerState.queue.currentIndex];
    const trackRewayatId = currentTrack?.rewayatId;
    if (!trackRewayatId) return false;
    return useTimestampStore.getState().supportedRewayatIds.has(trackRewayatId);
  }, []);

  const handleShowFollowAlong = useCallback(async () => {
    lightHaptics();
    await SheetManager.hide(props.sheetId);
    SheetManager.show('follow-along');
  }, [props.sheetId]);

  const handlePlayerPlayFromHere = useCallback(async () => {
    lightHaptics();
    // @ai-start
    const ready = readySelection ?? (await requireSelection('played'));
    if (!ready) return;
    const firstKey = selectionPlaybackKeys(ready).firstHafsKey;

    // While the surah's timings or the reciter's verse numbering are still
    // loading, or when the surah has no timing, it failed to load (retried
    // by this request), the numbering cannot be established or the player
    // has moved on to another surah, say so instead of silently keeping the
    // sheet open.
    const target = resolvePlayFromHere(firstKey);
    if (target.status !== 'ready') {
      showToast(
        target.title,
        target.message,
        target.status === 'pending' ? 'none' : 'error',
      );
      return;
    }

    const playerState = usePlayerStore.getState();
    playerState.seekTo(target.entry.timestampFrom / 1000);
    if (playerState.playback.state !== 'playing') {
      playerState.play();
    }
    // Every Hafs verse the reciter verse recites (Warsh 2:1 = Hafs 2:1 + 2:2)
    useTimestampStore.getState().setCurrentAyah(target.tracking);
    // @ai-end

    hideCurrentSheet();
  }, [readySelection, requireSelection, hideCurrentSheet]); // @ai

  const handlePlayerRepeat = useCallback(async () => {
    lightHaptics();
    // @ai-start
    const ready = readySelection ?? (await requireSelection('played'));
    if (!ready) return;
    const firstKey = selectionPlaybackKeys(ready).firstHafsKey;
    // Another rewayah's verse also passes its storage anchor (verse-units
    // contract 4.4: "1:7" for Warsh 1:6, "1:7:5" for Warsh 1:7), so the
    // mushaf selects exactly that verse rather than every verse holding Hafs
    // surah:ayah (both Warsh 1:6 and 1:7). surah / ayah stay Hafs; Hafs
    // passes no anchor, as before.
    const anchorKey = ready.units ? ready.anchors[0].key : null;
    // @ai-end
    const [sStr, aStr] = firstKey.split(':');
    const sNum = parseInt(sStr, 10);
    const aNum = parseInt(aStr, 10);

    const playerState = usePlayerStore.getState();
    const currentTrack =
      playerState.queue.tracks[playerState.queue.currentIndex];
    const trackRewayatId = currentTrack?.rewayatId;
    const trackReciterName = currentTrack?.reciterName;

    const page =
      digitalKhattDataService.getPageForVerse(firstKey) ||
      useMushafPlayerStore.getState().currentPage ||
      1;

    const mushafStore = useMushafPlayerStore.getState();
    if (trackRewayatId && trackReciterName) {
      mushafStore.setReciter(trackRewayatId, trackReciterName);
    }
    useMushafPlayerStore.setState({currentPage: page});

    if (playerState.playback.state === 'playing') {
      playerState.pause();
    }

    await SheetManager.hide(props.sheetId);
    playerState.setSheetMode('hidden');

    useMushafPlayerStore.setState({
      currentPage: page,
      pendingStartVerseKey: firstKey,
    });

    router.push({
      pathname: '/mushaf',
      params: {
        page: String(page),
        surah: String(sNum),
        ayah: String(aNum),
        ...(anchorKey !== null ? {anchor: anchorKey} : {}), // @ai
      },
    });

    SheetManager.show('mushaf-player-options', {
      payload: {currentPage: page},
    });
  }, [readySelection, requireSelection, props.sheetId]); // @ai

  useEffect(() => {
    if (Platform.OS !== 'android' || !activeScreen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setActiveScreen(null);
      return true;
    });
    return () => sub.remove();
  }, [activeScreen]);

  const handleOnClose = useCallback(() => {
    setActiveScreen(null);
    useVerseSelectionStore.getState().clearSelection();
    useMushafVerseSelectionStore.getState().clearSelection();
  }, []);

  const handleDismiss = useCallback(() => {
    hideCurrentSheet();
  }, [hideCurrentSheet]);

  const handleBack = useCallback(() => {
    setActiveScreen(null);
  }, []);

  if (!payload) return null;

  const isSimilar = activeScreen === 'similar' || activeScreen === 'phrases';
  const isFullScreen =
    activeScreen === 'translation' ||
    activeScreen === 'tafseer' ||
    activeScreen === 'theme' ||
    activeScreen === 'wbw' ||
    activeScreen === 'community-reflections';

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={[
        styles.sheetContainer,
        activeScreen && {height: SHEET_HEIGHT},
      ]}
      indicatorStyle={activeScreen ? {height: 0} : styles.indicator}
      gestureEnabled={true}
      onClose={handleOnClose}>
      <View style={[styles.container, activeScreen && {flex: 1}]}>
        {!activeScreen && (
          <View style={styles.header}>
            <Text style={styles.surahName}>{surahName}</Text>
            <Text style={styles.verseRef}>{verseRefText}</Text>
          </View>
        )}

        {activeScreen ? (
          <>
            <View style={styles.backRowContainer}>
              <Pressable
                onPress={handleBack}
                style={({pressed}) => [
                  styles.backRow,
                  pressed && {opacity: 0.6},
                ]}
                hitSlop={8}>
                <Feather
                  name="chevron-left"
                  size={moderateScale(16)}
                  color={theme.colors.text}
                />
                <Text style={styles.backRowText}>
                  {SCREEN_TITLES[activeScreen] ?? 'Back'}
                </Text>
              </Pressable>
              {(activeScreen === 'translation' ||
                activeScreen === 'tafseer') && (
                <Pressable
                  onPress={() => {
                    lightHaptics();
                    hideCurrentSheet();
                    usePlayerStore.getState().setSheetMode('hidden');
                    setTimeout(() => {
                      router.push('/(tabs)/(a.home)/translations');
                    }, 300);
                  }}
                  style={({pressed}) => [
                    styles.settingsButton,
                    pressed && {opacity: 0.6},
                  ]}
                  hitSlop={8}>
                  <Feather
                    name="settings"
                    size={moderateScale(16)}
                    color={Color(theme.colors.text).alpha(0.5).toString()}
                  />
                </Pressable>
              )}
            </View>
            {/* @ai-start */}
            {/* Every screen acts on the selected verses; until another
                rewayah's verses can be named, a screen shows why instead
                (never Hafs numbers under that rewayah's name). Hafs is
                always ready. */}
            {pendingSelection ? (
              <SelectionPendingView
                selection={pendingSelection}
                theme={theme}
                style={isFullScreen ? {flex: 1} : undefined}
              />
            ) : isFullScreen ? (
              <View style={{flex: 1}}>
                {activeScreen === 'translation' && (
                  <TranslationContent
                    surahNumber={surahNumber}
                    ayahNumber={ayahNumber}
                    rewayah={resolvedRewayah}
                    unitStart={unitStart}
                    onBack={handleBack}
                  />
                )}
                {activeScreen === 'tafseer' && (
                  <TafseerContent
                    surahNumber={surahNumber}
                    ayahNumber={ayahNumber}
                    rewayah={resolvedRewayah}
                    unitStart={unitStart}
                    onBack={handleBack}
                  />
                )}
                {activeScreen === 'theme' && (
                  <ThemeContent
                    surahNumber={surahNumber}
                    ayahNumber={ayahNumber}
                    unitStart={unitStart}
                    onBack={handleBack}
                  />
                )}
                {activeScreen === 'wbw' && (
                  <WBWContent
                    surahNumber={surahNumber}
                    ayahNumber={ayahNumber}
                    rewayah={resolvedRewayah}
                    unitStart={unitStart}
                    onBack={handleBack}
                  />
                )}
                {activeScreen === 'community-reflections' && readySelection && (
                  // Reflections are per Hafs verse: the one holding the
                  // verse's first word; the badge is the verse's own label.
                  <CommunityReflectionsContent
                    surahNumber={readySelection.linkVerse.surah}
                    ayahNumber={readySelection.linkVerse.ayah}
                    label={
                      readySelection.units ? readySelection.label : undefined
                    }
                  />
                )}
              </View>
            ) : readySelection ? (
              <>
                {activeScreen === 'highlight' && (
                  <HighlightContent
                    selection={readySelection}
                    onDone={handleDismiss}
                  />
                )}
                {activeScreen === 'note' && (
                  <NoteContent
                    selection={readySelection}
                    onDone={handleDismiss}
                  />
                )}
                {activeScreen === 'share' && (
                  <ShareContent
                    verseKey={verseKey}
                    surahNumber={surahNumber}
                    ayahNumber={ayahNumber}
                    verseKeys={verseKeys}
                    unitKeys={
                      readySelection.units ? readySelection.keys : undefined
                    }
                    rewayah={resolvedRewayah}
                    onDone={handleDismiss}
                  />
                )}
                {isSimilar && qulKey && (
                  <SimilarVersesContent
                    verseKey={qulKey}
                    surahNumber={surahNumber}
                    ayahNumber={ayahNumber}
                    section={activeScreen === 'similar' ? 'similar' : 'phrases'}
                    rewayah={resolvedRewayah} // @ai
                    onDone={handleDismiss}
                    hafsReferences={resolvedRewayah !== 'hafs'}
                  />
                )}
              </>
            ) : null}
            {/* @ai-end */}
          </>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{paddingBottom: moderateScale(10)}}>
            {/* LISTEN */}
            <View style={styles.card}>
              <Pressable
                style={({pressed}) => [
                  styles.option,
                  pressed && styles.optionPressed,
                ]}
                onPress={
                  source === 'player'
                    ? isCurrentTrackTimestamped()
                      ? handlePlayerPlayFromHere
                      : handleShowFollowAlong
                    : handlePlaySelection
                }>
                <PlayIcon size={moderateScale(18)} color={theme.colors.text} />
                <Text style={styles.optionText}>
                  {isRange ? 'Play Selection' : 'Play from Here'}
                </Text>
              </Pressable>
              <View style={styles.divider} />
              <Pressable
                style={({pressed}) => [
                  styles.option,
                  pressed && styles.optionPressed,
                ]}
                onPress={
                  source === 'player'
                    ? isCurrentTrackTimestamped()
                      ? handlePlayerRepeat
                      : handleShowFollowAlong
                    : handleRepeatSelection
                }>
                <RepeatIcon
                  size={moderateScale(24)}
                  color={theme.colors.text}
                />
                <Text style={styles.optionText}>Repeat</Text>
              </Pressable>
            </View>

            {/* STUDY */}
            <View style={styles.card}>
              <Pressable
                style={({pressed}) => [
                  styles.option,
                  pressed && styles.optionPressed,
                ]}
                onPress={handleToggleBookmark}>
                <Feather
                  name={isBookmarked ? 'minus-circle' : 'bookmark'}
                  size={moderateScale(18)}
                  color={theme.colors.text}
                />
                <Text style={styles.optionText}>
                  {isBookmarked ? 'Remove Bookmark' : 'Bookmark'}
                </Text>
              </Pressable>
              <View style={styles.divider} />
              <Pressable
                style={({pressed}) => [
                  styles.option,
                  pressed && styles.optionPressed,
                ]}
                onPress={handleHighlight}>
                {isHighlighted ? (
                  <Feather
                    name="minus-circle"
                    size={moderateScale(18)}
                    color={theme.colors.text}
                  />
                ) : (
                  <HighlightIcon
                    size={moderateScale(18)}
                    color={theme.colors.text}
                  />
                )}
                <Text style={styles.optionText}>
                  {isHighlighted ? 'Remove Highlight' : 'Highlight'}
                </Text>
              </Pressable>
              <View style={styles.divider} />
              <Pressable
                style={({pressed}) => [
                  styles.option,
                  pressed && styles.optionPressed,
                ]}
                onPress={handleNote}>
                <PageQuillIcon
                  size={moderateScale(18)}
                  color={theme.colors.text}
                />
                <Text style={styles.optionText}>Add Note</Text>
              </Pressable>
            </View>

            {/* EXPLORE */}
            <View style={styles.card}>
              <Pressable
                style={({pressed}) => [
                  styles.option,
                  pressed && styles.optionPressed,
                ]}
                onPress={handleTranslation}>
                <MaterialCommunityIcons
                  name="translate"
                  size={moderateScale(19)}
                  color={theme.colors.text}
                />
                <Text style={styles.optionText}>Translation</Text>
              </Pressable>
              {!isRange ? (
                <>
                  <View style={styles.divider} />
                  <Pressable
                    style={({pressed}) => [
                      styles.option,
                      pressed && styles.optionPressed,
                    ]}
                    onPress={handleTafseer}>
                    <StackedVolumesIcon
                      size={moderateScale(18)}
                      color={theme.colors.text}
                    />
                    <Text style={styles.optionText}>Tafseer</Text>
                  </Pressable>
                </>
              ) : null}
              {!isRange ? (
                <>
                  <View style={styles.divider} />
                  <Pressable
                    style={({pressed}) => [
                      styles.option,
                      pressed && styles.optionPressed,
                    ]}
                    onPress={handleTheme}>
                    <GroupedLinesIcon
                      size={moderateScale(18)}
                      color={theme.colors.text}
                    />
                    <Text style={styles.optionText}>Theme</Text>
                  </Pressable>
                </>
              ) : null}
              {!isRange ? (
                <>
                  <View style={styles.divider} />
                  <Pressable
                    style={({pressed}) => [
                      styles.option,
                      pressed && styles.optionPressed,
                    ]}
                    onPress={handleWBW}>
                    <BreakdownIcon
                      size={moderateScale(18)}
                      color={theme.colors.text}
                    />
                    <Text style={styles.optionText}>Word by Word</Text>
                  </Pressable>
                </>
              ) : null}
              {/* RFC-018 — Community Reflections row. Gated on a fork wiring
                  branding.communityReflectionsProvider (so Bayaan never shows
                  it) and single-ayah selection. Same predicate as the inline
                  slot + settings toggle; no new seam. */}
              {branding.communityReflectionsProvider && !isRange ? (
                <>
                  <View style={styles.divider} />
                  <Pressable
                    style={({pressed}) => [
                      styles.option,
                      pressed && styles.optionPressed,
                    ]}
                    onPress={handleCommunityReflections}>
                    <MaterialCommunityIcons
                      name="comment-quote-outline"
                      size={moderateScale(19)}
                      color={theme.colors.text}
                    />
                    <Text style={styles.optionText}>Community Reflections</Text>
                  </Pressable>
                </>
              ) : null}
              {hasSimilarVerses && !isRange ? (
                <>
                  <View style={styles.divider} />
                  <Pressable
                    style={({pressed}) => [
                      styles.option,
                      pressed && styles.optionPressed,
                    ]}
                    onPress={handleSimilarVerses}>
                    <MirrorWavesIcon
                      size={moderateScale(18)}
                      color={theme.colors.text}
                    />
                    <Text style={styles.optionText}>Similar Verses</Text>
                  </Pressable>
                </>
              ) : null}
              {hasSharedPhrases && !isRange ? (
                <>
                  <View style={styles.divider} />
                  <Pressable
                    style={({pressed}) => [
                      styles.option,
                      pressed && styles.optionPressed,
                    ]}
                    onPress={handleSharedPhrases}>
                    <ChainLinksIcon
                      size={moderateScale(18)}
                      color={theme.colors.text}
                    />
                    <Text style={styles.optionText}>Shared Phrases</Text>
                  </Pressable>
                </>
              ) : null}
            </View>

            {/* SHARE */}
            <View style={styles.card}>
              <Pressable
                style={({pressed}) => [
                  styles.option,
                  pressed && styles.optionPressed,
                ]}
                onPress={handleCopy}
                // @ai-start
                disabled={isCopying}
                accessibilityState={{busy: isCopying}}>
                {isCopying ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.text}
                    style={{width: moderateScale(18)}}
                  />
                ) : (
                  <CopyIcon
                    size={moderateScale(18)}
                    color={theme.colors.text}
                  />
                )}
                {/* @ai-end */}
                <Text style={styles.optionText}>Copy</Text>
              </Pressable>
              <View style={styles.divider} />
              <Pressable
                style={({pressed}) => [
                  styles.option,
                  pressed && styles.optionPressed,
                ]}
                onPress={handleShare}>
                <ShareIcon size={moderateScale(18)} color={theme.colors.text} />
                <Text style={styles.optionText}>Share</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </View>
    </ActionSheet>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: Color(theme.colors.text).alpha(0.08).toString(),
      paddingTop: moderateScale(8),
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
      height: 2.5,
    },
    container: {
      paddingHorizontal: moderateScale(20),
      paddingBottom: moderateScale(30),
    },
    header: {
      alignItems: 'center',
      marginTop: moderateScale(4),
      marginBottom: moderateScale(14),
      gap: moderateScale(2),
    },
    surahName: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    verseRef: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      textAlign: 'center',
    },
    card: {
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      borderRadius: moderateScale(12),
      overflow: 'hidden',
      marginBottom: moderateScale(8),
    },
    divider: {
      height: 1,
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      marginHorizontal: moderateScale(14),
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(11),
      paddingHorizontal: moderateScale(14),
    },
    optionPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    optionText: {
      flex: 1,
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginLeft: moderateScale(10),
    },
    backRowContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: moderateScale(10),
    },
    backRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(2),
    },
    settingsButton: {
      padding: moderateScale(4),
    },
    backRowText: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
  });
