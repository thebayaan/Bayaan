import React, {useCallback, useDeferredValue, useState} from 'react';
import {View, ScrollView} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {moderateScale, ScaledSheet} from '@/utils/scale';
import {Feather} from '@expo/vector-icons';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {useLoved} from '@/hooks/useLoved';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';

import {useDownloads} from '@/services/player/store/downloadSelectors';
import {usePlaylists} from '@/hooks/usePlaylists';
import {SheetManager} from 'react-native-actions-sheet';
import {
  HeartIcon,
  DownloadIcon,
  MicrophoneIcon,
  PlaylistIcon,
  ProfileIcon,
} from '@/components/Icons';
import {useUploadsStore} from '@/store/uploadsStore';
import {useFocusEffect} from 'expo-router';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import {useLibraryListBottomPadding} from '@/hooks/useBottomInset';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {LinearGradient} from 'expo-linear-gradient';
// @ai-start
import {useTranslation} from 'react-i18next';
import {useResponsive} from '@/hooks/useResponsive';
import {TabletCollectionHome} from '@/components/collection/TabletCollectionHome';
import {
  CollectionHomeList,
  type CollectionHomeCategory,
} from '@/components/collection/CollectionHomeList';
import {getSurahById} from '@/services/dataService';
import {
  getReciterDisplayName,
  getSurahDisplayName,
  localizeDigits,
} from '@/i18n/format';
import {useCollectionPreviews} from '@/hooks/useCollectionPreviews';
import {CollectionSearchField} from '@/components/collection/CollectionScreenHeader';
import {CollectionSearchResults} from '@/components/collection/CollectionSearchResults';
import type {VerseBookmark, VerseNote} from '@/types/verse-annotations';
// @ai-end

type CategoryItem = CollectionHomeCategory;

