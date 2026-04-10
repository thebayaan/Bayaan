import React, {useCallback, useLayoutEffect} from 'react';
import {useRouter, useNavigation} from 'expo-router';
import {useSettings} from '@/hooks/useSettings';
import {useReciterStore} from '@/store/reciterStore';
import {SheetManager} from 'react-native-actions-sheet';
import {useReciterSelection} from '@/hooks/useReciterSelection';
import {Surah} from '@/data/surahData';
import SurahsView from '@/components/SurahsView';

function SurahsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const {askEveryTime, defaultReciterSelection} = useSettings();
  const defaultReciter = useReciterStore(state => state.defaultReciter);
  const {playWithReciter, playWithRandomReciter} = useReciterSelection();

  useLayoutEffect(() => {
    navigation.setOptions({headerShown: false});
  }, [navigation]);

  // Tap -> open mushaf at surah's page
  const handleSurahPress = useCallback(
    (surah: Surah) => {
      router.push({
        pathname: '/mushaf',
        params: {surah: surah.id.toString()},
      });
    },
    [router],
  );

  // Long-press -> audio playback flow
  const handleSurahLongPress = useCallback(
    (surah: Surah) => {
      if (askEveryTime) {
        SheetManager.show('select-reciter', {
          payload: {surahId: surah.id.toString(), source: 'home'},
        });
        return;
      }

      switch (defaultReciterSelection) {
        case 'browseAll':
          router.push({
            pathname: '/(tabs)/(a.home)/reciter/browse',
            params: {view: 'all', surahId: surah.id},
          });
          break;
        case 'searchFavorites':
          router.push({
            pathname: '/(tabs)/(a.home)/reciter/browse',
            params: {view: 'favorites', surahId: surah.id},
          });
          break;
        case 'useDefault':
          if (defaultReciter) {
            playWithReciter(defaultReciter, surah.id.toString()).catch(
              error => {
                console.error('Error playing with default reciter:', error);
              },
            );
          } else {
            SheetManager.show('select-reciter', {
              payload: {surahId: surah.id.toString(), source: 'home'},
            });
          }
          break;
        case 'randomReciter':
          playWithRandomReciter(surah.id.toString()).catch(error => {
            console.error('Error playing with random reciter:', error);
          });
          break;
        default:
          SheetManager.show('select-reciter', {
            payload: {surahId: surah.id.toString(), source: 'home'},
          });
      }
    },
    [
      router,
      askEveryTime,
      defaultReciterSelection,
      defaultReciter,
      playWithReciter,
      playWithRandomReciter,
    ],
  );

  return (
    <SurahsView
      onSurahPress={handleSurahPress}
      onSurahLongPress={handleSurahLongPress}
    />
  );
}

export default React.memo(SurahsScreen);
