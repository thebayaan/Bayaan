import React, {useState, useMemo} from 'react';
import {View, Text, Pressable, ScrollView} from 'react-native';
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import ActionSheet, {SheetProps} from 'react-native-actions-sheet';
import Color from 'color';
import type {QuranData} from '@/types/quran';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';

const saheehData =
  require('@/data/SaheehInternational.translation-with-footnote-tags.json') as Record<
    string,
    {t: string}
  >;
const clearQuranData = require('@/data/clear-quran-translation.json') as {
  translations: {resource_id: number; text: string}[];
};
const quranData = require('@/data/quran.json') as QuranData;

// Build lookups once at module scope
const verseKeyToId: Record<string, number> = {};
const verseKeyToText: Record<string, string> = {};
for (const key of Object.keys(quranData)) {
  const verse = quranData[key];
  if (verse?.verse_key) {
    verseKeyToId[verse.verse_key] = verse.id;
    verseKeyToText[verse.verse_key] = verse.text;
  }
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

function getTranslation(vk: string, source: 'saheeh' | 'clear-quran'): string {
  if (source === 'saheeh') {
    const entry = saheehData[vk];
    return entry ? stripHtml(entry.t) : '';
  }
  const verseId = verseKeyToId[vk];
  if (verseId == null) return '';
  const entry = clearQuranData.translations[verseId - 1];
  return entry ? stripHtml(entry.text) : '';
}

type TranslationSource = 'saheeh' | 'clear-quran';

interface VerseEntry {
  verseKey: string;
  arabicText: string;
  translation: string;
}

export const VerseTranslationSheet = (
  props: SheetProps<'verse-translation'>,
) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const verseKey = props.payload?.verseKey ?? '';
  const arabicText = props.payload?.arabicText ?? '';
  const verseKeys = props.payload?.verseKeys;
  const isRange = verseKeys && verseKeys.length > 1;

  const {arabicFontFamily} = useMushafSettingsStore();

  const [source, setSource] = useState<TranslationSource>('saheeh');

  const verseEntries: VerseEntry[] = useMemo(() => {
    if (isRange) {
      return verseKeys.map(vk => ({
        verseKey: vk,
        arabicText: verseKeyToText[vk] ?? '',
        translation: getTranslation(vk, source),
      }));
    }
    return [
      {
        verseKey,
        arabicText,
        translation: getTranslation(verseKey, source),
      },
    ];
  }, [verseKey, verseKeys, isRange, arabicText, source]);

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.container}>
        <Text style={styles.title}>Translation</Text>

        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tab, source === 'saheeh' && styles.tabActive]}
            onPress={() => setSource('saheeh')}>
            <Text
              style={[
                styles.tabText,
                source === 'saheeh' && styles.tabTextActive,
              ]}>
              Saheeh International
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, source === 'clear-quran' && styles.tabActive]}
            onPress={() => setSource('clear-quran')}>
            <Text
              style={[
                styles.tabText,
                source === 'clear-quran' && styles.tabTextActive,
              ]}>
              Clear Quran
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={true}>
          {verseEntries.map((entry, index) => (
            <View
              key={entry.verseKey}
              style={[
                styles.verseSection,
                index < verseEntries.length - 1 && styles.verseSectionDivider,
              ]}>
              {isRange ? (
                <View style={styles.verseBadge}>
                  <Text style={styles.verseBadgeText}>{entry.verseKey}</Text>
                </View>
              ) : null}

              {entry.arabicText ? (
                <Text
                  style={[styles.arabicText, {fontFamily: arabicFontFamily}]}>
                  {entry.arabicText}
                </Text>
              ) : null}

              {entry.translation ? (
                <Text style={styles.translationText}>{entry.translation}</Text>
              ) : (
                <Text style={styles.noTranslation}>
                  Translation not available
                </Text>
              )}
            </View>
          ))}
        </ScrollView>
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
    },
    container: {
      padding: moderateScale(16),
      paddingBottom: moderateScale(40),
    },
    title: {
      fontSize: moderateScale(20),
      fontFamily: theme.fonts.bold,
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: verticalScale(16),
    },
    tabRow: {
      flexDirection: 'row',
      backgroundColor: theme.colors.card,
      borderRadius: moderateScale(10),
      padding: moderateScale(4),
      marginBottom: verticalScale(20),
    },
    tab: {
      flex: 1,
      paddingVertical: verticalScale(10),
      borderRadius: moderateScale(8),
      alignItems: 'center',
    },
    tabActive: {
      backgroundColor: theme.colors.text,
    },
    tabText: {
      fontSize: moderateScale(13),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.textSecondary,
    },
    tabTextActive: {
      color: theme.colors.background,
    },
    scrollContent: {
      maxHeight: verticalScale(450),
    },
    verseSection: {
      paddingBottom: verticalScale(16),
    },
    verseSectionDivider: {
      borderBottomWidth: 1,
      borderBottomColor: Color(theme.colors.text).alpha(0.08).toString(),
      marginBottom: verticalScale(16),
    },
    verseBadge: {
      alignSelf: 'flex-end',
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      borderRadius: moderateScale(6),
      paddingHorizontal: moderateScale(8),
      paddingVertical: moderateScale(3),
      marginBottom: verticalScale(8),
    },
    verseBadgeText: {
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.textSecondary,
    },
    arabicText: {
      fontSize: moderateScale(22),
      color: theme.colors.text,
      textAlign: 'right',
      writingDirection: 'rtl',
      lineHeight: moderateScale(42),
      marginBottom: verticalScale(12),
    },
    translationText: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
      lineHeight: moderateScale(26),
    },
    noTranslation: {
      fontSize: moderateScale(15),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: verticalScale(20),
    },
  });
