// React Native 0.87 stopped exporting `NativeMethods` from its strict type
// API. @react-native-masked-view/masked-view 0.3.2 and
// @react-native-segmented-control/segmented-control 2.5.7 (the newest
// releases) still mix it into their component classes, which turns both into
// unusable JSX types. Restore the name so their declarations resolve; drop
// this once those packages ship updated types.
import type {HostInstance} from 'react-native';

declare module 'react-native' {
  export type NativeMethods = HostInstance;
}
