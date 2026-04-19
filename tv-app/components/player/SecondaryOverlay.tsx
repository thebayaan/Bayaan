// tv-app/components/player/SecondaryOverlay.tsx
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useOverlayStore} from '../../store/overlayStore';
import {SpeedPicker} from '../overlays/SpeedPicker';
import {SleepTimer} from '../overlays/SleepTimer';
import {AmbientPicker} from '../overlays/AmbientPicker';
import {QueueOverlay} from '../overlays/QueueOverlay';

export function SecondaryOverlay(): React.ReactElement | null {
  const active = useOverlayStore(s => s.active);
  if (!active) return null;
  return (
    <View style={[StyleSheet.absoluteFillObject, styles.scrim]}>
      {active === 'speed' && <SpeedPicker />}
      {active === 'sleep' && <SleepTimer />}
      {active === 'ambient' && <AmbientPicker />}
      {active === 'queue' && <QueueOverlay />}
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
