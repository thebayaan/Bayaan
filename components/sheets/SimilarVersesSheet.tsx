import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  LayoutAnimation,
  type LayoutChangeEvent,
} from 'react-native';
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import ActionSheet, {
  SheetProps,
  SheetManager,
  ScrollView,
} from 'react-native-actions-sheet';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {qulDataService} from '@/services/mushaf/QulDataService';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {useMushafNavigationStore} from '@/store/mushafNavigationStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useTajweedStore} from '@/store/tajweedStore';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import SkiaVerseText from '@/components/player/v2/PlayerContent/QuranView/SkiaVerseText';
import type {SimilarAyah, MutashabihatPhrase} from '@/types/qul';

const surahData = require('@/data/surahData.json') as Array<{
  id: number;
  name: string;
  name_arabic: string;
}>;

function getSurahName(surahNumber: number): string {
  return surahData.find(s => s.id === surahNumber)?.name ?? '';
}

function parseVerseKey(verseKey: string): {surah: number; ayah: number} {
  const [s, a] = verseKey.split(':');
  return {surah: parseInt(s, 10), ayah: parseInt(a, 10)};
}

function getPhraseText(
  sourceVerse: string,
  wordFrom: number,
  wordTo: number,
): string {
  const words = digitalKhattDataService.getVerseWords(sourceVerse);
  if (words.length === 0) return '';
  return words
    .filter(
      w => w.wordPositionInVerse >= wordFrom && w.wordPositionInVerse <= wordTo,
    )
    .map(w => w.text)
    .join(' ');
}

function getVersePreview(verseKey: string): string {
  return digitalKhattDataService.getVerseText(verseKey);
}

