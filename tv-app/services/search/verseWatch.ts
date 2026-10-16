/**
 * "Play verse" from search: once playback passes the end of the verse, pause.
 * The watch ends by itself when the listener moves to another surah or seeks
 * away, so it never pauses something they chose afterwards.
 */
import {useTVPlayerStore} from '../../store/tvPlayerStore';
import type {VerseSpan} from '../verseTimeline';
import {verseEndCheck} from './playback';

/** Positions just after the seek can still be the old ones; ignore them. */
const SETTLE_MS = 1500;

let stop: (() => void) | null = null;

export function stopVerseWatch(): void {
  stop?.();
  stop = null;
}

export function watchVerseEnd(
  span: VerseSpan,
  track: {reciterId: string; surahNumber: number},
): void {
  stopVerseWatch();
  const startedAt = Date.now();
  const unsubscribe = useTVPlayerStore.subscribe(state => {
    if (Date.now() - startedAt < SETTLE_MS) return;
    const item = state.queue[state.currentIndex];
    const sameTrack =
      item?.reciterId === track.reciterId &&
      item?.surahNumber === track.surahNumber;
    const check = verseEndCheck(span, state.positionSeconds * 1000, sameTrack);
    if (check === 'playing') return;
    if (check === 'end') state.engine?.pause();
    stopVerseWatch();
  });
  stop = unsubscribe;
}
