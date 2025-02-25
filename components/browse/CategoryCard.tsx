import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import {moderateScale, scale} from 'react-native-size-matters';
import {LinearGradient} from 'expo-linear-gradient';
import Color from 'color';

export interface CategoryCardProps {
  id: string;
  title: string;
  backgroundColor: string;
  icon: {
    name: string;
    type: string;
  };
  onPress: () => void;
}

export function CategoryCard({
  title,
  backgroundColor,
  onPress,
}: CategoryCardProps) {
  const {width: SCREEN_WIDTH} = useWindowDimensions();
  const CARD_MARGIN = scale(6);
  const CARD_WIDTH = (SCREEN_WIDTH - scale(32) - CARD_MARGIN * 2) / 2;
  const CARD_ASPECT_RATIO = 0.4; // Shorter cards

  const baseColor = Color(backgroundColor);
  const gradientColors = [
    baseColor.alpha(0.95).toString(),
    baseColor.darken(0.15).toString(),
  ];

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.container, {width: CARD_WIDTH, height: CARD_WIDTH * CARD_ASPECT_RATIO}]}>
      <LinearGradient
        colors={gradientColors}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.gradient}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: scale(6),
    borderRadius: moderateScale(12),
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  gradient: {
    flex: 1,
    padding: moderateScale(12),
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  title: {
    color: 'white',
    fontSize: moderateScale(13),
    fontFamily: 'Manrope-Bold',
    lineHeight: moderateScale(17),
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
});
