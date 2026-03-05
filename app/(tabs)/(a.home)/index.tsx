import React, {useState, useCallback} from 'react';
import {View, Pressable, ScrollView, StyleSheet} from 'react-native';
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
import {TOTAL_BOTTOM_PADDING} from '@/utils/constants';
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

// Memoize the header component
const Header = React.memo(
  ({
    activeView,
    handleToggle,
    handleMushafPress,
    handleSettingsPress,
    theme,
    insets,
  }: HeaderProps) => {
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

interface ContentProps {
  activeView: ViewOption;
  handleReciterPress: (reciter: Reciter) => void;
  handleSurahPress: (surah: Surah) => void;
  handleSurahLongPress: (surah: Surah) => void;
  handleCategoryPress: (category: SuperCategory) => void;
  handleSavedPress: () => void;
  insets: EdgeInsets;
}

// Memoize the content views
const Content = React.memo(
  ({
    activeView,
    handleReciterPress,
    handleSurahPress,
    handleSurahLongPress,
    handleCategoryPress,
    handleSavedPress,
    insets,
  }: ContentProps) => {
    // Track if each view has been rendered at least once
    const [hasViewedReciters, setHasViewedReciters] = React.useState(true); // Start with true as it's the default
    const [hasViewedSurahs, setHasViewedSurahs] = React.useState(true); // Pre-mounted: data ready from AppInitializer
    const [hasViewedAdhkar, setHasViewedAdhkar] = React.useState(true); // Pre-mounted: data ready from AppInitializer

    // Update the viewed state when active view changes
    React.useEffect(() => {
      if (activeView === 'Reciters' && !hasViewedReciters) {
        setHasViewedReciters(true);
      } else if (activeView === 'Surahs' && !hasViewedSurahs) {
        setHasViewedSurahs(true);
      } else if (activeView === 'Adhkar' && !hasViewedAdhkar) {
        setHasViewedAdhkar(true);
      }
    }, [activeView, hasViewedReciters, hasViewedSurahs, hasViewedAdhkar]);

    const contentStyles = StyleSheet.create({
      container: {
        flex: 1,
        paddingTop: moderateScale(56) + insets.top,
      },
      contentContainer: {
        flex: 1,
        marginBottom: moderateScale(16),
      },
      hiddenView: {
        display: 'none',
        position: 'absolute',
        width: '100%',
        height: 0,
        overflow: 'hidden',
        opacity: 0,
      },
      visibleView: {
        flex: 1,
        width: '100%',
        opacity: 1,
      },
    });

    return (
      <View style={contentStyles.container}>
        {/* RecitersView - only render if it has been viewed once */}
        {hasViewedReciters && (
          <View
            style={[
              activeView === 'Reciters'
                ? contentStyles.visibleView
                : contentStyles.hiddenView,
            ]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentInsetAdjustmentBehavior="automatic"
              contentContainerStyle={{
                paddingBottom: TOTAL_BOTTOM_PADDING,
              }}>
              <View style={contentStyles.contentContainer}>
                <RecitersView onReciterPress={handleReciterPress} />
              </View>
            </ScrollView>
          </View>
        )}

        {/* SurahsView - only render if it has been viewed once */}
        {hasViewedSurahs && (
          <View
            style={[
              activeView === 'Surahs'
                ? contentStyles.visibleView
                : contentStyles.hiddenView,
            ]}>
            <SurahsView
              onSurahPress={handleSurahPress}
              onSurahLongPress={handleSurahLongPress}
            />
          </View>
        )}

        {/* AdhkarView - only render if it has been viewed once */}
        {hasViewedAdhkar && (
          <View
            style={[
              activeView === 'Adhkar'
                ? contentStyles.visibleView
                : contentStyles.hiddenView,
            ]}>
            <AdhkarView
              onCategoryPress={handleCategoryPress}
              onSavedPress={handleSavedPress}
            />
          </View>
        )}
      </View>
    );
  },
  (prevProps, nextProps) =>
    prevProps.activeView === nextProps.activeView &&
    prevProps.handleReciterPress === nextProps.handleReciterPress &&
    prevProps.handleSurahPress === nextProps.handleSurahPress &&
    prevProps.handleSurahLongPress === nextProps.handleSurahLongPress &&
    prevProps.handleCategoryPress === nextProps.handleCategoryPress &&
    prevProps.handleSavedPress === nextProps.handleSavedPress &&
    prevProps.insets === nextProps.insets,
);

Content.displayName = 'Content';

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

  return (
    <View style={styles.container}>
      <Header
        activeView={activeView}
        handleToggle={handleToggle}
        handleMushafPress={handleMushafPress}
        handleSettingsPress={handleSettingsPress}
        theme={theme}
        insets={insets}
      />
      <Content
        activeView={activeView}
        handleReciterPress={handleReciterPress}
        handleSurahPress={handleSurahPress}
        handleSurahLongPress={handleSurahLongPress}
        handleCategoryPress={handleCategoryPress}
        handleSavedPress={handleSavedPress}
        insets={insets}
      />
    </View>
  );
}

export default React.memo(HomeScreen);
