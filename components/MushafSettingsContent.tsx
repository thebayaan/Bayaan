import React, {useMemo, useCallback, useState} from 'react';
import {View, Text, StyleSheet, Switch, Pressable} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {Feather} from '@expo/vector-icons';
import {
  MushafPagePillIcon,
  ListViewPillIcon,
  HorizontalScrollPillIcon,
  VerticalScrollPillIcon,
  BookLayoutPillIcon,
  FullscreenPillIcon,
} from '@/components/Icons';
import {useTajweedStore} from '@/store/tajweedStore';
import {
  tajweedColors,
  REWAYAH_DIFF_BACKGROUND,
} from '@/constants/tajweedColors';
import FormattedTextRenderer from '@/components/utils/FormattedText';
import {LinearGradient} from 'expo-linear-gradient';
import SkiaVerseText from '@/components/player/v2/PlayerContent/QuranView/SkiaVerseText';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import type {SkTypefaceFontProvider} from '@shopify/react-native-skia';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';
import {getReadingThemeById} from '@/constants/readingThemes';
import {
  ALLAH_NAME_HIGHLIGHT_OPTIONS,
  getAllahNameHighlightColorHex,
} from '@/constants/mushafAllahHighlight';
import {getRewayahShortLabel} from '@/utils/rewayahLabels';
import {showToast} from '@/utils/toastUtils';
import {
  useMushafSettingsStore,
  getActualFontSize,
  getDisplayValue,
  DISPLAY_MIN,
  DISPLAY_MAX,
  type MushafRenderer,
  type MushafScrollDirection,
  type MushafArabicTextWeight,
  type MushafAllahNameHighlightColor,
  type RewayahId,
} from '@/store/mushafSettingsStore';

// --- Pre-cache Translation/Transliteration Data --- //
interface TransliterationData {
  [key: string]: {
    t: string;
  };
}

// Pre-load data outside component
let transliterationDataCache: TransliterationData | null = null;

try {
  transliterationDataCache = require('@/data/transliteration.json');
  console.log('[MushafSettingsContent] Transliteration data pre-cached');
} catch (error) {
  console.error('[MushafSettingsContent] Error pre-caching data:', error);
}

/** Derives theme-appropriate tajweed colors from the canonical constants.
 *  Dark mode: lighten colors for readability on dark backgrounds.
 *  Light mode: use canonical colors directly. */
const getThemedTajweedColors = (
  isDarkMode: boolean,
): {[key: string]: string} => {
  if (!isDarkMode) return tajweedColors;
  const themed: {[key: string]: string} = {};
  for (const [rule, hex] of Object.entries(tajweedColors)) {
    try {
      themed[rule] = Color(hex).lighten(0.3).saturate(0.1).toString();
    } catch {
      themed[rule] = hex;
    }
  }
  return themed;
};

// Simplified segment structure for the sample text
interface TajweedSampleSegment {
  text: string;
  rule: string | null;
}

// --- Font option data ---
interface FontOption {
  value: MushafRenderer;
  label: string;
  description: string;
}

const FONT_OPTIONS: FontOption[] = [
  {
    value: 'dk_v1',
    label: 'Madani 1405',
    description: 'Classic King Fahd Complex',
  },
  {
    value: 'dk_v2',
    label: 'Madani 1421',
    description: 'Modern King Fahd Complex',
  },
  {
    value: 'dk_indopak',
    label: 'IndoPak',
    description: 'Subcontinent Nastaliq style',
  },
];

interface TextWeightOption {
  value: MushafArabicTextWeight;
  label: string;
  description: string;
}

const TEXT_WEIGHT_OPTIONS: TextWeightOption[] = [
  {
    value: 'normal',
    label: 'Normal',
    description: 'Original mushaf weight',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Slightly more prominent',
  },
  {
    value: 'bold',
    label: 'Bold',
    description: 'Maximum prominence',
  },
];

// Internal reusable component for font size control
interface FontSizeControlProps {
  label: string;
  currentActualSize: number;
  onChange: (newActualSize: number) => void;
  theme: Theme;
  styles: ReturnType<typeof createStyles>;
  sampleText?: string;
  processedSampleSegments?: TajweedSampleSegment[];
  sampleFontFamily?: string;
  showTajweed?: boolean;
  skiaFontMgr?: SkTypefaceFontProvider | null;
  skiaFontFamily?: string;
  skiaVerseKey?: string;
  skiaIndexedTajweedData?: IndexedTajweedData | null;
  skiaArabicTextWeight?: MushafArabicTextWeight;
  showAllahNameHighlight?: boolean;
  allahNameHighlightColor?: string;
}

