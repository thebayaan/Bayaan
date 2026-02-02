import React, {useCallback} from 'react';
import {View, Text, ScrollView, TouchableOpacity, Share} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import * as Clipboard from 'expo-clipboard';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {HeartIcon} from '@/components/Icons';
import {Dua} from '@/types/dua';

interface DuaReaderProps {
  dua: Dua;
  isFavorite: boolean;
  onFavoriteToggle: () => void;
}

export const DuaReader: React.FC<DuaReaderProps> = ({
  dua,
  isFavorite,
  onFavoriteToggle,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  const handleCopyArabic = useCallback(async () => {
    if (dua.arabic) {
      await Clipboard.setStringAsync(dua.arabic);
    }
  }, [dua.arabic]);

  const handleShare = useCallback(async () => {
    const content = [
      dua.arabic,
      dua.translation ? `\n\n${dua.translation}` : '',
      dua.transliteration ? `\n\n${dua.transliteration}` : '',
      dua.instruction ? `\n\n${dua.instruction}` : '',
    ].join('');

    await Share.share({
      message: content,
    });
  }, [dua]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}>
      {/* Header with favorite and share buttons */}
      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onFavoriteToggle}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
          accessibilityRole="button"
          accessibilityLabel={
            isFavorite ? 'Remove from favorites' : 'Add to favorites'
          }
          accessibilityState={{selected: isFavorite}}>
          <HeartIcon
            size={moderateScale(24)}
            color={
              isFavorite ? theme.colors.primary : theme.colors.textSecondary
            }
            filled={isFavorite}
          />
        </TouchableOpacity>
      </View>

      {/* Repeat Count Badge - shown at top if repeatCount > 1 */}
      {dua.repeatCount > 1 ? (
        <View style={styles.repeatBadgeContainer}>
          <View style={styles.repeatBadge}>
            <Text style={styles.repeatBadgeText}>
              Recite {dua.repeatCount} times
            </Text>
          </View>
        </View>
      ) : null}

      {/* Arabic Text */}
      {dua.arabic ? (
        <View style={styles.arabicSection}>
          <Text style={styles.arabicText}>{dua.arabic}</Text>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={handleCopyArabic}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
            accessibilityRole="button"
            accessibilityLabel="Copy Arabic text">
            <Text style={styles.copyButtonText}>Copy Arabic</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Divider */}
      {dua.arabic && dua.translation ? <View style={styles.divider} /> : null}

      {/* Translation */}
      {dua.translation ? (
        <View style={styles.translationSection}>
          <Text style={styles.translationText}>{dua.translation}</Text>
        </View>
      ) : null}

      {/* Divider */}
      {(dua.arabic || dua.translation) && dua.transliteration ? (
        <View style={styles.divider} />
      ) : null}

      {/* Transliteration */}
      {dua.transliteration ? (
        <View style={styles.transliterationSection}>
          <Text style={styles.transliterationText}>{dua.transliteration}</Text>
        </View>
      ) : null}

      {/* Instruction Card */}
      {dua.instruction ? (
        <View style={styles.instructionCard}>
          <View style={styles.instructionIconContainer}>
            <Text style={styles.instructionIcon}>i</Text>
          </View>
          <Text style={styles.instructionText}>{dua.instruction}</Text>
        </View>
      ) : null}

      {/* Share Button */}
      <TouchableOpacity
        style={styles.shareButton}
        onPress={handleShare}
        accessibilityRole="button"
        accessibilityLabel="Share dua">
        <Text style={styles.shareButtonText}>Share</Text>
      </TouchableOpacity>

      {/* Bottom padding for scrolling past audio controls if present */}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

DuaReader.displayName = 'DuaReader';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      padding: moderateScale(20),
    },
    headerActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginBottom: moderateScale(16),
    },
    actionButton: {
      padding: moderateScale(8),
      backgroundColor: Color(theme.colors.card).alpha(0.8).toString(),
      borderRadius: moderateScale(20),
    },
    repeatBadgeContainer: {
      alignItems: 'center',
      marginBottom: moderateScale(20),
    },
    repeatBadge: {
      backgroundColor: Color(theme.colors.primary).alpha(0.15).toString(),
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(8),
      borderRadius: moderateScale(20),
      borderWidth: 1,
      borderColor: Color(theme.colors.primary).alpha(0.3).toString(),
    },
    repeatBadgeText: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.primary,
    },
    arabicSection: {
      alignItems: 'center',
      marginBottom: moderateScale(8),
    },
    arabicText: {
      fontSize: moderateScale(28),
      fontFamily: 'QPC',
      color: theme.colors.text,
      textAlign: 'right',
      writingDirection: 'rtl',
      lineHeight: moderateScale(50),
      paddingHorizontal: moderateScale(8),
    },
    copyButton: {
      marginTop: moderateScale(12),
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(6),
      backgroundColor: Color(theme.colors.textSecondary).alpha(0.1).toString(),
      borderRadius: moderateScale(8),
    },
    copyButtonText: {
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.medium,
      color: theme.colors.textSecondary,
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
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
      lineHeight: moderateScale(26),
      textAlign: 'left',
    },
    transliterationSection: {
      marginBottom: moderateScale(8),
    },
    transliterationText: {
      fontSize: moderateScale(15),
      fontFamily: theme.fonts.light,
      fontStyle: 'italic',
      color: Color(theme.colors.textSecondary).alpha(0.7).toString(),
      lineHeight: moderateScale(24),
      textAlign: 'left',
    },
    instructionCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: Color(theme.colors.primary).alpha(0.08).toString(),
      borderRadius: moderateScale(12),
      padding: moderateScale(14),
      marginTop: moderateScale(20),
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.primary,
    },
    instructionIconContainer: {
      width: moderateScale(22),
      height: moderateScale(22),
      borderRadius: moderateScale(11),
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: moderateScale(12),
    },
    instructionIcon: {
      fontSize: moderateScale(13),
      fontFamily: theme.fonts.semiBold,
      color: '#FFFFFF',
    },
    instructionText: {
      flex: 1,
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.regular,
      color: theme.colors.text,
      lineHeight: moderateScale(22),
    },
    shareButton: {
      marginTop: moderateScale(24),
      paddingVertical: moderateScale(14),
      backgroundColor: Color(theme.colors.primary).alpha(0.1).toString(),
      borderRadius: moderateScale(12),
      alignItems: 'center',
      borderWidth: 1,
      borderColor: Color(theme.colors.primary).alpha(0.2).toString(),
    },
    shareButtonText: {
      fontSize: moderateScale(15),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.primary,
    },
    bottomSpacer: {
      height: moderateScale(100),
    },
  });
