declare module 'react-native-indicators' {
  import {ComponentType} from 'react';
  import {ViewStyle} from 'react-native';

  interface PulseIndicatorProps {
    animationDuration?: number;
    color?: string;
    count?: number;
    size?: number;
    style?: ViewStyle;
  }

  export const PulseIndicator: ComponentType<PulseIndicatorProps> & {
    new (props: PulseIndicatorProps): any;
  };
}
