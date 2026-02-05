import React, {useState, useCallback, useMemo, useEffect} from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  ListRenderItemInfo,
  Alert,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {moderateScale} from 'react-native-size-matters';
import {LinearGradient} from 'expo-linear-gradient';
import {Icon} from '@rneui/themed';
import {MicrophoneIcon} from '@/components/Icons';
import {CollectionCard} from '@/components/CollectionCard';
import {FilterBar} from '@/components/collection/FilterBar';
import {SheetManager} from 'react-native-actions-sheet';
import {useUploadsStore} from '@/store/uploadsStore';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {createUserUploadTrack} from '@/utils/track';
import {getSurahById, getReciterName} from '@/services/dataService';
import Color from 'color';
import type {UploadedRecitation} from '@/types/uploads';

const UPLOAD_FILTERS = [
  {id: 'all', label: 'All'},
  {id: 'untagged', label: 'Untagged'},
  {id: 'reciters', label: 'Reciters'},
  {id: 'other', label: 'Other'},
];

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return 'Unknown';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getDisplayTitle(item: UploadedRecitation): string {
  if (item.type === 'surah' && item.surahNumber) {
    const surah = getSurahById(item.surahNumber);
    if (surah) return surah.name;
  }
  if (item.type === 'other' && item.title) {
    return item.title;
  }
  return item.originalFilename;
}

function getDisplaySubtitle(item: UploadedRecitation): string {
  const parts: string[] = [];

  if (item.reciterId) {
    const name = getReciterName(item.reciterId);
    if (name) parts.push(name);
  }

  if (item.type === null) {
    parts.push('Untagged');
  } else if (item.type === 'other' && item.category) {
    const label =
      item.category.charAt(0).toUpperCase() + item.category.slice(1);
    parts.push(label);
  }

  return parts.length > 0 ? parts.join(' · ') : item.originalFilename;
}

