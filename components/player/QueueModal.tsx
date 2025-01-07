import React from 'react';
import {View, Text, TouchableOpacity, FlatList} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import BottomSheetModal from '@/components/BottomSheetModal';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {Track} from 'react-native-track-player';
import {useQueueStore} from '@/store/queueStore';
interface QueueModalProps {
  isVisible: boolean;
  onClose: () => void;
  queue: Track[];
  currentTrackId: string | undefined;
  onTrackPress: (trackId: string) => void;
  onRemoveTrack: (trackId: string) => void;
}

const QueueModal: React.FC<QueueModalProps> = ({
  isVisible,
  onClose,
  queue,
  currentTrackId,
  onTrackPress,
  onRemoveTrack,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {shuffleQueue} = useQueueStore();

  const handleShuffle = () => {
    shuffleQueue();
  };

  const renderItem = ({item}: {item: Track}) => (
    <TouchableOpacity
      activeOpacity={0.99}
      style={[
        styles.trackItem,
        item.id === currentTrackId && styles.currentTrack,
      ]}
      onPress={() => onTrackPress(item.id)}>
      <View style={styles.trackInfo}>
        <Text style={styles.trackTitle}>{item.title}</Text>
        <Text style={styles.trackArtist}>{item.artist}</Text>
      </View>
      <TouchableOpacity
        activeOpacity={0.99}
        style={styles.removeButton}
        onPress={() => onRemoveTrack(item.id)}>
        <MaterialCommunityIcons
          name="close"
          size={moderateScale(20)}
          color={theme.colors.text}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <BottomSheetModal
      isVisible={isVisible}
      onClose={onClose}
      snapPoints={['80%']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Queue</Text>
          <TouchableOpacity
            activeOpacity={0.99}
            onPress={handleShuffle}
            style={styles.shuffleButton}>
            <MaterialCommunityIcons
              name="shuffle-variant"
              size={moderateScale(24)}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
        </View>
        <FlatList
          data={queue}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />
      </View>
    </BottomSheetModal>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    title: {
      fontSize: moderateScale(20),
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: moderateScale(16),
      paddingHorizontal: moderateScale(16),
    },
    listContent: {
      paddingHorizontal: moderateScale(16),
    },
    trackItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(12),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    currentTrack: {
      backgroundColor: theme.colors.primary + '20',
    },
    trackInfo: {
      flex: 1,
    },
    trackTitle: {
      fontSize: moderateScale(16),
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    trackArtist: {
      fontSize: moderateScale(14),
      color: theme.colors.textSecondary,
    },
    removeButton: {
      padding: moderateScale(8),
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: moderateScale(10),
    },
    shuffleButton: {
      padding: moderateScale(5),
    },
  });

export default QueueModal;
