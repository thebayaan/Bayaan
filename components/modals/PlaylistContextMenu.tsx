import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Alert, Modal} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {Icon} from '@rneui/themed';
import {Theme} from '@/utils/themeUtils';

interface PlaylistContextMenuProps {
  visible: boolean;
  onClose: () => void;
  playlistName: string;
  onDelete: () => void;
  onEdit?: () => void;
  onShare?: () => void;
  theme: Theme;
}

export const PlaylistContextMenu: React.FC<PlaylistContextMenuProps> = ({
  visible,
  onClose,
  playlistName,
  onDelete,
  onEdit,
  onShare,
  theme,
}) => {
  const styles = createStyles(theme);

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
      label: 'Delete Playlist',
      icon: 'trash-2',
      onPress: handleDelete,
      destructive: true,
      disabled: false,
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Playlist Options</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="x" type="feather" size={moderateScale(24)} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.playlistName}>{playlistName}</Text>
          
          <View style={styles.optionsContainer}>
            {options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.option,
                  option.disabled && styles.optionDisabled,
                  option.destructive && styles.optionDestructive,
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
                    option.disabled && styles.optionTextDisabled,
                    option.destructive && styles.optionTextDestructive,
                  ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      paddingHorizontal: moderateScale(20),
      paddingTop: moderateScale(20),
      paddingBottom: moderateScale(60),
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      marginBottom: moderateScale(16),
    },
    title: {
      fontSize: moderateScale(20),
      fontWeight: '600',
      color: theme.colors.text,
    },
    closeButton: {
      padding: moderateScale(8),
    },
    playlistName: {
      fontSize: moderateScale(18),
      fontWeight: '600',
      color: theme.colors.text,
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
      backgroundColor: theme.colors.card,
    },
    optionDisabled: {
      opacity: 0.5,
    },
    optionDestructive: {
      backgroundColor: 'rgba(255, 68, 68, 0.1)',
    },
    optionText: {
      fontSize: moderateScale(16),
      color: theme.colors.text,
      marginLeft: moderateScale(12),
      fontWeight: '500',
    },
    optionTextDisabled: {
      color: theme.colors.textSecondary,
    },
    optionTextDestructive: {
      color: '#ff4444',
    },
  });
