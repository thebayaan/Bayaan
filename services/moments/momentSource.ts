// @ai-start
import type {MomentClip} from './buildMoment';
import type {MomentSource} from './MomentsAudioService';

export interface MomentSourceInput {
  key: string;
  /** The reciter's surah file. */
  url: string;
  /** The moment, in surah positions. */
  clip: MomentClip;
}

/** Seek into the surah file and stop at the end of the last ayah. */
export function surahSource(card: MomentSourceInput): MomentSource {
  return {
    key: card.key,
    url: card.url,
    startMs: card.clip.startMs,
    endMs: card.clip.endMs,
  };
}

/**
 * What to play for a card. With a downloaded clip, the clip file from 0 to its
 * length, offset so positions stay surah positions (the card's captions and
 * the ayah tracking use them), falling back to the surah file if the clip
 * does not load. Without one, the surah file.
 */
export function momentSourceFor(
  card: MomentSourceInput,
  localClipUri: string | null,
): MomentSource {
  const surah = surahSource(card);
  if (!localClipUri) return surah;
  return {
    key: card.key,
    url: localClipUri,
    startMs: 0,
    endMs: card.clip.endMs - card.clip.startMs,
    offsetMs: card.clip.startMs,
    fallback: surah,
  };
}
// @ai-end
