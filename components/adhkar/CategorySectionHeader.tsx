import React from 'react';
import {View, Text, StyleProp, ViewStyle} from 'react-native';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
// @ai-start
import {latinLetterSpacing} from '@/utils/rtl';
// @ai-end

interface CategorySectionHeaderProps {
  title: string;
  style?: StyleProp<ViewStyle>; // @ai
}

export const CategorySectionHeader: React.FC<CategorySectionHeaderProps> =
  React.memo(({title, style}) => {
    const {theme} = useTheme();
    const styles = createStyles(theme);

    return (
      <View style={[styles.container, style]}>
        <Text style={styles.title}>{title}</Text>
      </View>
    );
  });

CategorySectionHeader.displayName = 'CategorySectionHeader';

// @ai-start
const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      backgroundColor: 'transparent',
      paddingHorizontal: moderateScale(16),
      paddingTop: moderateScale(16),
      paddingBottom: moderateScale(8),
    },
    title: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: latinLetterSpacing(0.5),
    },
  });
// @ai-end
