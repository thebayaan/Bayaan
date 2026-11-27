import React, {useCallback, useLayoutEffect} from 'react';
import {useRouter, useNavigation} from 'expo-router';
import {useSettings} from '@/hooks/useSettings';
import {useReciterStore} from '@/store/reciterStore';
import {useReciterSelection} from '@/hooks/useReciterSelection';
import {resolveSurahPlaybackAction} from '@/utils/surahPlaybackChoice'; // @ai
import {Surah} from '@/data/surahData';
import SurahsView from '@/components/SurahsView';
import {showSheet} from '@/components/sheets/sheetControl'; // @ai

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
      // @ai-start
      const surahId = surah.id.toString();
      const action = resolveSurahPlaybackAction({
        askEveryTime,
        defaultReciterSelection,
        hasDefaultReciter: !!defaultReciter,
      });

      switch (action) {
        case 'browseAll':
        case 'browseFavorites':
          router.push({
            // This tab's own copy of the screen. The Home tab's was used
            // before, which switched tab and left the user on Home.
            pathname: '/(tabs)/(b.surahs)/reciter/browse',
            params: {
              view: action === 'browseAll' ? 'all' : 'favorites',
              surahId: surah.id,
            },
          });
          break;
        case 'playDefault':
          if (defaultReciter) {
            playWithReciter(defaultReciter, surahId).catch(error => {
              console.error('Error playing with default reciter:', error);
            });
          }
          break;
        case 'playRandom':
          playWithRandomReciter(surahId).catch(error => {
            console.error('Error playing with random reciter:', error);
          });
          break;
        default:
          showSheet('select-reciter', {payload: {surahId}});
      }
      // @ai-end
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
