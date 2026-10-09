import React, {useMemo, useCallback, useState} from 'react';
import {
  ActivityIndicator, // @ai
  Alert,
  View,
  Text,
  StyleSheet,
  Switch,
  Pressable,
  type StyleProp, // @ai
  type ViewStyle, // @ai
} from 'react-native';
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
import {tajweedColors} from '@/constants/tajweedColors';
import FormattedTextRenderer from '@/components/utils/FormattedText';
import {LinearGradient} from 'expo-linear-gradient';
import SkiaVerseText from '@/components/player/v2/PlayerContent/QuranView/SkiaVerseText';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {useMushafFontMgr} from '@/hooks/useMushafFontMgr';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import type {SkTypefaceFontProvider} from '@shopify/react-native-skia';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';
import {getReadingThemeById} from '@/constants/readingThemes';
import {
  ALLAH_NAME_HIGHLIGHT_OPTIONS,
  getAllahNameHighlightColorHex,
} from '@/constants/mushafAllahHighlight';
import {getRewayahShortLabel} from '@/utils/rewayahLabels';
import branding from '@/config/branding';
import {
  ALL_REWAYAH_IDS,
  getDescription,
  getLongLabel,
  hasDiffData,
  hasTextData,
  type RewayahWithDiffs,
} from '@/services/rewayah/RewayahIdentity';
import {getRewayahDiffLegend} from '@/components/sheets/rewayahDiffLegend'; // @ai
import {
  chooseMushafRenderer,
  chooseMushafRewayah,
} from '@/components/sheets/rewayahSelection'; // @ai
import {
  useMushafSettingsStore,
  getActualFontSize,
  getDisplayValue,
  DISPLAY_MIN,
  DISPLAY_MAX,
  REWAYAH_FALLBACK_RENDERER_LABEL, // @ai
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
  {
    value: 'qcf_v2',
    label: 'Mushaf 1440',
    description: 'Modern Madinah printed pipeline',
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
    showCommunityReflections,
    toggleWBW,
    toggleWBWTranslation,
    toggleWBWTransliteration,
    toggleAllahNameHighlight,
    toggleThemes,
    toggleCommunityReflections,
    lightThemeId,
    darkThemeId,
    rewayah,
    showRewayahDiffs,
    toggleRewayahDiffs,
    setAllahNameHighlightColor,
  } = useMushafSettingsStore();

  const verseKey = '1:1';
  const isQCF1440 = mushafRenderer === 'qcf_v2';
  const hafsOnlyFontDescription = `Hafs only. This font lacks marks used by ${getRewayahShortLabel(rewayah)}.`; // @ai
  // @ai-start
  // Tajweed colors are Hafs rules and are never drawn on another rewayah's
  // text, so the toggle only applies while reading Hafs.
  const hafsOnlyTajweedDescription = `Hafs only. Not shown for ${getRewayahShortLabel(rewayah)}.`;
  // @ai-end
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
  const subscribedFontMgr = useMushafFontMgr();
  const fontMgr =
    mushafPreloadService.initialized && digitalKhattDataService.initialized
      ? subscribedFontMgr
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

  // @ai-start
  // Mushaf 1440 is Hafs only. chooseMushafRenderer (rewayahSelection.ts)
  // switches the data service to Hafs before the store pins it, overtaking a
  // rewayah switch that is still loading, and keeps the font and rewayah
  // (with a toast) when Hafs cannot be loaded. It reads the store when
  // tapped, so a stale render cannot skip that switch.
  const handleFontSelect = useCallback(async (value: MushafRenderer) => {
    const switchingToQCF =
      value === 'qcf_v2' &&
      useMushafSettingsStore.getState().mushafRenderer !== 'qcf_v2';
    const outcome = await chooseMushafRenderer(value);
    if (switchingToQCF && outcome.kind === 'switched') {
      Alert.alert(
        'Mushaf 1440 Beta',
        `Mushaf 1440 is ${branding.appName}’s most modern mushaf pipeline, but it is still in beta. Some features are currently disabled, including tajweed coloring and rewayah switching.`,
      );
    }
  }, []);
  // @ai-end

  // @ai-start
  // Loads the new words DB before the store changes (so React re-renders with
  // the right text and layout in place), ignores taps a newer tap overtook,
  // and on a failure keeps the store on the rewayah the data service still
  // serves and says so (components/sheets/rewayahSelection.ts). Rewayat
  // without bundled text are refused there too.
  const handleRewayahSelect = useCallback(async (value: RewayahId) => {
    await chooseMushafRewayah(value);
  }, []);
  // @ai-end

  return (
    <View style={[styles.container, containerStyle]}>
      {showTitle && <Text style={styles.title}>Mushaf Settings</Text>}
      {/* @ai-start */}
      <RewayahFallbackBanner />
      {/* @ai-end */}

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
              : (getReadingThemeById(
                  themeMode === 'light' ? lightThemeId : darkThemeId,
                )?.name ?? 'System')}
          </Text>
          <Feather
            name="chevron-right"
            size={moderateScale(18)}
            color={Color(theme.colors.text).alpha(0.2).toString()}
          />
        </Pressable>
      </View>

      {/* Word by Word Section; only in list view */}
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

      <Text style={styles.sectionHeader}>DIVINE NAMES</Text>
      <View style={styles.card}>
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Highlight Allah / Rabb</Text>
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
          Highlights Allah&apos;s name and divine title forms like Rabb in the
          mushaf.
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

      {/* RFC-018 — COMMUNITY REFLECTIONS toggle. Gated on BOTH the provider and
          the inline render slot: the helper text promises the under-each-ayah
          display, which only `ayahCommunityReflectionsComponent` provides. A
          fork that ships only a provider (action-sheet surface, no inline slot)
          gets no toggle whose description does nothing; Bayaan wires neither,
          so it shows no orphan toggle. */}
      {branding.communityReflectionsProvider != null &&
        branding.ayahCommunityReflectionsComponent != null && (
          <View style={styles.card}>
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Community Reflections</Text>
              <Switch
                trackColor={trackColor}
                thumbColor="#FFFFFF"
                ios_backgroundColor={trackColor.false}
                onValueChange={toggleCommunityReflections}
                value={showCommunityReflections}
                style={styles.switchStyle}
              />
            </View>
            <Text style={styles.helperText}>
              Show community reflections under each ayah in list view
            </Text>
          </View>
        )}

      {/* FONT Section */}
      <Text style={styles.sectionHeader}>FONT</Text>
      <View style={styles.card}>
        {/* Tajweed Toggle */}
        <View style={styles.tajweedOptionRow}>
          <View style={styles.tajweedLabelContainer}>
            <Text style={styles.tajweedLabel}>Tajweed Coloring</Text>
            <Text style={styles.tajweedSubLabel}>
              {isQCF1440
                ? 'Unavailable in Mushaf 1440 beta'
                : rewayah !== 'hafs'
                  ? hafsOnlyTajweedDescription // @ai
                  : 'Highlight rules with colors'}
            </Text>
          </View>
          <TajweedToggle
            value={showTajweed}
            onValueChange={toggleTajweed}
            theme={theme}
            disabled={isQCF1440}
          />
        </View>
        <View style={styles.divider} />
      </View>
      <View style={styles.card}>
        {FONT_OPTIONS.map((option, idx) => {
          const isSelected = mushafRenderer === option.value;
          // IndoPak's font lacks marks every non-Hafs rewayah uses, so it is
          // offered for Hafs only (Mushaf 1440 stays selectable: choosing it
          // returns the reader to Hafs).
          const isHafsOnly =
            option.value === 'dk_indopak' && rewayah !== 'hafs'; // @ai
          return (
            <React.Fragment key={option.value}>
              {idx > 0 && <View style={styles.divider} />}
              <Pressable
                style={({pressed}) => [
                  styles.radioRow,
                  pressed && styles.radioRowPressed,
                  isHafsOnly && styles.radioRowDisabled, // @ai
                ]}
                disabled={isHafsOnly} // @ai
                accessibilityRole="radio" // @ai
                accessibilityState={{
                  selected: isSelected,
                  disabled: isHafsOnly,
                }} // @ai
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
                    {isHafsOnly ? hafsOnlyFontDescription : option.description}
                  </Text>
                </View>
              </Pressable>
            </React.Fragment>
          );
        })}
      </View>

      {/* REWAYAH Section; picker collapses by default behind the currently
          selected rewayah; the diff toggle sits above it so it's reachable
          without scrolling past 20 radio options. */}
      <Text style={styles.sectionHeader}>REWAYAH</Text>
      {isQCF1440 ? (
        <View style={styles.card}>
          <Text style={styles.helperText}>
            Rewayah switching is disabled in Mushaf 1440 beta.
          </Text>
        </View>
      ) : (
        hasDiffData(rewayah) && (
          <RewayahDiffCard
            rewayah={rewayah}
            showRewayahDiffs={showRewayahDiffs}
            toggleRewayahDiffs={toggleRewayahDiffs}
            trackColor={trackColor}
            styles={styles}
            theme={theme}
          />
        )
      )}
      {/* @ai-start */}
      {mushafRenderer === 'dk_indopak' && (
        <Text style={styles.helperText}>
          IndoPak shows Hafs only. Choosing another rewayah switches the font to{' '}
          {REWAYAH_FALLBACK_RENDERER_LABEL}.
        </Text>
      )}
      {/* @ai-end */}
      <RewayahAccordion
        selectedId={rewayah}
        onSelect={value => {
          // @ai-start
          // Mushaf 1440 pins the text to Hafs and the store refuses another
          // rewayah, so a row left expanded across a renderer switch must not
          // move the data service on its own.
          if (isQCF1440) return;
          // @ai-end
          handleRewayahSelect(value);
        }}
        styles={styles}
        theme={theme}
        disabled={isQCF1440}
      />
    </View>
  );
};

