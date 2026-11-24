// @ai-generated
// The backend's Bayaan Now occasion: a key date (Laylat al-Qadr, the Day of
// Arafah, Eid…) that sets what each of the two places plays, how it looks
// and what it says, on Home, the widget, the car and TV. Nothing serves it
// yet; when the endpoint lands, fetch it, cache it, and pass the payload
// through parseOccasion here. Until then, a developer preview can set one.
import {useSyncExternalStore} from 'react';
import {parseOccasion, type NowOccasion} from '@/services/bayaanNow/occasion';

let current: NowOccasion | null = null;
const listeners = new Set<() => void>();

/** Sets the occasion from a backend payload (or null to clear it). */
export function setBayaanNowOccasion(payload: unknown): NowOccasion | null {
  current = payload == null ? null : parseOccasion(payload);
  listeners.forEach(listener => listener());
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBayaanNowOccasion(): NowOccasion | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
}
