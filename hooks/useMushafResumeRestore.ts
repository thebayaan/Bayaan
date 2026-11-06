import {useEffect, useRef} from 'react';
import {Linking} from 'react-native';
import {useRouter} from 'expo-router';
import {useBayaanAuthStore} from '@/store/bayaanAuthStore';
import {useQfSyncStore} from '@/store/qfSyncStore';
import {mushafSessionStore} from '@/services/mushaf/MushafSessionStore';
import {runAfterInteractions} from '@/utils/afterInteractions';

export function useMushafResumeRestore(ready: boolean, onHandled: () => void) {
  const router = useRouter();
  const handled = useRef(false);
  const status = useBayaanAuthStore(state => state.status);
  const accountId = useBayaanAuthStore(
    state => state.profile?.accountId ?? null,
  );
  const activeAccountId = useQfSyncStore(state => state.activeAccountId);

  useEffect(() => {
    if (
      !ready ||
      handled.current ||
      status === 'initializing' ||
      status === 'signing_in'
    )
      return;
    const expectedAccountId = status === 'authenticated' ? accountId : null;
    if (activeAccountId !== expectedAccountId) return;
    // Auth restoration and the lifecycle's scope installation must both settle
    // before this synchronous read. Never cache the guest page during startup.
    handled.current = true;
    // A launch from a deep link (widget tap, notification) already routed
    // to its target; pushing the mushaf on top would hide it.
    Linking.getInitialURL()
      .catch(() => null)
      .then(initialUrl => {
        if (!mushafSessionStore.getLastScreenWasMushaf() || initialUrl) {
          onHandled();
          return;
        }
        const page = mushafSessionStore.getLastReadPage();
        router.push({
          pathname: '/mushaf',
          params: page ? {page: String(page)} : undefined,
        });
        runAfterInteractions(onHandled);
      });
  }, [ready, status, accountId, activeAccountId, router, onHandled]);
}
