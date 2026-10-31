// @ai-generated
import React, {useCallback, useMemo} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  type DimensionValue,
} from 'react-native';
import Animated, {useAnimatedStyle} from 'react-native-reanimated';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {NativeMenu} from '@/components/native/NativeMenu';
import {nativeMenusAvailable} from '@/components/native/nativeMenus';
import type {NativeMenuItem} from '@/components/native/menuTypes';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import type {ReadingTheme} from '@/constants/readingThemes';
import {moderateScale} from '@/utils/scale';
import type {Theme, ThemeMode} from '@/utils/themeUtils';
import {PictureTile} from './PictureTile';
import {TileArt} from './TileArt';
import {
  LIST_LAYOUTS,
  MUSHAF_LAYOUTS,
  effectiveModeOf,
  layoutSettingsFor,
  nextThemeMode,
  pairedThemeId,
  readingLayoutOf,
  readingThemesFor,
  type ReadingLayout,
} from './readingLayout';
import {FadeInView, useSelectionPop} from './motion';
import {PAGE_INSET, textAlpha, useOptionStyles} from './optionStyles';

/** View: the printed page or one verse at a time. */
export function ViewSection(): React.JSX.Element {
  const styles = useOptionStyles();
  const {t} = useTranslation('sheets');
  const viewMode = useMushafSettingsStore(s => s.viewMode);
  const setViewMode = useMushafSettingsStore(s => s.setViewMode);
  return (
    <View style={styles.section}>
      <Text style={styles.header} accessibilityRole="header">
        {t('mushafOptions.view.header')}
      </Text>
      <View
        style={local.tiles}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('mushafOptions.view.header')}>
        <PictureTile
          label={t('mushafOptions.view.mushaf')}
          selected={viewMode === 'mushaf'}
          onPress={() => setViewMode('mushaf')}
          testID="mushaf-options-view-mushaf">
          <TileArt kind="mushaf" selected={viewMode === 'mushaf'} />
        </PictureTile>
        <PictureTile
          label={t('mushafOptions.view.list')}
          selected={viewMode === 'list'}
          onPress={() => setViewMode('list')}
          testID="mushaf-options-view-list">
          <TileArt kind="list" selected={viewMode === 'list'} />
        </PictureTile>
      </View>
      <Text style={styles.helper}>
        {viewMode === 'mushaf'
          ? t('mushafOptions.view.mushafHelp')
          : t('mushafOptions.view.listHelp')}
      </Text>
    </View>
  );
}

/** Layout: the current view's ways of moving through the pages. */
export function LayoutSection(): React.JSX.Element {
  const styles = useOptionStyles();
  const {t} = useTranslation('sheets');
  const viewMode = useMushafSettingsStore(s => s.viewMode);
  const scrollDirection = useMushafSettingsStore(s => s.scrollDirection);
  const pageLayout = useMushafSettingsStore(s => s.pageLayout);
  const setScrollDirection = useMushafSettingsStore(s => s.setScrollDirection);
  const setPageLayout = useMushafSettingsStore(s => s.setPageLayout);
  const current = readingLayoutOf(viewMode, scrollDirection, pageLayout);
  const layouts = viewMode === 'mushaf' ? MUSHAF_LAYOUTS : LIST_LAYOUTS;

  const choose = useCallback(
    (layout: ReadingLayout) => {
      const next = layoutSettingsFor(layout);
      if (next.pageLayout) setPageLayout(next.pageLayout);
      setScrollDirection(next.scrollDirection);
    },
    [setPageLayout, setScrollDirection],
  );

  return (
    <View style={styles.section}>
      <Text style={styles.header} accessibilityRole="header">
        {t('mushafOptions.layout.header')}
      </Text>
      {/* The other view's tiles fade in when the view changes. */}
      <FadeInView key={viewMode}>
        <View
          style={local.tiles}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('mushafOptions.layout.header')}>
          {layouts.map(layout => (
            <PictureTile
              key={layout}
              label={t(`mushafOptions.layout.${layout}`)}
              selected={current === layout}
              onPress={() => choose(layout)}
              testID={`mushaf-options-layout-${layout}`}>
              <TileArt kind={layout} selected={current === layout} />
            </PictureTile>
          ))}
        </View>
        <Text style={styles.helper}>
          {t(`mushafOptions.layout.help.${current}`)}
        </Text>
      </FadeInView>
    </View>
  );
}

