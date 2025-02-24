import React, {useState, useCallback} from 'react';
import {View, TouchableOpacity, ScrollView, StyleSheet} from 'react-native';
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
import Toggle from '@/components/Toggle';
import {useSettings} from '@/hooks/useSettings';
import {useReciterStore} from '@/store/reciterStore';
import {TOTAL_BOTTOM_PADDING} from '@/utils/constants';
import {BlurView} from '@react-native-community/blur';
import Animated from 'react-native-reanimated';

export default function HomeScreen() {
  const router = useRouter();
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const [activeView, setActiveView] = useState<'Reciters' | 'Surahs'>(
    'Reciters',
  );

  const handleToggle = (option: 'Reciters' | 'Surahs') => {
    setActiveView(option);
  };

  const handleReciterPress = useCallback(
    (reciter: Reciter) => {
      router.push({
        pathname: '/(tabs)/(home)/reciter/[id]',
        params: {id: reciter.id},
      });
    },
    [router],
  );

  const {askEveryTime, defaultReciterSelection} = useSettings();
  const defaultReciter = useReciterStore(state => state.defaultReciter);

  const handleSurahPress = useCallback(
    (surah: Surah) => {
      if (askEveryTime) {
        router.push({
          pathname: '/(modals)/select-reciter',
          params: {
            surahId: surah.id.toString(),
            source: 'home',
          },
        });
      } else {
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
              router.push({
                pathname: '/player',
                params: {reciterImageUrl: defaultReciter.image_url},
              });
            } else {
              router.push({
                pathname: '/(modals)/select-reciter',
                params: {
                  surahId: surah.id.toString(),
                  source: 'home',
                },
              });
            }
            break;
          default:
            router.push({
              pathname: '/(modals)/select-reciter',
              params: {
                surahId: surah.id.toString(),
                source: 'home',
              },
            });
        }
      }
    },
    [router, askEveryTime, defaultReciterSelection, defaultReciter],
  );

  const handleSettingsPress = () => {
    router.push('/settings');
  };

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
      width: moderateScale(24),
    },
    toggleContainer: {
      flex: 1,
      alignItems: 'center',
    },
    settingsIcon: {
      width: moderateScale(24),
      alignItems: 'flex-end',
    },
    contentContainer: {
      flex: 1,
      marginTop: insets.top + moderateScale(56),
      marginBottom: moderateScale(16),
    },
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[headerStyles.container, {paddingTop: insets.top}]}>
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
        <View style={headerStyles.header}>
          <View style={headerStyles.leftPlaceholder} />
          <View style={headerStyles.toggleContainer}>
            <Toggle
              options={['Reciters', 'Surahs']}
              selectedOption={activeView}
              onToggle={handleToggle}
            />
          </View>
          <TouchableOpacity
            activeOpacity={0.99}
            style={headerStyles.settingsIcon}
            onPress={handleSettingsPress}>
            <Icon
              type="antdesign"
              name="setting"
              size={moderateScale(24)}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </Animated.View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: TOTAL_BOTTOM_PADDING,
        }}>
        <View style={headerStyles.contentContainer}>
          {activeView === 'Reciters' ? (
            <RecitersView onReciterPress={handleReciterPress} />
          ) : (
            <SurahsView onSurahPress={handleSurahPress} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}
