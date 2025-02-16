declare module 'react-native-indicators' {
  import {Component} from 'react';
  import {ViewStyle} from 'react-native';

  interface IndicatorProps {
    animationDuration?: number;
    color?: string;
    count?: number;
    size?: number;
    style?: ViewStyle;
  }

  export class PulseIndicator extends Component<IndicatorProps> {}
}
