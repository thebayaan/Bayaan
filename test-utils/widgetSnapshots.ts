// test-utils/widgetSnapshots.ts
// Snapshot builders for Live Activity tests.
import type {
  WidgetNowPlaying,
  WidgetSnapshot,
  WidgetTrack,
} from 'bayaan-widgets';

export const KAHF_TRACK: WidgetTrack = {
  surahId: 18,
  surahName: 'Al-Kahf',
  reciterId: 'r1',
  reciterName: 'Mishary Alafasy',
  rewayatId: 'rw-1',
  artworkFile: 'surah-18.jpg',
  isUserUpload: false,
};

export const YASIN_TRACK: WidgetTrack = {
  ...KAHF_TRACK,
  surahId: 36,
  surahName: 'Ya-Sin',
  artworkFile: 'surah-36.jpg',
};

export const MULK_TRACK: WidgetTrack = {
  ...KAHF_TRACK,
  surahId: 67,
  surahName: 'Al-Mulk',
  artworkFile: 'surah-67.jpg',
};

/** Only nowPlaying is filled. Defaults: Al-Kahf playing at 100 of 1800 s, rate 1. */
export function nowPlayingSnapshot(
  np: Partial<WidgetNowPlaying> | null,
  generatedAt = 1_000_000,
): WidgetSnapshot {
  return {
    version: 1,
    generatedAt,
    theme: 'dark',
    nowPlaying:
      np === null
        ? null
        : {
            track: KAHF_TRACK,
            isPlaying: true,
            positionSec: 100,
            durationSec: 1800,
            rate: 1,
            ...np,
          },
    upNext: [],
    recent: [],
    defaultReciter: null,
    reciterRecents: {},
    lastRead: null,
    tasbeeh: {},
  };
}
