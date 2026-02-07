import React from 'react';
import {View, Text, Pressable} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {Icon} from '@rneui/themed';
import {useSafeAreaInsets, EdgeInsets} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {Theme} from '@/utils/themeUtils';
import {PlaylistIcon, PlayIcon, ShuffleIcon} from '@/components/Icons';
import Color from 'color';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PlaylistHeaderProps {
  title: string;
  subtitle: string;
  onPlayPress: () => void;
  onShufflePress: () => void;
  onOptionsPress: () => void;
  theme: Theme;
}

export const PlaylistHeader: React.FC<PlaylistHeaderProps> = ({
  title,
  subtitle,
  onPlayPress,
  onShufflePress,
  onOptionsPress,
  theme,
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const styles = createStyles(theme, insets);

  const optionsScale = useSharedValue(1);
  const shuffleScale = useSharedValue(1);
  const playScale = useSharedValue(1);

  const optionsAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: optionsScale.value}],
  }));

  const shuffleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: shuffleScale.value}],
  }));

  const playAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: playScale.value}],
  }));

  const handlePressIn = (button: 'options' | 'shuffle' | 'play') => {
    const scale =
      button === 'options'
        ? optionsScale
        : button === 'shuffle'
          ? shuffleScale
          : playScale;
    scale.value = withSpring(0.92, {
      damping: 15,
      stiffness: 300,
    });
  };

  const handlePressOut = (button: 'options' | 'shuffle' | 'play') => {
    const scale =
      button === 'options'
        ? optionsScale
        : button === 'shuffle'
          ? shuffleScale
          : playScale;
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 300,
    });
  };

  return (
    <View style={styles.headerContainer}>
      <View style={styles.contentArea}>
        {/* Back Button */}
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={8}>
          <Icon
            name="arrow-left"
            type="feather"
            size={moderateScale(24)}
            color={theme.colors.text}
          />
        </Pressable>

        {/* Header Content */}
        <View style={styles.contentContainer}>
          {/* Hero Icon Container */}
          <View style={styles.heroIconContainer}>
            <View style={styles.heroIconInner}>
              <PlaylistIcon
                color={theme.colors.text}
                size={moderateScale(30)}
              />
            </View>
          </View>

          {/* Title and Subtitle */}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.contentWrapper}>
        <View style={styles.actionButtons}>
          {/* Options button on the left */}
          <AnimatedPressable
            style={[styles.optionsButton, optionsAnimatedStyle]}
            onPress={onOptionsPress}
            onPressIn={() => handlePressIn('options')}
            onPressOut={() => handlePressOut('options')}>
            <Icon
              name="more-horizontal"
              type="feather"
              size={moderateScale(20)}
              color={theme.colors.text}
            />
          </AnimatedPressable>

          {/* Right side buttons */}
          <View style={styles.rightAlignedButtons}>
            <AnimatedPressable
              style={[styles.circleButton, shuffleAnimatedStyle]}
              onPress={onShufflePress}
              onPressIn={() => handlePressIn('shuffle')}
              onPressOut={() => handlePressOut('shuffle')}>
              <ShuffleIcon color={theme.colors.text} size={moderateScale(20)} />
            </AnimatedPressable>
            <AnimatedPressable
              style={[
                styles.circleButton,
                styles.playButton,
                playAnimatedStyle,
              ]}
              onPress={onPlayPress}
              onPressIn={() => handlePressIn('play')}
              onPressOut={() => handlePressOut('play')}>
              <View style={styles.playIconContainer}>
                <PlayIcon
                  color={theme.colors.background}
                  size={moderateScale(16)}
                />
              </View>
            </AnimatedPressable>
          </View>
        </View>
      </View>
    </View>
  );
};

const createStyles = (theme: Theme, insets: EdgeInsets) =>
  ScaledSheet.create({
    headerContainer: {
      width: '100%',
      overflow: 'hidden',
    },
    contentArea: {
      width: '100%',
      alignItems: 'center',
      paddingTop: insets.top + moderateScale(40),
      paddingBottom: moderateScale(30),
      overflow: 'hidden',
      backgroundColor: theme.colors.background,
    },
    backButton: {
      position: 'absolute',
      top: insets.top + moderateScale(10),
      left: moderateScale(15),
      zIndex: 10,
      padding: moderateScale(8),
    },
    contentContainer: {
      alignItems: 'center',
      paddingHorizontal: moderateScale(20),
    },
    heroIconContainer: {
      width: moderateScale(64),
      height: moderateScale(64),
      borderRadius: moderateScale(32),
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: moderateScale(12),
      backgroundColor: Color(theme.colors.textSecondary).alpha(0.1).toString(),
    },
    heroIconInner: {
      width: moderateScale(56),
      height: moderateScale(56),
      borderRadius: moderateScale(28),
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: Color(theme.colors.textSecondary).alpha(0.08).toString(),
    },
    title: {
      fontSize: moderateScale(17),
      fontFamily: theme.fonts.bold,
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: moderateScale(8),
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: moderateScale(12),
      color: theme.colors.text,
      fontFamily: theme.fonts.regular,
      textAlign: 'center',
      marginBottom: moderateScale(8),
    },
    contentWrapper: {
      paddingHorizontal: moderateScale(16),
    },
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: moderateScale(5),
      paddingHorizontal: moderateScale(5),
    },
    optionsButton: {
      width: moderateScale(40),
      height: moderateScale(40),
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: moderateScale(12),
      backgroundColor: Color(theme.colors.textSecondary).alpha(0.08).toString(),
      padding: moderateScale(8),
    },
    rightAlignedButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(8),
    },
    circleButton: {
      width: moderateScale(42),
      height: moderateScale(42),
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: moderateScale(12),
      backgroundColor: Color(theme.colors.textSecondary).alpha(0.08).toString(),
      padding: moderateScale(8),
    },
    playButton: {
      width: moderateScale(42),
      height: moderateScale(42),
      backgroundColor: theme.colors.text,
    },
    playIconContainer: {
      paddingLeft: moderateScale(4),
    },
  });
