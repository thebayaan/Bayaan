import React, {useState, useMemo, useCallback, useEffect} from 'react';
import {View, Text, TextInput, TouchableOpacity} from 'react-native';
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
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {useVerseSelectionStore} from '@/store/verseSelectionStore';

export const VerseNoteSheet = (props: SheetProps<'verse-note'>) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const verseKey = props.payload?.verseKey ?? '';
  const surahNumber = props.payload?.surahNumber ?? 0;
  const ayahNumber = props.payload?.ayahNumber ?? 0;

  const [noteText, setNoteText] = useState('');
  const [hasExistingNote, setHasExistingNote] = useState(false);

  useEffect(() => {
    if (!verseKey) return;
    verseAnnotationService.getNote(verseKey).then(note => {
      if (note) {
        setNoteText(note.content);
        setHasExistingNote(true);
      }
    });
  }, [verseKey]);

  const handleSave = useCallback(async () => {
    if (!noteText.trim()) return;
    await verseAnnotationService.upsertNote(
      verseKey,
      surahNumber,
      ayahNumber,
      noteText.trim(),
    );
    useVerseAnnotationsStore.getState().addNote(verseKey);
    SheetManager.hide('verse-note');
    useVerseSelectionStore.getState().clearSelection();
  }, [verseKey, surahNumber, ayahNumber, noteText]);

  const handleDelete = useCallback(async () => {
    await verseAnnotationService.deleteNote(verseKey);
    useVerseAnnotationsStore.getState().removeNote(verseKey);
    SheetManager.hide('verse-note');
    useVerseSelectionStore.getState().clearSelection();
  }, [verseKey]);

  const canSave = noteText.trim().length > 0;

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.container}>
        <Text style={styles.title}>
          Note for {surahNumber}:{ayahNumber}
        </Text>

        <TextInput
          style={styles.textInput}
          value={noteText}
          onChangeText={setNoteText}
          placeholder="Write your note here..."
          placeholderTextColor={theme.colors.textSecondary}
          multiline
          textAlignVertical="top"
          autoFocus
        />

        <TouchableOpacity
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          onPress={handleSave}
          activeOpacity={1}
          disabled={!canSave}>
          <Feather
            name="save"
            size={moderateScale(18)}
            color={
              canSave ? theme.colors.background : theme.colors.textSecondary
            }
          />
          <Text
            style={[
              styles.saveButtonText,
              !canSave && styles.saveButtonTextDisabled,
            ]}>
            Save Note
          </Text>
        </TouchableOpacity>

        {hasExistingNote ? (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            activeOpacity={1}>
            <Feather name="trash-2" size={moderateScale(18)} color="#ff4444" />
            <Text style={styles.deleteButtonText}>Delete Note</Text>
          </TouchableOpacity>
        ) : null}
      </View>
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
      marginBottom: verticalScale(16),
    },
    textInput: {
      backgroundColor: theme.colors.card,
      borderRadius: moderateScale(12),
      padding: moderateScale(14),
      minHeight: verticalScale(150),
      fontSize: moderateScale(15),
      fontFamily: theme.fonts.regular,
      color: theme.colors.text,
      marginBottom: verticalScale(16),
    },
    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.text,
      borderRadius: moderateScale(12),
      paddingVertical: verticalScale(14),
      gap: moderateScale(8),
    },
    saveButtonDisabled: {
      backgroundColor: Color(theme.colors.textSecondary).alpha(0.2).toString(),
    },
    saveButtonText: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.background,
    },
    saveButtonTextDisabled: {
      color: theme.colors.textSecondary,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 68, 68, 0.1)',
      borderRadius: moderateScale(12),
      paddingVertical: verticalScale(14),
      gap: moderateScale(8),
      marginTop: verticalScale(10),
    },
    deleteButtonText: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.semiBold,
      color: '#ff4444',
    },
  });
