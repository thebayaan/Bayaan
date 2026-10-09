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
  // Shared across card mounts, router callbacks and startup restoration.
  authAttempt: number;
  invalidateAttempt: () => number;
  setInitializing: () => number;
  setSigningIn: () => number;
  setAuthenticated: (profile: BayaanAuthProfile, attempt?: number) => void;
  setSignedOut: (attempt?: number) => void;
  setError: (code: string, attempt?: number) => void;
  resetForTesting: () => void;
}

export const useBayaanAuthStore = create<BayaanAuthState>((set, get) => ({
  authAttempt: 0,
  invalidateAttempt: () => {
    const authAttempt = get().authAttempt + 1;
    set({authAttempt});
    return authAttempt;
  },
  status: 'initializing',
  profile: null,
  errorCode: null,
  setInitializing: () => {
    const authAttempt = get().invalidateAttempt();
    set({status: 'initializing', profile: null, errorCode: null});
    return authAttempt;
  },
  setSigningIn: () => {
    const authAttempt = get().invalidateAttempt();
    set({status: 'signing_in', errorCode: null});
    return authAttempt;
  },
  setAuthenticated: (profile, attempt) => {
    if (attempt !== undefined && attempt !== get().authAttempt) return;
    // Guarded router and browser success share ownership: one must not
    // invalidate the other. Unowned external transitions supersede both.
    if (attempt === undefined) get().invalidateAttempt();
    set({status: 'authenticated', profile, errorCode: null});
  },
  setSignedOut: attempt => {
    if (attempt !== undefined && attempt !== get().authAttempt) return;
    if (attempt === undefined) get().invalidateAttempt();
    set({status: 'signed_out', profile: null, errorCode: null});
  },
  setError: (code, attempt) => {
    if (attempt !== undefined && attempt !== get().authAttempt) return;
    if (attempt === undefined) get().invalidateAttempt();
    set({status: 'error', profile: null, errorCode: code});
  },
  resetForTesting: () => {
    get().invalidateAttempt();
    set({status: 'initializing', profile: null, errorCode: null});
  },
}));
