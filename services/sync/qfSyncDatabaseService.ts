import type {
  AnnotationOwnerScope,
  VerseBookmark,
  VerseNote,
} from '@/types/verse-annotations';
import {
  verseAnnotationDatabase,
  VerseAnnotationDatabase,
} from '@/services/database/VerseAnnotationDatabase';
import {
  verseAnnotationDatabaseService,
  VerseAnnotationDatabaseService,
} from '@/services/database/VerseAnnotationDatabaseService';
import type {QfMutationType, QfSyncResource} from '@/types/qf-sync';

interface AddBookmarkInput {
  accountId: string;
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  rewayahId?: string;
}

interface RemoveBookmarkInput {
  accountId: string;
  verseKey: string;
}

interface AddNoteInput {
  accountId: string;
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  content: string;
  verseKeys?: string[];
  rewayahId?: string;
}

interface UpdateNoteInput {
  accountId: string;
  noteId: string;
  content: string;
}

interface DeleteNoteInput {
  accountId: string;
  noteId: string;
}

interface UpsertReadingLocationInput {
  accountId: string;
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  pageNumber?: number;
  rewayahId?: string;
  lastReadAt: number;
}

interface ApplyRemoteNoteInput {
  accountId: string;
  remoteId: string;
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  content: string;
  verseKeys?: string[];
  serverCreatedAt?: number;
  serverUpdatedAt: number;
}

interface AcknowledgeOperationInput {
  accountId: string;
  localOperationId: string;
  resourceId: string;
  serverCreatedAt?: number;
  serverUpdatedAt?: number;
}

interface MarkOperationInFlightInput {
  accountId: string;
  localOperationId: string;
  startedAt: number;
}

interface QfSyncDatabaseServiceOptions {
  database?: VerseAnnotationDatabase;
  annotations?: VerseAnnotationDatabaseService;
}

export interface QfOutboxEntry {
  localOperationId: string;
  ownerScope: AnnotationOwnerScope;
  accountId: string;
  resource: QfSyncResource;
  mutationType: QfMutationType;
  localId: string | null;
  remoteId: string | null;
  payloadJson: string;
  baseServerUpdatedAt: number | null;
  attempts: number;
  nextAttemptAt: number | null;
  createdAt: number;
  revision: number;
  deliveryState: 'PENDING' | 'IN_FLIGHT' | 'AMBIGUOUS';
  inFlightRevision: number | null;
  inFlightMutationType: QfMutationType | null;
  inFlightPayloadJson: string | null;
  inFlightStartedAt: number | null;
}

interface OutboxRow {
  local_operation_id: string;
  owner_scope: AnnotationOwnerScope;
  account_id: string;
  resource: QfSyncResource;
  mutation_type: QfMutationType;
  local_id: string | null;
  remote_id: string | null;
  payload_json: string;
  base_server_updated_at: number | null;
  attempts: number;
  next_attempt_at: number | null;
  created_at: number;
  revision: number;
  delivery_state: 'PENDING' | 'IN_FLIGHT' | 'AMBIGUOUS';
  in_flight_revision: number | null;
  in_flight_mutation_type: QfMutationType | null;
  in_flight_payload_json: string | null;
  in_flight_started_at: number | null;
}

interface BookmarkRow {
  id: string;
  owner_scope: AnnotationOwnerScope;
  verse_key: string;
  surah_number: number;
  ayah_number: number;
  created_at: number;
  rewayah_id: string | null;
  remote_id: string | null;
  server_created_at: number | null;
  server_updated_at: number | null;
}

interface NoteRow {
  id: string;
  owner_scope: AnnotationOwnerScope;
  verse_key: string;
  surah_number: number;
  ayah_number: number;
  content: string;
  verse_keys: string | null;
  created_at: number;
  updated_at: number;
  rewayah_id: string | null;
  remote_id: string | null;
  server_created_at: number | null;
  server_updated_at: number | null;
}

interface ReadingLocationRow {
  id: string;
  owner_scope: AnnotationOwnerScope;
  remote_id: string | null;
  surah_number: number;
  ayah_number: number;
  verse_key: string;
  page_number: number | null;
  rewayah_id: string | null;
  last_read_at: number;
  server_updated_at: number | null;
  created_at: number;
  updated_at: number;
}

interface BookmarkOutboxPayload {
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  rewayahId?: string;
  clientCreatedAt: number;
  clientUpdatedAt: number;
}

