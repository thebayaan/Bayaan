import React, {useMemo} from 'react';
import {View, Text, StyleSheet, Switch, TouchableOpacity} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {Icon} from '@rneui/themed';
import {useTajweedStore} from '@/store/tajweedStore';
import {QuranData} from '@/types/quran';
import FormattedTextRenderer from '@/components/utils/FormattedText';
import {GRADIENT_COLORS} from '@/utils/gradientColors';
import {LinearGradient} from 'expo-linear-gradient';
import {
  useMushafSettingsStore,
  getActualFontSize,
  getDisplayValue,
  DISPLAY_MIN,
  DISPLAY_MAX,
} from '@/store/mushafSettingsStore';

// Import Quran data
const quranData = require('@/data/quran.json') as QuranData;

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

// Define colors for Tajweed rules
const tajweedColors: {[key: string]: string} = {
  madda_necessary: '#DD0000',
  madda_obligatory_mottasel: '#FF00FF',
  madda_obligatory_monfasel: '#FF00FF',
  madda_permissible: '#FF7F00',
  madda_normal: '#DDAA00',
  'custom-alef-maksora': '#DDAA00',
  ghunnah: '#00CC00',
  idgham_ghunnah: '#00CC00',
  idgham_shafawi: '#00CC00',
  ikhafa: '#00CC00',
  ikhafa_shafawi: '#00CC00',
  iqlab: '#00CC00',
  qalaqah: '#66CCFF',
  idgham_mutajanisayn: '#0066FF',
  idgham_mutaqaribayn: '#0066FF',
  idgham_wo_ghunnah: '#0066FF',
  slnt: '#AAAAAA',
  ham_wasl: '#AAAAAA',
  laam_shamsiyah: '#AAAAAA',
};

// Simplified segment structure for the sample text
interface TajweedSampleSegment {
  text: string;
  rule: string | null;
}

// Internal reusable component for font size control
interface FontSizeControlProps {
  label: string;
  currentActualSize: number; // Actual size
  onChange: (newActualSize: number) => void; // Pass actual size
  theme: Theme;
  styles: ReturnType<typeof createStyles>;
  sampleText?: string; // Plain text for non-tajweed rendering
  processedSampleSegments?: TajweedSampleSegment[]; // Segments for tajweed rendering
  sampleFontFamily?: string;
  showTajweed?: boolean; // Add state to control rendering mode
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
}) => {
  // Calculate current display value (1-10) from actual size
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

  // Determine if this control is for Arabic text
  const isArabic = sampleFontFamily === 'QPC';

  // Memoize the rendered sample text JSX to avoid re-calculating on every render
  const memoizedSampleText = React.useMemo(() => {
    // Create sampleBaseStyle inside useMemo
    const sampleBaseStyle = {
      fontSize: moderateScale(currentActualSize),
      color: theme.colors.text,
      fontFamily: sampleFontFamily || 'Manrope-Regular', // Default font
    };

    if (isArabic) {
      // Render Arabic text (either segmented or plain)
      return (
        <Text
          style={[
            styles.sampleTextBase,
            styles.arabicSampleText,
            sampleBaseStyle,
          ]}>
          {processedSampleSegments
            ? processedSampleSegments.map((segment, index) => {
                const color =
                  showTajweed && segment.rule
                    ? tajweedColors[segment.rule] || theme.colors.text
                    : theme.colors.text;
                return (
                  <Text key={`sample-${index}`} style={{color}}>
                    {segment.text}
                  </Text>
                );
              })
            : sampleText}
        </Text>
      );
    } else if (sampleText) {
      // Render Translation/Transliteration with formatting
      return (
        <FormattedTextRenderer text={sampleText} baseStyle={sampleBaseStyle} />
      );
    } else {
      return null;
    }
  }, [
    isArabic,
    processedSampleSegments,
    sampleText,
    showTajweed,
    currentActualSize,
    theme.colors.text,
    styles.sampleTextBase,
    styles.arabicSampleText,
    sampleFontFamily,
  ]);

  return (
    <View>
      <View style={styles.fontSizeControlRow}>
        <Text style={styles.optionLabel}>{label}</Text>
        <View style={styles.fontSizeAdjuster}>
          <TouchableOpacity
            onPress={handleDecrement}
            hitSlop={10}
            disabled={currentDisplayValue <= DISPLAY_MIN}>
            <Icon
              name="minus"
              type="feather"
              size={moderateScale(18)}
              color={
                currentDisplayValue <= DISPLAY_MIN
                  ? theme.colors.textSecondary
                  : theme.colors.text
              }
            />
          </TouchableOpacity>
          <Text style={styles.fontSizeValue}>{currentDisplayValue}</Text>
          <TouchableOpacity
            onPress={handleIncrement}
            hitSlop={10}
            disabled={currentDisplayValue >= DISPLAY_MAX}>
            <Icon
              name="plus"
              type="feather"
              size={moderateScale(18)}
              color={
                currentDisplayValue >= DISPLAY_MAX
                  ? theme.colors.textSecondary
                  : theme.colors.text
              }
            />
          </TouchableOpacity>
        </View>
      </View>
      {/* Sample Text Display - Use the memoized JSX */}
      <View
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
}

const TajweedToggle: React.FC<TajweedToggleProps> = ({
  value,
  onValueChange,
  theme,
}) => {
  // Use memoized static arrays to prevent recalculations on each render
  const coloredGradient = React.useMemo(
    () =>
      [
        GRADIENT_COLORS[0], // Purple
        GRADIENT_COLORS[2], // Emerald
        GRADIENT_COLORS[3], // Red
        GRADIENT_COLORS[4], // Orange
        GRADIENT_COLORS[7], // Indigo
      ] as const,
    [],
  );

  const monochromeGradient = React.useMemo(
    () =>
      [
        Color(theme.colors.textSecondary).alpha(0.2).toString(),
        Color(theme.colors.textSecondary).alpha(0.1).toString(),
      ] as const,
    [theme.colors.textSecondary],
  );

  // Simply select which array to use rather than recreating on each render
  const gradientColors = value ? coloredGradient : monochromeGradient;

  // Create styles inline since we can't access the StyleSheet yet
  const toggleStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Color(theme.colors.backgroundSecondary)
      .alpha(0.4)
      .toString(),
    borderRadius: moderateScale(16),
    padding: moderateScale(4),
    paddingHorizontal: moderateScale(8),
    overflow: 'hidden',
  } as const;

  const barStyle = {
    height: moderateScale(8),
    width: moderateScale(50),
    borderRadius: moderateScale(4),
    marginRight: moderateScale(6),
  } as const;

  const textContainerStyle = {
    width: moderateScale(30), // Fixed width container
    alignItems: 'center' as const,
  };

  const textStyle = {
    fontSize: moderateScale(13),
    fontFamily: 'Manrope-SemiBold',
    color: value ? theme.colors.text : theme.colors.textSecondary,
  } as const;

  return (
    <TouchableOpacity onPress={onValueChange} style={toggleStyle}>
      {/* Color Bar - always visible but changes based on state */}
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

      {/* Fixed-width text container */}
      <View style={textContainerStyle}>
        <Text style={textStyle}>{value ? 'ON' : 'OFF'}</Text>
      </View>
    </TouchableOpacity>
  );
};

