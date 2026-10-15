import {PostHog} from 'posthog-react-native';
import {getOrCreateDeviceId} from './deviceId';
import {
  ANALYTICS_EVENTS,
  PlaybackStartedProps,
  PlaybackPausedProps,
  PlaybackResumedProps,
  PlaybackCompletedProps,
  PlaybackSkippedProps,
  PlaybackSeekedProps,
  MeaningfulListenProps,
  RateChangedProps,
  QueueModifiedProps,
  MushafPageOpenedProps,
  MushafPageReadProps,
  MushafSessionEndedProps,
  AdhkarSessionStartedProps,
  AdhkarSessionCompletedProps,
  TasbeehCompletedProps,
  ReciterSelectedProps,
  RewayahChangedProps,
  DownloadStartedProps,
  DownloadCompletedProps,
  AmbientToggledProps,
  FavoriteToggledProps,
  PlaylistModifiedProps,
  ShareCreatedProps,
  SearchPerformedProps,
  TranslationViewedProps,
  AppBackgroundedProps,
} from './events';
import {localAggregationStore} from './LocalAggregationStore';
import {MeaningfulListenTracker} from './MeaningfulListenTracker';
import {useAnalyticsConsentStore} from '@/store/analyticsConsentStore';

function isAnalyticsEnabled(): boolean {
  return process.env.EXPO_PUBLIC_ANALYTICS_ENABLED !== 'false';
}

/**
 * Whether the user currently consents to analytics.
 *
 * Fails CLOSED until the persisted consent store has hydrated: `zustand/persist`
 * loads from AsyncStorage asynchronously, so on a cold launch the in-memory
 * value is the default (`true`) until the stored choice arrives. Returning
 * `false` while un-hydrated guarantees we never emit an event (or identify a
 * person) before the user's saved opt-out is known.
 */
function isConsentGranted(): boolean {
  if (!useAnalyticsConsentStore.persist.hasHydrated()) return false;
  return useAnalyticsConsentStore.getState().analyticsEnabled;
}

class AnalyticsServiceImpl {
  private posthog: PostHog | null = null;
  private deviceId: string = '';
  private enabled: boolean = true;
  private meaningfulListenTracker: MeaningfulListenTracker;
  private sessionStartTime: number = Date.now();
  private sessionListenMs: number = 0;

  constructor() {
    this.meaningfulListenTracker = new MeaningfulListenTracker(
      (props: MeaningfulListenProps) => {
        this.trackMeaningfulListen(props);
      },
    );
    // Keep the live PostHog instance in lock-step with the consent flag so a
    // caller can never desync the SDK from the store: any change to
    // `analyticsEnabled` (e.g. the Settings → Privacy toggle) pushes straight
    // through to optIn()/optOut().
    useAnalyticsConsentStore.subscribe(state => {
      this.applyConsent(state.analyticsEnabled);
    });
  }

  async initialize(): Promise<void> {
    this.enabled = isAnalyticsEnabled();
    if (!this.enabled) return;
    this.deviceId = getOrCreateDeviceId();
    this.sessionStartTime = Date.now();
    this.sessionListenMs = 0;
  }

  setPostHogInstance(instance: PostHog): void {
    if (!this.enabled) return;
    this.posthog = instance;
    instance.register({platform: 'mobile'});
    // Honor the user's runtime opt-out choice on the fresh instance — but only
    // once the persisted choice has hydrated, so we don't optIn() on the
    // default before a saved opt-out loads. If already hydrated, apply now;
    // otherwise apply on hydration finish.
    const persist = useAnalyticsConsentStore.persist;
    if (persist.hasHydrated()) {
      this.applyConsent(useAnalyticsConsentStore.getState().analyticsEnabled);
    } else {
      const unsub = persist.onFinishHydration(state => {
        unsub();
        this.applyConsent(state.analyticsEnabled);
      });
    }
  }

