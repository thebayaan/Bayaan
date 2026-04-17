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
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {useVerseSelectionStore} from '@/store/verseSelectionStore';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
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
import {useTimestampStore} from '@/store/timestampStore';
import {findAyahTimestamp} from '@/utils/timestampUtils';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {getTranslationTextRaw} from '@/utils/translationLookup';
import * as Clipboard from 'expo-clipboard';
import {getRewayahShortLabel} from '@/utils/rewayahLabels';
import {HighlightContent} from './verse-actions/HighlightContent';
import {NoteContent} from './verse-actions/NoteContent';
import {ShareContent} from './verse-actions/ShareContent';
import {SimilarVersesContent} from './verse-actions/SimilarVersesContent';
import {TranslationContent} from './verse-actions/TranslationContent';
import {TafseerContent} from './verse-actions/TafseerContent';
import {ThemeContent} from './verse-actions/ThemeContent';
import {WBWContent} from './verse-actions/WBWContent';

const surahData = require('@/data/surahData.json');
const quranVerses = require('@/data/quran.json');
const transliterationData = require('@/data/transliteration.json');

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
};

const SHEET_HEIGHT = Dimensions.get('window').height * 0.85;

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

  const payload = props.payload;
  const verseKey = payload?.verseKey ?? '';
  const surahNumber = payload?.surahNumber ?? 0;
  const ayahNumber = payload?.ayahNumber ?? 0;
  const verseKeys = payload?.verseKeys;
  const isRange = verseKeys && verseKeys.length > 1;
  const source = payload?.source;

  const selectedTranslationId = useMushafSettingsStore(
    s => s.selectedTranslationId,
  );

  const mushafRewayah = useMushafSettingsStore(s => s.rewayah);
  const resolvedRewayah = payload?.rewayah ?? mushafRewayah;

  const {arabicText, translation, transliteration} = useMemo(() => {
    // Prefer the rewayah-specific DK text so copy/share matches what the
    // user is actually reading (or listening to, if player passed its own
    // rewayah). Fall back to the static Hafs JSON only if DK has no entry.
    const resolveArabic = (vk: string): string => {
      const dk = digitalKhattDataService.getVerseText(vk, resolvedRewayah);
      if (dk) return dk;
      const legacy = (
        Object.values(quranVerses) as Array<{verse_key: string; text: string}>
      ).find(v => v.verse_key === vk)?.text;
      return legacy ?? '';
    };

    if (isRange) {
      const arabicParts: string[] = [];
      const translationParts: string[] = [];
      const transliterationParts: string[] = [];
      for (const vk of verseKeys) {
        const arabic = resolveArabic(vk);
        if (arabic) arabicParts.push(arabic);
        const trans = getTranslationTextRaw(vk, selectedTranslationId);
        if (trans) translationParts.push(trans);
        const translit = transliterationData[vk]?.t;
        if (translit) transliterationParts.push(translit);
      }
      return {
        arabicText: arabicParts.join('\n'),
        translation: translationParts.join('\n'),
        transliteration: transliterationParts.join('\n'),
      };
    }

    const resolvedArabic = payload?.arabicText || resolveArabic(verseKey);
    const resolvedTranslation =
      payload?.translation ||
      getTranslationTextRaw(verseKey, selectedTranslationId) ||
      '';
    const resolvedTransliteration =
      payload?.transliteration || transliterationData[verseKey]?.t || '';
    return {
      arabicText: resolvedArabic as string,
      translation: resolvedTranslation as string,
      transliteration: resolvedTransliteration as string,
    };
  }, [
    verseKey,
    verseKeys,
    isRange,
    payload?.arabicText,
    payload?.translation,
    payload?.transliteration,
    selectedTranslationId,
    resolvedRewayah,
  ]);

  const surah = surahData.find(
    (s: {id: number; name: string}) => s.id === surahNumber,
  );
  const surahName = surah?.name ?? '';

  const verseRefText = useMemo(() => {
    if (!isRange) return `${surahNumber}:${ayahNumber}`;
    const firstKey = verseKeys[0];
    const lastKey = verseKeys[verseKeys.length - 1];
    const [firstSurah, firstAyah] = firstKey.split(':');
    const [lastSurah, lastAyah] = lastKey.split(':');
    if (firstSurah === lastSurah) {
      return `${firstSurah}:${firstAyah}-${lastAyah}`;
    }
    return `${firstSurah}:${firstAyah} - ${lastSurah}:${lastAyah}`;
  }, [isRange, verseKeys, surahNumber, ayahNumber]);

  const isBookmarked = useVerseAnnotationsStore(state => {
    const keys = isRange ? verseKeys : [verseKey];
    return keys.every(vk => state.isBookmarked(vk));
  });
  const isHighlighted = useVerseAnnotationsStore(
    state => !!state.highlights[verseKey],
  );

  const handleToggleBookmark = useCallback(async () => {
    lightHaptics();
    const keys = isRange ? verseKeys : [verseKey];
    const store = useVerseAnnotationsStore.getState();
    if (isBookmarked) {
      for (const vk of keys) {
        await verseAnnotationService.removeBookmark(vk);
        store.removeBookmark(vk);
      }
    } else {
      for (const vk of keys) {
        const [s, a] = vk.split(':');
        await verseAnnotationService.addBookmark(
          vk,
          parseInt(s, 10),
          parseInt(a, 10),
        );
        store.addBookmark(vk);
      }
    }
    SheetManager.hideAll();
  }, [verseKey, verseKeys, isRange, isBookmarked]);

  const handleHighlight = useCallback(async () => {
    if (isHighlighted) {
      lightHaptics();
      const keys = isRange ? verseKeys : [verseKey];
      const store = useVerseAnnotationsStore.getState();
      for (const vk of keys) {
        await verseAnnotationService.removeHighlight(vk);
        store.removeHighlight(vk);
      }
      SheetManager.hideAll();
    } else {
      setActiveScreen('highlight');
    }
  }, [verseKey, verseKeys, isRange, isHighlighted]);

  const handleNote = useCallback(() => {
    setActiveScreen('note');
  }, []);

  const handleCopy = useCallback(async () => {
    lightHaptics();
    const parts: string[] = [];
    if (arabicText) parts.push(arabicText);
    if (translation) parts.push(translation);
    const ref =
      resolvedRewayah === 'hafs'
        ? `Quran ${verseRefText}`
        : `Quran ${verseRefText} · ${getRewayahShortLabel(resolvedRewayah)}`;
    parts.push(ref);
    await Clipboard.setStringAsync(parts.join('\n\n'));
    SheetManager.hideAll();
  }, [arabicText, translation, verseRefText, resolvedRewayah]);

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

  // QUL data: theme label and per-feature availability
  const [hasSimilarVerses, setHasSimilarVerses] = useState(false);
  const [hasSharedPhrases, setHasSharedPhrases] = useState(false);

  useEffect(() => {
    if (!surahNumber || !ayahNumber || isRange) return;
    let cancelled = false;
    const vk = `${surahNumber}:${ayahNumber}`;

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
  }, [surahNumber, ayahNumber, isRange]);

  const handleSimilarVerses = useCallback(() => {
    setActiveScreen('similar');
  }, []);

  const handleSharedPhrases = useCallback(() => {
    setActiveScreen('phrases');
  }, []);

  const startPlaybackForSelection = useCallback(
    async (loop: boolean) => {
      lightHaptics();
      const store = useMushafPlayerStore.getState();

      if (!store.rewayatId) {
        const keys = isRange ? verseKeys! : [verseKey];
        const firstKey = keys[0];
        const page =
          digitalKhattDataService.getPageForVerse(firstKey) ||
          store.currentPage ||
          1;
        useMushafPlayerStore.setState({
          currentPage: page,
          pendingStartVerseKey: firstKey,
        });
        await SheetManager.hideAll();
        SheetManager.show('mushaf-player-options', {
          payload: {currentPage: page},
        });
        return;
      }

      const keys = isRange ? verseKeys! : [verseKey];
      const firstKey = keys[0];
      const lastKey = keys[keys.length - 1];
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
        store.setVerseRepeatCount(isRange ? 1 : 0);
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

      SheetManager.hideAll();
      store.startPlayback(page, firstKey);
    },
    [verseKey, verseKeys, isRange],
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
    await SheetManager.hideAll();
    SheetManager.show('follow-along');
  }, []);

  const handlePlayerPlayFromHere = useCallback(() => {
    lightHaptics();
    const keys = isRange ? verseKeys! : [verseKey];
    const firstKey = keys[0];
    const [, ayahStr] = firstKey.split(':');
    const ayahNumber = parseInt(ayahStr, 10);

    const timestamps = useTimestampStore.getState().currentSurahTimestamps;
    if (!timestamps) return;

    const ts = findAyahTimestamp(timestamps, ayahNumber);
    if (!ts) return;

    const playerState = usePlayerStore.getState();
    playerState.seekTo(ts.timestampFrom / 1000);
    if (playerState.playback.state !== 'playing') {
      playerState.play();
    }
    useTimestampStore.getState().setCurrentAyah({
      surahNumber: ts.surahNumber,
      ayahNumber: ts.ayahNumber,
      verseKey: firstKey,
      timestampFrom: ts.timestampFrom,
      timestampTo: ts.timestampTo,
    });

    SheetManager.hideAll();
  }, [verseKey, verseKeys, isRange]);

  const handlePlayerRepeat = useCallback(async () => {
    lightHaptics();
    const keys = isRange ? verseKeys! : [verseKey];
    const firstKey = keys[0];
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

    await SheetManager.hideAll();
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
      },
    });

    SheetManager.show('mushaf-player-options', {
      payload: {currentPage: page},
    });
  }, [verseKey, verseKeys, isRange]);

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
    SheetManager.hideAll();
  }, []);

  const handleBack = useCallback(() => {
    setActiveScreen(null);
  }, []);

  if (!payload) return null;

  const isSimilar = activeScreen === 'similar' || activeScreen === 'phrases';
  const isFullScreen =
    activeScreen === 'translation' ||
    activeScreen === 'tafseer' ||
    activeScreen === 'theme' ||
    activeScreen === 'wbw';

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
                    SheetManager.hideAll();
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
            {isFullScreen ? (
              <View style={{flex: 1}}>
                {activeScreen === 'translation' && (
                  <TranslationContent
                    surahNumber={surahNumber}
                    ayahNumber={ayahNumber}
                    onBack={handleBack}
                  />
                )}
                {activeScreen === 'tafseer' && (
                  <TafseerContent
                    surahNumber={surahNumber}
                    ayahNumber={ayahNumber}
                    onBack={handleBack}
                  />
                )}
                {activeScreen === 'theme' && (
                  <ThemeContent
                    surahNumber={surahNumber}
                    ayahNumber={ayahNumber}
                    onBack={handleBack}
                  />
                )}
                {activeScreen === 'wbw' && (
                  <WBWContent
                    surahNumber={surahNumber}
                    ayahNumber={ayahNumber}
                    onBack={handleBack}
                  />
                )}
              </View>
            ) : (
              <>
                {activeScreen === 'highlight' && (
                  <HighlightContent
                    verseKey={verseKey}
                    surahNumber={surahNumber}
                    ayahNumber={ayahNumber}
                    verseKeys={verseKeys}
                    onDone={handleDismiss}
                  />
                )}
                {activeScreen === 'note' && (
                  <NoteContent
                    verseKey={verseKey}
                    surahNumber={surahNumber}
                    ayahNumber={ayahNumber}
                    verseKeys={verseKeys}
                    onDone={handleDismiss}
                  />
                )}
                {activeScreen === 'share' && (
                  <ShareContent
                    verseKey={verseKey}
                    surahNumber={surahNumber}
                    ayahNumber={ayahNumber}
                    verseKeys={verseKeys}
                    arabicText={arabicText}
                    translation={translation}
                    onDone={handleDismiss}
                  />
                )}
                {isSimilar && (
                  <SimilarVersesContent
                    verseKey={verseKey}
                    surahNumber={surahNumber}
                    ayahNumber={ayahNumber}
                    section={activeScreen === 'similar' ? 'similar' : 'phrases'}
                    onDone={handleDismiss}
                  />
                )}
              </>
            )}
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
                onPress={handleCopy}>
                <CopyIcon size={moderateScale(18)} color={theme.colors.text} />
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
