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
  ScrollView,
} from 'react-native-actions-sheet';
import Color from 'color';
import {Feather} from '@expo/vector-icons';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import SkiaVersePreview from '@/components/share/SkiaVersePreview';
import type {RewayahId} from '@/store/mushafSettingsStore'; // @ai
// @ai-start
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useRewayahVerseUnits} from '@/hooks/useRewayahVerseUnits';
import {
  describeStoredVerses,
  readUnitTexts,
  type ReadyVerseSelection,
  type VerseSelectionRequest,
} from '@/components/share/rewayahVerseSelection';
import {
  useRequireSelection,
  useVerseSelection,
} from '@/components/share/useVerseSelection';
import {addSelectionNote} from './verse-actions/selectionAnnotations';
// @ai-end

export const VerseNoteSheet = (props: SheetProps<'verse-note'>) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const verseKey = props.payload?.verseKey ?? '';
  const surahNumber = props.payload?.surahNumber ?? 0;
  const ayahNumber = props.payload?.ayahNumber ?? 0;
  const verseKeys = props.payload?.verseKeys;
  const unitKeys = props.payload?.unitKeys; // @ai
  const isRange = verseKeys && verseKeys.length > 1;
  const noteId = props.payload?.noteId;
  const rewayah = props.payload?.rewayah;

  const [noteText, setNoteText] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  // @ai-start
  // An existing note opened from the Notes list carries no rewayah in the
  // payload; preview it in the rewayah it was saved in (legacy notes without
  // one follow the active rewayah). Hold the preview until the note loads so
  // it never flashes another rewayah's text first.
  const [savedNoteRewayah, setSavedNoteRewayah] = useState<
    RewayahId | undefined
  >(undefined);
  const [noteLoaded, setNoteLoaded] = useState(!noteId);
  const previewRewayah = rewayah ?? savedNoteRewayah;
  // @ai-end

  // Compute range-aware reference text
  const verseRefText = useMemo(() => {
    if (!isRange) return `${surahNumber}:${ayahNumber}`;
    const firstKey = verseKeys[0];
    const lastKey = verseKeys[verseKeys.length - 1];
    const [firstSurah, firstAyah] = firstKey.split(':');
    const [lastSurah, lastAyah] = lastKey.split(':');
    if (firstSurah === lastSurah) {
      return `${firstSurah}:${firstAyah}-${lastAyah}`;
    }
    return `${firstSurah}:${firstAyah} - ${lastSurah}:${lastAyah}`;
  }, [isRange, verseKeys, surahNumber, ayahNumber]);

  // @ai-start
  // Decision 3: the note's verses are named in the numbering of the rewayah
  // it belongs to: the payload's, else (a saved note opened from the Notes
  // list) the note's own once it has loaded; a legacy note without one
  // counts as Hafs (verse-units contract section 3). Null while a saved
  // note's rewayah is not known yet. Hafs keeps the label and preview above,
  // exactly as before.
  const mushafRewayah = useMushafSettingsStore(s => s.rewayah);
  const noteRewayah: RewayahId | null = noteId
    ? (rewayah ?? (noteLoaded ? (savedNoteRewayah ?? 'hafs') : null))
    : (rewayah ?? mushafRewayah);
  const isHafsNote = noteRewayah === 'hafs';

  // A new note: the payload's verses (verse-units contract 4.1), as the
  // verse actions sheet names them.
  const selectionRequest = useMemo<VerseSelectionRequest>(
    () => ({
      rewayah: noteRewayah ?? 'hafs',
      verseKey,
      surahNumber,
      ayahNumber,
      verseKeys,
      unitKeys,
    }),
    [noteRewayah, verseKey, surahNumber, ayahNumber, verseKeys, unitKeys],
  );
  const newNoteSelection = useVerseSelection(selectionRequest);
  const requireSelection = useRequireSelection(
    newNoteSelection,
    selectionRequest,
  );

  // A saved note: its stored anchors ("S:A" or "S:A:W", Hafs locations),
  // named in its rewayah's own verses.
  const savedUnits = useRewayahVerseUnits(
    noteId && noteRewayah && !isHafsNote ? noteRewayah : null,
  );
  const verses = useMemo((): {
    label: string;
    selection: ReadyVerseSelection | null;
  } | null => {
    if (noteRewayah === null) return null;
    if (isHafsNote) return {label: verseRefText, selection: null};
    if (!noteId) {
      return newNoteSelection.status === 'ready'
        ? {label: newNoteSelection.label, selection: newNoteSelection}
        : null;
    }
    const anchorKeys = isRange ? verseKeys : [verseKey];
    const described = describeStoredVerses(
      savedUnits.units,
      savedUnits.status,
      anchorKeys,
    );
    if (described.status === 'loading') return null;
    if (described.status === 'unnumbered') {
      return {label: described.label, selection: null};
    }
    return {label: described.selection.label, selection: described.selection};
  }, [
    noteRewayah,
    isHafsNote,
    verseRefText,
    noteId,
    newNoteSelection,
    isRange,
    verseKeys,
    verseKey,
    savedUnits,
  ]);
  // Another rewayah's verses are drawn from their own text (each with its
  // own marker); '' draws nothing (not nameable, or still loading).
  const previewText = isHafsNote
    ? undefined
    : verses?.selection
      ? (readUnitTexts(verses.selection) ?? []).join(' ')
      : '';
  // @ai-end

  useEffect(() => {
    if (!verseKey) return;

    if (noteId) {
      // @ai-start
      verseAnnotationService
        .getNoteById(noteId)
        .then(note => {
          if (note) {
            setNoteText(note.content);
            setIsEditMode(true);
            setSavedNoteRewayah(note.rewayahId ?? undefined);
          }
        })
        .finally(() => setNoteLoaded(true));
      // @ai-end
    }
  }, [verseKey, noteId]);

  const handleSave = useCallback(async () => {
    if (!noteText.trim()) return;

    if (isEditMode && noteId) {
      await verseAnnotationService.updateNote(noteId, noteText.trim());
    } else if (isHafsNote || !noteRewayah) {
      const allKeys = isRange ? verseKeys : [verseKey];
      await verseAnnotationService.addNote(
        verseKey,
        surahNumber,
        ayahNumber,
        noteText.trim(),
        isRange ? verseKeys : undefined,
        rewayah,
      );
      const store = useVerseAnnotationsStore.getState();
      for (const vk of allKeys) {
        store.addNote(vk);
      }
    } else {
      // @ai-start
      // Another rewayah: stored by its verses' Hafs anchors (verse-units
      // contract section 3), verse_keys = every anchor of a range.
      const ready = await requireSelection('saved');
      if (!ready || ready.anchors.length === 0) return;
      await addSelectionNote(ready, noteText.trim());
      // @ai-end
    }
    SheetManager.hideAll();
  }, [
    verseKey,
    verseKeys,
    isRange,
    surahNumber,
    ayahNumber,
    noteText,
    isEditMode,
    noteId,
    rewayah,
    isHafsNote, // @ai
    noteRewayah, // @ai
    requireSelection, // @ai
  ]);

  const handleDelete = useCallback(async () => {
    if (!noteId) return;
    await verseAnnotationService.deleteNoteById(noteId);
    const remaining =
      await verseAnnotationService.getNotesCountForVerse(verseKey);
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
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* @ai: the verses in the note's own rewayah numbering, once known */}
        <Text style={styles.title}>
          {isEditMode ? 'Edit Note' : 'Note'}
          {verses ? ` for ${verses.label}` : ''}
        </Text>

        <View style={styles.ayahContainer}>
          {/* @ai-start */}
          {noteLoaded ? (
            <SkiaVersePreview
              verseKey={verseKey}
              verseKeys={verseKeys}
              numberOfLines={isRange ? 3 : 2}
              rewayah={previewRewayah}
              text={previewText} // @ai
            />
          ) : null}
          {/* @ai-end */}
        </View>

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
            <Feather
              name="minus-circle"
              size={moderateScale(18)}
              color="#ff4444"
            />
            <Text style={styles.deleteButtonText}>Delete Note</Text>
          </Pressable>
        ) : null}
      </ScrollView>
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
      height: 2.5,
    },
    container: {
      padding: moderateScale(16),
    },
    scrollContent: {
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
