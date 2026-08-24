import * as SecureStore from 'expo-secure-store';
import type {BayaanOpaqueSession} from '@/types/bayaan-auth';

const SESSION_KEY = 'bayaan:qf-session:v1';
const PENDING_STATE_KEY = 'bayaan:qf-pending-state:v1';
const STORAGE_VERSION = 1;

export interface PendingBayaanAuthState {
  state: string;
  expiresAt: number;
}

interface StoredSession {
  version: typeof STORAGE_VERSION;
  session: BayaanOpaqueSession;
}

interface StoredPendingState {
  version: typeof STORAGE_VERSION;
  pending: PendingBayaanAuthState;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isProfile(value: unknown): value is BayaanOpaqueSession['profile'] {
  return (
    isObject(value) &&
    typeof value.accountId === 'string' &&
    (value.email === undefined || typeof value.email === 'string') &&
    (value.name === undefined || typeof value.name === 'string') &&
    (value.picture === undefined || typeof value.picture === 'string')
  );
}

function isSession(value: unknown): value is BayaanOpaqueSession {
  return (
    isObject(value) &&
    typeof value.token === 'string' &&
    typeof value.expiresAt === 'number' &&
    Number.isFinite(value.expiresAt) &&
    isProfile(value.profile)
  );
}

function isPending(value: unknown): value is PendingBayaanAuthState {
  return (
    isObject(value) &&
    typeof value.state === 'string' &&
    typeof value.expiresAt === 'number' &&
    Number.isFinite(value.expiresAt)
  );
}

export async function saveBayaanSession(
  session: BayaanOpaqueSession,
): Promise<void> {
  const stored: StoredSession = {version: STORAGE_VERSION, session};
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(stored));
}

export async function getBayaanSession(): Promise<BayaanOpaqueSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      !isObject(parsed) ||
      parsed.version !== STORAGE_VERSION ||
      !isSession(parsed.session)
    ) {
      await clearBayaanSession();
      return null;
    }

    if (parsed.session.expiresAt <= Date.now()) {
      await clearBayaanSession();
      return null;
    }

    return parsed.session;
  } catch {
    await clearBayaanSession();
    return null;
  }
}

export async function clearBayaanSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function savePendingBayaanAuthState(
  pending: PendingBayaanAuthState,
): Promise<void> {
  const stored: StoredPendingState = {version: STORAGE_VERSION, pending};
  await SecureStore.setItemAsync(PENDING_STATE_KEY, JSON.stringify(stored));
}

export async function getPendingBayaanAuthState(): Promise<PendingBayaanAuthState | null> {
  const raw = await SecureStore.getItemAsync(PENDING_STATE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      !isObject(parsed) ||
      parsed.version !== STORAGE_VERSION ||
      !isPending(parsed.pending)
    ) {
      await clearPendingBayaanAuthState();
      return null;
    }

    if (parsed.pending.expiresAt <= Date.now()) {
      await clearPendingBayaanAuthState();
      return null;
    }

    return parsed.pending;
  } catch {
    await clearPendingBayaanAuthState();
    return null;
  }
}

export async function clearPendingBayaanAuthState(): Promise<void> {
  await SecureStore.deleteItemAsync(PENDING_STATE_KEY);
}
