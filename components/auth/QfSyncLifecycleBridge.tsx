import React, {useEffect, useState} from 'react';
import {AppState} from 'react-native';
import {useBayaanAuthStore} from '@/store/bayaanAuthStore';
import {useNetworkStore} from '@/store/networkStore';
import {useQfSyncStore} from '@/store/qfSyncStore';
import {qfSyncLifecycle} from '@/services/sync/qfSyncLifecycle';
import {qfSettingsSyncLifecycle} from '@/services/settings/qfSettingsSyncLifecycle';
import {watchLibraryEdits} from '@/services/library/qfLibraryAdapters';
import {GuestDataMergeSheet} from './GuestDataMergeSheet';

/**
 * Feeds auth, network and app-state changes to the QF sync lifecycles, and
 * hosts the guest data merge prompt. Mounted once at the app root.
 */
export function QfSyncLifecycleBridge() {
  const authStatus = useBayaanAuthStore(state => state.status);
  const accountId = useBayaanAuthStore(
    state => state.profile?.accountId ?? null,
  );
  const online = useNetworkStore(state => state.isOnline);
  const syncRequestId = useQfSyncStore(state => state.syncRequestId);
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const context = {
      authStatus,
      accountId,
      online,
      appActive: appState === 'active',
    };
    qfSyncLifecycle.updateContext(context);
    qfSettingsSyncLifecycle.updateContext(context);
  }, [accountId, appState, authStatus, online]);

  useEffect(
    () =>
      watchLibraryEdits(() => {
        if (useBayaanAuthStore.getState().status === 'authenticated') {
          qfSyncLifecycle.requestSync();
        }
      }),
    [],
  );

  useEffect(() => {
    if (syncRequestId > 0) {
      // Settings changes are captured by their own store subscriptions.
      qfSyncLifecycle.requestSync();
    }
  }, [syncRequestId]);

  useEffect(
    () => () => {
      Promise.allSettled([
        qfSyncLifecycle.stop(),
        qfSettingsSyncLifecycle.stop(),
      ]).catch(() => undefined);
    },
    [],
  );

  return <GuestDataMergeSheet />;
}
