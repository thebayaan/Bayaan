// @ai-generated
import React, {useMemo} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {moderateScale} from '@/utils/scale';
import {useSettings} from '@/hooks/useSettings';

/**
 * "When you tap a surah": play the default reciter, or ask each time. Other
 * choices from the Reciter choice screen (browse all, random) select neither
 * segment until the user picks one here.
 */
export function PlaybackModeSwitch() {
  const {theme} = useTheme();
  const {t} = useTranslation('settings');
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {
    askEveryTime,
    setAskEveryTime,
    defaultReciterSelection,
    setDefaultReciterSelection,
  } = useSettings();

  let selected = -1;
  if (askEveryTime) selected = 1;
  else if (defaultReciterSelection === 'useDefault') selected = 0;
  const options = [
    {
      label: t('defaultReciter.playDefault'),
      onPress: () => {
        setDefaultReciterSelection('useDefault');
        setAskEveryTime(false);
      },
    },
    {
      label: t('defaultReciter.askEachTime'),
      onPress: () => setAskEveryTime(true),
    },
  ];

  return (
    <View>
      <Text style={styles.header}>{t('defaultReciter.whenYouTap')}</Text>
      <View style={styles.track} accessibilityRole="radiogroup">
        {options.map((option, i) => {
          const on = i === selected;
          return (
            <Pressable
              key={option.label}
              onPress={option.onPress}
              accessibilityRole="radio"
              accessibilityState={{checked: on}}
              style={[styles.segment, on && styles.segmentOn]}>
              <Text style={[styles.label, on && styles.labelOn]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) => {
  const text = Color(theme.colors.text);
  return StyleSheet.create({
    header: {
      fontSize: moderateScale(15),
      fontFamily: theme.fonts.regular,
      color: text.alpha(0.6).toString(),
      marginBottom: moderateScale(8),
      marginStart: moderateScale(16),
      textAlign: 'left',
    },
    track: {
      height: moderateScale(44),
      padding: 4,
      borderRadius: moderateScale(22),
      backgroundColor: text.alpha(0.06).toString(),
      flexDirection: 'row',
    },
    segment: {
      flex: 1,
      borderRadius: moderateScale(18),
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentOn: {
      backgroundColor: theme.isDarkMode
        ? text.alpha(0.16).toString()
        : '#ffffff',
      shadowColor: '#000',
      shadowOpacity: theme.isDarkMode ? 0 : 0.1,
      shadowRadius: 6,
      shadowOffset: {width: 0, height: 2},
      elevation: theme.isDarkMode ? 0 : 2,
    },
    label: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.bold,
      color: text.alpha(0.62).toString(),
    },
    labelOn: {
      color: theme.colors.text,
    },
  });
};