  /**
   * Apply the user's analytics consent choice to the live PostHog instance.
   * `optIn()`/`optOut()` are persisted by the SDK and respected across launches.
   * Call this whenever the Settings → Privacy toggle changes.
   */
  applyConsent(enabled: boolean): void {
    if (!this.posthog) return;
    // Don't swallow rejections silently — failing to apply an opt-out is
    // privacy-sensitive and should at least surface in logs.
    const applied = enabled ? this.posthog.optIn() : this.posthog.optOut();
    void applied.catch((error: unknown) => {
      console.warn('[Analytics] Failed to apply consent choice:', error);
    });
  }

  private capture(
    event: string,
    properties: Record<string, string | number | boolean | null>,
  ): void {
    // Respect the user's runtime opt-out (Settings → Privacy) in addition to
    // PostHog's own opt-out state — belt-and-suspenders. Fails closed until the
    // consent store has hydrated.
    if (!isConsentGranted()) return;
    this.posthog?.capture(event, properties);
  }

  // --- Listening ---

  trackPlaybackStarted(props: PlaybackStartedProps): void {
    this.capture(ANALYTICS_EVENTS.PLAYBACK_STARTED, {...props});
  }

  trackPlaybackPaused(props: PlaybackPausedProps): void {
    this.capture(ANALYTICS_EVENTS.PLAYBACK_PAUSED, {...props});
    localAggregationStore.addListeningTime(
      localAggregationStore.getToday(),
      props.listened_ms,
      String(props.surah_id),
      props.reciter_id,
    );
    this.sessionListenMs += props.listened_ms;
  }

  trackPlaybackResumed(props: PlaybackResumedProps): void {
    this.capture(ANALYTICS_EVENTS.PLAYBACK_RESUMED, {...props});
  }

  trackPlaybackCompleted(props: PlaybackCompletedProps): void {
    this.capture(ANALYTICS_EVENTS.PLAYBACK_COMPLETED, {...props});
    localAggregationStore.addListeningTime(
      localAggregationStore.getToday(),
      props.listened_ms,
      String(props.surah_id),
      props.reciter_id,
    );
    this.sessionListenMs += props.listened_ms;
  }

  trackPlaybackSkipped(props: PlaybackSkippedProps): void {
    this.capture(ANALYTICS_EVENTS.PLAYBACK_SKIPPED, {...props});
    localAggregationStore.addListeningTime(
      localAggregationStore.getToday(),
      props.listened_ms,
      String(props.surah_id),
      props.reciter_id,
    );
    this.sessionListenMs += props.listened_ms;
  }

  trackPlaybackSeeked(props: PlaybackSeekedProps): void {
    this.capture(ANALYTICS_EVENTS.PLAYBACK_SEEKED, {...props});
  }

  trackMeaningfulListen(props: MeaningfulListenProps): void {
    this.capture(ANALYTICS_EVENTS.MEANINGFUL_LISTEN, {...props});
    localAggregationStore.incrementMeaningfulListens(
      localAggregationStore.getToday(),
    );
    localAggregationStore.markSurahCompleted(String(props.surah_id));
  }

  trackRateChanged(props: RateChangedProps): void {
    this.capture(ANALYTICS_EVENTS.RATE_CHANGED, {...props});
  }

  trackQueueModified(props: QueueModifiedProps): void {
    this.capture(ANALYTICS_EVENTS.QUEUE_MODIFIED, {...props});
  }

  // --- Mushaf ---

  trackMushafPageOpened(props: MushafPageOpenedProps): void {
    this.capture(ANALYTICS_EVENTS.MUSHAF_PAGE_OPENED, {...props});
  }

  trackMushafPageRead(props: MushafPageReadProps): void {
    this.capture(ANALYTICS_EVENTS.MUSHAF_PAGE_READ, {...props});
    localAggregationStore.addPagesRead(localAggregationStore.getToday(), 1);
  }

  trackMushafSessionEnded(props: MushafSessionEndedProps): void {
    this.capture(ANALYTICS_EVENTS.MUSHAF_SESSION_ENDED, {...props});
    localAggregationStore.addPagesOpened(
      localAggregationStore.getToday(),
      props.pages_opened,
    );
  }

