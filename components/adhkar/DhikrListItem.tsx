/**
 * DhikrListItem
 *
 * Manuscript-inspired design for dhikr list items.
 * Ornate header with number, centered Arabic text,
 * translation as annotation, and subtle footer metadata.
 */

import React from 'react';
import {View, Text, Pressable} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {Dhikr} from '@/types/adhkar';
import Color from 'color';

interface DhikrListItemProps {
  dhikr: Dhikr;
  index: number;
  onPress: () => void;
}

export const DhikrListItem: React.FC<DhikrListItemProps> = React.memo(
  ({dhikr, index, onPress}) => {
    const {theme} = useTheme();
    const styles = createStyles(theme);

    const displayNumber = index + 1;
    const hasAudio = !!dhikr.audioFile;

    return (
      <Pressable
        style={styles.container}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={dhikr.translation || dhikr.arabic}>
        {/* Ornate top border pattern */}
        <View style={styles.ornamentBar}>
          <View style={styles.ornamentLeft} />
          <View style={styles.ornamentCenter}>
            <Text style={styles.ornamentNumber}>{displayNumber}</Text>
          </View>
          <View style={styles.ornamentRight} />
        </View>

        {/* Arabic text */}
        <View style={styles.arabicContainer}>
          <Text style={styles.arabicText}>{dhikr.arabic}</Text>
        </View>

        {/* Translation */}
        {dhikr.translation ? (
          <View style={styles.annotationContainer}>
            <View style={styles.annotationLine} />
            <Text style={styles.translationText}>{dhikr.translation}</Text>
          </View>
        ) : null}

        {/* Footer with metadata */}
        <View style={styles.footer}>
          {dhikr.repeatCount > 1 ? (
            <Text style={styles.repeatText}>Repeat {dhikr.repeatCount}×</Text>
          ) : (
            <View style={styles.audioIndicator} />
          )}
        </View>
      </Pressable>
    );
  },
);

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
      fontSize: moderateScale(18),
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
      fontSize: moderateScale(13),
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
