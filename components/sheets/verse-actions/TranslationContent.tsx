import React, {useState, useMemo, useCallback, useEffect} from 'react';
import {View, Text, Pressable, ScrollView} from 'react-native';
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {Feather} from '@expo/vector-icons';
import type {QuranData} from '@/types/quran';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useTranslationStore} from '@/store/translationStore';
import SkiaVersePreview from '@/components/share/SkiaVersePreview';
import {
  getTranslationText,
  getTranslationName,
  isBundledTranslation,
} from '@/utils/translationLookup';
import {translationDbService} from '@/services/translation/TranslationDbService';
import {
  BUNDLED_TRANSLATIONS,
  type BundledTranslationId,
} from '@/types/translation';

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

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

const bundledIds = Object.keys(BUNDLED_TRANSLATIONS) as BundledTranslationId[];

// ─── Component ────────────────────────────────────────────────────────────

interface TranslationContentProps {
  surahNumber: number;
  ayahNumber: number;
  onBack: () => void;
}

export const TranslationContent: React.FC<TranslationContentProps> = ({
  surahNumber,
  ayahNumber,
  onBack,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const selectedTranslationId = useMushafSettingsStore(
    s => s.selectedTranslationId,
  );
  const setSelectedTranslationId = useMushafSettingsStore(
    s => s.setSelectedTranslationId,
  );
  const downloadedMeta = useTranslationStore(s => s.downloadedMeta);

  const initialVerseKey = `${surahNumber}:${ayahNumber}`;
  const initialIndex = verseKeyToIndex[initialVerseKey] ?? 0;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [downloadedTexts, setDownloadedTexts] = useState<
    Record<string, string>
  >({});

  const verse = allVerses[currentIndex];

  // Identifiers for downloaded (non-bundled) translations
  const downloadedIdentifiers = useMemo(
    () =>
      downloadedMeta
        .filter(m => !isBundledTranslation(m.identifier))
        .map(m => m.identifier),
    [downloadedMeta],
  );

  // Load downloaded translation texts from SQLite when verse changes
  useEffect(() => {
    if (downloadedIdentifiers.length === 0) {
      setDownloadedTexts({});
      return;
    }

    let cancelled = false;
    Promise.all(
      downloadedIdentifiers.map(async id => {
        const text = await translationDbService.getTranslation(
          verse.verseKey,
          id,
        );
        return [id, text ?? ''] as [string, string];
      }),
    ).then(results => {
      if (!cancelled) {
        setDownloadedTexts(Object.fromEntries(results));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [verse.verseKey, downloadedIdentifiers]);

  const activeTranslationName = getTranslationName(selectedTranslationId);
  const activeTranslationText = isBundledTranslation(selectedTranslationId)
    ? stripHtml(getTranslationText(verse.verseKey, selectedTranslationId))
    : stripHtml(downloadedTexts[selectedTranslationId] ?? '');

  // All other translation IDs (bundled + downloaded, excluding active)
  const otherTranslationIds = useMemo(() => {
    const ids: string[] = [];
    for (const id of bundledIds) {
      if (id !== selectedTranslationId) ids.push(id);
    }
    for (const id of downloadedIdentifiers) {
      if (id !== selectedTranslationId) ids.push(id);
    }
    return ids;
  }, [selectedTranslationId, downloadedIdentifiers]);

  const isFirst = currentIndex === 0;
  const isLast = currentIndex === TOTAL_VERSES - 1;

  const goToPrevious = useCallback(() => {
    setCurrentIndex(i => Math.max(0, i - 1));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentIndex(i => Math.min(TOTAL_VERSES - 1, i + 1));
  }, []);

  const handleSelectTranslation = useCallback(
    (id: string) => {
      setSelectedTranslationId(id);
    },
    [setSelectedTranslationId],
  );

  return (
    <View style={styles.container}>
      {/* Scrollable verse content */}
      <ScrollView
        key={verse.verseKey}
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
        bounces={true}>
        {/* Verse badge */}
        <View style={styles.verseBadge}>
          <Text style={styles.verseBadgeText}>{verse.verseKey}</Text>
        </View>

        {/* Arabic text */}
        <SkiaVersePreview verseKey={verse.verseKey} />

        {/* Divider */}
        <View style={styles.divider} />

        {/* Active Translation */}
        <Text style={styles.translationLabel}>
          {activeTranslationName.toUpperCase()}
        </Text>
        {activeTranslationText ? (
          <Text style={styles.translationText}>{activeTranslationText}</Text>
        ) : (
          <Text style={styles.noTranslation}>Translation not available</Text>
        )}

        {/* Other translations (bundled + downloaded) */}
        {otherTranslationIds.map(id => {
          const name = getTranslationName(id);
          const text = isBundledTranslation(id)
            ? stripHtml(getTranslationText(verse.verseKey, id))
            : stripHtml(downloadedTexts[id] ?? '');
          return (
            <React.Fragment key={id}>
              <View style={styles.divider} />
              <Pressable
                onPress={() => handleSelectTranslation(id)}
                style={({pressed}) => [pressed && {opacity: 0.7}]}>
                <View style={styles.otherTranslationHeader}>
                  <Text style={styles.translationLabel}>
                    {name.toUpperCase()}
                  </Text>
                  <View style={styles.switchPill}>
                    <Text style={styles.switchPillText}>Switch</Text>
                  </View>
                </View>
              </Pressable>
              {text ? (
                <Text style={styles.translationTextSecondary}>{text}</Text>
              ) : (
                <Text style={styles.noTranslation}>
                  Translation not available
                </Text>
              )}
            </React.Fragment>
          );
        })}
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
    translationLabel: {
      fontSize: moderateScale(10.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: verticalScale(6),
    },
    translationText: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      lineHeight: moderateScale(24),
    },
    translationTextSecondary: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.7).toString(),
      lineHeight: moderateScale(22),
    },
    noTranslation: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
    },
    otherTranslationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    switchPill: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      borderRadius: moderateScale(8),
      paddingHorizontal: moderateScale(10),
      paddingVertical: moderateScale(4),
      marginBottom: verticalScale(6),
    },
    switchPillText: {
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.text).alpha(0.6).toString(),
      letterSpacing: 0.3,
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
