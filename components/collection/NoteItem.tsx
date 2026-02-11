import React, {memo, useMemo} from 'react';
import {View, Text, Pressable} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Feather} from '@expo/vector-icons';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import Color from 'color';

// Build verse_key -> text lookup once at module scope
interface QuranEntry {
  verse_key: string;
  text: string;
}
const quranRaw = require('@/data/quran.json') as Record<string, QuranEntry>;
const qpcTextByKey: Record<string, string> = {};
for (const key of Object.keys(quranRaw)) {
  const entry = quranRaw[key];
  if (entry?.verse_key) qpcTextByKey[entry.verse_key] = entry.text;
}

// Lazy-load Indopak data
interface IndopakEntry {
  text: string;
}
let indopakCache: Record<string, IndopakEntry> | null = null;
function getIndopakData(): Record<string, IndopakEntry> | null {
  if (!indopakCache) {
    try {
      indopakCache = require('@/data/IndopakNastaleeq.json');
    } catch {
      // not available
    }
  }
  return indopakCache;
}

interface NoteItemProps {
  surahName: string;
  ayahNumber: number;
  surahNumber: number;
  verseKey: string;
  notePreview: string;
  onPress: () => void;
  onOptionsPress: () => void;
}

export const NoteItem = memo<NoteItemProps>(
  ({
    surahName,
    ayahNumber,
    surahNumber,
    verseKey,
    notePreview,
    onPress,
    onOptionsPress,
  }) => {
    const {theme} = useTheme();
    const {arabicFontFamily} = useMushafSettingsStore();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const surahGlyph = surahGlyphMap[surahNumber] ?? '';
    const isIndopak = arabicFontFamily === 'Indopak';
    const arabicText = isIndopak
      ? getIndopakData()?.[verseKey]?.text ?? ''
      : qpcTextByKey[verseKey] ?? '';

    return (
      <Pressable
        style={styles.container}
        onPress={onPress}
        onLongPress={onOptionsPress}>
        {/* Top bar: pill + surah glyph + options */}
        <View style={styles.topBar}>
          <View style={styles.versePill}>
            <Text style={styles.versePillText}>
              {surahNumber}:{ayahNumber}
            </Text>
          </View>
          <View style={styles.lineLeft} />
          {surahGlyph ? (
            <Text style={styles.surahGlyph}>{surahGlyph}</Text>
          ) : null}
          <View style={styles.lineRight} />
          <Pressable
            onPress={onOptionsPress}
            hitSlop={8}
            style={styles.optionsButton}>
            <Feather
              name="more-horizontal"
              size={moderateScale(18)}
              color={theme.colors.textSecondary}
            />
          </Pressable>
        </View>

        {/* Arabic text */}
        <View style={styles.arabicContainer}>
          <Text style={[styles.arabicText, {fontFamily: arabicFontFamily}]}>
            {arabicText}
          </Text>
        </View>

        {/* Note preview */}
        <View style={styles.annotationContainer}>
          <View style={styles.annotationLine} />
          <Text style={styles.notePreviewText} numberOfLines={2}>
            {notePreview}
          </Text>
        </View>
      </Pressable>
    );
  },
);

NoteItem.displayName = 'NoteItem';

const createStyles = (theme: Theme) => {
  const accentColor = theme.colors.textSecondary;

  return ScaledSheet.create({
    container: {
      backgroundColor: theme.colors.card,
      marginHorizontal: moderateScale(16),
      marginVertical: moderateScale(6),
      borderRadius: moderateScale(20),
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: Color(accentColor).alpha(0.15).toString(),
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(10),
      paddingLeft: moderateScale(14),
      backgroundColor: Color(accentColor).alpha(0.05).toString(),
      borderBottomWidth: 1,
      borderBottomColor: Color(accentColor).alpha(0.1).toString(),
    },
    versePill: {
      backgroundColor: Color(accentColor).alpha(0.1).toString(),
      paddingHorizontal: moderateScale(6),
      paddingVertical: moderateScale(3),
      borderRadius: moderateScale(6),
    },
    versePillText: {
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.medium,
      color: accentColor,
    },
    lineLeft: {
      flex: 1,
      height: 1,
      backgroundColor: Color(accentColor).alpha(0.2).toString(),
      marginHorizontal: moderateScale(10),
    },
    surahGlyph: {
      fontFamily: 'SurahNames',
      fontSize: moderateScale(22),
      color: accentColor,
    },
    lineRight: {
      flex: 1,
      height: 1,
      backgroundColor: Color(accentColor).alpha(0.2).toString(),
      marginHorizontal: moderateScale(10),
    },
    optionsButton: {
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(2),
    },
    arabicContainer: {
      padding: moderateScale(16),
      paddingBottom: moderateScale(14),
    },
    arabicText: {
      fontSize: moderateScale(20),
      color: theme.colors.text,
      textAlign: 'center',
      writingDirection: 'rtl',
      lineHeight: moderateScale(38),
    },
    annotationContainer: {
      paddingHorizontal: moderateScale(16),
      paddingBottom: moderateScale(16),
    },
    annotationLine: {
      height: 1,
      backgroundColor: Color(accentColor).alpha(0.1).toString(),
      marginBottom: moderateScale(10),
    },
    notePreviewText: {
      fontSize: moderateScale(13),
      fontFamily: theme.fonts.regular,
      color: accentColor,
      textAlign: 'center',
      lineHeight: moderateScale(20),
      fontStyle: 'italic',
    },
  });
};
