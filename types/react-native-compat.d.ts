// React Native 0.87 stopped exporting `NativeMethods` from its strict type
// API. @react-native-masked-view/masked-view 0.3.2 (the newest release)
// still mixes it into its component class, which turns it into an unusable
// JSX type. Restore the name so its declarations resolve; drop this once the
// package ships updated types.
import type {HostInstance} from 'react-native';

declare module 'react-native' {
  export type NativeMethods = HostInstance;
}
