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

const saheehData =
  require('@/data/SaheehInternational.translation-with-footnote-tags.json') as Record<
    string,
    {t: string}
  >;
const clearQuranData = require('@/data/clear-quran-translation.json') as {
  translations: {resource_id: number; text: string}[];
};
const quranData = require('@/data/quran.json') as QuranData;

// Build verse_key -> id lookup once at module scope
const verseKeyToId: Record<string, number> = {};
for (const key of Object.keys(quranData)) {
  const verse = quranData[key];
  if (verse?.verse_key) {
    verseKeyToId[verse.verse_key] = verse.id;
  }
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

type TranslationSource = 'saheeh' | 'clear-quran';

export const VerseTranslationSheet = (
  props: SheetProps<'verse-translation'>,
) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const verseKey = props.payload?.verseKey ?? '';
  const arabicText = props.payload?.arabicText ?? '';

  const [source, setSource] = useState<TranslationSource>('saheeh');

  const translationText = useMemo(() => {
    if (!verseKey) return '';

    if (source === 'saheeh') {
      const entry = saheehData[verseKey];
      return entry ? stripHtml(entry.t) : '';
    }

    // Clear Quran: look up verse id, then index into translations array
    const verseId = verseKeyToId[verseKey];
    if (verseId == null) return '';
    const entry = clearQuranData.translations[verseId - 1];
    return entry ? stripHtml(entry.text) : '';
  }, [verseKey, source]);

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
          {arabicText ? (
            <Text style={styles.arabicText}>{arabicText}</Text>
          ) : null}

          {translationText ? (
            <Text style={styles.translationText}>{translationText}</Text>
          ) : (
            <Text style={styles.noTranslation}>Translation not available</Text>
          )}
        </ScrollView>
      </View>
    </ActionSheet>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      paddingTop: moderateScale(8),
      maxHeight: '80%',
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
      maxHeight: verticalScale(400),
    },
    arabicText: {
      fontSize: moderateScale(24),
      fontFamily: 'QPC',
      color: theme.colors.text,
      textAlign: 'right',
      writingDirection: 'rtl',
      lineHeight: moderateScale(48),
      marginBottom: verticalScale(20),
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
