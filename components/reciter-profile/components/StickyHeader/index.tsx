import React from 'react';
import {Animated, StyleSheet, Text, Platform, View} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {useTheme} from '@/hooks/useTheme';
import {BlurView} from '@react-native-community/blur';
import {LinearGradient} from 'expo-linear-gradient';
import {StickyHeaderProps} from '@/components/reciter-profile/types';

/**
 * StickyHeader component for the ReciterProfile
 *
 * This component displays a sticky header with blur effect and gradient
 * that appears when scrolling the ReciterProfile screen.
 *
 * @component
 */
export const StickyHeader: React.FC<StickyHeaderProps> = ({
  reciterName,
  headerOpacity,
  insets,
  dominantColors,
  isDarkMode,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  return (
    <Animated.View
      style={[
        styles.stickyHeader,
        {
          opacity: headerOpacity,
          paddingTop: insets.top,
        },
      ]}>
      {Platform.OS === 'ios' ? (
        <BlurView
          blurAmount={100}
          blurType={isDarkMode ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isDarkMode
                ? 'rgba(0,0,0,0.75)'
                : 'rgba(255,255,255,0.85)',
            },
          ]}
        />
      )}
      <LinearGradient
        colors={[dominantColors.primary, dominantColors.secondary]}
        style={[StyleSheet.absoluteFill, styles.headerGradient]}
        start={{x: 0, y: 0}}
        end={{x: 0, y: 1}}
      />
      <Text style={[styles.stickyHeaderTitle, {color: 'white'}]}>
        {reciterName}
      </Text>
    </Animated.View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    stickyHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
      paddingBottom: moderateScale(15),
      paddingHorizontal: moderateScale(20),
      overflow: 'hidden',
    },
    headerGradient: {
      opacity: 0.9,
    },
    stickyHeaderTitle: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
  });
