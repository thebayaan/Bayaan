import React from 'react';
import {View, Text, TouchableOpacity, FlatList} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {
  moderateScale,
  ScaledSheet,
  verticalScale,
} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {Track} from 'react-native-track-player';
import {useQueueStore} from '@/store/queueStore';
import {useRouter} from 'expo-router';
import {usePlayerStore} from '@/store/playerStore';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Icon} from '@rneui/themed';
import {ShuffleIcon} from '@/components/Icons';

const QueueScreen: React.FC = () => {
  const router = useRouter();
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {shuffleQueue, queue, removeFromQueue, skipToTrack} = useQueueStore();
  const {activeTrack} = usePlayerStore();

  function handleShuffle(): void {
    shuffleQueue();
  }

  async function handleTrackPress(trackId: string): Promise<void> {
    const index = queue.findIndex(track => track.id === trackId);
    if (index !== -1) {
      await skipToTrack(index);
    }
  }

  function handleRemoveTrack(trackId: string): void {
    const index = queue.findIndex(track => track.id === trackId);
    if (index !== -1) {
      removeFromQueue(index);
    }
  }

  function renderItem({item}: {item: Track}): JSX.Element {
    return (
      <TouchableOpacity
        style={[
          styles.trackItem,
          item.id === activeTrack?.id && styles.currentTrack,
        ]}
        onPress={() => handleTrackPress(item.id)}>
        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle}>{item.title}</Text>
          <Text style={styles.trackArtist}>{item.artist}</Text>
        </View>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveTrack(item.id)}>
          <Icon
            name="close"
            type="material-community"
            size={moderateScale(20)}
            color={theme.colors.text}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}>
          <Icon
            name="chevron-thin-left"
            type="entypo"
            size={moderateScale(20)}
            color={theme.colors.text}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Queue</Text>
        <TouchableOpacity onPress={handleShuffle} style={styles.shuffleButton}>
          <ShuffleIcon color={theme.colors.text} size={moderateScale(24)} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={queue}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
};

function createStyles(theme: Theme) {
  return ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: moderateScale(15),
      paddingVertical: verticalScale(10),
    },
    backButton: {
      padding: moderateScale(10),
      marginRight: moderateScale(10),
      borderRadius: moderateScale(20),
    },
    headerTitle: {
      fontSize: moderateScale(24),
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    shuffleButton: {
      padding: moderateScale(10),
      marginLeft: 'auto',
    },
    listContent: {
      paddingHorizontal: moderateScale(15),
    },
    trackItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(12),
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
  });
}

export default QueueScreen;
