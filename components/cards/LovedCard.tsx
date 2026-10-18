import React from 'react';
import {Text, TouchableOpacity, View, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {HeartIcon} from '@/components/Icons';
import Color from 'color';
// @ai-start
import {useTranslation} from 'react-i18next';
// @ai-end

interface LovedCardProps {
  itemCount: number;
  onPress: () => void;
  width?: number;
  height?: number;
}

// @ai-start
export const LovedCard: React.FC<LovedCardProps> = ({
  itemCount,
  onPress,
  width,
  height,
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation(['home', 'common']);

  // Red color for loved surahs
  const lovedColor = '#FF6B6B';
  const backgroundColor = Color(lovedColor).alpha(0.15).toString();
  const borderColor = Color(lovedColor).alpha(0.3).toString();

  // Use provided dimensions or fall back to default
  const cardWidth = width || moderateScale(120);
  const cardHeight = height || moderateScale(120);
  const iconSize = cardWidth * 0.4; // 40% of card width

  const styles = StyleSheet.create({
    container: {
      width: cardWidth,
    },
    iconContainer: {
      width: cardWidth,
      height: cardHeight,
      marginBottom: verticalScale(5),
      overflow: 'hidden',
      borderRadius: moderateScale(15),
      backgroundColor,
      borderWidth: 1,
      borderColor,
      justifyContent: 'center',
      alignItems: 'center',
    },
    name: {
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.regular,
      color: theme.colors.text,
      marginBottom: verticalScale(2),
    },
    subtitle: {
      fontSize: moderateScale(10),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
    },
  });

  return (
    <TouchableOpacity
      activeOpacity={0.99}
      style={styles.container}
      onPress={onPress}>
      <View style={styles.iconContainer}>
        <HeartIcon color={lovedColor} size={iconSize} filled={true} />
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {t('cards.lovedSurahs')}
      </Text>
      <Text style={styles.subtitle} numberOfLines={1}>
        {t('common:counts.surahs', {count: itemCount})}
      </Text>
    </TouchableOpacity>
  );
};
// @ai-end
