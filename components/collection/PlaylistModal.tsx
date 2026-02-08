import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {Feather} from '@expo/vector-icons';
import {Theme} from '@/utils/themeUtils';
import {PlaylistIcon} from '@/components/Icons';
import {Input} from '@/components/Input';
import Color from 'color';
import {LinearGradient} from 'expo-linear-gradient';

interface PlaylistModalProps {
  visible: boolean;
  onClose: () => void;
  onCreatePlaylist: (name: string, color: string) => void;
  theme: Theme;
  existingColors?: string[];
  isEditMode?: boolean;
  initialName?: string;
  initialColor?: string;
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

export const PlaylistModal: React.FC<PlaylistModalProps> = ({
  visible,
  onClose,
  onCreatePlaylist,
  theme,
  existingColors = [],
  isEditMode = false,
  initialName = '',
  initialColor,
}) => {
  const [playlistName, setPlaylistName] = useState(initialName);

  // Generate a stable preview color that only changes when the modal reopens
  const [previewColor, setPreviewColor] = useState<string>(() => {
    // Initialize with a valid color
    if (isEditMode && initialColor) {
      return initialColor;
    }
    // Generate initial color for create mode
    const unusedColors = PLAYLIST_COLORS.filter(
      color => !existingColors.includes(color),
    );
    const availableColors =
      unusedColors.length > 0 ? unusedColors : PLAYLIST_COLORS;
    return availableColors[Math.floor(Math.random() * availableColors.length)];
  });

  // Update state only when modal opens/mode changes
  React.useEffect(() => {
    if (!visible) return;

    setPlaylistName(isEditMode ? initialName : '');

    // In edit mode, always use the existing color (never generate new)
    if (isEditMode && initialColor) {
      setPreviewColor(initialColor);
    } else if (!isEditMode) {
      // Only generate new color when creating (not editing)
      const unusedColors = PLAYLIST_COLORS.filter(
        color => !existingColors.includes(color),
      );
      const availableColors =
        unusedColors.length > 0 ? unusedColors : PLAYLIST_COLORS;
      setPreviewColor(
        availableColors[Math.floor(Math.random() * availableColors.length)],
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, isEditMode, initialName, initialColor]);

  const handleCreate = () => {
    if (playlistName.trim()) {
      // Use the preview color that was shown to the user
      onCreatePlaylist(playlistName.trim(), previewColor);
      setPlaylistName('');
      onClose();
    }
  };

  const handleClose = () => {
    setPlaylistName('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}>
      <View
        style={[styles.container, {backgroundColor: theme.colors.background}]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Feather
              name="x"
              size={moderateScale(24)}
              color={theme.colors.text}
            />
          </TouchableOpacity>
          <Text style={[styles.title, {color: theme.colors.text}]}>
            {isEditMode ? 'Edit Playlist' : 'New Playlist'}
          </Text>
          <TouchableOpacity
            onPress={handleCreate}
            style={[
              styles.createButton,
              {
                opacity: playlistName.trim() ? 1 : 0.4,
              },
            ]}
            disabled={!playlistName.trim()}>
            <Text
              style={[
                styles.createButtonText,
                {
                  color: theme.colors.text,
                },
              ]}>
              Save
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}>
          {/* Hero Preview Card */}
          <View style={styles.heroSection}>
            <LinearGradient
              colors={[
                Color(previewColor).alpha(0.2).toString(),
                Color(previewColor).alpha(0.05).toString(),
              ]}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.heroGradient}>
              <View
                style={[
                  styles.heroIconContainer,
                  {
                    backgroundColor: Color(previewColor).alpha(0.2).toString(),
                    shadowColor: previewColor,
                  },
                ]}>
                <View
                  style={[
                    styles.heroIconInner,
                    {
                      backgroundColor: Color(previewColor)
                        .alpha(0.15)
                        .toString(),
                    },
                  ]}>
                  <PlaylistIcon color={previewColor} size={moderateScale(30)} />
                </View>
              </View>
              <Text
                style={[styles.heroTitle, {color: theme.colors.text}]}
                numberOfLines={2}>
                {playlistName || 'Your Playlist'}
              </Text>
            </LinearGradient>
          </View>

          {/* Input Section */}
          <Input
            label="Playlist Name"
            showIcon
            iconName="edit-3"
            placeholder="Name"
            value={playlistName}
            onChangeText={setPlaylistName}
            maxLength={50}
            showCharacterCount
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            containerStyle={styles.inputSection}
          />
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
    paddingHorizontal: moderateScale(24),
    paddingVertical: moderateScale(20),
    borderBottomWidth: 0,
  },
  closeButton: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: moderateScale(22),
    fontFamily: 'Manrope-Bold',
    letterSpacing: -0.5,
  },
  createButton: {
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(8),
  },
  createButtonText: {
    fontSize: moderateScale(15),
    fontFamily: 'Manrope-SemiBold',
    letterSpacing: 0.2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: moderateScale(24),
    paddingBottom: moderateScale(32),
  },
  heroSection: {
    marginTop: moderateScale(8),
    marginBottom: moderateScale(20),
    borderRadius: moderateScale(16),
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  heroGradient: {
    paddingVertical: moderateScale(20),
    paddingHorizontal: moderateScale(20),
    alignItems: 'center',
  },
  heroIconContainer: {
    width: moderateScale(64),
    height: moderateScale(64),
    borderRadius: moderateScale(32),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: moderateScale(12),
    ...Platform.select({
      ios: {
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  heroIconInner: {
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: moderateScale(28),
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: moderateScale(17),
    fontFamily: 'Manrope-Bold',
    textAlign: 'center',
    marginBottom: moderateScale(8),
    letterSpacing: -0.3,
    minHeight: moderateScale(22),
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(16),
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  heroBadgeDot: {
    width: moderateScale(5),
    height: moderateScale(5),
    borderRadius: moderateScale(2.5),
    marginRight: moderateScale(6),
  },
  heroBadgeText: {
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-SemiBold',
    letterSpacing: 0.1,
  },
  inputSection: {
    marginBottom: 0,
  },
});
