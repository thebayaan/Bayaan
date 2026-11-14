/**
 * ExpoAudioProvider - React provider that bridges expo-audio to the store
 *
 * This provider:
 * 1. Owns the runtime's single expo-audio player instance (never released)
 * 2. Connects the player to ExpoAudioService
 * 3. Uses useAudioPlayerStatus to get reactive updates
 * 4. Updates the playerStore with progress/state changes
 * 5. Handles track end (didJustFinish) to auto-advance to next track
 *
 * Must be mounted at the app root level for audio to work.
 */

import {markPlayerReadyForWidgets} from '@/services/widgets/syncWidgets';
import React, {useEffect, useLayoutEffect, useRef, useCallback} from 'react';
import {AppState, Platform} from 'react-native';
import {AudioPlayer, createAudioPlayer, useAudioPlayerStatus} from 'expo-audio';
import {expoAudioService} from './ExpoAudioService';
import {lockScreenService} from './LockScreenService';
import {ambientAudioService} from './AmbientAudioService';
import {audioCoordinator} from './AudioCoordinator';
import {analyticsService} from '@/services/analytics/AnalyticsService';
import {
  usePlayerStore,
  checkSleepTimer, // @ai
} from '@/services/player/store/playerStore';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {useAmbientStore} from '@/store/ambientStore';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {mushafAudioService} from './MushafAudioService';
import {startAdhkarPlaybackEngine} from '@/services/adhkar/playback/adhkarPlaybackEngine';
import {startAdhkarActivitySync} from '@/services/widgets/live-activity/syncAdhkarActivity';
import {
  startSessionSaving,
  restoreSavedSession,
} from '@/services/adhkar/playback/sessionPersistence';
// @ai-start
import {reportPlaybackFailed} from '@/services/player/utils/playbackFailure';

// How long after the store says playing the player is checked to agree.
const PLAYING_CONFIRM_MS = 1500;
// A track-end handler that has not returned after this long is taken as
// stuck, so one hung load cannot swallow every later track end.
const TRACK_END_STUCK_MS = 20000;

/** The slice of a player status that says whether it is trying to play. */
interface PlayIntent {
  playing: boolean;
  isBuffering: boolean;
  timeControlStatus?: string;
}

/**
 * True while the player wants to play but is waiting for data.
 *
 * `isBuffering` alone does not say that. On iOS it is also true for a paused
 * player whose buffer is empty (a restored track before its first play), and
 * that showed a spinner on a paused player and made the first tap call play
 * when the user meant pause. iOS says "waiting to play" in
 * `timeControlStatus`; on Android `playing` holds the intent while the
 * player buffers.
 */
function isWaitingToPlay(status: PlayIntent): boolean {
  if (Platform.OS === 'ios') {
    return status.timeControlStatus === 'waitingToPlayAtSpecifiedRate';
  }
  return status.isBuffering && status.playing;
}
// @ai-end

// Throttle interval for progress updates — wider on Android to reduce re-renders
const PROGRESS_UPDATE_INTERVAL = Platform.OS === 'android' ? 2000 : 1000;
const PROGRESS_PERSIST_INTERVAL = 10000;

interface ExpoAudioProviderProps {
  children: React.ReactNode;
  /**
   * 'car' is the headless Android Auto root, which mounts a provider only
   * while the phone layout's provider is not mounted.
   */
  owner?: 'phone' | 'car';
}

// One player per JS runtime, never released: Android Auto's headless root
// hands the player to the phone layout (and back) without stopping audio.
let sharedPlayer: AudioPlayer | null = null;
let mountedProviders = 0;
let lockScreenSyncing = false;
let stopAdhkarEngine: (() => void) | null = null;
let stopAdhkarActivity: (() => void) | null = null;
let stopAdhkarSaving: (() => void) | null = null;
let phoneProviderMounted = false;
const phoneProviderListeners = new Set<() => void>();

function getSharedPlayer(): AudioPlayer {
  if (!sharedPlayer) sharedPlayer = createAudioPlayer(null);
  return sharedPlayer;
}