export default function UploadsScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    recitations,
    totalCount,
    importFile,
    importFiles,
    loadRecitations,
    deleteRecitation,
  } = useUploadsStore();
  const {updateQueue, play} = useUnifiedPlayer();

  const [activeFilter, setActiveFilter] = useState<string>('');

  useEffect(() => {
    loadRecitations();
  }, [loadRecitations]);

  const filteredRecitations = useMemo(() => {
    const filterId = activeFilter || 'all';

    switch (filterId) {
      case 'untagged':
        return recitations.filter(r => r.type === null);
      case 'reciters':
        return recitations.filter(
          r => r.reciterId !== null || r.customReciterId !== null,
        );
      case 'other':
        return recitations.filter(r => r.type === 'other');
      case 'all':
      default:
        return recitations;
    }
  }, [recitations, activeFilter]);

  const handleImportFile = useCallback(async () => {
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
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const files = result.assets.map(asset => ({
        uri: asset.uri,
        name: asset.name || 'Unknown',
      }));

      if (files.length === 1) {
        const recitation = await importFile(files[0].uri, files[0].name);
        Alert.alert('File Imported', recitation.originalFilename, [
          {text: 'Done'},
          {
            text: 'Organize',
            onPress: () => handleOrganize(recitation),
          },
        ]);
      } else if (files.length > 1) {
        await importFiles(files);
      }
    } catch (error) {
      console.error('Error importing files:', error);
    }
  }, [importFile, importFiles]);

  const handlePlayRecitation = useCallback(
    async (item: UploadedRecitation, index: number) => {
      try {
        const tracks = filteredRecitations.map(createUserUploadTrack);
        await updateQueue(tracks, index);
        await play();
      } catch (error) {
        console.error('Error playing uploaded recitation:', error);
      }
    },
    [filteredRecitations, updateQueue, play],
  );

  const handleFilterChange = useCallback((filterId: string) => {
    setActiveFilter(filterId);
  }, []);

  const handleOrganize = useCallback((item: UploadedRecitation) => {
    SheetManager.show('organize-recitation', {
      payload: {recitation: item},
    });
  }, []);

  const handleDeleteWithConfirm = useCallback(
    (item: UploadedRecitation) => {
      Alert.alert(
        'Delete Recitation',
        `Are you sure you want to delete "${item.originalFilename}"?`,
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
    [deleteRecitation],
  );

  const handleLongPress = useCallback(
    (item: UploadedRecitation, index: number) => {
      Alert.alert(item.originalFilename, undefined, [
        {
          text: 'Play Now',
          onPress: () => handlePlayRecitation(item, index),
        },
        {
          text: 'Organize',
          onPress: () => handleOrganize(item),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteWithConfirm(item),
        },
        {text: 'Cancel', style: 'cancel'},
      ]);
    },
    [handlePlayRecitation, handleOrganize, handleDeleteWithConfirm],
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerContainer: {
      width: '100%',
      overflow: 'hidden',
    },
    gradientContainer: {
      width: '100%',
      alignItems: 'center',
      paddingBottom: moderateScale(20),
      overflow: 'hidden',
      backgroundColor: '#8B5CF6',
    },
    contentContainer: {
      paddingHorizontal: moderateScale(16),
      paddingBottom: moderateScale(10),
    },
    listContentContainer: {
      flexGrow: 1,
      paddingBottom: moderateScale(65),
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: moderateScale(60),
      paddingHorizontal: moderateScale(32),
    },
    emptyText: {
      fontSize: moderateScale(16),
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: moderateScale(24),
    },
    backButton: {
      position: 'absolute',
      zIndex: 10,
    },
    addButton: {
      position: 'absolute',
      zIndex: 10,
    },
    // SurahItem-style row layout
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    itemPlayZone: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(8),
      paddingLeft: moderateScale(12),
    },
    itemIconContainer: {
      width: moderateScale(44),
      height: moderateScale(44),
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
    itemSecondaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(4),
      marginBottom: moderateScale(2),
    },
    itemSecondaryText: {
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
    itemTertiaryText: {
      fontSize: moderateScale(10),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
    },
    itemOptionsZone: {
      width: '20%',
      minWidth: moderateScale(50),
      maxWidth: moderateScale(70),
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: moderateScale(8),
      paddingRight: moderateScale(12),
      alignSelf: 'stretch',
    },
    filterContainer: {
      paddingTop: moderateScale(4),
      paddingBottom: moderateScale(8),
    },
  });

  const renderItem = useCallback(
    ({item, index}: ListRenderItemInfo<UploadedRecitation>) => {
      const displayTitle = getDisplayTitle(item);
      const displaySubtitle = getDisplaySubtitle(item);
      const duration = formatDuration(item.duration);

      return (
        <View style={styles.itemRow}>
          <Pressable
            style={styles.itemPlayZone}
            onPress={() => handlePlayRecitation(item, index)}
            onLongPress={() => handleLongPress(item, index)}>
            <View style={styles.itemIconContainer}>
              <Icon
                name="music"
                type="feather"
                size={moderateScale(18)}
                color={theme.colors.textSecondary}
              />
            </View>
            <View style={styles.itemInfoContainer}>
              <Text
                style={styles.itemName}
                numberOfLines={1}
                ellipsizeMode="middle">
                {displayTitle}
              </Text>
              <View style={styles.itemSecondaryRow}>
                <Text style={styles.itemSecondaryText} numberOfLines={1}>
                  {displaySubtitle}
                </Text>
              </View>
              {item.rewayah && (
                <Text style={styles.itemTertiaryText}>
                  {item.rewayah}
                  {item.style ? ` · ${item.style}` : ''}
                </Text>
              )}
            </View>
          </Pressable>
          <Pressable
            style={styles.itemOptionsZone}
            onPress={() => handleOrganize(item)}>
            <Icon
              name="more-horizontal"
              type="feather"
              size={moderateScale(18)}
              color={theme.colors.text}
            />
          </Pressable>
        </View>
      );
    },
    [
      styles,
      theme.colors.textSecondary,
      theme.colors.text,
      handlePlayRecitation,
      handleLongPress,
      handleOrganize,
    ],
  );

  const keyExtractor = useCallback((item: UploadedRecitation) => item.id, []);

  const ListHeaderComponent = useCallback(() => {
    return (
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={['#8B5CF6', theme.colors.background] as [string, string]}
          style={[
            styles.gradientContainer,
            {paddingTop: insets.top + moderateScale(20)},
          ]}>
          <CollectionCard
            icon={
              <MicrophoneIcon
                color={theme.colors.text}
                size={moderateScale(80)}
              />
            }
            title="Uploads"
            subtitle={`${totalCount} recitation${totalCount !== 1 ? 's' : ''}`}
          />
        </LinearGradient>
        <View style={[styles.contentContainer, styles.filterContainer]}>
          <FilterBar
            filters={UPLOAD_FILTERS}
            activeFilter={activeFilter}
            onFilterChange={handleFilterChange}
            theme={theme}
          />
        </View>
      </View>
    );
  }, [
    styles.headerContainer,
    styles.gradientContainer,
    styles.contentContainer,
    styles.filterContainer,
    theme,
    insets.top,
    totalCount,
    activeFilter,
    handleFilterChange,
  ]);

  const ListEmptyComponent = useCallback(() => {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          No uploads yet. Tap + to add recitations.
        </Text>
      </View>
    );
  }, [styles.emptyContainer, styles.emptyText]);

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredRecitations}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        contentContainerStyle={styles.listContentContainer}
        bounces={false}
        showsVerticalScrollIndicator={false}
      />
      <View
        style={[
          styles.backButton,
          {
            top: insets.top + moderateScale(10),
            left: moderateScale(15),
          },
        ]}>
        <Pressable onPress={() => router.back()}>
          <Icon
            name="arrow-left"
            type="feather"
            size={moderateScale(24)}
            color="white"
          />
        </Pressable>
      </View>
      <View
        style={[
          styles.addButton,
          {
            top: insets.top + moderateScale(10),
            right: moderateScale(15),
          },
        ]}>
        <Pressable onPress={handleImportFile}>
          <Icon
            name="plus"
            type="feather"
            size={moderateScale(24)}
            color="white"
          />
        </Pressable>
      </View>
    </View>
  );
}
