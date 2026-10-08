import {useEffect, useMemo, useRef, useState} from 'react';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useTimestampStore} from '@/store/timestampStore';
import type {AyahTrackingState} from '@/types/timestamps'; // @ai
import {useReciterStore} from '@/store/reciterStore';
import {expoAudioService} from '@/services/audio/ExpoAudioService';
import {timingNumberingService} from '@/services/timestamps/TimingNumberingService';
import {binarySearchAyah} from '@/utils/timestampUtils';
import {
  registerTimingNumbering,
  type MappedAyahTrackingState,
  type TimingNumbering,
} from '@/utils/timestampNumbering';

// @ai-start
/** Tracker interval: the audio position is read every 200 ms. */
const TICK_MS = 200;

/**
 * Ticks a verse published by someone else ("Play from here") is kept while
 * the audio position has not reached it, the native seek being in flight.
 * Past that, the verse actually being recited is published again.
 */
export const SEEK_GRACE_TICKS = 10;
// @ai-end

/**
 * Main-player follow-along: publishes the verse being recited to
 * useTimestampStore.currentAyah.
 *
 * Timing entries are translated to Hafs verse keys through the surah's
 * TimingNumbering (a Warsh recitation's entry 2:4 is Hafs 2:5; its entry 2:1
 * recites Hafs 2:1 and 2:2). `verseKey` is the first Hafs verse recited,
 * `verseKeys` all of them. Nothing is published while the numbering is being
 * resolved or when it cannot be established for the surah: no highlight is
 * better than a wrong one. The resolved numbering is also registered for the
 * timestamps array so findAyahTimestamp ("Play from here") seeks in the same
 * numbering.
 *
 * The recitation's rewayah comes from the catalog rewayat name through the
 * canonical resolver (resolveRewayahFromName, the resolver behind
 * useCurrentTrackRewayah), without that hook's display fallback to Hafs: for
 * verse numbering an unresolvable rewayah is unknown, never Hafs. Until the
 * catalog has loaded, an unknown rewayat id counts as "not known yet".
 *
 * A verse written to the store by someone else ("Play from here" publishes
 * the tapped verse) is replaced by the state of the timing entry being
 * recited, so the highlight always covers every Hafs verse the reciter is
 * reciting. While the seek that came with it has not landed yet (the audio
 * position still names the verse being left) it is kept, for up to
 * SEEK_GRACE_TICKS ticks, instead of flashing back to that verse.
 */
