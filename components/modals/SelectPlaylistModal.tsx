import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {Surah} from '@/data/surahData';
import {PlaylistIcon} from '@/components/Icons';
import BottomSheet from '@gorhom/bottom-sheet';
import {BaseModal} from './BaseModal';
import {usePlaylists} from '@/hooks/usePlaylists';
import {playlistService} from '@/services/playlist/PlaylistService';
import {CreatePlaylistModal} from '@/components/collection/CreatePlaylistModal';
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
  const {playlists, createPlaylist, refreshPlaylists} = usePlaylists();
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Handle playlist selection
  const handlePlaylistSelect = useCallback(async (playlistId: string) => {
    try {
      await playlistService.addToPlaylist(
        playlistId,
        surah.id.toString(),
        reciterId,
        rewayatId
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
  }, [surah, reciterId, rewayatId, onClose, onPlaylistSelected]);

  // Handle creating new playlist
  const handleCreatePlaylist = useCallback(async (name: string, color: string) => {
    try {
      setIsCreating(true);
      const newPlaylist = await createPlaylist(name, color);
      
      // Add the surah to the new playlist
      await playlistService.addToPlaylist(
        newPlaylist.id,
        surah.id.toString(),
        reciterId,
        rewayatId
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
  }, [surah, reciterId, rewayatId, createPlaylist, onClose, onPlaylistSelected]);

  const handleSheetChange = useCallback((index: number) => {
    if (index === -1) {
      setShowCreatePlaylist(false);
    }
  }, []);

  return (
    <>
      <BaseModal
        bottomSheetRef={bottomSheetRef}
        snapPoints={['80%']}
        title="Add to Playlist"
        onChange={handleSheetChange}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.surahName}>{surah.name}</Text>
            <Text style={styles.surahTranslation}>
              {surah.translated_name_english}
            </Text>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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
                  color={theme.colors.primary}
                />
                <Text style={styles.createButtonText}>
                  {isCreating ? 'Creating...' : 'Create New Playlist'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Existing Playlists */}
            <View style={styles.playlistsContainer}>
              <Text style={styles.sectionTitle}>Existing Playlists</Text>
              
              {playlists.length === 0 ? (
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
              ) : (
                playlists.map((playlist) => (
                  <TouchableOpacity
                    key={playlist.id}
                    style={styles.playlistItem}
                    onPress={() => handlePlaylistSelect(playlist.id)}
                    activeOpacity={0.7}>
                    <View style={styles.playlistItemContent}>
                      <View style={[styles.playlistColor, {backgroundColor: playlist.color}]} />
                      <View style={styles.playlistInfo}>
                        <Text style={styles.playlistName}>{playlist.name}</Text>
                        <Text style={styles.playlistDescription}>
                          {playlist.itemCount} surah{playlist.itemCount !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <PlaylistIcon
                        color={theme.colors.textSecondary}
                        size={moderateScale(20)}
                        filled={true}
                      />
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
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
      paddingHorizontal: moderateScale(20),
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
    createButton: {
      backgroundColor: Color(theme.colors.primary).alpha(0.1).toString(),
      borderRadius: moderateScale(12),
      marginBottom: moderateScale(20),
      borderWidth: 1,
      borderColor: Color(theme.colors.primary).alpha(0.3).toString(),
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
      color: theme.colors.primary,
      marginLeft: moderateScale(12),
    },
    playlistsContainer: {
      gap: moderateScale(8),
    },
    sectionTitle: {
      fontSize: moderateScale(16),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginBottom: moderateScale(12),
    },
    playlistItem: {
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderRadius: moderateScale(12),
    },
    playlistItemContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      paddingHorizontal: moderateScale(16),
    },
    playlistColor: {
      width: moderateScale(12),
      height: moderateScale(12),
      borderRadius: moderateScale(6),
      marginRight: moderateScale(12),
    },
    playlistInfo: {
      flex: 1,
    },
    playlistName: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginBottom: moderateScale(2),
    },
    playlistDescription: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
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
