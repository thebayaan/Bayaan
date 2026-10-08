import {reciterImages} from '../../utils/reciterImages';

/**
 * Artwork source for a reciter, in the shape expo-image's `source` accepts:
 * a remote URI when the catalog has one, otherwise the bundled asset the
 * mobile app ships (`assets/reciter-images`), otherwise null.
 */
export type ArtworkSource = number | {uri: string};

type ArtworkReciter = {name: string; image_url: string | null};

function formatReciterName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-');
}

export function getReciterArtwork(
  reciter: ArtworkReciter | null | undefined,
): ArtworkSource | null {
  if (!reciter) return null;
  if (reciter.image_url) {
    return {uri: reciter.image_url.replace(/^http:\/\//, 'https://')};
  }
  const local = reciterImages[formatReciterName(reciter.name)];
  return typeof local === 'number' ? local : null;
}
