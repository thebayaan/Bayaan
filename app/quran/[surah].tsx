// app/quran/[surah].tsx
import React, {useSyncExternalStore} from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {Redirect, useLocalSearchParams} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {
  mushafPreloadService,
  type MushafPreloadState,
} from '@/services/mushaf/MushafPreloadService';
import {resolveQuranLink} from '@/utils/quranLink';

const subscribePreload = (listener: () => void): (() => void) =>
  mushafPreloadService.subscribe(listener);
const getPreloadState = (): MushafPreloadState => mushafPreloadService.state;

function pageForVerse(verseKey: string): number | undefined {
  return digitalKhattDataService.initialized
    ? digitalKhattDataService.getPageForVerse(verseKey)
    : undefined;
}

// Canonical /quran/{surah}?ayah=N URL (widgets, App Links). Hands off to the reader.
// A cold start opens the link before the mushaf data loads, so hold the
// redirect until the ayah's page is known (or loading ends without it).
export default function QuranSurahLink(): React.ReactElement {
  const {surah, ayah} = useLocalSearchParams<{surah: string; ayah?: string}>();
  const {theme} = useTheme();
  const preloadState = useSyncExternalStore(subscribePreload, getPreloadState);
  const resolution = resolveQuranLink(
    surah,
    ayah,
    pageForVerse,
    preloadState === 'ready' || preloadState === 'failed',
  );
  if (resolution.status === 'ready') {
    return <Redirect href={{pathname: '/mushaf', params: resolution.params}} />;
  }
  return (
    <View style={[styles.loading, {backgroundColor: theme.colors.background}]}>
      <ActivityIndicator size="large" color={theme.colors.text} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {flex: 1, alignItems: 'center', justifyContent: 'center'},
});
