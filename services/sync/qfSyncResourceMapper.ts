import type {QfMutationType, QfSyncResource} from '@/types/qf-sync';
import surahData from '@/data/surahData.json';
import {
  MAX_SYNC_NOTE_BODY_LENGTH,
  decodeBayaanSyncRequestMutation,
  BayaanSyncDecodeError,
} from './bayaanSyncCodec';

export class LocalUnsupportedNoteError extends Error {
  constructor(readonly reason: 'note_body_too_large' | 'invalid_note_shape') {
    super(reason);
    this.name = 'LocalUnsupportedNoteError';
  }
}

interface BookmarkPayload {
  surahNumber: number;
  ayahNumber: number;
  clientCreatedAt: number;
  clientUpdatedAt: number;
}

interface NotePayload extends BookmarkPayload {
  content: string;
  verseKeys?: string[];
}

type ReadingSessionPayload = BookmarkPayload;

export interface QfSyncRequestMutation {
  resource: QfSyncResource;
  type: QfMutationType;
  resourceId?: string;
  data: Record<string, unknown>;
}

export interface QfOutboxEntryLike {
  resource: QfSyncResource;
  mutationType: QfMutationType;
  remoteId: string | null;
  payloadJson: string;
}

class InvalidLocalVerseRangeError extends Error {}

interface ParsedVerseKey {
  raw: string;
  surahNumber: number;
  ayahNumber: number;
}

const SURAH_VERSE_COUNTS = new Map<number, number>(
  surahData.map(surah => [surah.id, surah.verses_count]),
);
const QF_AYAH_BOOKMARK_MUSHAF = 4;

