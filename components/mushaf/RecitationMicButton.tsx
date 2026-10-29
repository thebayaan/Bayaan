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
import Color from 'color';
import {moderateScale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {showToast} from '@/utils/toastUtils';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {
  useRecitationTrackingStore,
  type RecitationTrackingStatus,
} from '@/store/recitationTrackingStore';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {
  peekRecitation,
  recitationModelNeedsDownload,
  scheduleUnload,
  setRecitationHint,
  startRecitationTracking,
  stopRecitationTracking,
} from '@/services/recitation/RecitationTrackingService';
import type {SearchHint} from '@tilawa/core';
import {SURAHS} from '@/data/surahData';
import {SheetManager} from 'react-native-actions-sheet';

const LEAVE_MUSHAF_UNLOAD_MS = 60 * 1000;

function pageHint(page: number): SearchHint | null {
  const first = mushafVerseMapService.getOrderedVerseKeysForPage(page)[0];
  if (!first) return null;
  const [surah, ayah] = first.split(':').map(Number);
  return {surah, ayah};
}

/** First run: explain the feature before the mic prompt and the download. */
async function confirmIntro(): Promise<boolean> {
  const start = await SheetManager.show('recitation-intro');
  return start === true;
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
      // Leaving the mushaf: stop, and let the model go soon after unless the
      // reader comes straight back.
      void stopRecitationTracking('mushaf_closed').then(() =>
        scheduleUnload(LEAVE_MUSHAF_UNLOAD_MS),
      );
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
  // Tilawa recognises Hafs recitation and reports Hafs words, so the mic
  // only shows over Hafs text.
  const enabled = useMushafSettingsStore(s => s.rewayah === 'hafs');
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
    if ((await recitationModelNeedsDownload()) && !(await confirmIntro())) {
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

/**
 * What the mushaf bar says while recitation follow-along is active, or null
 * when it is off: "Getting ready…", "Finding your place…" or "Ya-Sin 36:4".
 * Shared by the player bar and the iOS 26 toolbar.
 */
export function useRecitationStatusText(): string | null {
  return useRecitationTrackingStore(s => {
    if (s.status === 'loading') return 'Getting ready…';
    if (s.status !== 'listening') return null;
    if (!s.locked || !s.verseKey) return 'Finding your place…';
    const [surah, ayah] = s.verseKey.split(':').map(Number);
    const name = SURAHS[surah - 1]?.name ?? '';
    return `${name} ${surah}:${ayah}`;
  });
}

/**
 * Hide and reveal: shows the next hidden word or ayah, starting from the top
 * of `page` when nothing has been revealed yet.
 */
export function peekOnPage(kind: 'word' | 'ayah', page: number): void {
  const start = pageHint(page);
  if (start) peekRecitation(kind, start);
}

/** The mic while it is listening, so it reads as live. iOS system red. */
export const LIVE_MIC_COLOR = '#FF3B30';

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
  const live = status === 'listening';

  return (
    <Pressable
      style={[
        style,
        live && {backgroundColor: Color(LIVE_MIC_COLOR).alpha(0.15).toString()},
      ]}
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
          name={live ? 'mic' : 'mic-outline'}
          size={moderateScale(20)}
          color={live ? LIVE_MIC_COLOR : theme.colors.text}
        />
      )}
    </Pressable>
  );
}
