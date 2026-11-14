import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import {SheetManager, SheetProps} from 'react-native-actions-sheet';
import ActionSheet from '@/components/sheets/AdaptiveActionSheet';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {RECITATION_DOWNLOAD_MB} from '@/constants/recitation';
import {useTheme} from '@/hooks/useTheme';
import {formatNumber} from '@/i18n/format';
import {Theme} from '@/utils/themeUtils';

interface IntroPoint {
  icon: React.ComponentProps<typeof Feather>['name'];
  text: string;
}

/**
 * First tap on the mushaf mic: explains Follow my recitation before asking
 * for the microphone and the model download. Returns true to go ahead.
 */
export const RecitationIntroSheet = (
  props: SheetProps<'recitation-intro'>,
): React.JSX.Element => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {t} = useTranslation('sheets');
  const points: readonly IntroPoint[] = [
    {icon: 'book-open', text: t('recitationIntro.follows')},
    {icon: 'lock', text: t('recitationIntro.private')},
    {
      icon: 'download',
      text: t('recitationIntro.download', {
        size: formatNumber(RECITATION_DOWNLOAD_MB),
      }),
    },
    {icon: 'info', text: t('recitationIntro.hafs')},
  ];

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
        <Text style={styles.headerTitle}>{t('recitationIntro.title')}</Text>
      </View>
      <View style={styles.container}>
        {points.map(point => (
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
            {t('recitationIntro.start')}
          </Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => close(false)}
          accessibilityRole="button">
          <Text style={styles.secondaryButtonText}>
            {t('recitationIntro.notNow')}
          </Text>
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
