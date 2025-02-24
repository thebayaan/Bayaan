import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Dimensions,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {Icon} from '@rneui/themed';
import {LinearGradient} from 'expo-linear-gradient';
import Color from 'color';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const CARD_MARGIN = moderateScale(8);
const CARD_WIDTH = (SCREEN_WIDTH - CARD_MARGIN * 4) / 2; // Account for left and right margins
const CARD_ASPECT_RATIO = 0.6; // More rectangular shape

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
  icon,
  onPress,
}: CategoryCardProps) {
  const baseColor = Color(backgroundColor);
  const gradientColors = [
    baseColor.alpha(0.8).toString(),
    baseColor.darken(0.2).toString(),
  ];

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={styles.container}>
      <LinearGradient
        colors={gradientColors}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.gradient}>
        <View style={styles.content}>
          <Icon
            name={icon.name}
            type={icon.type}
            color="white"
            size={moderateScale(24)}
            style={styles.icon}
          />
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * CARD_ASPECT_RATIO,
    margin: CARD_MARGIN,
    borderRadius: moderateScale(12),
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  gradient: {
    flex: 1,
    padding: moderateScale(12),
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  icon: {
    marginBottom: moderateScale(4),
  },
  title: {
    color: 'white',
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-Bold',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
});
