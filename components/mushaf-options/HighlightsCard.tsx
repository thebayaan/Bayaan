// @ai-generated
import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import branding from '@/config/branding';
import {useTheme} from '@/hooks/useTheme';
import {useRewayahWords} from '@/hooks/useRewayahWords';
import {
  getDkFontFamily,
  useMushafSettingsStore,
  type MushafAllahNameHighlightColor,
} from '@/store/mushafSettingsStore';
import {useTajweedStore} from '@/store/tajweedStore';
import {tajweedColors} from '@/constants/tajweedColors';
import {
  ALLAH_NAME_HIGHLIGHT_OPTIONS,
  getAllahNameHighlightColorHex,
} from '@/constants/mushafAllahHighlight';
import {getRewayahShortLabel} from '@/utils/rewayahLabels';
import {moderateScale} from '@/utils/scale';
import type {Theme} from '@/utils/themeUtils';
import {Chevron, FoldHeader, Separator, SwitchRow} from './OptionRows';
import {Collapsible, FADE_MS, useSelectionPop} from './motion';
import {QuranText} from './QuranText';
import {TAJWEED_LEGEND} from './readingLayout';
import {ROW_INSET, textAlpha, useOptionStyles} from './optionStyles';

const LEGEND_ROW_HEIGHT = 36;
/** Brings the legend row's 36pt to a 44pt tap target. */
const LEGEND_ROW_SLOP = {top: 4, bottom: 4};

/** The preview verse (2:7), cut to the words that show every highlight. */
const PREVIEW_VERSE = '2:7';
const PREVIEW_WORDS = 9;

/**
 * Whether the reader's highlights apply now. Tajweed colors are Hafs rules
 * and never drawn on another rewayah's text.
 */
export function useHighlightState(): {
  hafs: boolean;
  tajweedShown: boolean;
} {
  const rewayah = useMushafSettingsStore(s => s.rewayah);
  const showTajweed = useMushafSettingsStore(s => s.showTajweed);
  const hafs = rewayah === 'hafs';
  return {hafs, tajweedShown: hafs && showTajweed};
}

/** Whether this app version has community reflections under each verse. */
export function hasCommunityReflections(): boolean {
  return (
    branding.communityReflectionsProvider != null &&
    branding.ayahCommunityReflectionsComponent != null
  );
}

export function useHighlightsSummary(): string {
  const {t} = useTranslation('sheets');
  const {tajweedShown} = useHighlightState();
  const showAllah = useMushafSettingsStore(s => s.showAllahNameHighlight);
  const showThemes = useMushafSettingsStore(s => s.showThemes);
  const parts = [
    tajweedShown && t('mushafOptions.highlights.summaryTajweed'),
    showAllah && t('mushafOptions.highlights.summaryAllah'),
    showThemes && t('mushafOptions.highlights.summaryThemes'),
  ].filter((part): part is string => typeof part === 'string');
  return parts.length > 0
    ? parts.join(t('mushafOptions.listSeparator'))
    : t('mushafOptions.highlights.off');
}

