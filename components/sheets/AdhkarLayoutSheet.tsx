import React, {useMemo} from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  Switch,
  TouchableOpacity,
} from 'react-native';
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import ActionSheet, {SheetProps} from 'react-native-actions-sheet';
import Color from 'color';
import {Icon} from '@rneui/themed';
import {
  useAdhkarSettingsStore,
  getActualFontSize,
  getDisplayValue,
  DISPLAY_MIN,
  DISPLAY_MAX,
} from '@/store/adhkarSettingsStore';

const SCREEN_HEIGHT = Dimensions.get('window').height;

// Internal reusable component for font size control
interface FontSizeControlProps {
  label: string;
  currentActualSize: number;
  onChange: (newActualSize: number) => void;
  theme: Theme;
  styles: ReturnType<typeof createStyles>;
  sampleText: string;
  sampleFontFamily?: string;
  isArabic?: boolean;
}

const FontSizeControl: React.FC<FontSizeControlProps> = ({
  label,
  currentActualSize,
  onChange,
  theme,
  styles,
  sampleText,
  sampleFontFamily,
  isArabic = false,
}) => {
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

  const sampleBaseStyle = {
    fontSize: moderateScale(currentActualSize),
    color: theme.colors.text,
    fontFamily: sampleFontFamily || theme.fonts.regular,
  };

  return (
    <View>
      <View style={styles.fontSizeControlRow}>
        <Text style={styles.optionLabel}>{label}</Text>
        <View style={styles.fontSizeAdjuster}>
          <TouchableOpacity
            onPress={handleDecrement}
            activeOpacity={1}
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
            activeOpacity={1}
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
      <View
        style={[
          styles.sampleTextContainer,
          isArabic && styles.arabicSampleTextContainer,
        ]}>
        <Text
          style={[
            styles.sampleTextBase,
            sampleBaseStyle,
            isArabic && styles.arabicSampleText,
          ]}>
          {sampleText}
        </Text>
      </View>
    </View>
  );
};

export const AdhkarLayoutSheet = (props: SheetProps<'adhkar-layout'>) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {
    showTranslation,
    showTransliteration,
    arabicFontSize,
    translationFontSize,
    transliterationFontSize,
    toggleTranslation,
    toggleTransliteration,
    setArabicFontSize,
    setTranslationFontSize,
    setTransliterationFontSize,
  } = useAdhkarSettingsStore();

  const trackColor = {
    false: Color(theme.colors.textSecondary).alpha(0.3).toString(),
    true: theme.colors.text,
  };

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          <Text style={styles.title}>Adhkar Layout</Text>

          {/* Arabic Text Section */}
          <Text style={styles.sectionHeader}>Arabic Text</Text>
          <View style={styles.card}>
            <FontSizeControl
              label="Font Size"
              currentActualSize={arabicFontSize}
              onChange={setArabicFontSize}
              theme={theme}
              styles={styles}
              sampleText="بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ"
              sampleFontFamily="QPC"
              isArabic={true}
            />
          </View>

          {/* Translation Section */}
          <Text style={styles.sectionHeader}>Translation</Text>
          <View style={styles.card}>
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Show Translation</Text>
              <Switch
                trackColor={trackColor}
                thumbColor="#FFFFFF"
                ios_backgroundColor={trackColor.false}
                onValueChange={toggleTranslation}
                value={showTranslation}
                style={styles.switchStyle}
              />
            </View>
            {showTranslation ? (
              <>
                <View style={styles.divider} />
                <FontSizeControl
                  label="Font Size"
                  currentActualSize={translationFontSize}
                  onChange={setTranslationFontSize}
                  theme={theme}
                  styles={styles}
                  sampleText="In the name of Allah, the Most Gracious, the Most Merciful"
                />
              </>
            ) : null}
          </View>

          {/* Transliteration Section */}
          <Text style={styles.sectionHeader}>Transliteration</Text>
          <View style={styles.card}>
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Show Transliteration</Text>
              <Switch
                trackColor={trackColor}
                thumbColor="#FFFFFF"
                ios_backgroundColor={trackColor.false}
                onValueChange={toggleTransliteration}
                value={showTransliteration}
                style={styles.switchStyle}
              />
            </View>
            {showTransliteration ? (
              <>
                <View style={styles.divider} />
                <FontSizeControl
                  label="Font Size"
                  currentActualSize={transliterationFontSize}
                  onChange={setTransliterationFontSize}
                  theme={theme}
                  styles={styles}
                  sampleText="Bismillahir Rahmanir Raheem"
                />
              </>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </ActionSheet>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      paddingTop: moderateScale(8),
      height: SCREEN_HEIGHT * 0.6,
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: moderateScale(40),
    },
    container: {
      padding: moderateScale(16),
    },
    title: {
      fontSize: moderateScale(20),
      fontFamily: theme.fonts.bold,
      color: theme.colors.text,
      marginBottom: verticalScale(16),
      textAlign: 'center',
    },
    sectionHeader: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.textSecondary,
      marginBottom: verticalScale(8),
      marginLeft: moderateScale(4),
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: moderateScale(12),
      paddingHorizontal: moderateScale(14),
      paddingVertical: verticalScale(5),
      marginBottom: verticalScale(16),
    },
    optionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: verticalScale(8),
    },
    optionLabel: {
      fontSize: moderateScale(13),
      fontFamily: theme.fonts.medium,
      color: theme.colors.text,
      marginRight: moderateScale(10),
    },
    divider: {
      height: 1,
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
      fontFamily: theme.fonts.medium,
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
  });
