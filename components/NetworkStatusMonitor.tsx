import {useEffect, useRef} from 'react';
import {useApiHealthStore} from '@/store/apiHealthStore';
import {useNetworkStore} from '@/store/networkStore';
import {useDevSettingsStore} from '@/store/devSettingsStore';
import {showToast} from '@/utils/toastUtils';

/**
 * Fires non-persistent toasts on connectivity / API-health transitions —
 * one on disconnect, one on reconnect, one the first time we fall back to
 * cached data. Replaces the previous always-on pill banner so the UX is
 * identical on iOS and Android (both use the same native toast via
 * `burnt` through `showToast`).
 *
 * Renders nothing — mounts once at the root and listens to the relevant
 * Zustand stores.
 */
export function NetworkStatusMonitor(): null {
  const isOnline = useNetworkStore(s => s.isOnline);
  const {isDisrupted, usingStaleCache} = useApiHealthStore();
  const forceNetworkBanner = useDevSettingsStore(s => s.forceNetworkBanner);

  // On cold start we announce the initial state ONLY if it's offline —
  // the user needs to know they're in a degraded experience. When the
  // initial state is online we stay silent (no "Connection restored"
  // toast on every launch). After that, every transition fires a toast.
  const prevOnlineRef = useRef<boolean | null>(null);
  useEffect(() => {
    const effectiveOnline = isOnline && !forceNetworkBanner;
    const prev = prevOnlineRef.current;
    prevOnlineRef.current = effectiveOnline;
    if (prev === null) {
      if (!effectiveOnline)
        showToast('No internet connection', undefined, 'error');
      return;
    }
    if (prev === effectiveOnline) return;
    if (effectiveOnline) {
      showToast('Connection restored');
    } else {
      showToast('No internet connection', undefined, 'error');
    }
  }, [isOnline, forceNetworkBanner]);

  // Fire once, at the false→true edge of `isDisrupted`, using whatever
  // cache state is current at that moment. `usingStaleCache` is
  // intentionally NOT in the deps: we want a single "Showing cached data"
  // / "Backend unreachable" toast per disruption, not a retoast every
  // time the cache flips while still disrupted. The recovery edge fires
  // no toast — the "Connection restored" toast above covers that
  // narrative; a dedicated "Backend recovered" would double-fire with it.
  const prevDisruptedRef = useRef<boolean | null>(null);
  useEffect(() => {
    const prev = prevDisruptedRef.current;
    prevDisruptedRef.current = isDisrupted;
    if (prev === null) return;
    if (!isDisrupted || prev) return;
    showToast(
      usingStaleCache ? 'Showing cached data' : 'Backend unreachable',
      undefined,
      'error',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDisrupted]);

  return null;
}
