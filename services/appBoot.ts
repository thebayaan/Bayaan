import * as Sentry from '@sentry/react-native';
import {appInitializer} from '@/services/AppInitializer';
import {expoAudioService} from '@/services/audio/ExpoAudioService';
import {markSessionRestored} from '@/services/car/sessionGate';
import {getAllReciters} from '@/services/dataService';
import {useDownloadStore} from '@/services/player/store/downloadStore';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {restoreSession} from '@/services/player/utils/restoreSession';

// Cold-start budget: if the boot blows past this, fire a one-shot
// 'slow-cold-start' Sentry message naming the phase it stalled in. The boot
// runs once per JS runtime, so this fires at most once per process.
const SLOW_BOOT_THRESHOLD_MS = 8000;

let bootPromise: Promise<void> | null = null;

/**
 * Boots the app's data and player services once per JS runtime: expo-audio,
 * the reciter catalogue, every AppInitializer service (which starts the car
 * integration) and the last session. The phone layout and the headless
 * Android Auto root both await it, so whichever mounts first boots and the
 * other reuses the result. A failed boot can be retried.
 */
export function bootApp(): Promise<void> {
  if (!bootPromise) {
    bootPromise = runBoot().catch((error: unknown) => {
      bootPromise = null;
      throw error;
    });
  }
  return bootPromise;
}

async function runBoot(): Promise<void> {
  // Cold-start observability. Breadcrumb each boot phase so any later
  // crash/ANR carries the boot trail, and fire a one-shot 'slow-cold-start'
  // Sentry message if we blow past the budget, turning the otherwise
  // invisible splash-screen hang into a queryable signal that names the
  // phase it stalled in.
  let lastBootStep = 'start';
  const markBoot = (step: string): void => {
    lastBootStep = step;
    Sentry.addBreadcrumb({category: 'boot', message: step, level: 'info'});
  };
  const slowBootWatchdog = setTimeout(() => {
    Sentry.captureMessage('slow-cold-start', {
      level: 'warning',
      tags: {scope: 'cold-start', boot_step: lastBootStep},
    });
  }, SLOW_BOOT_THRESHOLD_MS);
  try {
    markBoot('start');
    if (__DEV__)
      console.log('[App] Starting initialization with expo-audio...');

    // Initialize expo-audio service
    await expoAudioService.initialize();
    markBoot('expo-audio-ready');
    if (__DEV__) console.log('[App] expo-audio service initialized');

    // Fetch reciter data from backend API (or fallback if killswitch active)
    markBoot('catalog-fetch-start');
    await getAllReciters();
    markBoot('catalog-ready');
    if (__DEV__) console.log('[App] Reciter data loaded');

    // Initialize all SQLite services, adhkar, playlists, mushaf, fonts, stores, etc.
    // This blocks splash screen so everything is ready when the user sees the app
    await appInitializer.initialize();
    markBoot('app-initializer-ready');
    if (__DEV__) console.log('[App] AppInitializer complete');

    // PRE-WARM: Initialize stores BEFORE first play to prevent cold start lag
    try {
      useDownloadStore.getState();
      if (__DEV__) console.log('[App] Download store pre-warmed');

      usePlayerStore.getState();
      if (__DEV__) console.log('[App] Player store pre-warmed');
    } catch (error) {
      console.debug('[App] Failed to pre-warm stores:', error);
    }

    // Restore last session so floating player + lock screen show last track
    try {
      await restoreSession();
      markBoot('session-restored');
      if (__DEV__) console.log('[App] Session restored');
    } catch (error) {
      console.debug('[App] Failed to restore session:', error);
    }
    // Queued cold-start car requests wait for this before they run.
    markSessionRestored();
    markBoot('ready');
  } finally {
    clearTimeout(slowBootWatchdog);
  }
}
