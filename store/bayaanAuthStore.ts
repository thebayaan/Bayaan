import {create} from 'zustand';
import type {BayaanAuthProfile} from '@/types/bayaan-auth';

export type BayaanAuthStatus =
  | 'initializing'
  | 'signed_out'
  | 'signing_in'
  | 'authenticated'
  | 'error';

interface BayaanAuthState {
  status: BayaanAuthStatus;
  profile: BayaanAuthProfile | null;
  errorCode: string | null;
  setInitializing: () => void;
  setSigningIn: () => void;
  setAuthenticated: (profile: BayaanAuthProfile) => void;
  setSignedOut: () => void;
  setError: (code: string) => void;
  resetForTesting: () => void;
}

export const useBayaanAuthStore = create<BayaanAuthState>(set => ({
  status: 'initializing',
  profile: null,
  errorCode: null,
  setInitializing: () =>
    set({status: 'initializing', profile: null, errorCode: null}),
  setSigningIn: () => set({status: 'signing_in', errorCode: null}),
  setAuthenticated: profile =>
    set({status: 'authenticated', profile, errorCode: null}),
  setSignedOut: () =>
    set({status: 'signed_out', profile: null, errorCode: null}),
  setError: code => set({status: 'error', profile: null, errorCode: code}),
  resetForTesting: () =>
    set({status: 'initializing', profile: null, errorCode: null}),
}));