export function HighlightsCard({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  const styles = useOptionStyles();
  const {t} = useTranslation('sheets');
  const summary = useHighlightsSummary();
  return (
    <View style={[styles.card, styles.section]}>
      <FoldHeader
        title={t('mushafOptions.highlights.title')}
        summary={summary}
        open={open}
        onPress={onToggle}
        testID="mushaf-options-card-highlights"
      />
      <Collapsible open={open}>
        <HighlightOptions />
      </Collapsible>
    </View>
  );
}

function HighlightOptions(): React.JSX.Element {
  const styles = useOptionStyles();
  const {theme} = useTheme();
  const local = useMemo(() => createStyles(theme), [theme]);
  const {t} = useTranslation(['sheets', 'settings']);
  const store = useMushafSettingsStore();
  const {hafs, tajweedShown} = useHighlightState();
  const [legendOpen, setLegendOpen] = useState(false);
  const isQcf = store.mushafRenderer === 'qcf_v2';
  const rewayahName = getRewayahShortLabel(store.rewayah);
  const tajweedSubtitle = !hafs
    ? t('settings:mushafSettings.hafsOnlyTajweed', {rewayah: rewayahName})
    : isQcf
      ? t('sheets:mushafOptions.highlights.tajweedPreview')
      : t('sheets:mushafOptions.highlights.tajweedHelp');

  return (
    <View style={local.body}>
      <HighlightPreview />
      <SwitchRow
        title={t('sheets:mushafOptions.highlights.tajweed')}
        subtitle={tajweedSubtitle}
        value={tajweedShown}
        onValueChange={store.toggleTajweed}
        disabled={!hafs}
        testID="mushaf-options-tajweed"
      />
      <Pressable
        onPress={() => setLegendOpen(value => !value)}
        style={({pressed}) => [local.legendRow, pressed && styles.pressed]}
        hitSlop={LEGEND_ROW_SLOP}
        accessibilityRole="button"
        accessibilityState={{expanded: legendOpen}}
        testID="mushaf-options-tajweed-legend">
        <View style={local.legendDots}>
          {['ghunnah', 'tafkhim', 'madda_necessary', 'madda_normal'].map(
            rule => (
              <View
                key={rule}
                style={[
                  local.dot,
                  {backgroundColor: themedTajweedColor(rule, theme)},
                ]}
              />
            ),
          )}
        </View>
        <Text style={local.legendTitle}>
          {t('sheets:mushafOptions.highlights.legend')}
        </Text>
        <Chevron open={legendOpen} size={moderateScale(12)} />
      </Pressable>
      <Collapsible open={legendOpen}>
        <View style={local.legend}>
          {TAJWEED_LEGEND.map(entry => (
            <View key={entry.key} style={local.legendEntry}>
              <View
                style={[
                  local.legendDot,
                  {backgroundColor: themedTajweedColor(entry.rule, theme)},
                ]}
              />
              <Text style={local.legendLabel}>
                {t(`sheets:mushafOptions.legend.${entry.key}.label`)}
              </Text>
              <Text style={local.legendDetail}>
                {t(`sheets:mushafOptions.legend.${entry.key}.detail`)}
              </Text>
            </View>
          ))}
        </View>
      </Collapsible>
      <Separator />
      <SwitchRow
        title={t('sheets:mushafOptions.highlights.allah')}
        subtitle={t('sheets:mushafOptions.highlights.allahHelp')}
        value={store.showAllahNameHighlight}
        onValueChange={store.toggleAllahNameHighlight}
        testID="mushaf-options-allah"
      />
      <Collapsible open={store.showAllahNameHighlight}>
        <View
          style={local.swatches}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('sheets:mushafOptions.highlights.colorLabel')}>
          {ALLAH_NAME_HIGHLIGHT_OPTIONS.map(option => (
            <Swatch
              key={option.id}
              id={option.id}
              label={option.label}
              color={theme.isDarkMode ? option.dark : option.light}
              selected={store.allahNameHighlightColor === option.id}
              onPress={store.setAllahNameHighlightColor}
            />
          ))}
        </View>
      </Collapsible>
      <Separator />
      <SwitchRow
        title={t('sheets:mushafOptions.highlights.themes')}
        subtitle={t('sheets:mushafOptions.highlights.themesHelp')}
        value={store.showThemes}
        onValueChange={store.toggleThemes}
        testID="mushaf-options-themes"
      />
      {hasCommunityReflections() ? (
        <>
          <Separator />
          <SwitchRow
            title={t('sheets:mushafOptions.highlights.reflections')}
            subtitle={t('sheets:mushafOptions.highlights.reflectionsHelp')}
            value={store.showCommunityReflections}
            onValueChange={store.toggleCommunityReflections}
            testID="mushaf-options-reflections"
          />
        </>
      ) : null}
    </View>
  );
}

/** Tajweed colors, lightened on a dark sheet as the settings preview does. */
function themedTajweedColor(rule: string, theme: Theme): string {
  const hex = tajweedColors[rule] ?? theme.colors.text;
  return theme.isDarkMode
    ? Color(hex).lighten(0.3).saturate(0.1).toString()
    : hex;
}

/**
 * One line of 2:7 drawn with the reader's highlights, which recolors as the
 * switches change. Thematic passages tint the line behind the text.
 */
