import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useLocalSearchParams} from 'expo-router';
// @ai-start
import {useTranslation} from 'react-i18next';
// @ai-end
import SystemPlaylistDetail from '@/components/system-playlist/SystemPlaylistDetail';
import {getSystemPlaylistById} from '@/utils/systemPlaylistHelpers';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';

// @ai-start
const SystemPlaylistScreen: React.FC = () => {
  const {id} = useLocalSearchParams<{id: string}>();
  const {theme} = useTheme();
  const {t} = useTranslation('home');

  if (!id) {
    return (
      <View style={styles.errorContainer}>
        <Text style={[styles.errorText, {color: theme.colors.textSecondary}]}>
          {t('systemPlaylist.invalidId')}
        </Text>
      </View>
    );
  }

  const playlist = getSystemPlaylistById(id);

  if (!playlist) {
    return (
      <View style={styles.errorContainer}>
        <Text style={[styles.errorText, {color: theme.colors.textSecondary}]}>
          {t('systemPlaylist.notFound')}
        </Text>
      </View>
    );
  }

  return <SystemPlaylistDetail playlist={playlist} />;
};
// @ai-end

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Regular',
  },
});

export default SystemPlaylistScreen;
