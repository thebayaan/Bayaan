import React, {useCallback} from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {usePlayback} from '@/hooks/usePlayback';
import {
  moderateScale,
  ScaledSheet,
  verticalScale,
} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {usePlayerStore} from '@/store/playerStore';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import {BottomSheetDefaultBackdropProps} from '@gorhom/bottom-sheet/lib/typescript/components/bottomSheetBackdrop/types';

interface QueueModalProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
  onClose: () => void;
}

const QueueModal: React.FC<QueueModalProps> = ({bottomSheetRef, onClose}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {skipTrack, removeTrack} = usePlayback();
  const queue = usePlayerStore(state => state.queue);
  const currentTrack = usePlayerStore(state => state.currentTrack);

  const renderBackdrop = useCallback(
    (
      props: React.JSX.IntrinsicAttributes & BottomSheetDefaultBackdropProps,
    ) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  const handleTrackPress = async (index: number) => {
    try {
      await skipTrack(index);
    } catch (error) {
      console.error('Error skipping to track:', error);
    }
  };

  const handleRemoveTrack = async (index: number) => {
    try {
      await removeTrack(index);
    } catch (error) {
      console.error('Error removing track:', error);
    }
  };

  const renderQueueItems = () => {
    if (queue.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Queue is empty</Text>
        </View>
      );
    }

    return queue.map((item, index) => (
      <TouchableOpacity
        key={`${item.id}-${index}`}
        activeOpacity={0.7}
        style={[
          styles.trackItem,
          item.id === currentTrack?.id && styles.currentTrack,
        ]}
        onPress={() => handleTrackPress(index)}>
        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.trackArtist} numberOfLines={1}>
            {item.artist}
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.removeButton}
          onPress={() => handleRemoveTrack(index)}>
          <MaterialCommunityIcons
            name="close"
            size={moderateScale(20)}
            color={theme.colors.text}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    ));
  };

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={['80%']}
      enablePanDownToClose={true}
      backdropComponent={renderBackdrop}
      backgroundStyle={{backgroundColor: theme.colors.card}}
      handleIndicatorStyle={{backgroundColor: theme.colors.card}}
      onChange={index => {
        if (index === -1) {
          onClose();
        }
      }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Queue</Text>
          <View style={styles.headerRight}>
            <Text style={styles.queueCount}>{queue.length} tracks</Text>
          </View>
        </View>
        <BottomSheetScrollView
          contentContainerStyle={[
            styles.listContent,
            queue.length === 0 && styles.emptyList,
          ]}>
          {renderQueueItems()}
        </BottomSheetScrollView>
      </View>
    </BottomSheet>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.card,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: moderateScale(16),
      paddingVertical: verticalScale(16),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    title: {
      fontSize: moderateScale(20),
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    queueCount: {
      fontSize: moderateScale(14),
      color: theme.colors.textSecondary,
    },
    listContent: {
      paddingHorizontal: moderateScale(16),
    },
    emptyList: {
      flex: 1,
    },
    trackItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: verticalScale(12),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    currentTrack: {
      backgroundColor: theme.colors.primary + '20',
    },
    trackInfo: {
      flex: 1,
      marginRight: moderateScale(16),
    },
    trackTitle: {
      fontSize: moderateScale(16),
      fontWeight: '500',
      color: theme.colors.text,
    },
    trackArtist: {
      fontSize: moderateScale(14),
      color: theme.colors.textSecondary,
      marginTop: verticalScale(4),
    },
    removeButton: {
      padding: moderateScale(8),
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: verticalScale(100),
    },
    emptyText: {
      fontSize: moderateScale(16),
      color: theme.colors.textSecondary,
      marginTop: verticalScale(16),
    },
  });

export default QueueModal;
