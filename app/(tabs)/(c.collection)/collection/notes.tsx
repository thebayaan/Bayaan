import React, {useState, useCallback, useRef, useMemo} from 'react'; // @ai
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
  Animated as RNAnimated,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {useLocalSearchParams} from 'expo-router'; // @ai
import {USE_GLASS} from '@/hooks/useGlassProps';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {useFocusEffect} from 'expo-router';
import {moderateScale} from '@/utils/scale';
import {Feather} from '@expo/vector-icons';
import {BackIcon} from '@/components/ActionIcons'; // @ai
import {ListRenderItem} from 'react-native';
import {getSurahById} from '@/services/dataService';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {NoteItem} from '@/components/collection/NoteItem';
import {CollectionStickyHeader} from '@/components/collection/CollectionStickyHeader';
import {useCollectionNativeHeader} from '@/hooks/useCollectionNativeHeader';
import type {VerseNote} from '@/types/verse-annotations';
// @ai-start
import {useTranslation} from 'react-i18next';
import {CollectionEmptyState} from '@/components/collection/CollectionEmptyState'; // @ai
import i18n from '@/i18n';
import {getSurahDisplayName} from '@/i18n/format';
import {flipX} from '@/utils/rtl';
import {describeSavedVerseNow} from '@/hooks/useSavedVerseDescription';
import {savedVerseSubtitle} from '@/services/verse-annotations/unitAnnotations';
import {useNativeOptionsMenu} from '@/components/sheets/options/OptionsMenu';
import {
  CollectionOptionsMenu,
  type CollectionOptionsPayload,
} from '@/components/sheets/options/collectionOptions';
import {savedVerseRouteParams} from '@/services/verse-annotations/unitAnnotations'; // @ai
import {useLibraryListBottomPadding} from '@/hooks/useBottomInset'; // @ai
import {useIsStackRoot} from '@/components/tablet/useIsStackRoot'; // @ai
import {showSheet} from '@/components/sheets/sheetControl'; // @ai
// @ai-start
import {
  CollectionHeaderActions,
  CollectionScreenHeader,
  CollectionSearchField,
} from '@/components/collection/CollectionScreenHeader';
import {GRID_PADDING} from '@/components/collection/CollectionGridTile';
import {useCollectionViewPref} from '@/store/collectionViewStore';
import {matchesQuery, matchesVerseRef} from '@/utils/collectionSearch';
// @ai-end
// @ai-end

interface NoteData {
  note: VerseNote;
  surahName: string;
}

