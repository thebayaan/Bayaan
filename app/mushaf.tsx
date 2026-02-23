import React, {useEffect, useMemo} from 'react';
import {View, ActivityIndicator, StyleSheet} from 'react-native';
import {useLocalSearchParams} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
import {mushafSessionStore} from '@/services/mushaf/MushafSessionStore';
import MushafViewer from '@/components/mushaf/main';

export type MushafScreenParams = {
  surah?: string;
  page?: string;
  ayah?: string;
};

export default function MushafScreen() {
  const {surah, page, ayah} = useLocalSearchParams<MushafScreenParams>();
  const {theme} = useTheme();

  // Safety net — DK data is initialized at AppInitializer priority 4-5
  if (!digitalKhattDataService.initialized) {
    return (
      <View
        style={[styles.loading, {backgroundColor: theme.colors.background}]}>
        <ActivityIndicator size="large" color={theme.colors.text} />
      </View>
    );
  }

  const surahStartPages = digitalKhattDataService.getSurahStartPages();

  // Resolve page number from params
  const pageNumber = useMemo(() => {
    if (page) {
      const p = parseInt(page, 10);
      if (!isNaN(p) && p >= 1 && p <= 604) return p;
    }
    if (surah) {
      const s = parseInt(surah, 10);
      if (!isNaN(s) && surahStartPages[s]) return surahStartPages[s];
    }
    return 1;
  }, [page, surah, surahStartPages]);

  // Build initial verse key for highlight
  const initialVerseKey = useMemo(() => {
    if (surah && ayah) return `${surah}:${ayah}`;
    return undefined;
  }, [surah, ayah]);

  // Track mushaf screen for session restore (MMKV — sync writes survive force-kill)
  useEffect(() => {
    mushafSessionStore.setLastScreenWasMushaf(true);
    return () => {
      mushafSessionStore.setLastScreenWasMushaf(false);
    };
  }, []);

  // Set verse highlight on mount, auto-clear after 3s, clear on unmount
  useEffect(() => {
    if (initialVerseKey) {
      useMushafVerseSelectionStore
        .getState()
        .selectVerse(initialVerseKey, pageNumber);
      const timer = setTimeout(() => {
        useMushafVerseSelectionStore.getState().clearSelection();
      }, 3000);
      return () => {
        clearTimeout(timer);
        useMushafVerseSelectionStore.getState().clearSelection();
      };
    }
    return () => {
      useMushafVerseSelectionStore.getState().clearSelection();
    };
  }, [initialVerseKey, pageNumber]);

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <MushafViewer pageNumber={pageNumber} initialVerseKey={initialVerseKey} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
