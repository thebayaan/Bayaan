import React, {useEffect} from 'react';
import {ActivityIndicator, Alert, Pressable, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {useDevSettingsStore} from '@/store/devSettingsStore';
import {useRecitationTrackingStore} from '@/store/recitationTrackingStore';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {
  recitationModelNeedsDownload,
  setRecitationHint,
  startRecitationTracking,
  stopRecitationTracking,
} from '@/services/recitation/RecitationTrackingService';
import type {SearchHint} from '@tilawa/core';

function pageHint(page: number): SearchHint | null {
  const first = mushafVerseMapService.getOrderedVerseKeysForPage(page)[0];
  if (!first) return null;
  const [surah, ayah] = first.split(':').map(Number);
  return {surah, ayah};
}

function confirmDownload(): Promise<boolean> {
  return new Promise(resolve => {
    Alert.alert(
      'Download recitation model?',
      'Follow-along needs a one-time 75 MB download. Recognition then runs on your device.',
      [
        {text: 'Cancel', style: 'cancel', onPress: () => resolve(false)},
        {text: 'Download', onPress: () => resolve(true)},
      ],
      {cancelable: true, onDismiss: () => resolve(false)},
    );
  });
}

/**
 * Keeps the recitation tracker pointed at the page on screen and stops it
 * when the mushaf closes. Lives in the screen body, not the header button,
 * since header buttons remount whenever the header options change.
 */
export function useRecitationFollowAlong(currentPage: number): void {
  const listening = useRecitationTrackingStore(s => s.status === 'listening');

  useEffect(() => {
    if (listening) setRecitationHint(pageHint(currentPage));
  }, [listening, currentPage]);

  useEffect(() => {
    return () => {
      void stopRecitationTracking();
    };
  }, []);
}

interface RecitationMicButtonProps {
  currentPage: number;
}

export function RecitationMicButton({
  currentPage,
}: RecitationMicButtonProps): React.JSX.Element | null {
  const {theme} = useTheme();
  const enabled = useDevSettingsStore(s => s.recitationFollowAlong);
  const status = useRecitationTrackingStore(s => s.status);
  const progress = useRecitationTrackingStore(s => s.downloadProgress);
  const error = useRecitationTrackingStore(s => s.error);

  useEffect(() => {
    if (status !== 'error' || !error) return;
    Alert.alert('Follow-along stopped', error);
    void stopRecitationTracking();
  }, [status, error]);

  if (!enabled) return null;

  async function handlePress(): Promise<void> {
    if (status === 'listening') {
      await stopRecitationTracking();
      return;
    }
    if (status !== 'off') return;
    if ((await recitationModelNeedsDownload()) && !(await confirmDownload())) {
      return;
    }
    await startRecitationTracking(pageHint(currentPage));
  }

  const busy = status === 'loading' || status === 'downloading';

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={
        status === 'listening' ? 'Stop follow-along' : 'Follow my recitation'
      }>
      {busy ? (
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
          <ActivityIndicator size="small" color={theme.colors.text} />
          {status === 'downloading' && (
            <Text
              style={{
                fontSize: moderateScale(11),
                fontFamily: 'Manrope-Medium',
                color: theme.colors.textSecondary,
              }}>
              {Math.round(progress * 100)}%
            </Text>
          )}
        </View>
      ) : (
        <Ionicons
          name={status === 'listening' ? 'mic' : 'mic-outline'}
          size={moderateScale(22)}
          color={theme.colors.text}
        />
      )}
    </Pressable>
  );
}
