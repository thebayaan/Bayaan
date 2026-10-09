/**
 * TVAudioProvider (Vega) - hands the app's component instance to the Vega
 * audio engine so the remote's transport keys and Alexa reach the player.
 * The expo-audio version wires a hook-owned player instead; Vega's W3C media
 * player is created by the engine itself.
 */

import React, {useEffect} from 'react';
import {useKeplerAppStateManager} from '@amazon-devices/react-native-kepler';
import {attachMediaControls} from '../../services/audioEngine';

interface TVAudioProviderProps {
  children: React.ReactNode;
}

export function TVAudioProvider({
  children,
}: TVAudioProviderProps): React.ReactElement {
  const appStateManager = useKeplerAppStateManager();

  useEffect(() => {
    attachMediaControls(appStateManager.getComponentInstance());
  }, [appStateManager]);

  return <>{children}</>;
}
