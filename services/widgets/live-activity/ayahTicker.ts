// services/widgets/live-activity/ayahTicker.ts
// Publishes the current ayah of the playing track (ayah mode only). Sleeps
// until the next ayah boundary instead of polling; restarts on every snapshot.
import type {AyahTimestamp} from '@/types/timestamps';
import type {NowPlayingAyah, WidgetSnapshot} from 'bayaan-widgets';
import type {TimingNumbering} from '@/utils/timestampNumbering';
import {
  BOUNDARY_SLACK_MS,
  currentAyahTimestamp,
  hafsActivityAyah,
  msUntilNextAyah,
  positionAt,
} from './ayahLayer';

export interface AyahTickerDeps {
  loadTimestamps: (
    rewayatId: string,
    surahId: number,
  ) => Promise<AyahTimestamp[] | null>;
  /** The surah's timing numbering (entry numbers to Hafs ayahs). */
  resolveNumbering: (
    rewayatId: string,
    surahId: number,
    timestamps: AyahTimestamp[],
  ) => Promise<TimingNumbering>;
  /** Hafs verse count of a surah (the "of N" in the ayah line). */
  hafsVerseCount: (surahId: number) => number;
  /** Hafs text of a Hafs verse key. */
  verseText: (verseKey: string) => string;
  setAyah: (ayah: NowPlayingAyah | null) => void;
  now: () => number;
}

export interface AyahTicker {
  onSnapshot: (snapshot: WidgetSnapshot) => void;
  stop: () => void;
}

export function createAyahTicker(deps: AyahTickerDeps): AyahTicker {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let snapshot: WidgetSnapshot | null = null;
  let trackKey: string | null = null;
  let timestamps: AyahTimestamp[] | null = null;
  let numbering: TimingNumbering | null = null;
  let lastNumber: number | null = null;
  let stopped = false;

  function clear(): void {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function publish(next: NowPlayingAyah | null): void {
    const number = next ? next.number : null;
    if (number === lastNumber) return;
    lastNumber = number;
    deps.setAyah(next);
  }

  function tick(): void {
    clear();
    const np = snapshot?.nowPlaying;
    if (
      stopped ||
      !snapshot ||
      !np ||
      !timestamps ||
      timestamps.length === 0 ||
      !numbering
    ) {
      return;
    }
    // No verse-level timing: stay on the surah-level activity.
    if (numbering.mode === 'disabled') {
      publish(null);
      return;
    }
    const position = positionAt(np, snapshot.generatedAt, deps.now());
    const current = currentAyahTimestamp(timestamps, position);
    publish(
      current
        ? hafsActivityAyah(
            numbering,
            current,
            deps.hafsVerseCount(numbering.surah),
            deps.verseText,
          )
        : null,
    );
    if (!np.isPlaying) return;
    const wait = msUntilNextAyah(timestamps, position, np.rate);
    if (wait === null) return;
    timer = setTimeout(tick, wait + BOUNDARY_SLACK_MS);
  }

  function onSnapshot(next: WidgetSnapshot): void {
    if (stopped) return;
    snapshot = next;
    const track = next.nowPlaying?.track;
    const rewayatId =
      track && !track.isUserUpload && track.surahId > 0
        ? track.rewayatId
        : null;
    const key = track && rewayatId ? `${rewayatId}-${track.surahId}` : null;
    if (key === trackKey) {
      tick();
      return;
    }
    trackKey = key;
    timestamps = null;
    numbering = null;
    clear();
    publish(null);
    if (!key || !track || !rewayatId) return;
    const surahId = track.surahId;
    deps
      .loadTimestamps(rewayatId, surahId)
      .then(async list => {
        if (!list || list.length === 0) return;
        const resolved = await deps.resolveNumbering(rewayatId, surahId, list);
        if (stopped || trackKey !== key) return;
        timestamps = list;
        numbering = resolved;
        tick();
      })
      .catch((error: unknown) => {
        // Fall back to the surah-level activity (no ayah line).
        console.warn('[LiveActivity] Failed to load ayah timestamps:', error);
      });
  }

  return {
    onSnapshot,
    stop: () => {
      stopped = true;
      clear();
    },
  };
}
