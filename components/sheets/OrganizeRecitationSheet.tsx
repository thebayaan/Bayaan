import React, {useState, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Keyboard,
  Dimensions,
} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import ActionSheet, {
  SheetProps,
  SheetManager,
} from 'react-native-actions-sheet';
import Color from 'color';
import {Icon} from '@rneui/themed';
import {useUploadsStore} from '@/store/uploadsStore';
import type {UploadedRecitation} from '@/types/uploads';

const SCREEN_HEIGHT = Dimensions.get('window').height;

type RecitationType = 'surah' | 'other';

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return 'Unknown duration';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const OrganizeRecitationSheet = (
  props: SheetProps<'organize-recitation'>,
) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {updateTags, deleteRecitation} = useUploadsStore();

  const payload = props.payload;
  const recitation = payload?.recitation;

  // Local state for tag fields
  const [type, setType] = useState<RecitationType | null>(
    recitation?.type ?? null,
  );
  const [surahNumber, setSurahNumber] = useState<number | null>(
    recitation?.surahNumber ?? null,
  );
  const [startVerse, setStartVerse] = useState<number | null>(
    recitation?.startVerse ?? null,
  );
  const [endVerse, setEndVerse] = useState<number | null>(
    recitation?.endVerse ?? null,
  );
  const [title, setTitle] = useState<string>(recitation?.title ?? '');
  const [category, setCategory] = useState<UploadedRecitation['category']>(
    recitation?.category ?? null,
  );
  const [reciterId, setReciterId] = useState<string | null>(
    recitation?.reciterId ?? null,
  );
  const [customReciterId, setCustomReciterId] = useState<string | null>(
    recitation?.customReciterId ?? null,
  );
  const [reciterDisplayName, setReciterDisplayName] = useState<string>('');
  const [rewayah, setRewayah] = useState<string>(recitation?.rewayah ?? '');

  const hasChanges = useMemo(() => {
    if (!recitation) return false;
    return (
      type !== recitation.type ||
      surahNumber !== recitation.surahNumber ||
      startVerse !== recitation.startVerse ||
      endVerse !== recitation.endVerse ||
      title !== (recitation.title ?? '') ||
      category !== recitation.category ||
      reciterId !== recitation.reciterId ||
      customReciterId !== recitation.customReciterId ||
      rewayah !== (recitation.rewayah ?? '')
    );
  }, [
    recitation,
    type,
    surahNumber,
    startVerse,
    endVerse,
    title,
    category,
    reciterId,
    customReciterId,
    rewayah,
  ]);

  const handleSave = useCallback(async () => {
    if (!recitation || !hasChanges) return;
    Keyboard.dismiss();
    await updateTags(recitation.id, {
      type,
      surahNumber: type === 'surah' ? surahNumber : null,
      startVerse: type === 'surah' ? startVerse : null,
      endVerse: type === 'surah' ? endVerse : null,
      title: type === 'other' ? title || null : null,
      category: type === 'other' ? category : null,
      reciterId,
      customReciterId,
      rewayah: rewayah || null,
    });
    await SheetManager.hide('organize-recitation');
  }, [
    recitation,
    hasChanges,
    updateTags,
    type,
    surahNumber,
    startVerse,
    endVerse,
    title,
    category,
    reciterId,
    customReciterId,
    rewayah,
  ]);

  const handleDelete = useCallback(async () => {
    if (!recitation) return;
    Keyboard.dismiss();
    await deleteRecitation(recitation.id);
    await SheetManager.hide('organize-recitation');
  }, [recitation, deleteRecitation]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    SheetManager.hide('organize-recitation');
  }, []);

  const handleTypeSelect = useCallback((newType: RecitationType) => {
    setType(prev => (prev === newType ? null : newType));
  }, []);

  if (!recitation) return null;

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}
      keyboardHandlerEnabled={true}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Organize</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.headerButton, {opacity: hasChanges ? 1 : 0.4}]}
          disabled={!hasChanges}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.contentContainer}>
        {/* File Info */}
        <View style={styles.fileInfoRow}>
          <View style={styles.fileIconContainer}>
            <Icon
              name="music"
              type="feather"
              size={moderateScale(16)}
              color={theme.colors.textSecondary}
            />
          </View>
          <View style={styles.fileInfoText}>
            <Text
              style={styles.fileName}
              numberOfLines={1}
              ellipsizeMode="middle">
              {recitation.originalFilename}
            </Text>
            <Text style={styles.fileDuration}>
              {formatDuration(recitation.duration)}
            </Text>
          </View>
        </View>

        {/* Type Chips */}
        <Text style={styles.sectionLabel}>Type</Text>
        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.chip, type === 'surah' && styles.chipSelected]}
            onPress={() => handleTypeSelect('surah')}>
            <Text
              style={[
                styles.chipText,
                type === 'surah' && styles.chipTextSelected,
              ]}>
              Surah
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, type === 'other' && styles.chipSelected]}
            onPress={() => handleTypeSelect('other')}>
            <Text
              style={[
                styles.chipText,
                type === 'other' && styles.chipTextSelected,
              ]}>
              Other
            </Text>
          </TouchableOpacity>
        </View>

        {/* Delete Button */}
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Icon
            name="trash-2"
            type="feather"
            size={moderateScale(16)}
            color="#EF4444"
          />
          <Text style={styles.deleteText}>Delete Recitation</Text>
        </TouchableOpacity>
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
      height: SCREEN_HEIGHT * 0.75,
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
    },
    headerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: moderateScale(20),
      paddingVertical: moderateScale(16),
      borderBottomWidth: 1,
      borderBottomColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    headerButton: {
      minWidth: moderateScale(60),
    },
    headerTitle: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    cancelText: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
    saveText: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      textAlign: 'right',
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: moderateScale(20),
      paddingBottom: moderateScale(40),
    },
    fileInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      borderBottomWidth: 1,
      borderBottomColor: Color(theme.colors.border).alpha(0.08).toString(),
      marginBottom: moderateScale(20),
    },
    fileIconContainer: {
      width: moderateScale(36),
      height: moderateScale(36),
      borderRadius: moderateScale(18),
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: moderateScale(12),
    },
    fileInfoText: {
      flex: 1,
    },
    fileName: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    fileDuration: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      marginTop: moderateScale(2),
    },
    sectionLabel: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: moderateScale(10),
    },
    chipRow: {
      flexDirection: 'row',
      gap: moderateScale(8),
      marginBottom: moderateScale(24),
    },
    chip: {
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(8),
      borderRadius: moderateScale(20),
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      borderWidth: 1,
      borderColor: 'transparent',
    },
    chipSelected: {
      backgroundColor: Color(theme.colors.text).alpha(0.12).toString(),
      borderColor: Color(theme.colors.text).alpha(0.2).toString(),
    },
    chipText: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
    chipTextSelected: {
      color: theme.colors.text,
      fontFamily: 'Manrope-SemiBold',
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: moderateScale(14),
      marginTop: moderateScale(16),
      borderRadius: moderateScale(12),
      backgroundColor: Color('#EF4444').alpha(0.08).toString(),
      gap: moderateScale(8),
    },
    deleteText: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      color: '#EF4444',
    },
  });
