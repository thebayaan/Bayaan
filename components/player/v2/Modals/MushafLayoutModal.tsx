import React from 'react';
import {View, Text, StyleSheet, Switch, TouchableOpacity} from 'react-native';
import {
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetHandleProps,
} from '@gorhom/bottom-sheet';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import BottomSheet from '@gorhom/bottom-sheet';
import {Icon} from '@rneui/themed';
import {useTajweedStore} from '@/store/tajweedStore';
import {QuranData} from '@/types/quran';
import FormattedTextRenderer from '@/components/utils/FormattedText';

// Import Quran data
const quranData = require('@/data/quran.json') as QuranData;

// --- Pre-cache Translation/Transliteration Data --- //
interface TranslationItem {
  id: number;
  resource_id: number;
  text: string;
}

interface VerseTranslation {
  id: number;
  verse_key: string;
  verse_number: number;
  translations: TranslationItem[];
}

interface TransliterationData {
  [key: string]: {
    t: string;
  };
}

// Pre-load data outside component
let translationDataCache: VerseTranslation[] | null = null;
let transliterationDataCache: TransliterationData | null = null;

try {
  // Load Saheeh International translation
  const saheehInternationalData = require('@/data/SaheehInternational.translation-with-footnote-tags.json');

  // Process the Saheeh International data to match the expected format
  translationDataCache = Object.entries(saheehInternationalData).map(
    ([verseKey, verseData]: [string, any]) => {
      // Extract chapter and verse numbers from verse key (format: "1:1")
      const [chapterNum, verseNum] = verseKey.split(':').map(Number);

      return {
        id: parseInt(`${chapterNum}${verseNum.toString().padStart(3, '0')}`),
        verse_number: verseNum,
        verse_key: verseKey,
        chapter_number: chapterNum,
        translations: [
          {
            id: parseInt(
              `9${chapterNum}${verseNum.toString().padStart(3, '0')}`,
            ),
            resource_id: 190,
            text: verseData.t,
          },
        ],
      };
    },
  );

  transliterationDataCache = require('@/data/transliteration.json');
  console.log(
    '[MushafLayoutModal] Saheeh International translation/transliteration data pre-cached',
  );
} catch (error) {
  console.error('[MushafLayoutModal] Error pre-caching data:', error);
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

// Define CustomHandle outside the main component
interface CustomHandleProps extends BottomSheetHandleProps {
  theme: Theme;
  styles: ReturnType<typeof createStyles>;
}

const CustomHandle = ({theme, styles}: CustomHandleProps) => {
  return (
    <View style={styles.handleContainer}>
      <View
        style={[
          styles.handle,
          {backgroundColor: Color(theme.colors.text).alpha(0.2).toString()},
        ]}
      />
    </View>
  );
};

interface MushafLayoutModalProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
  showTranslation: boolean;
  toggleTranslation: () => void;
  showTransliteration: boolean;
  toggleTransliteration: () => void;
  showTajweed: boolean;
  toggleTajweed: () => void;
  transliterationFontSize: number;
  translationFontSize: number;
  onTransliterationFontSizeChange: (size: number) => void;
  onTranslationFontSizeChange: (size: number) => void;
  arabicFontSize: number;
  onArabicFontSizeChange: (size: number) => void;
}

// New Constants for Font Sizing
const DISPLAY_MIN = 1;
const DISPLAY_MAX = 10;
const ACTUAL_MIN_FONT_SIZE = 10;
const ACTUAL_FONT_STEP = 4; // Calculated step

// Internal reusable component for font size control
interface FontSizeControlProps {
  label: string;
  currentActualSize: number; // Renamed from currentSize
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
  const currentDisplayValue = Math.round(
    1 + (currentActualSize - ACTUAL_MIN_FONT_SIZE) / ACTUAL_FONT_STEP,
  );

  const handleDecrement = () => {
    const newDisplayValue = Math.max(DISPLAY_MIN, currentDisplayValue - 1);
    const newActualSize =
      ACTUAL_MIN_FONT_SIZE + (newDisplayValue - 1) * ACTUAL_FONT_STEP;
    onChange(newActualSize);
  };

  const handleIncrement = () => {
    const newDisplayValue = Math.min(DISPLAY_MAX, currentDisplayValue + 1);
    const newActualSize =
      ACTUAL_MIN_FONT_SIZE + (newDisplayValue - 1) * ACTUAL_FONT_STEP;
    onChange(newActualSize);
  };

  // Determine if this control is for Arabic text
  const isArabic = sampleFontFamily === 'QPC';

