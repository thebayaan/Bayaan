import type {BayaanSyncPullRequest} from './bayaanSyncApiClient';
import type {BayaanSyncMutation, BayaanSyncPullPage} from './bayaanSyncCodec';
import surahData from '@/data/surahData.json';

const DEFAULT_PAGE_LIMIT = 1000;
const DEFAULT_MAX_RESTARTS = 2;
const DEFAULT_MAX_PAGES = 1000;
const DEFAULT_BASE_BACKOFF_MS = 250;

export interface QfSyncPullTransport {
  pull(
    opaqueSessionToken: string,
    request: BayaanSyncPullRequest,
  ): Promise<BayaanSyncPullPage>;
}

export interface QfSyncPullStore {
  getStoredHead(accountId: string): Promise<number>;
  applyPage(accountId: string, mutations: BayaanSyncMutation[]): Promise<void>;
  commitStableHead(
    accountId: string,
    expectedHead: number,
    stableHead: number,
    syncedAt: number,
  ): Promise<boolean>;
}

interface SyncSqliteConnection {
  runAsync(
    source: string,
    params?: unknown[] | Record<string, unknown>,
  ): Promise<unknown>;
  getAllAsync<T extends Record<string, unknown>>(
    source: string,
    params?: unknown[] | Record<string, unknown>,
  ): Promise<T[]>;
  getFirstAsync<T extends Record<string, unknown>>(
    source: string,
    params?: unknown[] | Record<string, unknown>,
  ): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

interface SyncDatabaseProvider {
  getConnection(): Promise<SyncSqliteConnection>;
}

interface SyncStateRow extends Record<string, unknown> {
  last_mutation_at: string | null;
}

interface RemoteRow extends Record<string, unknown> {
  id: string;
  remote_id: string | null;
  server_created_at?: number | null;
  server_updated_at: number | null;
  created_at: number;
  updated_at?: number;
  rewayah_id: string | null;
}

interface NoteRow extends RemoteRow {
  verse_key: string;
  surah_number: number;
  ayah_number: number;
  content: string;
  verse_keys: string | null;
}

interface NoteOutboxRow extends Record<string, unknown> {
  payload_json: string;
  base_server_updated_at: number | null;
}

interface PendingNotePayload {
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  content: string;
  verseKeys?: string[];
  rewayahId?: string;
  clientCreatedAt: number;
  clientUpdatedAt: number;
}

const SURAH_VERSE_COUNTS = new Map<number, number>(
  surahData.map(surah => [surah.id, surah.verses_count]),
);

function ownerScope(accountId: string): `qf:${string}` {
  if (!accountId) throw new Error('Account id is required');
  return `qf:${accountId}`;
}

function generateLocalId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

function dataFor(mutation: BayaanSyncMutation): Record<string, unknown> {
  if (!mutation.data) throw new Error('Remote mutation data is required');
  return mutation.data;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new Error(`Invalid remote ${field}`);
  }
  return value as number;
}

