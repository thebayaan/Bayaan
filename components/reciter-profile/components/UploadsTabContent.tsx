import React, {useCallback, useMemo} from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  Alert,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Icon} from '@rneui/themed';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {useUploadsStore} from '@/store/uploadsStore';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {createUserUploadTrack} from '@/utils/track';
import {getSurahById} from '@/services/dataService';
import {SheetManager} from 'react-native-actions-sheet';
import {UploadCard} from './UploadCard';
import type {UploadedRecitation} from '@/types/uploads';

interface UploadsTabContentProps {
  reciterId: string;
  reciterName: string;
  viewMode: 'card' | 'list';
  showLovedOnly: boolean;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  ListHeaderComponent: React.ReactElement;
  getColorForSurah: (id: number) => string;
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '');
}

function getDisplayTitle(item: UploadedRecitation): string {
  if (item.type === 'surah' && item.surahNumber) {
    const surah = getSurahById(item.surahNumber);
    if (surah) return surah.name;
  }
  if (item.type === 'other' && item.title) {
    return item.title;
  }
  return stripExtension(item.originalFilename);
}

function getDisplaySubtitle(item: UploadedRecitation): string {
  const parts: string[] = [];

  if (item.type === null) {
    parts.push('Untagged');
  } else if (item.type === 'surah' && item.surahNumber) {
    const surah = getSurahById(item.surahNumber);
    if (surah) parts.push(surah.translated_name_english);
  } else if (item.type === 'other' && item.category) {
    const label =
      item.category.charAt(0).toUpperCase() + item.category.slice(1);
    parts.push(label);
  }

  if (item.duration !== null) {
    const mins = Math.floor(item.duration / 60);
    const secs = Math.floor(item.duration % 60);
    parts.push(`${mins}:${secs.toString().padStart(2, '0')}`);
  }

  return parts.join(' · ');
}