const FontSizeControl: React.FC<FontSizeControlProps> = ({
  label,
  currentActualSize,
  onChange,
  theme,
  styles,
  sampleText,
  processedSampleSegments,
  sampleFontFamily,
  showTajweed,
  skiaFontMgr,
  skiaFontFamily,
  skiaVerseKey,
  skiaIndexedTajweedData,
  skiaArabicTextWeight = 'normal',
  showAllahNameHighlight = false,
  allahNameHighlightColor,
}) => {
  const themedColors = useMemo(
    () => getThemedTajweedColors(theme.isDarkMode),
    [theme.isDarkMode],
  );

  const useSkia = !!skiaFontMgr && !!skiaFontFamily;
  const [sampleWidth, setSampleWidth] = useState(0);
  const handleSampleLayout = useCallback(
    (e: {nativeEvent: {layout: {width: number}}}) => {
      setSampleWidth(e.nativeEvent.layout.width);
    },
    [],
  );

  const currentDisplayValue = getDisplayValue(currentActualSize);

  const handleDecrement = () => {
    const newDisplayValue = Math.max(DISPLAY_MIN, currentDisplayValue - 1);
    const newActualSize = getActualFontSize(newDisplayValue);
    onChange(newActualSize);
  };

  const handleIncrement = () => {
    const newDisplayValue = Math.min(DISPLAY_MAX, currentDisplayValue + 1);
    const newActualSize = getActualFontSize(newDisplayValue);
    onChange(newActualSize);
  };

  const isQPC = sampleFontFamily === 'Uthmani';
  const isArabic = isQPC;

  const memoizedSampleText = React.useMemo(() => {
    const sampleBaseStyle = {
      fontSize: moderateScale(currentActualSize),
      color: theme.colors.text,
      fontFamily: sampleFontFamily || 'Manrope-Regular',
    };

    if (useSkia && skiaVerseKey && sampleWidth > 0) {
      return (
        <SkiaVerseText
          verseKey={skiaVerseKey}
          fontMgr={skiaFontMgr!}
          fontFamily={skiaFontFamily!}
          fontSize={moderateScale(currentActualSize)}
          textColor={theme.colors.text}
          showTajweed={showTajweed ?? false}
          width={sampleWidth}
          indexedTajweedData={skiaIndexedTajweedData ?? null}
          arabicTextWeight={skiaArabicTextWeight}
          showAllahNameHighlight={showAllahNameHighlight}
          allahNameHighlightColor={allahNameHighlightColor}
        />
      );
    } else if (isQPC && processedSampleSegments) {
      return (
        <Text
          style={[
            styles.sampleTextBase,
            styles.arabicSampleText,
            sampleBaseStyle,
          ]}>
          {processedSampleSegments.map((segment, index) => {
            const color =
              showTajweed && segment.rule
                ? themedColors[segment.rule] || theme.colors.text
                : theme.colors.text;
            return (
              <Text key={`sample-${index}`} style={{color}}>
                {segment.text}
              </Text>
            );
          })}
        </Text>
      );
    } else if (!isArabic && sampleText) {
      return (
        <FormattedTextRenderer text={sampleText} baseStyle={sampleBaseStyle} />
      );
    } else {
      return <Text style={sampleBaseStyle}>Loading sample...</Text>;
    }
  }, [
    currentActualSize,
    theme.colors.text,
    sampleFontFamily,
    useSkia,
    skiaVerseKey,
    skiaFontMgr,
    skiaFontFamily,
    skiaIndexedTajweedData,
    skiaArabicTextWeight,
    showAllahNameHighlight,
    allahNameHighlightColor,
    sampleWidth,
    isQPC,
    processedSampleSegments,
    sampleText,
    isArabic,
    styles.sampleTextBase,
    styles.arabicSampleText,
    showTajweed,
    themedColors,
  ]);

  return (
    <View>
      <View style={styles.fontSizeControlRow}>
        <Text style={styles.optionLabel}>{label}</Text>
        <View style={styles.fontSizeAdjuster}>
          <Pressable
            onPress={handleDecrement}
            hitSlop={10}
            disabled={currentDisplayValue <= DISPLAY_MIN}
            style={({pressed}) => [
              styles.fontSizeButton,
              currentDisplayValue <= DISPLAY_MIN &&
                styles.fontSizeButtonDisabled,
              pressed && styles.fontSizeButtonPressed,
            ]}>
            <Feather
              name="minus"
              size={moderateScale(16)}
              color={
                currentDisplayValue <= DISPLAY_MIN
                  ? Color(theme.colors.textSecondary).alpha(0.3).toString()
                  : theme.colors.text
              }
            />
          </Pressable>
          <Text style={styles.fontSizeValue}>{currentDisplayValue}</Text>
          <Pressable
            onPress={handleIncrement}
            hitSlop={10}
            disabled={currentDisplayValue >= DISPLAY_MAX}
            style={({pressed}) => [
              styles.fontSizeButton,
              currentDisplayValue >= DISPLAY_MAX &&
                styles.fontSizeButtonDisabled,
              pressed && styles.fontSizeButtonPressed,
            ]}>
            <Feather
              name="plus"
              size={moderateScale(16)}
              color={
                currentDisplayValue >= DISPLAY_MAX
                  ? Color(theme.colors.textSecondary).alpha(0.3).toString()
                  : theme.colors.text
              }
            />
          </Pressable>
        </View>
      </View>
      <View
        onLayout={useSkia ? handleSampleLayout : undefined}
        style={[
          styles.sampleTextContainer,
          isArabic && styles.arabicSampleTextContainer,
        ]}>
        {memoizedSampleText}
      </View>
    </View>
  );
};

// Custom TajweedToggle component
interface TajweedToggleProps {
  value: boolean;
  onValueChange: () => void;
  theme: Theme;
  disabled?: boolean;
}

const TajweedToggle: React.FC<TajweedToggleProps> = ({
  value,
  onValueChange,
  theme,
  disabled = false,
}) => {
  const themedColors = useMemo(
    () => getThemedTajweedColors(theme.isDarkMode),
    [theme.isDarkMode],
  );

  const coloredGradient = React.useMemo(
    () =>
      [
        themedColors.madda_necessary,
        themedColors.madda_obligatory_mottasel,
        themedColors.madda_permissible,
        themedColors.madda_normal,
        themedColors.ghunnah,
        themedColors.qalaqah,
        themedColors.idgham_mutajanisayn,
      ] as const,
    [themedColors],
  );

  const monochromeGradient = React.useMemo(
    () =>
      [
        Color(theme.colors.textSecondary).alpha(0.2).toString(),
        Color(theme.colors.textSecondary).alpha(0.1).toString(),
      ] as const,
    [theme.colors.textSecondary],
  );

  const gradientColors =
    !disabled && value ? coloredGradient : monochromeGradient;

  const toggleStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
    borderRadius: moderateScale(16),
    padding: moderateScale(4),
    paddingHorizontal: moderateScale(8),
    overflow: 'hidden',
    opacity: disabled ? 0.5 : 1,
  } as const;

  const barStyle = {
    height: moderateScale(8),
    width: moderateScale(50),
    borderRadius: moderateScale(4),
    marginRight: moderateScale(6),
  } as const;

  const textContainerStyle = {
    width: moderateScale(30),
    alignItems: 'center' as const,
  };

  const textStyle = {
    fontSize: moderateScale(13),
    fontFamily: 'Manrope-SemiBold',
    color: !disabled && value ? theme.colors.text : theme.colors.textSecondary,
  } as const;

  return (
    <Pressable onPress={onValueChange} style={toggleStyle} disabled={disabled}>
      <LinearGradient
        colors={
          gradientColors.length >= 2
            ? gradientColors
            : [theme.colors.text, theme.colors.text]
        }
        start={{x: 0, y: 0}}
        end={{x: 1, y: 0}}
        style={barStyle}
      />
      <View style={textContainerStyle}>
        <Text style={textStyle}>{!disabled && value ? 'ON' : 'OFF'}</Text>
      </View>
    </Pressable>
  );
};

