// @ai-generated
// A system playlist opened from Home's Bayaan Now card: Search's screen, in
// Home's stack so back returns to Home.
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useLocalSearchParams} from 'expo-router';
import {useTranslation} from 'react-i18next';
import SystemPlaylistDetail from '@/components/system-playlist/SystemPlaylistDetail';
import {getSystemPlaylistById} from '@/utils/systemPlaylistHelpers';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';

export default function HomeSystemPlaylistScreen() {
  const {id} = useLocalSearchParams<{id: string}>();
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const playlist = id ? getSystemPlaylistById(id) : undefined;
  if (!playlist) {
    return (
      <View style={styles.center}>
        <Text style={[styles.text, {color: theme.colors.textSecondary}]}>
          {t('systemPlaylist.notFound')}
        </Text>
      </View>
    );
  }
  return <SystemPlaylistDetail playlist={playlist} />;
}

const styles = StyleSheet.create({
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  text: {fontSize: moderateScale(14), fontFamily: 'Manrope-Regular'},
});
