import React from 'react';
import {View, Text} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';

interface CategorySectionHeaderProps {
  title: string;
  isFirst?: boolean;
}

export const CategorySectionHeader: React.FC<CategorySectionHeaderProps> =
  React.memo(({title, isFirst = false}) => {
    const {theme} = useTheme();
    const styles = createStyles(theme);

    return (
      <View style={[styles.container, isFirst && styles.firstContainer]}>
        <Text style={styles.title}>{title}</Text>
      </View>
    );
  });

CategorySectionHeader.displayName = 'CategorySectionHeader';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      paddingHorizontal: moderateScale(16),
      paddingTop: moderateScale(24),
      paddingBottom: moderateScale(8),
    },
    firstContainer: {
      paddingTop: moderateScale(8),
    },
    title: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
  });