// @ai-start
interface RewayahFallbackBannerProps {
  style?: StyleProp<ViewStyle>;
}

/**
 * Shown while Hafs stands in for a saved rewayah that could not be loaded at
 * startup (settings store `rewayahFallbackFrom`): says so and offers a retry
 * or keeping Hafs. Renders nothing otherwise. Self-contained, so a screen
 * other than these settings (the mushaf) can show it too.
 */
export const RewayahFallbackBanner: React.FC<RewayahFallbackBannerProps> = ({
  style,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createFallbackBannerStyles(theme), [theme]);
  const failedRewayah = useMushafSettingsStore(s => s.rewayahFallbackFrom);
  const [busy, setBusy] = useState(false);

  const choose = useCallback(
    async (value: RewayahId) => {
      if (busy) return;
      setBusy(true);
      try {
        await chooseMushafRewayah(value);
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  if (!failedRewayah) return null;
  const label = getRewayahShortLabel(failedRewayah);
  return (
    <View style={[styles.banner, style]} accessibilityRole="alert">
      <View style={styles.titleRow}>
        <Feather
          name="alert-circle"
          size={moderateScale(16)}
          color={Color(theme.colors.text).alpha(0.75).toString()}
        />
        <Text style={styles.title}>Couldn&apos;t load {label}</Text>
      </View>
      <Text style={styles.body}>
        Hafs is shown instead. {label} stays your rewayah and is tried again the
        next time the app opens.
      </Text>
      <View style={styles.actions}>
        <Pressable
          onPress={() => choose(failedRewayah)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Try loading ${label} again`}
          accessibilityState={{disabled: busy, busy}}
          hitSlop={6}
          style={({pressed}) => [
            styles.button,
            styles.primaryButton,
            (pressed || busy) && styles.buttonPressed,
          ]}>
          {busy ? (
            <ActivityIndicator
              size="small"
              color={theme.colors.textSecondary}
            />
          ) : (
            <Text style={styles.buttonText}>Try again</Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => choose('hafs')}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Keep reading Hafs"
          accessibilityState={{disabled: busy}}
          hitSlop={6}
          style={({pressed}) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}>
          <Text style={styles.buttonText}>Keep Hafs</Text>
        </Pressable>
      </View>
    </View>
  );
};

const createFallbackBannerStyles = (theme: Theme) =>
  StyleSheet.create({
    banner: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.12).toString(),
      borderRadius: moderateScale(14),
      paddingHorizontal: moderateScale(14),
      paddingVertical: verticalScale(12),
      marginBottom: verticalScale(16),
      gap: verticalScale(6),
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(8),
    },
    title: {
      flex: 1,
      fontSize: moderateScale(13.5),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    body: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.text).alpha(0.7).toString(),
      lineHeight: moderateScale(17),
    },
    actions: {
      flexDirection: 'row',
      gap: moderateScale(10),
      marginTop: verticalScale(4),
    },
    button: {
      minWidth: moderateScale(88),
      minHeight: moderateScale(30),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: moderateScale(14),
      paddingVertical: verticalScale(6),
      borderRadius: moderateScale(8),
      backgroundColor: Color(theme.colors.text).alpha(0.05).toString(),
    },
    primaryButton: {
      backgroundColor: Color(theme.colors.text).alpha(0.12).toString(),
    },
    buttonPressed: {
      opacity: 0.7,
    },
    buttonText: {
      fontSize: moderateScale(12.5),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
  });
// @ai-end

interface RewayahAccordionProps {
  selectedId: RewayahId;
  onSelect: (id: RewayahId) => void;
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
  disabled?: boolean;
}

const RewayahAccordion: React.FC<RewayahAccordionProps> = ({
  selectedId,
  onSelect,
  styles,
  theme,
  disabled = false,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.card}>
      <Pressable
        style={({pressed}) => [
          styles.settingRow,
          pressed && styles.settingRowPressed,
          disabled && styles.radioRowDisabled,
        ]}
        accessibilityRole="button"
        accessibilityState={{expanded, disabled}}
        accessibilityLabel={`Rewayah: ${getLongLabel(selectedId)}. ${expanded ? 'Collapse' : 'Expand'} to change.`}
        disabled={disabled}
        onPress={() => setExpanded(e => !e)}>
        <View style={styles.radioTextContainer}>
          <Text style={styles.accordionHeaderEyebrow}>Currently reading</Text>
          <Text style={styles.accordionHeaderTitle}>
            {getLongLabel(selectedId)}
          </Text>
        </View>
        <Feather
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={moderateScale(18)}
          color={Color(theme.colors.text).alpha(0.4).toString()}
        />
      </Pressable>
      {expanded && (
        <>
          <View style={styles.divider} />
          {AVAILABLE_REWAYAH_IDS.map((id, idx) => {
            const isSelected = selectedId === id;
            return (
              <React.Fragment key={id}>
                {idx > 0 && <View style={styles.divider} />}
                <Pressable
                  style={({pressed}) => [
                    styles.radioRow,
                    pressed && styles.radioRowPressed,
                  ]}
                  onPress={() => onSelect(id)}>
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
                      {getLongLabel(id)}
                    </Text>
                    <Text style={styles.radioDescription}>
                      {getDescription(id)}
                    </Text>
                  </View>
                </Pressable>
              </React.Fragment>
            );
          })}
          <View style={styles.divider} />
          <Text style={styles.accordionSubHeader}>
            TEXT PREVIEW NOT YET AVAILABLE
          </Text>
          {UNAVAILABLE_REWAYAH_IDS.map((id, idx) => (
            <React.Fragment key={id}>
              {idx > 0 && <View style={styles.divider} />}
              <View
                style={[styles.radioRow, styles.radioRowDisabled]}
                accessibilityRole="text"
                accessibilityLabel={`${getLongLabel(id)}, text preview not yet available`}>
                <View style={styles.radioCircle} />
                <View style={styles.radioTextContainer}>
                  <Text style={[styles.radioLabel, styles.radioLabelDisabled]}>
                    {getLongLabel(id)}
                  </Text>
                  <Text style={styles.radioDescription}>
                    {getDescription(id)}
                  </Text>
                </View>
              </View>
            </React.Fragment>
          ))}
        </>
      )}
    </View>
  );
};

interface RewayahDiffCardProps {
  rewayah: RewayahWithDiffs;
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
  const legend = useMemo(() => getRewayahDiffLegend(rewayah), [rewayah]); // @ai

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
      {/* @ai-start */}
      {legend.entries.length > 0 && <View style={styles.divider} />}
      {legend.entries.length > 0 && (
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
      )}
      {/* @ai-end */}
      {showLegend && legend.entries.length > 0 && (
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

// The mushaf-settings picker is generated from ALL_REWAYAH_IDS. IDs with
// bundled DK text data render in the top section and are selectable; the
// remaining taxonomy-only entries render below under a "Text preview not
// yet available" subheading, dimmed and not tappable; they advertise the
// full catalog without letting the user pick one that would throw from
// DigitalKhattDataService.requireRewayahAssets. Labels and descriptions
// come from RewayahIdentity so all copy has one source of truth.
const AVAILABLE_REWAYAH_IDS: readonly RewayahId[] =
  ALL_REWAYAH_IDS.filter(hasTextData);
const UNAVAILABLE_REWAYAH_IDS: readonly RewayahId[] = ALL_REWAYAH_IDS.filter(
  id => !hasTextData(id),
);

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
    radioRowDisabled: {
      opacity: 0.45,
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
    radioLabelDisabled: {
      color: Color(theme.colors.text).alpha(0.6).toString(),
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

    // --- Rewayah accordion styles ---
    accordionHeaderEyebrow: {
      fontSize: moderateScale(10.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: verticalScale(2),
    },
    accordionHeaderTitle: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    accordionSubHeader: {
      fontSize: moderateScale(10.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      paddingTop: verticalScale(12),
      paddingBottom: verticalScale(6),
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
