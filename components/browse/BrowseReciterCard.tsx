import React, {useMemo} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Platform} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {Reciter} from '@/data/reciterData';
import {Theme} from '@/utils/themeUtils';
import {ReciterImage} from '@/components/ReciterImage';
import {BlurView} from '@react-native-community/blur';
import Color from 'color';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';

interface BrowseReciterCardProps {
  reciter: Reciter;
  onPress: () => void;
  width: number;
  height: number;
  theme: Theme;
}

// Remove or comment out the unused type
// type StylesType = ReturnType<typeof createStyles>;

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

function createStyles(theme: Theme, width: number, height: number) {
  return StyleSheet.create({
    container: {
      width,
      height,
      borderRadius: moderateScale(12),
      overflow: 'hidden',
      // borderWidth: 0.5,
      borderColor: Color(theme.colors.border).alpha(0.15).toString(),
    },
    backgroundImageContainer: {
      position: 'absolute',
      top: -10,
      left: -10,
      right: -10,
      bottom: -10,
      overflow: 'hidden',
    },
    backgroundImage: {
      width: '90%',
      height: '90%',
      // transform: [{scale: 1.2}],
    },
    foregroundImageContainer: {
      width: '100%',
      height: '65%', // Reduced from 70% to give more space to the text
      justifyContent: 'flex-start',
      alignItems: 'center',
      overflow: 'hidden',
    },
    foregroundImage: {
      width: '100%',
      height: '100%',
    },
    contentContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '35%', // Increased from 30% to give more space to the text
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(10),
      justifyContent: 'center',
    },
    blurContainer: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'hidden',
    },
    overlay: {
      // ...StyleSheet.absoluteFillObject,
      // backgroundColor: theme.colors.card,
      // opacity: 0.9,
    },
    imageOverlay: {
      // ...StyleSheet.absoluteFillObject,
      // // backgroundColor: theme.colors.background,
      // opacity: 0.5,
    },
    reciterName: {
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
      marginBottom: moderateScale(4),
      lineHeight: moderateScale(16), // Added line height to ensure text isn't cut off
      includeFontPadding: false, // Added to fix Android text clipping issues
      textAlignVertical: 'center', // Helps with vertical alignment on Android
    },
    reciterInfo: {
      fontSize: moderateScale(10),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
      lineHeight: moderateScale(14), // Added line height to ensure text isn't cut off
      includeFontPadding: false, // Added to fix Android text clipping issues
      textAlignVertical: 'center', // Helps with vertical alignment on Android
    },
  });
}

const BrowseReciterCard = React.memo(
  ({reciter, onPress, width, height, theme}: BrowseReciterCardProps) => {
    const styles = useMemo(
      () => createStyles(theme, width, height),
      [theme, width, height],
    );

    // Get unique rewayat names to properly display info
    const uniqueRewayatNames = useMemo(() => {
      const names = new Set(reciter.rewayat.map(r => r.name));
      return Array.from(names);
    }, [reciter.rewayat]);

    // Animation values
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => {
      return {
        transform: [{scale: scale.value}],
      };
    });

    const handlePressIn = () => {
      scale.value = withSpring(0.95, {
        damping: 15,
        stiffness: 300,
      });
    };

    const handlePressOut = () => {
      scale.value = withSpring(1, {
        damping: 15,
        stiffness: 300,
      });
    };

    // Reduced blur amounts for better performance
    const backgroundBlurAmount = 15; // Reduced from 20
    const contentBlurAmount = 8; // Reduced from 10

    return (
      <AnimatedTouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.container, animatedStyle]}>
        {/* Background blurred image */}
        <View style={styles.backgroundImageContainer}>
          <ReciterImage
            imageUrl={reciter.image_url || undefined}
            reciterName={reciter.name}
            style={styles.backgroundImage}
            profileIconSize={moderateScale(40)}
          />
          {Platform.OS === 'ios' ? (
            <BlurView
              blurAmount={backgroundBlurAmount}
              blurType={theme.isDarkMode ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}>
              <View style={styles.imageOverlay} />
            </BlurView>
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                styles.imageOverlay,
                {
                  backgroundColor: theme.isDarkMode
                    ? 'rgba(0,0,0,0.75)'
                    : 'rgba(255,255,255,0.8)',
                },
              ]}
            />
          )}
        </View>

        {/* Foreground clear image */}
        <View style={styles.foregroundImageContainer}>
          <ReciterImage
            imageUrl={reciter.image_url || undefined}
            reciterName={reciter.name}
            style={styles.foregroundImage}
            profileIconSize={moderateScale(40)}
          />
        </View>

        {/* Content Overlay */}
        <View style={styles.contentContainer}>
          {Platform.OS === 'ios' ? (
            <BlurView
              blurAmount={contentBlurAmount}
              blurType={theme.isDarkMode ? 'dark' : 'light'}
              style={styles.blurContainer}>
              <View style={styles.overlay} />
            </BlurView>
          ) : (
            <View
              style={[
                styles.blurContainer,
                styles.overlay,
                {
                  backgroundColor: theme.colors.card,
                  opacity: 0.9, // Increased from 0.85 for better text visibility
                },
              ]}
            />
          )}
          <View style={{paddingTop: Platform.OS === 'android' ? 2 : 0}}>
            <Text style={styles.reciterName} numberOfLines={1}>
              {reciter.name}
            </Text>
            <Text style={styles.reciterInfo} numberOfLines={1}>
              {uniqueRewayatNames.length > 1
                ? `${uniqueRewayatNames.length} rewayat available`
                : reciter.rewayat[0]?.name || ''}
            </Text>
          </View>
        </View>
      </AnimatedTouchableOpacity>
    );
  },
  (prevProps, nextProps) =>
    prevProps.reciter === nextProps.reciter &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height &&
    prevProps.theme === nextProps.theme,
);

BrowseReciterCard.displayName = 'BrowseReciterCard';

export {BrowseReciterCard};
