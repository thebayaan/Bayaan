import type {QfMutationType, QfSyncResource} from '@/types/qf-sync';

export interface BayaanSyncMutation {
  resource: QfSyncResource;
  type: QfMutationType;
  resourceId: string;
  timestamp: number;
  data?: Record<string, string | number | boolean | string[]>;
}

export interface BayaanSyncPullPage {
  lastMutationAt: number;
  mutations: BayaanSyncMutation[];
  page?: number;
  limit?: number;
  total?: number;
  hasMore?: boolean;
  // Provider cardinality before the supported mobile bookmark projection.
  receivedMutationCount?: number;
}

export interface BayaanSyncRequestMutation {
  resource: QfSyncResource;
  type: QfMutationType;
  resourceId?: string;
  data?: Record<string, string | number | boolean | string[]>;
}

export interface BayaanSyncPushResult {
  lastMutationAt: number;
  mutations: BayaanSyncMutation[];
}

export interface BayaanSyncPullDecodeRequest {
  metadataOnly?: boolean;
  limit?: number;
  page?: number;
}

export class BayaanSyncDecodeError extends Error {
  constructor() {
    super('Invalid Bayaan Sync response');
    this.name = 'BayaanSyncDecodeError';
  }
}

const RESOURCES = new Set<QfSyncResource>([
  'BOOKMARK',
  'NOTE',
  'READING_SESSION',
]);
const MUTATION_TYPES = new Set<QfMutationType>(['CREATE', 'UPDATE', 'DELETE']);
const ENVELOPE_KEYS = new Set(['success', 'data']);
const RESULT_KEYS = new Set([
  'lastMutationAt',
  'mutations',
  'page',
  'limit',
  'total',
  'hasMore',
]);
const MUTATION_KEYS = new Set([
  'resource',
  'type',
  'resourceId',
  'data',
  'timestamp',
]);
const REQUEST_MUTATION_KEYS = new Set([
  'resource',
  'type',
  'resourceId',
  'data',
]);
const DATA_KEYS: Record<QfSyncResource, ReadonlySet<string>> = {
  BOOKMARK: new Set([
    'type',
    'bookmarkType',
    'bookmarkGroup',
    'group',
    'key',
    'verseNumber',
    'isReading',
    'isInDefaultCollection',
    'mushafId',
    'mushaf',
    'clientCreatedAt',
    'clientUpdatedAt',
  ]),
  NOTE: new Set([
    'body',
    'ranges',
    'source',
    'saveToQR',
    'clientCreatedAt',
    'clientUpdatedAt',
  ]),
  READING_SESSION: new Set([
    'chapterNumber',
    'verseNumber',
    'clientCreatedAt',
    'clientUpdatedAt',
  ]),
};

function invalid(): never {
  throw new BayaanSyncDecodeError();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every(key => allowed.has(key));
}

function isSafeTimestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function isOptionalDate(value: unknown): value is string | undefined {
  return (
    value === undefined ||
    (typeof value === 'string' &&
      value.length > 0 &&
      value.length <= 64 &&
      Number.isFinite(Date.parse(value)))
  );
}

