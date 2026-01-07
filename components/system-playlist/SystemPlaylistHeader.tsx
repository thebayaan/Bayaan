import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {LinearGradient} from 'expo-linear-gradient';
import {Icon} from '@rneui/themed';
import {useSafeAreaInsets, EdgeInsets} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {Theme} from '@/utils/themeUtils';
import {PlayIcon, ShuffleIcon} from '@/components/Icons';
import Color from 'color';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

interface SystemPlaylistHeaderProps {
  title: string;
  description: string;
  itemCount: number;
  estimatedDuration?: string | null;
  backgroundColor: string;
  onPlayPress: () => void;
  onShufflePress?: () => void;
  canPlayImmediately: boolean;
  theme: Theme;
}

export const SystemPlaylistHeader: React.FC<SystemPlaylistHeaderProps> = ({
  title,
  description,
  itemCount,
  estimatedDuration,
  backgroundColor,
  onPlayPress,
  onShufflePress,
  canPlayImmediately,
  theme,
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const styles = createStyles(theme, insets);

  // Animation values for button press feedback
  const shuffleScale = useSharedValue(1);
  const playScale = useSharedValue(1);

  const shuffleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: shuffleScale.value}],
  }));

  const playAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: playScale.value}],
  }));

  const handlePressIn = (button: 'shuffle' | 'play') => {
    const scale = button === 'shuffle' ? shuffleScale : playScale;
    scale.value = withSpring(0.92, {
      damping: 15,
      stiffness: 300,
    });
  };

  const handlePressOut = (button: 'shuffle' | 'play') => {
    const scale = button === 'shuffle' ? shuffleScale : playScale;
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 300,
    });
  };

  const subtitleText = [
    `${itemCount} ${itemCount === 1 ? 'surah' : 'surahs'}`,
    estimatedDuration,
  ]
    .filter(Boolean)
    .join(' • ');

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
          {/* System Playlist Badge */}
          <View
            style={[
              styles.badge,
              {
                backgroundColor: Color('white').alpha(0.2).toString(),
              },
            ]}>
            <Text style={styles.badgeText}>Bayaan Curated</Text>
          </View>

          {/* Title and Description */}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          <Text style={styles.subtitle}>{subtitleText}</Text>
        </View>
      </LinearGradient>

      {/* Action Buttons */}
      <View style={styles.contentWrapper}>
        <View style={styles.actionButtons}>
          {/* Empty left space for alignment */}
          <View style={styles.leftPlaceholder} />

          {/* Right side buttons */}
          <View style={styles.rightAlignedButtons}>
            {onShufflePress && canPlayImmediately && (
              <AnimatedTouchableOpacity
                activeOpacity={0.7}
                style={[styles.circleButton, shuffleAnimatedStyle]}
                onPress={onShufflePress}
                onPressIn={() => handlePressIn('shuffle')}
                onPressOut={() => handlePressOut('shuffle')}>
                <ShuffleIcon
                  color={theme.colors.text}
                  size={moderateScale(20)}
                />
              </AnimatedTouchableOpacity>
            )}
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
      width: '100%',
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(6),
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(6),
      borderRadius: moderateScale(16),
      marginBottom: moderateScale(16),
    },
    badgeText: {
      fontSize: moderateScale(11),
      fontFamily: theme.fonts.semiBold,
      color: 'white',
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: moderateScale(24),
      fontFamily: theme.fonts.bold,
      color: 'white',
      textAlign: 'center',
      marginBottom: moderateScale(8),
      letterSpacing: -0.5,
    },
    description: {
      fontSize: moderateScale(14),
      color: Color('white').alpha(0.9).toString(),
      fontFamily: theme.fonts.regular,
      textAlign: 'center',
      marginBottom: moderateScale(12),
      paddingHorizontal: moderateScale(10),
      lineHeight: moderateScale(20),
    },
    subtitle: {
      fontSize: moderateScale(12),
      color: Color('white').alpha(0.8).toString(),
      fontFamily: theme.fonts.medium,
      textAlign: 'center',
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
    leftPlaceholder: {
      width: moderateScale(40),
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
