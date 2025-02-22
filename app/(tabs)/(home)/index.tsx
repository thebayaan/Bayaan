import React, {useState, useCallback} from 'react';
import {View, TouchableOpacity, ScrollView} from 'react-native';
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

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: TOTAL_BOTTOM_PADDING,
        }}>
        <View style={[styles.headerContainer, {paddingTop: insets.top}]}>
          <View style={styles.header}>
            <View style={styles.leftPlaceholder} />
            <View style={styles.toggleContainer}>
              <Toggle
                options={['Reciters', 'Surahs']}
                selectedOption={activeView}
                onToggle={handleToggle}
              />
            </View>
            <TouchableOpacity
              activeOpacity={0.99}
              style={styles.settingsIcon}
              onPress={handleSettingsPress}>
              <Icon
                type="antdesign"
                name="setting"
                size={moderateScale(24)}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.contentContainer}>
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