function toIsoString(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function requireRemoteId(entry: QfOutboxEntryLike): string {
  if (!entry.remoteId) {
    throw new Error(
      `${entry.resource} ${entry.mutationType} requires a remote id before syncing`,
    );
  }

  return entry.remoteId;
}

function parsePayload<T>(entry: QfOutboxEntryLike): T {
  return JSON.parse(entry.payloadJson) as T;
}

function parseVerseKey(verseKey: string): ParsedVerseKey {
  const match = /^(\d+):(\d+)$/.exec(verseKey);
  if (!match) {
    throw new InvalidLocalVerseRangeError(`Invalid verse key: ${verseKey}`);
  }

  const surahNumber = Number(match[1]);
  const ayahNumber = Number(match[2]);
  const verseCount = SURAH_VERSE_COUNTS.get(surahNumber);
  if (!verseCount || ayahNumber < 1 || ayahNumber > verseCount) {
    throw new InvalidLocalVerseRangeError(`Invalid verse key: ${verseKey}`);
  }

  return {
    raw: `${surahNumber}:${ayahNumber}`,
    surahNumber,
    ayahNumber,
  };
}

function compareVerseKeys(left: ParsedVerseKey, right: ParsedVerseKey): number {
  if (left.surahNumber !== right.surahNumber) {
    return left.surahNumber - right.surahNumber;
  }

  return left.ayahNumber - right.ayahNumber;
}

function areContiguous(
  previous: ParsedVerseKey,
  next: ParsedVerseKey,
): boolean {
  if (previous.surahNumber === next.surahNumber) {
    return next.ayahNumber === previous.ayahNumber + 1;
  }

  return (
    next.surahNumber === previous.surahNumber + 1 &&
    next.ayahNumber === 1 &&
    previous.ayahNumber === SURAH_VERSE_COUNTS.get(previous.surahNumber)
  );
}

export function buildVerseRanges(verseKeys: string[]): string[] {
  const uniqueSorted = [...new Set(verseKeys)]
    .map(parseVerseKey)
    .sort(compareVerseKeys);

  if (uniqueSorted.length === 0) {
    throw new InvalidLocalVerseRangeError('At least one verse key is required');
  }

  const ranges: string[] = [];
  let rangeStart = uniqueSorted[0];
  let previous = uniqueSorted[0];

  for (const current of uniqueSorted.slice(1)) {
    if (areContiguous(previous, current)) {
      previous = current;
      continue;
    }

    ranges.push(`${rangeStart.raw}-${previous.raw}`);
    rangeStart = current;
    previous = current;
  }

  ranges.push(`${rangeStart.raw}-${previous.raw}`);
  return ranges;
}

function mapBookmark(entry: QfOutboxEntryLike): QfSyncRequestMutation {
  if (entry.mutationType === 'UPDATE') {
    throw new Error('BOOKMARK UPDATE is not supported');
  }

  if (entry.mutationType === 'DELETE') {
    return {
      resource: 'BOOKMARK',
      type: 'DELETE',
      resourceId: requireRemoteId(entry),
      data: {},
    };
  }

  const payload = parsePayload<BookmarkPayload>(entry);
  return {
    resource: 'BOOKMARK',
    type: 'CREATE',
    data: {
      key: payload.surahNumber,
      type: 'ayah',
      mushaf: QF_AYAH_BOOKMARK_MUSHAF,
      verseNumber: payload.ayahNumber,
      clientCreatedAt: toIsoString(payload.clientCreatedAt),
      clientUpdatedAt: toIsoString(payload.clientUpdatedAt),
    },
  };
}

function mapNote(entry: QfOutboxEntryLike): QfSyncRequestMutation {
  if (entry.mutationType === 'DELETE') {
    return {
      resource: 'NOTE',
      type: 'DELETE',
      resourceId: requireRemoteId(entry),
      data: {},
    };
  }

  let payload: NotePayload;
  try {
    payload = parsePayload<NotePayload>(entry);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new LocalUnsupportedNoteError('invalid_note_shape');
  }
  if (!payload || typeof payload.content !== 'string') {
    throw new LocalUnsupportedNoteError('invalid_note_shape');
  }
  if (payload.content.length > MAX_SYNC_NOTE_BODY_LENGTH) {
    throw new LocalUnsupportedNoteError('note_body_too_large');
  }
  if (
    !Number.isSafeInteger(payload.clientCreatedAt) ||
    !Number.isSafeInteger(payload.clientUpdatedAt) ||
    payload.clientCreatedAt < 0 ||
    payload.clientUpdatedAt < 0 ||
    payload.clientCreatedAt > 8_640_000_000_000_000 ||
    payload.clientUpdatedAt > 8_640_000_000_000_000 ||
    (payload.verseKeys !== undefined &&
      (!Array.isArray(payload.verseKeys) ||
        payload.verseKeys.some(key => typeof key !== 'string')))
  ) {
    throw new LocalUnsupportedNoteError('invalid_note_shape');
  }
  let ranges: string[];
  try {
    ranges = buildVerseRanges(
      payload.verseKeys?.length
        ? payload.verseKeys
        : [`${payload.surahNumber}:${payload.ayahNumber}`],
    );
  } catch (error) {
    if (!(error instanceof InvalidLocalVerseRangeError)) throw error;
    throw new LocalUnsupportedNoteError('invalid_note_shape');
  }
  const mutation: QfSyncRequestMutation = {
    resource: 'NOTE',
    type: entry.mutationType,
    data: {
      body: payload.content,
      ranges,
      saveToQR: false,
      clientCreatedAt: toIsoString(payload.clientCreatedAt),
      clientUpdatedAt: toIsoString(payload.clientUpdatedAt),
    },
  };

  if (entry.mutationType === 'UPDATE') {
    if (!entry.remoteId)
      throw new LocalUnsupportedNoteError('invalid_note_shape');
    mutation.resourceId = requireRemoteId(entry);
  }
  try {
    decodeBayaanSyncRequestMutation(mutation);
  } catch (error) {
    if (!(error instanceof BayaanSyncDecodeError)) throw error;
    throw new LocalUnsupportedNoteError('invalid_note_shape');
  }
  return mutation;
}

function mapReadingSession(entry: QfOutboxEntryLike): QfSyncRequestMutation {
  const payload = parsePayload<ReadingSessionPayload>(entry);
  const data: Record<string, unknown> = {
    chapterNumber: payload.surahNumber,
    verseNumber: payload.ayahNumber,
    clientUpdatedAt: toIsoString(payload.clientUpdatedAt),
  };

  if (entry.mutationType === 'CREATE') {
    data.clientCreatedAt = toIsoString(payload.clientCreatedAt);
  }

  const mutation: QfSyncRequestMutation = {
    resource: 'READING_SESSION',
    type: entry.mutationType,
    data,
  };

  if (entry.mutationType === 'UPDATE') {
    mutation.resourceId = requireRemoteId(entry);
  }

  return mutation;
}

export function mapOutboxEntryToSyncMutation(
  entry: QfOutboxEntryLike,
): QfSyncRequestMutation {
  if (entry.resource === 'BOOKMARK') {
    return mapBookmark(entry);
  }

  if (entry.resource === 'NOTE') {
    return mapNote(entry);
  }

  if (entry.resource === 'READING_SESSION') {
    return mapReadingSession(entry);
  }

  throw new Error(`Unsupported sync resource: ${entry.resource}`);
}
