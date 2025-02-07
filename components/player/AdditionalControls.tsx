import React from 'react';
import {View, TouchableOpacity, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {HeartIcon} from '@/components/Icons';
import {usePlayerColors} from '@/hooks/usePlayerColors';

interface AdditionalControlsProps {
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

const AdditionalControls: React.FC<AdditionalControlsProps> = ({
  isFavorite,
  onToggleFavorite,
}) => {
  const {theme} = useTheme();
  const playerColors = usePlayerColors();

  // Use theme-aware heart colors
  const heartColor = isFavorite
    ? theme.isDarkMode
      ? '#ff7a80' // Lighter red for dark mode
      : '#e01b24' // Darker red for light mode
    : playerColors?.text || theme.colors.text;

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
