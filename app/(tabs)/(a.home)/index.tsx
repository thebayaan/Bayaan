import React, {useState, useCallback, useLayoutEffect, useMemo} from 'react';
import {View, Pressable, StyleSheet, Platform} from 'react-native';
import {useRouter, useNavigation} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {createStyles} from './_styles';
import {moderateScale} from 'react-native-size-matters';
import RecitersView from '@/components/RecitersView';
import SurahsView from '@/components/SurahsView';
import AdhkarView from '@/components/AdhkarView';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {SuperCategory} from '@/types/adhkar';
import TabSelector from '@/components/TabSelector';
import {useSettings} from '@/hooks/useSettings';
import {useReciterStore} from '@/store/reciterStore';
import {SheetManager} from 'react-native-actions-sheet';
import {useReciterSelection} from '@/hooks/useReciterSelection';
import {QuranIcon} from '@/components/Icons';
import Color from 'color';
import {mushafSessionStore} from '@/services/mushaf/MushafSessionStore';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GlassView, isLiquidGlassAvailable} from 'expo-glass-effect';

const USE_GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();

type ViewOption = 'Reciters' | 'Surahs' | 'Adhkar';

function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const [activeView, setActiveView] = useState<ViewOption>('Reciters');
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + moderateScale(52);

  const handleToggle = useCallback((option: ViewOption) => {
    setActiveView(option);
  }, []);

  const handleReciterPress = useCallback(
    (reciter: Reciter) => {
      router.push({
        pathname: '/(tabs)/(a.home)/reciter/[id]',
        params: {id: reciter.id},
      });
    },
    [router],
  );

  const {askEveryTime, defaultReciterSelection} = useSettings();
  const defaultReciter = useReciterStore(state => state.defaultReciter);
  const {playWithReciter, playWithRandomReciter} = useReciterSelection();

  // Tap → open mushaf at surah's page
  const handleSurahPress = useCallback(
    (surah: Surah) => {
      router.push({
        pathname: '/mushaf',
        params: {surah: surah.id.toString()},
      });
    },
    [router],
  );

  // Long-press → audio playback flow
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
            pathname: './reciter/browse',
            params: {view: 'all', surahId: surah.id},
          });
          break;
        case 'searchFavorites':
          router.push({
            pathname: './reciter/browse',
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

  const handleMushafPress = useCallback(() => {
    const lastReadPage = mushafSessionStore.getLastReadPage();
    if (lastReadPage) {
      router.push({
        pathname: '/mushaf',
        params: {page: lastReadPage.toString()},
      });
    } else {
      router.push('/mushaf');
    }
  }, [router]);

  // Navigate to adhkar category (unified route)
  const handleCategoryPress = useCallback(
    (category: SuperCategory) => {
      router.push({
        pathname: '/(tabs)/(a.home)/adhkar/[superId]',
        params: {superId: category.id},
      });
    },
    [router],
  );

  // Navigate to saved adhkar
  const handleSavedPress = useCallback(() => {
    router.push('/(tabs)/(a.home)/adhkar/saved');
  }, [router]);

  // Hide native header — we render a custom one
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const headerStyles = useMemo(
    () => createHeaderStyles(theme, insets.top),
    [theme, insets.top],
  );

  return (
    <View style={styles.container} collapsable={false}>
      {/* Decoy view blocks RNSScrollViewFinder from discovering and overriding
          ScrollView contentInsetAdjustmentBehavior (expo/expo#43056) */}
      <View collapsable={false} style={localStyles.decoy} />
      <View
        style={localStyles.tabLayer}
        pointerEvents={activeView === 'Reciters' ? 'auto' : 'none'}
        opacity={activeView === 'Reciters' ? 1 : 0}>
        <RecitersView
          onReciterPress={handleReciterPress}
          headerHeight={headerHeight}
        />
      </View>
      <View
        style={localStyles.tabLayer}
        pointerEvents={activeView === 'Surahs' ? 'auto' : 'none'}
        opacity={activeView === 'Surahs' ? 1 : 0}>
        <SurahsView
          onSurahPress={handleSurahPress}
          onSurahLongPress={handleSurahLongPress}
          headerHeight={headerHeight}
        />
      </View>
      <View
        style={localStyles.tabLayer}
        pointerEvents={activeView === 'Adhkar' ? 'auto' : 'none'}
        opacity={activeView === 'Adhkar' ? 1 : 0}>
        <AdhkarView
          onCategoryPress={handleCategoryPress}
          onSavedPress={handleSavedPress}
          headerHeight={headerHeight}
        />
      </View>

      {/* Custom header — perfectly centered segmented control */}
      <View style={headerStyles.header}>
        <View style={headerStyles.headerContent}>
          <TabSelector
            options={['Reciters', 'Surahs', 'Adhkar']}
            selectedOption={activeView}
            onSelect={handleToggle}
          />
          {USE_GLASS ? (
            <GlassView
              style={headerStyles.mushafGlass}
              glassEffectStyle="regular"
              isInteractive>
              <Pressable
                onPress={handleMushafPress}
                style={headerStyles.mushafInner}>
                <QuranIcon size={moderateScale(30)} color={theme.colors.text} />
              </Pressable>
            </GlassView>
          ) : (
            <Pressable
              onPress={handleMushafPress}
              style={headerStyles.mushafAndroid}>
              <QuranIcon size={moderateScale(30)} color={theme.colors.text} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  decoy: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
  tabLayer: {
    ...StyleSheet.absoluteFillObject,
  },
});

const createHeaderStyles = (
  theme: {isDarkMode: boolean; colors: {text: string; background: string}},
  topInset: number,
) =>
  StyleSheet.create({
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingTop: topInset,
    },
    headerContent: {
      height: moderateScale(52),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: moderateScale(16),
    },
    mushafGlass: {
      position: 'absolute',
      right: moderateScale(16),
      width: moderateScale(44),
      height: moderateScale(44),
      borderRadius: moderateScale(22),
    },
    mushafInner: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    mushafAndroid: {
      position: 'absolute',
      right: moderateScale(16),
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
      borderRadius: moderateScale(20),
      width: moderateScale(40),
      height: moderateScale(40),
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

export default React.memo(HomeScreen);
