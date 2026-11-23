// @ai-generated
import React, {useMemo, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {NativeSegmentedControl} from '@/components/native/NativeSegmentedControl';
import {NativeSlider} from '@/components/native/NativeSlider';
import FormattedTextRenderer from '@/components/utils/FormattedText';
import {
  DISPLAY_MAX,
  DISPLAY_MIN,
  getActualFontSize,
  getDisplayValue,
  getDkFontFamily,
  useMushafSettingsStore,
  type MushafArabicTextWeight,
} from '@/store/mushafSettingsStore';
import {useTajweedStore} from '@/store/tajweedStore';
import {getAllahNameHighlightColorHex} from '@/constants/mushafAllahHighlight';
import {adjustableStep} from '@/utils/adjustableStep';
import {localizeDigits} from '@/i18n/format';
import {forceLTR} from '@/utils/rtl';
import {moderateScale} from '@/utils/scale';
import type {Theme} from '@/utils/themeUtils';
import {Collapsible} from './motion';
import {FoldHeader} from './OptionRows';
import {PictureTile} from './PictureTile';
import {QuranText} from './QuranText';
import {ROW_INSET, textAlpha, useOptionStyles} from './optionStyles';

const WEIGHTS: readonly MushafArabicTextWeight[] = ['normal', 'medium', 'bold'];
type SizeTarget = 'arabic' | 'translation' | 'transliteration';
const SIZE_TARGETS: readonly SizeTarget[] = [
  'arabic',
  'translation',
  'transliteration',
];
/** The word the weight tiles draw. */
const ALLAH_WORD = 'ٱللَّه';
const SAMPLE_VERSE = '1:1';

/** The size and weight of the text, as one folded card. */
export function TextCard({
  open,
  onToggle,
  listLike,
}: {
  open: boolean;
  onToggle: () => void;
  /** List view or the player: the text can be resized. */
  listLike: boolean;
}): React.JSX.Element {
  const styles = useOptionStyles();
  const {t} = useTranslation(['sheets', 'settings']);
  const weight = useMushafSettingsStore(s => s.arabicTextWeight);
  const arabicFontSize = useMushafSettingsStore(s => s.arabicFontSize);
  const weightName = t(`settings:mushafSettings.weights.${weight}.label`);
  const summary = listLike
    ? t('sheets:mushafOptions.text.summaryList', {
        size: localizeDigits(getDisplayValue(arabicFontSize)),
        weight: weightName,
      })
    : t('sheets:mushafOptions.text.summaryMushaf', {weight: weightName});

  return (
    <View style={[styles.card, styles.section]}>
      <FoldHeader
        title={t('sheets:mushafOptions.text.title')}
        summary={summary}
        open={open}
        onPress={onToggle}
        testID="mushaf-options-card-text"
      />
      <Collapsible open={open}>
        <TextOptions listLike={listLike} />
      </Collapsible>
    </View>
  );
}

function TextOptions({listLike}: {listLike: boolean}): React.JSX.Element {
  const styles = useOptionStyles();
  const {theme} = useTheme();
  const local = useMemo(() => createStyles(theme), [theme]);
  const {t} = useTranslation(['sheets', 'settings']);
  const weight = useMushafSettingsStore(s => s.arabicTextWeight);
  const setWeight = useMushafSettingsStore(s => s.setArabicTextWeight);
  const renderer = useMushafSettingsStore(s => s.mushafRenderer);
  const rewayah = useMushafSettingsStore(s => s.rewayah);
  const fontFamily = getDkFontFamily(renderer, rewayah);

  return (
    <View style={local.body}>
      {listLike ? <SizeControl /> : null}
      <Text style={[styles.header, local.weightHeader]}>
        {t('sheets:mushafOptions.text.weightHeader')}
      </Text>
      <View style={local.tiles} accessibilityRole="radiogroup">
        {WEIGHTS.map(option => (
          <PictureTile
            key={option}
            label={t(`settings:mushafSettings.weights.${option}.label`)}
            selected={weight === option}
            onPress={() => setWeight(option)}
            testID={`mushaf-options-weight-${option}`}>
            <QuranText
              text={ALLAH_WORD}
              fontFamily={fontFamily}
              fontSize={moderateScale(24)}
              color={theme.colors.text}
              weight={option}
            />
          </PictureTile>
        ))}
      </View>
      <Text style={[styles.helper, local.helper]}>
        {listLike
          ? t('sheets:mushafOptions.text.listHelp')
          : t('sheets:mushafOptions.text.mushafHelp')}
      </Text>
    </View>
  );
}

/**
 * Which text to resize, a preview of it at its size, and one slider for
 * it. Each text keeps its own size in the store.
 */
function SizeControl(): React.JSX.Element {
  const {theme} = useTheme();
  const styles = useOptionStyles();
  const local = useMemo(() => createStyles(theme), [theme]);
  const {t} = useTranslation('sheets');
  const [target, setTarget] = useState<SizeTarget>('arabic');
  const store = useMushafSettingsStore();
  const sizes: Record<SizeTarget, number> = {
    arabic: store.arabicFontSize,
    translation: store.translationFontSize,
    transliteration: store.transliterationFontSize,
  };
  const setters: Record<SizeTarget, (size: number) => void> = {
    arabic: store.setArabicFontSize,
    translation: store.setTranslationFontSize,
    transliteration: store.setTransliterationFontSize,
  };
  const value = getDisplayValue(sizes[target]);
  const setValue = (next: number): void => {
    const clamped = Math.min(DISPLAY_MAX, Math.max(DISPLAY_MIN, next));
    if (clamped !== value) setters[target](getActualFontSize(clamped));
  };
  const targetName = t(`mushafOptions.text.targetNames.${target}`);

  return (
    <View>
      <View style={styles.preview}>
        <SizePreview target={target} size={sizes[target]} />
      </View>
      <NativeSegmentedControl
        values={SIZE_TARGETS.map(item =>
          t(`mushafOptions.text.targets.${item}`),
        )}
        selectedIndex={SIZE_TARGETS.indexOf(target)}
        onChange={index => setTarget(SIZE_TARGETS[index] ?? 'arabic')}
        accessibilityLabel={t('mushafOptions.text.targetsLabel')}
        style={local.segments}
        testID="mushaf-options-size-target"
      />
      {/* One adjustable control for VoiceOver and TalkBack: swipe up or
          down to change the size. */}
      <View
        style={local.sizeRow}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('mushafOptions.text.sizeLabel', {
          target: targetName,
        })}
        accessibilityValue={{
          min: DISPLAY_MIN,
          max: DISPLAY_MAX,
          now: value,
          text: localizeDigits(value),
        }}
        accessibilityActions={[{name: 'increment'}, {name: 'decrement'}]}
        onAccessibilityAction={event => {
          const next = adjustableStep(
            event.nativeEvent.actionName,
            value,
            DISPLAY_MIN,
            DISPLAY_MAX,
          );
          if (next !== null) setValue(next);
        }}
        testID="mushaf-options-size">
        <Text style={local.smallA}>A</Text>
        <NativeSlider
          value={value}
          minimumValue={DISPLAY_MIN}
          maximumValue={DISPLAY_MAX}
          step={1}
          onValueChange={next => setValue(Math.round(next))}
          style={local.slider}
        />
        <Text style={local.bigA}>A</Text>
      </View>
    </View>
  );
}

