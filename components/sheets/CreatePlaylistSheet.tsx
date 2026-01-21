import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
  Keyboard,
  ViewStyle,
} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {PlaylistIcon} from '@/components/Icons';
import {Input} from '@/components/Input';
import ActionSheet, {SheetProps, SheetManager} from 'react-native-actions-sheet';
import Color from 'color';
import {LinearGradient} from 'expo-linear-gradient';

const SCREEN_HEIGHT = Dimensions.get('window').height;

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

export const CreatePlaylistSheet = (props: SheetProps<'create-playlist'>) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  const payload = props.payload;
  const existingColors = payload?.existingColors ?? [];
  const isEditMode = payload?.isEditMode ?? false;
  const initialName = payload?.initialName ?? '';
  const initialColor = payload?.initialColor;

  const [playlistName, setPlaylistName] = useState(initialName);

  // Generate a stable preview color
  const [previewColor] = useState<string>(() => {
    if (isEditMode && initialColor) {
      return initialColor;
    }
    const unusedColors = PLAYLIST_COLORS.filter(
      color => !existingColors.includes(color),
    );
    const availableColors =
      unusedColors.length > 0 ? unusedColors : PLAYLIST_COLORS;
    return availableColors[Math.floor(Math.random() * availableColors.length)];
  });

  const handleCreate = useCallback(async () => {
    if (playlistName.trim()) {
      Keyboard.dismiss();
      await SheetManager.hide('create-playlist', {
        payload: {
          name: playlistName.trim(),
          color: previewColor,
        },
      });
    }
  }, [playlistName, previewColor]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    SheetManager.hide('create-playlist');
  }, []);

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
        <Text style={styles.headerTitle}>
          {isEditMode ? 'Edit Playlist' : 'New Playlist'}
        </Text>
        <TouchableOpacity
          onPress={handleCreate}
          style={[
            styles.headerButton,
            {opacity: playlistName.trim() ? 1 : 0.4},
          ]}
          disabled={!playlistName.trim()}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
                    backgroundColor: Color(previewColor).alpha(0.15).toString(),
                  },
                ]}>
                <PlaylistIcon color={previewColor} size={moderateScale(30)} />
              </View>
            </View>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {playlistName || 'Your Playlist'}
            </Text>
          </LinearGradient>
        </View>

        {/* Input Section */}
        <Input
          label="Playlist Name"
          showIcon
          iconName="edit-3"
          iconType="feather"
          placeholder="e.g., Morning Recitations"
          value={playlistName}
          onChangeText={setPlaylistName}
          maxLength={50}
          showCharacterCount
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          containerStyle={styles.inputSection as ViewStyle}
        />
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
      height: SCREEN_HEIGHT * 0.6,
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
    heroSection: {
      marginTop: moderateScale(16),
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
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: moderateScale(8),
      letterSpacing: -0.3,
      minHeight: moderateScale(22),
    },
    inputSection: {
      marginBottom: 0,
    },
  });