function decodeData(
  resource: QfSyncResource,
  value: unknown,
  projectBookmarks = false,
): Record<string, string | number | boolean | string[]> | null {
  if (!isObject(value) || !hasOnlyKeys(value, DATA_KEYS[resource])) {
    return invalid();
  }

  if (
    !isOptionalDate(value.clientCreatedAt) ||
    !isOptionalDate(value.clientUpdatedAt)
  ) {
    return invalid();
  }

  if (resource === 'BOOKMARK') {
    const bookmarkType = value.type ?? value.bookmarkType ?? 'ayah';
    if (
      !['ayah', 'page', 'juz', 'surah'].includes(String(bookmarkType)) ||
      (value.type !== undefined &&
        value.bookmarkType !== undefined &&
        value.type !== value.bookmarkType) ||
      !isPositiveSafeInteger(value.key)
    ) {
      return invalid();
    }
    const unsupported = bookmarkType !== 'ayah';
    if (
      unsupported
        ? !projectBookmarks ||
          (value.verseNumber !== undefined &&
            value.verseNumber !== null &&
            !isPositiveSafeInteger(value.verseNumber))
        : !isPositiveSafeInteger(value.verseNumber)
    ) {
      return invalid();
    }
    for (const key of ['mushafId', 'mushaf'] as const) {
      if (value[key] !== undefined && !isPositiveSafeInteger(value[key])) {
        return invalid();
      }
    }
    for (const key of ['isReading', 'isInDefaultCollection'] as const) {
      if (
        value[key] !== undefined &&
        !(projectBookmarks && key === 'isReading' && value[key] === null) &&
        typeof value[key] !== 'boolean'
      ) {
        return invalid();
      }
    }
    for (const key of [
      'type',
      'bookmarkType',
      'bookmarkGroup',
      'group',
    ] as const) {
      if (value[key] !== undefined && typeof value[key] !== 'string') {
        return invalid();
      }
    }
    // Non-ayah and explicitly collection-backed bookmarks are valid provider
    // reads, not standalone deletions. BOOKMARK DELETE cannot remove Favorites
    // membership, and this client has no COLLECTION_BOOKMARK mutation contract.
    // Validate fully, then omit only the unsupported pull effect. Never filter
    // push receipts or silently reinterpret the bookmark ID as a membership ID.
    if (
      unsupported ||
      (projectBookmarks && value.isInDefaultCollection === true)
    )
      return null;
  } else if (resource === 'NOTE') {
    if (
      typeof value.body !== 'string' ||
      value.body.length > 200_000 ||
      !Array.isArray(value.ranges) ||
      value.ranges.length === 0 ||
      value.ranges.length > 100 ||
      value.ranges.some(
        range =>
          typeof range !== 'string' || range.length === 0 || range.length > 64,
      ) ||
      value.saveToQR !== false ||
      (value.source !== undefined && typeof value.source !== 'string')
    ) {
      return invalid();
    }
  } else if (
    !isPositiveSafeInteger(value.chapterNumber) ||
    value.chapterNumber > 114 ||
    !isPositiveSafeInteger(value.verseNumber)
  ) {
    return invalid();
  }

  return value as Record<string, string | number | boolean | string[]>;
}

function decodeMutation(
  value: unknown,
  projectBookmarks = false,
): BayaanSyncMutation | null {
  if (!isObject(value) || !hasOnlyKeys(value, MUTATION_KEYS)) {
    return invalid();
  }
  if (
    typeof value.resource !== 'string' ||
    !RESOURCES.has(value.resource as QfSyncResource) ||
    typeof value.type !== 'string' ||
    !MUTATION_TYPES.has(value.type as QfMutationType) ||
    typeof value.resourceId !== 'string' ||
    value.resourceId.length === 0 ||
    value.resourceId.length > 256 ||
    !isSafeTimestamp(value.timestamp)
  ) {
    return invalid();
  }

  const resource = value.resource as QfSyncResource;
  const type = value.type as QfMutationType;
  if (
    type === 'DELETE' &&
    value.data !== undefined &&
    (!isObject(value.data) || Object.keys(value.data).length !== 0)
  ) {
    return invalid();
  }
  if (type !== 'DELETE' && value.data === undefined) {
    return invalid();
  }

  const data =
    type === 'DELETE'
      ? undefined
      : decodeData(resource, value.data, projectBookmarks);
  if (data === null) return null;
  return {
    resource,
    type,
    resourceId: value.resourceId,
    timestamp: value.timestamp,
    ...(data === undefined ? {} : {data}),
  };
}

export function decodeBayaanSyncRequestMutation(
  value: unknown,
): BayaanSyncRequestMutation {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, REQUEST_MUTATION_KEYS) ||
    typeof value.resource !== 'string' ||
    !RESOURCES.has(value.resource as QfSyncResource) ||
    typeof value.type !== 'string' ||
    !MUTATION_TYPES.has(value.type as QfMutationType)
  ) {
    return invalid();
  }
  const resource = value.resource as QfSyncResource;
  const type = value.type as QfMutationType;
  const resourceId = value.resourceId;
  if (
    resourceId !== undefined &&
    (typeof resourceId !== 'string' ||
      resourceId.length === 0 ||
      resourceId.length > 256)
  ) {
    return invalid();
  }
  if ((type === 'UPDATE' || type === 'DELETE') && !resourceId) {
    return invalid();
  }
  if (type === 'DELETE') {
    if (
      value.data !== undefined &&
      (!isObject(value.data) || Object.keys(value.data).length > 0)
    ) {
      return invalid();
    }
    return {resource, type, resourceId: resourceId as string};
  }
  if (value.data === undefined) return invalid();
  const data = decodeData(resource, value.data);
  if (data === null) return invalid();
  return {
    resource,
    type,
    ...(typeof resourceId === 'string' ? {resourceId} : {}),
    data,
  };
}

