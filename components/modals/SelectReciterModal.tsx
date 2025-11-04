import React, {useCallback, useMemo, useState} from 'react';
import {View, Text, Switch, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {useReciterStore} from '@/store/reciterStore';
import {Theme} from '@/utils/themeUtils';
import {Button} from '@/components/Button';
import {getSurahById} from '@/services/dataService';
import {BaseModal} from '@/components/modals/BaseModal';
import {useSettings} from '@/hooks/useSettings';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {createTracksForReciter} from '@/utils/track';
import {QueueContext} from '@/services/queue/QueueContext';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import Color from 'color';
import BottomSheet from '@gorhom/bottom-sheet';
import {useRouter} from 'expo-router';

interface SelectReciterModalProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
  onClose: () => void;
  surahId: string;
  source?: 'search' | 'home';
}

export const SelectReciterModal: React.FC<SelectReciterModalProps> = ({
  bottomSheetRef,
  onClose,
  surahId,
  source,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const defaultReciter = useReciterStore(state => state.defaultReciter);
  const [, setSurahName] = useState<string>('');

  const {askEveryTime, setAskEveryTime, setDefaultReciterSelection} =
    useSettings();
  const {updateQueue, play} = useUnifiedPlayer();
  const queueContext = QueueContext.getInstance();
  const {addRecentTrack} = useRecentlyPlayedStore();
  const router = useRouter();

  React.useEffect(() => {
    const fetchSurahName = async () => {
      if (surahId) {
        const surahIdNumber = parseInt(surahId, 10);
        if (!isNaN(surahIdNumber)) {
          const surah = await getSurahById(surahIdNumber);
          if (surah) {
            setSurahName(surah.name);
          }
        }
      }
    };
    fetchSurahName();
  }, [surahId]);

  const handleUseDefaultReciter = useCallback(async () => {
    if (!surahId || !defaultReciter) return;

    try {
      const surah = await getSurahById(parseInt(surahId, 10));
      if (!surah) return;

      // Create track for the selected surah
      const tracks = await createTracksForReciter(
        defaultReciter,
        [surah],
        defaultReciter.rewayat[0]?.id,
      );

      // Update queue and start playing
      await updateQueue(tracks, 0);
      await play();

      // Add to recently played list with the rewayatId
      await addRecentTrack(
        defaultReciter,
        surah,
        0,
        0,
        defaultReciter.rewayat[0]?.id,
      );

      // Set current reciter for batch loading
      queueContext.setCurrentReciter(defaultReciter);

      onClose();
    } catch (error) {
      console.error('Error playing surah:', error);
    }
  }, [
    defaultReciter,
    surahId,
    updateQueue,
    play,
    queueContext,
    onClose,
    addRecentTrack,
  ]);

  const handleBrowseAllReciters = useCallback(() => {
    if (!surahId) return;

    const route =
      source === 'search'
        ? '/(tabs)/(search)/reciter/browse'
        : '/(tabs)/(home)/reciter/browse';

    onClose();
    setTimeout(() => {
      router.push({
        pathname: route,
        params: {
          view: 'all',
          surahId,
        },
      });
    }, 100);
  }, [surahId, source, onClose, router]);

  const handleReciterSelection = useCallback(
    (action: () => void, selection: string | null) => {
      if (!askEveryTime) {
        setDefaultReciterSelection(selection);
      }
      action();
    },
    [askEveryTime, setDefaultReciterSelection],
  );

  const handleAskEveryTimeToggle = useCallback(() => {
    setAskEveryTime(!askEveryTime);
  }, [askEveryTime, setAskEveryTime]);

  return (
    <BaseModal
      bottomSheetRef={bottomSheetRef}
      snapPoints={['40%']}
      title="Select Reciter"
      onChange={index => {
        if (index === -1) {
          onClose();
        }
      }}>
      <View style={styles.container}>
        <View style={styles.contentContainer}>
          <Button
            title="Browse All Reciters"
            style={styles.button}
            textStyle={styles.buttonText}
            onPress={() =>
              handleReciterSelection(handleBrowseAllReciters, 'browseAll')
            }>
            <Text style={styles.buttonText}>Browse All Reciters</Text>
          </Button>
          <Button
            title="Use Default Reciter"
            style={styles.defaultButton}
            textStyle={styles.defaultButtonText}
            onPress={() =>
              handleReciterSelection(handleUseDefaultReciter, 'useDefault')
            }>
            <Text style={styles.defaultButtonText}>Use Default Reciter</Text>
          </Button>
          <View style={styles.askEveryTimeContainer}>
            <Text style={styles.askEveryTimeText}>Ask every time</Text>
            <Switch
              value={askEveryTime}
              onValueChange={handleAskEveryTimeToggle}
              trackColor={{
                false: Color(theme.colors.border).alpha(0.3).toString(),
                true: Color(theme.colors.text).alpha(0.3).toString(),
              }}
              thumbColor={theme.colors.text}
            />
          </View>
        </View>
      </View>
    </BaseModal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    contentContainer: {
      flex: 1,
      padding: moderateScale(16),
    },
    button: {
      paddingVertical: moderateScale(12),
      paddingHorizontal: moderateScale(16),
      borderRadius: moderateScale(12),
      marginTop: moderateScale(8),
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    buttonText: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.regular,
      textAlign: 'center',
      color: theme.colors.textSecondary,
    },
    defaultButton: {
      paddingVertical: moderateScale(12),
      paddingHorizontal: moderateScale(16),
      borderRadius: moderateScale(12),
      marginTop: moderateScale(8),
      backgroundColor: Color(theme.colors.text).alpha(0.9).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    defaultButtonText: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.semiBold,
      textAlign: 'center',
      color: theme.colors.background,
    },
    askEveryTimeContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      marginTop: moderateScale(16),
      borderTopWidth: 1,
      borderTopColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    askEveryTimeText: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.regular,
      color: theme.colors.text,
    },
  });
