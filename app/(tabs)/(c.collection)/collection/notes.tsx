import React, {useState, useCallback, useRef} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
  Animated as RNAnimated,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {useFocusEffect} from '@react-navigation/native';
import {moderateScale} from 'react-native-size-matters';
import {Feather} from '@expo/vector-icons';
import {ListRenderItem} from 'react-native';
import {getSurahById} from '@/services/dataService';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {NoteItem} from '@/components/collection/NoteItem';
import {CollectionStickyHeader} from '@/components/collection/CollectionStickyHeader';
import {SheetManager} from 'react-native-actions-sheet';
import Color from 'color';
import type {VerseNote} from '@/types/verse-annotations';

interface NoteData {
  note: VerseNote;
  surahName: string;
}

const NotesScreen = () => {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [notes, setNotes] = useState<NoteData[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollY = useRef(new RNAnimated.Value(0)).current;

  const loadNotes = useCallback(async () => {
    try {
      setLoading(true);
      const allNotes = await verseAnnotationService.getAllNotes();
      const enriched = allNotes.map(note => {
        const surah = getSurahById(note.surahNumber);
        return {
          note,
          surahName: surah?.name ?? `Surah ${note.surahNumber}`,
        };
      });
      setNotes(enriched);
    } catch (error) {
      console.error('Failed to load notes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotes();
    }, [loadNotes]),
  );

  const handleDeleteNote = useCallback(async (note: VerseNote) => {
    await verseAnnotationService.deleteNoteById(note.id);
    const remaining = await verseAnnotationService.getNotesCountForVerse(
      note.verseKey,
    );
    if (remaining === 0) {
      useVerseAnnotationsStore.getState().removeNote(note.verseKey);
    }
    setNotes(prev => prev.filter(n => n.note.id !== note.id));
  }, []);

  const handleNotePress = useCallback((item: NoteData) => {
    SheetManager.show('verse-note', {
      payload: {
        verseKey: item.note.verseKey,
        surahNumber: item.note.surahNumber,
        ayahNumber: item.note.ayahNumber,
        noteId: item.note.id,
      },
    });
  }, []);

  const handleOptionsPress = useCallback(
    (item: NoteData) => {
      SheetManager.show('collection-options', {
        payload: {
          title: item.surahName,
          subtitle: `Ayah ${item.note.ayahNumber}`,
          options: [
            {
              label: 'Edit Note',
              icon: 'edit-2',
              onPress: () => handleNotePress(item),
            },
            {
              label: 'Delete Note',
              icon: 'trash-2',
              destructive: true,
              onPress: () => handleDeleteNote(item.note),
            },
          ],
        },
      });
    },
    [handleDeleteNote, handleNotePress],
  );

  const ListHeaderComponent = useCallback(() => {
    return (
      <View style={styles.headerContainer}>
        <View style={{paddingTop: insets.top}} />
        <View style={styles.headerContent}>
          <View
            style={[
              styles.headerIcon,
              {backgroundColor: Color('#3B82F6').alpha(0.15).toString()},
            ]}>
            <Feather
              name="file-text"
              size={moderateScale(28)}
              color="#3B82F6"
            />
          </View>
          <Text style={[styles.headerTitle, {color: theme.colors.text}]}>
            Notes
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              {color: theme.colors.textSecondary},
            ]}>
            {notes.length} {notes.length === 1 ? 'note' : 'notes'}
          </Text>
        </View>
      </View>
    );
  }, [notes.length, insets.top, theme]);

  const renderItem: ListRenderItem<NoteData> = ({item}) => (
    <NoteItem
      surahName={item.surahName}
      ayahNumber={item.note.ayahNumber}
      surahNumber={item.note.surahNumber}
      notePreview={item.note.content}
      onPress={() => handleNotePress(item)}
      onOptionsPress={() => handleOptionsPress(item)}
    />
  );

  const getItemKey = (item: NoteData) => item.note.id;

  if (loading) {
    return (
      <View
        style={[styles.container, {backgroundColor: theme.colors.background}]}>
        <View style={[styles.emptyHeader, {paddingTop: insets.top}]}>
          <Pressable
            style={styles.emptyHeaderBack}
            onPress={() => router.back()}
            hitSlop={8}>
            <Feather
              name="arrow-left"
              size={moderateScale(22)}
              color={theme.colors.text}
            />
          </Pressable>
          <Text style={[styles.emptyHeaderTitle, {color: theme.colors.text}]}>
            Notes
          </Text>
          <View style={styles.emptyHeaderBack} />
        </View>
        <View style={styles.emptyContent}>
          <Text
            style={[styles.loadingText, {color: theme.colors.textSecondary}]}>
            Loading...
          </Text>
        </View>
      </View>
    );
  }

  if (notes.length === 0) {
    return (
      <View
        style={[styles.container, {backgroundColor: theme.colors.background}]}>
        <View style={[styles.emptyHeader, {paddingTop: insets.top}]}>
          <Pressable
            style={styles.emptyHeaderBack}
            onPress={() => router.back()}
            hitSlop={8}>
            <Feather
              name="arrow-left"
              size={moderateScale(22)}
              color={theme.colors.text}
            />
          </Pressable>
          <Text style={[styles.emptyHeaderTitle, {color: theme.colors.text}]}>
            Notes
          </Text>
          <View style={styles.emptyHeaderBack} />
        </View>
        <View style={styles.emptyContent}>
          <View style={styles.emptyIcon}>
            <Feather
              name="file-text"
              size={moderateScale(48)}
              color={theme.colors.textSecondary}
            />
          </View>
          <Text style={[styles.emptyTitle, {color: theme.colors.text}]}>
            No notes yet
          </Text>
          <Text
            style={[styles.emptySubtitle, {color: theme.colors.textSecondary}]}>
            Add notes to verses to see them here
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <StatusBar barStyle="default" />

      <RNAnimated.View
        style={[
          styles.fixedBackButton,
          {
            top: insets.top + moderateScale(10),
            opacity: scrollY.interpolate({
              inputRange: [80, 120],
              outputRange: [1, 0],
              extrapolate: 'clamp',
            }),
          },
        ]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather
            name="arrow-left"
            size={moderateScale(24)}
            color={theme.colors.text}
          />
        </Pressable>
      </RNAnimated.View>

      <RNAnimated.FlatList
        data={notes}
        renderItem={renderItem}
        keyExtractor={getItemKey}
        ListHeaderComponent={ListHeaderComponent}
        contentContainerStyle={styles.listContentContainer}
        onScroll={RNAnimated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: true},
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />
      <CollectionStickyHeader title="Notes" scrollY={scrollY} />
    </View>
  );
};

export default NotesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    alignItems: 'center',
  },
  headerContent: {
    alignItems: 'center',
    paddingVertical: moderateScale(24),
  },
  headerIcon: {
    width: moderateScale(64),
    height: moderateScale(64),
    borderRadius: moderateScale(16),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: moderateScale(12),
  },
  headerTitle: {
    fontSize: moderateScale(22),
    fontFamily: 'Manrope-Bold',
    marginBottom: moderateScale(4),
  },
  headerSubtitle: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Regular',
  },
  listContentContainer: {
    flexGrow: 1,
    paddingBottom: moderateScale(65),
  },
  fixedBackButton: {
    position: 'absolute',
    left: moderateScale(15),
    zIndex: 5,
    padding: moderateScale(8),
  },
  emptyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: moderateScale(12),
    paddingHorizontal: moderateScale(16),
  },
  emptyHeaderBack: {
    width: moderateScale(36),
    height: moderateScale(36),
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyHeaderTitle: {
    flex: 1,
    fontSize: moderateScale(17),
    fontFamily: 'Manrope-Bold',
    textAlign: 'center',
  },
  emptyContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: moderateScale(32),
    paddingBottom: moderateScale(60),
  },
  emptyIcon: {
    marginBottom: moderateScale(16),
  },
  emptyTitle: {
    fontSize: moderateScale(17),
    fontFamily: 'Manrope-Bold',
    textAlign: 'center',
    marginBottom: moderateScale(8),
  },
  emptySubtitle: {
    fontSize: moderateScale(13),
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    marginBottom: moderateScale(20),
  },
  loadingText: {
    fontSize: moderateScale(16),
    textAlign: 'center',
  },
});
