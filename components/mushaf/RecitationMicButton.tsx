import React, {useCallback, useEffect} from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {showToast} from '@/utils/toastUtils';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {
  useRecitationTrackingStore,
  type RecitationTrackingStatus,
} from '@/store/recitationTrackingStore';
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

export interface RecitationMic {
  /** The setting is on, so the bar shows the button. */
  enabled: boolean;
  status: RecitationTrackingStatus;
  /** Download progress, 0 to 1, while status is 'downloading'. */
  progress: number;
  busy: boolean;
  toggle: () => Promise<void>;
}

/**
 * Mic state and tap handling shared by the iOS 26 toolbar and the player
 * bar: starts follow-along on the page on screen (asking before the
 * one-time download), stops it when listening, and reports errors.
 */
export function useRecitationMic(currentPage: number): RecitationMic {
  const enabled = useMushafSettingsStore(s => s.showRecitationTracking);
  const status = useRecitationTrackingStore(s => s.status);
  const progress = useRecitationTrackingStore(s => s.downloadProgress);
  const error = useRecitationTrackingStore(s => s.error);
  const errorKind = useRecitationTrackingStore(s => s.errorKind);

  useEffect(() => {
    if (status !== 'error' || !error) return;
    if (errorKind === 'permission') {
      Alert.alert('Microphone is off', error, [
        {text: 'Not now', style: 'cancel'},
        {text: 'Open Settings', onPress: () => void Linking.openSettings()},
      ]);
    } else {
      showToast('Recitation stopped', error, 'error');
    }
    void stopRecitationTracking();
  }, [status, error, errorKind]);

  const toggle = useCallback(async (): Promise<void> => {
    if (status === 'listening') {
      await stopRecitationTracking();
      return;
    }
    if (status !== 'off') return;
    if ((await recitationModelNeedsDownload()) && !(await confirmDownload())) {
      return;
    }
    await startRecitationTracking(pageHint(currentPage));
  }, [status, currentPage]);

  return {
    enabled,
    status,
    progress,
    busy: status === 'loading' || status === 'downloading',
    toggle,
  };
}

interface RecitationMicButtonProps {
  currentPage: number;
  style?: StyleProp<ViewStyle>;
}

export function RecitationMicButton({
  currentPage,
  style,
}: RecitationMicButtonProps): React.JSX.Element | null {
  const {theme} = useTheme();
  const {enabled, status, progress, busy, toggle} =
    useRecitationMic(currentPage);

  if (!enabled) return null;

  return (
    <Pressable
      style={style}
      onPress={toggle}
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
          size={moderateScale(20)}
          color={theme.colors.text}
        />
      )}
    </Pressable>
  );
}
