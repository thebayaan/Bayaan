import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Alert} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {Icon} from '@rneui/themed';
import BottomSheet from '@gorhom/bottom-sheet';
import {BaseModal} from './BaseModal';
import {useTheme} from '@/hooks/useTheme';

interface PlaylistContextMenuProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
  playlistId: string;
  playlistName: string;
  playlistColor?: string;
  onDelete: () => void;
  onClose: () => void;
  onEdit?: () => void;
  onShare?: () => void;
}

export const PlaylistContextMenu: React.FC<PlaylistContextMenuProps> = ({
  bottomSheetRef,
  playlistName,
  onDelete,
  onClose,
  onEdit,
}) => {
  const {theme} = useTheme();

  const handleEdit = () => {
    if (onEdit) {
      // onEdit will handle closing the context menu
      // No need to close here as it's handled in handleEditPlaylist
      onEdit();
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Playlist',
      `Are you sure you want to delete "${playlistName}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete();
            onClose();
          },
        },
      ]
    );
  };

  const options = [
    {
      label: 'Edit Playlist',
      icon: 'edit-2',
      onPress: handleEdit,
      destructive: false,
      disabled: false,
    },
    {
      label: 'Delete Playlist',
      icon: 'trash-2',
      onPress: handleDelete,
      destructive: true,
      disabled: false,
    },
  ];

  return (
    <BaseModal
      bottomSheetRef={bottomSheetRef}
      snapPoints={['40%']}
      onChange={(index) => {
        if (index === -1) {
          onClose();
        }
      }}>
      <View style={styles.container}>
        <Text style={[styles.playlistName, {color: theme.colors.text}]}>
          {playlistName}
        </Text>

        <View style={styles.optionsContainer}>
          {options.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.option,
                !option.destructive && {backgroundColor: theme.colors.card},
                option.disabled && styles.optionDisabled,
                option.destructive && [styles.optionDestructive, {backgroundColor: 'rgba(255, 68, 68, 0.1)'}],
              ]}
              onPress={option.onPress}
              disabled={option.disabled}
              activeOpacity={option.disabled ? 1 : 0.7}>
              <Icon
                name={option.icon}
                type="feather"
                size={moderateScale(20)}
                color={
                  option.disabled
                    ? theme.colors.textSecondary
                    : option.destructive
                    ? '#ff4444'
                    : theme.colors.text
                }
              />
              <Text
                style={[
                  styles.optionText,
                  {color: theme.colors.text},
                  option.disabled && styles.optionTextDisabled,
                  option.destructive && styles.optionTextDestructive,
                ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </BaseModal>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: moderateScale(16),
  },
  playlistName: {
    fontSize: moderateScale(18),
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: moderateScale(20),
  },
  optionsContainer: {
    gap: moderateScale(8),
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: moderateScale(16),
    paddingHorizontal: moderateScale(16),
    borderRadius: moderateScale(8),
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionDestructive: {
    // Background color is set inline for theme support
  },
  optionText: {
    fontSize: moderateScale(16),
    marginLeft: moderateScale(12),
    fontWeight: '500',
  },
  optionTextDisabled: {
    opacity: 0.5,
  },
  optionTextDestructive: {
    color: '#ff4444',
  },
});
