// @ai-generated
/**
 * The mushaf player's follow-along band, as the page renderers (SkiaPage,
 * ContinuousMushafView) read it: what the current timing entry recites, in
 * Hafs keys and in the timing set's own numbering, so that
 * playbackBandUnitKeys (verseHighlightLayers.ts) can light exactly the shown
 * rewayah's verse units (verse-units contract 4.2).
 *
 * Read from the player store's existing state. When the player store
 * exposes the band as unit keys of the shown rewayah itself (the audio
 * area's usePlaybackUnitKeys), the renderers can read that instead: both
 * follow the same contract rule.
 */
import {useMemo} from 'react';
import {
  useMushafPlayerStore,
  type MushafPlayerStoreState,
} from '@/store/mushafPlayerStore';
import {parseVerseKeyListId, verseKeyListId} from '@/utils/timestampNumbering';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {NO_PLAYBACK_BAND, type PlaybackBand} from './verseHighlightLayers';

const FIELD_SEPARATOR = '\n';

type BandState = Pick<
  MushafPlayerStoreState,
  | 'playbackState'
  | 'currentVerseKey'
  | 'currentVerseKeys'
  | 'currentReciterVerseKey'
  | 'numberingMode'
  | '_numbering'
>;

/**
 * Value-comparable id of the band ('' when idle or nothing is tracked). The
 * Hafs keys are exactly what usePlaybackVerseKeys() returns.
 */
export function selectPlaybackBandId(s: BandState): string {
  if (s.playbackState === 'idle') return '';
  const hafsKeys =
    s.currentVerseKeys.length > 0
      ? s.currentVerseKeys
      : s.currentVerseKey
        ? [s.currentVerseKey]
        : [];
  if (hafsKeys.length === 0) return '';
  return [
    verseKeyListId(hafsKeys),
    s.numberingMode ?? '',
    s._numbering?.reciterRewayah ?? '',
    s.currentReciterVerseKey ?? '',
  ].join(FIELD_SEPARATOR);
}

/** Inverse of selectPlaybackBandId. */
export function parsePlaybackBandId(id: string): PlaybackBand {
  if (!id) return NO_PLAYBACK_BAND;
  const [keys, mode, reciterRewayah, entryKey] = id.split(FIELD_SEPARATOR);
  return {
    hafsKeys: parseVerseKeyListId(keys),
    mode: (mode || null) as PlaybackBand['mode'],
    reciterRewayah: (reciterRewayah || null) as RewayahId | null,
    entryKey: entryKey || null,
  };
}

/** The band; re-renders only when it changes. */
export function usePlaybackBand(): PlaybackBand {
  const id = useMushafPlayerStore(selectPlaybackBandId);
  return useMemo(() => parsePlaybackBandId(id), [id]);
}
