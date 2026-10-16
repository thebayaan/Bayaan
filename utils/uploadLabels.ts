// @ai-generated
/**
 * Display labels for user uploads.
 *
 * An upload that is not tagged with a reciter is stored with the artist
 * UNTAGGED_UPLOAD_ARTIST. That value is data (the queue compares against it,
 * recently played keeps it), so it stays canonical English and is translated
 * only where it is shown.
 */
import i18n from '@/i18n';
import {getTrackArtistDisplay} from '@/i18n/format';

/** Stored artist of an upload with no reciter tag. Never shown as is. */
export const UNTAGGED_UPLOAD_ARTIST = 'My Recitations';

/** The artist to show for a stored upload artist. */
export function getUploadArtistDisplay(artist: string): string {
  return artist === UNTAGGED_UPLOAD_ARTIST
    ? i18n.t('home:home.myRecitations')
    : artist;
}

/** getTrackArtistDisplay, with the untagged-upload artist translated. */
export function getTrackArtistLabel(
  track: Parameters<typeof getTrackArtistDisplay>[0],
): string {
  const artist = getTrackArtistDisplay(track);
  return track.isUserUpload ? getUploadArtistDisplay(artist) : artist;
}

/** Label for an upload's category (`dua`, `lecture`, …). */
export function getUploadCategoryLabel(category: string): string {
  const fallback = category.charAt(0).toUpperCase() + category.slice(1);
  return i18n.t(`sheets:uploads.categories.${category}`, {
    defaultValue: fallback,
  });
}
