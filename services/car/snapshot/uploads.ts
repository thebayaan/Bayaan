import type {Reciter} from '@/data/reciterData';
import type {Surah} from '@/data/surahData';
import type {CarItem} from '@/services/car/types';
import type {RecentlyPlayedTrack} from '@/services/player/store/recentlyPlayedStore';
import type {CustomReciter, UploadedRecitation} from '@/types/uploads';

/**
 * Uploads the car lists and queues, in the phone's Uploads order (store
 * order, newest first). The snapshot list and the resolver both use this, so
 * a row's startIndex points at the same upload.
 */
export function playableUploads(
  uploads: UploadedRecitation[],
): UploadedRecitation[] {
  return uploads.filter(u => u.filePath.length > 0);
}

/**
 * A recent entry the car shows in Jump back in: catalog entries, and uploads
 * whose recitation still exists. Resume uses the same rule, so its first
 * match is Jump back in's first row.
 */
export function isCarRecent(
  track: RecentlyPlayedTrack,
  uploadIds: ReadonlySet<string>,
): boolean {
  if (!track.isUserUpload) return true;
  return (
    track.userRecitationId !== undefined &&
    uploadIds.has(track.userRecitationId)
  );
}

export function uploadIdSet(
  uploads: UploadedRecitation[],
): ReadonlySet<string> {
  return new Set(playableUploads(uploads).map(u => u.id));
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '');
}

/** The surah a recitation is tagged with, if any. */
export function uploadSurah(
  upload: UploadedRecitation,
  surahs: Surah[],
): Surah | undefined {
  if (upload.type !== 'surah' || !upload.surahNumber) return undefined;
  return surahs.find(s => s.id === upload.surahNumber);
}

/** Mirrors getDisplayTitle on the phone's Uploads screen. */
export function uploadTitle(
  upload: UploadedRecitation,
  surahs: Surah[],
): string {
  const surah = uploadSurah(upload, surahs);
  if (surah) return surah.name;
  if (upload.type === 'other' && upload.title) return upload.title;
  return stripExtension(upload.originalFilename);
}

/** Mirrors getDisplaySubtitle on the phone's Uploads screen. */
export function uploadSubtitle(
  upload: UploadedRecitation,
  reciters: Reciter[],
  customReciters: CustomReciter[],
): string {
  const parts: string[] = [];
  if (upload.reciterId) {
    const name = reciters.find(r => r.id === upload.reciterId)?.name;
    if (name) parts.push(name);
  } else if (upload.customReciterId) {
    const name = customReciters.find(
      r => r.id === upload.customReciterId,
    )?.name;
    if (name) parts.push(name);
  }
  if (upload.type === null) parts.push('Untagged');
  return parts.length > 0
    ? parts.join(' · ')
    : stripExtension(upload.originalFilename);
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** "Mar 18, 2025" in the device's time zone. */
export function formatUploadDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Rows whose title and subtitle match another row (two uploads tagged with
 * the same surah and reciter) get the upload date appended to the subtitle so
 * the driver can tell them apart. `items[i]` must be built from `uploads[i]`.
 */
export function withDuplicateUploadDates(
  items: CarItem[],
  uploads: UploadedRecitation[],
): CarItem[] {
  const counts = new Map<string, number>();
  const keys = items.map(item => `${item.title}\u0000${item.subtitle ?? ''}`);
  keys.forEach(key => counts.set(key, (counts.get(key) ?? 0) + 1));
  return items.map((item, index) => {
    const upload = uploads[index];
    if (!upload || (counts.get(keys[index]) ?? 0) < 2) return item;
    const date = formatUploadDate(upload.dateAdded);
    return {
      ...item,
      subtitle: item.subtitle ? `${item.subtitle} · ${date}` : date,
    };
  });
}
