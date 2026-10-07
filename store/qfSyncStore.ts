import {create} from 'zustand';

export type QfSyncStatus =
  | 'disabled'
  | 'signed_out'
  | 'idle'
  | 'syncing'
  | 'offline'
  | 'auth_expired'
  | 'conflict'
  | 'retry';

export type QfSyncHttpClass = 'none' | '2xx' | '4xx' | '5xx' | 'network';

export interface QfSyncDiagnostics {
  pendingCount: number;
  blockedPayloadCounts?: Record<string, number>;
  pushedCount: number;
  ambiguousCount: number;
  conflictCount: number;
  durationMs: number;
  httpClass: QfSyncHttpClass;
  errorCode: string | null;
}

export interface QfGuestMergePrompt {
  accountId: string;
  bookmarkCount: number;
  noteCount: number;
  highlightCount: number;
  totalCount: number;
  submitting: boolean;
}

interface QfSyncState {
  activeAccountId: string | null;
  scopeRevision: number;
  status: QfSyncStatus;
  lastSuccessAt: number | null;
  retryAt: number | null;
  errorCode: string | null;
  diagnostics: QfSyncDiagnostics;
  guestMergePrompt: QfGuestMergePrompt | null;
  syncRequestId: number;
  dataRevision: number;
  requestSync: () => void;
  refreshData: () => void;
  resetForTesting: () => void;
}

export const EMPTY_QF_SYNC_DIAGNOSTICS: QfSyncDiagnostics = {
  pendingCount: 0,
  pushedCount: 0,
  ambiguousCount: 0,
  conflictCount: 0,
  durationMs: 0,
  httpClass: 'none',
  errorCode: null,
};

const initialState = {
  activeAccountId: null,
  scopeRevision: 0,
  status: 'signed_out' as const,
  lastSuccessAt: null,
  retryAt: null,
  errorCode: null,
  diagnostics: EMPTY_QF_SYNC_DIAGNOSTICS,
  guestMergePrompt: null,
  syncRequestId: 0,
  dataRevision: 0,
};

export const useQfSyncStore = create<QfSyncState>()(set => ({
  ...initialState,
  requestSync: () => set(state => ({syncRequestId: state.syncRequestId + 1})),
  refreshData: () => set(state => ({dataRevision: state.dataRevision + 1})),
  resetForTesting: () => set({...initialState}),
}));
