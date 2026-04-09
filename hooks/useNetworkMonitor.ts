import {useEffect} from 'react';
import NetInfo from '@react-native-community/netinfo';
import {useNetworkStore} from '@/store/networkStore';
import {useApiHealthStore} from '@/store/apiHealthStore';
import {getAllReciters} from '@/services/dataService';

/**
 * Subscribes to network state changes globally.
 * Mount once at the root layout level.
 *
 * - Goes offline → marks store as offline
 * - Comes back online → auto-retries reciter fetch to clear any API disruption banner
 */
export function useNetworkMonitor() {
  const setOnline = useNetworkStore(s => s.setOnline);
  const {retryFn} = useApiHealthStore.getState();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      const wasOnline = useNetworkStore.getState().isOnline;

      setOnline(online);

      // Coming back online — silently retry to clear the disruption banner
      if (online && !wasOnline) {
        const retry = useApiHealthStore.getState().retryFn;
        if (retry) {
          retry().catch(() => {});
        } else {
          getAllReciters().catch(() => {});
        }
      }
    });

    return unsubscribe;
  }, [setOnline]);
}
