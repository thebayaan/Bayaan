// @ai-generated
import React, {useCallback, useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
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
    // Only the light page needs an outline, to stand off a white card; on
    // the dark page the outline read as a light line around the tile.
    outline: Color(lightColors.text).alpha(0.12).toString(),
    page: lightColors.background,
    card: '#ffffff',
    line: Color(lightColors.text).alpha(0.28).toString(),
    dot: lightColors.text,
  },
  dark: {
    outline: 'transparent',
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
      <View
        style={[
          styles.mockPage,
          {backgroundColor: c.page, borderColor: c.outline},
        ]}>
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
    <View
      style={[
        styles.mockPage,
        {backgroundColor: MOCK.light.page, borderColor: MOCK.light.outline},
      ]}>
      {/* @ai: the halves cover the hairline outline too; drawn only inside
          it, the light page showed through at the dark half's edge. */}
      <Svg
        style={styles.mockFill}
        viewBox="0 0 100 100"
        preserveAspectRatio="none">
        <Polygon points="100,0 100,100 0,100" fill={MOCK.dark.page} />
      </Svg>
      <View style={[styles.mockCard, styles.mockCardSystem]}>
        <Svg
          style={styles.mockCardFill} // @ai
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
      // @ai: the store pins or unpins the native look itself; pinning here
      // pinned System to light, so it never followed a dark device.
      setThemeMode(mode);
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
// @ai: the tile's outer ring (11 + 3 = 14) is the card's 24 less its 10pt padding
const TILE_RADIUS = moderateScale(11);
const MOCK_PADDING = moderateScale(5);

function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: moderateScale(12),
      padding: moderateScale(10), // @ai: concentric with the card
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
      padding: MOCK_PADDING, // @ai
      borderWidth: StyleSheet.hairlineWidth,
    },
    mockCard: {
      flex: 1,
      // @ai: concentric with the mock page: its radius less its padding
      borderRadius: TILE_RADIUS - RING - MOCK_PADDING,
      padding: moderateScale(7),
      gap: moderateScale(4),
      overflow: 'hidden',
    },
    // @ai: fills the border box, outline included
    mockFill: {
      position: 'absolute',
      top: -StyleSheet.hairlineWidth,
      bottom: -StyleSheet.hairlineWidth,
      start: -StyleSheet.hairlineWidth,
      end: -StyleSheet.hairlineWidth,
    },
    // @ai: the card's halves are drawn over the whole page's box (the card
    // clips them), so its diagonal is the page's diagonal, not its own.
    mockCardFill: {
      position: 'absolute',
      top: -(MOCK_PADDING + 2 * StyleSheet.hairlineWidth),
      bottom: -(MOCK_PADDING + 2 * StyleSheet.hairlineWidth),
      start: -(MOCK_PADDING + 2 * StyleSheet.hairlineWidth),
      end: -(MOCK_PADDING + 2 * StyleSheet.hairlineWidth),
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
