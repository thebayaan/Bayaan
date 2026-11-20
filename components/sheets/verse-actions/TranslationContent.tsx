import React, {useState, useMemo, useCallback, useEffect} from 'react';
import {View, Text, Pressable} from 'react-native';
import {ScaledSheet, moderateScale, verticalScale} from '@/utils/scale';
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
  getTranslationDisplayName,
  isBundledTranslation,
} from '@/utils/translationLookup';
import {stripTranslationMarkup} from '@/utils/translationMarkup'; // @ai
import {translationDbService} from '@/services/translation/TranslationDbService';
import {
  BUNDLED_TRANSLATIONS,
  type BundledTranslationId,
} from '@/types/translation';
import {analyticsService} from '@/services/analytics/AnalyticsService';
// @ai-start
import {flipX, latinLetterSpacing} from '@/utils/rtl';
import {useTranslation} from 'react-i18next';
import {localizeDigits} from '@/i18n/format';
import {currentLanguage} from '@/i18n/language';
import {getLanguageConfig} from '@/i18n/languages';
import {
  hafsPagerPage,
  joinPartTexts,
  unitPagerPage,
  type UnitStart,
} from './verseUnitScreens';
// @ai-end
import {SheetFooter, SheetScrollView} from './sheetGestures';

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

const bundledIds = Object.keys(BUNDLED_TRANSLATIONS) as BundledTranslationId[];

/**
 * Translation names are set in capitals in a Latin-script UI only. Arabic has
 * no capitals, and an Arabic UI shows a downloaded translation's name as its
 * catalogue gives it.
 */
const CAPITALIZE_NAMES = getLanguageConfig(currentLanguage).script === 'Latn';

/** The footer buttons' minimum height: the 44pt tap target. */
const NAV_BUTTON_MIN_HEIGHT = 44;

// ─── Component ────────────────────────────────────────────────────────────

interface TranslationContentProps {
  surahNumber: number;
  ayahNumber: number;
  rewayah?: import('@/store/mushafSettingsStore').RewayahId;
  // @ai-start
  /** Another rewayah: page through ITS verses (its numbering), starting at
   *  `unit`. Absent for Hafs, which pages the Hafs verses as before. */
  unitStart?: UnitStart;
  // @ai-end
  onBack: () => void;
}

