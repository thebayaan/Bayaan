import React, {useCallback, useMemo, useEffect, useState} from 'react';
import {View, Text, Switch, StyleSheet} from 'react-native';
import {useRouter, useLocalSearchParams} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {useReciterStore} from '@/store/reciterStore';
import {Theme} from '@/utils/themeUtils';
import {Button} from '@/components/Button';
import {getSurahById} from '@/services/dataService';
import BottomSheetModal from '@/components/BottomSheetModal';
import {useSettings} from '@/hooks/useSettings';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {createTracksForReciter} from '@/utils/track';
import {QueueContext} from '@/services/queue/QueueContext';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import Color from 'color';

export default function SelectReciterModal() {
  const router = useRouter();
  const {surahId, source} = useLocalSearchParams<{
    surahId: string;
    source?: 'search' | 'home';
  }>();
  const {theme} = useTheme();
  const defaultReciter = useReciterStore(state => state.defaultReciter);
  const [, setSurahName] = useState<string>('');

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
    StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: theme.colors.background,
      },
      headerContainer: {
        paddingHorizontal: moderateScale(16),
        paddingVertical: moderateScale(16),
        borderBottomWidth: 1,
        borderBottomColor: Color(theme.colors.border).alpha(0.1).toString(),
        backgroundColor: theme.colors.background,
      },
      contentContainer: {
        flex: 1,
        padding: moderateScale(16),
        backgroundColor: theme.colors.background,
      },
      title: {
        fontSize: moderateScale(18),
        fontFamily: theme.fonts.semiBold,
        color: theme.colors.text,
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

  return (
    <BottomSheetModal
      isVisible={true}
      onClose={handleSheetClose}
      snapPoints={snapPoints}>
      <View style={createStyles(theme).container}>
        <View style={createStyles(theme).headerContainer}>
          <Text style={createStyles(theme).title}>Select Reciter</Text>
        </View>
        <View style={createStyles(theme).contentContainer}>
          <Button
            title="Browse All Reciters"
            style={createStyles(theme).button}
            textStyle={createStyles(theme).buttonText}
            onPress={() =>
              handleReciterSelection(handleBrowseAllReciters, 'browseAll')
            }>
            <Text style={createStyles(theme).buttonText}>
              Browse All Reciters
            </Text>
          </Button>
          <Button
            title="Use Default Reciter"
            style={createStyles(theme).defaultButton}
            textStyle={createStyles(theme).defaultButtonText}
            onPress={() =>
              handleReciterSelection(handleUseDefaultReciter, 'useDefault')
            }>
            <Text style={createStyles(theme).defaultButtonText}>
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
                false: Color(theme.colors.border).alpha(0.3).toString(),
                true: Color(theme.colors.text).alpha(0.3).toString(),
              }}
              thumbColor={theme.colors.text}
            />
          </View>
        </View>
      </View>
    </BottomSheetModal>
  );
}
