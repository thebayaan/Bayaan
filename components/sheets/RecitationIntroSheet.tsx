import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import ActionSheet, {
  SheetManager,
  SheetProps,
} from 'react-native-actions-sheet';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';

interface IntroPoint {
  icon: React.ComponentProps<typeof Feather>['name'];
  text: string;
}

const POINTS: readonly IntroPoint[] = [
  {
    icon: 'book-open',
    text: 'Recite and the page follows you, ayah by ayah and word by word, turning pages as you go.',
  },
  {
    icon: 'lock',
    text: 'Recognition runs on your phone. Your voice is never uploaded, and it works offline.',
  },
  {
    icon: 'download',
    text: 'Needs the microphone and a one-time 75 MB download.',
  },
  {
    icon: 'info',
    text: 'Follows Hafs recitation. It finds your place; it does not check tajweed.',
  },
];

/**
 * First tap on the mushaf mic: explains Follow my recitation before asking
 * for the microphone and the model download. Returns true to go ahead.
 */
export const RecitationIntroSheet = (
  props: SheetProps<'recitation-intro'>,
): React.JSX.Element => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  function close(start: boolean): void {
    void SheetManager.hide(props.sheetId, {payload: start});
  }

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Follow my recitation</Text>
      </View>
      <View style={styles.container}>
        {POINTS.map(point => (
          <View key={point.icon} style={styles.point}>
            <Feather
              name={point.icon}
              size={moderateScale(18)}
              color={theme.colors.text}
            />
            <Text style={styles.pointText}>{point.text}</Text>
          </View>
        ))}
        <Pressable
          style={[styles.primaryButton, {backgroundColor: theme.colors.text}]}
          onPress={() => close(true)}
          accessibilityRole="button">
          <Text
            style={[
              styles.primaryButtonText,
              {color: theme.colors.background},
            ]}>
            Allow microphone and download
          </Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => close(false)}
          accessibilityRole="button">
          <Text style={styles.secondaryButtonText}>Not now</Text>
        </Pressable>
      </View>
    </ActionSheet>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      paddingTop: moderateScale(8),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
      height: 2.5,
    },
    headerContainer: {
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      borderBottomWidth: 1,
      borderBottomColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    headerTitle: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    container: {
      paddingHorizontal: moderateScale(20),
      paddingTop: moderateScale(20),
      paddingBottom: moderateScale(40),
      gap: moderateScale(16),
    },
    point: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: moderateScale(12),
    },
    pointText: {
      flex: 1,
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      lineHeight: moderateScale(20),
    },
    primaryButton: {
      marginTop: moderateScale(8),
      paddingVertical: moderateScale(14),
      borderRadius: moderateScale(12),
      alignItems: 'center',
    },
    primaryButtonText: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
    },
    secondaryButton: {
      paddingVertical: moderateScale(8),
      alignItems: 'center',
    },
    secondaryButtonText: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
  });