function setPhoneProviderMounted(mounted: boolean): void {
  phoneProviderMounted = mounted;
  phoneProviderListeners.forEach(listener => listener());
}

export function subscribePhoneProvider(listener: () => void): () => void {
  phoneProviderListeners.add(listener);
  return () => {
    phoneProviderListeners.delete(listener);
  };
}

export function isPhoneProviderMounted(): boolean {
  return phoneProviderMounted;
}

export function ExpoAudioProvider({
  children,
  owner = 'phone',
}: ExpoAudioProviderProps) {
  const player = getSharedPlayer();

  // Tell the headless car root to step aside before its effects double up.
  useLayoutEffect(() => {
    if (owner !== 'phone') return;
    setPhoneProviderMounted(true);
    return () => setPhoneProviderMounted(false);
  }, [owner]);

  // Get reactive status updates
  const status = useAudioPlayerStatus(player);

  // Refs for tracking state
  const lastProgressUpdate = useRef(0);
  const lastPersistedAt = useRef(0);
  const lastPersistedProgress = useRef(0);
  const latestStatusRef = useRef({
    isLoaded: false,
    currentTime: 0,
    duration: 0,
  });
  const isHandlingTrackEnd = useRef(false);
  const trackEndStartedAt = useRef(0); // @ai
  const wasPlaying = useRef(false);

  // Analytics refs
  const playbackStartTimeRef = useRef(0);
  const accumulatedListenMsRef = useRef(0);
  const lastTrackIdRef = useRef<string | null>(null);
  const hasFiredStartedRef = useRef(false);

  // Get store actions
  const updatePlaybackState = usePlayerStore(
    state => state.updatePlaybackState,
  );
  const skipToNext = usePlayerStore(state => state.skipToNext);

  const persistCurrentProgress = useCallback(
    (position: number, duration: number, force = false) => {
      if (duration <= 0 || position < 0) return;

      const store = usePlayerStore.getState();
      const currentTrack = store.queue.tracks[store.queue.currentIndex];
      if (!currentTrack) return;

      const progress = Math.max(0, Math.min(1, position / duration));
      const now = Date.now();
      const progressDelta = Math.abs(progress - lastPersistedProgress.current);
      const elapsed = now - lastPersistedAt.current;

      // Avoid writing every second; persist meaningful progress or forced events.
      if (
        !force &&
        elapsed < PROGRESS_PERSIST_INTERVAL &&
        progressDelta < 0.01
      ) {
        return;
      }

      if (currentTrack.isUserUpload && currentTrack.userRecitationId) {
        // Upload track — update via upload-specific progress path
        useRecentlyPlayedStore
          .getState()
          .updateUploadProgress(
            currentTrack.userRecitationId,
            progress,
            duration,
          );
      } else if (currentTrack.reciterId && currentTrack.surahId) {
        // System reciter track
        useRecentlyPlayedStore
          .getState()
          .updateProgress(
            currentTrack.reciterId,
            parseInt(currentTrack.surahId, 10),
            progress,
            duration,
          );
      }

      // Always update playerStore playback position (persisted for all tracks)
      store.updatePlaybackState({position, duration});

      lastPersistedAt.current = now;
      lastPersistedProgress.current = progress;
    },
    [],
  );

  // Connect player to service on mount
  useEffect(() => {
    const initializePlayer = async () => {
      try {
        // Initialize the audio service
        await expoAudioService.initialize();

        // Connect the player instance to the service
        expoAudioService.setPlayer(player);

        // Start lock screen sync after player is connected. In a handover
        // the provider that is leaving already started it.
        if (!lockScreenSyncing) {
          lockScreenSyncing = true;
          await lockScreenService.startSync();
          stopAdhkarEngine = startAdhkarPlaybackEngine();
          stopAdhkarActivity = startAdhkarActivitySync();
          stopAdhkarSaving = startSessionSaving();
          restoreSavedSession().catch(() => {});
        }

        markPlayerReadyForWidgets();

        if (__DEV__)
          console.log('[ExpoAudioProvider] Player connected to service');
      } catch (error) {
        console.error('[ExpoAudioProvider] Failed to initialize:', error);
      }
    };

    initializePlayer();
    mountedProviders += 1;

    // Cleanup on unmount. Sync is shared across a handover, so only the last
    // provider out stops it.
    return () => {
      mountedProviders -= 1;
      // Let a handover partner (the car root remounting) mount first.
      setTimeout(() => {
        if (mountedProviders > 0 || !lockScreenSyncing) return;
        lockScreenSyncing = false;
        lockScreenService.stopSync();
        stopAdhkarEngine?.();
        stopAdhkarEngine = null;
        stopAdhkarActivity?.();
        stopAdhkarActivity = null;
        stopAdhkarSaving?.();
        stopAdhkarSaving = null;
      }, 0);
      if (__DEV__) console.log('[ExpoAudioProvider] Unmounting, cleaning up');
    };
  }, [player]);

  // Merged progress + playback state effect (throttled)
  useEffect(() => {
    // @ai-start
    // Android reports a stream that stalls mid-way as not loaded (its
    // "loaded" means ready to play right now), so returning on that alone
    // hid every stall there: the controls stayed on playing over silence.
    const waiting = isWaitingToPlay(status);
    if (!status.isLoaded && !(Platform.OS === 'android' && waiting)) return;

    const now = Date.now();
    // Only playback is throttled. A paused player reports rarely (after a
    // load, after a seek), and dropping one of those left the store on the
    // 0:00 of a fresh load instead of the position it was then moved to.
    const shouldUpdateProgress =
      !status.playing ||
      now - lastProgressUpdate.current >= PROGRESS_UPDATE_INTERVAL;
    // While the store is loading a track, this status is the outgoing
    // source's (its end, typically) and the store already holds where the
    // new track will start.
    const storeIsLoading =
      usePlayerStore.getState().playback.state === 'loading';
    // @ai-end

    // Throttled position/duration update
    if (shouldUpdateProgress && status.isLoaded && !storeIsLoading) {
      lastProgressUpdate.current = now;
      updatePlaybackState({
        position: status.currentTime,
        duration: status.duration,
        buffering: waiting, // @ai
      });

      if (status.playing) {
        persistCurrentProgress(status.currentTime, status.duration);

        // Update meaningful listen tracker (currentTime is in seconds)
        analyticsService.updatePlaybackProgress(
          Math.round(status.currentTime * 1000),
        );
      }
    }

    // Detect track changes for analytics
    const trackStore = usePlayerStore.getState();
    const currentTrack =
      trackStore.queue.tracks[trackStore.queue.currentIndex] ?? null;
    const currentTrackId = currentTrack?.id ?? null;

    if (currentTrackId !== lastTrackIdRef.current) {
      // Track changed — reset accumulated listen time
      accumulatedListenMsRef.current = 0;
      playbackStartTimeRef.current = 0;
      hasFiredStartedRef.current = false;
      lastTrackIdRef.current = currentTrackId;
    }

    // Fire playback_started and set track duration when a new track starts playing
    if (
      currentTrack &&
      !currentTrack.isUserUpload &&
      currentTrack.surahId &&
      status.playing &&
      status.duration > 0 &&
      !hasFiredStartedRef.current
    ) {
      hasFiredStartedRef.current = true;
      playbackStartTimeRef.current = Date.now();

      analyticsService.setTrackDuration(
        Math.round(status.duration * 1000),
        parseInt(currentTrack.surahId, 10),
        currentTrack.reciterId,
        currentTrack.reciterName,
        currentTrack.rewayatId ?? '',
      );

      analyticsService.trackPlaybackStarted({
        surah_id: parseInt(currentTrack.surahId, 10),
        reciter_id: currentTrack.reciterId,
        reciter_name: currentTrack.reciterName,
        rewayah_id: currentTrack.rewayatId ?? '',
        source: 'queue',
        position_ms: Math.round(status.currentTime * 1000),
      });
    }

    // Playback state mapping (always check, not throttled)
    let state: 'playing' | 'paused' | 'buffering' | 'ready' = 'ready';
    if (waiting) {
      state = 'buffering'; // @ai wants to play, waiting for data
    } else if (status.playing) {
      state = 'playing';
    } else {
      state = 'paused';
    }

    const currentState = usePlayerStore.getState().playback.state;
    // @ai 'ended' (the queue finished) stands until playback really starts
    // again: the player's own end status reads as paused, and writing that
    // lost the fact that the queue had ended.
    const keepsEnded = currentState === 'ended' && state !== 'playing';
    if (currentState !== state && currentState !== 'loading' && !keepsEnded) {
      // When main player starts playing, coordinate with mushaf player
      if (state === 'playing' && currentState !== 'playing') {
        audioCoordinator.mainWillPlay();

        // Re-apply playback rate after interruptions (calls, alarms, etc.)
        // The OS resets the native player's rate to 1.0 but the store keeps
        // the user's chosen rate — sync them back up.
        const storedRate = usePlayerStore.getState().playback.rate;
        if (storedRate !== 1 && player.playbackRate !== storedRate) {
          expoAudioService.setRate(storedRate);
        }
      }

      updatePlaybackState({state});

      // Analytics: track play/pause transitions for non-user-upload tracks
      const analyticsTrack =
        trackStore.queue.tracks[trackStore.queue.currentIndex];
      if (
        analyticsTrack &&
        !analyticsTrack.isUserUpload &&
        analyticsTrack.surahId
      ) {
        const surahId = parseInt(analyticsTrack.surahId, 10);

        if (state === 'playing' && currentState === 'paused') {
          // Resumed from pause
          playbackStartTimeRef.current = Date.now();
          analyticsService.trackPlaybackResumed({
            surah_id: surahId,
            reciter_id: analyticsTrack.reciterId,
            reciter_name: analyticsTrack.reciterName,
            position_ms: Math.round(status.currentTime * 1000),
          });
        } else if (
          state === 'paused' &&
          wasPlaying.current &&
          playbackStartTimeRef.current > 0
        ) {
          // Paused from playing — calculate listened time
          const sessionMs = Date.now() - playbackStartTimeRef.current;
          accumulatedListenMsRef.current += sessionMs;
          analyticsService.trackPlaybackPaused({
            surah_id: surahId,
            reciter_id: analyticsTrack.reciterId,
            reciter_name: analyticsTrack.reciterName,
            position_ms: Math.round(status.currentTime * 1000),
            listened_ms: sessionMs,
          });
          playbackStartTimeRef.current = 0;
        }
      }

      // Save progress when pausing (to capture final position)
      if (state === 'paused' && wasPlaying.current && status.duration > 0) {
        persistCurrentProgress(status.currentTime, status.duration, true);
      }
    }

    wasPlaying.current = status.playing;
  }, [
    status.currentTime,
    status.duration,
    status.isLoaded,
    status.isBuffering,
    status.playing,
    status.timeControlStatus, // @ai
    updatePlaybackState,
    persistCurrentProgress,
  ]);

  // @ai-start
  // A source that fails outside a load the store is waiting on: a stream
  // that breaks mid-way, or a load that fails after its wait timed out. The
  // native player then reports neither playing nor loaded, and the effect
  // above returns early on an unloaded player, so the controls kept showing
  // playing (or buffering) over silence. Settle them, and tell the user.
  // While the store is loading, the load itself fails and reports.
  const statusError = (status as {error?: string | null}).error ?? null;
  useEffect(() => {
    if (!statusError) return;
    const store = usePlayerStore.getState();
    if (store.loading.trackLoading || store.playback.state === 'loading') {
      return;
    }
    if (store.queue.tracks[store.queue.currentIndex] === undefined) return;
    store.updatePlaybackState({state: 'paused', buffering: false});
    store.setError('playback', new Error(statusError));
    reportPlaybackFailed();
  }, [statusError]);

  // The store marks itself as playing as soon as it has asked the player to
  // play. The player can decline without an error (another app holds the
  // audio, a call is active, the source sits at its end), and then no status
  // update follows to correct the store. Check once, shortly after, that the
  // player really is playing or still getting there.
  const storePlaybackState = usePlayerStore(state => state.playback.state);
  useEffect(() => {
    if (storePlaybackState !== 'playing') return;
    const timer = setTimeout(() => {
      const store = usePlayerStore.getState();
      if (store.playback.state !== 'playing') return;
      if (store.loading.trackLoading) return;
      const live = player.currentStatus;
      if (live.playing || isWaitingToPlay(live)) return;
      store.updatePlaybackState({state: 'paused'});
    }, PLAYING_CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [storePlaybackState, player]);

  // @ai-end

  // Keep latest status in refs for background persistence events.
  useEffect(() => {
    latestStatusRef.current = {
      isLoaded: status.isLoaded,
      currentTime: status.currentTime,
      duration: status.duration,
    };
  }, [status.isLoaded, status.currentTime, status.duration]);

  // Persist playback progress when app goes to background/inactive.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') return;
      const latest = latestStatusRef.current;
      if (!latest.isLoaded || latest.duration <= 0) return;
      persistCurrentProgress(latest.currentTime, latest.duration, true);
    });

    return () => {
      subscription.remove();
    };
  }, [persistCurrentProgress]);

  // Handle track end (didJustFinish)
  const handleTrackEnd = useCallback(async () => {
    // @ai-start
    // One end is handled at a time. The time limit is there so that a
    // handler which never returns (a load that hangs) cannot swallow every
    // later track end, as it once did on Android with the screen off.
    if (
      isHandlingTrackEnd.current &&
      Date.now() - trackEndStartedAt.current < TRACK_END_STUCK_MS
    ) {
      return;
    }

    isHandlingTrackEnd.current = true;
    const startedAt = Date.now();
    trackEndStartedAt.current = startedAt;
    // @ai-end
    if (__DEV__) console.log('[ExpoAudioProvider] Track ended');

    try {
      const store = usePlayerStore.getState();
      const {repeatMode} = store.settings;
      const {currentIndex, tracks} = store.queue;

      // @ai-start
      // The sleep timer may have run out during this track.
      checkSleepTimer();
      // Record that this track was heard to its end, while it is still the
      // store's current track.
      const endedAt = latestStatusRef.current.duration;
      if (endedAt > 0) persistCurrentProgress(endedAt, endedAt, true);
      // @ai-end

      // Analytics: track completion
      const completedTrack = tracks[currentIndex];
      if (
        completedTrack &&
        !completedTrack.isUserUpload &&
        completedTrack.surahId
      ) {
        const sessionMs =
          playbackStartTimeRef.current > 0
            ? Date.now() - playbackStartTimeRef.current
            : 0;
        const totalListened = accumulatedListenMsRef.current + sessionMs;
        const durationMs = Math.round(latestStatusRef.current.duration * 1000);

        analyticsService.trackPlaybackCompleted({
          surah_id: parseInt(completedTrack.surahId, 10),
          reciter_id: completedTrack.reciterId,
          reciter_name: completedTrack.reciterName,
          duration_ms: durationMs,
          listened_ms: totalListened,
          completion_pct:
            durationMs > 0
              ? Math.round((totalListened / durationMs) * 100)
              : 100,
        });

        // Reset listen tracking refs
        playbackStartTimeRef.current = 0;
        accumulatedListenMsRef.current = 0;
      }

      if (repeatMode === 'track') {
        // Repeat current track
        if (__DEV__)
          console.log('[ExpoAudioProvider] Repeat mode: track - restarting');
        await expoAudioService.seekTo(0);
        await expoAudioService.play();
      } else if (currentIndex < tracks.length - 1 || repeatMode === 'queue') {
        // Auto-advance to next track
        if (__DEV__)
          console.log('[ExpoAudioProvider] Auto-advancing to next track');
        await skipToNext();
      } else {
        // End of queue, no repeat
        if (__DEV__) console.log('[ExpoAudioProvider] End of queue reached');
        updatePlaybackState({state: 'ended'});
      }
    } catch (error) {
      console.error('[ExpoAudioProvider] Error handling track end:', error);
    } finally {
      // @ai Only the handler that still holds the latch releases it.
      if (trackEndStartedAt.current === startedAt) {
        isHandlingTrackEnd.current = false;
      }
    }
  }, [skipToNext, updatePlaybackState, persistCurrentProgress]);

  // @ai-start
  // Listen to the player directly for the end of a track and for the sleep
  // timer.
  //
  // The end used to be read from React state (`status.didJustFinish`). That
  // flag is true on a single status event, and React keeps only the latest
  // event: when another status arrived before the render, the end was never
  // seen and the next surah did not start. A direct listener sees every
  // event, and does not wait for a render.
  //
  // The sleep timer is checked here as well because these events keep
  // arriving while the app is in the background, where React Native on
  // Android stops the JS timers that the timer otherwise runs on.
  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', event => {
      checkSleepTimer();
      if (event.didJustFinish) handleTrackEnd();
    });
    return () => subscription.remove();
  }, [player, handleTrackEnd]);
  // @ai-end

  // ========== AMBIENT SOUND SYNC ==========
  // Sync ambient playback with the active audio source (main or mushaf).
  // Ambient should pause when audio pauses, resume when audio plays,
  // and fade out when the queue ends.
  const prevAudioPlaying = useRef(false);

  // Subscribe to mushaf playback state for ambient sync
  const mushafPlaybackState = useMushafPlayerStore(s => s.playbackState);

  useEffect(() => {
    // Determine if any Quran audio source is currently playing
    const activeSource = audioCoordinator.getActiveSource();
    // @ai-start
    // "Playing" here includes loading the next track and waiting for data.
    // On the raw playing flag the ambient sound cut out at every change of
    // surah and came back a moment later.
    const isAudioPlaying =
      activeSource === 'mushaf'
        ? mushafPlaybackState === 'playing' || mushafPlaybackState === 'loading'
        : storePlaybackState === 'playing' ||
          storePlaybackState === 'buffering' ||
          (storePlaybackState === 'loading' && prevAudioPlaying.current);
    // @ai-end
    const wasAudioPlaying = prevAudioPlaying.current;
    prevAudioPlaying.current = isAudioPlaying;

    // Only act on actual transitions
    if (isAudioPlaying === wasAudioPlaying) return;

    const {isEnabled, currentSound} = useAmbientStore.getState();
    if (!isEnabled || !currentSound) return;

    if (isAudioPlaying) {
      // Audio started playing -> resume ambient
      if (
        ambientAudioService.hasPlayer() &&
        !ambientAudioService.getIsPlaying()
      ) {
        ambientAudioService.play();
        if (__DEV__)
          console.log('[ExpoAudioProvider] Ambient resumed with audio');
      }
    } else {
      // Audio paused -> pause ambient
      if (ambientAudioService.getIsPlaying()) {
        ambientAudioService.pause();
        if (__DEV__)
          console.log('[ExpoAudioProvider] Ambient paused with audio');
      }
    }
  }, [storePlaybackState, mushafPlaybackState]); // @ai

  // Handle queue end — fade out ambient when queue is done
  useEffect(() => {
    const currentState = usePlayerStore.getState().playback.state;
    if (currentState === 'ended') {
      const {isEnabled} = useAmbientStore.getState();
      if (isEnabled && ambientAudioService.getIsPlaying()) {
        ambientAudioService.fadeOut();
        if (__DEV__)
          console.log('[ExpoAudioProvider] Ambient fading out (queue ended)');
      }
    }
  }, [status.didJustFinish]);

  // Render children - this provider doesn't render any UI
  return <>{children}</>;
}

export default ExpoAudioProvider;
