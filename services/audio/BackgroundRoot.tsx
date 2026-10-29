// @ai-generated
import React, {
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import {bootApp} from '@/services/appBoot';
import {
  ExpoAudioProvider,
  isPhoneProviderMounted,
  subscribePhoneProvider,
} from './ExpoAudioProvider';

/** Headless roots Android starts when the phone app is not open. */
export type BackgroundRootId = 'car' | 'widget';

// Android Auto and a widget tap can each start a headless root in the same
// runtime. Only the first one mounted owns the player: a second provider
// would double its status listeners (and with them track-end handling).
let claims: BackgroundRootId[] = [];
const claimListeners = new Set<() => void>();

function setClaims(next: BackgroundRootId[]): void {
  claims = next;
  claimListeners.forEach(listener => listener());
}

function subscribeClaims(listener: () => void): () => void {
  claimListeners.add(listener);
  return () => {
    claimListeners.delete(listener);
  };
}

function backgroundOwner(): BackgroundRootId | null {
  return claims[0] ?? null;
}

/**
 * Starts the widget syncs the phone layout would start, so the background
 * root drains widget commands and keeps widgets current. Lazy, so tests of
 * the car root do not load the widget services.
 */
function startBackgroundWidgetSync(): () => void {
  const {startWidgetSync} =
    require('@/services/widgets/syncWidgets') as typeof import('@/services/widgets/syncWidgets');
  const {startConfiguredWidgetSync} =
    require('@/services/widgets/syncConfiguredWidgets') as typeof import('@/services/widgets/syncConfiguredWidgets');
  const {startContentWidgetSync} =
    require('@/services/widgets/syncContentWidgets') as typeof import('@/services/widgets/syncContentWidgets');
  const stops = [
    startWidgetSync(),
    startConfiguredWidgetSync(),
    startContentWidgetSync(),
  ];
  return () => stops.forEach(stop => stop());
}

interface BackgroundRootProps {
  id: BackgroundRootId;
  /** Tests replace the widget sync; the app uses the real one. */
  startWidgetSync?: () => () => void;
}

/**
 * Boots the app services and owns the player until the phone layout mounts
 * its own provider, then steps aside. Renders no UI.
 */
export function BackgroundRoot({
  id,
  startWidgetSync = startBackgroundWidgetSync,
}: BackgroundRootProps): React.JSX.Element | null {
  const phoneMounted = useSyncExternalStore(
    subscribePhoneProvider,
    isPhoneProviderMounted,
  );
  const owner = useSyncExternalStore(subscribeClaims, backgroundOwner);
  const [booted, setBooted] = useState(false);

  useLayoutEffect(() => {
    setClaims([...claims, id]);
    return () => setClaims(claims.filter(claim => claim !== id));
  }, [id]);

  useEffect(() => {
    bootApp()
      .then(() => setBooted(true))
      .catch((error: unknown) => {
        if (__DEV__) console.warn(`[BackgroundRoot:${id}] boot failed`, error);
      });
  }, [id]);

  const active = !phoneMounted && owner === id;

  // The phone layout starts its own sync once it is ready.
  useEffect(() => {
    if (!booted || !active) return;
    return startWidgetSync();
  }, [booted, active, startWidgetSync]);

  if (!active) return null;
  return <ExpoAudioProvider owner="car">{null}</ExpoAudioProvider>;
}

/**
 * Headless task that never finishes on its own (native finishes it); while
 * it runs, React Native keeps JS timers going with no resumed Activity.
 */
export function keepAliveTask(): Promise<void> {
  return new Promise<void>(() => undefined);
}

export function resetBackgroundRootsForTests(): void {
  setClaims([]);
}