  // Base style for sample text, including dynamic font size and color
  const sampleBaseStyle = {
    fontSize: moderateScale(currentActualSize),
    color: theme.colors.text,
    fontFamily: sampleFontFamily || 'Manrope-Regular', // Default font
  };

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
      {/* Sample Text Display */}
      <View
        style={[
          styles.sampleTextContainer,
          isArabic && styles.arabicSampleTextContainer,
        ]}>
        {isArabic ? (
          // Arabic Text Rendering (Handles Tajweed)
          <Text
            style={[
              styles.sampleTextBase,
              styles.arabicSampleText,
              sampleBaseStyle,
            ]}>
            {showTajweed && processedSampleSegments
              ? processedSampleSegments.map((segment, index) => {
                  const color = segment.rule
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
        ) : // Translation/Transliteration Rendering (Handles Formatting)
        sampleText ? (
          <FormattedTextRenderer
            text={sampleText}
            baseStyle={sampleBaseStyle}
          />
        ) : null}
      </View>
    </View>
  );
};

export const MushafLayoutModal: React.FC<MushafLayoutModalProps> = ({
  bottomSheetRef,
  showTranslation,
  toggleTranslation,
  showTransliteration,
  toggleTransliteration,
  showTajweed,
  toggleTajweed,
  transliterationFontSize,
  translationFontSize,
  onTransliterationFontSizeChange,
  onTranslationFontSizeChange,
  arabicFontSize,
  onArabicFontSizeChange,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const {indexedTajweedData, isLoading: isTajweedLoading} = useTajweedStore();

  const verseKey = '3:138'; // Target verse

  // --- Fetch Actual Data for Verse 3:138 --- //
  const actualVerseText = React.useMemo(
    () => quranData[verseKey]?.text || 'Error loading verse',
    [], // No dependencies, quranData is constant
  );
  const verseWords = React.useMemo(
    () => (indexedTajweedData ? indexedTajweedData[verseKey] : undefined),
    [indexedTajweedData], // Depends on indexedTajweedData from store
  );
  const actualTranslationText = React.useMemo(() => {
    const translation = translationDataCache?.find(
      t => t.verse_key === verseKey,
    );
    return translation?.translations?.[0]?.text || 'Error loading translation';
  }, []); // Depends only on static pre-cached data

  const actualTransliterationText = React.useMemo(
    () =>
      transliterationDataCache?.[verseKey]?.t ||
      'Error loading transliteration',
    [], // Depends only on static pre-cached data
  );

  // Create flat segments array for rendering inside a single Text
  const flatVerseSegments = React.useMemo(() => {
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

  const snapPoints = React.useMemo(() => ['60%'], []);

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    [],
  );
  const handleComponent = React.useCallback(
    (props: BottomSheetHandleProps) => (
      <CustomHandle {...props} theme={theme} styles={styles} />
    ),
    [theme, styles],
  );

  // Prepare props for Arabic FontSizeControl
  const arabicSampleTextToDisplay = !showTajweed ? actualVerseText : undefined;
  const arabicSegmentsToDisplay =
    showTajweed && !isTajweedLoading && flatVerseSegments
      ? flatVerseSegments
      : undefined;
  const arabicFallbackText =
    showTajweed && (isTajweedLoading || !flatVerseSegments)
      ? 'Loading Tajweed...'
      : undefined;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose={true}
      backdropComponent={renderBackdrop}
      handleComponent={handleComponent} // Use the memoized handle component
      backgroundStyle={[
        styles.background,
        {backgroundColor: theme.colors.backgroundSecondary},
      ]}>
      <BottomSheetScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Mushaf Layout</Text>

        {/* Arabic Text Section */}
        <Text style={styles.sectionHeader}>Arabic Text</Text>
        <View style={styles.card}>
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Tajweed Coloring</Text>
            <Switch
              trackColor={trackColor}
              thumbColor={theme.colors.card}
              ios_backgroundColor={trackColor.false}
              onValueChange={toggleTajweed}
              value={showTajweed}
              style={styles.switchStyle}
            />
          </View>
          <View style={styles.divider} />
          <FontSizeControl
            label="Font Size"
            currentActualSize={arabicFontSize}
            onChange={onArabicFontSizeChange}
            theme={theme}
            styles={styles}
            processedSampleSegments={arabicSegmentsToDisplay}
            sampleText={arabicSampleTextToDisplay || arabicFallbackText}
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
                onChange={onTransliterationFontSizeChange}
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
                onChange={onTranslationFontSizeChange}
                theme={theme}
                styles={styles}
                sampleText={actualTranslationText}
                sampleFontFamily="Manrope-Regular"
              />
            </>
          )}
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    scrollContainer: {
      padding: moderateScale(16),
      paddingBottom: verticalScale(20),
      marginBottom: verticalScale(40),
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
      flex: 1,
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
    backdrop: {
      backgroundColor: 'black',
    },
    handleContainer: {
      paddingTop: 12,
      paddingBottom: 8,
      alignItems: 'center',
    },
    handle: {
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: Color(theme.colors.text).alpha(0.2).toString(),
    },
    title: {
      fontSize: moderateScale(20),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      marginBottom: verticalScale(16),
      textAlign: 'center',
    },
    background: {
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      backgroundColor: theme.colors.backgroundSecondary,
    },
    helperText: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      marginTop: verticalScale(4),
      marginBottom: verticalScale(8),
      paddingHorizontal: moderateScale(16),
    },
  });
