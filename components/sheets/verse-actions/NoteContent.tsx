import React, {useState, useMemo, useCallback} from 'react';
import {View, TextInput, Pressable, Text} from 'react-native';
import {ScrollView} from 'react-native-actions-sheet';
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import SkiaVersePreview from '@/components/share/SkiaVersePreview';
// @ai-start
import {
  selectionPreviewProps,
  type ReadyVerseSelection,
} from '@/components/share/rewayahVerseSelection';
// @ai-end

interface NoteContentProps {
  // @ai-start
  /**
   * The selected verses in their rewayah's own numbering (decision 3; see
   * components/share/rewayahVerseSelection.ts). The note is stored by Hafs
   * anchors (verse-units contract section 3): verse_key = the first verse's
   * anchor, verse_keys = every verse's anchor for a range, with the
   * selection's rewayah. Hafs: the Hafs keys, exactly as before.
   */
  selection: ReadyVerseSelection;
  // @ai-end
  onDone: () => void;
}

export const NoteContent: React.FC<NoteContentProps> = ({
  selection, // @ai
  onDone,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  // @ai-start
  const {anchors, rewayah} = selection;
  const isRange = anchors.length > 1;
  // @ai-end
  const [noteText, setNoteText] = useState('');

  const handleSave = useCallback(async () => {
    if (!noteText.trim()) return;

    // @ai-start
    const [first] = anchors;
    if (!first) return;
    const keys = anchors.map(anchor => anchor.key);
    await verseAnnotationService.addNote(
      first.key,
      first.surah,
      first.ayah,
      noteText.trim(),
      isRange ? keys : undefined,
      rewayah,
    );
    const store = useVerseAnnotationsStore.getState();
    for (const key of keys) {
      store.addNote(key);
    }
    // @ai-end
    onDone();
  }, [anchors, isRange, noteText, onDone, rewayah]); // @ai

  const canSave = noteText.trim().length > 0;

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <View style={styles.previewCard}>
        {/* @ai: the selected verses, each with its own marker */}
        <SkiaVersePreview
          {...selectionPreviewProps(selection)}
          numberOfLines={isRange ? 3 : 2}
          rewayah={rewayah}
        />
      </View>

      <TextInput
        style={styles.textInput}
        value={noteText}
        onChangeText={setNoteText}
        placeholder="Write your note here..."
        placeholderTextColor={Color(theme.colors.textSecondary)
          .alpha(0.5)
          .toString()}
        multiline
        textAlignVertical="top"
        autoFocus
      />

      <Pressable
        style={({pressed}) => [
          styles.saveButton,
          !canSave && styles.saveButtonDisabled,
          pressed && canSave && {opacity: 0.85},
        ]}
        onPress={handleSave}
        disabled={!canSave}>
        <Feather
          name="save"
          size={moderateScale(16)}
          color={theme.colors.text}
        />
        <Text style={styles.saveButtonText}>Save Note</Text>
      </Pressable>
    </ScrollView>
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
    textInput: {
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderRadius: moderateScale(12),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      padding: moderateScale(14),
      minHeight: verticalScale(120),
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.text,
      marginBottom: moderateScale(16),
    },
    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
      borderRadius: moderateScale(12),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.1).toString(),
      paddingVertical: verticalScale(13),
      gap: moderateScale(8),
    },
    saveButtonDisabled: {
      opacity: 0.35,
    },
    saveButtonText: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
  });
