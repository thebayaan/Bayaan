import React, {useEffect, useRef} from 'react';
import {AppState} from 'react-native';
import {bayaanAuthService} from '@/services/auth/bayaanAuthService';
import {useBayaanAuthStore} from '@/store/bayaanAuthStore';

export function BayaanAuthProvider({children}: {children: React.ReactNode}) {
  const didRestoreRef = useRef(false);

  useEffect(() => {
    if (didRestoreRef.current) {
      return;
    }

    didRestoreRef.current = true;
    // Child callback effects can claim cold-start ownership before this effect.
    // Remounting the provider must not supersede an already active login either.
    const auth = useBayaanAuthStore.getState();
    if (auth.status !== 'initializing') return;
    // Each restore invocation owns a shared UI attempt too. A remounted
    // provider must supersede the earlier service restore and its UI result.
    const attempt = auth.setInitializing();

    let retryNeeded = false;
    let disposed = false;
    const restore = () => {
      retryNeeded = false;
      bayaanAuthService
        .restore(session => {
          if (!disposed)
            useBayaanAuthStore
              .getState()
              .setAuthenticated(session.profile, attempt);
        })
        .then(session => {
          if (disposed) return;
          if (session)
            useBayaanAuthStore
              .getState()
              .setAuthenticated(session.profile, attempt);
          else useBayaanAuthStore.getState().setSignedOut(attempt);
        })
        .catch(() => {
          if (disposed) return;
          // SecureStore I/O failure is not proof of a missing session. Remain
          // in initializing scope and retry after the device is unlocked.
          retryNeeded = true;
        });
    };
    restore();
    const subscription = AppState.addEventListener('change', state => {
      if (
        state === 'active' &&
        retryNeeded &&
        useBayaanAuthStore.getState().authAttempt === attempt
      )
        restore();
    });
    return () => {
      disposed = true;
      subscription.remove();
    };
  }, []);

  return <>{children}</>;
}