interface NoteOutboxPayload {
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  content: string;
  verseKeys?: string[];
  rewayahId?: string;
  clientCreatedAt: number;
  clientUpdatedAt: number;
}

interface ReadingSessionOutboxPayload {
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  pageNumber?: number;
  rewayahId?: string;
  clientCreatedAt: number;
  clientUpdatedAt: number;
}

const DEFAULT_REWAYAH_ID = 'hafs';

export interface QfReadingLocation {
  id: string;
  ownerScope: AnnotationOwnerScope;
  remoteId?: string;
  surahNumber: number;
  ayahNumber: number;
  verseKey: string;
  pageNumber?: number;
  rewayahId?: string;
  lastReadAt: number;
  serverUpdatedAt?: number;
  createdAt: number;
  updatedAt: number;
}

function ownerScopeFromAccountId(accountId: string): `qf:${string}` {
  return `qf:${accountId}`;
}

function generateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

function toOutboxEntry(row: OutboxRow): QfOutboxEntry {
  return {
    localOperationId: row.local_operation_id,
    ownerScope: row.owner_scope,
    accountId: row.account_id,
    resource: row.resource,
    mutationType: row.mutation_type,
    localId: row.local_id,
    remoteId: row.remote_id,
    payloadJson: row.payload_json,
    baseServerUpdatedAt: row.base_server_updated_at,
    attempts: row.attempts,
    nextAttemptAt: row.next_attempt_at,
    createdAt: row.created_at,
    revision: row.revision,
    deliveryState: row.delivery_state,
    inFlightRevision: row.in_flight_revision,
    inFlightMutationType: row.in_flight_mutation_type,
    inFlightPayloadJson: row.in_flight_payload_json,
    inFlightStartedAt: row.in_flight_started_at,
  };
}

