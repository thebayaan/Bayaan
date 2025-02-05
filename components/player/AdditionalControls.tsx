import React from 'react';
import {View, TouchableOpacity, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {HeartIcon} from '@/components/Icons';
import {usePlayerBackground} from '@/hooks/usePlayerBackground';
import Color from 'color';

interface AdditionalControlsProps {
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

const AdditionalControls: React.FC<AdditionalControlsProps> = ({
  isFavorite,
  onToggleFavorite,
}) => {
  const {theme} = useTheme();
  const {gradientColors} = usePlayerBackground(theme, theme.isDarkMode);

  // Calculate contrasting colors based on background
  const baseColor = Color(gradientColors[0]);
  const contrastColor = baseColor.isLight()
    ? baseColor.darken(0.8).saturate(0.2)
    : baseColor.lighten(0.8).saturate(0.2);

  // Calculate heart color based on favorite state and background
  const heartColor = isFavorite
    ? baseColor.isLight()
      ? '#e01b24' // Darker red for light backgrounds
      : '#ff7a80' // Lighter red for dark backgrounds
    : contrastColor.string();

  return (
    <View style={styles.container}>
      <View style={styles.heartContainer}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onToggleFavorite}
          style={[styles.heartButton, isFavorite && styles.activeHeartButton]}>
          <HeartIcon
            color={heartColor}
            size={moderateScale(28)}
            filled={isFavorite}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: moderateScale(10),
  },
  heartContainer: {
    width: moderateScale(40),
    height: moderateScale(40),
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartButton: {
    padding: moderateScale(8),
    alignSelf: 'center',
    transform: [{scale: 1}],
  },
  activeHeartButton: {
    transform: [{scale: 1.2}],
  },
});

export default AdditionalControls;