export const SimilarVersesSheet = (props: SheetProps<'similar-verses'>) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const mushafRenderer = useMushafSettingsStore(s => s.mushafRenderer);
  const arabicTextWeight = useMushafSettingsStore(s => s.arabicTextWeight);
  const showTajweed = useMushafSettingsStore(s => s.showTajweed);
  const indexedTajweedData = useTajweedStore(s => s.indexedTajweedData);
  const fontMgr = mushafPreloadService.fontMgr;
  const fontFamily =
    mushafRenderer === 'dk_indopak'
      ? 'DigitalKhattIndoPak'
      : mushafRenderer === 'dk_v1'
        ? 'DigitalKhattV1'
        : 'DigitalKhattV2';
  const [contentWidth, setContentWidth] = useState(0);

  const handleContentLayout = useCallback((e: LayoutChangeEvent) => {
    setContentWidth(e.nativeEvent.layout.width);
  }, []);

  const skiaReady = !!fontMgr && contentWidth > 0;

  const verseKey = props.payload?.verseKey ?? '';
  const surahNumber = props.payload?.surahNumber ?? 0;
  const ayahNumber = props.payload?.ayahNumber ?? 0;
  const section = props.payload?.section;

  const surahName = useMemo(() => getSurahName(surahNumber), [surahNumber]);

  const [loading, setLoading] = useState(true);
  const [mutashabihat, setMutashabihat] = useState<MutashabihatPhrase[]>([]);
  const [similarAyahs, setSimilarAyahs] = useState<SimilarAyah[]>([]);
  const [expandedVerses, setExpandedVerses] = useState<Set<string>>(new Set());
  const [expandedPhrases, setExpandedPhrases] = useState<Set<number>>(
    new Set(),
  );
  const [showAllSimilar, setShowAllSimilar] = useState(false);

  const toggleVerse = useCallback((vk: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedVerses(prev => {
      const next = new Set(prev);
      next.has(vk) ? next.delete(vk) : next.add(vk);
      return next;
    });
  }, []);

  const togglePhraseExpand = useCallback((phraseId: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedPhrases(prev => {
      const next = new Set(prev);
      next.has(phraseId) ? next.delete(phraseId) : next.add(phraseId);
      return next;
    });
  }, []);

  const toggleShowAllSimilar = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowAllSimilar(prev => !prev);
  }, []);

  useEffect(() => {
    if (!verseKey) return;
    let cancelled = false;

    (async () => {
      const [mData, sData] = await Promise.all([
        section !== 'similar'
          ? qulDataService.getMutashabihatForVerse(verseKey)
          : Promise.resolve([]),
        section !== 'phrases'
          ? qulDataService.getSimilarAyahs(verseKey)
          : Promise.resolve([]),
      ]);
      if (cancelled) return;
      setMutashabihat(mData);
      setSimilarAyahs(sData);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [verseKey]);

  const handleVersePress = (targetVerseKey: string) => {
    const page = digitalKhattDataService.getPageForVerse(targetVerseKey);
    if (!page) return;
    useMushafNavigationStore.getState().navigateToVerse(targetVerseKey, page);
    SheetManager.hideAll();
  };

  if (!props.payload) return null;

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.surahName}>{surahName}</Text>
          <Text style={styles.verseRef}>
            {surahNumber}:{ayahNumber}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator
            size="small"
            color={theme.colors.textSecondary}
            style={styles.loader}
          />
        ) : (
          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
            onLayout={handleContentLayout}>
            {mutashabihat.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Feather
                    name="link"
                    size={moderateScale(14)}
                    color={theme.colors.textSecondary}
                  />
                  <Text style={styles.sectionTitle}>Shared Phrases</Text>
                </View>

                {mutashabihat.map(phrase => {
                  const phraseText = getPhraseText(
                    phrase.sourceVerse,
                    phrase.sourceWordRange[0],
                    phrase.sourceWordRange[1],
                  );
                  const otherMatches = phrase.matches.filter(
                    m => m.verseKey !== verseKey,
                  );
                  if (otherMatches.length === 0) return null;
                  return (
                    <View key={phrase.phraseId} style={styles.phraseCard}>
                      {phraseText && skiaReady ? (
                        <View style={styles.skiaArabicWrap}>
                          <SkiaVerseText
                            text={phraseText}
                            fontMgr={fontMgr!}
                            fontFamily={fontFamily}
                            fontSize={moderateScale(18)}
                            textColor={theme.colors.text}
                            showTajweed={false}
                            width={contentWidth - moderateScale(28)}
                            indexedTajweedData={null}
                            arabicTextWeight={arabicTextWeight}
                          />
                        </View>
                      ) : null}
                      <Text style={styles.phraseCount}>
                        Found in {phrase.totalOccurrences} verses
                      </Text>
                      {(expandedPhrases.has(phrase.phraseId)
                        ? otherMatches
                        : otherMatches.slice(0, 10)
                      ).map(match => {
                        const parsed = parseVerseKey(match.verseKey);
                        const matchSurahName = getSurahName(parsed.surah);
                        const isVerseExpanded = expandedVerses.has(
                          match.verseKey,
                        );
                        return (
                          <View key={match.verseKey}>
                            <Pressable
                              style={({pressed}) => [
                                styles.matchRow,
                                pressed && styles.matchRowPressed,
                              ]}
                              onPress={() => toggleVerse(match.verseKey)}>
                              <Feather
                                name={
                                  isVerseExpanded
                                    ? 'chevron-up'
                                    : 'chevron-down'
                                }
                                size={moderateScale(14)}
                                color={theme.colors.textSecondary}
                              />
                              <Text style={styles.matchRef}>
                                {match.verseKey}
                              </Text>
                              <Text style={styles.matchSurah}>
                                {matchSurahName}
                              </Text>
                            </Pressable>
                            {isVerseExpanded && (
                              <View style={styles.matchExpanded}>
                                {skiaReady && (
                                  <View style={styles.skiaVerseWrap}>
                                    <SkiaVerseText
                                      verseKey={match.verseKey}
                                      fontMgr={fontMgr!}
                                      fontFamily={fontFamily}
                                      fontSize={moderateScale(18)}
                                      textColor={theme.colors.text}
                                      showTajweed={showTajweed}
                                      width={contentWidth - moderateScale(36)}
                                      indexedTajweedData={indexedTajweedData}
                                      arabicTextWeight={arabicTextWeight}
                                    />
                                  </View>
                                )}
                                <Pressable
                                  style={({pressed}) => [
                                    styles.goToVerse,
                                    pressed && styles.goToVersePressed,
                                  ]}
                                  onPress={() =>
                                    handleVersePress(match.verseKey)
                                  }>
                                  <Text style={styles.goToVerseText}>
                                    Go to verse
                                  </Text>
                                  <Feather
                                    name="arrow-right"
                                    size={moderateScale(14)}
                                    color={theme.colors.text}
                                  />
                                </Pressable>
                              </View>
                            )}
                          </View>
                        );
                      })}
                      {otherMatches.length > 10 && (
                        <Pressable
                          onPress={() => togglePhraseExpand(phrase.phraseId)}>
                          <Text style={styles.moreText}>
                            {expandedPhrases.has(phrase.phraseId)
                              ? 'Show less'
                              : `+${otherMatches.length - 10} more`}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {similarAyahs.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Feather
                    name="layers"
                    size={moderateScale(14)}
                    color={theme.colors.textSecondary}
                  />
                  <Text style={styles.sectionTitle}>Similar Wording</Text>
                </View>

                {(showAllSimilar
                  ? similarAyahs
                  : similarAyahs.slice(0, 20)
                ).map(similar => {
                  const parsed = parseVerseKey(similar.matchedVerseKey);
                  const matchSurahName = getSurahName(parsed.surah);
                  const preview = getVersePreview(similar.matchedVerseKey);
                  return (
                    <Pressable
                      key={similar.matchedVerseKey}
                      style={({pressed}) => [
                        styles.similarCard,
                        pressed && styles.similarCardPressed,
                      ]}
                      onPress={() => handleVersePress(similar.matchedVerseKey)}>
                      <View style={styles.similarHeader}>
                        <Text style={styles.similarRef}>
                          {similar.matchedVerseKey} · {matchSurahName}
                        </Text>
                        <Text style={styles.similarScore}>
                          {similar.score}%
                        </Text>
                      </View>
                      {preview && skiaReady ? (
                        <SkiaVerseText
                          text={preview}
                          fontMgr={fontMgr!}
                          fontFamily={fontFamily}
                          fontSize={moderateScale(16)}
                          textColor={theme.colors.textSecondary}
                          showTajweed={false}
                          width={contentWidth - moderateScale(28)}
                          indexedTajweedData={null}
                          arabicTextWeight={arabicTextWeight}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
                {similarAyahs.length > 20 && (
                  <Pressable onPress={toggleShowAllSimilar}>
                    <Text style={styles.moreText}>
                      {showAllSimilar
                        ? 'Show less'
                        : `+${similarAyahs.length - 20} more`}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}

            {mutashabihat.length === 0 && similarAyahs.length === 0 && (
              <Text style={styles.emptyText}>
                No similar verses found for this ayah.
              </Text>
            )}
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
      paddingTop: moderateScale(8),
      maxHeight: '85%',
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
      height: 2.5,
    },
    container: {
      paddingHorizontal: moderateScale(16),
      paddingBottom: moderateScale(40),
    },
    header: {
      alignItems: 'center',
      marginTop: moderateScale(8),
      marginBottom: moderateScale(16),
      gap: moderateScale(4),
    },
    surahName: {
      fontSize: moderateScale(20),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    verseRef: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    loader: {
      marginTop: verticalScale(40),
      marginBottom: verticalScale(40),
    },
    scrollContent: {
      flexShrink: 1,
    },
    section: {
      marginBottom: verticalScale(20),
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(6),
      marginBottom: moderateScale(12),
    },
    sectionTitle: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    phraseCard: {
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderRadius: moderateScale(12),
      padding: moderateScale(14),
      marginBottom: moderateScale(10),
    },
    skiaArabicWrap: {
      alignItems: 'flex-end',
      marginBottom: moderateScale(8),
    },
    phraseCount: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      marginBottom: moderateScale(6),
    },
    matchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(8),
      paddingHorizontal: moderateScale(4),
      borderRadius: moderateScale(8),
    },
    matchRowPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    matchRef: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginLeft: moderateScale(6),
      minWidth: moderateScale(50),
    },
    matchSurah: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      marginLeft: moderateScale(8),
    },
    matchExpanded: {
      paddingHorizontal: moderateScale(8),
      paddingBottom: moderateScale(10),
      borderTopWidth: 1,
      borderTopColor: Color(theme.colors.text).alpha(0.06).toString(),
      marginHorizontal: moderateScale(4),
    },
    skiaVerseWrap: {
      marginTop: moderateScale(8),
      marginBottom: moderateScale(8),
    },
    goToVerse: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-end',
      gap: moderateScale(4),
      paddingVertical: moderateScale(4),
      paddingHorizontal: moderateScale(8),
      borderRadius: moderateScale(6),
    },
    goToVersePressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    goToVerseText: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    moreText: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: moderateScale(4),
    },
    similarCard: {
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderRadius: moderateScale(12),
      padding: moderateScale(14),
      marginBottom: moderateScale(8),
    },
    similarCardPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    similarHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: moderateScale(6),
    },
    similarRef: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      flex: 1,
    },
    similarScore: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      marginLeft: moderateScale(8),
    },
    emptyText: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: verticalScale(30),
    },
  });