interface MushafSettingsContentProps {
  containerStyle?: object;
  showTitle?: boolean;
}

export const MushafSettingsContent: React.FC<MushafSettingsContentProps> = ({
  containerStyle,
  showTitle = true,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {indexedTajweedData, isLoading: isTajweedLoading} = useTajweedStore();

  // Access settings from the store
  const {
    showTranslation,
    showTransliteration,
    showTajweed,
    arabicFontSize,
    translationFontSize,
    transliterationFontSize,
    toggleTranslation,
    toggleTransliteration,
    toggleTajweed,
    setArabicFontSize,
    setTranslationFontSize,
    setTransliterationFontSize,
  } = useMushafSettingsStore();

  const verseKey = '3:138'; // Target verse for examples

  // --- Fetch Actual Data for Verse 3:138 --- //
  const actualVerseText = useMemo(
    () => quranData[verseKey]?.text || 'Error loading verse',
    [],
  );

  const verseWords = useMemo(
    () => (indexedTajweedData ? indexedTajweedData[verseKey] : undefined),
    [indexedTajweedData],
  );

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

  // Create flat segments array for rendering inside a single Text
  const flatVerseSegments = useMemo(() => {
    if (!verseWords) return undefined;
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
  }, [verseWords]);
  // --- End Fetch Data --- //

  const trackColor = {
    false: Color(theme.colors.textSecondary).alpha(0.3).toString(),
    true: theme.colors.primary,
  };

  // Prepare props for Arabic FontSizeControl
  const arabicSegmentsToDisplay =
    !isTajweedLoading && flatVerseSegments ? flatVerseSegments : undefined;

  // Always have a text fallback if segments aren't available
  const sampleText = actualVerseText || 'Error loading verse';

  return (
    <View style={[styles.container, containerStyle]}>
      {showTitle && <Text style={styles.title}>Mushaf Layout</Text>}

      {/* Arabic Text Section */}
      <Text style={styles.sectionHeader}>Arabic Text</Text>
      <View style={styles.card}>
        <View style={styles.tajweedOptionRow}>
          <View style={styles.tajweedLabelContainer}>
            <Text style={styles.tajweedLabel}>Tajweed Coloring</Text>
            <Text style={styles.tajweedSubLabel}>
              Highlight pronunciation rules with colors
            </Text>
          </View>
          <TajweedToggle
            value={showTajweed}
            onValueChange={toggleTajweed}
            theme={theme}
          />
        </View>
        <View style={styles.divider} />
        <FontSizeControl
          label="Font Size"
          currentActualSize={arabicFontSize}
          onChange={setArabicFontSize}
          theme={theme}
          styles={styles}
          processedSampleSegments={arabicSegmentsToDisplay}
          sampleText={sampleText}
          sampleFontFamily="QPC"
          showTajweed={showTajweed}
        />
      </View>

      {/* Transliteration Section */}
      <Text style={styles.sectionHeader}>Transliteration</Text>
      <View style={styles.card}>
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Transliteration</Text>
          <Switch
            trackColor={trackColor}
            thumbColor={theme.colors.card}
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

      {/* Translation Section */}
      <Text style={styles.sectionHeader}>Translation</Text>
      <View style={styles.card}>
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Translation</Text>
          <Switch
            trackColor={trackColor}
            thumbColor={theme.colors.card}
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
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      padding: moderateScale(16),
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: moderateScale(12),
      paddingHorizontal: moderateScale(14),
      paddingVertical: verticalScale(5),
      marginBottom: verticalScale(16),
    },
    sectionHeader: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.textSecondary,
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
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.text,
      marginRight: moderateScale(10),
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginVertical: verticalScale(8),
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
    },
    fontSizeValue: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.text,
      marginHorizontal: moderateScale(10),
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
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      marginTop: verticalScale(4),
      marginBottom: verticalScale(8),
      paddingHorizontal: moderateScale(16),
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
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    tajweedSubLabel: {
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      marginTop: verticalScale(2),
    },
  });
