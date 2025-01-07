import React from 'react';
import {View, TouchableOpacity, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {HeartIcon} from '@/components/Icons';
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

  // Calculate if the background is too close to red
  const backgroundColor = Color(theme.colors.background);
  const redDifference = Color('red').contrast(backgroundColor);

  // Choose heart color based on favorite state and background contrast
  const heartColor = isFavorite
    ? redDifference < 2
      ? '#ff9999' // Lighter red for dark/red backgrounds
      : '#ff3333' // Bright red for light backgrounds
    : theme.colors.text;

  return (
    <View style={styles(theme).container}>
      <View style={styles(theme).heartContainer}>
        <TouchableOpacity
          activeOpacity={0.99}
          onPress={onToggleFavorite}
          style={styles(theme).heartButton}>
          <HeartIcon
            color={heartColor}
            size={moderateScale(30)}
            filled={isFavorite}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = (_theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      marginVertical: moderateScale(16),
    },
    heartContainer: {
      width: moderateScale(40),
      height: moderateScale(40),
      justifyContent: 'center',
      alignItems: 'center',
    },
    heartButton: {
      padding: moderateScale(4),
      alignSelf: 'center',
    },
  });

export default AdditionalControls;
