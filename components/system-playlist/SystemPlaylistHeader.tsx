import React from 'react';
import {View, Text, Pressable} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface SystemPlaylistHeaderProps {
  title: string;
  description: string;
  itemCount: number;
  estimatedDuration?: string | null;
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
  onPlayPress,
  onShufflePress,
  canPlayImmediately,
  theme,
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const styles = createStyles(theme, insets);

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
    .join(' \u2022 ');

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
          {/* System Playlist Badge */}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Bayaan Curated</Text>
          </View>

          {/* Title and Description */}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          <Text style={styles.subtitle}>{subtitleText}</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.contentWrapper}>
        <View style={styles.actionButtons}>
          {/* Empty left space for alignment */}
          <View style={styles.leftPlaceholder} />

          {/* Right side buttons */}
          <View style={styles.rightAlignedButtons}>
            {onShufflePress && canPlayImmediately && (
              <AnimatedPressable
                style={[styles.circleButton, shuffleAnimatedStyle]}
                onPress={onShufflePress}
                onPressIn={() => handlePressIn('shuffle')}
                onPressOut={() => handlePressOut('shuffle')}>
                <ShuffleIcon
                  color={theme.colors.text}
                  size={moderateScale(20)}
                />
              </AnimatedPressable>
            )}
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
      backgroundColor: Color(theme.colors.textSecondary).alpha(0.1).toString(),
    },
    badgeText: {
      fontSize: moderateScale(11),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.textSecondary,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: moderateScale(24),
      fontFamily: theme.fonts.bold,
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: moderateScale(8),
      letterSpacing: -0.5,
    },
    description: {
      fontSize: moderateScale(14),
      color: theme.colors.textSecondary,
      fontFamily: theme.fonts.regular,
      textAlign: 'center',
      marginBottom: moderateScale(12),
      paddingHorizontal: moderateScale(10),
      lineHeight: moderateScale(20),
    },
    subtitle: {
      fontSize: moderateScale(12),
      color: theme.colors.textSecondary,
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