function remoteDate(value: unknown, fallback: number): number {
  if (typeof value !== 'string') return fallback;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseVerseKey(value: string): {surah: number; ayah: number} {
  const match = /^(\d+):(\d+)$/.exec(value);
  if (!match) throw new Error(`Invalid verse range: ${value}`);
  const surah = Number(match[1]);
  const ayah = Number(match[2]);
  const verseCount = SURAH_VERSE_COUNTS.get(surah);
  if (!verseCount || ayah < 1 || ayah > verseCount) {
    throw new Error(`Invalid verse range: ${value}`);
  }
  return {surah, ayah};
}

function verseOrdinal({surah, ayah}: {surah: number; ayah: number}): number {
  let ordinal = ayah;
  for (let current = 1; current < surah; current += 1) {
    ordinal += SURAH_VERSE_COUNTS.get(current) ?? 0;
  }
  return ordinal;
}

function verseAtOrdinal(ordinal: number): string {
  let remaining = ordinal;
  for (let surah = 1; surah <= 114; surah += 1) {
    const count = SURAH_VERSE_COUNTS.get(surah);
    if (!count) break;
    if (remaining <= count) return `${surah}:${remaining}`;
    remaining -= count;
  }
  throw new Error('Invalid verse range ordinal');
}

function expandVerseRanges(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Invalid verse range list');
  }
  const expanded = new Set<string>();
  for (const range of value) {
    if (typeof range !== 'string') throw new Error('Invalid verse range');
    const match = /^(\d+:\d+)-(\d+:\d+)$/.exec(range);
    if (!match) throw new Error(`Invalid verse range: ${range}`);
    const start = verseOrdinal(parseVerseKey(match[1]));
    const end = verseOrdinal(parseVerseKey(match[2]));
    if (end < start) throw new Error(`Invalid verse range: ${range}`);
    for (let ordinal = start; ordinal <= end; ordinal += 1) {
      expanded.add(verseAtOrdinal(ordinal));
    }
  }
  return [...expanded];
}

function parsePendingNote(value: string): PendingNotePayload | null {
  try {
    const parsed = JSON.parse(value) as Partial<PendingNotePayload>;
    if (
      typeof parsed.verseKey !== 'string' ||
      !Number.isSafeInteger(parsed.surahNumber) ||
      !Number.isSafeInteger(parsed.ayahNumber) ||
      typeof parsed.content !== 'string' ||
      !Number.isFinite(parsed.clientCreatedAt) ||
      !Number.isFinite(parsed.clientUpdatedAt)
    ) {
      return null;
    }
    return parsed as PendingNotePayload;
  } catch {
    return null;
  }
}

export class SqliteQfSyncPullStore implements QfSyncPullStore {
  constructor(private readonly database: SyncDatabaseProvider) {}

  async getStoredHead(accountId: string): Promise<number> {
    const db = await this.database.getConnection();
    const row = await db.getFirstAsync<SyncStateRow>(
      `SELECT last_mutation_at FROM qf_sync_state WHERE owner_scope = ?`,
      [ownerScope(accountId)],
    );
    if (!row?.last_mutation_at) return 0;
    const head = Number(row.last_mutation_at);
    return Number.isSafeInteger(head) && head >= 0 ? head : 0;
  }

  async commitStableHead(
    accountId: string,
    expectedHead: number,
    stableHead: number,
    syncedAt: number,
  ): Promise<boolean> {
    const db = await this.database.getConnection();
    const scope = ownerScope(accountId);
    let committed = false;
    await db.withTransactionAsync(async () => {
      const row = await db.getFirstAsync<SyncStateRow>(
        `SELECT last_mutation_at FROM qf_sync_state WHERE owner_scope = ?`,
        [scope],
      );
      const currentHead = row?.last_mutation_at
        ? Number(row.last_mutation_at)
        : 0;
      if (currentHead !== expectedHead) return;

      await db.runAsync(
        `INSERT INTO qf_sync_state
           (owner_scope, last_mutation_at, last_successful_sync_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(owner_scope) DO UPDATE SET
           last_mutation_at = excluded.last_mutation_at,
           last_successful_sync_at = excluded.last_successful_sync_at,
           updated_at = excluded.updated_at`,
        [scope, String(stableHead), syncedAt, syncedAt, syncedAt],
      );
      committed = true;
    });
    return committed;
  }

  async applyPage(
    accountId: string,
    mutations: BayaanSyncMutation[],
  ): Promise<void> {
    const db = await this.database.getConnection();
    const scope = ownerScope(accountId);
    await db.withTransactionAsync(async () => {
      for (const mutation of mutations) {
        if (mutation.type === 'DELETE') {
          await this.applyTombstone(db, scope, accountId, mutation);
        } else if (mutation.resource === 'BOOKMARK') {
          await this.applyBookmark(db, scope, mutation);
        } else if (mutation.resource === 'NOTE') {
          await this.applyNote(db, scope, accountId, mutation);
        } else {
          await this.applyReadingSession(db, scope, mutation);
        }
      }
    });
  }

