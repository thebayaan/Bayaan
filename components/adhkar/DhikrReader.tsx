import React, {useCallback, useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Share,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {AdhkarAudioControls} from './AdhkarAudioControls';
import {useAdhkarSettingsStore} from '@/store/adhkarSettingsStore';
import {Dhikr} from '@/types/adhkar';
import {adhkarCopyText, adhkarTranslationCopyText} from '@/utils/adhkarText';
import {AdhkarArabicText} from './AdhkarArabicText';
import {AdhkarLatinText} from './AdhkarLatinText';
// @ai-start
import {useTranslation} from 'react-i18next';
import {isRTL} from '@/utils/rtl';
import {showSheet} from '@/components/sheets/sheetControl'; // @ai
// @ai-end

// Enable LayoutAnimation for Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface DhikrReaderProps {
  dhikr: Dhikr;
  isSaved: boolean;
  onSaveToggle: () => void;
}

// @ai-start
export const DhikrReader: React.FC<DhikrReaderProps> = ({
  dhikr,
  isSaved,
  onSaveToggle,
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation('player');
  const [showInstruction, setShowInstruction] = useState(false);

  // Lazy load audio controls after first paint for better performance
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    // Defer audio controls rendering until after first paint
    const timer = requestAnimationFrame(() => {
      setShowControls(true);
    });
    return () => cancelAnimationFrame(timer);
  }, []);

  // Settings from store
  const {
    showTranslation,
    showTransliteration,
    arabicFontSize,
    translationFontSize,
    transliterationFontSize,
  } = useAdhkarSettingsStore();

  const styles = createStyles(theme, {
    arabicFontSize,
    translationFontSize,
    transliterationFontSize,
  });

  const toggleInstruction = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowInstruction(prev => !prev);
  }, []);

  const handleOpenCopyOptions = useCallback(() => {
    showSheet('adhkar-copy-options', {payload: {dhikr}});
  }, [dhikr]);

  const handleOpenSettings = useCallback(() => {
    showSheet('adhkar-layout');
  }, []);

  const handleShare = useCallback(async () => {
    const content = [
      adhkarCopyText(dhikr.arabic),
      showTranslation && dhikr.translation
        ? `\n\n${adhkarTranslationCopyText(dhikr.translation)}`
        : '',
      showTransliteration && dhikr.transliteration
        ? `\n\n${adhkarCopyText(dhikr.transliteration)}`
        : '',
      dhikr.instruction ? `\n\n${dhikr.instruction}` : '',
    ].join('');

    await Share.share({
      message: content,
    });
  }, [dhikr, showTranslation, showTransliteration]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>
        {/* Repeat Count Badge - shown at top if repeatCount > 1 */}
        {dhikr.repeatCount > 1 ? (
          <View style={styles.repeatBadgeContainer}>
            <View style={styles.repeatBadge}>
              <Text style={styles.repeatBadgeText}>
                {t('adhkar.reciteTimes', {count: dhikr.repeatCount})}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Arabic Text */}
        {dhikr.arabic ? (
          <View style={styles.arabicSection}>
            <AdhkarArabicText
              dhikrId={dhikr.id}
              arabic={dhikr.arabic}
              fontSize={moderateScale(arabicFontSize)}
              style={styles.arabicText}
              horizontalPadding={moderateScale(8)}
            />
          </View>
        ) : null}

        {/* Audio Controls with action buttons - lazy loaded for performance */}
        {showControls && (
          <View style={styles.audioSection}>
            <AdhkarAudioControls
              dhikrId={dhikr.id}
              audioFile={dhikr.audioFile}
              onCopy={handleOpenCopyOptions}
              onBookmark={onSaveToggle}
              onShare={handleShare}
              onSettings={handleOpenSettings}
              isBookmarked={isSaved}
            />
          </View>
        )}

        {/* Divider */}
        {showTranslation && dhikr.translation ? (
          <View style={styles.divider} />
        ) : null}

        {/* Translation */}
        {showTranslation && dhikr.translation ? (
          <View style={styles.translationSection}>
            <AdhkarLatinText
              text={dhikr.translation}
              variant="translation"
              fontSize={moderateScale(translationFontSize)}
              color={theme.colors.textSecondary}
              style={styles.translationText}
            />
          </View>
        ) : null}

        {/* Divider */}
        {showTransliteration && dhikr.transliteration ? (
          <View style={styles.divider} />
        ) : null}

        {/* Transliteration */}
        {showTransliteration && dhikr.transliteration ? (
          <View style={styles.transliterationSection}>
            <AdhkarLatinText
              text={dhikr.transliteration}
              variant="transliteration"
              fontSize={moderateScale(transliterationFontSize)}
              color={transliterationColor(theme)}
              style={styles.transliterationText}
            />
          </View>
        ) : null}

        {/* Instruction Toggle */}
        {dhikr.instruction ? (
          <View style={styles.instructionSection}>
            <TouchableOpacity
              style={styles.instructionToggle}
              onPress={toggleInstruction}
              activeOpacity={1}
              accessibilityRole="button"
              accessibilityLabel={
                showInstruction
                  ? t('adhkar.a11y.hideInstruction')
                  : t('adhkar.a11y.showInstruction')
              }>
              <View style={styles.instructionToggleContent}>
                <Feather
                  name="info"
                  size={moderateScale(16)}
                  color={theme.colors.textSecondary}
                />
                <Text style={styles.instructionToggleText}>
                  {showInstruction
                    ? t('adhkar.hideInfo')
                    : t('adhkar.showInfo')}
                </Text>
              </View>
              <Feather
                name={showInstruction ? 'chevron-up' : 'chevron-down'}
                size={moderateScale(18)}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>

            {showInstruction ? (
              <View style={styles.instructionContent}>
                <Text style={styles.instructionText}>{dhikr.instruction}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Bottom padding */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};
// @ai-end

DhikrReader.displayName = 'DhikrReader';

const transliterationColor = (theme: Theme) =>
  Color(theme.colors.textSecondary).alpha(0.7).toString();

// Secondary background color used throughout
const getSecondaryBg = (theme: Theme) =>
  Color(theme.colors.textSecondary).alpha(0.1).toString();

interface FontSizes {
  arabicFontSize: number;
  translationFontSize: number;
  transliterationFontSize: number;
}

// @ai-start
const createStyles = (theme: Theme, fontSizes?: FontSizes) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      padding: moderateScale(16),
    },
    repeatBadgeContainer: {
      alignItems: 'center',
      marginBottom: moderateScale(16),
    },
    repeatBadge: {
      backgroundColor: getSecondaryBg(theme),
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(8),
      borderRadius: moderateScale(20),
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.15).toString(),
    },
    repeatBadgeText: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.textSecondary,
    },
    arabicSection: {
      alignItems: 'center',
      marginBottom: moderateScale(16),
    },
    arabicText: {
      fontSize: moderateScale(fontSizes?.arabicFontSize ?? 28),
      fontFamily: 'ScheherazadeNew-Regular',
      color: theme.colors.text,
      // RN swaps left/right alignment in RTL; keep Arabic text physically right.
      textAlign: isRTL ? 'left' : 'right',
      writingDirection: 'rtl',
      lineHeight: moderateScale((fontSizes?.arabicFontSize ?? 28) * 1.8),
      paddingHorizontal: moderateScale(8),
    },
    audioSection: {
      marginTop: moderateScale(4),
      marginBottom: moderateScale(8),
    },
    divider: {
      height: 1,
      backgroundColor: Color(theme.colors.border).alpha(0.3).toString(),
      marginVertical: moderateScale(20),
    },
    translationSection: {
      marginBottom: moderateScale(8),
    },
    translationText: {
      fontSize: moderateScale(fontSizes?.translationFontSize ?? 16),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
      lineHeight: moderateScale((fontSizes?.translationFontSize ?? 16) * 1.6),
      textAlign: 'left',
    },
    transliterationSection: {
      marginBottom: moderateScale(8),
    },
    transliterationText: {
      fontSize: moderateScale(fontSizes?.transliterationFontSize ?? 15),
      fontFamily: theme.fonts.light,
      fontStyle: 'italic',
      color: transliterationColor(theme),
      lineHeight: moderateScale(
        (fontSizes?.transliterationFontSize ?? 15) * 1.6,
      ),
      textAlign: 'left',
    },
    instructionSection: {
      marginTop: moderateScale(20),
    },
    instructionToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: moderateScale(12),
      paddingHorizontal: moderateScale(14),
      backgroundColor: getSecondaryBg(theme),
      borderRadius: moderateScale(12),
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    instructionToggleContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(8),
    },
    instructionToggleText: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.medium,
      color: theme.colors.textSecondary,
    },
    instructionContent: {
      marginTop: moderateScale(12),
      padding: moderateScale(14),
      backgroundColor: getSecondaryBg(theme),
      borderRadius: moderateScale(12),
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    instructionText: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.regular,
      color: theme.colors.text,
      lineHeight: moderateScale(22),
    },
    bottomSpacer: {
      height: moderateScale(40),
    },
  });
// @ai-end