export const UploadsTabContent: React.FC<UploadsTabContentProps> = ({
  reciterId,
  reciterName,
  viewMode,
  showLovedOnly,
  onScroll,
  ListHeaderComponent,
  getColorForSurah,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {updateQueue, play} = useUnifiedPlayer();
  const {importFile, getByReciter, deleteRecitation} = useUploadsStore();

  const uploads = getByReciter(reciterId);

  const handlePlay = useCallback(
    async (item: UploadedRecitation, index: number) => {
      try {
        const tracks = uploads.map(createUserUploadTrack);
        await updateQueue(tracks, index);
        await play();
      } catch (error) {
        console.error('Error playing uploaded recitation:', error);
      }
    },
    [uploads, updateQueue, play],
  );

  const handleOrganize = useCallback(
    (item: UploadedRecitation) => {
      SheetManager.show('organize-recitation', {
        payload: {recitation: item, prefillReciterId: reciterId},
      });
    },
    [reciterId],
  );

  const handleLongPress = useCallback(
    (item: UploadedRecitation, index: number) => {
      Alert.alert(stripExtension(item.originalFilename), undefined, [
        {
          text: 'Play Now',
          onPress: () => handlePlay(item, index),
        },
        {
          text: 'Organize',
          onPress: () => handleOrganize(item),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete Recitation',
              `Are you sure you want to delete "${stripExtension(item.originalFilename)}"?`,
              [
                {text: 'Cancel', style: 'cancel'},
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => deleteRecitation(item.id),
                },
              ],
            );
          },
        },
        {text: 'Cancel', style: 'cancel'},
      ]);
    },
    [handlePlay, handleOrganize, deleteRecitation],
  );

  const handleAddRecitation = useCallback(async () => {
    try {
      const DocumentPicker = await import('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'audio/mpeg',
          'audio/mp4',
          'audio/x-m4a',
          'audio/wav',
          'audio/aac',
        ],
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      const recitation = await importFile(asset.uri, asset.name || 'Unknown');
      SheetManager.show('organize-recitation', {
        payload: {recitation, prefillReciterId: reciterId},
      });
    } catch (error) {
      console.error('Error importing file:', error);
    }
  }, [importFile, reciterId]);

  const renderCardItem = useCallback(
    ({item, index}: {item: UploadedRecitation; index: number}) => (
      <UploadCard
        title={getDisplayTitle(item)}
        subtitle={getDisplaySubtitle(item)}
        onPress={() => handlePlay(item, index)}
        onLongPress={() => handleLongPress(item, index)}
        color={
          item.surahNumber
            ? getColorForSurah(item.surahNumber)
            : theme.colors.textSecondary
        }
        style={styles.cardItem}
      />
    ),
    [
      handlePlay,
      handleLongPress,
      getColorForSurah,
      theme.colors.textSecondary,
      styles.cardItem,
    ],
  );

  const renderListItem = useCallback(
    ({item, index}: {item: UploadedRecitation; index: number}) => (
      <View style={styles.itemRow}>
        <Pressable
          style={styles.itemPlayZone}
          onPress={() => handlePlay(item, index)}
          onLongPress={() => handleLongPress(item, index)}>
          <View style={styles.itemIconContainer}>
            <Icon
              name="music"
              type="feather"
              size={moderateScale(16)}
              color={theme.colors.textSecondary}
            />
          </View>
          <View style={styles.itemInfoContainer}>
            <Text
              style={styles.itemName}
              numberOfLines={1}
              ellipsizeMode="middle">
              {getDisplayTitle(item)}
            </Text>
            <Text style={styles.itemSubtitle} numberOfLines={1}>
              {getDisplaySubtitle(item)}
            </Text>
          </View>
        </Pressable>
        <Pressable
          style={styles.itemOptionsZone}
          onPress={() => handleOrganize(item)}>
          <Icon
            name="more-horizontal"
            type="feather"
            size={moderateScale(16)}
            color={theme.colors.text}
          />
        </Pressable>
      </View>
    ),
    [handlePlay, handleLongPress, handleOrganize, theme, styles],
  );

  const addButton = useMemo(
    () => (
      <Pressable style={styles.addButton} onPress={handleAddRecitation}>
        <Icon
          name="plus"
          type="feather"
          size={moderateScale(16)}
          color={theme.colors.textSecondary}
        />
        <Text style={styles.addButtonText}>Add Recitation</Text>
      </Pressable>
    ),
    [handleAddRecitation, theme.colors.textSecondary, styles],
  );

  const emptyState = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <Icon
          name="mic"
          type="feather"
          size={moderateScale(40)}
          color={theme.colors.textSecondary}
        />
        <Text style={styles.emptyTitle}>No uploads yet</Text>
        <Text style={styles.emptySubtitle}>
          Upload recitations to see them here
        </Text>
        <Pressable style={styles.emptyAddButton} onPress={handleAddRecitation}>
          <Icon
            name="plus"
            type="feather"
            size={moderateScale(16)}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.addButtonText}>Add Recitation</Text>
        </Pressable>
      </View>
    ),
    [handleAddRecitation, theme.colors.textSecondary, styles],
  );

  if (uploads.length === 0) {
    return (
      <Animated.FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={emptyState}
        onScroll={onScroll}
        scrollEventThrottle={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContentContainer}
      />
    );
  }

  if (viewMode === 'card') {
    return (
      <Animated.FlatList
        data={uploads}
        renderItem={renderCardItem}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        ListHeaderComponent={ListHeaderComponent}
        ListFooterComponent={addButton}
        onScroll={onScroll}
        scrollEventThrottle={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContentContainer}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    );
  }

  return (
    <Animated.FlatList
      data={uploads}
      renderItem={renderListItem}
      keyExtractor={item => item.id}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={addButton}
      onScroll={onScroll}
      scrollEventThrottle={1}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContentContainer}
    />
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    listContentContainer: {
      paddingBottom: moderateScale(80),
    },
    columnWrapper: {
      justifyContent: 'space-between',
      marginBottom: moderateScale(16),
      paddingHorizontal: moderateScale(16),
    },
    cardItem: {
      width: '47%',
    },
    separator: {
      height: moderateScale(4),
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: moderateScale(16),
    },
    itemPlayZone: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(8),
    },
    itemIconContainer: {
      width: moderateScale(40),
      height: moderateScale(40),
      borderRadius: moderateScale(10),
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: moderateScale(10),
    },
    itemInfoContainer: {
      flex: 1,
    },
    itemName: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    itemSubtitle: {
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      marginTop: moderateScale(1),
    },
    itemOptionsZone: {
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(8),
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: moderateScale(40),
      paddingHorizontal: moderateScale(20),
      gap: moderateScale(8),
    },
    emptyTitle: {
      fontSize: moderateScale(16),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      marginTop: moderateScale(8),
    },
    emptySubtitle: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: moderateScale(12),
      marginTop: moderateScale(8),
      marginHorizontal: moderateScale(16),
      borderRadius: moderateScale(12),
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      gap: moderateScale(8),
    },
    emptyAddButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'stretch',
      paddingVertical: moderateScale(12),
      marginTop: moderateScale(8),
      borderRadius: moderateScale(12),
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      gap: moderateScale(8),
    },
    addButtonText: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.textSecondary,
    },
  });