  private async applyBookmark(
    db: SyncSqliteConnection,
    scope: `qf:${string}`,
    mutation: BayaanSyncMutation,
  ): Promise<void> {
    const data = dataFor(mutation);
    const surah = positiveInteger(data.key, 'bookmark chapter');
    const ayah = positiveInteger(data.verseNumber, 'bookmark verse');
    if (ayah > (SURAH_VERSE_COUNTS.get(surah) ?? 0)) {
      throw new Error('Invalid remote bookmark verse');
    }
    const verseKey = `${surah}:${ayah}`;
    const existing = await db.getFirstAsync<RemoteRow>(
      `SELECT * FROM bookmarks
       WHERE owner_scope = ? AND (remote_id = ? OR verse_key = ?)
       ORDER BY CASE WHEN remote_id = ? THEN 0 ELSE 1 END LIMIT 1`,
      [scope, mutation.resourceId, verseKey, mutation.resourceId],
    );
    if (
      existing?.server_updated_at !== null &&
      existing?.server_updated_at !== undefined &&
      mutation.timestamp <= existing.server_updated_at
    ) {
      return;
    }
    const createdAt = remoteDate(data.clientCreatedAt, mutation.timestamp);
    if (existing) {
      await db.runAsync(
        `UPDATE bookmarks
         SET verse_key = ?, surah_number = ?, ayah_number = ?, remote_id = ?,
             server_created_at = COALESCE(server_created_at, ?), server_updated_at = ?
         WHERE owner_scope = ? AND id = ?`,
        [
          verseKey,
          surah,
          ayah,
          mutation.resourceId,
          createdAt,
          mutation.timestamp,
          scope,
          existing.id,
        ],
      );
      return;
    }
    await db.runAsync(
      `INSERT INTO bookmarks
         (id, owner_scope, verse_key, surah_number, ayah_number, created_at, rewayah_id, remote_id, server_created_at, server_updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'hafs', ?, ?, ?)`,
      [
        generateLocalId(),
        scope,
        verseKey,
        surah,
        ayah,
        createdAt,
        mutation.resourceId,
        createdAt,
        mutation.timestamp,
      ],
    );
  }

  private async applyNote(
    db: SyncSqliteConnection,
    scope: `qf:${string}`,
    accountId: string,
    mutation: BayaanSyncMutation,
  ): Promise<void> {
    const data = dataFor(mutation);
    if (typeof data.body !== 'string' || data.saveToQR !== false) {
      throw new Error('Invalid remote private note');
    }
    const verseKeys = expandVerseRanges(data.ranges);
    const [surahNumber, ayahNumber] = verseKeys[0].split(':').map(Number);
    const createdAt = remoteDate(data.clientCreatedAt, mutation.timestamp);
    const canonical = await db.getFirstAsync<NoteRow>(
      `SELECT * FROM notes WHERE owner_scope = ? AND remote_id = ?`,
      [scope, mutation.resourceId],
    );
    if (
      canonical?.server_updated_at !== null &&
      canonical?.server_updated_at !== undefined &&
      mutation.timestamp <= canonical.server_updated_at
    ) {
      return;
    }
    if (!canonical) {
      await db.runAsync(
        `INSERT INTO notes
           (id, owner_scope, verse_key, surah_number, ayah_number, content, verse_keys, created_at, updated_at, rewayah_id, remote_id, server_created_at, server_updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'hafs', ?, ?, ?)`,
        [
          generateLocalId(),
          scope,
          verseKeys[0],
          surahNumber,
          ayahNumber,
          data.body,
          verseKeys.join(','),
          createdAt,
          mutation.timestamp,
          mutation.resourceId,
          createdAt,
          mutation.timestamp,
        ],
      );
      return;
    }

    const pendingRow = await db.getFirstAsync<NoteOutboxRow>(
      `SELECT payload_json, base_server_updated_at FROM qf_sync_outbox
       WHERE owner_scope = ? AND resource = 'NOTE' AND local_id = ?
       ORDER BY created_at DESC, local_operation_id DESC LIMIT 1`,
      [scope, canonical.id],
    );
    const pending = pendingRow
      ? parsePendingNote(pendingRow.payload_json)
      : null;
    const pendingBase =
      pendingRow?.base_server_updated_at ?? canonical.server_updated_at;
    if (pending && pendingBase !== null && mutation.timestamp <= pendingBase) {
      return;
    }

    await db.runAsync(
      `UPDATE notes
       SET verse_key = ?, surah_number = ?, ayah_number = ?, content = ?, verse_keys = ?,
           remote_id = ?, server_created_at = COALESCE(server_created_at, ?),
           server_updated_at = ?, updated_at = ?
       WHERE owner_scope = ? AND id = ?`,
      [
        verseKeys[0],
        surahNumber,
        ayahNumber,
        data.body,
        verseKeys.join(','),
        mutation.resourceId,
        createdAt,
        mutation.timestamp,
        mutation.timestamp,
        scope,
        canonical.id,
      ],
    );
    if (pending) {
      await this.preservePendingNote(
        db,
        scope,
        accountId,
        canonical,
        pending,
        data.body,
        pendingBase,
      );
    }
  }