export function useAyahTracker() {
  const playbackState = usePlayerStore(s => s.playback.state);
  const rewayatId = usePlayerStore(
    s => s.queue.tracks[s.queue.currentIndex]?.rewayatId,
  );
  const surahId = usePlayerStore(
    s => s.queue.tracks[s.queue.currentIndex]?.surahId,
  );
  const timestamps = useTimestampStore(s => s.currentSurahTimestamps);
  const timestampKey = useTimestampStore(s => s.currentTimestampKey);
  const followAlongEnabled = useTimestampStore(s => s.followAlongEnabled);
  const catalogReady = useReciterStore(s => s.isInitialized);
  const reciterRewayah = useMemo(
    () =>
      rewayatId
        ? timingNumberingService.resolveReciterRewayah(rewayatId)
        : null,
    // catalogReady: the catalog array is filled in place, re-resolve then
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rewayatId, catalogReady],
  );
  const rewayahKnown = reciterRewayah !== null || catalogReady;
  const [numbering, setNumbering] = useState<TimingNumbering | null>(null);
  const lastAyahRef = useRef<number | null>(null);
  // The state this tracker last wrote (null after clearing it). @ai
  const lastPublishedRef = useRef<AyahTrackingState | null>(null);
  // @ai-start
  // A state written by someone else whose seek has not landed yet, and the
  // ticks it has been kept for.
  const foreignRef = useRef<{state: AyahTrackingState; ticks: number} | null>(
    null,
  );
  // @ai-end

  const surahNumber = surahId ? parseInt(surahId, 10) : NaN;
  const timestampsMatchTrack =
    !!timestamps &&
    !!rewayatId &&
    !isNaN(surahNumber) &&
    timestampKey === `${rewayatId}-${surahNumber}`;

  useEffect(() => {
    if (!timestampsMatchTrack || !timestamps || !rewayatId) {
      setNumbering(null);
      return;
    }
    if (!rewayahKnown) {
      registerTimingNumbering(timestamps, 'pending');
      setNumbering(null);
      return;
    }
    const sync = timingNumberingService.resolveSync(
      rewayatId,
      surahNumber,
      timestamps,
      reciterRewayah,
    );
    if (sync) {
      registerTimingNumbering(timestamps, sync);
      setNumbering(sync);
      return;
    }
    let cancelled = false;
    registerTimingNumbering(timestamps, 'pending');
    setNumbering(null);
    timingNumberingService
      .resolve(rewayatId, surahNumber, timestamps, reciterRewayah)
      .then(resolved => {
        if (cancelled) return;
        registerTimingNumbering(timestamps, resolved);
        setNumbering(resolved);
      });
    return () => {
      cancelled = true;
    };
  }, [
    timestampsMatchTrack,
    timestamps,
    rewayatId,
    surahNumber,
    reciterRewayah,
    rewayahKnown,
  ]);

  // A surah without a usable numbering must not keep a highlight (e.g. one
  // set by "Play from here"). New timestamps already clear currentAyah in
  // the timestamp store, so nothing else needs clearing here.
  useEffect(() => {
    lastAyahRef.current = null;
    if (
      numbering?.mode === 'disabled' &&
      useTimestampStore.getState().currentAyah
    ) {
      useTimestampStore.getState().clearCurrentAyah();
    }
    // @ai-start
    // Let the player say when this surah cannot be followed
    // (selectVerseTrackingUnavailable).
    useTimestampStore
      .getState()
      .setTrackingNumberingMode(numbering ? numbering.mode : null);
    // @ai-end
  }, [numbering]);

  useEffect(() => {
    if (
      playbackState !== 'playing' ||
      !timestamps ||
      !numbering ||
      numbering.mode === 'disabled' ||
      !followAlongEnabled
    ) {
      return;
    }

    const interval = setInterval(() => {
      const current = useTimestampStore.getState().currentSurahTimestamps;
      if (current !== timestamps) return;

      const positionSec = expoAudioService.getCurrentTime(); // seconds (sync)
      const positionMs = positionSec * 1000;

      const entry = binarySearchAyah(timestamps, positionMs);
      // @ai-start
      // Someone else wrote the current verse ("Play from here" publishes the
      // verse it seeks to): once the audio is there, publish the full state
      // of the entry. Until then the position still names the verse being
      // left; keep the written verse rather than flash back to it.
      const written = useTimestampStore.getState().currentAyah;
      if (written !== lastPublishedRef.current) {
        const seekLanded =
          !written ||
          (entry !== null && entry.timestampFrom === written.timestampFrom);
        if (!seekLanded) {
          const ticks =
            foreignRef.current?.state === written
              ? foreignRef.current.ticks + 1
              : 1;
          if (ticks <= SEEK_GRACE_TICKS) {
            foreignRef.current = {state: written, ticks};
            return;
          }
        }
        foreignRef.current = null;
        lastAyahRef.current = null;
      }
      // @ai-end
      const keys = entry ? numbering.hafsKeysForEntry(entry.ayahNumber) : [];

      if (!entry || keys.length === 0) {
        if (lastAyahRef.current !== null) {
          lastAyahRef.current = null;
          lastPublishedRef.current = null; // @ai
          useTimestampStore.getState().clearCurrentAyah();
        }
        return;
      }

      if (entry.ayahNumber !== lastAyahRef.current) {
        lastAyahRef.current = entry.ayahNumber;
        const primary = keys[0];
        const tracked: MappedAyahTrackingState = {
          surahNumber: entry.surahNumber,
          ayahNumber: parseInt(primary.split(':')[1], 10),
          verseKey: primary,
          timestampFrom: entry.timestampFrom,
          timestampTo: entry.timestampTo,
          verseKeys: keys,
          reciterVerseKey: `${entry.surahNumber}:${entry.ayahNumber}`,
        };
        lastPublishedRef.current = tracked; // @ai
        useTimestampStore.getState().setCurrentAyah(tracked);
      }
    }, TICK_MS); // @ai

    return () => {
      clearInterval(interval);
      lastAyahRef.current = null;
      foreignRef.current = null; // @ai
    };
  }, [playbackState, timestamps, numbering, followAlongEnabled]);
}
