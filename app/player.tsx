// app/player.tsx
import React, {useEffect} from 'react';
import {Redirect} from 'expo-router';
import {expandPlayerSheet} from '@/services/player/sheetRef';

// Expanding while the redirect transition runs gets cancelled by the sheet's
// onChange, so open it once navigation has settled.
const EXPAND_DELAY_MS = 400;

// bayaan://player (widgets): land on home with the full player open.
export default function PlayerDeepLink(): React.ReactElement {
  useEffect(() => {
    // Not cleared on unmount: the Redirect unmounts this screen right away.
    setTimeout(expandPlayerSheet, EXPAND_DELAY_MS);
  }, []);
  return <Redirect href="/(tabs)/(a.home)" />;
}