interface TextWeightControlProps {
  value: MushafArabicTextWeight;
  onChange: (value: MushafArabicTextWeight) => void;
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
}

const TextWeightControl: React.FC<TextWeightControlProps> = ({
  value,
  onChange,
  styles,
  theme,
}) => (
  <View style={styles.card}>
    {TEXT_WEIGHT_OPTIONS.map((option, idx) => {
      const isSelected = value === option.value;
      return (
        <React.Fragment key={option.value}>
          {idx > 0 && <View style={styles.divider} />}
          <Pressable
            style={({pressed}) => [
              styles.radioRow,
              pressed && styles.radioRowPressed,
            ]}
            onPress={() => onChange(option.value)}>
            <View
              style={[
                styles.radioCircle,
                isSelected && styles.radioCircleSelected,
              ]}>
              {isSelected && <View style={styles.radioCircleFill} />}
            </View>
            <View style={styles.radioTextContainer}>
              <Text
                style={[
                  styles.radioLabel,
                  isSelected && styles.radioLabelSelected,
                ]}>
                {option.label}
              </Text>
              <Text style={styles.radioDescription}>{option.description}</Text>
            </View>
            {isSelected && (
              <Feather
                name="check"
                size={moderateScale(18)}
                color={Color(theme.colors.text).alpha(0.7).toString()}
              />
            )}
          </Pressable>
        </React.Fragment>
      );
    })}
  </View>
);

interface AllahNameColorControlProps {
  value: MushafAllahNameHighlightColor;
  onChange: (value: MushafAllahNameHighlightColor) => void;
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
}

const AllahNameColorControl: React.FC<AllahNameColorControlProps> = ({
  value,
  onChange,
  styles,
  theme,
}) => (
  <View style={styles.colorPickerRow}>
    {ALLAH_NAME_HIGHLIGHT_OPTIONS.map(option => {
      const color = theme.isDarkMode ? option.dark : option.light;
      const isActive = value === option.id;
      return (
        <Pressable
          key={option.id}
          style={[
            styles.colorSwatch,
            {backgroundColor: color},
            isActive && styles.colorSwatchActive,
          ]}
          onPress={() => onChange(option.id)}>
          {isActive ? (
            <Feather
              name="check"
              size={moderateScale(16)}
              color={Color('#111111')
                .alpha(theme.isDarkMode ? 0.9 : 0.75)
                .toString()}
            />
          ) : null}
        </Pressable>
      );
    })}
  </View>
);

interface MushafSettingsContentProps {
  containerStyle?: object;
  showTitle?: boolean;
  context?: 'mushaf' | 'player';
  onOpenThemePicker?: () => void;
}

