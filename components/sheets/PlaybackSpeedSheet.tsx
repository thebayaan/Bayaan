import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {SheetProps, SheetManager} from 'react-native-actions-sheet';
import ActionSheet from '@/components/sheets/AdaptiveActionSheet';
import Color from 'color';
// @ai-start
import {useTranslation} from 'react-i18next';
// @ai-end

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

// @ai-start
export const PlaybackSpeedSheet = (props: SheetProps<'playback-speed'>) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {t} = useTranslation('sheets');

  const payload = props.payload;
  const currentSpeed = payload?.currentSpeed ?? 1;
  const onSpeedChange = payload?.onSpeedChange;

  const handleSpeedSelect = (speed: number) => {
    if (onSpeedChange) {
      onSpeedChange(speed);
    }
    SheetManager.hide('playback-speed');
  };

  return (
    <ActionSheet
      id={props.sheetId}
      tabletPresentation="menu"
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>{t('playbackSpeed.title')}</Text>
      </View>
      <View style={styles.container}>
        <View style={styles.speedContainer}>
          {SPEEDS.map(speed => (
            <Pressable
              key={speed}
              style={({pressed}) => [
                styles.speedButton,
                currentSpeed === speed && styles.selectedSpeed,
                pressed && !currentSpeed && styles.speedButtonPressed,
              ]}
              onPress={() => handleSpeedSelect(speed)}>
              <Text
                style={[
                  styles.speedText,
                  currentSpeed === speed && styles.selectedSpeedText,
                ]}>
                {t('playbackSpeed.speed', {speed})}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ActionSheet>
  );
};
// @ai-end

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
      paddingVertical: moderateScale(24),
      paddingBottom: moderateScale(40),
    },
    speedContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: moderateScale(12),
    },
    speedButton: {
      paddingVertical: moderateScale(10),
      paddingHorizontal: moderateScale(20),
      borderRadius: moderateScale(20),
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    speedButtonPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.1).toString(),
    },
    selectedSpeed: {
      backgroundColor: theme.colors.text,
    },
    speedText: {
      fontSize: moderateScale(16),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    selectedSpeedText: {
      color: theme.colors.background,
    },
  });
