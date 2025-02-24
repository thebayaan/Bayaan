import React from 'react';
import {Animated, TouchableOpacity} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Icon, IconProps} from '@rneui/themed';
import {useRouter} from 'expo-router';

// Create a forwardRef wrapper for the Icon component
const ForwardedIcon = React.forwardRef<typeof Icon, IconProps>((props, ref) => (
  <Icon {...props} ref={ref} />
));

ForwardedIcon.displayName = 'ForwardedIcon';

// Create the animated component from the forwarded icon
const AnimatedIcon = Animated.createAnimatedComponent(ForwardedIcon);

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

  // Create a smoother color transition with more steps
  const iconColor = scrollY.interpolate({
    inputRange: [100, 200],
    outputRange: [theme.colors.text, 'white'],
    extrapolate: 'clamp',
  }) as unknown as string;

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
          <AnimatedIcon
            name="arrow-left"
            type="feather"
            size={moderateScale(24)}
            color={iconColor}
          />
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
          <AnimatedIcon
            name="search"
            type="feather"
            size={moderateScale(20)}
            color={iconColor}
          />
        </TouchableOpacity>
      </Animated.View>
    </>
  );
};

const styles = ScaledSheet.create({
  backButton: {
    position: 'absolute',
    left: moderateScale(15),
    zIndex: 10,
  },
  searchButton: {
    position: 'absolute',
    zIndex: 10,
  },
});