export const MushafSettingsContent: React.FC<MushafSettingsContentProps> = ({
  containerStyle,
  showTitle = true,
  context,
  onOpenThemePicker,
}) => {
  const {theme, themeMode} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {indexedTajweedData, isLoading: isTajweedLoading} = useTajweedStore();

  const {
    showTranslation,
    showTransliteration,
    showTajweed,
    arabicFontSize,
    translationFontSize,
    transliterationFontSize,
    arabicTextWeight,
    showAllahNameHighlight,
    allahNameHighlightColor,
    toggleTranslation,
    toggleTransliteration,
    toggleTajweed,
    setArabicFontSize,
    setTranslationFontSize,
    setTransliterationFontSize,
    setArabicTextWeight,
    mushafRenderer,
    setMushafRenderer,
    pageLayout,
    setPageLayout,
    viewMode,
    setViewMode,
    scrollDirection,
    setScrollDirection,
    showWBW,
    wbwShowTranslation,
    wbwShowTransliteration,
    showThemes,
    toggleWBW,
    toggleWBWTranslation,
    toggleWBWTransliteration,
    toggleAllahNameHighlight,
    toggleThemes,
    lightThemeId,
    darkThemeId,
    rewayah,
    showRewayahDiffs,
    setRewayah,
    toggleRewayahDiffs,
    setAllahNameHighlightColor,
  } = useMushafSettingsStore();

  const verseKey = '1:1';
  const allahNameHighlightHex = getAllahNameHighlightColorHex(
    allahNameHighlightColor,
    theme.isDarkMode,
  );

  const dkFontFamily =
    mushafRenderer === 'dk_indopak'
      ? 'DigitalKhattIndoPak'
      : mushafRenderer === 'dk_v1'
      ? 'DigitalKhattV1'
      : 'DigitalKhattV2';
  const fontMgr =
    mushafPreloadService.initialized && digitalKhattDataService.initialized
      ? mushafPreloadService.fontMgr
      : null;

  const actualTranslationText = useMemo(() => {
    try {
      const saheehInternationalData = require('@/data/SaheehInternational.translation-with-footnote-tags.json');
      return (
        saheehInternationalData[verseKey]?.t || 'Error loading translation'
      );
    } catch (error) {
      console.error(
        '[MushafSettingsContent] Error loading translation:',
        error,
      );
      return 'Error loading translation';
    }
  }, []);

  const actualTransliterationText = useMemo(
    () =>
      transliterationDataCache?.[verseKey]?.t ||
      'Error loading transliteration',
    [],
  );

  const flatVerseSegments = useMemo(() => {
    if (isTajweedLoading || !indexedTajweedData?.[verseKey]) return undefined;
    const verseWords = indexedTajweedData[verseKey];
    return verseWords.flatMap((wordData, wordIndex) => {
      const segments = wordData.segments.map(segment => ({
        text: segment.text,
        rule: segment.rule,
      }));
      if (wordIndex < verseWords.length - 1) {
        segments.push({text: ' ', rule: null});
      }
      return segments;
    });
  }, [indexedTajweedData, verseKey, isTajweedLoading]);

  const trackColor = {
    false: Color(theme.colors.text).alpha(0.1).toString(),
    true: Color(theme.colors.text).alpha(0.65).toString(),
  };

  const handleFontSelect = useCallback(
    (value: MushafRenderer) => {
      setMushafRenderer(value);
    },
    [setMushafRenderer],
  );

  const handleRewayahSelect = useCallback(
    async (value: RewayahId) => {
      if (value === rewayah) return;
      // Load the new words DB BEFORE flipping the store so React re-renders
      // with the correct text/layout already in place.
      try {
        await digitalKhattDataService.switchRewayah(value);
      } catch (error) {
        console.error('[MushafSettings] Failed to switch rewayah:', error);
        return;
      }
      setRewayah(value);
      showToast('Now reading', getRewayahShortLabel(value));
    },
    [rewayah, setRewayah],
  );

  return (
    <View style={[styles.container, containerStyle]}>
      {showTitle && <Text style={styles.title}>Mushaf Settings</Text>}

      {/* VIEW TYPE Section (hidden from player context) */}
      {context !== 'player' && (
        <>
          <Text style={styles.sectionHeader}>VIEW TYPE</Text>
          <View style={styles.card}>
            <Pressable
              style={({pressed}) => [
                styles.settingRow,
                pressed && styles.settingRowPressed,
              ]}
              onPress={() => setViewMode('mushaf')}>
              <MushafPagePillIcon
                size={moderateScale(20)}
                color={Color(theme.colors.text).alpha(0.7).toString()}
              />
              <Text style={styles.settingRowLabel}>Mushaf</Text>
              {viewMode === 'mushaf' && (
                <Feather
                  name="check"
                  size={moderateScale(18)}
                  color={Color(theme.colors.text).alpha(0.7).toString()}
                />
              )}
            </Pressable>
            <View style={styles.divider} />
            <Pressable
              style={({pressed}) => [
                styles.settingRow,
                pressed && styles.settingRowPressed,
              ]}
              onPress={() => setViewMode('list')}>
              <ListViewPillIcon
                size={moderateScale(20)}
                color={Color(theme.colors.text).alpha(0.7).toString()}
              />
              <Text style={styles.settingRowLabel}>List</Text>
              {viewMode === 'list' && (
                <Feather
                  name="check"
                  size={moderateScale(18)}
                  color={Color(theme.colors.text).alpha(0.7).toString()}
                />
              )}
            </Pressable>
          </View>

          <Text style={styles.sectionHeader}>SCROLL DIRECTION</Text>
          <View style={styles.card}>
            <Pressable
              style={({pressed}) => [
                styles.settingRow,
                pressed && styles.settingRowPressed,
              ]}
              onPress={() => setScrollDirection('horizontal')}>
              <HorizontalScrollPillIcon
                size={moderateScale(20)}
                color={Color(theme.colors.text).alpha(0.7).toString()}
              />
              <Text style={styles.settingRowLabel}>Horizontal</Text>
              {scrollDirection === 'horizontal' && (
                <Feather
                  name="check"
                  size={moderateScale(18)}
                  color={Color(theme.colors.text).alpha(0.7).toString()}
                />
              )}
            </Pressable>
            <View style={styles.divider} />
            <Pressable
              style={({pressed}) => [
                styles.settingRow,
                pressed && styles.settingRowPressed,
              ]}
              onPress={() => setScrollDirection('vertical')}>
              <VerticalScrollPillIcon
                size={moderateScale(20)}
                color={Color(theme.colors.text).alpha(0.7).toString()}
              />
              <Text style={styles.settingRowLabel}>Vertical</Text>
              {scrollDirection === 'vertical' && (
                <Feather
                  name="check"
                  size={moderateScale(18)}
                  color={Color(theme.colors.text).alpha(0.7).toString()}
                />
              )}
            </Pressable>
          </View>

          {/* PAGE DESIGN: only in mushaf view + horizontal */}
          {viewMode === 'mushaf' && scrollDirection === 'horizontal' && (
            <>
              <Text style={styles.sectionHeader}>PAGE DESIGN</Text>
              <View style={styles.card}>
                <Pressable
                  style={({pressed}) => [
                    styles.settingRow,
                    pressed && styles.settingRowPressed,
                  ]}
                  onPress={() => setPageLayout('fullscreen')}>
                  <FullscreenPillIcon
                    size={moderateScale(20)}
                    color={Color(theme.colors.text).alpha(0.7).toString()}
                  />
                  <Text style={styles.settingRowLabel}>Fullscreen</Text>
                  {pageLayout === 'fullscreen' && (
                    <Feather
                      name="check"
                      size={moderateScale(18)}
                      color={Color(theme.colors.text).alpha(0.7).toString()}
                    />
                  )}
                </Pressable>
                <View style={styles.divider} />
                <Pressable
                  style={({pressed}) => [
                    styles.settingRow,
                    pressed && styles.settingRowPressed,
                  ]}
                  onPress={() => setPageLayout('book')}>
                  <BookLayoutPillIcon
                    size={moderateScale(20)}
                    color={Color(theme.colors.text).alpha(0.7).toString()}
                  />
                  <Text style={styles.settingRowLabel}>Book</Text>
                  {pageLayout === 'book' && (
                    <Feather
                      name="check"
                      size={moderateScale(18)}
                      color={Color(theme.colors.text).alpha(0.7).toString()}
                    />
                  )}
                </Pressable>
              </View>
            </>
          )}
        </>
      )}

      {/* READING THEME Section */}
      <Text style={styles.sectionHeader}>READING THEME</Text>
      <View style={styles.card}>
        <Pressable
          style={({pressed}) => [
            styles.settingRow,
            pressed && styles.settingRowPressed,
          ]}
          onPress={onOpenThemePicker}>
          <Text style={styles.settingRowLabel}>
            {themeMode === 'system'
              ? 'System'
              : getReadingThemeById(
                  themeMode === 'light' ? lightThemeId : darkThemeId,
                )?.name ?? 'System'}
          </Text>
          <Feather
            name="chevron-right"
            size={moderateScale(18)}
            color={Color(theme.colors.text).alpha(0.2).toString()}
          />
        </Pressable>
      </View>

      {/* Word by Word Section — only in list view */}
      {context !== 'player' && viewMode === 'list' && (
        <>
          <Text style={styles.sectionHeader}>WORD BY WORD</Text>
          <View style={styles.card}>
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Word by Word</Text>
              <Switch
                trackColor={trackColor}
                thumbColor="#FFFFFF"
                ios_backgroundColor={trackColor.false}
                onValueChange={toggleWBW}
                value={showWBW}
                style={styles.switchStyle}
              />
            </View>
            {showWBW && (
              <>
                <View style={styles.divider} />
                <Pressable
                  style={({pressed}) => [
                    styles.settingRow,
                    pressed && styles.settingRowPressed,
                  ]}
                  onPress={toggleWBWTranslation}>
                  <Text style={styles.settingRowLabel}>Translation</Text>
                  {wbwShowTranslation && (
                    <Feather
                      name="check"
                      size={moderateScale(18)}
                      color={Color(theme.colors.text).alpha(0.7).toString()}
                    />
                  )}
                </Pressable>
                <View style={styles.divider} />
                <Pressable
                  style={({pressed}) => [
                    styles.settingRow,
                    pressed && styles.settingRowPressed,
                  ]}
                  onPress={toggleWBWTransliteration}>
                  <Text style={styles.settingRowLabel}>Transliteration</Text>
                  {wbwShowTransliteration && (
                    <Feather
                      name="check"
                      size={moderateScale(18)}
                      color={Color(theme.colors.text).alpha(0.7).toString()}
                    />
                  )}
                </Pressable>
              </>
            )}
          </View>
        </>
      )}

      {/* Translation/Transliteration Section (shown in player context OR list view mode) */}
      {(context !== 'mushaf' || viewMode === 'list') && (
        <>
          <View style={styles.card}>
            <FontSizeControl
              label="Arabic Font Size"
              currentActualSize={arabicFontSize}
              onChange={setArabicFontSize}
              theme={theme}
              styles={styles}
              processedSampleSegments={flatVerseSegments}
              sampleFontFamily={'Uthmani'}
              showTajweed={showTajweed}
              skiaFontMgr={fontMgr}
              skiaFontFamily={dkFontFamily}
              skiaVerseKey={verseKey}
              skiaIndexedTajweedData={indexedTajweedData}
              skiaArabicTextWeight={arabicTextWeight}
              showAllahNameHighlight={showAllahNameHighlight}
              allahNameHighlightColor={allahNameHighlightHex}
            />
          </View>

          <View style={styles.card}>
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Transliteration</Text>
              <Switch
                trackColor={trackColor}
                thumbColor="#FFFFFF"
                ios_backgroundColor={trackColor.false}
                onValueChange={toggleTransliteration}
                value={showTransliteration}
                style={styles.switchStyle}
              />
            </View>
            {showTransliteration && (
              <>
                <View style={styles.divider} />
                <FontSizeControl
                  label="Font Size"
                  currentActualSize={transliterationFontSize}
                  onChange={setTransliterationFontSize}
                  theme={theme}
                  styles={styles}
                  sampleText={actualTransliterationText}
                  sampleFontFamily="Manrope-Regular"
                />
              </>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Translation</Text>
              <Switch
                trackColor={trackColor}
                thumbColor="#FFFFFF"
                ios_backgroundColor={trackColor.false}
                onValueChange={toggleTranslation}
                value={showTranslation}
                style={styles.switchStyle}
              />
            </View>
            <Text style={styles.helperText}>
              Using: Saheeh International Translation with footnotes
            </Text>
            {showTranslation && (
              <>
                <View style={styles.divider} />
                <FontSizeControl
                  label="Font Size"
                  currentActualSize={translationFontSize}
                  onChange={setTranslationFontSize}
                  theme={theme}
                  styles={styles}
                  sampleText={actualTranslationText}
                  sampleFontFamily="Manrope-Regular"
                />
              </>
            )}
          </View>
        </>
      )}

      {/* TEXT THICKNESS Section */}
      <Text style={styles.sectionHeader}>TEXT THICKNESS</Text>
      <TextWeightControl
        value={arabicTextWeight}
        onChange={setArabicTextWeight}
        styles={styles}
        theme={theme}
      />

      <Text style={styles.sectionHeader}>ALLAH NAME</Text>
      <View style={styles.card}>
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Highlight Allah&apos;s Name</Text>
          <Switch
            trackColor={trackColor}
            thumbColor="#FFFFFF"
            ios_backgroundColor={trackColor.false}
            onValueChange={toggleAllahNameHighlight}
            value={showAllahNameHighlight}
            style={styles.switchStyle}
          />
        </View>
        <Text style={styles.helperText}>
          Highlights every occurrence of Allah&apos;s name in the mushaf.
        </Text>
        {showAllahNameHighlight && (
          <>
            <View style={styles.divider} />
            <AllahNameColorControl
              value={allahNameHighlightColor}
              onChange={setAllahNameHighlightColor}
              styles={styles}
              theme={theme}
            />
          </>
        )}
      </View>

      {/* THEMES Section */}
      <View style={styles.card}>
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Thematic Highlighting</Text>
          <Switch
            trackColor={trackColor}
            thumbColor="#FFFFFF"
            ios_backgroundColor={trackColor.false}
            onValueChange={toggleThemes}
            value={showThemes}
            style={styles.switchStyle}
          />
        </View>
        <Text style={styles.helperText}>
          Alternating highlights by thematic passage
        </Text>
      </View>

      {/* FONT Section */}
      <Text style={styles.sectionHeader}>FONT</Text>
      <View style={styles.card}>
        {/* Tajweed Toggle */}
        <View style={styles.tajweedOptionRow}>
          <View style={styles.tajweedLabelContainer}>
            <Text style={styles.tajweedLabel}>Tajweed Coloring</Text>
            <Text style={styles.tajweedSubLabel}>
              Highlight rules with colors
            </Text>
          </View>
          <TajweedToggle
            value={showTajweed}
            onValueChange={toggleTajweed}
            theme={theme}
          />
        </View>
        <View style={styles.divider} />
      </View>
      <View style={styles.card}>
        {FONT_OPTIONS.map((option, idx) => {
          const isSelected = mushafRenderer === option.value;
          return (
            <React.Fragment key={option.value}>
              {idx > 0 && <View style={styles.divider} />}
              <Pressable
                style={({pressed}) => [
                  styles.radioRow,
                  pressed && styles.radioRowPressed,
                ]}
                onPress={() => handleFontSelect(option.value)}>
                <View
                  style={[
                    styles.radioCircle,
                    isSelected && styles.radioCircleSelected,
                  ]}>
                  {isSelected && <View style={styles.radioCircleFill} />}
                </View>
                <View style={styles.radioTextContainer}>
                  <Text
                    style={[
                      styles.radioLabel,
                      isSelected && styles.radioLabelSelected,
                    ]}>
                    {option.label}
                  </Text>
                  <Text style={styles.radioDescription}>
                    {option.description}
                  </Text>
                </View>
              </Pressable>
            </React.Fragment>
          );
        })}
      </View>

      {/* REWAYAH Section */}
      <Text style={styles.sectionHeader}>REWAYAH</Text>
      <View style={styles.card}>
        {REWAYAH_OPTIONS.map((option, idx) => {
          const isSelected = rewayah === option.value;
          return (
            <React.Fragment key={option.value}>
              {idx > 0 && <View style={styles.divider} />}
              <Pressable
                style={({pressed}) => [
                  styles.radioRow,
                  pressed && styles.radioRowPressed,
                ]}
                onPress={() => handleRewayahSelect(option.value)}>
                <View
                  style={[
                    styles.radioCircle,
                    isSelected && styles.radioCircleSelected,
                  ]}>
                  {isSelected && <View style={styles.radioCircleFill} />}
                </View>
                <View style={styles.radioTextContainer}>
                  <Text
                    style={[
                      styles.radioLabel,
                      isSelected && styles.radioLabelSelected,
                    ]}>
                    {option.label}
                  </Text>
                  <Text style={styles.radioDescription}>
                    {option.description}
                  </Text>
                </View>
              </Pressable>
            </React.Fragment>
          );
        })}
      </View>
      {rewayah !== 'hafs' && (
        <RewayahDiffCard
          rewayah={rewayah}
          showRewayahDiffs={showRewayahDiffs}
          toggleRewayahDiffs={toggleRewayahDiffs}
          trackColor={trackColor}
          styles={styles}
          theme={theme}
        />
      )}
    </View>
  );
};

interface RewayahDiffCardProps {
  rewayah: Exclude<RewayahId, 'hafs'>;
  showRewayahDiffs: boolean;
  toggleRewayahDiffs: () => void;
  trackColor: {false: string; true: string};
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
}

const RewayahDiffCard: React.FC<RewayahDiffCardProps> = ({
  rewayah,
  showRewayahDiffs,
  toggleRewayahDiffs,
  trackColor,
  styles,
  theme,
}) => {
  const [showLegend, setShowLegend] = useState(false);
  const legend = REWAYAH_LEGEND[rewayah];

  return (
    <View style={styles.card}>
      <View style={styles.optionRow}>
        <Text style={styles.optionLabel}>Show Differences</Text>
        <Switch
          trackColor={trackColor}
          thumbColor="#FFFFFF"
          ios_backgroundColor={trackColor.false}
          onValueChange={toggleRewayahDiffs}
          value={showRewayahDiffs}
          style={styles.switchStyle}
        />
      </View>
      <Text style={styles.helperText}>{legend.summary}</Text>
      <View style={styles.divider} />
      <Pressable
        style={({pressed}) => [
          styles.settingRow,
          pressed && styles.settingRowPressed,
        ]}
        onPress={() => setShowLegend(!showLegend)}>
        <Feather
          name="info"
          size={moderateScale(16)}
          color={Color(theme.colors.text).alpha(0.7).toString()}
        />
        <Text style={styles.settingRowLabel}>Color legend</Text>
        <Feather
          name={showLegend ? 'chevron-up' : 'chevron-down'}
          size={moderateScale(18)}
          color={Color(theme.colors.text).alpha(0.4).toString()}
        />
      </Pressable>
      {showLegend && (
        <>
          <View style={styles.divider} />
          <View style={styles.legendContainer}>
            {legend.entries.map((entry, idx) => (
              <React.Fragment key={entry.label}>
                {idx > 0 && <View style={styles.legendDivider} />}
                <View style={styles.legendRow}>
                  <View
                    style={[
                      styles.legendSwatch,
                      entry.isBackground
                        ? styles.legendSwatchBlock
                        : styles.legendSwatchDot,
                      {backgroundColor: entry.color},
                    ]}
                  />
                  <View style={styles.legendTextContainer}>
                    <Text style={styles.legendLabel}>{entry.label}</Text>
                    <Text style={styles.legendDescription}>
                      {entry.description}
                    </Text>
                  </View>
                </View>
              </React.Fragment>
            ))}
          </View>
        </>
      )}
    </View>
  );
};

interface LegendEntry {
  color: string;
  isBackground?: boolean;
  label: string;
  description: string;
}

interface RewayahLegend {
  summary: string;
  entries: LegendEntry[];
}

// Per-rewayah disclosure of what 'Show Differences' actually highlights.
// The summary is factual — describes which rules we do and don't cover so
// users can calibrate expectations vs a printed color-coded mushaf.
const REWAYAH_LEGEND: Record<Exclude<RewayahId, 'hafs'>, RewayahLegend> = {
  shouba: {
    summary:
      'Flags words that differ from Hafs. Letter-level tajweed rules are not highlighted for this rewayah.',
    entries: [
      {
        color: REWAYAH_DIFF_BACKGROUND,
        isBackground: true,
        label: 'Word variant',
        description: 'Letter-level difference from Hafs',
      },
      {
        color: tajweedColors.minor,
        label: 'Vowel / mood shift',
        description: 'Trailing-vowel or mood change only',
      },
    ],
  },
  bazzi: {
    summary:
      "Flags words that differ from Hafs and highlights Ibn Kathir's silah (pronoun lengthening). Letter-level tajweed rules are not highlighted.",
    entries: [
      {
        color: REWAYAH_DIFF_BACKGROUND,
        isBackground: true,
        label: 'Word variant',
        description: 'Letter-level difference from Hafs',
      },
      {
        color: tajweedColors.minor,
        label: 'Vowel / mood shift',
        description: 'Trailing-vowel or mood change only',
      },
      {
        color: tajweedColors.silah,
        label: 'Silah',
        description: 'Pronoun-lengthening mark (ۥ / ۦ)',
      },
    ],
  },
  qumbul: {
    summary:
      "Flags words that differ from Hafs and highlights Ibn Kathir's silah (pronoun lengthening). Letter-level tajweed rules are not highlighted.",
    entries: [
      {
        color: REWAYAH_DIFF_BACKGROUND,
        isBackground: true,
        label: 'Word variant',
        description: 'Letter-level difference from Hafs',
      },
      {
        color: tajweedColors.minor,
        label: 'Vowel / mood shift',
        description: 'Trailing-vowel or mood change only',
      },
      {
        color: tajweedColors.silah,
        label: 'Silah',
        description: 'Pronoun-lengthening mark (ۥ / ۦ)',
      },
    ],
  },
  warsh: {
    summary:
      'Highlights the published-mushaf rules KFGQPC encodes: tashil, ibdal, madd al-badal, taghliz al-lam, silah, and genuine word variants. Taqlil, tarqiq ar-ra, and naql are not yet supported.',
    entries: [
      {
        color: tajweedColors.madd,
        label: 'Madd al-Badal',
        description: 'Prolonged vowel after hamza',
      },
      {
        color: tajweedColors.tashil,
        label: 'Tashil / Musahhala',
        description: 'Softened hamza pronunciation',
      },
      {
        color: tajweedColors.ibdal,
        label: 'Ibdal',
        description: 'Hamza replaced by long vowel',
      },
      {
        color: tajweedColors.taghliz,
        label: 'Taghliz al-Lam',
        description: 'Heavy lam in Allah after emphatic letters',
      },
      {
        color: tajweedColors.silah,
        label: 'Silah',
        description: 'Pronoun-lengthening mark (ۥ / ۦ)',
      },
      {
        color: REWAYAH_DIFF_BACKGROUND,
        isBackground: true,
        label: 'Word variant',
        description: 'Genuine letter-level difference from Hafs',
      },
    ],
  },
  qaloon: {
    summary:
      'Highlights the published-mushaf rules KFGQPC encodes: tashil, ibdal, madd al-badal, taghliz al-lam, silah, and genuine word variants. Taqlil, tarqiq ar-ra, and naql are not yet supported.',
    entries: [
      {
        color: tajweedColors.madd,
        label: 'Madd al-Badal',
        description: 'Prolonged vowel after hamza',
      },
      {
        color: tajweedColors.tashil,
        label: 'Tashil / Musahhala',
        description: 'Softened hamza pronunciation',
      },
      {
        color: tajweedColors.ibdal,
        label: 'Ibdal',
        description: 'Hamza replaced by long vowel',
      },
      {
        color: tajweedColors.taghliz,
        label: 'Taghliz al-Lam',
        description: 'Heavy lam in Allah after emphatic letters',
      },
      {
        color: tajweedColors.silah,
        label: 'Silah',
        description: 'Pronoun-lengthening mark (ۥ / ۦ)',
      },
      {
        color: REWAYAH_DIFF_BACKGROUND,
        isBackground: true,
        label: 'Word variant',
        description: 'Genuine letter-level difference from Hafs',
      },
    ],
  },
  doori: {
    summary:
      'Flags only genuine letter-level word variants from Hafs. Abu Amr-specific tajweed rules (idgham kabeer, imalah) are not yet highlighted.',
    entries: [
      {
        color: REWAYAH_DIFF_BACKGROUND,
        isBackground: true,
        label: 'Word variant',
        description: 'Genuine letter-level difference from Hafs',
      },
    ],
  },
  soosi: {
    summary:
      'Flags only genuine letter-level word variants from Hafs. Abu Amr-specific tajweed rules (idgham kabeer, imalah) are not yet highlighted.',
    entries: [
      {
        color: REWAYAH_DIFF_BACKGROUND,
        isBackground: true,
        label: 'Word variant',
        description: 'Genuine letter-level difference from Hafs',
      },
    ],
  },
};

const REWAYAH_OPTIONS: Array<{
  value: RewayahId;
  label: string;
  description: string;
}> = [
  {
    value: 'hafs',
    label: "Hafs 'an Asim",
    description: 'The standard reading, used by most of the Muslim world',
  },
  {
    value: 'shouba',
    label: "Shu'bah 'an Asim",
    description: "The second Kufan transmission from Asim, brother of Hafs'",
  },
  {
    value: 'bazzi',
    label: "Al-Bazzi 'an Ibn Kathir",
    description:
      'Meccan transmission from Ibn Kathir, read throughout Mecca and Yemen',
  },
  {
    value: 'qumbul',
    label: "Qunbul 'an Ibn Kathir",
    description: 'The second Meccan transmission from Ibn Kathir',
  },
  {
    value: 'warsh',
    label: "Warsh 'an Nafi'",
    description:
      'Medinan transmission from Nafiʿ — dominant across North Africa',
  },
  {
    value: 'qaloon',
    label: "Qalun 'an Nafi'",
    description:
      'The second Medinan transmission from Nafiʿ — read in Libya and parts of Tunisia',
  },
  {
    value: 'doori',
    label: "Al-Duri 'an Abu Amr",
    description:
      'Basran transmission from Abu Amr — common in Sudan and parts of West Africa',
  },
  {
    value: 'soosi',
    label: "Al-Susi 'an Abu Amr",
    description: 'The second Basran transmission from Abu Amr',
  },
];

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      padding: moderateScale(16),
    },
    card: {
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      borderRadius: moderateScale(14),
      paddingHorizontal: moderateScale(14),
      overflow: 'hidden',
      marginBottom: verticalScale(16),
    },
    sectionHeader: {
      fontSize: moderateScale(10.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: verticalScale(4),
      marginLeft: moderateScale(4),
    },
    sectionSubHeader: {
      fontSize: moderateScale(11.5),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      marginBottom: verticalScale(8),
      marginLeft: moderateScale(4),
    },
    optionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: verticalScale(8),
    },
    optionLabel: {
      fontSize: moderateScale(13.5),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.text).alpha(0.85).toString(),
      marginRight: moderateScale(10),
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    switchStyle: {
      transform: [{scaleX: 0.8}, {scaleY: 0.8}],
    },
    fontSizeControlRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: verticalScale(8),
    },
    fontSizeAdjuster: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(8),
    },
    fontSizeButton: {
      width: moderateScale(32),
      height: moderateScale(32),
      borderRadius: moderateScale(16),
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      alignItems: 'center',
      justifyContent: 'center',
    },
    fontSizeButtonDisabled: {
      opacity: 0.4,
    },
    fontSizeButtonPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    fontSizeValue: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.text,
      minWidth: moderateScale(24),
      textAlign: 'center',
    },
    sampleTextContainer: {
      marginTop: verticalScale(5),
      paddingVertical: verticalScale(10),
      paddingHorizontal: moderateScale(8),
      borderRadius: moderateScale(6),
      overflow: 'hidden',
      opacity: 0.8,
    },
    sampleTextBase: {},
    arabicSampleTextContainer: {
      alignItems: 'flex-end',
    },
    arabicSampleText: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    title: {
      fontSize: moderateScale(20),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      marginBottom: verticalScale(16),
      textAlign: 'center',
    },
    helperText: {
      fontSize: moderateScale(11.5),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      marginTop: verticalScale(4),
      marginBottom: verticalScale(8),
      paddingHorizontal: moderateScale(16),
    },
    colorPickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(10),
      paddingVertical: verticalScale(10),
      paddingHorizontal: moderateScale(14),
      marginHorizontal: -moderateScale(14),
    },
    colorSwatch: {
      width: moderateScale(28),
      height: moderateScale(28),
      borderRadius: moderateScale(14),
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: Color(theme.colors.text).alpha(0.12).toString(),
    },
    colorSwatchActive: {
      borderColor: Color(theme.colors.text)
        .alpha(theme.isDarkMode ? 0.9 : 0.75)
        .toString(),
      transform: [{scale: 1.04}],
    },
    tajweedOptionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: verticalScale(10),
    },
    tajweedLabelContainer: {
      flex: 1,
    },
    tajweedLabel: {
      fontSize: moderateScale(13.5),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    tajweedSubLabel: {
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      marginTop: verticalScale(2),
    },

    // --- Radio card styles ---
    radioRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: verticalScale(12),
      paddingHorizontal: moderateScale(14),
      marginHorizontal: -moderateScale(14),
    },
    radioRowPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    radioCircle: {
      width: moderateScale(20),
      height: moderateScale(20),
      borderRadius: moderateScale(10),
      borderWidth: 1.5,
      borderColor: Color(theme.colors.text).alpha(0.2).toString(),
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: moderateScale(12),
    },
    radioCircleSelected: {
      borderColor: theme.colors.text,
    },
    radioCircleFill: {
      width: moderateScale(10),
      height: moderateScale(10),
      borderRadius: moderateScale(5),
      backgroundColor: theme.colors.text,
    },
    radioTextContainer: {
      flex: 1,
    },
    radioLabel: {
      fontSize: moderateScale(13.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.text).alpha(0.85).toString(),
    },
    radioLabelSelected: {
      color: theme.colors.text,
    },
    radioDescription: {
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.45).toString(),
      marginTop: verticalScale(1),
    },

    // --- Setting row styles (card list with checkmarks) ---
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: verticalScale(12),
      paddingHorizontal: moderateScale(14),
      marginHorizontal: -moderateScale(14),
      gap: moderateScale(12),
    },
    settingRowPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    settingRowLabel: {
      flex: 1,
      fontSize: moderateScale(13.5),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.text).alpha(0.85).toString(),
    },

    // --- Rewayah legend styles ---
    legendContainer: {
      paddingVertical: verticalScale(6),
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: verticalScale(8),
      gap: moderateScale(12),
    },
    legendDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      marginLeft: moderateScale(28),
    },
    legendSwatch: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    legendSwatchDot: {
      width: moderateScale(16),
      height: moderateScale(16),
      borderRadius: moderateScale(8),
    },
    legendSwatchBlock: {
      width: moderateScale(20),
      height: moderateScale(14),
      borderRadius: moderateScale(3),
    },
    legendTextContainer: {
      flex: 1,
    },
    legendLabel: {
      fontSize: moderateScale(12.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.text).alpha(0.85).toString(),
    },
    legendDescription: {
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.6).toString(),
      marginTop: verticalScale(1),
    },
  });
