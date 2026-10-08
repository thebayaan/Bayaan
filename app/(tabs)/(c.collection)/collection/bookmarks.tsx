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
import {USE_GLASS} from '@/hooks/useGlassProps';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {useFocusEffect} from 'expo-router';
import {moderateScale} from 'react-native-size-matters';
import {Feather} from '@expo/vector-icons';
import {ListRenderItem} from 'react-native';
import {getSurahById} from '@/services/dataService';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {BookmarkItem} from '@/components/collection/BookmarkItem';
import {CollectionStickyHeader} from '@/components/collection/CollectionStickyHeader';
import {SheetManager} from 'react-native-actions-sheet';
import Color from 'color';
import {useCollectionNativeHeader} from '@/hooks/useCollectionNativeHeader';
import type {VerseBookmark} from '@/types/verse-annotations';
// @ai-start
import {restoreSavedRewayah} from '@/services/verse-annotations/restoreSavedRewayah';
import {describeSavedVerseNow} from '@/hooks/useSavedVerseDescription';
import {
  savedVerseRouteParams,
  savedVerseSubtitle,
} from '@/services/verse-annotations/unitAnnotations';
// @ai-end

interface BookmarkData {
  bookmark: VerseBookmark;
  surahName: string;
}

const BookmarksScreen = () => {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [bookmarks, setBookmarks] = useState<BookmarkData[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollY = useRef(new RNAnimated.Value(0)).current;
  // Ignore taps while a bookmark is opening: a second tap during the rewayah
  // load would start a competing switch.
  const openingRef = useRef(false); // @ai

  useCollectionNativeHeader({
    title: 'Bookmarks',
    scrollY,
    hasContent: bookmarks.length > 0 && !loading,
  });

  const loadBookmarks = useCallback(async () => {
    try {
      setLoading(true);
      const allBookmarks = await verseAnnotationService.getAllBookmarks();
      const enriched = allBookmarks.map(bookmark => {
        const surah = getSurahById(bookmark.surahNumber);
        return {
          bookmark,
          surahName: surah?.name ?? `Surah ${bookmark.surahNumber}`,
        };
      });
      setBookmarks(enriched);
    } catch (error) {
      console.error('Failed to load bookmarks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBookmarks();
    }, [loadBookmarks]),
  );

  const handleRemoveBookmark = useCallback(async (bookmark: VerseBookmark) => {
    await verseAnnotationService.removeBookmark(bookmark.verseKey);
    useVerseAnnotationsStore.getState().removeBookmark(bookmark.verseKey);
    setBookmarks(prev => prev.filter(b => b.bookmark.id !== bookmark.id));
  }, []);

  // @ai-start
  const handleOpenBookmark = useCallback(
    async (bookmark: VerseBookmark) => {
      if (openingRef.current) return;
      openingRef.current = true;
      try {
        const verseKey = `${bookmark.surahNumber}:${bookmark.ayahNumber}`;
        const surahStartPages = digitalKhattDataService.getSurahStartPages();
        const fallbackPage = surahStartPages[bookmark.surahNumber] || 1;
        // Restore the rewayah the bookmark was saved in so the opened verse
        // matches what the user was reading at save time.
        await restoreSavedRewayah(bookmark.rewayahId);
        const page = digitalKhattDataService.getPageForVerse(verseKey);
        // The page of the anchor's Hafs verse is the page the saved verse
        // starts on. A bookmark saved in a non-Hafs rewayah also passes its
        // anchor, so the mushaf selects exactly that rewayah verse (the two
        // parts of a split Hafs verse are different bookmarks).
        router.push({
          pathname: '/mushaf',
          params: savedVerseRouteParams(bookmark, page || fallbackPage),
        });
      } finally {
        openingRef.current = false;
      }
    },
    [router],
  );
  // @ai-end

  const handleOptionsPress = useCallback(
    (item: BookmarkData) => {
      SheetManager.show('collection-options', {
        payload: {
          title: item.surahName,
          // @ai: the ayah in the numbering of the rewayah it was saved in
          subtitle: savedVerseSubtitle(
            describeSavedVerseNow(item.bookmark),
            item.bookmark.ayahNumber,
          ),
          options: [
            {
              label: 'Remove Bookmark',
              icon: 'minus-circle',
              destructive: true,
              onPress: () => handleRemoveBookmark(item.bookmark),
            },
          ],
        },
      });
    },
    [handleRemoveBookmark],
  );

  const heroOuterBg = Color(theme.colors.textSecondary).alpha(0.1).toString();
  const heroInnerBg = Color(theme.colors.textSecondary).alpha(0.08).toString();

  const ListHeaderComponent = useCallback(() => {
    return (
      <View style={styles.headerContainer}>
        <View style={{paddingTop: USE_GLASS ? 0 : insets.top}} />
        <View style={styles.headerContent}>
          <View
            style={[styles.heroIconContainer, {backgroundColor: heroOuterBg}]}>
            <View
              style={[styles.heroIconInner, {backgroundColor: heroInnerBg}]}>
              <Feather
                name="bookmark"
                size={moderateScale(30)}
                color={theme.colors.text}
              />
            </View>
          </View>
          <Text style={[styles.headerTitle, {color: theme.colors.text}]}>
            Bookmarks
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              {color: theme.colors.textSecondary},
            ]}>
            {bookmarks.length}{' '}
            {bookmarks.length === 1 ? 'bookmark' : 'bookmarks'}
          </Text>
        </View>
      </View>
    );
  }, [bookmarks.length, insets.top, theme, heroOuterBg, heroInnerBg]);

  const renderItem: ListRenderItem<BookmarkData> = ({item}) => (
    <BookmarkItem
      surahName={item.surahName}
      ayahNumber={item.bookmark.ayahNumber}
      surahNumber={item.bookmark.surahNumber}
      verseKey={item.bookmark.verseKey}
      rewayahId={item.bookmark.rewayahId}
      onPress={() => handleOpenBookmark(item.bookmark)} // @ai
      onOptionsPress={() => handleOptionsPress(item)}
    />
  );

  const getItemKey = (item: BookmarkData) => item.bookmark.id;

  if (loading) {
    return (
      <View
        style={[styles.container, {backgroundColor: theme.colors.background}]}>
        {!USE_GLASS && (
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
              Bookmarks
            </Text>
            <View style={styles.emptyHeaderBack} />
          </View>
        )}
        <View style={styles.emptyContent}>
          <Text
            style={[styles.loadingText, {color: theme.colors.textSecondary}]}>
            Loading...
          </Text>
        </View>
      </View>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <View
        style={[styles.container, {backgroundColor: theme.colors.background}]}>
        {!USE_GLASS && (
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
              Bookmarks
            </Text>
            <View style={styles.emptyHeaderBack} />
          </View>
        )}
        <View style={styles.emptyContent}>
          <View style={styles.emptyIcon}>
            <Feather
              name="bookmark"
              size={moderateScale(48)}
              color={theme.colors.textSecondary}
            />
          </View>
          <Text style={[styles.emptyTitle, {color: theme.colors.text}]}>
            No bookmarks yet
          </Text>
          <Text
            style={[styles.emptySubtitle, {color: theme.colors.textSecondary}]}>
            Bookmark verses to see them here
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <StatusBar barStyle="default" />

      {!USE_GLASS && (
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
      )}

      <RNAnimated.FlatList
        data={bookmarks}
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
        contentInsetAdjustmentBehavior="automatic"
      />
      {!USE_GLASS && (
        <CollectionStickyHeader title="Bookmarks" scrollY={scrollY} />
      )}
    </View>
  );
};

export default BookmarksScreen;

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
