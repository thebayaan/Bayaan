/**
 * DhikrListItem
 *
 * Manuscript-inspired design for dhikr list items.
 * Ornate header with number, centered Arabic text,
 * translation as annotation, and subtle footer metadata.
 */

import React from 'react';
import {View, Text, StyleProp, ViewStyle} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {Dhikr} from '@/types/adhkar';
import {adhkarCardLabel} from '@/utils/adhkarText';
import {AdhkarArabicText} from './AdhkarArabicText';
import {AdhkarLatinText} from './AdhkarLatinText';
import {PlayingBars} from './PlayingBars';
import Color from 'color';
// @ai-start
import {useTranslation} from 'react-i18next';
import {localizeDigits} from '@/i18n/format';
import {useAdhkarSettingsStore} from '@/store/adhkarSettingsStore';
// @ai-end

const CARD_ARABIC_SIZE = moderateScale(18);
const CARD_TRANSLATION_SIZE = moderateScale(13);

interface DhikrListItemProps {
  dhikr: Dhikr;
  index: number;
  style?: StyleProp<ViewStyle>;
  isCurrent?: boolean;
  isPlaying?: boolean;
}

// @ai-start
export const DhikrListItem: React.FC<DhikrListItemProps> = React.memo(
  ({dhikr, index, style, isCurrent = false, isPlaying = false}) => {
    const {theme} = useTheme();
    const {t} = useTranslation('player');
    const showTranslation = useAdhkarSettingsStore(s => s.showTranslation);
    const styles = createStyles(theme);

    const displayNumber = index + 1;
    const hasAudio = !!dhikr.audioFile;

    return (
      <View
        style={[styles.container, isCurrent && styles.containerCurrent, style]}
        accessibilityRole="button"
        accessibilityLabel={adhkarCardLabel(dhikr.arabic, dhikr.translation)}>
        {/* Ornate top border pattern */}
        <View style={styles.ornamentBar}>
          <View style={styles.ornamentLeft} />
          <View style={styles.ornamentCenter}>
            <View style={styles.numberRow}>
              <Text style={styles.ornamentNumber}>
                {localizeDigits(displayNumber)}
              </Text>
              {isCurrent ? (
                <PlayingBars
                  animating={isPlaying}
                  color={theme.colors.textSecondary}
                />
              ) : null}
            </View>
          </View>
          <View style={styles.ornamentRight} />
        </View>

        {/* Arabic text */}
        <View style={styles.arabicContainer}>
          <AdhkarArabicText
            dhikrId={dhikr.id}
            arabic={dhikr.arabic}
            fontSize={CARD_ARABIC_SIZE}
            style={styles.arabicText}
            align="center"
          />
        </View>

        {/* Translation */}
        {showTranslation && dhikr.translation ? (
          <View style={styles.annotationContainer}>
            <View style={styles.annotationLine} />
            <AdhkarLatinText
              text={dhikr.translation}
              variant="translation"
              fontSize={CARD_TRANSLATION_SIZE}
              color={theme.colors.textSecondary}
              style={styles.translationText}
            />
          </View>
        ) : null}

        {/* Footer with metadata */}
        <View style={styles.footer}>
          {dhikr.repeatCount > 1 ? (
            <Text style={styles.repeatText}>
              {t('adhkar.repeatTimes', {times: dhikr.repeatCount})}
            </Text>
          ) : (
            <View style={styles.audioIndicator} />
          )}
        </View>
      </View>
    );
  },
);
// @ai-end

DhikrListItem.displayName = 'DhikrListItem';

const createStyles = (theme: Theme) => {
  const accentColor = theme.colors.textSecondary;

  return ScaledSheet.create({
    container: {
      backgroundColor: theme.colors.card,
      marginHorizontal: moderateScale(16),
      marginVertical: moderateScale(10),
      borderRadius: moderateScale(20),
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: Color(accentColor).alpha(0.15).toString(),
    },
    // The text color at 6% mixed over the card, so the card stays opaque.
    containerCurrent: {
      backgroundColor: Color(theme.colors.card)
        .mix(Color(theme.colors.text), 0.06)
        .toString(),
    },
    numberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(8),
    },
    ornamentBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(8),
      backgroundColor: Color(accentColor).alpha(0.05).toString(),
      borderBottomWidth: 1,
      borderBottomColor: Color(accentColor).alpha(0.1).toString(),
    },
    ornamentLeft: {
      flex: 1,
      height: 1,
      backgroundColor: Color(accentColor).alpha(0.2).toString(),
      marginLeft: moderateScale(16),
    },
    ornamentCenter: {
      paddingHorizontal: moderateScale(20),
    },
    ornamentNumber: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.semiBold,
      color: accentColor,
    },
    ornamentRight: {
      flex: 1,
      height: 1,
      backgroundColor: Color(accentColor).alpha(0.2).toString(),
      marginRight: moderateScale(16),
    },
    arabicContainer: {
      padding: moderateScale(20),
      paddingBottom: moderateScale(16),
    },
    arabicText: {
      fontSize: CARD_ARABIC_SIZE,
      fontFamily: 'ScheherazadeNew-Regular',
      color: theme.colors.text,
      textAlign: 'center',
      writingDirection: 'rtl',
      lineHeight: moderateScale(40),
    },
    annotationContainer: {
      paddingHorizontal: moderateScale(20),
      paddingBottom: moderateScale(16),
    },
    annotationLine: {
      height: 1,
      backgroundColor: Color(accentColor).alpha(0.1).toString(),
      marginBottom: moderateScale(12),
    },
    translationText: {
      fontSize: CARD_TRANSLATION_SIZE,
      fontFamily: theme.fonts.regular,
      color: accentColor,
      textAlign: 'center',
      lineHeight: moderateScale(20),
      fontStyle: 'italic',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: moderateScale(12),
      paddingVertical: moderateScale(10),
      backgroundColor: Color(accentColor).alpha(0.05).toString(),
      borderTopWidth: 1,
      borderTopColor: Color(accentColor).alpha(0.15).toString(),
    },
    repeatText: {
      fontSize: moderateScale(11),
      fontFamily: theme.fonts.medium,
      color: accentColor,
    },
    audioIndicator: {
      width: moderateScale(6),
      height: moderateScale(6),
      borderRadius: moderateScale(3),
      backgroundColor: accentColor,
    },
  });
};
