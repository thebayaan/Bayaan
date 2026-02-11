import React, {useState, useMemo, useCallback, useEffect} from 'react';
import {View, Text, TextInput, Pressable} from 'react-native';
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
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';

// Build verse_key -> text lookup once at module scope
interface QuranEntry {
  verse_key: string;
  text: string;
}
const quranRaw = require('@/data/quran.json') as Record<string, QuranEntry>;
const qpcTextByKey: Record<string, string> = {};
for (const key of Object.keys(quranRaw)) {
  const entry = quranRaw[key];
  if (entry?.verse_key) qpcTextByKey[entry.verse_key] = entry.text;
}

// Lazy-load Indopak data
interface IndopakEntry {
  text: string;
}
let indopakCache: Record<string, IndopakEntry> | null = null;
function getIndopakData(): Record<string, IndopakEntry> | null {
  if (!indopakCache) {
    try {
      indopakCache = require('@/data/IndopakNastaleeq.json');
    } catch {
      // not available
    }
  }
  return indopakCache;
}

export const VerseNoteSheet = (props: SheetProps<'verse-note'>) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const verseKey = props.payload?.verseKey ?? '';
  const surahNumber = props.payload?.surahNumber ?? 0;
  const ayahNumber = props.payload?.ayahNumber ?? 0;
  const noteId = props.payload?.noteId;

  const {arabicFontFamily} = useMushafSettingsStore();

  const [noteText, setNoteText] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);

  const isIndopak = arabicFontFamily === 'Indopak';
  const arabicText = isIndopak
    ? getIndopakData()?.[verseKey]?.text ?? ''
    : qpcTextByKey[verseKey] ?? '';

  useEffect(() => {
    if (!verseKey) return;

    if (noteId) {
      verseAnnotationService.getNoteById(noteId).then(note => {
        if (note) {
          setNoteText(note.content);
          setIsEditMode(true);
        }
      });
    }
  }, [verseKey, noteId]);

  const handleSave = useCallback(async () => {
    if (!noteText.trim()) return;

    if (isEditMode && noteId) {
      await verseAnnotationService.updateNote(noteId, noteText.trim());
    } else {
      await verseAnnotationService.addNote(
        verseKey,
        surahNumber,
        ayahNumber,
        noteText.trim(),
      );
      useVerseAnnotationsStore.getState().addNote(verseKey);
    }
    SheetManager.hideAll();
  }, [verseKey, surahNumber, ayahNumber, noteText, isEditMode, noteId]);

  const handleDelete = useCallback(async () => {
    if (!noteId) return;
    await verseAnnotationService.deleteNoteById(noteId);
    const remaining = await verseAnnotationService.getNotesCountForVerse(
      verseKey,
    );
    if (remaining === 0) {
      useVerseAnnotationsStore.getState().removeNote(verseKey);
    }
    SheetManager.hideAll();
  }, [verseKey, noteId]);

  const canSave = noteText.trim().length > 0;

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.container}>
        <Text style={styles.title}>
          {isEditMode ? 'Edit Note' : 'Note'} for {surahNumber}:{ayahNumber}
        </Text>

        {arabicText ? (
          <View style={styles.ayahContainer}>
            <Text style={[styles.ayahText, {fontFamily: arabicFontFamily}]}>
              {arabicText}
            </Text>
          </View>
        ) : null}

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

        <Pressable
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!canSave}>
          <Feather
            name="save"
            size={moderateScale(18)}
            color={canSave ? theme.colors.text : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.saveButtonText,
              !canSave && styles.saveButtonTextDisabled,
            ]}>
            {isEditMode ? 'Update Note' : 'Save Note'}
          </Text>
        </Pressable>

        {isEditMode && noteId ? (
          <Pressable style={styles.deleteButton} onPress={handleDelete}>
            <Feather name="trash-2" size={moderateScale(18)} color="#ff4444" />
            <Text style={styles.deleteButtonText}>Delete Note</Text>
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
      marginBottom: verticalScale(16),
    },
    ayahText: {
      fontSize: moderateScale(24),
      color: theme.colors.text,
      textAlign: 'right',
      writingDirection: 'rtl',
      lineHeight: moderateScale(48),
    },
    textInput: {
      backgroundColor: theme.colors.card,
      borderRadius: moderateScale(12),
      padding: moderateScale(14),
      minHeight: verticalScale(120),
      fontSize: moderateScale(15),
      fontFamily: theme.fonts.regular,
      color: theme.colors.text,
      marginBottom: verticalScale(16),
    },
    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Color(theme.colors.text).alpha(0.1).toString(),
      borderRadius: moderateScale(12),
      paddingVertical: verticalScale(12),
      gap: moderateScale(8),
    },
    saveButtonDisabled: {
      backgroundColor: Color(theme.colors.textSecondary).alpha(0.2).toString(),
    },
    saveButtonText: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
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
