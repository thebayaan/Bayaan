import {startCarSnapshotService} from './CarSnapshotService';
import {startCarPlaybackBridge} from './CarPlaybackBridge';

export function startCarIntegration(): () => void {
  const snapshot = startCarSnapshotService();
  const stopBridge = startCarPlaybackBridge(snapshot.ready);
  return () => {
    stopBridge();
    snapshot.stop();
  };
}
