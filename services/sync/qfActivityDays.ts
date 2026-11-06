import surahData from '@/data/surahData.json';

/**
 * What a sealed batch sends besides its seconds and ranges, fixed when it is
 * sealed so every retry under the same idempotency key sends the same body.
 * `date` is present only for reading from an earlier day: QF counts dated
 * seconds as manually added time, so today's reading goes undated.
 */
export interface QfSealedSend {
  date?: string;
}

/**
 * One batch of Quran reading for QF activity days. A batch is sent with its
 * own idempotency key; once a send was attempted it is sealed, so reading
 * after that starts a new batch instead of changing what a retry resends.
 */
export interface QfActivityBatch {
  id: string;
  /** The calendar date the reading happened on, YYYY-MM-DD. */
  date: string;
  timezone: string;
  seconds: number;
  ranges: string[];
  sealed: false | QfSealedSend;
  /** Sends that failed in a way worth retrying. */
  attempts: number;
}

/** The backend accepts a week; stay a day inside it for timezones ahead. */
export const MAX_ACTIVITY_AGE_DAYS = 6;
export const MAX_BATCH_SECONDS = 86_400;
export const MAX_BATCH_RANGES = 300;

const DAY_MS = 86_400_000;
const VERSE_COUNTS = new Map<number, number>(
  surahData.map(surah => [surah.id, surah.verses_count]),
);

function parseVerseKey(verseKey: string): [number, number] | undefined {
  const match = /^(\d+):(\d+)$/.exec(verseKey);
  if (!match) return undefined;
  const surah = Number(match[1]);
  const ayah = Number(match[2]);
  const count = VERSE_COUNTS.get(surah);
  if (!count || ayah < 1 || ayah > count) return undefined;
  return [surah, ayah];
}

/** Every verse key in `s:a-s:a` ranges this module wrote. */
export function expandRanges(ranges: readonly string[]): string[] {
  const keys: string[] = [];
  for (const range of ranges) {
    const match = /^(\d+):(\d+)-(\d+):(\d+)$/.exec(range);
    if (!match || match[1] !== match[3]) continue;
    for (let ayah = Number(match[2]); ayah <= Number(match[4]); ayah++) {
      keys.push(`${match[1]}:${ayah}`);
    }
  }
  return keys;
}

/**
 * Merges verse keys into sorted inclusive ranges, one surah per range, so
 * each range is valid however QF reads a range across surahs.
 */
export function mergeVerseKeys(verseKeys: Iterable<string>): string[] {
  const verses = new Map<string, [number, number]>();
  for (const key of verseKeys) {
    const parsed = parseVerseKey(key);
    if (parsed) verses.set(`${parsed[0]}:${parsed[1]}`, parsed);
  }
  const sorted = [...verses.values()].sort(
    ([surahA, ayahA], [surahB, ayahB]) => surahA - surahB || ayahA - ayahB,
  );
  const ranges: string[] = [];
  let start: [number, number] | undefined;
  let end: [number, number] | undefined;
  for (const verse of sorted) {
    if (start && end && verse[0] === end[0] && verse[1] === end[1] + 1) {
      end = verse;
      continue;
    }
    if (start && end)
      ranges.push(`${start[0]}:${start[1]}-${end[0]}:${end[1]}`);
    start = verse;
    end = verse;
  }
  if (start && end) ranges.push(`${start[0]}:${start[1]}-${end[0]}:${end[1]}`);
  return ranges;
}

export function localDateOf(time: number): string {
  const date = new Date(time);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The calendar date at `time` in `timezone`, YYYY-MM-DD. */
export function dateInTimezone(time: number, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(time);
    const part = (type: string) =>
      parts.find(candidate => candidate.type === type)?.value;
    const date = `${part('year')}-${part('month')}-${part('day')}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : localDateOf(time);
  } catch {
    return localDateOf(time);
  }
}

/** Seals a batch, fixing the date it sends: none if it is still today. */
export function sealBatch(
  batch: QfActivityBatch,
  now: number,
): QfActivityBatch & {sealed: QfSealedSend} {
  if (batch.sealed) return {...batch, sealed: batch.sealed};
  const today = dateInTimezone(now, batch.timezone);
  return {...batch, sealed: batch.date === today ? {} : {date: batch.date}};
}

export function isExpiredBatch(batch: QfActivityBatch, now: number): boolean {
  const today = Date.parse(`${localDateOf(now)}T00:00:00Z`);
  return (
    Date.parse(`${batch.date}T00:00:00Z`) <
    today - MAX_ACTIVITY_AGE_DAYS * DAY_MS
  );
}

/**
 * Adds reading to the open batch for its date and timezone, or starts a new
 * one when there is none, it was already sent, or it is full.
 */
export function addReading(
  batches: readonly QfActivityBatch[],
  reading: {
    date: string;
    timezone: string;
    seconds: number;
    verseKeys: readonly string[];
    newId: () => string;
  },
): QfActivityBatch[] {
  const last = batches[batches.length - 1];
  if (
    last &&
    !last.sealed &&
    last.date === reading.date &&
    last.timezone === reading.timezone
  ) {
    const ranges = mergeVerseKeys([
      ...expandRanges(last.ranges),
      ...reading.verseKeys,
    ]);
    if (ranges.length <= MAX_BATCH_RANGES) {
      return [
        ...batches.slice(0, -1),
        {
          ...last,
          seconds: Math.min(MAX_BATCH_SECONDS, last.seconds + reading.seconds),
          ranges,
        },
      ];
    }
  }
  const ranges = mergeVerseKeys(reading.verseKeys);
  if (ranges.length === 0) return [...batches];
  return [
    ...batches,
    {
      id: reading.newId(),
      date: reading.date,
      timezone: reading.timezone,
      seconds: Math.min(MAX_BATCH_SECONDS, reading.seconds),
      ranges: ranges.slice(0, MAX_BATCH_RANGES),
      sealed: false,
      attempts: 0,
    },
  ];
}

function isSealedSend(value: unknown): value is QfSealedSend {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const send: Partial<Record<keyof QfSealedSend, unknown>> = value;
  return send.date === undefined || typeof send.date === 'string';
}

function isActivityBatch(value: unknown): value is QfActivityBatch {
  if (!value || typeof value !== 'object') return false;
  const batch: Partial<Record<keyof QfActivityBatch, unknown>> = value;
  return (
    typeof batch.id === 'string' &&
    typeof batch.date === 'string' &&
    typeof batch.timezone === 'string' &&
    typeof batch.seconds === 'number' &&
    Array.isArray(batch.ranges) &&
    batch.ranges.every(range => typeof range === 'string') &&
    typeof batch.attempts === 'number' &&
    (batch.sealed === false || isSealedSend(batch.sealed))
  );
}

export function parseBatches(raw: string | undefined): QfActivityBatch[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isActivityBatch) : [];
  } catch {
    return [];
  }
}
