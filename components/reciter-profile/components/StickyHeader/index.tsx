import React from 'react';
import {Animated, StyleSheet, Text, View} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {useTheme} from '@/hooks/useTheme';
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
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: theme.colors.background,
          },
        ]}
      />
      <Text style={[styles.stickyHeaderTitle, {color: theme.colors.text}]}>
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
    stickyHeaderTitle: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
  });
