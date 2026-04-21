import {create} from 'zustand';

export type ApiDisruptionReason = 'unreachable' | 'error' | null;

interface ApiHealthState {
  isDisrupted: boolean;
  reason: ApiDisruptionReason;
  usingStaleCache: boolean;
  retryFn: (() => Promise<void>) | null;
  setDisrupted: (
    disrupted: boolean,
    opts?: {reason?: ApiDisruptionReason; stale?: boolean},
  ) => void;
  setRetryFn: (fn: (() => Promise<void>) | null) => void;
  clearDisruption: () => void;
}

export const useApiHealthStore = create<ApiHealthState>()(set => ({
  isDisrupted: false,
  reason: null,
  usingStaleCache: false,
  retryFn: null,
  setDisrupted: (disrupted, opts = {}) =>
    set({
      isDisrupted: disrupted,
      reason: opts.reason ?? 'unreachable',
      usingStaleCache: opts.stale ?? false,
    }),
  setRetryFn: fn => set({retryFn: fn}),
  clearDisruption: () =>
    set({isDisrupted: false, reason: null, usingStaleCache: false}),
}));
