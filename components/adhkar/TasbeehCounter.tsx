import React, {useCallback} from 'react';
import {View, Text, TouchableOpacity, Animated} from 'react-native';
import * as Haptics from 'expo-haptics';
import {Feather} from '@expo/vector-icons';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {useAdhkar} from '@/hooks/useAdhkar';
import {Theme} from '@/utils/themeUtils';

interface TasbeehCounterProps {
  dhikrId: string;
  targetCount: number; // From dhikr.repeatCount
}

// Success color constant
const SUCCESS_COLOR = '#22C55E';

export const TasbeehCounter: React.FC<TasbeehCounterProps> = ({
  dhikrId,
  targetCount,
}) => {
  const {theme} = useTheme();
  const {getCount, incrementCount, resetCount} = useAdhkar();
  const count = getCount(dhikrId);

  // Animation for tap feedback
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  // Check if target has been reached
  const targetReached = count >= targetCount;

  // Calculate progress percentage
  const progress = Math.min(count / targetCount, 1);

  const animateTap = useCallback(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim]);

  const handleTap = useCallback(async () => {
    // Animate the tap
    animateTap();

    // Increment count
    const newCount = await incrementCount(dhikrId);

    // Light haptic on every tap
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Success haptic when reaching target
    if (newCount === targetCount) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [dhikrId, incrementCount, targetCount, animateTap]);

  const handleReset = useCallback(async () => {
    await resetCount(dhikrId);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [dhikrId, resetCount]);

  const styles = createStyles(theme, targetReached);

  return (
    <View style={styles.container}>
      {/* Main tap area */}
      <Animated.View style={{transform: [{scale: scaleAnim}]}}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleTap}
          style={styles.tapArea}
          accessibilityRole="button"
          accessibilityLabel={`Tasbeeh counter, ${count} of ${targetCount}`}
          accessibilityHint="Tap to increment count">
          {/* Circular progress background */}
          <View style={styles.progressCircle}>
            {/* Progress indicator - using a simple overlay technique */}
            <View
              style={[
                styles.progressOverlay,
                {
                  backgroundColor: targetReached
                    ? Color(SUCCESS_COLOR).alpha(0.15).toString()
                    : Color(theme.colors.primary).alpha(0.1).toString(),
                },
              ]}
            />

            {/* Inner circle with count */}
            <View style={styles.innerCircle}>
              {/* Count display */}
              <View style={styles.countDisplay}>
                <Text style={styles.currentCount}>{count}</Text>
                <Text style={styles.separator}> / </Text>
                <Text style={styles.targetCount}>{targetCount}</Text>
              </View>

              {/* Target reached indicator */}
              {targetReached ? (
                <View style={styles.successBadge}>
                  <Feather
                    name="check-circle"
                    size={moderateScale(20)}
                    color={SUCCESS_COLOR}
                  />
                  <Text style={styles.successText}>Complete</Text>
                </View>
              ) : (
                <Text style={styles.instructionText}>Tap to count</Text>
              )}

              {/* Progress text */}
              <Text style={styles.progressText}>
                {Math.round(progress * 100)}%
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Reset button */}
      <TouchableOpacity
        style={styles.resetButton}
        onPress={handleReset}
        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
        accessibilityRole="button"
        accessibilityLabel="Reset counter"
        accessibilityHint="Resets the count to zero">
        <Feather
          name="refresh-cw"
          size={moderateScale(18)}
          color={theme.colors.textSecondary}
        />
        <Text style={styles.resetText}>Reset</Text>
      </TouchableOpacity>
    </View>
  );
};

TasbeehCounter.displayName = 'TasbeehCounter';

const createStyles = (theme: Theme, targetReached: boolean) =>
  ScaledSheet.create({
    container: {
      alignItems: 'center',
      paddingVertical: moderateScale(20),
    },
    tapArea: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    progressCircle: {
      width: moderateScale(200),
      height: moderateScale(200),
      borderRadius: moderateScale(100),
      backgroundColor: targetReached
        ? Color(SUCCESS_COLOR).alpha(0.1).toString()
        : Color(theme.colors.primary).alpha(0.08).toString(),
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: moderateScale(4),
      borderColor: targetReached
        ? SUCCESS_COLOR
        : Color(theme.colors.primary).alpha(0.3).toString(),
    },
    progressOverlay: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      borderRadius: moderateScale(100),
    },
    innerCircle: {
      width: moderateScale(170),
      height: moderateScale(170),
      borderRadius: moderateScale(85),
      backgroundColor: theme.colors.card,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.2).toString(),
    },
    countDisplay: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    currentCount: {
      fontSize: moderateScale(52),
      fontFamily: theme.fonts.bold,
      color: targetReached ? SUCCESS_COLOR : theme.colors.primary,
    },
    separator: {
      fontSize: moderateScale(24),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
    },
    targetCount: {
      fontSize: moderateScale(24),
      fontFamily: theme.fonts.medium,
      color: theme.colors.textSecondary,
    },
    instructionText: {
      marginTop: moderateScale(8),
      fontSize: moderateScale(13),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
    },
    successBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: moderateScale(8),
      gap: moderateScale(4),
    },
    successText: {
      fontSize: moderateScale(13),
      fontFamily: theme.fonts.semiBold,
      color: SUCCESS_COLOR,
    },
    progressText: {
      marginTop: moderateScale(4),
      fontSize: moderateScale(11),
      fontFamily: theme.fonts.regular,
      color: Color(theme.colors.textSecondary).alpha(0.7).toString(),
    },
    resetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: moderateScale(20),
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(10),
      backgroundColor: Color(theme.colors.border).alpha(0.1).toString(),
      borderRadius: moderateScale(8),
      gap: moderateScale(6),
    },
    resetText: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.medium,
      color: theme.colors.textSecondary,
    },
  });
