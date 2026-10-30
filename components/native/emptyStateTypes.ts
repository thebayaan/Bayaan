// @ai-generated
import type {ReactNode} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import type {SFSymbol} from 'sf-symbols-typescript';

export interface NativeEmptyStateProps {
  title: string;
  description?: string;
  /** The SF Symbol drawn above the title on iOS. */
  systemImage: SFSymbol;
  /** An optional button under the description, such as "Create playlist". */
  action?: {label: string; systemImage?: SFSymbol; onPress: () => void};
  /** The React Native empty state, shown where the native view isn't. */
  fallback: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}
