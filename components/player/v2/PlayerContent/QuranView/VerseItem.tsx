import React, {memo} from 'react';
import {Text, TouchableOpacity, StyleSheet, View} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {Verse} from '@/types/quran';
import Color from 'color';

interface VerseItemProps {
  verse: Verse;
  onPress: () => void;
  textColor: string;
  borderColor: string;
  showTranslation?: boolean;
  showTransliteration?: boolean;
  transliterationFontSize: number;
  translationFontSize: number;
  arabicFontSize: number;
}

export const VerseItem = memo<VerseItemProps>(
  ({
    verse,
    onPress,
    textColor,
    borderColor,
    showTranslation = false,
    showTransliteration = false,
    transliterationFontSize,
    translationFontSize,
    arabicFontSize,
  }) => {
    // Create a semi-transparent background color based on the text color
    const bgColor = Color(textColor).alpha(0.08).toString();

    // Clean translation text by removing footnote tags
    const cleanTranslationText = (text?: string) => {
      if (!text) return '';
      return text.replace(/<sup[^>]*>.*?<\/sup>/g, '');
    };

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.container, {borderBottomColor: borderColor}]}
        onPress={onPress}>
        <View style={styles.verseInfoContainer}>
          <View style={[styles.verseInfoPill, {backgroundColor: bgColor}]}>
            <Text style={[styles.verseInfo, {color: textColor}]}>
              {verse.surah_number}:{verse.ayah_number}
            </Text>
          </View>
        </View>
        <Text
          style={[
            styles.arabicText,
            {
              color: textColor,
              fontSize: moderateScale(arabicFontSize),
            },
          ]}>
          {verse.text}
        </Text>
        {showTransliteration && verse.transliteration && (
          <Text
            style={[
              styles.transliterationText,
              {
                color: textColor,
                fontSize: moderateScale(transliterationFontSize),
              },
            ]}>
            {verse.transliteration}
          </Text>
        )}
        {showTranslation && verse.translation && (
          <Text
            style={[
              styles.translationText,
              {
                color: textColor,
                fontSize: moderateScale(translationFontSize),
              },
            ]}>
            {cleanTranslationText(verse.translation)}
          </Text>
        )}
      </TouchableOpacity>
    );
  },
);

VerseItem.displayName = 'VerseItem';

const styles = StyleSheet.create({
  container: {
    paddingVertical: verticalScale(12),
    paddingHorizontal: moderateScale(16),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  verseInfoContainer: {
    alignSelf: 'flex-start',
    marginBottom: verticalScale(6),
  },
  verseInfoPill: {
    paddingHorizontal: moderateScale(4),
    paddingVertical: moderateScale(3),
    borderRadius: moderateScale(6),
  },
  verseInfo: {
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-Medium',
  },
  arabicText: {
    fontSize: moderateScale(24),
    fontFamily: 'Uthmani',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  transliterationText: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Regular',
    marginTop: verticalScale(8),
    textAlign: 'left',
  },
  translationText: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Regular',
    marginTop: verticalScale(8),
    textAlign: 'left',
  },
});
