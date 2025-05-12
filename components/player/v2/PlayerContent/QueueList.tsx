import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {Icon} from '@rneui/themed';
import {TrackItem} from '@/components/TrackItem';

interface QueueListProps {
  onQueueItemPress: (index: number) => void;
  onRemoveQueueItem: (index: number) => void;
}

export const QueueList: React.FC<QueueListProps> = ({
  onQueueItemPress,
  onRemoveQueueItem,
}) => {
  const {theme} = useTheme();
  const {queue} = useUnifiedPlayer();

  if (!queue?.tracks?.length) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Icon
            name="playlist-music"
            type="material-community"
            size={moderateScale(48)}
            color={theme.colors.text}
            style={styles.emptyIcon}
          />
          <Text style={[styles.emptyText, {color: theme.colors.text}]}>
            Queue is empty
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="never"
        nestedScrollEnabled={Platform.OS === 'android'}
        disableScrollViewPanResponder={Platform.OS === 'android'}
        scrollEventThrottle={16}>
        {/* Header */}
        <View style={[styles.header, {borderBottomColor: theme.colors.border}]}>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerTitle, {color: theme.colors.text}]}>
              Queue
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.queueCount, {color: theme.colors.text}]}>
              {queue.tracks.length} surahs
            </Text>
          </View>
        </View>

        {/* Queue Items */}
        {queue.tracks.map((track, index) => (
          <View key={`${track.id}-${index}`} style={styles.trackItemContainer}>
            <TrackItem
              reciterId={track.reciterId}
              surahId={track.surahId || ''}
              rewayatId={track.rewayatId}
              onPress={() => onQueueItemPress(index)}
            />
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.removeButton}
              onPress={() => onRemoveQueueItem(index)}>
              <Icon
                name="close"
                type="material-community"
                size={moderateScale(20)}
                color={theme.colors.text}
              />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  list: {
    flex: 1,
    borderRadius: moderateScale(15),
  },
  listContent: {
    paddingBottom: verticalScale(20),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: verticalScale(100),
  },
  emptyIcon: {
    marginBottom: verticalScale(16),
    opacity: 0.7,
  },
  emptyText: {
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-Medium',
    opacity: 0.7,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: moderateScale(16),
    paddingVertical: verticalScale(16),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-Bold',
    marginLeft: moderateScale(8),
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  queueCount: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Medium',
    opacity: 0.7,
  },
  trackItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: moderateScale(8),
  },
  removeButton: {
    padding: moderateScale(8),
  },
});
