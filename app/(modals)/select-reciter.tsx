import React, {useCallback, useMemo, useEffect, useState} from 'react';
import {View, Text, Switch} from 'react-native';
import {useRouter, useLocalSearchParams} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, ScaledSheet} from 'react-native-size-matters';
import {useReciterStore} from '@/store/reciterStore';
import {Theme} from '@/utils/themeUtils';
import {Button} from '@/components/Button';
import {getSurahById} from '@/services/dataService';
import {usePlayerStore} from '@/store/playerStore';
import BottomSheetModal from '@/components/BottomSheetModal';
import {usePlayerNavigation} from '@/hooks/usePlayerNavigation';
import {usePlayback} from '@/hooks/usePlayback';
import {useSettings} from '@/hooks/useSettings';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

export default function SelectReciterModal() {
  const router = useRouter();
  const {surahId} = useLocalSearchParams<{surahId: string}>();
  const {theme} = useTheme();
  const defaultReciter = useReciterStore(state => state.defaultReciter);
  const [, setSurahName] = useState<string>('');
  const insets = useSafeAreaInsets();
  const {askEveryTime, setAskEveryTime, setDefaultReciterSelection} =
    useSettings();

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

  const snapPoints = useMemo(() => ['45%'], []);

  usePlayerStore();

  const {navigateToPlayer} = usePlayerNavigation();
  const {playTrack} = usePlayback();

  const handleUseDefaultReciter = useCallback(() => {
    if (defaultReciter && surahId) {
      playTrack(defaultReciter, surahId);
      navigateToPlayer(defaultReciter.image_url, true);
    }
  }, [defaultReciter, surahId, playTrack, navigateToPlayer]);

  const handleSheetClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleBrowseAllReciters = useCallback(() => {
    handleSheetClose();
    requestAnimationFrame(() => {
      router.push({
        pathname: './reciter/browse',
        params: {view: 'all', surahId},
      });
    });
  }, [router, surahId, handleSheetClose]);

  const handleSearchFavorites = useCallback(() => {
    handleSheetClose();
    requestAnimationFrame(() => {
      router.push({
        pathname: './reciter/browse',
        params: {view: 'favorites', surahId},
      });
    });
  }, [router, surahId, handleSheetClose]);

  const handleAskEveryTimeToggle = useCallback(() => {
    setAskEveryTime(!askEveryTime);
  }, [askEveryTime, setAskEveryTime]);

  const handleReciterSelection = useCallback(
    (action: () => void, selectionType: string) => {
      if (!askEveryTime) {
        setDefaultReciterSelection(selectionType);
      }
      action();
    },
    [askEveryTime, setDefaultReciterSelection],
  );

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
        fontWeight: 'bold',
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
            title="Search from Favorites"
            style={[createStyles(theme).button]}
            textStyle={createStyles(theme).buttonText}
            onPress={() =>
              handleReciterSelection(handleSearchFavorites, 'searchFavorites')
            }>
            <Text style={[createStyles(theme).buttonText]}>
              Search from Favorites
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
