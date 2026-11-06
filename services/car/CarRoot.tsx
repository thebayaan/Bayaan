import React from 'react';
import {BackgroundRoot, keepAliveTask} from '@/services/audio/BackgroundRoot';

/** AppRegistry name of the headless root BayaanLibraryService starts. */
export const CAR_ROOT_COMPONENT = 'BayaanCarRoot';

/**
 * Headless task Android runs while a car is connected. It never finishes on
 * its own (native finishes it on disconnect); while it runs, React Native
 * keeps JS timers going with no resumed Activity.
 */
export const CAR_KEEP_ALIVE_TASK = 'BayaanCarKeepAlive';

export const carKeepAliveTask = keepAliveTask; // @ai

/**
 * Headless root that Android Auto starts when the phone app is not open. It
 * boots the app services (which start the car integration) and owns the
 * player until the phone layout mounts its own provider, then steps aside.
 * Renders no UI. The shared logic lives in BackgroundRoot. // @ai
 */
export function CarRoot(): React.JSX.Element | null {
  return <BackgroundRoot id="car" />; // @ai
}
