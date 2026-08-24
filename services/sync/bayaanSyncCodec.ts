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
): Record<string, string | number | boolean | string[]> {
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
    if (
      !isPositiveSafeInteger(value.key) ||
      !isPositiveSafeInteger(value.verseNumber)
    ) {
      return invalid();
    }
    for (const key of ['mushafId', 'mushaf'] as const) {
      if (value[key] !== undefined && !isPositiveSafeInteger(value[key])) {
        return invalid();
      }
    }
    for (const key of ['isReading', 'isInDefaultCollection'] as const) {
      if (value[key] !== undefined && typeof value[key] !== 'boolean') {
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

function decodeMutation(value: unknown): BayaanSyncMutation {
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
  if (type === 'DELETE' && value.data !== undefined) {
    return invalid();
  }
  if (type !== 'DELETE' && value.data === undefined) {
    return invalid();
  }

  return {
    resource,
    type,
    resourceId: value.resourceId,
    timestamp: value.timestamp,
    ...(value.data === undefined
      ? {}
      : {data: decodeData(resource, value.data)}),
  };
}

export function decodeBayaanSyncPullResponse(
  value: unknown,
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
    data.mutations !== undefined &&
    (!Array.isArray(data.mutations) || data.mutations.length > 1000)
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

  return {
    lastMutationAt: data.lastMutationAt,
    mutations: Array.isArray(data.mutations)
      ? data.mutations.map(decodeMutation)
      : [],
    ...(data.page === undefined ? {} : {page: data.page as number}),
    ...(data.limit === undefined ? {} : {limit: data.limit as number}),
    ...(data.total === undefined ? {} : {total: data.total as number}),
    ...(data.hasMore === undefined ? {} : {hasMore: data.hasMore}),
  };
}