function HighlightPreview(): React.JSX.Element {
  const styles = useOptionStyles();
  const {theme} = useTheme();
  const local = useMemo(() => createStyles(theme), [theme]);
  const {t} = useTranslation('sheets');
  const reduceMotion = useReducedMotion();
  const renderer = useMushafSettingsStore(s => s.mushafRenderer);
  const rewayah = useMushafSettingsStore(s => s.rewayah);
  const weight = useMushafSettingsStore(s => s.arabicTextWeight);
  const showAllah = useMushafSettingsStore(s => s.showAllahNameHighlight);
  const allahColor = useMushafSettingsStore(s => s.allahNameHighlightColor);
  const showThemes = useMushafSettingsStore(s => s.showThemes);
  const {tajweedShown} = useHighlightState();
  const indexedTajweedData = useTajweedStore(s => s.indexedTajweedData);
  const {words} = useRewayahWords(PREVIEW_VERSE, rewayah);
  const previewWords = useMemo(() => words.slice(0, PREVIEW_WORDS), [words]);

  const tint = useSharedValue(showThemes ? 1 : 0);
  useEffect(() => {
    tint.value = withTiming(showThemes ? 1 : 0, {
      duration: reduceMotion ? FADE_MS : 350,
    });
  }, [showThemes, reduceMotion, tint]);
  const tintStyle = useAnimatedStyle(() => ({opacity: tint.value}));

  return (
    <View
      style={styles.preview}
      accessible
      accessibilityLabel={t('mushafOptions.highlights.previewLabel')}>
      <Animated.View
        style={[local.themeTint, tintStyle]}
        pointerEvents="none"
      />
      <QuranText
        verseKey={PREVIEW_VERSE}
        words={previewWords}
        fontFamily={getDkFontFamily(renderer, rewayah)}
        fontSize={moderateScale(20)}
        color={theme.colors.text}
        weight={weight}
        showTajweed={tajweedShown}
        indexedTajweedData={indexedTajweedData}
        allahHighlightColor={
          showAllah
            ? getAllahNameHighlightColorHex(allahColor, theme.isDarkMode)
            : undefined
        }
      />
    </View>
  );
}

function Swatch({
  id,
  label,
  color,
  selected,
  onPress,
}: {
  id: MushafAllahNameHighlightColor;
  label: string;
  color: string;
  selected: boolean;
  onPress: (id: MushafAllahNameHighlightColor) => void;
}): React.JSX.Element {
  const {theme} = useTheme();
  const local = useMemo(() => createStyles(theme), [theme]);
  const pop = useSelectionPop(selected);
  const scaled = useAnimatedStyle(() => ({transform: [{scale: pop.value}]}));
  return (
    <Pressable
      onPress={() => onPress(id)}
      hitSlop={6}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{checked: selected}}
      testID={`mushaf-options-allah-${id}`}>
      {({pressed}) => (
        <Animated.View
          style={[
            local.swatch,
            selected && local.swatchSelected,
            {backgroundColor: color},
            pressed && local.swatchPressed,
            scaled,
          ]}
        />
      )}
    </Pressable>
  );
}

function createStyles(theme: Theme) {
  const small = theme.typography.smallSize;
  return StyleSheet.create({
    body: {
      paddingBottom: moderateScale(4),
    },
    themeTint: {
      ...StyleSheet.absoluteFill,
      backgroundColor: textAlpha(theme, 0.12),
    },
    // A secondary row under the tajweed switch: drawn 36pt tall, with
    // hit slop making the tap area 44pt.
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(8),
      minHeight: LEGEND_ROW_HEIGHT,
      paddingHorizontal: ROW_INSET,
    },
    legendDots: {
      flexDirection: 'row',
      gap: 3,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
    },
    // Smaller than the option rows' titles (mediumSize): a link, not a row.
    legendTitle: {
      flex: 1,
      textAlign: 'left',
      fontSize: small,
      fontFamily: 'Manrope-SemiBold',
      color: textAlpha(theme, 0.8),
    },
    legend: {
      paddingBottom: moderateScale(8),
    },
    legendEntry: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(10),
      paddingHorizontal: ROW_INSET,
      paddingVertical: moderateScale(5),
    },
    legendDot: {
      width: 11,
      height: 11,
      borderRadius: 6,
    },
    legendLabel: {
      flex: 1,
      textAlign: 'left',
      fontSize: small,
      fontFamily: 'Manrope-Medium',
      color: theme.colors.text,
    },
    legendDetail: {
      fontSize: small,
      fontFamily: 'Manrope-Regular',
      color: textAlpha(theme, 0.55),
    },
    swatches: {
      flexDirection: 'row',
      gap: moderateScale(12),
      paddingHorizontal: ROW_INSET,
      paddingTop: moderateScale(2),
      paddingBottom: moderateScale(14),
    },
    swatch: {
      width: moderateScale(30),
      height: moderateScale(30),
      borderRadius: moderateScale(15),
      borderWidth: 2,
      borderColor: 'transparent',
    },
    swatchSelected: {
      borderColor: theme.colors.text,
    },
    swatchPressed: {
      opacity: 0.8,
    },
  });
}
