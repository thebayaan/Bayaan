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
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import SkiaVersePreview from '@/components/share/SkiaVersePreview';

const COLORS = Object.entries(HIGHLIGHT_COLORS) as [HighlightColor, string][];

interface HighlightContentProps {
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  verseKeys?: string[];
  onDone: () => void;
}

export const HighlightContent: React.FC<HighlightContentProps> = ({
  verseKey,
  surahNumber,
  ayahNumber,
  verseKeys,
  onDone,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const allKeys = verseKeys && verseKeys.length > 1 ? verseKeys : [verseKey];
  const currentColor = useVerseAnnotationsStore(s => s.highlights[verseKey]);

  const handleSelectColor = useCallback(
    async (color: HighlightColor) => {
      const store = useVerseAnnotationsStore.getState();
      for (const vk of allKeys) {
        const [s, a] = vk.split(':');
        await verseAnnotationService.upsertHighlight(
          vk,
          parseInt(s, 10),
          parseInt(a, 10),
          color,
        );
        store.setHighlight(vk, color);
      }
      onDone();
    },
    [allKeys, onDone],
  );

  const handleRemove = useCallback(async () => {
    const store = useVerseAnnotationsStore.getState();
    for (const vk of allKeys) {
      await verseAnnotationService.removeHighlight(vk);
      store.removeHighlight(vk);
    }
    onDone();
  }, [allKeys, onDone]);

  return (
    <View>
      <View style={styles.previewCard}>
        <SkiaVersePreview verseKey={verseKey} verseKeys={verseKeys} />
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
