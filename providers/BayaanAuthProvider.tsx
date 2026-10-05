import React, {useEffect, useRef} from 'react';
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

    bayaanAuthService
      .restore()
      .then(session => {
        if (session) {
          useBayaanAuthStore
            .getState()
            .setAuthenticated(session.profile, attempt);
        } else {
          useBayaanAuthStore.getState().setSignedOut(attempt);
        }
      })
      .catch(() => {
        useBayaanAuthStore.getState().setSignedOut(attempt);
      });
  }, []);

  return <>{children}</>;
}
