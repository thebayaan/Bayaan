import React from 'react';
import {View, Text} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';

interface JuzSectionHeaderProps {
  juzNumber: number;
  juzName: string;
  juzArabicName: string;
  surahCount?: number;
}

export const JuzSectionHeader: React.FC<JuzSectionHeaderProps> = React.memo(
  ({juzNumber, juzName, juzArabicName, surahCount}) => {
    const {theme} = useTheme();
    const styles = createStyles(theme);

    return (
      <View style={styles.container}>
        <View style={styles.leftContent}>
          <View style={styles.juzBadge}>
            <Text style={styles.juzNumber}>{juzNumber}</Text>
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.juzName} numberOfLines={1}>
              Juz {juzNumber} - {juzName}
            </Text>
            {surahCount !== undefined && (
              <Text style={styles.surahCount}>
                {surahCount} {surahCount === 1 ? 'Surah' : 'Surahs'}
              </Text>
            )}
          </View>
        </View>
        <Text style={styles.arabicName}>{juzArabicName}</Text>
      </View>
    );
  },
);

JuzSectionHeader.displayName = 'JuzSectionHeader';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: moderateScale(12),
      paddingHorizontal: moderateScale(16),
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderBottomWidth: 1,
      borderTopWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.1).toString(),
      marginBottom: moderateScale(8),
    },
    leftContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    juzBadge: {
      width: moderateScale(32),
      height: moderateScale(32),
      borderRadius: moderateScale(16),
      backgroundColor: Color(theme.colors.primary).alpha(0.15).toString(),
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: moderateScale(12),
    },
    juzNumber: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.primary,
    },
    textContainer: {
      flex: 1,
    },
    juzName: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    surahCount: {
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      marginTop: moderateScale(2),
    },
    arabicName: {
      fontSize: moderateScale(18),
      fontFamily: 'ScheherazadeNew',
      color: theme.colors.text,
      marginLeft: moderateScale(8),
    },
  });
