import React from 'react';
import {Animated, Pressable} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Feather} from '@expo/vector-icons';
import {useRouter} from 'expo-router';

interface NavigationButtonsProps {
  insets: {
    top: number;
  };
  iconsOpacity: Animated.Value;
  iconsZIndex: Animated.Value;
  onSearchPress: () => void;
}

export const NavigationButtons: React.FC<NavigationButtonsProps> = ({
  insets,
  iconsOpacity,
  iconsZIndex,
  onSearchPress,
}) => {
  const router = useRouter();
  const {theme} = useTheme();

  return (
    <>
      <Animated.View
        style={[
          styles.backButton,
          {
            top: insets.top,
            left: moderateScale(15),
            opacity: iconsOpacity,
            zIndex: iconsZIndex,
          },
        ]}>
        <Pressable onPress={() => router.back()}>
          <Feather
            name="arrow-left"
            size={moderateScale(24)}
            color={theme.colors.text}
          />
        </Pressable>
      </Animated.View>
      <Animated.View
        style={[
          styles.searchButton,
          {
            top: insets.top,
            right: moderateScale(20),
            opacity: iconsOpacity,
            zIndex: iconsZIndex,
          },
        ]}>
        <Pressable onPress={onSearchPress}>
          <Feather
            name="search"
            size={moderateScale(20)}
            color={theme.colors.text}
          />
        </Pressable>
      </Animated.View>
    </>
  );
};

const styles = ScaledSheet.create({
  backButton: {
    position: 'absolute',
    zIndex: 10,
  },
  searchButton: {
    position: 'absolute',
    zIndex: 10,
  },
});