// @ai-start
export default function CollectionScreen() {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const bottomPadding = useLibraryListBottomPadding();
  const {t} = useTranslation(['collection', 'common']);
  const {isTablet} = useResponsive();
  const {lovedTracks} = useLoved();
  const {favoriteReciters} = useFavoriteReciters();
  const downloads = useDownloads();
  const {playlists} = usePlaylists();
  const {totalCount: uploadsTotalCount} = useUploadsStore();

  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [noteCount, setNoteCount] = useState(0);
  const [recentBookmarks, setRecentBookmarks] = useState<VerseBookmark[]>([]);
  const [latestNote, setLatestNote] = useState<VerseNote | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  // Results follow the typing a beat behind, so the field stays quick.
  const deferredQuery = useDeferredValue(query);
  const previews = useCollectionPreviews();

  useFocusEffect(
    useCallback(() => {
      verseAnnotationService
        .getAllBookmarks()
        .then(b => {
          setBookmarkCount(b.length);
          setRecentBookmarks(
            [...b].sort((x, y) => y.createdAt - x.createdAt).slice(0, 2),
          );
        })
        .catch(() => {
          /* keep the last counts if the read fails */
        });
      verseAnnotationService
        .getAllNotes()
        .then(n => {
          setNoteCount(n.length);
          setLatestNote(
            n.reduce<VerseNote | null>(
              (a, x) => (!a || x.updatedAt > a.updatedAt ? x : a),
              null,
            ),
          );
        })
        .catch(() => {
          /* keep the last counts if the read fails */
        });
    }, []),
  );

  const handleAddPress = useCallback(() => {
    SheetManager.show('add-to-collection');
  }, []);

  // Live summaries: what's inside each category, newest first.
  const summarize = (names: string[], total: number): string | undefined => {
    const [a, b] = names;
    if (!a) return undefined;
    if (!b || total <= 1) return a;
    if (total === 2) return t('collectionScreen.summary.two', {a, b});
    return t('collectionScreen.summary.more', {
      a,
      b,
      count: total - 2,
    });
  };
  const verseLabel = (surahNumber: number, ayahNumber: number) => {
    const surah = getSurahById(surahNumber);
    const ref = localizeDigits(`${surahNumber}:${ayahNumber}`);
    return surah ? `${getSurahDisplayName(surah)} ${ref}` : ref;
  };

  const lovedNewest = [...lovedTracks].sort(
    (x, y) => y.timestamp - x.timestamp,
  );
  const lovedNames: string[] = [];
  lovedNewest.forEach(track => {
    const surah = getSurahById(Number(track.surahId));
    const name = surah ? getSurahDisplayName(surah) : track.surahId;
    if (!lovedNames.includes(name)) lovedNames.push(name);
  });
  const completedDownloads = downloads.filter(d => d.status === 'completed');
  const downloadBytes = completedDownloads.reduce(
    (sum, d) => sum + (d.fileSize || 0),
    0,
  );
  const downloadsSummary =
    completedDownloads.length > 0
      ? t('collectionScreen.summary.downloads', {
          surahs: t('common:counts.surahs', {
            count: completedDownloads.length,
          }),
          size:
            downloadBytes >= 1024 * 1024 * 1024
              ? t('collectionScreen.summary.sizeGB', {
                  size: localizeDigits(
                    (downloadBytes / (1024 * 1024 * 1024)).toFixed(1),
                  ),
                })
              : t('collectionScreen.summary.sizeMB', {
                  size: localizeDigits(
                    Math.max(1, Math.round(downloadBytes / (1024 * 1024))),
                  ),
                }),
        })
      : undefined;

  const recitersNewest = [...favoriteReciters].sort(
    (x, y) => y.favoritedAt - x.favoritedAt,
  );
  const categories: CategoryItem[] = [
    {
      id: 'playlists',
      label: t('common:terms.playlists'),
      icon: <PlaylistIcon color="#6366F1" size={moderateScale(22)} />,
      color: '#6366F1',
      count: playlists.length,
      emptyText: t('collectionScreen.empty.playlists'),
      route: '/collection/playlists',
      previewData: previews.playlists,
      summary: summarize(
        playlists.map(p => p.name),
        playlists.length,
      ),
    },
    {
      id: 'reciters',
      label: t('common:terms.reciters'),
      icon: (
        <ProfileIcon color="#EC4899" size={moderateScale(22)} filled={true} />
      ),
      color: '#EC4899',
      count: favoriteReciters.length,
      emptyText: t('collectionScreen.empty.reciters'),
      route: '/collection/favorite-reciters',
      summary:
        recitersNewest.length === 0
          ? undefined
          : recitersNewest.length === 1
            ? getReciterDisplayName(recitersNewest[0])
            : t('collectionScreen.summary.firstAndMoreReciters', {
                a: getReciterDisplayName(recitersNewest[0]),
                count: recitersNewest.length - 1,
              }),
      previewData: previews.reciters,
    },
    {
      id: 'downloads',
      label: t('common:terms.downloads'),
      icon: <DownloadIcon color="#10AC84" size={moderateScale(22)} />,
      color: '#10AC84',
      emptyText: t('collectionScreen.empty.downloads'),
      route: '/collection/downloads',
      previewData: previews.downloads,
      count: completedDownloads.length,
      summary: downloadsSummary,
    },
    {
      id: 'loved',
      label: t('collectionScreen.loved'),
      icon: (
        <HeartIcon color="#FF6B6B" size={moderateScale(22)} filled={true} />
      ),
      color: '#FF6B6B',
      count: lovedTracks.length,
      emptyText: t('collectionScreen.empty.loved'),
      route: '/collection/loved',
      summary:
        lovedNames.length > 0
          ? t('collectionScreen.summary.countThenNames', {
              countText: t('common:counts.tracks', {count: lovedTracks.length}),
              names: lovedNames.join(t('collectionScreen.summary.separator')),
            })
          : undefined,
      previewData: previews.loved,
    },
    {
      id: 'bookmarks',
      label: t('common:terms.bookmarks'),
      icon: (
        <Feather name="bookmark" size={moderateScale(22)} color="#F59E0B" />
      ),
      color: '#F59E0B',
      count: bookmarkCount,
      emptyText: t('collectionScreen.empty.bookmarks'),
      route: '/collection/bookmarks',
      previewData: previews.bookmarks,
      summary: summarize(
        recentBookmarks.map(b => verseLabel(b.surahNumber, b.ayahNumber)),
        bookmarkCount,
      ),
    },
    {
      id: 'notes',
      label: t('collectionScreen.notes'),
      icon: (
        <Feather name="file-text" size={moderateScale(22)} color="#3B82F6" />
      ),
      color: '#3B82F6',
      count: noteCount,
      emptyText: t('collectionScreen.empty.notes'),
      route: '/collection/notes',
      previewData: previews.notes,
      summary: latestNote
        ? t('collectionScreen.summary.quote', {
            text: latestNote.content.split('\n')[0],
          })
        : undefined,
    },
    {
      id: 'uploads',
      label: t('common:terms.uploads'),
      icon: <MicrophoneIcon color="#8B5CF6" size={moderateScale(22)} />,
      color: '#8B5CF6',
      count: uploadsTotalCount,
      emptyText: t('collectionScreen.empty.uploads'),
      route: '/collection/uploads',
      previewData: previews.uploads,
      summary: t('uploadsScreen.recitationsCount', {
        count: uploadsTotalCount,
      }),
    },
  ];

  if (isTablet) {
    return (
      <TabletCollectionHome
        categories={categories}
        playlists={playlists}
        onAdd={handleAddPress}
      />
    );
  }

  return (
    <View style={styles.container} collapsable={false}>
      <ScrollView
        style={styles.content}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior={USE_GLASS ? 'automatic' : 'never'}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          paddingTop: USE_GLASS
            ? moderateScale(16)
            : insets.top + moderateScale(16),
          paddingBottom: bottomPadding,
        }}>
        <CollectionHomeList
          categories={categories}
          onAdd={handleAddPress}
          searching={searching}
          onStartSearch={() => setSearching(true)}
          search={
            <CollectionSearchField
              value={query}
              onChangeText={setQuery}
              onCancel={() => {
                setSearching(false);
                setQuery('');
              }}
              placeholder={t('collectionScreen.search.placeholder')}
            />
          }
          results={<CollectionSearchResults query={deferredQuery} />}
        />
      </ScrollView>
      {/* A soft fade from the background under the clock, so the list
          melts away there instead of running under the status bar. It
          matches the background, so at rest it can't be seen. */}
      <LinearGradient
        pointerEvents="none"
        colors={[
          theme.colors.background,
          theme.colors.background,
          Color(theme.colors.background).alpha(0).string(),
        ]}
        locations={[0, 0.55, 1]}
        style={[
          styles.statusBarScrim,
          {height: insets.top + moderateScale(20)},
        ]}
      />
    </View>
  );
}
// @ai-end

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    previewRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    cover: {
      width: '28@ms',
      height: '28@ms',
      borderRadius: '7@ms',
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    coverGlyph: {
      fontFamily: 'SurahNames',
      fontSize: '11@ms',
      color: '#FFFFFF',
      width: '100%',
      textAlign: 'center',
    },
    face: {
      width: '26@ms',
      height: '26@ms',
      borderRadius: '13@ms',
      borderWidth: 1.5,
      overflow: 'hidden',
    },
    faceImage: {
      width: '100%',
      height: '100%',
    },
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: moderateScale(56),
      zIndex: 100,
    },
    blurContainer: {
      overflow: 'hidden',
      borderWidth: 0.1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    content: {
      flex: 1,
    },
    statusBarScrim: {
      position: 'absolute',
      top: 0,
      start: 0,
      end: 0,
    },
    addBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: moderateScale(12),
      marginHorizontal: moderateScale(16),
      marginBottom: moderateScale(16),
      borderRadius: moderateScale(12),
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      gap: moderateScale(8),
    },
    addBarText: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-SemiBold',
    },
    categoryList: {
      paddingHorizontal: moderateScale(16),
    },
    categoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(8),
    },
    categoryIcon: {
      width: moderateScale(46),
      height: moderateScale(46),
      borderRadius: moderateScale(12),
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: moderateScale(14),
    },
    categoryInfo: {
      flex: 1,
      justifyContent: 'center',
    },
    categoryLabel: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      marginBottom: moderateScale(2),
    },
    categorySubtitle: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Regular',
    },
  });