/**
 * Theme: the current mode's reading themes as little pages in a row, and
 * a chip that cycles Light, Dark and Auto for the whole app.
 */
export function ThemeSection(): React.JSX.Element {
  const styles = useOptionStyles();
  const {theme, themeMode, setThemeMode} = useTheme();
  const themeStyles = useMemo(() => createThemeStyles(theme), [theme]);
  const {t} = useTranslation('sheets');
  const systemScheme = useColorScheme();
  const lightThemeId = useMushafSettingsStore(s => s.lightThemeId);
  const darkThemeId = useMushafSettingsStore(s => s.darkThemeId);
  const setReadingTheme = useMushafSettingsStore(s => s.setReadingTheme);
  const mode = effectiveModeOf(themeMode, systemScheme);
  const themes = readingThemesFor(mode);
  const selectedId = mode === 'dark' ? darkThemeId : lightThemeId;
  const modeName = t(`mushafOptions.theme.modes.${themeMode}`);

  // Switching light and dark picks the theme at the same position in the
  // other mode's list, as the reading-theme screen does.
  const chooseMode = useCallback(
    (next: ThemeMode) => {
      const paired = pairedThemeId(
        mode,
        effectiveModeOf(next, systemScheme),
        lightThemeId,
        darkThemeId,
      );
      if (paired) setReadingTheme(paired);
      setThemeMode(next);
    },
    [
      mode,
      systemScheme,
      lightThemeId,
      darkThemeId,
      setReadingTheme,
      setThemeMode,
    ],
  );
  const modeEntries: NativeMenuItem[] = THEME_MODES.map(option => ({
    id: option,
    title: t(`mushafOptions.theme.modes.${option}`),
    checked: option === themeMode,
  }));
  const modeLabel = t('mushafOptions.theme.modeLabel', {mode: modeName});
  const chip = (
    <View style={themeStyles.modeChip}>
      <Text style={themeStyles.modeText}>{modeName}</Text>
      <Feather
        name="chevron-down"
        size={moderateScale(12)}
        color={theme.colors.text}
      />
    </View>
  );

  return (
    <View style={styles.section}>
      <View style={themeStyles.headerRow}>
        <Text
          style={[styles.header, themeStyles.headerText]}
          accessibilityRole="header">
          {t('mushafOptions.theme.header')}
        </Text>
        {nativeMenusAvailable ? (
          // The chip lays itself out and the menu covers it, as on the
          // ••• buttons. Sized by its trigger instead, the menu's host
          // could settle at zero width in the native sheet and hide the
          // chip. The menu owns the touch and the VoiceOver element.
          <View>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants">
              {chip}
            </View>
            <NativeMenu
              title={t('mushafOptions.theme.modeMenuTitle')}
              entries={modeEntries}
              onSelect={id => {
                const next = THEME_MODES.find(option => option === id);
                if (next) chooseMode(next);
              }}
              layout="overlay"
              accessibilityLabel={modeLabel}
              testID="mushaf-options-theme-mode">
              <View />
            </NativeMenu>
          </View>
        ) : (
          // No native menus (web): the chip steps through the modes.
          <Pressable
            onPress={() => chooseMode(nextThemeMode(themeMode))}
            style={({pressed}) => [
              themeStyles.modeChipPress,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={modeLabel}
            hitSlop={8}
            testID="mushaf-options-theme-mode">
            {chip}
          </Pressable>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={themeStyles.strip}
        contentContainerStyle={themeStyles.stripContent}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('mushafOptions.theme.header')}>
        {themes.map(option => (
          <ThemeTile
            key={option.id}
            option={option}
            selected={option.id === selectedId}
            onPress={() => setReadingTheme(option.id)}
          />
        ))}
      </ScrollView>
      <Text style={styles.helper}>{t('mushafOptions.theme.help')}</Text>
    </View>
  );
}

function ThemeTile({
  option,
  selected,
  onPress,
}: {
  option: ReadingTheme;
  selected: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const {theme} = useTheme();
  const styles = useMemo(() => createThemeStyles(theme), [theme]);
  const pop = useSelectionPop(selected);
  const ring = useAnimatedStyle(() => ({transform: [{scale: pop.value}]}));
  const line = Color(option.colors.text).alpha(0.45).toString();
  return (
    <Pressable
      onPress={onPress}
      style={styles.themeTile}
      accessibilityRole="radio"
      accessibilityLabel={option.name}
      accessibilityState={{checked: selected}}
      testID={`mushaf-options-theme-${option.id}`}>
      {({pressed}) => (
        <>
          <Animated.View
            style={[
              styles.themeRing,
              selected && styles.themeRingSelected,
              ring,
            ]}>
            <View
              style={[
                styles.themePage,
                {backgroundColor: option.colors.background},
              ]}>
              {THEME_LINE_WIDTHS.map((width, index) => (
                <View
                  key={index}
                  style={[styles.themeLine, {backgroundColor: line, width}]}
                />
              ))}
              {pressed ? <View style={styles.themePagePressed} /> : null}
            </View>
          </Animated.View>
          <Text
            style={[styles.themeLabel, selected && styles.themeLabelSelected]}
            numberOfLines={1}>
            {option.name}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** Light, Dark, Auto: the appearance menu's order. */
const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system'];

const THEME_LINE_WIDTHS: readonly DimensionValue[] = ['100%', '100%', '60%'];

const local = StyleSheet.create({
  tiles: {
    flexDirection: 'row',
    gap: moderateScale(10),
  },
});

function createThemeStyles(theme: Theme) {
  return StyleSheet.create({
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: moderateScale(8),
    },
    headerText: {
      marginBottom: 0,
    },
    modeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(4),
      paddingHorizontal: moderateScale(10),
      paddingVertical: moderateScale(5),
      borderRadius: moderateScale(14),
      backgroundColor: textAlpha(theme, 0.07),
    },
    modeChipPress: {
      borderRadius: moderateScale(14),
    },
    modeText: {
      fontSize: theme.typography.smallSize,
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    // The row runs to the sheet's edges and scrolls under them.
    strip: {
      marginHorizontal: -PAGE_INSET,
    },
    stripContent: {
      paddingHorizontal: PAGE_INSET,
      gap: moderateScale(4),
    },
    themeTile: {
      width: moderateScale(66),
      alignItems: 'center',
      gap: moderateScale(6),
    },
    themeRing: {
      width: moderateScale(66),
      height: moderateScale(54),
      borderRadius: moderateScale(16),
      padding: 2,
      borderWidth: 2.5,
      borderColor: 'transparent',
    },
    themeRingSelected: {
      borderColor: theme.colors.text,
    },
    themePage: {
      flex: 1,
      borderRadius: moderateScale(11),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Color('#000000').alpha(0.1).toString(),
      paddingVertical: moderateScale(9),
      paddingHorizontal: moderateScale(8),
      gap: moderateScale(5),
      alignItems: 'flex-end',
      overflow: 'hidden',
    },
    themePagePressed: {
      ...StyleSheet.absoluteFill,
      backgroundColor: textAlpha(theme, 0.06),
    },
    themeLine: {
      height: 3,
      borderRadius: 2,
    },
    themeLabel: {
      maxWidth: '100%',
      fontSize: theme.typography.captionSize,
      fontFamily: 'Manrope-Medium',
      color: textAlpha(theme, 0.55),
    },
    themeLabelSelected: {
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
  });
}
