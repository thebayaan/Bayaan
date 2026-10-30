// @ai-generated
import React, {useCallback, useMemo} from 'react';
import {Appearance, Pressable, StyleSheet, Text, View} from 'react-native';
import Svg, {Polygon} from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import {useTranslation} from 'react-i18next';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';
import {ThemeMode, Theme} from '@/utils/themeUtils';
import {darkColors, lightColors} from '@/styles/colorSchemes';

const MODES: ThemeMode[] = ['light', 'dark', 'system'];

/** The app's own surfaces, drawn small: a page with a card on it. */
const MOCK = {
  light: {
    page: lightColors.background,
    card: '#ffffff',
    line: Color(lightColors.text).alpha(0.28).toString(),
    dot: lightColors.text,
  },
  dark: {
    page: darkColors.background,
    card: Color(darkColors.text).alpha(0.08).string(),
    line: Color(darkColors.text).alpha(0.38).toString(),
    dot: darkColors.text,
  },
};

/** A miniature of the app in one appearance. */
function Mock({mode, styles}: {mode: ThemeMode; styles: Styles}) {
  if (mode !== 'system') {
    const c = MOCK[mode];
    return (
      <View style={[styles.mockPage, {backgroundColor: c.page}]}>
        <View style={[styles.mockCard, {backgroundColor: c.card}]}>
          <View style={[styles.lineLong, {backgroundColor: c.line}]} />
          <View style={[styles.lineShort, {backgroundColor: c.line}]} />
          <View style={[styles.dot, {backgroundColor: c.dot}]} />
        </View>
      </View>
    );
  }
  // System: light above the diagonal, dark below it.
  return (
    <View style={[styles.mockPage, {backgroundColor: MOCK.light.page}]}>
      <Svg
        style={StyleSheet.absoluteFill}
        viewBox="0 0 100 100"
        preserveAspectRatio="none">
        <Polygon points="100,0 100,100 0,100" fill={MOCK.dark.page} />
      </Svg>
      <View style={[styles.mockCard, styles.mockCardSystem]}>
        <Svg
          style={StyleSheet.absoluteFill}
          viewBox="0 0 100 100"
          preserveAspectRatio="none">
          <Polygon points="0,0 100,0 0,100" fill={MOCK.light.card} />
          <Polygon points="100,0 100,100 0,100" fill="#1b2025" />
        </Svg>
        <View style={[styles.lineLong, {backgroundColor: MOCK.light.line}]} />
        <View style={[styles.lineShort, {backgroundColor: MOCK.light.line}]} />
        <View style={[styles.dot, {backgroundColor: MOCK.dark.dot}]} />
      </View>
    </View>
  );
}

/**
 * Light, Dark and System as three tiles, each a small picture of the app in
 * that appearance; the selected one has a ring in the text colour.
 */
export function AppearancePicker(): React.JSX.Element {
  const {theme, themeMode, setThemeMode} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {t} = useTranslation('settings');

  const handleSelect = useCallback(
    (mode: ThemeMode) => {
      if (mode === themeMode) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setThemeMode(mode);
      Appearance.setColorScheme(mode === 'dark' ? 'dark' : 'light');
    },
    [themeMode, setThemeMode],
  );

  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {MODES.map(mode => {
        const selected = themeMode === mode;
        const label = t(`themePicker.${mode}`);
        return (
          <Pressable
            key={mode}
            style={styles.option}
            onPress={() => handleSelect(mode)}
            accessibilityRole="radio"
            accessibilityState={{checked: selected}}
            accessibilityLabel={label}>
            {({pressed}) => (
              <>
                <View
                  style={[
                    styles.ring,
                    selected && styles.ringSelected,
                    pressed && !selected && styles.ringPressed,
                  ]}>
                  <Mock mode={mode} styles={styles} />
                </View>
                <Text style={[styles.label, selected && styles.labelSelected]}>
                  {label}
                </Text>
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

const RING = moderateScale(3);
const TILE_RADIUS = moderateScale(18);

function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: moderateScale(12),
      padding: moderateScale(16),
    },
    option: {
      flex: 1,
      alignItems: 'center',
      gap: moderateScale(8),
    },
    ring: {
      width: '100%',
      aspectRatio: 1.3,
      borderRadius: TILE_RADIUS + RING,
      padding: RING,
      borderWidth: RING,
      borderColor: 'transparent',
    },
    ringSelected: {
      borderColor: theme.colors.text,
    },
    ringPressed: {
      borderColor: Color(theme.colors.text).alpha(0.15).toString(),
    },
    mockPage: {
      flex: 1,
      borderRadius: TILE_RADIUS - RING,
      overflow: 'hidden',
      padding: moderateScale(7),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Color(theme.colors.text).alpha(0.12).toString(),
    },
    mockCard: {
      flex: 1,
      borderRadius: moderateScale(9),
      padding: moderateScale(7),
      gap: moderateScale(4),
      overflow: 'hidden',
    },
    mockCardSystem: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Color(lightColors.text).alpha(0.1).toString(),
    },
    lineLong: {
      width: '62%',
      height: moderateScale(4),
      borderRadius: moderateScale(2),
    },
    lineShort: {
      width: '42%',
      height: moderateScale(4),
      borderRadius: moderateScale(2),
    },
    dot: {
      position: 'absolute',
      end: moderateScale(7),
      bottom: moderateScale(7),
      width: moderateScale(11),
      height: moderateScale(11),
      borderRadius: moderateScale(6),
    },
    label: {
      fontFamily: 'Manrope-Medium',
      fontSize: moderateScale(14),
      color: Color(theme.colors.text).alpha(0.55).toString(),
    },
    labelSelected: {
      color: theme.colors.text,
      fontFamily: 'Manrope-SemiBold',
    },
  });
}
