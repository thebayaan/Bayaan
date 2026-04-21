import React, {useState, useMemo, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {Feather} from '@expo/vector-icons';
import {router} from 'expo-router';
import {SheetManager} from 'react-native-actions-sheet';
import {lightHaptics} from '@/utils/haptics';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {StackedVolumesIcon} from '@/components/Icons';
import type {QuranData} from '@/types/quran';
import {useTafseerStore} from '@/store/tafseerStore';
import SkiaVersePreview from '@/components/share/SkiaVersePreview';
import {
  tafseerDbService,
  type TafseerResult,
} from '@/services/tafseer/TafseerDbService';
import {TafseerHtmlRenderer} from './TafseerHtmlRenderer';

// ─── Data loading (module scope, runs once) ───────────────────────────────
const quranData = require('@/data/quran.json') as QuranData;

// ─── Build global verse array sorted by id (1–6236) ──────────────────────
interface GlobalVerse {
  id: number;
  surahNumber: number;
  ayahNumber: number;
  verseKey: string;
  arabicText: string;
}

const allVerses: GlobalVerse[] = Object.values(quranData)
  .map(v => ({
    id: v.id,
    surahNumber: v.surah_number,
    ayahNumber: v.ayah_number,
    verseKey: v.verse_key,
    arabicText: v.text,
  }))
  .sort((a, b) => a.id - b.id);

const TOTAL_VERSES = allVerses.length; // 6236

// Lookup: verse_key → global index
const verseKeyToIndex: Record<string, number> = {};
for (let i = 0; i < allVerses.length; i++) {
  verseKeyToIndex[allVerses[i].verseKey] = i;
}

// ─── Component ────────────────────────────────────────────────────────────

interface TafseerContentProps {
  surahNumber: number;
  ayahNumber: number;
  rewayah?: import('@/store/mushafSettingsStore').RewayahId;
  onBack: () => void;
}

export const TafseerContent: React.FC<TafseerContentProps> = ({
  surahNumber,
  ayahNumber,
  rewayah,
  onBack,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const downloadedMeta = useTafseerStore(s => s.downloadedMeta);
  const selectedTafseerId = useTafseerStore(s => s.selectedTafseerId);
  const setSelectedTafseerId = useTafseerStore(s => s.setSelectedTafseerId);

  const initialVerseKey = `${surahNumber}:${ayahNumber}`;
  const initialIndex = verseKeyToIndex[initialVerseKey] ?? 0;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [tafseerResult, setTafseerResult] = useState<TafseerResult | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [showSelector, setShowSelector] = useState(false);

  const verse = allVerses[currentIndex];

  const activeTafseer = useMemo(
    () => downloadedMeta.find(m => m.identifier === selectedTafseerId),
    [downloadedMeta, selectedTafseerId],
  );

  // Load tafseer text when verse or tafseer changes
  useEffect(() => {
    if (!selectedTafseerId) {
      setTafseerResult(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    tafseerDbService
      .getTafseerForVerse(verse.verseKey, selectedTafseerId)
      .then(result => {
        if (!cancelled) {
          setTafseerResult(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTafseerResult(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [verse.verseKey, selectedTafseerId]);

  const isFirst = currentIndex === 0;
  const isLast = currentIndex === TOTAL_VERSES - 1;

  const goToPrevious = useCallback(() => {
    setCurrentIndex(i => Math.max(0, i - 1));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentIndex(i => Math.min(TOTAL_VERSES - 1, i + 1));
  }, []);

  const handleSelectTafseer = useCallback(
    (id: string) => {
      setSelectedTafseerId(id);
      setShowSelector(false);
    },
    [setSelectedTafseerId],
  );

  const hasNoTafaseer = downloadedMeta.length === 0;

  return (
    <View style={styles.container}>
      {/* Scrollable verse content */}
      <ScrollView
        key={`${verse.verseKey}-${selectedTafseerId}`}
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
        bounces={true}>
        {/* Verse badge */}
        <View style={styles.verseBadge}>
          <Text style={styles.verseBadgeText}>{verse.verseKey}</Text>
        </View>

        {/* Arabic text */}
        <SkiaVersePreview verseKey={verse.verseKey} rewayah={rewayah} />

        {/* Divider */}
        <View style={styles.divider} />

        {hasNoTafaseer ? (
          <Pressable
            style={styles.emptyState}
            onPress={() => {
              lightHaptics();
              SheetManager.hideAll();
              usePlayerStore.getState().setSheetMode('hidden');
              setTimeout(() => {
                router.push('/(tabs)/(a.home)/translations');
              }, 300);
            }}>
            <StackedVolumesIcon
              size={moderateScale(32)}
              color={Color(theme.colors.text).alpha(0.2).toString()}
            />
            <Text style={styles.emptyStateTitle}>No Tafaseer Downloaded</Text>
            <Text style={styles.emptyStateText}>
              Tap here to download a tafseer and view commentary.
            </Text>
          </Pressable>
        ) : (
          <>
            {/* Tafseer selector */}
            {downloadedMeta.length > 1 && (
              <Pressable
                style={styles.selectorButton}
                onPress={() => setShowSelector(!showSelector)}>
                <Text style={styles.selectorButtonText} numberOfLines={1}>
                  {activeTafseer?.englishName ?? 'Select Tafseer'}
                </Text>
                <Feather
                  name={showSelector ? 'chevron-up' : 'chevron-down'}
                  size={moderateScale(14)}
                  color={Color(theme.colors.text).alpha(0.5).toString()}
                />
              </Pressable>
            )}

            {/* Selector dropdown */}
            {showSelector && (
              <View style={styles.selectorDropdown}>
                {downloadedMeta.map(meta => {
                  const isActive = meta.identifier === selectedTafseerId;
                  return (
                    <Pressable
                      key={meta.identifier}
                      style={({pressed}) => [
                        styles.selectorOption,
                        pressed && styles.selectorOptionPressed,
                      ]}
                      onPress={() => handleSelectTafseer(meta.identifier)}>
                      <View style={styles.selectorOptionContent}>
                        <Text
                          style={[
                            styles.selectorOptionName,
                            isActive && styles.selectorOptionNameActive,
                          ]}
                          numberOfLines={1}>
                          {meta.englishName}
                        </Text>
                        {meta.name !== meta.englishName && (
                          <Text
                            style={styles.selectorOptionNative}
                            numberOfLines={1}>
                            {meta.name}
                          </Text>
                        )}
                      </View>
                      {isActive && (
                        <Feather
                          name="check"
                          size={moderateScale(14)}
                          color={theme.colors.text}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Tafseer label */}
            {activeTafseer && downloadedMeta.length === 1 && (
              <Text style={styles.tafseerLabel}>
                {activeTafseer.englishName.toUpperCase()}
              </Text>
            )}

            {/* Tafseer text */}
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.colors.text} />
              </View>
            ) : tafseerResult ? (
              <>
                {tafseerResult.fromAyah !== tafseerResult.toAyah && (
                  <Text style={styles.rangeBadge}>
                    {`VERSES ${tafseerResult.surahNumber}:${tafseerResult.fromAyah} \u2013 ${tafseerResult.surahNumber}:${tafseerResult.toAyah}`}
                  </Text>
                )}
                <TafseerHtmlRenderer
                  html={tafseerResult.text}
                  isRtl={activeTafseer?.direction === 'rtl'}
                  theme={theme}
                />
              </>
            ) : (
              <Text style={styles.noTafseer}>
                Tafseer not available for this verse
              </Text>
            )}
          </>
        )}
      </ScrollView>

      {/* Footer — Prev / Next */}
      <View style={[styles.footer, {paddingBottom: verticalScale(16)}]}>
        <Pressable
          onPress={goToPrevious}
          disabled={isFirst}
          style={({pressed}) => [
            styles.navButton,
            isFirst && styles.navButtonDisabled,
            pressed && !isFirst && {opacity: 0.6},
          ]}>
          <Feather
            name="chevron-left"
            size={moderateScale(16)}
            color={
              isFirst
                ? Color(theme.colors.text).alpha(0.2).toString()
                : theme.colors.text
            }
          />
          <Text
            style={[
              styles.navButtonText,
              isFirst && styles.navButtonTextDisabled,
            ]}>
            Prev
          </Text>
        </Pressable>

        <Text style={styles.footerCounter}>{verse.verseKey}</Text>

        <Pressable
          onPress={goToNext}
          disabled={isLast}
          style={({pressed}) => [
            styles.navButton,
            isLast && styles.navButtonDisabled,
            pressed && !isLast && {opacity: 0.6},
          ]}>
          <Text
            style={[
              styles.navButtonText,
              isLast && styles.navButtonTextDisabled,
            ]}>
            Next
          </Text>
          <Feather
            name="chevron-right"
            size={moderateScale(16)}
            color={
              isLast
                ? Color(theme.colors.text).alpha(0.2).toString()
                : theme.colors.text
            }
          />
        </Pressable>
      </View>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
    },
    // Scroll content
    scrollContent: {
      flex: 1,
    },
    scrollInner: {
      paddingTop: verticalScale(16),
      paddingBottom: verticalScale(24),
    },
    verseBadge: {
      alignSelf: 'center',
      backgroundColor: Color(theme.colors.text).alpha(0.05).toString(),
      borderRadius: moderateScale(8),
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(4),
      marginBottom: verticalScale(14),
    },
    verseBadgeText: {
      fontSize: moderateScale(11.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.textSecondary).alpha(0.7).toString(),
      letterSpacing: 0.3,
    },
    divider: {
      height: 1,
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      marginVertical: verticalScale(12),
    },
    // Empty state
    emptyState: {
      alignItems: 'center',
      paddingVertical: verticalScale(24),
      gap: moderateScale(8),
    },
    emptyStateTitle: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.text).alpha(0.7).toString(),
      marginTop: verticalScale(4),
    },
    emptyStateText: {
      fontSize: moderateScale(12.5),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      textAlign: 'center',
      lineHeight: moderateScale(18),
      paddingHorizontal: moderateScale(16),
    },
    // Tafseer selector
    selectorButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderRadius: moderateScale(10),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      paddingHorizontal: moderateScale(14),
      paddingVertical: moderateScale(10),
      marginBottom: verticalScale(12),
    },
    selectorButtonText: {
      flex: 1,
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.text).alpha(0.85).toString(),
      marginRight: moderateScale(8),
    },
    selectorDropdown: {
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderRadius: moderateScale(12),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      marginBottom: verticalScale(12),
      overflow: 'hidden',
    },
    selectorOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(10),
      paddingHorizontal: moderateScale(14),
    },
    selectorOptionPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    selectorOptionContent: {
      flex: 1,
      marginRight: moderateScale(8),
    },
    selectorOptionName: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.text).alpha(0.85).toString(),
    },
    selectorOptionNameActive: {
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    selectorOptionNative: {
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      marginTop: verticalScale(1),
    },
    // Tafseer label
    tafseerLabel: {
      fontSize: moderateScale(10.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: verticalScale(6),
    },
    rangeBadge: {
      fontSize: moderateScale(10.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      letterSpacing: 1.2,
      marginBottom: verticalScale(8),
    },
    noTafseer: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
    },
    loadingContainer: {
      paddingVertical: verticalScale(20),
      alignItems: 'center',
    },
    // Footer
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: moderateScale(16),
      paddingTop: verticalScale(10),
      borderTopWidth: 1,
      borderTopColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    navButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: verticalScale(7),
      paddingHorizontal: moderateScale(12),
      borderRadius: moderateScale(10),
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      gap: moderateScale(3),
    },
    navButtonDisabled: {
      opacity: 0.4,
    },
    navButtonText: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    navButtonTextDisabled: {
      color: Color(theme.colors.text).alpha(0.3).toString(),
    },
    footerCounter: {
      fontSize: moderateScale(12.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.textSecondary).alpha(0.6).toString(),
      letterSpacing: 0.3,
    },
  });