function SizePreview({
  target,
  size,
}: {
  target: SizeTarget;
  size: number;
}): React.JSX.Element {
  const {theme} = useTheme();
  const {t} = useTranslation('settings');
  const renderer = useMushafSettingsStore(s => s.mushafRenderer);
  const rewayah = useMushafSettingsStore(s => s.rewayah);
  const weight = useMushafSettingsStore(s => s.arabicTextWeight);
  const showTajweed = useMushafSettingsStore(s => s.showTajweed);
  const showAllah = useMushafSettingsStore(s => s.showAllahNameHighlight);
  const allahColor = useMushafSettingsStore(s => s.allahNameHighlightColor);
  const indexedTajweedData = useTajweedStore(s => s.indexedTajweedData);

  if (target === 'arabic') {
    return (
      <QuranText
        verseKey={SAMPLE_VERSE}
        fontFamily={getDkFontFamily(renderer, rewayah)}
        fontSize={moderateScale(size)}
        color={theme.colors.text}
        weight={weight}
        showTajweed={showTajweed}
        indexedTajweedData={indexedTajweedData}
        allahHighlightColor={
          showAllah
            ? getAllahNameHighlightColorHex(allahColor, theme.isDarkMode)
            : undefined
        }
      />
    );
  }
  const baseStyle = {
    fontSize: moderateScale(size),
    color: theme.colors.text,
    fontFamily: 'Manrope-Regular',
  };
  // English sample text, set left to right in any app language.
  return (
    <View style={forceLTR}>
      {target === 'translation' ? (
        <FormattedTextRenderer
          text={sampleTranslation() ?? t('mushafSettings.translationError')}
          baseStyle={baseStyle}
        />
      ) : (
        <Text style={baseStyle}>
          {sampleTransliteration() ?? t('mushafSettings.transliterationError')}
        </Text>
      )}
    </View>
  );
}

interface VerseTextData {
  [verseKey: string]: {t: string} | undefined;
}

function isVerseTextData(value: unknown): value is VerseTextData {
  return typeof value === 'object' && value !== null;
}

/** Saheeh International for the sample verse (bundled with the app). */
function sampleTranslation(): string | null {
  const data: unknown = require('@/data/SaheehInternational.translation-with-footnote-tags.json');
  return isVerseTextData(data) ? (data[SAMPLE_VERSE]?.t ?? null) : null;
}

function sampleTransliteration(): string | null {
  const data: unknown = require('@/data/transliteration.json');
  return isVerseTextData(data) ? (data[SAMPLE_VERSE]?.t ?? null) : null;
}

function createStyles(theme: Theme) {
  const muted = textAlpha(theme, 0.55);
  return StyleSheet.create({
    body: {
      paddingBottom: moderateScale(14),
    },
    weightHeader: {
      marginTop: moderateScale(12),
    },
    tiles: {
      flexDirection: 'row',
      gap: moderateScale(10),
      paddingHorizontal: moderateScale(12),
    },
    helper: {
      marginTop: moderateScale(10),
    },
    segments: {
      marginHorizontal: ROW_INSET,
      marginTop: moderateScale(10),
      height: moderateScale(32),
    },
    sizeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(14),
      minHeight: moderateScale(50),
      paddingHorizontal: ROW_INSET,
    },
    slider: {
      flex: 1,
      height: moderateScale(40),
    },
    smallA: {
      fontSize: theme.typography.smallSize,
      fontFamily: 'Manrope-SemiBold',
      color: muted,
    },
    bigA: {
      fontSize: theme.typography.subheadingSize,
      fontFamily: 'Manrope-SemiBold',
      color: muted,
    },
  });
}