// @ai-start
const NotesScreen = () => {
  const {theme} = useTheme();
  const listBottomPadding = useLibraryListBottomPadding(); // @ai
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // The iPad sidebar opens this as the first screen of the Collection stack.
  // Back then has nothing to pop and used to switch to the Home tab, so the
  // arrow is left out there, as the system header does on iPadOS 26. @ai
  const isStackRoot = useIsStackRoot(); // @ai
  const {t} = useTranslation(['collection', 'common']);
  const nativeMenus = useNativeOptionsMenu(); // @ai

  const [notes, setNotes] = useState<NoteData[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const openingRef = useRef(false); // @ai

  // @ai-start
  const {sort} = useCollectionViewPref('notes');
  // @ai A search typed on the Collection tab arrives as `q`.
  const {q: initialQuery} = useLocalSearchParams<{q?: string}>(); // @ai
  const [searching, setSearching] = useState(Boolean(initialQuery));
  const [query, setQuery] = useState(initialQuery ?? '');
  const visibleNotes = useMemo(() => {
    const list = [...notes];
    if (sort === 'oldest') {
      list.sort((a, b) => a.note.createdAt - b.note.createdAt);
    } else if (sort === 'surah') {
      list.sort(
        (a, b) =>
          a.note.surahNumber - b.note.surahNumber ||
          a.note.ayahNumber - b.note.ayahNumber,
      );
    } else {
      list.sort((a, b) => b.note.updatedAt - a.note.updatedAt);
    }
    if (!searching || !query.trim()) return list;
    // Your own words first: a note matches on its text, its verse number
    // ("2:255") or its surah's name.
    return list.filter(n => {
      const surah = getSurahById(n.note.surahNumber);
      return (
        matchesVerseRef(query, n.note.surahNumber, n.note.ayahNumber) ||
        matchesQuery(query, [
          n.note.content,
          n.surahName,
          surah?.name,
          surah?.translated_name_english,
        ])
      );
    });
  }, [notes, sort, searching, query]);
  const renderHeaderRight = useCallback(
    () =>
      searching ? null : (
        <CollectionHeaderActions
          screen="notes"
          onSearch={() => setSearching(true)}
        />
      ),
    [searching],
  );

  useCollectionNativeHeader({
    title: t('collectionScreen.notes'),
    scrollY,
    hasContent: notes.length > 0 && !loading,
    headerRight: notes.length > 0 ? renderHeaderRight : undefined,
  });
  // @ai-end

  const loadNotes = useCallback(async () => {
    try {
      // @ai `loading` starts true and is not raised again: a refresh (coming
      // back to the screen, closing the note sheet) keeps the list and its
      // scroll position instead of blanking to "Loading…".
      const allNotes = await verseAnnotationService.getAllNotes();
      const enriched = allNotes.map(note => {
        const surah = getSurahById(note.surahNumber);
        return {
          note,
          surahName: surah
            ? getSurahDisplayName(surah)
            : i18n.t('common:labels.surahNumber', {number: note.surahNumber}),
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
      openingRef.current = false; // @ai: ignores taps after one opened the reader
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

  // @ai-start
  const handleNotePress = useCallback(
    async (item: NoteData) => {
      // show() resolves when the sheet has closed. The sheet saves or deletes
      // straight in the database and a sheet does not change screen focus, so
      // without this reload the row kept its old text, and a deleted note
      // stayed listed and reopened as an empty "Add note" form.
      await showSheet('verse-note', {
        payload: {
          verseKey: item.note.verseKey,
          surahNumber: item.note.surahNumber,
          ayahNumber: item.note.ayahNumber,
          verseKeys: item.note.verseKeys, // a range note keeps its range title
          noteId: item.note.id,
          // The note's own rewayah names its verses (decision 3): the sheet
          // labels them at once instead of after loading the note. A legacy
          // note without one is a Hafs note (verse-units contract section 3),
          // labelled from the first render as before Release 1.
          rewayah: item.note.rewayahId ?? 'hafs',
        },
      });
      await loadNotes();
    },
    [loadNotes],
  );
  // @ai-end

  // @ai-start
  const handleOpenVerse = useCallback(
    (note: VerseNote) => {
      if (openingRef.current) return;
      openingRef.current = true;
      router.push({
        pathname: '/mushaf',
        params: savedVerseRouteParams(note),
      });
    },
    [router],
  );
  // @ai-end

  // @ai-start
  const buildOptions = useCallback(
    (item: NoteData): CollectionOptionsPayload => ({
      title: item.surahName,
      // @ai: the ayah in the numbering of the rewayah it was saved in
      subtitle: savedVerseSubtitle(
        describeSavedVerseNow(item.note),
        item.note.ayahNumber,
        number => t('common:labels.ayahNumber', {number}),
      ),
      options: [
        {
          label: t('notesScreen.openVerse'),
          icon: 'book-open',
          onPress: () => handleOpenVerse(item.note),
        },
        {
          label: t('notesScreen.editNote'),
          icon: 'edit-2',
          onPress: () => handleNotePress(item),
        },
        {
          label: t('notesScreen.deleteNote'),
          icon: 'minus-circle',
          destructive: true,
          onPress: () => handleDeleteNote(item.note),
        },
      ],
    }),
    [handleDeleteNote, handleNotePress, handleOpenVerse, t],
  );

  const handleOptionsPress = useCallback(
    (item: NoteData) => {
      showSheet('collection-options', {payload: buildOptions(item)});
    },
    [buildOptions],
  );
  // @ai-end

  // @ai-start
  const listHeader = searching ? (
    <CollectionSearchField
      value={query}
      onChangeText={setQuery}
      onCancel={() => {
        setSearching(false);
        setQuery('');
      }}
      placeholder={t('collectionScreen.search.placeholderIn', {
        name: t('collectionScreen.notes'),
      })}
      resultLabel={
        query.trim()
          ? t('collectionScreen.search.matches', {count: visibleNotes.length})
          : undefined
      }
      style={{
        paddingHorizontal: GRID_PADDING,
        paddingTop: USE_GLASS ? moderateScale(8) : insets.top + 8,
        paddingBottom: moderateScale(12),
      }}
    />
  ) : (
    <CollectionScreenHeader
      category="notes"
      preview={null}
      title={t('collectionScreen.notes')}
      meta={t('collectionScreen.meta.notes', {count: notes.length})}
      actions={renderHeaderRight()}
    />
  );
  // @ai-end

  const renderItem: ListRenderItem<NoteData> = ({item}) => (
    <NoteItem
      surahName={item.surahName}
      ayahNumber={item.note.ayahNumber}
      surahNumber={item.note.surahNumber}
      verseKey={item.note.verseKey}
      verseKeys={item.note.verseKeys}
      notePreview={item.note.content}
      rewayahId={item.note.rewayahId}
      onPress={() => handleNotePress(item)}
      onOptionsPress={() => handleOptionsPress(item)}
      optionsMenu={
        nativeMenus ? (
          <CollectionOptionsMenu
            payload={buildOptions(item)}
            layout="overlay"
          />
        ) : undefined
      }
    />
  );

  const getItemKey = (item: NoteData) => item.note.id;

  if (loading) {
    return (
      <View
        style={[styles.container, {backgroundColor: theme.colors.background}]}>
        {!USE_GLASS && (
          <View style={[styles.emptyHeader, {paddingTop: insets.top}]}>
            {/* @ai-start */}
            {isStackRoot ? (
              <View style={styles.emptyHeaderBack} />
            ) : (
              <Pressable
                style={styles.emptyHeaderBack}
                onPress={() => router.back()}
                hitSlop={8}>
                <Feather
                  name="arrow-left"
                  size={moderateScale(22)}
                  color={theme.colors.text}
                  style={flipX}
                />
              </Pressable>
            )}
            {/* @ai-end */}
            <Text style={[styles.emptyHeaderTitle, {color: theme.colors.text}]}>
              {t('collectionScreen.notes')}
            </Text>
            <View style={styles.emptyHeaderBack} />
          </View>
        )}
        <View style={styles.emptyContent}>
          <Text
            style={[styles.loadingText, {color: theme.colors.textSecondary}]}>
            {t('common:status.loading')}
          </Text>
        </View>
      </View>
    );
  }

  if (notes.length === 0) {
    // @ai The empty screen keeps the full screen's frame.
    return (
      <CollectionEmptyState
        category="notes"
        title={t('collectionScreen.notes')}
        meta={t('collectionScreen.emptyState.notes.meta')}
        heading={t('collectionScreen.emptyState.notes.heading')}
        message={t('collectionScreen.emptyState.notes.message')}
        showBack={!isStackRoot}
        link={{
          label: t('collectionScreen.emptyState.notes.link'),
          onPress: () => router.push('/mushaf' as never),
        }}
      />
    );
  }

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <StatusBar barStyle="default" />

      {/* Not at the stack root: nothing to go back to. @ai */}
      {!USE_GLASS && !isStackRoot && (
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
            <BackIcon
              size={moderateScale(24)}
              color={theme.colors.text}
              style={flipX}
            />
          </Pressable>
        </RNAnimated.View>
      )}

      <RNAnimated.FlatList
        data={visibleNotes} // @ai
        renderItem={renderItem}
        keyExtractor={getItemKey}
        ListHeaderComponent={listHeader} // @ai
        keyboardShouldPersistTaps="handled" // @ai
        keyboardDismissMode="on-drag" // @ai
        contentContainerStyle={[
          styles.listContentContainer,
          {paddingBottom: listBottomPadding}, // @ai
        ]}
        onScroll={RNAnimated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: true},
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      />
      {!USE_GLASS && (
        <CollectionStickyHeader
          title={t('collectionScreen.notes')}
          scrollY={scrollY}
        />
      )}
    </View>
  );
};
// @ai-end

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
  heroIconContainer: {
    width: moderateScale(64),
    height: moderateScale(64),
    borderRadius: moderateScale(32),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: moderateScale(12),
  },
  heroIconInner: {
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: moderateScale(28),
    justifyContent: 'center',
    alignItems: 'center',
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
