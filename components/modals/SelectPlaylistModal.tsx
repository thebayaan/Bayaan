import React, {useCallback, useState} from 'react';
import {View, Text, TouchableOpacity, ScrollView, Alert} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {Surah} from '@/data/surahData';
import {PlaylistIcon, HeartIcon} from '@/components/Icons';
import BottomSheet from '@gorhom/bottom-sheet';
import {BaseModal} from './BaseModal';
import {usePlaylists} from '@/hooks/usePlaylists';
import {useLoved} from '@/hooks/useLoved';
import {CreatePlaylistModal} from '@/components/collection/CreatePlaylistModal';
import {PlaylistItem} from '@/components/PlaylistItem';
import {Icon} from '@rneui/themed';
import Color from 'color';

interface SelectPlaylistModalProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
  surah: Surah;
  reciterId: string;
  rewayatId?: string;
  onClose: () => void;
  onPlaylistSelected?: (playlistId: string) => void;
}

export const SelectPlaylistModal: React.FC<SelectPlaylistModalProps> = ({
  bottomSheetRef,
  surah,
  reciterId,
  rewayatId,
  onClose,
  onPlaylistSelected,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {playlists, createPlaylist, addToPlaylist} = usePlaylists();
  const {isLoved, isLovedWithRewayat, toggleLoved} = useLoved();
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Calculate loved state
  const isLovedState = reciterId
    ? rewayatId
      ? isLovedWithRewayat(reciterId, surah.id.toString(), rewayatId)
      : isLoved(reciterId, surah.id.toString())
    : false;

  // Handle playlist selection
  const handlePlaylistSelect = useCallback(
    async (playlistId: string) => {
      try {
        await addToPlaylist(
          playlistId,
          surah.id.toString(),
          reciterId,
          rewayatId,
        );

        console.log(`Added ${surah.name} to playlist`);

        // Call the callback if provided
        if (onPlaylistSelected) {
          onPlaylistSelected(playlistId);
        }

        // Close the modal
        onClose();
      } catch (error) {
        console.error('Failed to add to playlist:', error);
        Alert.alert('Error', 'Failed to add surah to playlist');
      }
    },
    [surah, reciterId, rewayatId, addToPlaylist, onClose, onPlaylistSelected],
  );

  // Handle creating new playlist
  const handleCreatePlaylist = useCallback(
    async (name: string, color: string) => {
      try {
        setIsCreating(true);
        const newPlaylist = await createPlaylist(name, color);

        // Small delay to ensure previous transaction is committed
        await new Promise(resolve => setTimeout(resolve, 50));

        // Add the surah to the new playlist
        await addToPlaylist(
          newPlaylist.id,
          surah.id.toString(),
          reciterId,
          rewayatId,
        );

        console.log(`Created playlist "${name}" and added ${surah.name}`);

        // Call the callback if provided
        if (onPlaylistSelected) {
          onPlaylistSelected(newPlaylist.id);
        }

        // Close both modals
        setShowCreatePlaylist(false);
        onClose();
      } catch (error) {
        console.error('Failed to create playlist:', error);
        Alert.alert('Error', 'Failed to create playlist');
      } finally {
        setIsCreating(false);
      }
    },
    [
      surah,
      reciterId,
      rewayatId,
      createPlaylist,
      addToPlaylist,
      onClose,
      onPlaylistSelected,
    ],
  );

  const handleSheetChange = useCallback((index: number) => {
    if (index === -1) {
      setShowCreatePlaylist(false);
    }
  }, []);

  const handleToggleLoved = useCallback(() => {
    if (!reciterId) return;
    toggleLoved(reciterId, surah.id.toString(), rewayatId || '');
  }, [reciterId, surah.id, rewayatId, toggleLoved]);

  return (
    <>
      <BaseModal
        bottomSheetRef={bottomSheetRef}
        snapPoints={['80%']}
        title="Add to Collection"
        onChange={handleSheetChange}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.surahName}>{surah.name}</Text>
            <Text style={styles.surahTranslation}>
              {surah.translated_name_english}
            </Text>
          </View>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}>
            {/* Add to Loved Option */}
            {reciterId && (
              <TouchableOpacity
                style={[
                  styles.lovedOption,
                  isLovedState && styles.lovedOptionActive,
                ]}
                onPress={handleToggleLoved}
                activeOpacity={0.7}>
                <View
                  style={[
                    styles.lovedIconContainer,
                    isLovedState && styles.lovedIconContainerActive,
                  ]}>
                  <HeartIcon
                    color={isLovedState ? '#FF6B6B' : theme.colors.text}
                    size={moderateScale(24)}
                    filled={isLovedState}
                  />
                </View>
                <Text
                  style={[
                    styles.lovedText,
                    isLovedState && styles.lovedTextActive,
                  ]}>
                  Loved
                </Text>
              </TouchableOpacity>
            )}

            {/* Create New Playlist Button */}
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => setShowCreatePlaylist(true)}
              activeOpacity={0.7}
              disabled={isCreating}>
              <View style={styles.createButtonContent}>
                <Icon
                  name="plus"
                  type="feather"
                  size={moderateScale(20)}
                  color={theme.colors.text}
                />
                <Text style={styles.createButtonText}>
                  {isCreating ? 'Creating...' : 'Create New Playlist'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Existing Playlists */}
            {playlists.length > 0 && (
              <View style={styles.playlistsContainer}>
                <Text style={styles.sectionTitle}>Your Playlists</Text>
                {playlists.map(playlist => (
                  <PlaylistItem
                    key={playlist.id}
                    id={playlist.id}
                    name={playlist.name}
                    itemCount={playlist.itemCount}
                    color={playlist.color}
                    onPress={() => handlePlaylistSelect(playlist.id)}
                  />
                ))}
              </View>
            )}

            {playlists.length === 0 && (
              <View style={styles.emptyState}>
                <PlaylistIcon
                  color={theme.colors.textSecondary}
                  size={moderateScale(40)}
                  filled={false}
                />
                <Text style={styles.emptyStateText}>
                  No playlists yet. Create your first playlist above!
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </BaseModal>

      {/* Create Playlist Modal */}
      <CreatePlaylistModal
        visible={showCreatePlaylist}
        onClose={() => setShowCreatePlaylist(false)}
        onCreatePlaylist={handleCreatePlaylist}
        theme={theme}
      />
    </>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: moderateScale(12),
    },
    header: {
      alignItems: 'center',
      marginBottom: moderateScale(24),
      gap: moderateScale(4),
    },
    surahName: {
      fontSize: moderateScale(20),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    surahTranslation: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    scrollView: {
      flex: 1,
    },
    lovedOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(12),
      paddingHorizontal: moderateScale(16),
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderRadius: moderateScale(12),
      marginBottom: moderateScale(16),
      borderWidth: 1,
      borderColor: 'transparent',
    },
    lovedOptionActive: {
      backgroundColor: Color('#FF6B6B').alpha(0.08).toString(),
      borderColor: Color('#FF6B6B').alpha(0.2).toString(),
    },
    lovedIconContainer: {
      width: moderateScale(50),
      height: moderateScale(50),
      borderRadius: moderateScale(10),
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: moderateScale(12),
    },
    lovedIconContainerActive: {
      backgroundColor: Color('#FF6B6B').alpha(0.15).toString(),
    },
    lovedText: {
      flex: 1,
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    lovedTextActive: {
      color: '#FF6B6B',
    },
    lovedCheckmark: {
      width: moderateScale(28),
      height: moderateScale(28),
      borderRadius: moderateScale(14),
      backgroundColor: Color('#FF6B6B').alpha(0.15).toString(),
      justifyContent: 'center',
      alignItems: 'center',
    },
    createButton: {
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderRadius: moderateScale(12),
      marginBottom: moderateScale(20),
    },
    createButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      paddingHorizontal: moderateScale(16),
    },
    createButtonText: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginLeft: moderateScale(12),
    },
    playlistsContainer: {
      marginBottom: moderateScale(20),
      marginHorizontal: moderateScale(-15),
    },
    sectionTitle: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-SemiBold',
      marginHorizontal: moderateScale(15),

      color: theme.colors.textSecondary,
      marginBottom: moderateScale(8),
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: moderateScale(40),
      gap: moderateScale(12),
    },
    emptyStateText: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });
