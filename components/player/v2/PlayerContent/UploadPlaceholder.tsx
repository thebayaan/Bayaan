import React, {useCallback} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {useUploadsStore} from '@/store/uploadsStore';
import {MicrophoneIcon} from '@/components/Icons';
import {SheetManager} from 'react-native-actions-sheet';
import {Icon} from '@rneui/themed';
import type {Track} from '@/types/audio';

interface UploadPlaceholderProps {
  currentTrack: Track;
}

export const UploadPlaceholder: React.FC<UploadPlaceholderProps> = ({
  currentTrack,
}) => {
  const {theme} = useTheme();
  const {setSheetMode} = usePlayerActions();

  const handleEditDetails = useCallback(() => {
    if (!currentTrack.userRecitationId) return;

    const recitation = useUploadsStore
      .getState()
      .getRecitationById(currentTrack.userRecitationId);
    if (!recitation) return;

    setSheetMode('hidden');
    setTimeout(() => {
      SheetManager.show('organize-recitation', {
        payload: {recitation},
      });
    }, 300);
  }, [currentTrack.userRecitationId, setSheetMode]);

  return (
    <View style={styles.container}>
      <MicrophoneIcon
        size={moderateScale(48)}
        color={theme.colors.textSecondary}
      />
      <Text style={[styles.hintText, {color: theme.colors.textSecondary}]}>
        Tag this recitation to see surah text and details
      </Text>
      <Pressable
        onPress={handleEditDetails}
        style={({pressed}) => [
          styles.editButton,
          {
            backgroundColor: theme.colors.card,
            opacity: pressed ? 0.7 : 1,
          },
        ]}>
        <Icon
          name="sliders-h"
          type="font-awesome-5"
          size={moderateScale(14)}
          color={theme.colors.text}
        />
        <Text style={[styles.editButtonText, {color: theme.colors.text}]}>
          Edit Details
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: moderateScale(32),
  },
  hintText: {
    fontSize: moderateScale(13),
    fontFamily: 'Manrope-Medium',
    textAlign: 'center',
    marginTop: moderateScale(16),
    lineHeight: moderateScale(20),
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(10),
    borderRadius: moderateScale(20),
    marginTop: moderateScale(20),
    gap: moderateScale(8),
  },
  editButtonText: {
    fontSize: moderateScale(13),
    fontFamily: 'Manrope-SemiBold',
  },
});