// @ai-start
export const TranslationContent: React.FC<TranslationContentProps> = ({
  surahNumber,
  ayahNumber,
  rewayah,
  unitStart, // @ai
  onBack,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {t} = useTranslation(['sheets', 'common']);
  const selectedTranslationId = useMushafSettingsStore(
    s => s.selectedTranslationId,
  );
  const setSelectedTranslationId = useMushafSettingsStore(
    s => s.setSelectedTranslationId,
  );
  const downloadedMeta = useTranslationStore(s => s.downloadedMeta);

  const initialVerseKey = `${surahNumber}:${ayahNumber}`;
  // @ai-start
  const unitModel = unitStart?.model ?? null;
  const initialIndex = unitStart
    ? unitStart.unit.index
    : (verseKeyToIndex[initialVerseKey] ?? 0);
  const total = unitModel ? unitModel.units.length : TOTAL_VERSES;
  // @ai-end
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [downloadedTexts, setDownloadedTexts] = useState<
    Record<string, string>
  >({});

  // @ai-start
  const page = useMemo(
    () =>
      unitModel
        ? unitPagerPage(
            unitModel,
            unitModel.units[Math.min(currentIndex, total - 1)],
            'translation',
          )
        : hafsPagerPage(allVerses[currentIndex].verseKey),
    [unitModel, currentIndex, total],
  );
  // @ai-end

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
        // @ai-start
        const texts = await Promise.all(
          page.hafsKeys.map(hafsKey =>
            translationDbService.getTranslation(hafsKey, id),
          ),
        );
        return [id, joinPartTexts(texts)] as [string, string];
        // @ai-end
      }),
    ).then(results => {
      if (!cancelled) {
        setDownloadedTexts(Object.fromEntries(results));
      }
    });

    return () => {
      cancelled = true;
    };
    // page.key changes exactly when page.hafsKeys can. @ai
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.key, downloadedIdentifiers]);

  // @ai-start
  const bundledText = useCallback(
    (id: string) =>
      joinPartTexts(
        page.hafsKeys.map(hafsKey =>
          stripTranslationMarkup(getTranslationText(hafsKey, id)),
        ),
      ),
    [page],
  );
  // @ai-end

  const activeTranslationName = getTranslationDisplayName(
    selectedTranslationId,
  );
  const activeTranslationText = isBundledTranslation(selectedTranslationId)
    ? bundledText(selectedTranslationId) // @ai
    : stripTranslationMarkup(downloadedTexts[selectedTranslationId] ?? ''); // @ai

  // Track translation viewed when the selected translation changes
  useEffect(() => {
    const language = isBundledTranslation(selectedTranslationId)
      ? BUNDLED_TRANSLATIONS[selectedTranslationId].language
      : selectedTranslationId.split('.')[0] || 'unknown';
    analyticsService.trackTranslationViewed({
      translation_id: selectedTranslationId,
      language,
    });
  }, [selectedTranslationId]);

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
  const isLast = currentIndex === total - 1; // @ai

  const goToPrevious = useCallback(() => {
    setCurrentIndex(i => Math.max(0, i - 1));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentIndex(i => Math.min(total - 1, i + 1)); // @ai
  }, [total]);

  const handleSelectTranslation = useCallback(
    (id: string) => {
      setSelectedTranslationId(id);
    },
    [setSelectedTranslationId],
  );

  return (
    <View style={styles.container}>
      {/* Scrollable verse content */}
      <SheetScrollView
        key={page.key} // @ai
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}>
        {/* Verse badge */}
        <View style={styles.verseBadge}>
          <Text style={styles.verseBadgeText}>
            {localizeDigits(page.label)}
          </Text>
        </View>

        {/* Arabic text */}
        {/* @ai-start */}
        <SkiaVersePreview
          verseKey={page.previewVerseKey}
          text={page.previewText}
          rewayah={rewayah}
        />
        {/* @ai-end */}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Active Translation */}
        <Text style={styles.translationLabel}>{activeTranslationName}</Text>
        {activeTranslationText ? (
          <Text style={styles.translationText}>{activeTranslationText}</Text>
        ) : (
          <Text style={styles.noTranslation}>
            {t('translationContent.notAvailable')}
          </Text>
        )}
        {/* @ai-start */}
        {/* A Hafs verse the rewayah divides: its whole translation, noted. */}
        {page.notes.map(note => (
          <Text key={note} style={styles.sharedNote}>
            {note}
          </Text>
        ))}
        {/* @ai-end */}

        {/* Other translations (bundled + downloaded) */}
        {otherTranslationIds.map(id => {
          const name = getTranslationDisplayName(id);
          const text = isBundledTranslation(id)
            ? bundledText(id) // @ai
            : stripTranslationMarkup(downloadedTexts[id] ?? ''); // @ai
          return (
            <React.Fragment key={id}>
              <View style={styles.divider} />
              <Pressable
                onPress={() => handleSelectTranslation(id)}
                style={({pressed}) => [pressed && {opacity: 0.7}]}>
                <View style={styles.otherTranslationHeader}>
                  <Text style={styles.translationLabel}>{name}</Text>
                  <View style={styles.switchPill}>
                    <Text style={styles.switchPillText}>
                      {t('translationContent.switch')}
                    </Text>
                  </View>
                </View>
              </Pressable>
              {text ? (
                <Text style={styles.translationTextSecondary}>{text}</Text>
              ) : (
                <Text style={styles.noTranslation}>
                  {t('translationContent.notAvailable')}
                </Text>
              )}
            </React.Fragment>
          );
        })}
      </SheetScrollView>

      {/* Footer — Prev / Next; the sheet never drags from it */}
      <SheetFooter style={styles.footer}>
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
            size={moderateScale(18)}
            color={
              isFirst
                ? Color(theme.colors.text).alpha(0.2).toString()
                : theme.colors.text
            }
            style={flipX}
          />
          <Text
            style={[
              styles.navButtonText,
              isFirst && styles.navButtonTextDisabled,
            ]}>
            {t('translationContent.prev')}
          </Text>
        </Pressable>

        <Text style={styles.footerCounter}>{localizeDigits(page.label)}</Text>

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
            {t('common:actions.next')}
          </Text>
          <Feather
            name="chevron-right"
            size={moderateScale(18)}
            color={
              isLast
                ? Color(theme.colors.text).alpha(0.2).toString()
                : theme.colors.text
            }
            style={flipX}
          />
        </Pressable>
      </SheetFooter>
    </View>
  );
};
// @ai-end

// ─── Styles ───────────────────────────────────────────────────────────────

// @ai-start
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
      letterSpacing: latinLetterSpacing(0.3),
    },
    divider: {
      height: 1,
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      marginVertical: verticalScale(12),
    },
    translationLabel: {
      fontSize: moderateScale(10.5),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.textTertiary,
      letterSpacing: latinLetterSpacing(1.2),
      textTransform: CAPITALIZE_NAMES ? 'uppercase' : 'none',
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
      color: theme.colors.textTertiary,
    },
    // @ai-start
    sharedNote: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textTertiary,
      lineHeight: moderateScale(18),
      marginTop: verticalScale(8),
    },
    // @ai-end
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
      letterSpacing: latinLetterSpacing(0.3),
    },
    // Footer: 44pt buttons with room above and below, inside the sheet's own
    // bottom padding (and the safe-area inset the sheet adds under it).
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: moderateScale(8),
      paddingHorizontal: moderateScale(16),
      paddingTop: verticalScale(12),
      paddingBottom: verticalScale(18),
      borderTopWidth: 1,
      borderTopColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    navButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: NAV_BUTTON_MIN_HEIGHT,
      minWidth: NAV_BUTTON_MIN_HEIGHT,
      paddingHorizontal: moderateScale(14),
      borderRadius: moderateScale(12),
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      gap: moderateScale(4),
    },
    navButtonDisabled: {
      opacity: 0.4,
    },
    navButtonText: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    navButtonTextDisabled: {
      color: Color(theme.colors.text).alpha(0.3).toString(),
    },
    footerCounter: {
      fontSize: moderateScale(12.5),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.textTertiary,
      letterSpacing: latinLetterSpacing(0.3),
    },
  });
// @ai-end
