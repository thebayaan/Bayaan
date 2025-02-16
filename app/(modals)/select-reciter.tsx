import React, {useCallback, useMemo, useEffect, useState} from 'react';
import {View, Text, Switch} from 'react-native';
import {useRouter, useLocalSearchParams} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, ScaledSheet} from 'react-native-size-matters';
import {useReciterStore} from '@/store/reciterStore';
import {Theme} from '@/utils/themeUtils';
import {Button} from '@/components/Button';
import {getSurahById} from '@/services/dataService';
import BottomSheetModal from '@/components/BottomSheetModal';
import {useSettings} from '@/hooks/useSettings';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {createTracksForReciter} from '@/utils/track';
import {QueueContext} from '@/services/queue/QueueContext';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';

export default function SelectReciterModal() {
  const router = useRouter();
  const {surahId, source} = useLocalSearchParams<{
    surahId: string;
    source?: 'search' | 'home';
  }>();
  const {theme} = useTheme();
  const defaultReciter = useReciterStore(state => state.defaultReciter);
  const [, setSurahName] = useState<string>('');
  const insets = useSafeAreaInsets();

  const {askEveryTime, setAskEveryTime, setDefaultReciterSelection} =
    useSettings();
  const {updateQueue, play} = useUnifiedPlayer();
  const queueContext = QueueContext.getInstance();
  const {addRecentTrack} = useRecentlyPlayedStore();

  useEffect(() => {
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

  const snapPoints = useMemo(() => ['40%'], []);

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

      // Add to recently played list
      await addRecentTrack(defaultReciter, surah, 0, 0);

      // Set current reciter for batch loading
      queueContext.setCurrentReciter(defaultReciter);

      router.back();
    } catch (error) {
      console.error('Error playing surah:', error);
    }
  }, [
    defaultReciter,
    surahId,
    updateQueue,
    play,
    queueContext,
    router,
    addRecentTrack,
  ]);

  const handleBrowseAllReciters = useCallback(() => {
    if (!surahId) return;

    const route =
      source === 'search'
        ? '/(tabs)/(search)/reciter/browse'
        : '/(tabs)/(home)/reciter/browse';

    router.back();
    setTimeout(() => {
      router.push({
        pathname: route,
        params: {
          view: 'all',
          surahId,
        },
      });
    }, 100);
  }, [surahId, router, source]);

  const handleReciterSelection = useCallback(
    (action: () => void, selection: string | null) => {
      if (!askEveryTime) {
        setDefaultReciterSelection(selection);
      }
      action();
    },
    [askEveryTime, setDefaultReciterSelection],
  );

  const handleSheetClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleAskEveryTimeToggle = useCallback(() => {
    setAskEveryTime(!askEveryTime);
  }, [askEveryTime, setAskEveryTime]);

  const createStyles = (_theme: Theme) =>
    ScaledSheet.create({
      container: {
        flex: 1,
      },
      headerContainer: {
        backgroundColor: theme.colors.background,
      },
      contentContainer: {
        flex: 1,
        padding: moderateScale(5),
        backgroundColor: theme.colors.background,
        paddingBottom: insets.bottom,
      },
      title: {
        fontSize: moderateScale(24),
        fontWeight: 'bold',
        fontFamily: theme.fonts.bold,
      },
      button: {
        padding: moderateScale(15),
        borderRadius: moderateScale(20),
        marginTop: moderateScale(10),
        backgroundColor: 'transparent',
        borderWidth: moderateScale(0.4),
        borderColor: theme.colors.border,
        size: 'small',
      },
      buttonText: {
        fontSize: moderateScale(16),
        fontFamily: theme.fonts.bold,
        textAlign: 'center',
        color: theme.colors.text,
      },
      defaultButton: {
        padding: moderateScale(15),
        borderRadius: moderateScale(20),
        marginVertical: moderateScale(5),
        backgroundColor: theme.colors.text,
        borderWidth: moderateScale(0.4),
        borderColor: theme.colors.border,
        textColor: theme.colors.background,
        textWeight: 'bold',
        size: 'small',
      },
      defaultButtonText: {
        fontSize: moderateScale(16),
        fontWeight: 'bold',
        fontFamily: theme.fonts.bold,
        textAlign: 'center',
        color: theme.colors.background,
      },
      askEveryTimeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: moderateScale(15),
        paddingHorizontal: moderateScale(20),
      },
      askEveryTimeText: {
        fontSize: moderateScale(16),
        color: theme.colors.text,
      },
    });

  return (
    <BottomSheetModal
      isVisible={true}
      onClose={handleSheetClose}
      snapPoints={snapPoints}>
      <View style={createStyles(theme).container}>
        <View style={createStyles(theme).headerContainer}>
          <Text style={[createStyles(theme).title, {color: theme.colors.text}]}>
            Select Reciter
          </Text>
        </View>
        <View style={createStyles(theme).contentContainer}>
          <Button
            title="Browse All Reciters"
            style={[createStyles(theme).button]}
            textStyle={createStyles(theme).buttonText}
            onPress={() =>
              handleReciterSelection(handleBrowseAllReciters, 'browseAll')
            }>
            <Text style={[createStyles(theme).buttonText]}>
              Browse All Reciters
            </Text>
          </Button>
          <Button
            title="Use Default Reciter"
            style={[createStyles(theme).defaultButton]}
            textStyle={createStyles(theme).defaultButtonText}
            onPress={() =>
              handleReciterSelection(handleUseDefaultReciter, 'useDefault')
            }>
            <Text style={[createStyles(theme).defaultButtonText]}>
              Use Default Reciter
            </Text>
          </Button>
          <View style={createStyles(theme).askEveryTimeContainer}>
            <Text style={createStyles(theme).askEveryTimeText}>
              Ask every time
            </Text>
            <Switch
              value={askEveryTime}
              onValueChange={handleAskEveryTimeToggle}
              trackColor={{
                false: theme.colors.border,
                true: theme.colors.primary,
              }}
              thumbColor={theme.colors.background}
            />
          </View>
        </View>
      </View>
    </BottomSheetModal>
  );
}
