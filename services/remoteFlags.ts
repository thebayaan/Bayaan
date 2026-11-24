// @ai-generated
// Remote switches from PostHog feature flags, for turning a feature on for
// some or all listeners without a release. Each switch is read once per
// launch: whatever it says when the app starts (or within a few seconds,
// while flags load) holds until the next launch, so a screen never swaps
// under someone mid-use. With no PostHog (a fork, analytics off in the
// build, no network) the fallback holds.
import {useEffect, useState} from 'react';

/** Flag keys as they are named in PostHog. */
export const REMOTE_FLAGS = {
  homeRedesign: 'home-redesign',
} as const;

export type RemoteFlag = keyof typeof REMOTE_FLAGS;

/** The part of the PostHog client the switches read. */
export interface RemoteFlagSource {
  getFeatureFlag(key: string): boolean | string | undefined;
  onFeatureFlags(callback: () => void): () => void;
}

/** How long after launch a switch can still be settled by flags loading. */
export const SETTLE_MS = 3000;

let source: RemoteFlagSource | null = null;
const connectListeners = new Set<() => void>();
const settled = new Map<RemoteFlag, boolean>();
let launchedAt = Date.now();

/** Called once the PostHog client exists. */
export function connectRemoteFlags(client: RemoteFlagSource): void {
  source = client;
  connectListeners.forEach(listener => listener());
}

/** For tests: forget the client, the settled switches and the launch time. */
export function resetRemoteFlags(): void {
  source = null;
  connectListeners.clear();
  settled.clear();
  launchedAt = Date.now();
}

/** On for true or any variant other than "control"; undefined while unknown. */
function read(flag: RemoteFlag): boolean | undefined {
  const value = source?.getFeatureFlag(REMOTE_FLAGS[flag]);
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value !== 'control';
  return value;
}

/** A remote switch, settled once per launch. */
export function useRemoteFlag(flag: RemoteFlag, fallback: boolean): boolean {
  const [value, setValue] = useState(
    () => settled.get(flag) ?? read(flag) ?? fallback,
  );

  useEffect(() => {
    const known = settled.get(flag);
    if (known !== undefined) {
      setValue(known);
      return;
    }
    let done = false;
    let stopFlags: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = (next: boolean) => {
      if (done) return;
      done = true;
      settled.set(flag, next);
      setValue(next);
      stopFlags?.();
      if (timer) clearTimeout(timer);
      connectListeners.delete(onConnect);
    };
    const tryRead = () => {
      const next = read(flag);
      if (next !== undefined) settle(next);
    };
    function onConnect() {
      stopFlags = source?.onFeatureFlags(tryRead);
      tryRead();
    }
    if (source) onConnect();
    else connectListeners.add(onConnect);
    if (!done) {
      timer = setTimeout(
        () => settle(read(flag) ?? fallback),
        Math.max(0, launchedAt + SETTLE_MS - Date.now()),
      );
    }
    return () => {
      stopFlags?.();
      if (timer) clearTimeout(timer);
      connectListeners.delete(onConnect);
    };
  }, [flag, fallback]);

  return value;
}
