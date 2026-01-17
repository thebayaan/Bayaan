import React, {useMemo} from 'react';
import {TouchableOpacity, Text, View, StyleSheet} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {RewayatInfo} from '@/data/rewayatCollections';
import {useTheme} from '@/hooks/useTheme';
import Color from 'color';
import {LinearGradient} from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {Icon} from '@rneui/base';

interface RewayatCardProps {
  rewayat: RewayatInfo;
  onPress: () => void;
  width?: number;
  height?: number;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function RewayatCard({
  rewayat,
  onPress,
  width = moderateScale(130),
  height = moderateScale(110),
}: RewayatCardProps) {
  const {theme} = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, {damping: 15, stiffness: 400});
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {damping: 15, stiffness: 400});
  };

  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <AnimatedTouchable
      activeOpacity={1}
      style={[styles.container, {width, height}, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}>
      {/* Background gradient */}
      <LinearGradient
        colors={
          theme.isDarkMode
            ? [
                Color(theme.colors.card).lighten(0.15).hex(),
                Color(theme.colors.card).lighten(0.05).hex(),
              ]
            : [
                Color(theme.colors.background).hex(),
                Color(theme.colors.card).hex(),
              ]
        }
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={StyleSheet.absoluteFill}
      />

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconWrapper}>
            <Icon
              name="chevron-right"
              type="feather"
              size={moderateScale(14)}
              color={theme.colors.textSecondary}
            />
          </View>
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.displayName} numberOfLines={2}>
            {rewayat.displayName}
          </Text>
          <Text style={styles.subtitle}>
            {rewayat.reciterCount} reciter{rewayat.reciterCount !== 1 && 's'}
          </Text>
        </View>
      </View>
    </AnimatedTouchable>
  );
}

function createStyles(theme: {
  colors: {
    text: string;
    textSecondary: string;
    card: string;
    border: string;
    background: string;
  };
  fonts: {semiBold: string; regular: string; medium: string};
  isDarkMode: boolean;
}) {
  return StyleSheet.create({
    container: {
      borderRadius: moderateScale(14),
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.isDarkMode
        ? Color(theme.colors.border).alpha(0.1).toString()
        : Color(theme.colors.border).alpha(0.15).toString(),
    },
    content: {
      flex: 1,
      padding: moderateScale(14),
      justifyContent: 'space-between',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    iconWrapper: {
      width: moderateScale(24),
      height: moderateScale(24),
      borderRadius: moderateScale(12),
      backgroundColor: theme.isDarkMode
        ? Color(theme.colors.text).alpha(0.06).toString()
        : Color(theme.colors.text).alpha(0.04).toString(),
      alignItems: 'center',
      justifyContent: 'center',
    },
    textContainer: {
      gap: verticalScale(4),
    },
    displayName: {
      fontSize: moderateScale(15),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
      letterSpacing: -0.3,
      lineHeight: moderateScale(19),
    },
    subtitle: {
      fontSize: moderateScale(11),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
      letterSpacing: 0.1,
    },
  });
}

export default React.memo(RewayatCard);
