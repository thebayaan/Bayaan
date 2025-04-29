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
  sampleText: string;
  sampleFontFamily?: string;
}

const FontSizeControl: React.FC<FontSizeControlProps> = ({
  label,
  currentActualSize,
  onChange,
  theme,
  styles,
  sampleText,
  sampleFontFamily,
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
      {/* Sample Text Display - uses actual size */}
      <Text
        style={[
          styles.sampleText,
          sampleFontFamily === 'Uthmani' ? styles.arabicSampleText : {},
          {
            fontSize: moderateScale(currentActualSize),
            color: theme.colors.text,
          },
          sampleFontFamily ? {fontFamily: sampleFontFamily} : {},
        ]}>
        {sampleText}
      </Text>
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

  // Define the handle component prop, passing theme and styles
  const handleComponent = React.useCallback(
    (props: BottomSheetHandleProps) => (
      <CustomHandle {...props} theme={theme} styles={styles} />
    ),
    [theme, styles],
  );

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

        {/* Arabic Text Section (Moved to Top) */}
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
            sampleText="هَٰذَا بَيَانٌ لِّلنَّاسِ وَهُدًى وَمَوْعِظَةٌ لِّلْمُتَّقِينَ ١٣٨"
            sampleFontFamily="Uthmani"
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
          {/* Add Font Size Control */}
          {showTransliteration && (
            <>
              <View style={styles.divider} />
              <FontSizeControl
                label="Font Size"
                currentActualSize={transliterationFontSize}
                onChange={onTransliterationFontSizeChange}
                theme={theme}
                styles={styles}
                sampleText="Hādhā bayānul lin-nāsi wa hudaw wa maw'iẓatul lil-muttaqīn"
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
          {/* Add Translation Source Text Here */}
          <Text style={styles.sourceText}>
            Using: The Clear Quran by Dr. Mustafa Khattab
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
                sampleText="This is a clear statement for ˹all˺ people, and a guidance and advice for the God-fearing."
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
    sampleText: {
      marginTop: verticalScale(5),
      paddingVertical: verticalScale(10),
      paddingHorizontal: moderateScale(8),
      borderRadius: moderateScale(6),
      overflow: 'hidden',
      textAlign: 'center',
      opacity: 0.8,
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
    },
    sourceText: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      marginTop: verticalScale(4),
      marginBottom: verticalScale(8),
      paddingHorizontal: moderateScale(16),
    },
  });
