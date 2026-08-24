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
    useBayaanAuthStore.getState().setInitializing();

    bayaanAuthService
      .restore()
      .then(session => {
        if (session) {
          useBayaanAuthStore.getState().setAuthenticated(session.profile);
        } else {
          useBayaanAuthStore.getState().setSignedOut();
        }
      })
      .catch(() => {
        useBayaanAuthStore.getState().setSignedOut();
      });
  }, []);

  return <>{children}</>;
}
