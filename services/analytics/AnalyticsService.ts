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

function isAnalyticsEnabled(): boolean {
  return process.env.EXPO_PUBLIC_ANALYTICS_ENABLED !== 'false';
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
  }

  private capture(
    event: string,
    properties: Record<string, string | number | boolean | null>,
  ): void {
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
    rewayahId: string,
  ): void {
    this.meaningfulListenTracker.startTracking({
      totalDurationMs,
      surahId,
      reciterId,
      rewayahId,
    });
  }
}

export const analyticsService = new AnalyticsServiceImpl();
