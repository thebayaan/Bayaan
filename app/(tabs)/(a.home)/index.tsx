import React, {useState, useCallback} from 'react';
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import {Icon} from '@rneui/themed';
import {useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {createStyles} from './_styles';
import {moderateScale} from 'react-native-size-matters';
import RecitersView from '@/components/RecitersView';
import SurahsView from '@/components/SurahsView';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import TabSelector from '@/components/TabSelector';
import {useSettings} from '@/hooks/useSettings';
import {useReciterStore} from '@/store/reciterStore';
import {TOTAL_BOTTOM_PADDING} from '@/utils/constants';
import {BlurView} from '@react-native-community/blur';
import Animated from 'react-native-reanimated';
import {Theme} from '@/utils/themeUtils';
import {EdgeInsets} from 'react-native-safe-area-context';
import {useModal} from '@/components/providers/ModalProvider';
import {useReciterSelection} from '@/hooks/useReciterSelection';

interface HeaderProps {
  activeView: 'Reciters' | 'Surahs';
  handleToggle: (option: 'Reciters' | 'Surahs') => void;
  handleSettingsPress: () => void;
  theme: Theme;
  insets: EdgeInsets;
}

// Memoize the header component
const Header = React.memo(
  ({
    activeView,
    handleToggle,
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
      blurContainer: {
        overflow: 'hidden',
        borderWidth: 0.1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      overlay: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.85,
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
        {Platform.OS === 'ios' ? (
          <BlurView
            blurAmount={20}
            blurType={theme.isDarkMode ? 'dark' : 'light'}
            style={[StyleSheet.absoluteFill, headerStyles.blurContainer]}>
            <View
              style={[
                headerStyles.overlay,
                {
                  backgroundColor: theme.colors.background,
                },
              ]}
            />
          </BlurView>
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              headerStyles.blurContainer,
              {
                backgroundColor: theme.colors.background,
                opacity: 0.95,
              },
            ]}>
            <View
              style={[
                headerStyles.overlay,
                {
                  backgroundColor: theme.colors.background,
                },
              ]}
            />
          </View>
        )}
        <View style={headerStyles.header}>
          <View style={headerStyles.leftPlaceholder}>
            {/* You can add a logo or other icon here if needed */}
          </View>
          <View style={headerStyles.centerContainer}>
            <TabSelector
              options={['Reciters', 'Surahs']}
              selectedOption={activeView}
              onSelect={handleToggle}
            />
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            style={headerStyles.settingsButton}
            onPress={handleSettingsPress}>
            <Icon
              type="antdesign"
              name="setting"
              size={moderateScale(20)}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  },
  (prevProps, nextProps) =>
    prevProps.activeView === nextProps.activeView &&
    prevProps.theme === nextProps.theme &&
    prevProps.insets === nextProps.insets,
);

Header.displayName = 'Header';

interface ContentProps {
  activeView: 'Reciters' | 'Surahs';
  handleReciterPress: (reciter: Reciter) => void;
  handleSurahPress: (surah: Surah) => void;
  insets: EdgeInsets;
}

// Memoize the content views
const Content = React.memo(
  ({
    activeView,
    handleReciterPress,
    handleSurahPress,
    insets,
  }: ContentProps) => {
    // Track if each view has been rendered at least once
    const [hasViewedReciters, setHasViewedReciters] = React.useState(true); // Start with true as it's the default
    const [hasViewedSurahs, setHasViewedSurahs] = React.useState(true); // Changed to true to load both components immediately

    // Update the viewed state when active view changes
    React.useEffect(() => {
      if (activeView === 'Reciters' && !hasViewedReciters) {
        setHasViewedReciters(true);
      } else if (activeView === 'Surahs' && !hasViewedSurahs) {
        setHasViewedSurahs(true);
      }
    }, [activeView, hasViewedReciters, hasViewedSurahs]);

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
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingBottom: TOTAL_BOTTOM_PADDING,
              }}>
              <View style={contentStyles.contentContainer}>
                <SurahsView onSurahPress={handleSurahPress} />
              </View>
            </ScrollView>
          </View>
        )}
      </View>
    );
  },
  (prevProps, nextProps) =>
    prevProps.activeView === nextProps.activeView &&
    prevProps.handleReciterPress === nextProps.handleReciterPress &&
    prevProps.handleSurahPress === nextProps.handleSurahPress &&
    prevProps.insets === nextProps.insets,
);

Content.displayName = 'Content';

function HomeScreen() {
  const router = useRouter();
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const [activeView, setActiveView] = useState<'Reciters' | 'Surahs'>(
    'Reciters',
  );

  const handleToggle = useCallback((option: 'Reciters' | 'Surahs') => {
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

  const {showSelectReciter} = useModal();
  const {askEveryTime, defaultReciterSelection} = useSettings();
  const defaultReciter = useReciterStore(state => state.defaultReciter);
  const {playWithReciter, playWithRandomReciter} = useReciterSelection();

  const handleSurahPress = useCallback(
    (surah: Surah) => {
      // For consistency and immediate feedback, always use showSelectReciter directly
      // if askEveryTime is true
      if (askEveryTime) {
        showSelectReciter(surah.id.toString(), 'home');
        return;
      }

      // Otherwise check the various conditions
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
            playWithReciter(defaultReciter, surah.id.toString()).catch(error => {
              console.error('Error playing with default reciter:', error);
            });
          } else {
            showSelectReciter(surah.id.toString(), 'home');
          }
          break;
        case 'randomReciter':
          playWithRandomReciter(surah.id.toString()).catch(error => {
            console.error('Error playing with random reciter:', error);
          });
          break;
        default:
          showSelectReciter(surah.id.toString(), 'home');
      }
    },
    [
      router,
      askEveryTime,
      defaultReciterSelection,
      defaultReciter,
      showSelectReciter,
      playWithReciter,
      playWithRandomReciter,
    ],
  );

  const handleSettingsPress = useCallback(() => {
    router.push('/settings');
  }, [router]);

  return (
    <View style={styles.container}>
      <Header
        activeView={activeView}
        handleToggle={handleToggle}
        handleSettingsPress={handleSettingsPress}
        theme={theme}
        insets={insets}
      />
      <Content
        activeView={activeView}
        handleReciterPress={handleReciterPress}
        handleSurahPress={handleSurahPress}
        insets={insets}
      />
    </View>
  );
}

export default React.memo(HomeScreen);