function toReadingLocation(row: ReadingLocationRow): QfReadingLocation {
  return {
    id: row.id,
    ownerScope: row.owner_scope,
    remoteId: row.remote_id ?? undefined,
    surahNumber: row.surah_number,
    ayahNumber: row.ayah_number,
    verseKey: row.verse_key,
    pageNumber: row.page_number ?? undefined,
    rewayahId: row.rewayah_id ?? undefined,
    lastReadAt: row.last_read_at,
    serverUpdatedAt: row.server_updated_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseVerseKeys(value: string | null): string[] | undefined {
  if (!value) return undefined;
  return value.split(',');
}

export class QfSyncDatabaseService {
  private readonly database: VerseAnnotationDatabase;
  private readonly annotations: VerseAnnotationDatabaseService;

  constructor(options: QfSyncDatabaseServiceOptions = {}) {
    this.database = options.database ?? verseAnnotationDatabase;
    this.annotations = options.annotations ?? verseAnnotationDatabaseService;
  }

  async initialize(): Promise<void> {
    await this.database.initialize();
  }

  async addBookmark(input: AddBookmarkInput): Promise<VerseBookmark> {
    const db = await this.database.getConnection();
    const ownerScope = ownerScopeFromAccountId(input.accountId);
    const rewayahId = input.rewayahId ?? DEFAULT_REWAYAH_ID;
    let bookmark: VerseBookmark | undefined;

    await db.withTransactionAsync(async () => {
      bookmark = await this.annotations.addBookmarkForOwnerScope(
        ownerScope,
        input.verseKey,
        input.surahNumber,
        input.ayahNumber,
        rewayahId,
      );

      await this.clearBookmarkOutbox(db, ownerScope, input.verseKey);
      await this.enqueueMutation(db, {
        accountId: input.accountId,
        ownerScope,
        resource: 'BOOKMARK',
        mutationType: 'CREATE',
        localId: bookmark.id,
        remoteId: bookmark.remoteId,
        payload: {
          verseKey: input.verseKey,
          surahNumber: input.surahNumber,
          ayahNumber: input.ayahNumber,
          rewayahId,
          clientCreatedAt: bookmark.createdAt,
          clientUpdatedAt: bookmark.createdAt,
        } satisfies BookmarkOutboxPayload,
        createdAt: bookmark.createdAt,
      });
    });

    if (!bookmark) {
      throw new Error('Bookmark was not created');
    }

    return bookmark;
  }

  async removeBookmark(input: RemoveBookmarkInput): Promise<void> {
    const db = await this.database.getConnection();
    const ownerScope = ownerScopeFromAccountId(input.accountId);

    await db.withTransactionAsync(async () => {
      const bookmark = await this.getBookmarkRow(
        db,
        ownerScope,
        input.verseKey,
      );
      if (!bookmark) {
        return;
      }

      await this.annotations.removeBookmarkInOwnerScope(
        ownerScope,
        input.verseKey,
      );
      await this.clearBookmarkOutbox(db, ownerScope, input.verseKey);
      await this.enqueueMutation(db, {
        accountId: input.accountId,
        ownerScope,
        resource: 'BOOKMARK',
        mutationType: 'DELETE',
        localId: bookmark.id,
        remoteId: bookmark.remote_id ?? undefined,
        payload: {
          verseKey: bookmark.verse_key,
          surahNumber: bookmark.surah_number,
          ayahNumber: bookmark.ayah_number,
          rewayahId: bookmark.rewayah_id ?? undefined,
          clientCreatedAt: bookmark.created_at,
          clientUpdatedAt: Date.now(),
        } satisfies BookmarkOutboxPayload,
        createdAt: Date.now(),
      });
    });
  }

  async addNote(input: AddNoteInput): Promise<VerseNote> {
    const db = await this.database.getConnection();
    const ownerScope = ownerScopeFromAccountId(input.accountId);
    const rewayahId = input.rewayahId ?? DEFAULT_REWAYAH_ID;
    let note: VerseNote | undefined;

    await db.withTransactionAsync(async () => {
      note = await this.annotations.addNoteForOwnerScope(
        ownerScope,
        input.verseKey,
        input.surahNumber,
        input.ayahNumber,
        input.content,
        input.verseKeys,
        rewayahId,
      );

      await this.enqueueMutation(db, {
        accountId: input.accountId,
        ownerScope,
        resource: 'NOTE',
        mutationType: 'CREATE',
        localId: note.id,
        remoteId: note.remoteId,
        payload: {
          verseKey: input.verseKey,
          surahNumber: input.surahNumber,
          ayahNumber: input.ayahNumber,
          content: input.content,
          verseKeys: input.verseKeys,
          rewayahId,
          clientCreatedAt: note.createdAt,
          clientUpdatedAt: note.updatedAt,
        } satisfies NoteOutboxPayload,
        createdAt: note.updatedAt,
      });
    });

    if (!note) {
      throw new Error('Note was not created');
    }

    return note;
  }

  async updateNote(input: UpdateNoteInput): Promise<void> {
    const db = await this.database.getConnection();
    const ownerScope = ownerScopeFromAccountId(input.accountId);

    await db.withTransactionAsync(async () => {
      const before = await this.getNoteRow(db, ownerScope, input.noteId);
      if (!before) {
        throw new Error(`Note ${input.noteId} was not found`);
      }

      await this.annotations.updateNoteInOwnerScope(
        ownerScope,
        input.noteId,
        input.content,
      );

      const after = await this.getNoteRow(db, ownerScope, input.noteId);
      if (!after) {
        throw new Error(`Note ${input.noteId} was not found after update`);
      }

      const existingOperation = await this.getLatestNoteOutboxEntry(
        db,
        ownerScope,
        input.noteId,
      );

      if (
        existingOperation &&
        !after.remote_id &&
        existingOperation.mutationType === 'CREATE'
      ) {
        await db.runAsync(
          `UPDATE qf_sync_outbox
           SET payload_json = ?, created_at = ?, revision = revision + 1
           WHERE local_operation_id = ?`,
          [
            JSON.stringify({
              verseKey: after.verse_key,
              surahNumber: after.surah_number,
              ayahNumber: after.ayah_number,
              content: after.content,
              verseKeys: parseVerseKeys(after.verse_keys),
              rewayahId: after.rewayah_id ?? undefined,
              clientCreatedAt: after.created_at,
              clientUpdatedAt: after.updated_at,
            } satisfies NoteOutboxPayload),
            after.updated_at,
            existingOperation.localOperationId,
          ],
        );
        return;
      }

      await this.clearNoteOutbox(db, ownerScope, input.noteId);
      await this.enqueueMutation(db, {
        accountId: input.accountId,
        ownerScope,
        resource: 'NOTE',
        mutationType: after.remote_id ? 'UPDATE' : 'CREATE',
        localId: after.id,
        remoteId: after.remote_id ?? undefined,
        payload: {
          verseKey: after.verse_key,
          surahNumber: after.surah_number,
          ayahNumber: after.ayah_number,
          content: after.content,
          verseKeys: parseVerseKeys(after.verse_keys),
          rewayahId: after.rewayah_id ?? undefined,
          clientCreatedAt: after.created_at,
          clientUpdatedAt: after.updated_at,
        } satisfies NoteOutboxPayload,
        createdAt: after.updated_at,
        baseServerUpdatedAt: after.server_updated_at ?? undefined,
      });
    });
  }

  async deleteNote(input: DeleteNoteInput): Promise<void> {
    const db = await this.database.getConnection();
    const ownerScope = ownerScopeFromAccountId(input.accountId);

    await db.withTransactionAsync(async () => {
      const note = await this.getNoteRow(db, ownerScope, input.noteId);
      if (!note) {
        return;
      }

      const existingOperation = await this.getLatestNoteOutboxEntry(
        db,
        ownerScope,
        input.noteId,
      );

      await this.annotations.deleteNoteByIdInOwnerScope(
        ownerScope,
        input.noteId,
      );
      const remoteId =
        note.remote_id ?? existingOperation?.remoteId ?? undefined;
      const deletedAt = Date.now();
      const deletePayload = {
        verseKey: note.verse_key,
        surahNumber: note.surah_number,
        ayahNumber: note.ayah_number,
        content: note.content,
        verseKeys: parseVerseKeys(note.verse_keys),
        rewayahId: note.rewayah_id ?? DEFAULT_REWAYAH_ID,
        clientCreatedAt: note.created_at,
        clientUpdatedAt: deletedAt,
      } satisfies NoteOutboxPayload;

      if (
        existingOperation?.mutationType === 'CREATE' &&
        existingOperation.deliveryState === 'PENDING' &&
        !remoteId
      ) {
        await this.clearNoteOutbox(db, ownerScope, input.noteId);
        return;
      }

      if (existingOperation && existingOperation.deliveryState !== 'PENDING') {
        await db.runAsync(
          `UPDATE qf_sync_outbox
           SET mutation_type = 'DELETE', remote_id = ?, payload_json = ?,
               base_server_updated_at = ?, created_at = ?, revision = revision + 1
           WHERE owner_scope = ? AND local_operation_id = ?`,
          [
            remoteId ?? null,
            JSON.stringify(deletePayload),
            note.server_updated_at ?? null,
            deletedAt,
            ownerScope,
            existingOperation.localOperationId,
          ],
        );
        return;
      }

      if (!remoteId && !existingOperation) {
        return;
      }

      await this.clearNoteOutbox(db, ownerScope, input.noteId);
      await this.enqueueMutation(db, {
        accountId: input.accountId,
        ownerScope,
        resource: 'NOTE',
        mutationType: 'DELETE',
        localId: note.id,
        remoteId,
        payload: deletePayload,
        createdAt: deletedAt,
        baseServerUpdatedAt: note.server_updated_at ?? undefined,
      });
    });
  }

  async upsertReadingLocation(
    input: UpsertReadingLocationInput,
  ): Promise<void> {
    const db = await this.database.getConnection();
    const ownerScope = ownerScopeFromAccountId(input.accountId);
    const rewayahId = input.rewayahId ?? DEFAULT_REWAYAH_ID;

    await db.withTransactionAsync(async () => {
      const existing = await this.getLatestReadingLocationRow(db, ownerScope);
      if (existing && input.lastReadAt <= existing.last_read_at) {
        return;
      }

      const rowId = existing?.id ?? generateId();
      const createdAt = existing?.created_at ?? input.lastReadAt;

      if (existing) {
        await db.runAsync(
          `UPDATE qf_reading_locations
           SET surah_number = ?, ayah_number = ?, verse_key = ?, page_number = ?, rewayah_id = ?, last_read_at = ?, updated_at = ?
           WHERE id = ? AND owner_scope = ?`,
          [
            input.surahNumber,
            input.ayahNumber,
            input.verseKey,
            input.pageNumber ?? null,
            rewayahId,
            input.lastReadAt,
            input.lastReadAt,
            rowId,
            ownerScope,
          ],
        );
      } else {
        await db.runAsync(
          `INSERT INTO qf_reading_locations
             (id, owner_scope, remote_id, surah_number, ayah_number, verse_key, page_number, rewayah_id, last_read_at, server_updated_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            rowId,
            ownerScope,
            null,
            input.surahNumber,
            input.ayahNumber,
            input.verseKey,
            input.pageNumber ?? null,
            rewayahId,
            input.lastReadAt,
            null,
            createdAt,
            input.lastReadAt,
          ],
        );
      }

      const latest = await this.getReadingLocationRowById(
        db,
        ownerScope,
        rowId,
      );
      if (!latest) {
        throw new Error('Reading location was not persisted');
      }

      await this.clearReadingSessionOutbox(db, ownerScope);
      await this.enqueueMutation(db, {
        accountId: input.accountId,
        ownerScope,
        resource: 'READING_SESSION',
        mutationType: latest.remote_id ? 'UPDATE' : 'CREATE',
        localId: latest.id,
        remoteId: latest.remote_id ?? undefined,
        payload: {
          verseKey: latest.verse_key,
          surahNumber: latest.surah_number,
          ayahNumber: latest.ayah_number,
          pageNumber: latest.page_number ?? undefined,
          rewayahId: latest.rewayah_id ?? undefined,
          clientCreatedAt: latest.created_at,
          clientUpdatedAt: latest.updated_at,
        } satisfies ReadingSessionOutboxPayload,
        createdAt: latest.updated_at,
        baseServerUpdatedAt: latest.server_updated_at ?? undefined,
      });
    });
  }

  async getReadingLocations(accountId: string): Promise<QfReadingLocation[]> {
    const db = await this.database.getConnection();
    const rows = (await db.getAllAsync(
      `SELECT * FROM qf_reading_locations WHERE owner_scope = ? ORDER BY last_read_at DESC`,
      [ownerScopeFromAccountId(accountId)],
    )) as ReadingLocationRow[];
    return rows.map(toReadingLocation);
  }

  async getOutboxEntries(accountId: string): Promise<QfOutboxEntry[]> {
    const db = await this.database.getConnection();
    const rows = (await db.getAllAsync(
      `SELECT * FROM qf_sync_outbox WHERE owner_scope = ? ORDER BY created_at, local_operation_id`,
      [ownerScopeFromAccountId(accountId)],
    )) as OutboxRow[];
    return rows.map(toOutboxEntry);
  }

  async markOperationInFlight(
    input: MarkOperationInFlightInput,
  ): Promise<QfOutboxEntry> {
    const db = await this.database.getConnection();
    const ownerScope = ownerScopeFromAccountId(input.accountId);
    let marked: OutboxRow | null = null;

    await db.withTransactionAsync(async () => {
      const row = (await db.getFirstAsync(
        `SELECT * FROM qf_sync_outbox
         WHERE owner_scope = ? AND local_operation_id = ?`,
        [ownerScope, input.localOperationId],
      )) as OutboxRow | null;
      if (!row) {
        throw new Error(
          `Outbox operation ${input.localOperationId} was not found`,
        );
      }
      if (row.delivery_state !== 'PENDING') {
        throw new Error(
          `Outbox operation ${input.localOperationId} is ${row.delivery_state}`,
        );
      }

      await db.runAsync(
        `UPDATE qf_sync_outbox
         SET delivery_state = 'IN_FLIGHT',
             in_flight_revision = revision,
             in_flight_mutation_type = mutation_type,
             in_flight_payload_json = payload_json,
             in_flight_started_at = ?
         WHERE owner_scope = ? AND local_operation_id = ?`,
        [input.startedAt, ownerScope, input.localOperationId],
      );
      marked = (await db.getFirstAsync(
        `SELECT * FROM qf_sync_outbox
         WHERE owner_scope = ? AND local_operation_id = ?`,
        [ownerScope, input.localOperationId],
      )) as OutboxRow | null;
    });

    if (!marked) {
      throw new Error(
        `Outbox operation ${input.localOperationId} was not marked`,
      );
    }
    return toOutboxEntry(marked);
  }

  async acknowledgeOperation(input: AcknowledgeOperationInput): Promise<void> {
    const db = await this.database.getConnection();
    const ownerScope = ownerScopeFromAccountId(input.accountId);

    await db.withTransactionAsync(async () => {
      const row = (await db.getFirstAsync(
        `SELECT * FROM qf_sync_outbox WHERE owner_scope = ? AND local_operation_id = ?`,
        [ownerScope, input.localOperationId],
      )) as OutboxRow | null;
      if (!row) {
        throw new Error(
          `Outbox operation ${input.localOperationId} was not found`,
        );
      }
      if (
        row.delivery_state !== 'IN_FLIGHT' ||
        row.in_flight_revision === null ||
        row.in_flight_mutation_type === null ||
        row.in_flight_payload_json === null
      ) {
        throw new Error(
          `Outbox operation ${input.localOperationId} has no durable in-flight revision`,
        );
      }

      if (row.in_flight_mutation_type !== 'DELETE' && row.local_id) {
        if (row.resource === 'BOOKMARK') {
          await db.runAsync(
            `UPDATE bookmarks
             SET remote_id = ?, server_created_at = ?, server_updated_at = ?
             WHERE owner_scope = ? AND id = ?`,
            [
              input.resourceId,
              input.serverCreatedAt ?? null,
              input.serverUpdatedAt ?? null,
              ownerScope,
              row.local_id,
            ],
          );
        }

        if (row.resource === 'NOTE') {
          await db.runAsync(
            `UPDATE notes
             SET remote_id = ?, server_created_at = ?, server_updated_at = ?
             WHERE owner_scope = ? AND id = ?`,
            [
              input.resourceId,
              input.serverCreatedAt ?? null,
              input.serverUpdatedAt ?? null,
              ownerScope,
              row.local_id,
            ],
          );
        }

        if (row.resource === 'READING_SESSION') {
          await db.runAsync(
            `UPDATE qf_reading_locations
             SET remote_id = ?, server_updated_at = ?
             WHERE owner_scope = ? AND id = ?`,
            [
              input.resourceId,
              input.serverUpdatedAt ?? null,
              ownerScope,
              row.local_id,
            ],
          );
        }
      }

      const currentRevisionWasAcknowledged =
        row.revision === row.in_flight_revision &&
        row.mutation_type === row.in_flight_mutation_type &&
        row.payload_json === row.in_flight_payload_json;
      if (!currentRevisionWasAcknowledged) {
        const nextMutationType =
          row.resource === 'NOTE' &&
          row.in_flight_mutation_type === 'CREATE' &&
          row.mutation_type === 'CREATE'
            ? 'UPDATE'
            : row.mutation_type;
        await db.runAsync(
          `UPDATE qf_sync_outbox
           SET mutation_type = ?, remote_id = ?, base_server_updated_at = ?,
               delivery_state = 'PENDING', in_flight_revision = NULL,
               in_flight_mutation_type = NULL, in_flight_payload_json = NULL,
               in_flight_started_at = NULL
           WHERE owner_scope = ? AND local_operation_id = ?`,
          [
            nextMutationType,
            input.resourceId,
            input.serverUpdatedAt ?? null,
            ownerScope,
            input.localOperationId,
          ],
        );
        return;
      }

      await db.runAsync(
        `DELETE FROM qf_sync_outbox WHERE owner_scope = ? AND local_operation_id = ?`,
        [ownerScope, input.localOperationId],
      );
    });
  }

  async applyRemoteNote(input: ApplyRemoteNoteInput): Promise<void> {
    const db = await this.database.getConnection();
    const ownerScope = ownerScopeFromAccountId(input.accountId);

    await db.withTransactionAsync(async () => {
      const canonical = await this.getNoteRowByRemoteId(
        db,
        ownerScope,
        input.remoteId,
      );

      if (!canonical) {
        await db.runAsync(
          `INSERT INTO notes
             (id, owner_scope, verse_key, surah_number, ayah_number, content, verse_keys, created_at, updated_at, rewayah_id, remote_id, server_created_at, server_updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            generateId(),
            ownerScope,
            input.verseKey,
            input.surahNumber,
            input.ayahNumber,
            input.content,
            input.verseKeys?.join(',') ?? null,
            input.serverCreatedAt ?? input.serverUpdatedAt,
            input.serverUpdatedAt,
            DEFAULT_REWAYAH_ID,
            input.remoteId,
            input.serverCreatedAt ?? null,
            input.serverUpdatedAt,
          ],
        );
        return;
      }

      if (
        canonical.server_updated_at !== null &&
        input.serverUpdatedAt <= canonical.server_updated_at
      ) {
        return;
      }

      const pending = await this.getLatestNoteOutboxEntry(
        db,
        ownerScope,
        canonical.id,
      );
      const pendingPayload =
        pending?.resource === 'NOTE'
          ? (JSON.parse(pending.payloadJson) as NoteOutboxPayload)
          : null;
      const pendingBaseServerUpdatedAt =
        pending?.baseServerUpdatedAt ?? canonical.server_updated_at;

      if (
        pendingPayload &&
        pendingBaseServerUpdatedAt !== null &&
        input.serverUpdatedAt <= pendingBaseServerUpdatedAt
      ) {
        return;
      }

      await db.runAsync(
        `UPDATE notes
         SET verse_key = ?, surah_number = ?, ayah_number = ?, content = ?, verse_keys = ?, remote_id = ?, server_created_at = ?, server_updated_at = ?, updated_at = ?
         WHERE owner_scope = ? AND id = ?`,
        [
          input.verseKey,
          input.surahNumber,
          input.ayahNumber,
          input.content,
          input.verseKeys?.join(',') ?? null,
          input.remoteId,
          input.serverCreatedAt ?? canonical.server_created_at,
          input.serverUpdatedAt,
          input.serverUpdatedAt,
          ownerScope,
          canonical.id,
        ],
      );

      if (!pending || !pendingPayload) {
        return;
      }

      const conflictCopy = await this.annotations.addNoteForOwnerScope(
        ownerScope,
        pendingPayload.verseKey,
        pendingPayload.surahNumber,
        pendingPayload.ayahNumber,
        pendingPayload.content,
        pendingPayload.verseKeys,
        pendingPayload.rewayahId,
      );

      await this.clearNoteOutbox(db, ownerScope, canonical.id);
      await this.enqueueMutation(db, {
        accountId: input.accountId,
        ownerScope,
        resource: 'NOTE',
        mutationType: 'CREATE',
        localId: conflictCopy.id,
        remoteId: undefined,
        payload: {
          verseKey: conflictCopy.verseKey,
          surahNumber: conflictCopy.surahNumber,
          ayahNumber: conflictCopy.ayahNumber,
          content: conflictCopy.content,
          verseKeys: conflictCopy.verseKeys,
          rewayahId: conflictCopy.rewayahId,
          clientCreatedAt: conflictCopy.createdAt,
          clientUpdatedAt: conflictCopy.updatedAt,
        } satisfies NoteOutboxPayload,
        createdAt: conflictCopy.updatedAt,
      });

      await db.runAsync(
        `INSERT INTO qf_note_conflicts
           (id, owner_scope, note_id, local_content, remote_content, remote_id, base_server_updated_at, created_at, resolved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generateId(),
          ownerScope,
          canonical.id,
          pendingPayload.content,
          input.content,
          input.remoteId,
          pendingBaseServerUpdatedAt,
          Date.now(),
          null,
        ],
      );
    });
  }

  private async enqueueMutation(
    db: Awaited<ReturnType<VerseAnnotationDatabase['getConnection']>>,
    {
      accountId,
      ownerScope,
      resource,
      mutationType,
      localId,
      remoteId,
      payload,
      createdAt,
      baseServerUpdatedAt,
    }: {
      accountId: string;
      ownerScope: `qf:${string}`;
      resource: QfSyncResource;
      mutationType: QfMutationType;
      localId: string | null;
      remoteId?: string;
      payload: Record<string, unknown>;
      createdAt: number;
      baseServerUpdatedAt?: number;
    },
  ): Promise<void> {
    await db.runAsync(
      `INSERT INTO qf_sync_outbox (
         local_operation_id,
         owner_scope,
         account_id,
         resource,
         mutation_type,
         local_id,
         remote_id,
         payload_json,
         base_server_updated_at,
         attempts,
         next_attempt_at,
         created_at,
         revision,
         delivery_state
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1, 'PENDING')`,
      [
        generateId(),
        ownerScope,
        accountId,
        resource,
        mutationType,
        localId,
        remoteId ?? null,
        JSON.stringify(payload),
        baseServerUpdatedAt ?? null,
        null,
        createdAt,
      ],
    );
  }

  private async getBookmarkRow(
    db: Awaited<ReturnType<VerseAnnotationDatabase['getConnection']>>,
    ownerScope: AnnotationOwnerScope,
    verseKey: string,
  ): Promise<BookmarkRow | null> {
    return (await db.getFirstAsync(
      `SELECT * FROM bookmarks WHERE owner_scope = ? AND verse_key = ?`,
      [ownerScope, verseKey],
    )) as BookmarkRow | null;
  }

  private async getNoteRow(
    db: Awaited<ReturnType<VerseAnnotationDatabase['getConnection']>>,
    ownerScope: AnnotationOwnerScope,
    noteId: string,
  ): Promise<NoteRow | null> {
    return (await db.getFirstAsync(
      `SELECT * FROM notes WHERE owner_scope = ? AND id = ?`,
      [ownerScope, noteId],
    )) as NoteRow | null;
  }

  private async getNoteRowByRemoteId(
    db: Awaited<ReturnType<VerseAnnotationDatabase['getConnection']>>,
    ownerScope: AnnotationOwnerScope,
    remoteId: string,
  ): Promise<NoteRow | null> {
    return (await db.getFirstAsync(
      `SELECT * FROM notes WHERE owner_scope = ? AND remote_id = ?`,
      [ownerScope, remoteId],
    )) as NoteRow | null;
  }

  private async getLatestReadingLocationRow(
    db: Awaited<ReturnType<VerseAnnotationDatabase['getConnection']>>,
    ownerScope: AnnotationOwnerScope,
  ): Promise<ReadingLocationRow | null> {
    return (await db.getFirstAsync(
      `SELECT * FROM qf_reading_locations WHERE owner_scope = ? ORDER BY last_read_at DESC LIMIT 1`,
      [ownerScope],
    )) as ReadingLocationRow | null;
  }

  private async getReadingLocationRowById(
    db: Awaited<ReturnType<VerseAnnotationDatabase['getConnection']>>,
    ownerScope: AnnotationOwnerScope,
    id: string,
  ): Promise<ReadingLocationRow | null> {
    return (await db.getFirstAsync(
      `SELECT * FROM qf_reading_locations WHERE owner_scope = ? AND id = ?`,
      [ownerScope, id],
    )) as ReadingLocationRow | null;
  }

  private async getLatestNoteOutboxEntry(
    db: Awaited<ReturnType<VerseAnnotationDatabase['getConnection']>>,
    ownerScope: AnnotationOwnerScope,
    noteId: string,
  ): Promise<QfOutboxEntry | null> {
    const row = (await db.getFirstAsync(
      `SELECT * FROM qf_sync_outbox
       WHERE owner_scope = ? AND resource = 'NOTE' AND local_id = ?
       ORDER BY created_at DESC, local_operation_id DESC
       LIMIT 1`,
      [ownerScope, noteId],
    )) as OutboxRow | null;

    return row ? toOutboxEntry(row) : null;
  }

  private async clearBookmarkOutbox(
    db: Awaited<ReturnType<VerseAnnotationDatabase['getConnection']>>,
    ownerScope: AnnotationOwnerScope,
    verseKey: string,
  ): Promise<void> {
    const rows = (await db.getAllAsync(
      `SELECT local_operation_id, payload_json
       FROM qf_sync_outbox
       WHERE owner_scope = ? AND resource = 'BOOKMARK'`,
      [ownerScope],
    )) as Array<{local_operation_id: string; payload_json: string}>;

    for (const row of rows) {
      const payload = JSON.parse(row.payload_json) as BookmarkOutboxPayload;
      if (payload.verseKey !== verseKey) continue;
      await db.runAsync(
        `DELETE FROM qf_sync_outbox WHERE local_operation_id = ?`,
        [row.local_operation_id],
      );
    }
  }

  private async clearNoteOutbox(
    db: Awaited<ReturnType<VerseAnnotationDatabase['getConnection']>>,
    ownerScope: AnnotationOwnerScope,
    noteId: string,
  ): Promise<void> {
    await db.runAsync(
      `DELETE FROM qf_sync_outbox
       WHERE owner_scope = ? AND resource = 'NOTE' AND local_id = ?`,
      [ownerScope, noteId],
    );
  }

  private async clearReadingSessionOutbox(
    db: Awaited<ReturnType<VerseAnnotationDatabase['getConnection']>>,
    ownerScope: AnnotationOwnerScope,
  ): Promise<void> {
    await db.runAsync(
      `DELETE FROM qf_sync_outbox
       WHERE owner_scope = ? AND resource = 'READING_SESSION'`,
      [ownerScope],
    );
  }
}

export const qfSyncDatabaseService = new QfSyncDatabaseService();
