import React from 'react';
import {Animated, TouchableOpacity} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Icon} from '@rneui/themed';
import {useRouter} from 'expo-router';

interface NavigationButtonsProps {
  insets: {
    top: number;
  };
  iconsOpacity: Animated.Value;
  iconsZIndex: Animated.Value;
  scrollY: Animated.Value;
  onSearchPress: () => void;
}

/**
 * NavigationButtons component for the ReciterProfile
 *
 * This component displays the back and search buttons that appear
 * at the top of the ReciterProfile screen.
 *
 * @component
 */
export const NavigationButtons: React.FC<NavigationButtonsProps> = ({
  insets,
  iconsOpacity,
  iconsZIndex,
  scrollY,
  onSearchPress,
}) => {
  const router = useRouter();
  const {theme} = useTheme();

  // Create a header opacity animation similar to the loved.tsx screen
  const headerOpacity = scrollY.interpolate({
    inputRange: [100, 200],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

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
        <TouchableOpacity activeOpacity={0.99} onPress={() => router.back()}>
          <Animated.View
            style={{
              opacity: headerOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0],
              }),
            }}>
            <Icon
              name="arrow-left"
              type="feather"
              size={moderateScale(24)}
              color={theme.colors.text}
            />
          </Animated.View>
          <Animated.View
            style={{
              position: 'absolute',
              opacity: headerOpacity,
            }}>
            <Icon
              name="arrow-left"
              type="feather"
              size={moderateScale(24)}
              color="white"
            />
          </Animated.View>
        </TouchableOpacity>
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
        <TouchableOpacity activeOpacity={0.99} onPress={onSearchPress}>
          <Animated.View
            style={{
              opacity: headerOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0],
              }),
            }}>
            <Icon
              name="search"
              type="feather"
              size={moderateScale(20)}
              color={theme.colors.text}
            />
          </Animated.View>
          <Animated.View
            style={{
              position: 'absolute',
              opacity: headerOpacity,
            }}>
            <Icon
              name="search"
              type="feather"
              size={moderateScale(20)}
              color="white"
            />
          </Animated.View>
        </TouchableOpacity>
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
