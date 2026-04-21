import React from 'react';
import {Animated, Pressable, View} from 'react-native';
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
  onSharePress?: () => void;
}

export const NavigationButtons: React.FC<NavigationButtonsProps> = ({
  insets,
  iconsOpacity,
  iconsZIndex,
  onSearchPress,
  onSharePress,
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
          styles.rightButtons,
          {
            top: insets.top,
            right: moderateScale(15),
            opacity: iconsOpacity,
            zIndex: iconsZIndex,
          },
        ]}>
        {onSharePress && (
          <Pressable
            onPress={onSharePress}
            hitSlop={8}
            style={{marginRight: moderateScale(16)}}>
            <Feather
              name="share"
              size={moderateScale(20)}
              color={theme.colors.text}
            />
          </Pressable>
        )}
        <Pressable onPress={onSearchPress} hitSlop={8}>
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
  rightButtons: {
    position: 'absolute',
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
