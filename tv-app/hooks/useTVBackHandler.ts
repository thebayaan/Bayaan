import {useEffect} from 'react';
import {BackHandler} from 'react-native';

export function useTVBackHandler(handler: () => boolean): void {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => sub.remove();
  }, [handler]);
}