function decodeResponse(
  value: unknown,
  request: BayaanSyncPullDecodeRequest,
  projectBookmarks: boolean,
): BayaanSyncPullPage {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, ENVELOPE_KEYS) ||
    value.success !== true ||
    !isObject(value.data) ||
    !hasOnlyKeys(value.data, RESULT_KEYS)
  ) {
    return invalid();
  }

  const data = value.data;
  if (!isSafeTimestamp(data.lastMutationAt)) {
    return invalid();
  }
  if (
    (data.mutations === undefined && request.metadataOnly !== true) ||
    (data.mutations !== undefined &&
      (!Array.isArray(data.mutations) || data.mutations.length > 1000))
  ) {
    return invalid();
  }
  for (const key of ['page', 'limit'] as const) {
    if (data[key] !== undefined && !isPositiveSafeInteger(data[key])) {
      return invalid();
    }
  }
  if (
    data.total !== undefined &&
    (!Number.isSafeInteger(data.total) || (data.total as number) < 0)
  ) {
    return invalid();
  }
  if (data.hasMore !== undefined && typeof data.hasMore !== 'boolean') {
    return invalid();
  }
  const paginationFieldCount = [
    data.page,
    data.limit,
    data.total,
    data.hasMore,
  ].filter(field => field !== undefined).length;
  if (paginationFieldCount !== 0 && paginationFieldCount !== 4) {
    return invalid();
  }
  if (
    (data.page !== undefined &&
      request.page !== undefined &&
      data.page !== request.page) ||
    (data.limit !== undefined &&
      request.limit !== undefined &&
      data.limit !== request.limit)
  ) {
    return invalid();
  }
  if (
    data.page !== undefined &&
    data.limit !== undefined &&
    data.total !== undefined &&
    data.hasMore !== undefined
  ) {
    const traversed = (data.page as number) * (data.limit as number);
    if (
      !Number.isSafeInteger(traversed) ||
      data.hasMore !== traversed < (data.total as number)
    ) {
      return invalid();
    }
  }

  const received = Array.isArray(data.mutations) ? data.mutations : [];
  const mutations = received
    .map(mutation => decodeMutation(mutation, projectBookmarks))
    .filter((mutation): mutation is BayaanSyncMutation => mutation !== null);
  return {
    lastMutationAt: data.lastMutationAt,
    mutations,
    ...(mutations.length === received.length
      ? {}
      : {receivedMutationCount: received.length}),
    ...(data.page === undefined ? {} : {page: data.page as number}),
    ...(data.limit === undefined ? {} : {limit: data.limit as number}),
    ...(data.total === undefined ? {} : {total: data.total as number}),
    ...(data.hasMore === undefined ? {} : {hasMore: data.hasMore}),
  };
}

export function decodeBayaanSyncPullResponse(
  value: unknown,
  request: BayaanSyncPullDecodeRequest = {},
): BayaanSyncPullPage {
  return decodeResponse(value, request, true);
}

export function decodeBayaanSyncPushResponse(
  value: unknown,
): BayaanSyncPushResult {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, ENVELOPE_KEYS) ||
    value.success !== true ||
    !isObject(value.data) ||
    !hasOnlyKeys(value.data, new Set(['lastMutationAt', 'mutations'])) ||
    !Array.isArray(value.data.mutations)
  ) {
    return invalid();
  }

  // Push receipts must describe supported effects; never filter acknowledgements.
  const decoded = decodeResponse(value, {}, false);
  return {
    lastMutationAt: decoded.lastMutationAt,
    mutations: decoded.mutations,
  };
}
