import React from 'react';
import {Animated} from 'react-native';

type Props = {
  visible: boolean;
  children: React.ReactNode;
  fadeMs?: number;
};

export function AutoHideChrome({
  visible,
  children,
  fadeMs = 250,
}: Props): React.ReactElement {
  const opacity = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: visible ? 150 : fadeMs,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity, fadeMs]);

  return (
    <Animated.View style={{opacity}} pointerEvents={visible ? 'auto' : 'none'}>
      {children}
    </Animated.View>
  );
}
