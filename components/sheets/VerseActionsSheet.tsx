import React, {useCallback, useState} from 'react';
import {View, Text, TouchableOpacity, Share} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import ActionSheet, {
  SheetProps,
  SheetManager,
} from 'react-native-actions-sheet';
import {Feather, Ionicons} from '@expo/vector-icons';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {useVerseSelectionStore} from '@/store/verseSelectionStore';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import {lightHaptics} from '@/utils/haptics';
import Color from 'color';

const surahData = require('@/data/surahData.json');

export const VerseActionsSheet = (props: SheetProps<'verse-actions'>) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const [pressedOption, setPressedOption] = useState<string | null>(null);

  const payload = props.payload;
  const verseKey = payload?.verseKey ?? '';
  const surahNumber = payload?.surahNumber ?? 0;
  const ayahNumber = payload?.ayahNumber ?? 0;
  const arabicText = payload?.arabicText ?? '';
  const translation = payload?.translation ?? '';

  const surah = surahData.find(
    (s: {id: number; name: string}) => s.id === surahNumber,
  );
  const surahName = surah?.name ?? '';

  const isBookmarked = useVerseAnnotationsStore(state =>
    state.isBookmarked(verseKey),
  );
  const hasNote = useVerseAnnotationsStore(state => state.hasNote(verseKey));

  const handleClose = useCallback(() => {
    SheetManager.hide('verse-actions');
  }, []);

  const handleToggleBookmark = useCallback(async () => {
    lightHaptics();
    const wasAdded = await verseAnnotationService.toggleBookmark(
      verseKey,
      surahNumber,
      ayahNumber,
    );
    const store = useVerseAnnotationsStore.getState();
    if (wasAdded) {
      store.addBookmark(verseKey);
    } else {
      store.removeBookmark(verseKey);
    }
    handleClose();
  }, [verseKey, surahNumber, ayahNumber, handleClose]);

  const handleHighlight = useCallback(() => {
    SheetManager.show('verse-highlight', {
      payload: {verseKey, surahNumber, ayahNumber},
    });
  }, [verseKey, surahNumber, ayahNumber]);

  const handleNote = useCallback(() => {
    SheetManager.show('verse-note', {
      payload: {verseKey, surahNumber, ayahNumber},
    });
  }, [verseKey, surahNumber, ayahNumber]);

  const handleCopy = useCallback(() => {
    SheetManager.show('verse-copy', {
      payload: {verseKey, surahNumber, ayahNumber, arabicText, translation},
    });
  }, [verseKey, surahNumber, ayahNumber, arabicText, translation]);

  const handleShare = useCallback(async () => {
    lightHaptics();
    const message = `${arabicText}\n\n${translation}\n\n-- Quran ${surahNumber}:${ayahNumber}`;
    await Share.share({message});
    handleClose();
  }, [arabicText, translation, surahNumber, ayahNumber, handleClose]);

  const handleTranslation = useCallback(() => {
    SheetManager.show('verse-translation', {
      payload: {verseKey, surahNumber, ayahNumber, arabicText},
    });
  }, [verseKey, surahNumber, ayahNumber, arabicText]);

  const handleOnClose = useCallback(() => {
    useVerseSelectionStore.getState().clearSelection();
  }, []);

  if (!payload) return null;

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}
      onClose={handleOnClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.surahName}>{surahName}</Text>
          <Text style={styles.verseRef}>
            {surahNumber}:{ayahNumber}
          </Text>
        </View>

        <View style={styles.optionsGrid}>
          <TouchableOpacity
            style={[
              styles.option,
              pressedOption === 'bookmark' && styles.optionPressed,
            ]}
            onPress={handleToggleBookmark}
            onPressIn={() => setPressedOption('bookmark')}
            onPressOut={() => setPressedOption(null)}
            activeOpacity={1}>
            <Feather
              name="bookmark"
              size={moderateScale(20)}
              color={theme.colors.text}
            />
            <Text style={styles.optionText}>
              {isBookmarked ? 'Remove Bookmark' : 'Bookmark'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.option,
              pressedOption === 'highlight' && styles.optionPressed,
            ]}
            onPress={handleHighlight}
            onPressIn={() => setPressedOption('highlight')}
            onPressOut={() => setPressedOption(null)}
            activeOpacity={1}>
            <Ionicons
              name="color-palette-outline"
              size={moderateScale(20)}
              color={theme.colors.text}
            />
            <Text style={styles.optionText}>Highlight</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.option,
              pressedOption === 'note' && styles.optionPressed,
            ]}
            onPress={handleNote}
            onPressIn={() => setPressedOption('note')}
            onPressOut={() => setPressedOption(null)}
            activeOpacity={1}>
            <Feather
              name="edit-3"
              size={moderateScale(20)}
              color={theme.colors.text}
            />
            <Text style={styles.optionText}>
              {hasNote ? 'Edit Note' : 'Add Note'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.option,
              pressedOption === 'copy' && styles.optionPressed,
            ]}
            onPress={handleCopy}
            onPressIn={() => setPressedOption('copy')}
            onPressOut={() => setPressedOption(null)}
            activeOpacity={1}>
            <Feather
              name="copy"
              size={moderateScale(20)}
              color={theme.colors.text}
            />
            <Text style={styles.optionText}>Copy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.option,
              pressedOption === 'share' && styles.optionPressed,
            ]}
            onPress={handleShare}
            onPressIn={() => setPressedOption('share')}
            onPressOut={() => setPressedOption(null)}
            activeOpacity={1}>
            <Feather
              name="share"
              size={moderateScale(20)}
              color={theme.colors.text}
            />
            <Text style={styles.optionText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.option,
              pressedOption === 'translation' && styles.optionPressed,
            ]}
            onPress={handleTranslation}
            onPressIn={() => setPressedOption('translation')}
            onPressOut={() => setPressedOption(null)}
            activeOpacity={1}>
            <Feather
              name="book-open"
              size={moderateScale(20)}
              color={theme.colors.text}
            />
            <Text style={styles.optionText}>Translation</Text>
          </TouchableOpacity>
        </View>
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
      paddingHorizontal: moderateScale(20),
      paddingBottom: moderateScale(40),
    },
    header: {
      alignItems: 'center',
      marginTop: moderateScale(8),
      marginBottom: moderateScale(20),
      gap: moderateScale(4),
    },
    surahName: {
      fontSize: moderateScale(20),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    verseRef: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    optionsGrid: {
      gap: moderateScale(8),
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      paddingHorizontal: moderateScale(16),
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderRadius: moderateScale(12),
    },
    optionPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    optionText: {
      flex: 1,
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginLeft: moderateScale(12),
    },
  });
