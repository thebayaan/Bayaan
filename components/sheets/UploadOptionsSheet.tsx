import React, {useCallback, useState} from 'react';
import {View, Text, Pressable, Alert} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {QueueIcon, PlayIcon} from '@/components/Icons';
import ActionSheet, {
  SheetProps,
  SheetManager,
} from 'react-native-actions-sheet';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useUploadsStore, getCustomReciterName} from '@/store/uploadsStore';
import {getSurahById, getReciterName} from '@/services/dataService';
import type {UploadedRecitation} from '@/types/uploads';

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

  if (item.reciterId) {
    const name = getReciterName(item.reciterId);
    if (name) parts.push(name);
  } else if (item.customReciterId) {
    const name = getCustomReciterName(item.customReciterId);
    if (name) parts.push(name);
  }

  if (item.type === null) {
    parts.push('Untagged');
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

export const UploadOptionsSheet = (props: SheetProps<'upload-options'>) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const [pressedOption, setPressedOption] = useState<string | null>(null);

  const {deleteRecitation} = useUploadsStore();

  const payload = props.payload;
  const recitation = payload?.recitation;
  const reciterId = payload?.reciterId;
  const onPlay = payload?.onPlay;
  const onAddToQueue = payload?.onAddToQueue;

  const handleClose = useCallback(() => {
    SheetManager.hide('upload-options');
  }, []);

  const handlePlay = useCallback(() => {
    handleClose();
    onPlay?.();
  }, [onPlay, handleClose]);

  const handleOrganize = useCallback(() => {
    if (!recitation) return;
    handleClose();
    setTimeout(() => {
      SheetManager.show('organize-recitation', {
        payload: {recitation, prefillReciterId: reciterId},
      });
    }, 300);
  }, [recitation, reciterId, handleClose]);

  const handleAddToQueue = useCallback(() => {
    handleClose();
    onAddToQueue?.();
  }, [onAddToQueue, handleClose]);

  const handleDelete = useCallback(() => {
    if (!recitation) return;
    const title = getDisplayTitle(recitation);
    Alert.alert(
      'Delete Recitation',
      `Are you sure you want to delete "${title}"?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            handleClose();
            deleteRecitation(recitation.id);
          },
        },
      ],
    );
  }, [recitation, handleClose, deleteRecitation]);

  if (!recitation) {
    return null;
  }

  const title = getDisplayTitle(recitation);
  const subtitle = getDisplaySubtitle(recitation);

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={styles.optionsGrid}>
          <Pressable
            style={({pressed}) => [
              styles.option,
              pressed && styles.optionPressed,
            ]}
            onPress={handlePlay}>
            <PlayIcon color={theme.colors.text} size={moderateScale(20)} />
            <Text style={styles.optionText}>Play Now</Text>
          </Pressable>

          <Pressable
            style={({pressed}) => [
              styles.option,
              pressed && styles.optionPressed,
            ]}
            onPress={handleOrganize}>
            <Feather
              name="sliders"
              size={moderateScale(20)}
              color={theme.colors.text}
            />
            <Text style={styles.optionText}>Edit Details</Text>
          </Pressable>

          <Pressable
            style={({pressed}) => [
              styles.option,
              pressed && styles.optionPressed,
            ]}
            onPress={handleAddToQueue}>
            <View style={styles.rotatedIcon}>
              <QueueIcon
                color={theme.colors.text}
                size={moderateScale(20)}
                filled={true}
              />
            </View>
            <Text style={styles.optionText}>Add to Queue</Text>
          </Pressable>

          <Pressable
            style={({pressed}) => [
              styles.optionDestructive,
              pressed && styles.optionDestructivePressed,
            ]}
            onPress={handleDelete}>
            <Feather name="trash-2" size={moderateScale(20)} color="#ff4444" />
            <Text style={styles.optionTextDestructive}>Delete</Text>
          </Pressable>
        </View>
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
      paddingHorizontal: moderateScale(20),
      paddingBottom: moderateScale(40),
    },
    header: {
      alignItems: 'center',
      marginTop: moderateScale(8),
      marginBottom: moderateScale(20),
      gap: moderateScale(4),
    },
    title: {
      fontSize: moderateScale(20),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    optionsGrid: {
      gap: moderateScale(8),
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      paddingHorizontal: moderateScale(16),
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderRadius: moderateScale(12),
    },
    optionPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    optionText: {
      flex: 1,
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginLeft: moderateScale(12),
    },
    optionDestructive: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      paddingHorizontal: moderateScale(16),
      backgroundColor: 'rgba(255, 68, 68, 0.1)',
      borderRadius: moderateScale(12),
    },
    optionDestructivePressed: {
      backgroundColor: 'rgba(255, 68, 68, 0.18)',
    },
    optionTextDestructive: {
      flex: 1,
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: '#ff4444',
      marginLeft: moderateScale(12),
    },
    rotatedIcon: {
      transform: [{rotate: '180deg'}],
    },
  });
