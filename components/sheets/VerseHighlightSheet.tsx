import React, {useMemo, useCallback} from 'react';
import {View, Text, Pressable} from 'react-native';
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import ActionSheet, {
  SheetProps,
  SheetManager,
} from 'react-native-actions-sheet';
import Color from 'color';
import {Feather} from '@expo/vector-icons';
import {HIGHLIGHT_COLORS, HighlightColor} from '@/types/verse-annotations';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import SkiaVersePreview from '@/components/share/SkiaVersePreview';

const COLORS = Object.entries(HIGHLIGHT_COLORS) as [HighlightColor, string][];

export const VerseHighlightSheet = (props: SheetProps<'verse-highlight'>) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const verseKey = props.payload?.verseKey ?? '';
  const surahNumber = props.payload?.surahNumber ?? 0;
  const ayahNumber = props.payload?.ayahNumber ?? 0;
  const verseKeys = props.payload?.verseKeys;
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
      SheetManager.hideAll();
    },
    [allKeys],
  );

  const handleRemove = useCallback(async () => {
    const store = useVerseAnnotationsStore.getState();
    for (const vk of allKeys) {
      await verseAnnotationService.removeHighlight(vk);
      store.removeHighlight(vk);
    }
    SheetManager.hideAll();
  }, [allKeys]);

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.container}>
        <Text style={styles.title}>Highlight Color</Text>

        <View style={styles.ayahContainer}>
          <SkiaVersePreview verseKey={verseKey} verseKeys={verseKeys} />
        </View>

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
                  <Feather name="check" size={moderateScale(22)} color="#333" />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {currentColor ? (
          <Pressable style={styles.removeButton} onPress={handleRemove}>
            <Feather name="x-circle" size={moderateScale(18)} color="#ff4444" />
            <Text style={styles.removeButtonText}>Remove Highlight</Text>
          </Pressable>
        ) : null}
      </View>
    </ActionSheet>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      paddingTop: moderateScale(8),
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
    },
    container: {
      padding: moderateScale(16),
      paddingBottom: moderateScale(40),
    },
    title: {
      fontSize: moderateScale(20),
      fontFamily: theme.fonts.bold,
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: verticalScale(12),
    },
    ayahContainer: {
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderRadius: moderateScale(12),
      padding: moderateScale(16),
      marginBottom: verticalScale(20),
    },
    colorsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: moderateScale(16),
      marginBottom: verticalScale(20),
    },
    colorCircle: {
      width: moderateScale(48),
      height: moderateScale(48),
      borderRadius: moderateScale(24),
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: Color(theme.colors.text).alpha(0.1).toString(),
    },
    colorCircleActive: {
      borderColor: Color(theme.colors.text).alpha(0.5).toString(),
      borderWidth: 3,
    },
    removeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 68, 68, 0.1)',
      borderRadius: moderateScale(12),
      paddingVertical: verticalScale(14),
      gap: moderateScale(8),
    },
    removeButtonText: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.semiBold,
      color: '#ff4444',
    },
  });
