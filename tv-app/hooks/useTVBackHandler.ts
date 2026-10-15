import {useEffect} from 'react';
import {BackHandler} from 'react-native';
import {setTVMenuKeyEnabled} from './tvMenuKey';

/**
 * Routes the remote's back button to `handler`. The tvOS menu key is enabled
 * only while `canGoBack`, so Menu still exits the app from a root screen.
 */
export function useTVBackHandler(
  handler: () => boolean,
  canGoBack: boolean,
): void {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => sub.remove();
  }, [handler]);

  useEffect(() => {
    setTVMenuKeyEnabled(canGoBack);
  }, [canGoBack]);
}
