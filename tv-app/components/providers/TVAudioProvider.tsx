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
import {useAudioPlayer} from 'expo-audio';
import {expoAudioService} from '../../../services/audio/ExpoAudioService';

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

  return <>{children}</>;
}
