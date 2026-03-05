import React, {useState, useCallback} from 'react';
import {View, Pressable, StyleSheet} from 'react-native';
import {AntDesign} from '@expo/vector-icons';
import {useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {createStyles} from './_styles';
import {moderateScale} from 'react-native-size-matters';
import RecitersView from '@/components/RecitersView';
import SurahsView from '@/components/SurahsView';
import AdhkarView from '@/components/AdhkarView';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {SuperCategory} from '@/types/adhkar';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import TabSelector from '@/components/TabSelector';
import {useSettings} from '@/hooks/useSettings';
import {useReciterStore} from '@/store/reciterStore';
import Animated from 'react-native-reanimated';
import {Theme} from '@/utils/themeUtils';
import {EdgeInsets} from 'react-native-safe-area-context';
import {SheetManager} from 'react-native-actions-sheet';
import {useReciterSelection} from '@/hooks/useReciterSelection';
import {QuranIcon} from '@/components/Icons';
import {mushafSessionStore} from '@/services/mushaf/MushafSessionStore';

type ViewOption = 'Reciters' | 'Surahs' | 'Adhkar';

interface HeaderProps {
  activeView: ViewOption;
  handleToggle: (option: ViewOption) => void;
  handleMushafPress: () => void;
  handleSettingsPress: () => void;
  theme: Theme;
  insets: EdgeInsets;
}

const Header = React.memo(
  ({
    activeView,
    handleToggle,
    handleMushafPress,
    handleSettingsPress,
    theme,
    insets,
  }: HeaderProps) => {
    return (
      <Animated.View style={[headerStyles.container, {paddingTop: insets.top}]}>
        <View
          style={[
            StyleSheet.absoluteFill,
            {backgroundColor: theme.colors.background},
          ]}
        />
        <View style={headerStyles.header}>
          <Pressable
            style={headerStyles.leftPlaceholder}
            onPress={handleMushafPress}>
            <QuranIcon
              size={moderateScale(30)}
              color={theme.colors.textSecondary}
            />
          </Pressable>
          <View style={headerStyles.centerContainer}>
            <TabSelector
              options={['Reciters', 'Surahs', 'Adhkar']}
              selectedOption={activeView}
              onSelect={handleToggle}
            />
          </View>
          <Pressable
            style={headerStyles.settingsButton}
            onPress={handleSettingsPress}>
            <AntDesign
              name="setting"
              size={moderateScale(20)}
              color={theme.colors.textSecondary}
            />
          </Pressable>
        </View>
      </Animated.View>
    );
  },
  (prevProps, nextProps) =>
    prevProps.activeView === nextProps.activeView &&
    prevProps.handleMushafPress === nextProps.handleMushafPress &&
    prevProps.theme === nextProps.theme &&
    prevProps.insets === nextProps.insets,
);

Header.displayName = 'Header';

const headerStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(16),
    height: moderateScale(56),
  },
  leftPlaceholder: {
    width: moderateScale(40),
    height: moderateScale(40),
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
  },
  settingsButton: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
});


function HomeScreen() {
  const router = useRouter();
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const [activeView, setActiveView] = useState<ViewOption>('Reciters');

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

  const handleSettingsPress = useCallback(() => {
    router.push('/settings');
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

  const headerHeight = moderateScale(56) + insets.top;

  return (
    <View style={styles.container} collapsable={false}>
      <Header
        activeView={activeView}
        handleToggle={handleToggle}
        handleMushafPress={handleMushafPress}
        handleSettingsPress={handleSettingsPress}
        theme={theme}
        insets={insets}
      />
      <View style={{flex: 1, marginTop: headerHeight}} collapsable={false}>
        {activeView === 'Reciters' && (
          <RecitersView onReciterPress={handleReciterPress} />
        )}
        {activeView === 'Surahs' && (
          <SurahsView
            onSurahPress={handleSurahPress}
            onSurahLongPress={handleSurahLongPress}
          />
        )}
        {activeView === 'Adhkar' && (
          <AdhkarView
            onCategoryPress={handleCategoryPress}
            onSavedPress={handleSavedPress}
          />
        )}
      </View>
    </View>
  );
}

export default React.memo(HomeScreen);
