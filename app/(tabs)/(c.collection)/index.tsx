import React, {useCallback, useState} from 'react';
import {View, ScrollView, Text, Pressable} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {moderateScale, ScaledSheet} from 'react-native-size-matters';
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
import {useFocusEffect} from '@react-navigation/native';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import {useBottomInset} from '@/hooks/useBottomInset';
import {USE_GLASS} from '@/hooks/useGlassProps';

interface CategoryItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  count: number;
  emptyText: string;
  route: string;
}

export default function CollectionScreen() {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const bottomInset = useBottomInset();
  const router = useRouter();
  const {lovedTracks} = useLoved();
  const {favoriteReciters} = useFavoriteReciters();
  const downloads = useDownloads();
  const {playlists} = usePlaylists();
  const {totalCount: uploadsTotalCount} = useUploadsStore();

  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [noteCount, setNoteCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      verseAnnotationService
        .getAllBookmarks()
        .then(b => setBookmarkCount(b.length))
        .catch(() => {});
      verseAnnotationService
        .getAllNotes()
        .then(n => setNoteCount(n.length))
        .catch(() => {});
    }, []),
  );

  const handleAddPress = useCallback(() => {
    SheetManager.show('add-to-collection');
  }, []);

  const categories: CategoryItem[] = [
    {
      id: 'playlists',
      label: 'Playlists',
      icon: <PlaylistIcon color="#6366F1" size={moderateScale(22)} />,
      color: '#6366F1',
      count: playlists.length,
      emptyText: 'Create your first playlist',
      route: '/collection/playlists',
    },
    {
      id: 'reciters',
      label: 'Reciters',
      icon: (
        <ProfileIcon color="#3B82F6" size={moderateScale(22)} filled={true} />
      ),
      color: '#3B82F6',
      count: favoriteReciters.length,
      emptyText: 'No favorites yet',
      route: '/collection/favorite-reciters',
    },
    {
      id: 'downloads',
      label: 'Downloads',
      icon: <DownloadIcon color="#10AC84" size={moderateScale(22)} />,
      color: '#10AC84',
      count: downloads.length,
      emptyText: 'No downloads yet',
      route: '/collection/downloads',
    },
    {
      id: 'loved',
      label: 'Loved',
      icon: (
        <HeartIcon color="#FF6B6B" size={moderateScale(22)} filled={true} />
      ),
      color: '#FF6B6B',
      count: lovedTracks.length,
      emptyText: 'No loved surahs yet',
      route: '/collection/loved',
    },
    {
      id: 'bookmarks',
      label: 'Bookmarks',
      icon: (
        <Feather name="bookmark" size={moderateScale(22)} color="#F59E0B" />
      ),
      color: '#F59E0B',
      count: bookmarkCount,
      emptyText: 'No bookmarks yet',
      route: '/collection/bookmarks',
    },
    {
      id: 'notes',
      label: 'Notes',
      icon: (
        <Feather name="file-text" size={moderateScale(22)} color="#3B82F6" />
      ),
      color: '#3B82F6',
      count: noteCount,
      emptyText: 'No notes yet',
      route: '/collection/notes',
    },
    {
      id: 'uploads',
      label: 'Uploads',
      icon: <MicrophoneIcon color="#8B5CF6" size={moderateScale(22)} />,
      color: '#8B5CF6',
      count: uploadsTotalCount,
      emptyText: 'No uploads yet',
      route: '/collection/uploads',
    },
  ];

  return (
    <View style={styles.container} collapsable={false}>
      <ScrollView
        style={styles.content}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior={USE_GLASS ? 'automatic' : 'never'}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: USE_GLASS
            ? moderateScale(16)
            : insets.top + moderateScale(16),
        }}>
        {/* Add to Collection Bar */}
        <Pressable style={styles.addBar} onPress={handleAddPress}>
          <Feather
            name="plus"
            size={moderateScale(16)}
            color={theme.colors.textSecondary}
          />
          <Text
            style={[styles.addBarText, {color: theme.colors.textSecondary}]}>
            Add to Collection
          </Text>
        </Pressable>

        {/* Category List */}
        <View style={styles.categoryList}>
          {categories.map(category => (
            <Pressable
              key={category.id}
              style={styles.categoryRow}
              onPress={() => router.push(category.route as never)}>
              <View
                style={[
                  styles.categoryIcon,
                  {
                    backgroundColor: Color(category.color)
                      .alpha(0.15)
                      .toString(),
                  },
                ]}>
                {category.icon}
              </View>
              <View style={styles.categoryInfo}>
                <Text
                  style={[styles.categoryLabel, {color: theme.colors.text}]}>
                  {category.label}
                </Text>
                <Text
                  style={[
                    styles.categorySubtitle,
                    {color: theme.colors.textSecondary},
                  ]}
                  numberOfLines={1}>
                  {category.count > 0
                    ? `${category.count} ${
                        category.count === 1 ? 'item' : 'items'
                      }`
                    : category.emptyText}
                </Text>
              </View>
              <Feather
                name="chevron-right"
                size={moderateScale(18)}
                color={theme.colors.textSecondary}
              />
            </Pressable>
          ))}
        </View>

        <View style={{height: bottomInset}} />
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
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
