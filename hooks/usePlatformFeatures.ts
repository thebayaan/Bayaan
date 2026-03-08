import {Platform} from 'react-native';

interface PlatformFeatures {
  /** iOS only — MiniPlayer rendered inside NativeTabs.BottomAccessory */
  hasBottomAccessoryPlayer: boolean;
  /** iOS only — minimizeBehavior="onScrollDown" on NativeTabs */
  hasTabMinimizeBehavior: boolean;
  /** iOS only — contentStyle on NativeTabs.Trigger */
  hasTabContentStyle: boolean;
}

const features: PlatformFeatures = {
  hasBottomAccessoryPlayer: Platform.OS === 'ios',
  hasTabMinimizeBehavior: Platform.OS === 'ios',
  hasTabContentStyle: Platform.OS === 'ios',
};

export function usePlatformFeatures(): PlatformFeatures {
  return features;
}
