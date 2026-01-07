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
import {ReciterImage} from '@/components/ReciterImage';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import Color from 'color';

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

interface ReciterDownloadsHeaderProps {
  reciterName: string;
  reciterImageUrl?: string;
  subtitle: string;
  onPlayPress: () => void;
  onShufflePress: () => void;
  theme: Theme;
}

export const ReciterDownloadsHeader: React.FC<ReciterDownloadsHeaderProps> = ({
  reciterName,
  reciterImageUrl,
  subtitle,
  onPlayPress,
  onShufflePress,
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

  return (
    <View style={styles.headerContainer}>
      <LinearGradient
        colors={['#10B981', theme.colors.background]}
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
          {/* Reciter Image */}
          <View style={styles.reciterImageContainer}>
            <ReciterImage
              reciterName={reciterName}
              imageUrl={reciterImageUrl}
              style={styles.reciterImage}
            />
          </View>

          {/* Title and Subtitle */}
          <Text style={styles.title}>{reciterName}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </LinearGradient>

      {/* Action Buttons */}
      <View style={styles.contentWrapper}>
        <View style={styles.actionButtons}>
          {/* Spacer for alignment */}
          <View style={styles.spacer} />

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
    reciterImageContainer: {
      width: moderateScale(80),
      height: moderateScale(80),
      marginBottom: moderateScale(12),
    },
    reciterImage: {
      width: moderateScale(80),
      height: moderateScale(80),
      borderRadius: moderateScale(6),
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
    spacer: {
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