  private async preservePendingNote(
    db: SyncSqliteConnection,
    scope: `qf:${string}`,
    accountId: string,
    canonical: NoteRow,
    pending: PendingNotePayload,
    remoteContent: string,
    baseServerUpdatedAt: number | null,
  ): Promise<void> {
    const copyId = generateLocalId();
    await db.runAsync(
      `INSERT INTO notes
         (id, owner_scope, verse_key, surah_number, ayah_number, content, verse_keys, created_at, updated_at, rewayah_id, remote_id, server_created_at, server_updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`,
      [
        copyId,
        scope,
        pending.verseKey,
        pending.surahNumber,
        pending.ayahNumber,
        pending.content,
        pending.verseKeys?.join(',') ?? null,
        pending.clientCreatedAt,
        pending.clientUpdatedAt,
        pending.rewayahId ?? canonical.rewayah_id ?? 'hafs',
      ],
    );
    await db.runAsync(
      `DELETE FROM qf_sync_outbox
       WHERE owner_scope = ? AND resource = 'NOTE' AND local_id = ?`,
      [scope, canonical.id],
    );
    await db.runAsync(
      `INSERT INTO qf_sync_outbox
         (local_operation_id, owner_scope, account_id, resource, mutation_type,
          local_id, remote_id, payload_json, base_server_updated_at, attempts,
          next_attempt_at, created_at, revision, delivery_state)
       VALUES (?, ?, ?, 'NOTE', 'CREATE', ?, NULL, ?, NULL, 0, NULL, ?, 1, 'PENDING')`,
      [
        generateLocalId(),
        scope,
        accountId,
        copyId,
        JSON.stringify(pending),
        pending.clientUpdatedAt,
      ],
    );
    await db.runAsync(
      `INSERT INTO qf_note_conflicts
         (id, owner_scope, note_id, local_content, remote_content, remote_id,
          base_server_updated_at, created_at, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        generateLocalId(),
        scope,
        canonical.id,
        pending.content,
        remoteContent,
        canonical.remote_id,
        baseServerUpdatedAt,
        Date.now(),
      ],
    );
  }

  private async applyReadingSession(
    db: SyncSqliteConnection,
    scope: `qf:${string}`,
    mutation: BayaanSyncMutation,
  ): Promise<void> {
    const data = dataFor(mutation);
    const surah = positiveInteger(data.chapterNumber, 'reading chapter');
    const ayah = positiveInteger(data.verseNumber, 'reading verse');
    if (ayah > (SURAH_VERSE_COUNTS.get(surah) ?? 0)) {
      throw new Error('Invalid remote reading verse');
    }
    const existing = await db.getFirstAsync<RemoteRow>(
      `SELECT * FROM (
         SELECT *, 0 AS match_priority FROM qf_reading_locations
         WHERE owner_scope = ? AND remote_id = ?
         UNION ALL
         SELECT *, 1 AS match_priority FROM qf_reading_locations
         WHERE owner_scope = ? AND remote_id IS NULL
       )
       ORDER BY match_priority, last_read_at DESC LIMIT 1`,
      [scope, mutation.resourceId, scope],
    );
    if (
      existing?.server_updated_at !== null &&
      existing?.server_updated_at !== undefined &&
      mutation.timestamp <= existing.server_updated_at
    ) {
      return;
    }
    const lastReadAt = remoteDate(data.clientUpdatedAt, mutation.timestamp);
    const createdAt = remoteDate(data.clientCreatedAt, lastReadAt);
    if (existing) {
      await db.runAsync(
        `UPDATE qf_reading_locations
         SET remote_id = ?, surah_number = ?, ayah_number = ?, verse_key = ?,
             last_read_at = ?, server_updated_at = ?, updated_at = ?
         WHERE owner_scope = ? AND id = ?`,
        [
          mutation.resourceId,
          surah,
          ayah,
          `${surah}:${ayah}`,
          lastReadAt,
          mutation.timestamp,
          mutation.timestamp,
          scope,
          existing.id,
        ],
      );
      return;
    }
    await db.runAsync(
      `INSERT INTO qf_reading_locations
         (id, owner_scope, remote_id, surah_number, ayah_number, verse_key,
          page_number, rewayah_id, last_read_at, server_updated_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 'hafs', ?, ?, ?, ?)`,
      [
        generateLocalId(),
        scope,
        mutation.resourceId,
        surah,
        ayah,
        `${surah}:${ayah}`,
        lastReadAt,
        mutation.timestamp,
        createdAt,
        mutation.timestamp,
      ],
    );
  }

  private async applyTombstone(
    db: SyncSqliteConnection,
    scope: `qf:${string}`,
    accountId: string,
    mutation: BayaanSyncMutation,
  ): Promise<void> {
    if (mutation.resource === 'BOOKMARK') {
      await db.runAsync(
        `DELETE FROM bookmarks WHERE owner_scope = ? AND remote_id = ?`,
        [scope, mutation.resourceId],
      );
      return;
    }
    if (mutation.resource === 'READING_SESSION') {
      await db.runAsync(
        `DELETE FROM qf_reading_locations WHERE owner_scope = ? AND remote_id = ?`,
        [scope, mutation.resourceId],
      );
      return;
    }

    const canonical = await db.getFirstAsync<NoteRow>(
      `SELECT * FROM notes WHERE owner_scope = ? AND remote_id = ?`,
      [scope, mutation.resourceId],
    );
    if (!canonical) return;
    const pendingRow = await db.getFirstAsync<NoteOutboxRow>(
      `SELECT payload_json, base_server_updated_at FROM qf_sync_outbox
       WHERE owner_scope = ? AND resource = 'NOTE' AND local_id = ?
       ORDER BY created_at DESC, local_operation_id DESC LIMIT 1`,
      [scope, canonical.id],
    );
    const pending = pendingRow
      ? parsePendingNote(pendingRow.payload_json)
      : null;
    await db.runAsync(`DELETE FROM notes WHERE owner_scope = ? AND id = ?`, [
      scope,
      canonical.id,
    ]);
    if (pending) {
      await this.preservePendingNote(
        db,
        scope,
        accountId,
        canonical,
        pending,
        '',
        pendingRow?.base_server_updated_at ?? canonical.server_updated_at,
      );
    }
  }
}

interface QfSyncCoordinatorOptions {
  transport: QfSyncPullTransport;
  store: QfSyncPullStore;
  maxRestarts?: number;
  maxPages?: number;
  baseBackoffMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
  now?: () => number;
}

interface PullInput {
  accountId: string;
  sessionToken: string;
}

export type QfSyncPullResult =
  | {status: 'synced'; head: number; restarts: number}
  | {
      status: 'deferred';
      reason: 'unstable_head' | 'concurrent_sync' | 'page_limit';
      retryAfterMs: number;
      restarts: number;
    };

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

function hasAnotherPage(page: BayaanSyncPullPage): boolean {
  if (page.hasMore !== undefined) return page.hasMore;
  if (
    page.page !== undefined &&
    page.limit !== undefined &&
    page.total !== undefined
  ) {
    return page.page * page.limit < page.total;
  }
  return false;
}

export class QfSyncCoordinator {
  private readonly maxRestarts: number;
  private readonly maxPages: number;
  private readonly baseBackoffMs: number;
  private readonly sleep: (delayMs: number) => Promise<void>;
  private readonly now: () => number;

  constructor(private readonly options: QfSyncCoordinatorOptions) {
    this.maxRestarts = options.maxRestarts ?? DEFAULT_MAX_RESTARTS;
    this.maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
    this.baseBackoffMs = options.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS;
    this.sleep = options.sleep ?? defaultSleep;
    this.now = options.now ?? Date.now;
  }

  async pull(input: PullInput): Promise<QfSyncPullResult> {
    const storedHead = await this.options.store.getStoredHead(input.accountId);

    for (let attempt = 0; attempt <= this.maxRestarts; attempt += 1) {
      let traversalHead: number | undefined;
      let traversalChanged = false;
      let pageNumber = 1;

      for (; pageNumber <= this.maxPages; pageNumber += 1) {
        const page = await this.options.transport.pull(input.sessionToken, {
          mutationsSince: storedHead,
          metadataOnly: false,
          limit: DEFAULT_PAGE_LIMIT,
          page: pageNumber,
        });

        if (traversalHead === undefined) {
          traversalHead = page.lastMutationAt;
        } else if (page.lastMutationAt !== traversalHead) {
          traversalChanged = true;
        }
        if (page.lastMutationAt < storedHead) {
          traversalChanged = true;
        }

        await this.options.store.applyPage(input.accountId, page.mutations);
        if (!hasAnotherPage(page)) break;
      }

      if (pageNumber > this.maxPages) {
        return {
          status: 'deferred',
          reason: 'page_limit',
          retryAfterMs: this.backoffFor(attempt),
          restarts: attempt,
        };
      }

      const metadata = await this.options.transport.pull(input.sessionToken, {
        mutationsSince: storedHead,
        metadataOnly: true,
      });
      const headIsStable =
        !traversalChanged &&
        traversalHead !== undefined &&
        traversalHead === metadata.lastMutationAt &&
        metadata.lastMutationAt >= storedHead;

      if (headIsStable) {
        const committed = await this.options.store.commitStableHead(
          input.accountId,
          storedHead,
          metadata.lastMutationAt,
          this.now(),
        );
        if (!committed) {
          return {
            status: 'deferred',
            reason: 'concurrent_sync',
            retryAfterMs: this.backoffFor(attempt),
            restarts: attempt,
          };
        }
        return {
          status: 'synced',
          head: metadata.lastMutationAt,
          restarts: attempt,
        };
      }

      if (attempt === this.maxRestarts) {
        return {
          status: 'deferred',
          reason: 'unstable_head',
          retryAfterMs: this.backoffFor(attempt),
          restarts: attempt,
        };
      }
      await this.sleep(this.backoffFor(attempt));
    }

    throw new Error('Unreachable stable pull state');
  }

  private backoffFor(attempt: number): number {
    return this.baseBackoffMs * 2 ** attempt;
  }
}
