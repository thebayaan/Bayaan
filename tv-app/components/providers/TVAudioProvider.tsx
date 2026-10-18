/**
 * TVAudioProvider - TV-native audio bridge
 *
 * Wires the expo-audio player hook instance into ExpoAudioService so that
 * load/play/pause calls work. Mirrors the bare-minimum setup from the phone's
 * ExpoAudioProvider without pulling in phone-specific deps (lock screen sync,
 * analytics, ambient sound coordination, etc.).
 *
 * Must be mounted at the app root, wrapping the Router.
 */

import React, {useEffect} from 'react';
import {AppState, Platform} from 'react-native';
import {useAudioPlayer} from 'expo-audio';
import {expoAudioService} from '../../../services/audio/ExpoAudioService';
import {useKeepAwakeWhile} from '../../hooks/useKeepAwakeWhile';
import {useTVPlayerStore} from '../../store/tvPlayerStore';

interface TVAudioProviderProps {
  children: React.ReactNode;
}

export function TVAudioProvider({
  children,
}: TVAudioProviderProps): React.ReactElement {
  const player = useAudioPlayer(null);

  useEffect(() => {
    const initializePlayer = async (): Promise<void> => {
      try {
        await expoAudioService.initialize();
        expoAudioService.setPlayer(player);

        if (__DEV__) {
          console.log('[TVAudioProvider] Player connected to ExpoAudioService');
        }
      } catch (error) {
        console.error('[TVAudioProvider] Failed to initialize audio:', error);
      }
    };

    initializePlayer();
  }, [player]);

  // The pause below also runs when the screensaver starts (it backgrounds the
  // app like Home does), so on Android the recitation keeps the screen awake
  // on every screen, not just in the listening room; a paused TV still
  // sleeps.
  const reciting = useTVPlayerStore(
    s => s.status === 'playing' || s.status === 'buffering',
  );
  useKeepAwakeWhile(Platform.OS === 'android' && reciting, 'recitation');

  useEffect(() => {
    // Android TV gives this player no media session or notification, so
    // audio left running after Home (or Back out of the app) could not be
    // paused from anywhere, and the system stops it a few minutes later
    // anyway. Pause on leaving instead; Play resumes on return. tvOS keeps
    // playing in the background as Apple TV audio apps do.
    if (Platform.OS !== 'android') return;
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background' && expoAudioService.getIsPlaying()) {
        void expoAudioService.pause().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  return <>{children}</>;
}