  // --- Adhkar ---

  trackAdhkarSessionStarted(props: AdhkarSessionStartedProps): void {
    this.capture(ANALYTICS_EVENTS.ADHKAR_SESSION_STARTED, {...props});
  }

  trackAdhkarSessionCompleted(props: AdhkarSessionCompletedProps): void {
    this.capture(ANALYTICS_EVENTS.ADHKAR_SESSION_COMPLETED, {...props});
    localAggregationStore.incrementAdhkarSessions(
      localAggregationStore.getToday(),
    );
  }

  trackTasbeehCompleted(props: TasbeehCompletedProps): void {
    this.capture(ANALYTICS_EVENTS.TASBEEH_COMPLETED, {...props});
    localAggregationStore.addTasbeehCount(
      localAggregationStore.getToday(),
      props.count,
    );
  }

  // --- Feature Usage ---

  trackReciterSelected(props: ReciterSelectedProps): void {
    this.capture(ANALYTICS_EVENTS.RECITER_SELECTED, {...props});
  }

  trackRewayahChanged(props: RewayahChangedProps): void {
    this.capture(ANALYTICS_EVENTS.REWAYAH_CHANGED, {...props});
  }

  trackDownloadStarted(props: DownloadStartedProps): void {
    this.capture(ANALYTICS_EVENTS.DOWNLOAD_STARTED, {...props});
  }

  trackDownloadCompleted(props: DownloadCompletedProps): void {
    this.capture(ANALYTICS_EVENTS.DOWNLOAD_COMPLETED, {...props});
  }

  trackAmbientToggled(props: AmbientToggledProps): void {
    this.capture(ANALYTICS_EVENTS.AMBIENT_TOGGLED, {...props});
  }

  trackFavoriteToggled(props: FavoriteToggledProps): void {
    this.capture(ANALYTICS_EVENTS.FAVORITE_TOGGLED, {...props});
  }

  trackPlaylistModified(props: PlaylistModifiedProps): void {
    this.capture(ANALYTICS_EVENTS.PLAYLIST_MODIFIED, {...props});
  }

  trackShareCreated(props: ShareCreatedProps): void {
    this.capture(ANALYTICS_EVENTS.SHARE_CREATED, {...props});
  }

  trackSearchPerformed(props: SearchPerformedProps): void {
    this.capture(ANALYTICS_EVENTS.SEARCH_PERFORMED, {...props});
  }

  trackTranslationViewed(props: TranslationViewedProps): void {
    this.capture(ANALYTICS_EVENTS.TRANSLATION_VIEWED, {...props});
  }

  // --- Lifecycle ---

  trackAppOpened(): void {
    this.sessionStartTime = Date.now();
    this.sessionListenMs = 0;
    this.capture(ANALYTICS_EVENTS.APP_OPENED, {});
  }

  trackAppBackgrounded(): void {
    const props: AppBackgroundedProps = {
      session_duration_ms: Date.now() - this.sessionStartTime,
      total_listen_ms: this.sessionListenMs,
    };
    this.capture(ANALYTICS_EVENTS.APP_BACKGROUNDED, {...props});
  }

  // --- Identity ---

  identifyUser(userId: string): void {
    // identify() creates a person profile server-side (more sensitive than a
    // generic event), so it must honor the same opt-out / hydration gate.
    if (!isConsentGranted()) return;
    this.posthog?.identify(userId);
  }

  // --- Helpers ---

  updatePlaybackProgress(positionMs: number): void {
    this.meaningfulListenTracker.updateProgress(positionMs);
  }

  setTrackDuration(
    totalDurationMs: number,
    surahId: number,
    reciterId: string,
    reciterName: string,
    rewayahId: string,
  ): void {
    this.meaningfulListenTracker.startTracking({
      totalDurationMs,
      surahId,
      reciterId,
      reciterName,
      rewayahId,
    });
  }
}

export const analyticsService = new AnalyticsServiceImpl();
