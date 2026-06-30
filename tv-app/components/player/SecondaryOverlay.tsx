// tv-app/components/player/SecondaryOverlay.tsx
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useOverlayStore} from '../../store/overlayStore';
import {QueueOverlay} from '../overlays/QueueOverlay';

// The Speed, Sleep, and Ambient overlays now render their own scrim and
// self-gate on overlayStore.active (mounted directly in NowPlayingScreen).
// SecondaryOverlay only owns the Queue branch to avoid a doubled scrim.
export function SecondaryOverlay(): React.ReactElement | null {
  const active = useOverlayStore(s => s.active);
  if (active !== 'queue') return null;
  return (
    <View style={[StyleSheet.absoluteFillObject, styles.scrim]}>
      <QueueOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
