import {useEffect, useRef} from 'react';
import {InteractionManager} from 'react-native';
import {useRouter} from 'expo-router';
import {useBayaanAuthStore} from '@/store/bayaanAuthStore';
import {useQfSyncStore} from '@/store/qfSyncStore';
import {mushafSessionStore} from '@/services/mushaf/MushafSessionStore';

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
    if (mushafSessionStore.getLastScreenWasMushaf()) {
      const page = mushafSessionStore.getLastReadPage();
      router.push({
        pathname: '/mushaf',
        params: page ? {page: String(page)} : undefined,
      });
      InteractionManager.runAfterInteractions(onHandled);
    } else {
      onHandled();
    }
  }, [ready, status, accountId, activeAccountId, router, onHandled]);
}
