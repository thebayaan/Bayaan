import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {moderateScale} from 'react-native-size-matters';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {SuperCategory} from '@/types/adhkar';

interface AdhkarBentoCardProps {
  category: SuperCategory;
  onPress: () => void;
  width: number;
  height: number;
}

export const AdhkarBentoCard = React.memo(function AdhkarBentoCard({
  category,
  onPress,
  width,
  height,
}: AdhkarBentoCardProps) {
  const {theme} = useTheme();

  // Subtle gradient incorporating the category's color (same pattern as ExploreView)
  const baseColor = Color(category.color);
  const gradientColors = [
    baseColor.alpha(0.15).toString(),
    baseColor.alpha(0.25).toString(),
  ] as const;

  // Adjust text sizes based on card height
  const isLargeCard = category.heightMultiplier >= 2;
  const titleSize = isLargeCard ? moderateScale(16) : moderateScale(14);

  const styles = createStyles(theme, width, height, category.color);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        style={styles.touchable}>
        <LinearGradient
          colors={gradientColors}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.gradient}>
          <View style={styles.content}>
            <View
              style={[
                styles.textContainer,
                isLargeCard
                  ? styles.topLeftContainer
                  : styles.centerLeftContainer,
              ]}>
              <Text
                style={[styles.title, {fontSize: titleSize}]}
                numberOfLines={isLargeCard ? 2 : 2}>
                {category.title}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
});

const createStyles = (
  theme: ReturnType<typeof useTheme>['theme'],
  width: number,
  height: number,
  color: string,
) =>
  StyleSheet.create({
    container: {
      width,
      height,
      borderRadius: moderateScale(12),
      overflow: 'hidden',
      marginBottom: moderateScale(8),
      borderWidth: 1,
      borderColor: Color(color).alpha(0.15).toString(),
    },
    touchable: {
      flex: 1,
    },
    gradient: {
      flex: 1,
      padding: moderateScale(16),
    },
    content: {
      flex: 1,
      justifyContent: 'center',
    },
    textContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    centerLeftContainer: {
      justifyContent: 'center',
      alignItems: 'flex-start',
    },
    topLeftContainer: {
      justifyContent: 'flex-start',
    },
    title: {
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      lineHeight: moderateScale(22),
      textAlign: 'left',
    },
  });

export default AdhkarBentoCard;
