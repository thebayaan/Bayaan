// @ai-generated
import React, {useEffect} from 'react';
import {StatusBar, Platform, BackHandler} from 'react-native';
import Color from 'color';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useTheme} from '@/hooks/useTheme';
import {usePlayingRewayahObserver} from '@/hooks/usePlayingRewayahObserver';
import {useDevSettingsStore} from '@/store/devSettingsStore';
import {PlayerSheet} from './PlayerSheet';
import {PlayerSurface} from './PlayerSurface';

/**
 * Root-level host for the full player. Owns what must not depend on the
 * container (rewayah toast, Android back, status bar) and picks the container:
 * the gorhom PlayerSheet (default) or the morphing PlayerSurface (dev menu
 * "Morph Player" toggle, while it is being tuned).
 */
export const PlayerHost = () => {
  const {theme} = useTheme();

  // Fires a "Now reading <rewayah>" toast whenever the currently-playing
  // track's resolved rewayah transitions. Mounted here (not deeper) so the
  // observation outlives the sheet's open/close cycles — the toast fires
  // on track changes regardless of whether the sheet is visible.
  usePlayingRewayahObserver();

  const {setSheetMode, setImmersive} = usePlayerActions();
  const queue = usePlayerStore(s => s.queue);
  const loading = usePlayerStore(s => s.loading);
  const sheetMode = usePlayerStore(s => s.sheetMode);
  const isImmersive = usePlayerStore(s => s.isImmersive);
  const useMorphPlayer = useDevSettingsStore(s => s.useMorphPlayer);

  // Handle Android hardware back button
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const handleBackPress = () => {
      if (sheetMode === 'full') {
        if (isImmersive) {
          setImmersive(false);
          return true;
        }
        setSheetMode('hidden');
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress,
    );

    return () => subscription.remove();
  }, [sheetMode, isImmersive, setSheetMode, setImmersive]);

  const currentTrack = queue?.tracks?.[queue?.currentIndex ?? -1];
  const shouldShow = !loading?.stateRestoring && !!currentTrack;

  // Only render modals once settings are loaded to prevent hydration issues
  if (!shouldShow) {
    return null;
  }

  const isLightText = Color(theme.colors.text).isLight();

  return (
    <>
      {sheetMode === 'full' && (
        <StatusBar
          barStyle={isLightText ? 'light-content' : 'dark-content'}
          hidden={isImmersive}
          animated
        />
      )}
      {__DEV__ && useMorphPlayer ? <PlayerSurface /> : <PlayerSheet />}
    </>
  );
};
