import React, {useCallback, useMemo, useState} from 'react';
import {View, Text, Pressable, Alert} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useRouter} from 'expo-router';
import {Icon} from '@rneui/themed';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {useUploadsStore, getCustomReciterName} from '@/store/uploadsStore';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {createUserUploadTrack} from '@/utils/track';
import {getSurahById, getReciterName} from '@/services/dataService';
import {SheetManager} from 'react-native-actions-sheet';
import type {UploadedRecitation} from '@/types/uploads';

interface ReciterUploadsSectionProps {
  reciterId: string;
  reciterName: string;
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

export const ReciterUploadsSection: React.FC<ReciterUploadsSectionProps> = ({
  reciterId,
  reciterName,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
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

  const handleSeeAll = useCallback(() => {
    router.push('/collection/uploads');
  }, [router]);

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

  const [expanded, setExpanded] = useState(false);
  const COLLAPSED_COUNT = 3;

  if (uploads.length === 0) return null;

  const hasMore = uploads.length > COLLAPSED_COUNT;
  const displayItems = expanded ? uploads : uploads.slice(0, COLLAPSED_COUNT);

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>My Uploads</Text>
        <Pressable onPress={handleSeeAll} style={styles.seeAllButton}>
          <Text style={styles.seeAllText}>See All</Text>
          <Icon
            name="chevron-right"
            type="feather"
            size={moderateScale(14)}
            color={theme.colors.textSecondary}
          />
        </Pressable>
      </View>

      {/* Upload Items */}
      {displayItems.map((item, index) => (
        <View key={item.id} style={styles.itemRow}>
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
      ))}

      {/* Show More / Show Less */}
      {hasMore && (
        <Pressable
          style={styles.showMoreButton}
          onPress={() => setExpanded(prev => !prev)}>
          <Text style={styles.showMoreText}>
            {expanded
              ? 'Show Less'
              : `Show ${uploads.length - COLLAPSED_COUNT} More`}
          </Text>
          <Icon
            name={expanded ? 'chevron-up' : 'chevron-down'}
            type="feather"
            size={moderateScale(14)}
            color={theme.colors.textSecondary}
          />
        </Pressable>
      )}

      {/* Add Recitation Button */}
      <Pressable style={styles.addButton} onPress={handleAddRecitation}>
        <Icon
          name="plus"
          type="feather"
          size={moderateScale(16)}
          color={theme.colors.textSecondary}
        />
        <Text style={styles.addButtonText}>Add Recitation</Text>
      </Pressable>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      paddingHorizontal: moderateScale(16),
      paddingTop: moderateScale(24),
      paddingBottom: moderateScale(16),
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: moderateScale(12),
    },
    headerTitle: {
      fontSize: moderateScale(16),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    seeAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(2),
    },
    seeAllText: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
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
    showMoreButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: moderateScale(8),
      gap: moderateScale(4),
    },
    showMoreText: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
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
