import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {Icon} from '@rneui/themed';
import {Theme} from '@/utils/themeUtils';

interface CreatePlaylistModalProps {
  visible: boolean;
  onClose: () => void;
  onCreatePlaylist: (name: string, color: string) => void;
  theme: Theme;
}

// Predefined color options
const PLAYLIST_COLORS = [
  '#6366F1', // Indigo
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#EF4444', // Red
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#22C55E', // Green
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#84CC16', // Lime
  '#F59E0B', // Amber
  '#10B981', // Emerald
];

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
  visible,
  onClose,
  onCreatePlaylist,
  theme,
}) => {
  const [playlistName, setPlaylistName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PLAYLIST_COLORS[0]);

  const handleCreate = () => {
    if (playlistName.trim()) {
      onCreatePlaylist(playlistName.trim(), selectedColor);
      setPlaylistName('');
      setSelectedColor(PLAYLIST_COLORS[0]);
      onClose();
    }
  };

  const handleClose = () => {
    setPlaylistName('');
    setSelectedColor(PLAYLIST_COLORS[0]);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}>
      <View style={[styles.container, {backgroundColor: theme.colors.background}]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Icon
              name="x"
              type="feather"
              size={moderateScale(24)}
              color={theme.colors.text}
            />
          </TouchableOpacity>
          <Text style={[styles.title, {color: theme.colors.text}]}>
            New Playlist
          </Text>
          <TouchableOpacity
            onPress={handleCreate}
            style={[
              styles.createButton,
              {
                backgroundColor: playlistName.trim() ? theme.colors.primary : theme.colors.border,
              },
            ]}
            disabled={!playlistName.trim()}>
            <Text
              style={[
                styles.createButtonText,
                {
                  color: playlistName.trim() ? 'white' : theme.colors.textSecondary,
                },
              ]}>
              Create
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Playlist Preview */}
          <View style={styles.previewSection}>
            <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
              Preview
            </Text>
            <View style={[styles.previewCard]}>
              <View style={[styles.previewIcon, {backgroundColor: selectedColor}]}>
                <Icon
                  name="book-open"
                  type="feather"
                  size={moderateScale(24)}
                  color="white"
                />
              </View>
              <View style={styles.previewContent}>
                <Text style={styles.previewTitle} numberOfLines={1}>
                  {playlistName || 'Playlist Name'}
                </Text>
                <Text style={styles.previewSubtitle}>Playlist • 0 surahs</Text>
              </View>
            </View>
          </View>

          {/* Playlist Name Input */}
          <View style={styles.inputSection}>
            <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
              Playlist Name
            </Text>
            <TextInput
              style={[
                styles.nameInput,
                {
                  backgroundColor: theme.colors.card,
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                },
              ]}
              placeholder="Enter playlist name"
              placeholderTextColor={theme.colors.textSecondary}
              value={playlistName}
              onChangeText={setPlaylistName}
              maxLength={50}
              autoFocus
            />
            <Text style={[styles.characterCount, {color: theme.colors.textSecondary}]}>
              {playlistName.length}/50
            </Text>
          </View>

          {/* Color Selection */}
          <View style={styles.colorSection}>
            <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
              Choose Color
            </Text>
            <View style={styles.colorGrid}>
              {PLAYLIST_COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    {
                      backgroundColor: color,
                      borderColor: selectedColor === color ? theme.colors.text : 'transparent',
                      borderWidth: selectedColor === color ? 3 : 0,
                    },
                  ]}
                  onPress={() => setSelectedColor(color)}
                  activeOpacity={0.8}>
                  {selectedColor === color && (
                    <Icon
                      name="check"
                      type="feather"
                      size={moderateScale(16)}
                      color="white"
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(16),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  closeButton: {
    padding: moderateScale(8),
  },
  title: {
    fontSize: moderateScale(18),
    fontWeight: '600',
  },
  createButton: {
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(8),
    borderRadius: moderateScale(20),
  },
  createButtonText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: moderateScale(20),
  },
  previewSection: {
    marginTop: moderateScale(24),
    marginBottom: moderateScale(32),
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: moderateScale(16),
    borderRadius: moderateScale(12),
    marginTop: moderateScale(12),
  },
  previewIcon: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(8),
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12),
  },
  previewContent: {
    flex: 1,
  },
  previewTitle: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: 'white',
    marginBottom: moderateScale(4),
  },
  previewSubtitle: {
    fontSize: moderateScale(14),
    color: 'rgba(255,255,255,0.8)',
  },
  inputSection: {
    marginBottom: moderateScale(32),
  },
  sectionTitle: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    marginBottom: moderateScale(12),
  },
  nameInput: {
    borderWidth: 1,
    borderRadius: moderateScale(12),
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(12),
    fontSize: moderateScale(16),
  },
  characterCount: {
    fontSize: moderateScale(12),
    textAlign: 'right',
    marginTop: moderateScale(4),
  },
  colorSection: {
    marginBottom: moderateScale(32),
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: moderateScale(12),
  },
  colorOption: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    marginBottom: moderateScale(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
});
