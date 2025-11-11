import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {LinearGradient} from 'expo-linear-gradient';
import {Icon} from '@rneui/themed';
import {useSafeAreaInsets, EdgeInsets} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {Theme} from '@/utils/themeUtils';
import {PlayIcon, ShuffleIcon, DownloadIcon, HeartIcon} from '@/components/Icons';
import Color from 'color';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

interface LovedHeaderProps {
  title: string;
  subtitle: string;
  backgroundColor: string;
  onPlayPress: () => void;
  onShufflePress: () => void;
  onDownloadPress: () => void;
  theme: Theme;
}

export const LovedHeader: React.FC<LovedHeaderProps> = ({
  title,
  subtitle,
  backgroundColor,
  onPlayPress,
  onShufflePress,
  onDownloadPress,
  theme,
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const styles = createStyles(theme, insets);

  // Animation values for button press feedback
  const downloadScale = useSharedValue(1);
  const shuffleScale = useSharedValue(1);
  const playScale = useSharedValue(1);

  const downloadAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: downloadScale.value}],
  }));

  const shuffleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: shuffleScale.value}],
  }));

  const playAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: playScale.value}],
  }));

  const handlePressIn = (button: 'download' | 'shuffle' | 'play') => {
    const scale =
      button === 'download'
        ? downloadScale
        : button === 'shuffle'
          ? shuffleScale
          : playScale;
    scale.value = withSpring(0.92, {
      damping: 15,
      stiffness: 300,
    });
  };

  const handlePressOut = (button: 'download' | 'shuffle' | 'play') => {
    const scale =
      button === 'download'
        ? downloadScale
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
      <LinearGradient
        colors={[backgroundColor, theme.colors.background]}
        style={styles.gradientContainer}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}>
          <Icon
            name="arrow-left"
            type="feather"
            size={moderateScale(24)}
            color="white"
          />
        </TouchableOpacity>

        {/* Header Content */}
        <View style={styles.contentContainer}>
          {/* Hero Icon Container */}
          <View
            style={[
              styles.heroIconContainer,
              {
                backgroundColor: Color(backgroundColor).alpha(0.2).toString(),
                shadowColor: backgroundColor,
              },
            ]}>
            <View
              style={[
                styles.heroIconInner,
                {
                  backgroundColor: Color(backgroundColor)
                    .alpha(0.15)
                    .toString(),
                },
              ]}>
              <HeartIcon
                color="white"
                size={moderateScale(30)}
                filled={true}
              />
            </View>
          </View>

          {/* Title and Subtitle */}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </LinearGradient>

      {/* Action Buttons */}
      <View style={styles.contentWrapper}>
        <View style={styles.actionButtons}>
          {/* Download button on the left */}
          <AnimatedTouchableOpacity
            activeOpacity={0.7}
            style={[styles.downloadButton, downloadAnimatedStyle]}
            onPress={onDownloadPress}
            onPressIn={() => handlePressIn('download')}
            onPressOut={() => handlePressOut('download')}>
            <DownloadIcon color={theme.colors.text} size={moderateScale(20)} />
          </AnimatedTouchableOpacity>

          {/* Right side buttons */}
          <View style={styles.rightAlignedButtons}>
            <AnimatedTouchableOpacity
              activeOpacity={0.7}
              style={[styles.circleButton, shuffleAnimatedStyle]}
              onPress={onShufflePress}
              onPressIn={() => handlePressIn('shuffle')}
              onPressOut={() => handlePressOut('shuffle')}>
              <ShuffleIcon color={theme.colors.text} size={moderateScale(20)} />
            </AnimatedTouchableOpacity>
            <AnimatedTouchableOpacity
              activeOpacity={0.7}
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
            </AnimatedTouchableOpacity>
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
    gradientContainer: {
      width: '100%',
      alignItems: 'center',
      paddingTop: insets.top + moderateScale(20),
      paddingBottom: moderateScale(30),
      overflow: 'hidden',
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
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    heroIconInner: {
      width: moderateScale(56),
      height: moderateScale(56),
      borderRadius: moderateScale(28),
      justifyContent: 'center',
      alignItems: 'center',
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
    downloadButton: {
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

