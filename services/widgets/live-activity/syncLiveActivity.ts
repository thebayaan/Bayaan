// services/widgets/live-activity/syncLiveActivity.ts
// Drives the Now Playing Live Activity from the widget snapshot pipeline:
// syncWidgets hands over each written snapshot; native calls are serialized.
import {AppState, Platform} from 'react-native';
import {
  currentNowPlayingActivity,
  endNowPlayingActivities,
  isLiveActivitySupported,
  startNowPlayingActivity,
  updateNowPlayingActivity,
  type ActivityStartResult,
  type NowPlayingActivityState,
  type NowPlayingAyah,
  type WidgetSnapshot,
} from 'bayaan-widgets';
import {timestampService} from '@/services/timestamps/TimestampService';
import {timingNumberingService} from '@/services/timestamps/TimingNumberingService';
import {SURAHS} from '@/data/surahData';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {liveActivityMode} from './config';
import {createAyahTicker, type AyahTicker} from './ayahTicker';
import {
  INITIAL_ACTIVITY_MEMORY,
  activityStateFromSnapshot,
  afterEnd,
  afterStart,
  afterUpdate,
  activityTrackKey,
  planActivity,
  type ActivityMemory,
} from './planActivity';

let enabled = false;
let memory: ActivityMemory = INITIAL_ACTIVITY_MEMORY;
let snapshot: WidgetSnapshot | null = null;
let ayah: NowPlayingAyah | null = null;
// One chain for every native call, so a start cannot race an update or end.
let chain: Promise<void> = Promise.resolve();
let ticker: AyahTicker | null = null;
// An activity left by a previous process is adopted or ended on the first
// snapshot of this one.
let adoptPending = false;

function logError(error: unknown): void {
  console.error('[LiveActivity] Failed to sync:', error);
}

// A rejected native call counts as a failed start, so the policy suppresses
// the track instead of retrying it on every snapshot.
async function safeStart(
  state: Parameters<typeof startNowPlayingActivity>[0],
  staleAt: number,
): Promise<ActivityStartResult> {
  try {
    return await startNowPlayingActivity(state, staleAt);
  } catch (error) {
    logError(error);
    return 'error';
  }
}

async function safeUpdate(
  state: Parameters<typeof updateNowPlayingActivity>[0],
  staleAt: number,
): Promise<boolean> {
  try {
    return await updateNowPlayingActivity(state, staleAt);
  } catch (error) {
    logError(error);
    return false;
  }
}

// Keeps a surviving activity that shows the restored track (a paused one
// outlives its process, and its Play button relaunches the app); ends any other.
async function adoptOrEndSurvivor(
  restored: NowPlayingActivityState | null,
): Promise<void> {
  const survivor = currentNowPlayingActivity();
  if (!survivor) return;
  if (restored && activityTrackKey(restored) === activityTrackKey(survivor)) {
    memory = {live: true, last: survivor, suppressedTrack: null};
    return;
  }
  await endNowPlayingActivities();
  memory = afterEnd();
}

// Reads the latest snapshot when it runs, so queued calls collapse.
async function reconcileOnce(): Promise<void> {
  if (!enabled || !snapshot) return;
  const next = activityStateFromSnapshot(snapshot, ayah, Date.now());
  if (adoptPending) {
    adoptPending = false;
    await adoptOrEndSurvivor(next);
  }
  const plan = planActivity(memory, next, Date.now());
  switch (plan.kind) {
    case 'start':
      memory = afterStart(
        memory,
        plan.state,
        await safeStart(plan.state, plan.staleAt),
      );
      return;
    case 'update':
      memory = afterUpdate(
        memory,
        plan.state,
        await safeUpdate(plan.state, plan.staleAt),
      );
      return;
    case 'end':
      await endNowPlayingActivities();
      memory = afterEnd();
      return;
    case 'none':
      // Nothing is loaded any more: replaying the same track may start again.
      if (!next && memory.suppressedTrack) {
        memory = {...memory, suppressedTrack: null};
      }
      return;
  }
}

export function reconcileLiveActivity(): Promise<void> {
  chain = chain.then(reconcileOnce).catch(logError);
  return chain;
}

/** Called by syncWidgets after each snapshot write. */
export function noteSnapshotForLiveActivity(next: WidgetSnapshot): void {
  if (!enabled) return;
  snapshot = next;
  ticker?.onSnapshot(next);
  reconcileLiveActivity().catch(logError);
}

/** Set by the per-ayah layer (ayah mode); null hides the ayah line. */
export function setLiveActivityAyah(next: NowPlayingAyah | null): void {
  if (!enabled) return;
  ayah = next;
  reconcileLiveActivity().catch(logError);
}

// The root layout starts this after init, before startWidgetSync.
export function startLiveActivitySync(): () => void {
  if (Platform.OS !== 'ios' || !isLiveActivitySupported()) {
    return () => undefined;
  }
  if (liveActivityMode() === 'off') {
    // An earlier version may have left a surah activity on screen. The adhkar
    // activity is another ActivityKit type, so this does not touch it.
    endNowPlayingActivities().catch(logError);
    return () => undefined;
  }
  enabled = true;
  memory = INITIAL_ACTIVITY_MEMORY;
  snapshot = null;
  ayah = null;
  adoptPending = true;
  ticker =
    liveActivityMode() === 'ayah'
      ? createAyahTicker({
          loadTimestamps: (rewayatId, surahId) =>
            timestampService.getTimestampsForSurah(rewayatId, surahId),
          resolveNumbering: async (rewayatId, surahId, list) => {
            // The ayah line shows Hafs text whatever rewayah the mushaf is
            // on, so side-load the Hafs words before the first tick.
            await digitalKhattDataService
              .ensureRewayahLoaded('hafs')
              .catch(() => undefined);
            return timingNumberingService.resolve(rewayatId, surahId, list);
          },
          hafsVerseCount: surahId => SURAHS[surahId - 1]?.verses_count ?? 0,
          verseText: key =>
            digitalKhattDataService.initialized
              ? digitalKhattDataService.getVerseText(key, 'hafs')
              : '',
          setAyah: setLiveActivityAyah,
          now: () => Date.now(),
        })
      : null;
  const appState = AppState.addEventListener('change', state => {
    if (state === 'active') reconcileLiveActivity().catch(logError);
  });
  return () => {
    enabled = false;
    snapshot = null;
    ayah = null;
    ticker?.stop();
    ticker = null;
    appState.remove();
  };
}
