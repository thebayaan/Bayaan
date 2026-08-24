import type {QfMutationType, QfSyncResource} from '@/types/qf-sync';
import surahData from '@/data/surahData.json';

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

interface ReadingSessionPayload extends BookmarkPayload {}

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

interface ParsedVerseKey {
  raw: string;
  surahNumber: number;
  ayahNumber: number;
}

const SURAH_VERSE_COUNTS = new Map<number, number>(
  surahData.map(surah => [surah.id, surah.verses_count]),
);

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
    throw new Error(`Invalid verse key: ${verseKey}`);
  }

  return {
    raw: verseKey,
    surahNumber: Number(match[1]),
    ayahNumber: Number(match[2]),
  };
}

function compareVerseKeys(left: ParsedVerseKey, right: ParsedVerseKey): number {
  if (left.surahNumber !== right.surahNumber) {
    return left.surahNumber - right.surahNumber;
  }

  return left.ayahNumber - right.ayahNumber;
}

function areContiguous(previous: ParsedVerseKey, next: ParsedVerseKey): boolean {
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
    throw new Error('At least one verse key is required');
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
    type: entry.mutationType,
    data: {
      key: payload.surahNumber,
      type: 'ayah',
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

  const payload = parsePayload<NotePayload>(entry);
  const mutation: QfSyncRequestMutation = {
    resource: 'NOTE',
    type: entry.mutationType,
    data: {
      body: payload.content,
      ranges: buildVerseRanges(payload.verseKeys?.length ? payload.verseKeys : [`${payload.surahNumber}:${payload.ayahNumber}`]),
      saveToQR: false,
      clientCreatedAt: toIsoString(payload.clientCreatedAt),
      clientUpdatedAt: toIsoString(payload.clientUpdatedAt),
    },
  };

  if (entry.mutationType === 'UPDATE') {
    mutation.resourceId = requireRemoteId(entry);
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
