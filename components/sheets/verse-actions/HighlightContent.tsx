import React, {useMemo, useCallback} from 'react';
import {View, Text, Pressable} from 'react-native';
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {HIGHLIGHT_COLORS, HighlightColor} from '@/types/verse-annotations';
import SkiaVersePreview from '@/components/share/SkiaVersePreview';
// @ai-start
import {
  selectionPreviewProps,
  type ReadyVerseSelection,
} from '@/components/share/rewayahVerseSelection';
import {
  setSelectionHighlight,
  useSelectionHighlightColor,
} from './selectionAnnotations';
// @ai-end

const COLORS = Object.entries(HIGHLIGHT_COLORS) as [HighlightColor, string][];

interface HighlightContentProps {
  // @ai-start
  /**
   * The selected verses in their rewayah's own numbering (decision 3; see
   * components/share/rewayahVerseSelection.ts). One highlight row per
   * verse, stored at its Hafs anchor ("S:A", or "S:A:W" for a verse that
   * starts inside a Hafs verse: verse-units contract section 3) with the
   * selection's rewayah; the current colour and Remove read every row that
   * marks a selected verse, legacy rows included (selectionAnnotations.ts).
   * Hafs: the Hafs keys, exactly as before.
   */
  selection: ReadyVerseSelection;
  // @ai-end
  onDone: () => void;
}

export const HighlightContent: React.FC<HighlightContentProps> = ({
  selection, // @ai
  onDone,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // @ai-start
  const {rewayah} = selection;
  const currentColor = useSelectionHighlightColor(selection);

  const handleSelectColor = useCallback(
    async (color: HighlightColor) => {
      await setSelectionHighlight(selection, color);
      onDone();
    },
    [selection, onDone],
  );

  const handleRemove = useCallback(async () => {
    await setSelectionHighlight(selection, null);
    onDone();
  }, [selection, onDone]);
  // @ai-end

  return (
    <View>
      <View style={styles.previewCard}>
        {/* @ai: the selected verses, each with its own marker */}
        <SkiaVersePreview
          {...selectionPreviewProps(selection)}
          rewayah={rewayah}
        />
      </View>

      <Text style={styles.sectionLabel}>CHOOSE COLOR</Text>
      <View style={styles.card}>
        <View style={styles.colorsGrid}>
          {COLORS.map(([name, hex]) => {
            const isActive = currentColor === name;
            return (
              <Pressable
                key={name}
                style={[
                  styles.colorCircle,
                  {backgroundColor: hex},
                  isActive && styles.colorCircleActive,
                ]}
                onPress={() => handleSelectColor(name)}>
                {isActive ? (
                  <Feather name="check" size={moderateScale(20)} color="#333" />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      {currentColor ? (
        <Pressable
          style={({pressed}) => [
            styles.removeButton,
            pressed && {opacity: 0.85},
          ]}
          onPress={handleRemove}>
          <Feather name="x-circle" size={moderateScale(16)} color="#ff4444" />
          <Text style={styles.removeButtonText}>Remove Highlight</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    previewCard: {
      backgroundColor: Color(theme.colors.text).alpha(0.03).toString(),
      borderRadius: moderateScale(12),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.05).toString(),
      padding: moderateScale(14),
      marginBottom: moderateScale(14),
    },
    sectionLabel: {
      fontSize: moderateScale(10),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      letterSpacing: 1.2,
      marginBottom: moderateScale(4),
      marginLeft: moderateScale(2),
    },
    card: {
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderRadius: moderateScale(12),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      padding: moderateScale(16),
      marginBottom: moderateScale(14),
    },
    colorsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: moderateScale(14),
    },
    colorCircle: {
      width: moderateScale(44),
      height: moderateScale(44),
      borderRadius: moderateScale(22),
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    colorCircleActive: {
      borderColor: Color(theme.colors.text).alpha(0.4).toString(),
      borderWidth: 2.5,
    },
    removeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 68, 68, 0.08)',
      borderRadius: moderateScale(12),
      paddingVertical: verticalScale(13),
      gap: moderateScale(8),
    },
    removeButtonText: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: '#ff4444',
    },
  });
