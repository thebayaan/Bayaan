import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {Icon} from '@rneui/themed';
import {Theme} from '@/utils/themeUtils';
import BottomSheet from '@gorhom/bottom-sheet';
import {BaseModal} from '@/components/modals/BaseModal';

interface EditPlaylistModalProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
  playlistId: string;
  playlistName: string;
  playlistColor: string;
  onSave: (name: string, color: string) => void;
  onClose: () => void;
  theme: Theme;
}

// Predefined color options (same as CreatePlaylistModal)
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

export const EditPlaylistModal: React.FC<EditPlaylistModalProps> = ({
  bottomSheetRef,
  playlistId,
  playlistName: initialName,
  playlistColor: initialColor,
  onSave,
  onClose,
  theme,
}) => {
  const [playlistName, setPlaylistName] = useState(initialName);
  const [selectedColor, setSelectedColor] = useState(initialColor);

  // Update local state when props change
  useEffect(() => {
    setPlaylistName(initialName);
    setSelectedColor(initialColor);
  }, [initialName, initialColor]);

  const handleSave = () => {
    if (playlistName.trim()) {
      onSave(playlistName.trim(), selectedColor);
      onClose();
    }
  };

  return (
    <BaseModal
      bottomSheetRef={bottomSheetRef}
      snapPoints={['70%']}
      title="Edit Playlist"
      onChange={(index) => {
        if (index === -1) {
          onClose();
        }
      }}>
      <ScrollView style={styles.content}>
        {/* Playlist Preview */}
        {/* <View style={styles.previewSection}>
          <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
            Preview
          </Text>
          <View style={styles.previewCard}>
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
              <Text style={styles.previewSubtitle}>Playlist</Text>
            </View>
          </View>
        </View> */}

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

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.cancelButton, {backgroundColor: theme.colors.card}]}
          onPress={onClose}>
          <Text style={[styles.cancelButtonText, {color: theme.colors.text}]}>
            Cancel
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.saveButton,
            {
              backgroundColor: playlistName.trim() ? theme.colors.primary : theme.colors.border,
            },
          ]}
          onPress={handleSave}
          disabled={!playlistName.trim()}>
          <Text
            style={[
              styles.saveButtonText,
              {
                color: playlistName.trim() ? 'white' : theme.colors.textSecondary,
              },
            ]}>
            Save Changes
          </Text>
        </TouchableOpacity>
      </View>
    </BaseModal>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  previewSection: {
    marginBottom: moderateScale(32),
  },
  sectionTitle: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    marginBottom: moderateScale(12),
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
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12),
  },
  previewContent: {
    flex: 1,
  },
  previewTitle: {
    fontSize: moderateScale(16),
    fontWeight: '900',
    color: 'rgba(145, 140, 140, 0.8)',
    marginBottom: moderateScale(4),
  },
  previewSubtitle: {
    fontSize: moderateScale(14),
    color: 'rgba(155, 127, 127, 0.8)',
    
  },
  inputSection: {
    marginBottom: moderateScale(32),
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
  actionButtons: {
    flexDirection: 'row',
    gap: moderateScale(12),
    paddingTop: moderateScale(16),
  },
  cancelButton: {
    flex: 1,
    paddingVertical: moderateScale(14),
    borderRadius: moderateScale(12),
    marginBottom: moderateScale(20),
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: moderateScale(16),
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    paddingVertical: moderateScale(14),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    marginBottom: moderateScale(20),
  },
  saveButtonText: {
    fontSize: moderateScale(16),
    fontWeight: '600',
  },
});

