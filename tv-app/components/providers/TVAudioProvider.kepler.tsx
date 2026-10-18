/**
 * TVAudioProvider (Vega) - hands the app's component instance to the Vega
 * audio engine so the remote's transport keys and Alexa reach the player.
 * The expo-audio version wires a hook-owned player instead; Vega's W3C media
 * player is created by the engine itself.
 */

import React, {useEffect} from 'react';
import {useKeplerAppStateManager} from '@amazon-devices/react-native-kepler';
import {adhkarReaderTransport} from '../../services/adhkarReaderTransport';
import {attachMediaControls} from '../../services/audioEngine';
import {playerTransport} from '../../services/mediaTransport';
import {useTVPlayerStore} from '../../store/tvPlayerStore';

interface TVAudioProviderProps {
  children: React.ReactNode;
}

export function TVAudioProvider({
  children,
}: TVAudioProviderProps): React.ReactElement {
  const appStateManager = useKeplerAppStateManager();

  useEffect(() => {
    // The recitation's engine answers through the player store; any other
    // engine (the adhkar reader's) through the open reader's session.
    attachMediaControls(appStateManager.getComponentInstance(), engine =>
      engine === useTVPlayerStore.getState().engine
        ? playerTransport
        : adhkarReaderTransport(),
    );
  }, [appStateManager]);

  return <>{children}</>;
}
