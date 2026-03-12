import React, {useMemo, useCallback} from 'react';
import {View, Text, Pressable} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {ThemeMode, Theme} from '@/utils/themeUtils';
import Color from 'color';
import {SunIcon, MoonIcon, AutoThemeIcon} from '@/components/Icons';
import * as Haptics from 'expo-haptics';

const THEME_OPTIONS: {
  mode: ThemeMode;
  label: string;
  icon: 'sun' | 'moon' | 'auto';
}[] = [
  {mode: 'light', label: 'Light', icon: 'sun'},
  {mode: 'dark', label: 'Dark', icon: 'moon'},
  {mode: 'system', label: 'Auto', icon: 'auto'},
];

const IconMap = {
  sun: SunIcon,
  moon: MoonIcon,
  auto: AutoThemeIcon,
};

export const ThemePicker: React.FC = () => {
  const {theme, themeMode, setThemeMode} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleSelect = useCallback(
    (mode: ThemeMode) => {
      if (mode === themeMode) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setThemeMode(mode);
    },
    [themeMode, setThemeMode],
  );

  return (
    <View style={styles.container}>
      {THEME_OPTIONS.map(option => {
        const isActive = themeMode === option.mode;
        const Icon = IconMap[option.icon];
        const iconColor = isActive
          ? theme.colors.text
          : Color(theme.colors.text).alpha(0.35).toString();

        return (
          <Pressable
            key={option.mode}
            style={({pressed}) => [
              styles.option,
              isActive && styles.optionActive,
              pressed && !isActive && styles.optionPressed,
            ]}
            onPress={() => handleSelect(option.mode)}>
            <Icon size={moderateScale(20)} color={iconColor} />
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flexDirection: 'row',
      gap: moderateScale(8),
    },
    option: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: moderateScale(12),
      borderRadius: moderateScale(12),
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      gap: moderateScale(6),
    },
    optionActive: {
      backgroundColor: Color(theme.colors.text).alpha(0.1).toString(),
      borderColor: Color(theme.colors.text).alpha(0.15).toString(),
    },
    optionPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    label: {
      fontSize: moderateScale(11.5),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.text).alpha(0.35).toString(),
    },
    labelActive: {
      color: Color(theme.colors.text).alpha(0.85).toString(),
      fontFamily: 'Manrope-SemiBold',
    },
  });
