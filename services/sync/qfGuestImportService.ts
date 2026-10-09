import {
  verseAnnotationDatabase,
  type VerseAnnotationDatabase,
} from '@/services/database/VerseAnnotationDatabase';

import {type QfSyncSqliteExecutor} from './qfSyncTransaction';

import {withRetryableQfSyncTransaction as withQfSyncTransaction} from './qfSqliteRetry';
import {
  mapOutboxEntryToSyncMutation,
  LocalUnsupportedNoteError,
} from './qfSyncResourceMapper';

export type QfGuestImportDecision = 'merge' | 'keep_separate';

export interface QfGuestImportOffer {
  bookmarkCount: number;
  noteCount: number;
  highlightCount: number;
  totalCount: number;
}

type QfGuestImportResult =
  | {
      status: 'merged';
      bookmarkCount: number;
      noteCount: number;
      highlightCount: number;
      skippedNoteCounts?: Record<string, number>;
    }
  | {status: 'kept_separate'}
  | {status: 'already_decided'; decision: QfGuestImportDecision};

interface QfGuestImportServiceOptions {
  database?: VerseAnnotationDatabase;
  now?: () => number;
  generateId?: () => string;
}

type SyncDatabaseConnection = QfSyncSqliteExecutor;

interface DecisionRow {
  guest_owner_scope: string;
}

interface CountRow {
  count: number;
}

interface GuestBookmarkRow {
  id: string;
  verse_key: string;
  surah_number: number;
  ayah_number: number;
  created_at: number;
  rewayah_id: string | null;
}

interface GuestNoteRow extends GuestBookmarkRow {
  content: string;
  verse_keys: string | null;
  updated_at: number;
}

interface GuestHighlightRow extends GuestBookmarkRow {
  color: string;
}

function ownerScope(accountId: string): `qf:${string}` {
  if (!accountId) throw new Error('Account id is required');
  return `qf:${accountId}`;
}

function defaultGenerateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

function decisionId(accountId: string): string {
  return `guest-decision:${accountId}`;
}

function guestRowPrefix(accountId: string, resource: string): string {
  // Length-prefix the account so arbitrary opaque IDs cannot collide.
  return `guest-row:${accountId.length}:${accountId}:${resource}:`;
}

function decisionFromRow(
  row: DecisionRow | null,
): QfGuestImportDecision | null {
  if (!row) return null;
  return row.guest_owner_scope === 'guest:keep_separate'
    ? 'keep_separate'
    : 'merge';
}

export class QfGuestImportService {
  private readonly database: VerseAnnotationDatabase;
  private readonly now: () => number;
  private readonly generateId: () => string;

  constructor(options: QfGuestImportServiceOptions = {}) {
    this.database = options.database ?? verseAnnotationDatabase;
    this.now = options.now ?? Date.now;
    this.generateId = options.generateId ?? defaultGenerateId;
  }

  async getDecision(accountId: string): Promise<QfGuestImportDecision | null> {
    const db = await this.database.getConnection();
    return this.getDecisionInTransaction(db, ownerScope(accountId));
  }

  async getOffer(accountId: string): Promise<QfGuestImportOffer | null> {
    const db = await this.database.getConnection();
    const scope = ownerScope(accountId);
    const counts = await this.getGuestCounts(db, accountId, scope);
    return counts.totalCount > 0 ? counts : null;
  }

  async keepSeparate(accountId: string): Promise<QfGuestImportResult> {
    const connection = await this.database.getConnection();
    const scope = ownerScope(accountId);
    let result: QfGuestImportResult = {status: 'kept_separate'};
    await withQfSyncTransaction(connection, async db => {
      const existing = await this.getDecisionInTransaction(db, scope);
      const counts = await this.getGuestCounts(db, accountId, scope);
      if (existing && counts.totalCount === 0) {
        result = {status: 'already_decided', decision: existing};
        return;
      }
      await this.recordCoveredRows(db, accountId, scope);
      await db.runAsync(
        `INSERT INTO qf_guest_imports
           (id, owner_scope, guest_owner_scope, imported_at, bookmark_count, note_count, highlight_count)
         VALUES (?, ?, 'guest:keep_separate', ?, 0, 0, 0)
         ON CONFLICT(id) DO UPDATE SET
           guest_owner_scope = excluded.guest_owner_scope,
           imported_at = excluded.imported_at,
           bookmark_count = 0, note_count = 0, highlight_count = 0`,
        [decisionId(accountId), scope, this.now()],
      );
    });
    return result;
  }

  async merge(accountId: string): Promise<QfGuestImportResult> {
    const connection = await this.database.getConnection();
    const scope = ownerScope(accountId);
    let result: QfGuestImportResult = {
      status: 'merged',
      bookmarkCount: 0,
      noteCount: 0,
      highlightCount: 0,
    };

    await withQfSyncTransaction(connection, async db => {
      const existing = await this.getDecisionInTransaction(db, scope);
      const counts = await this.getGuestCounts(db, accountId, scope);
      if (existing && counts.totalCount === 0) {
        result = {status: 'already_decided', decision: existing};
        return;
      }

      const bookmarkCount = await this.copyBookmarks(db, accountId, scope);
      const {copied: noteCount, skipped} = await this.copyNotes(
        db,
        accountId,
        scope,
      );
      const highlightCount = await this.copyHighlights(db, accountId, scope);
      await db.runAsync(
        `INSERT INTO qf_guest_imports
           (id, owner_scope, guest_owner_scope, imported_at, bookmark_count, note_count, highlight_count)
         VALUES (?, ?, 'guest:merge', ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           guest_owner_scope = excluded.guest_owner_scope,
           imported_at = excluded.imported_at,
           bookmark_count = excluded.bookmark_count,
           note_count = excluded.note_count,
           highlight_count = excluded.highlight_count`,
        [
          decisionId(accountId),
          scope,
          this.now(),
          bookmarkCount,
          noteCount,
          highlightCount,
        ],
      );
      result = {
        status: 'merged',
        bookmarkCount,
        noteCount,
        highlightCount,
        ...(Object.keys(skipped).length ? {skippedNoteCounts: skipped} : {}),
      };
    });
    return result;
  }

  private async getDecisionInTransaction(
    db: SyncDatabaseConnection,
    scope: `qf:${string}`,
  ): Promise<QfGuestImportDecision | null> {
    const row = (await db.getFirstAsync(
      `SELECT guest_owner_scope FROM qf_guest_imports
       WHERE owner_scope = ? AND id = ?`,
      [scope, decisionId(scope.slice(3))],
    )) as DecisionRow | null;
    return decisionFromRow(row);
  }

  private async recordCoveredRows(
    db: SyncDatabaseConnection,
    accountId: string,
    scope: `qf:${string}`,
  ): Promise<void> {
    for (const [table, resource] of [
      ['bookmarks', 'BOOKMARK'],
      ['notes', 'NOTE'],
      ['highlights', 'HIGHLIGHT'],
    ]) {
      // Row-level consent uses the existing durable import ledger. Existing
      // legacy decisions have no membership evidence, so re-offer, not auto-copy.
      await db.runAsync(
        `INSERT OR IGNORE INTO qf_guest_imports
           (id, owner_scope, guest_owner_scope, imported_at)
         SELECT ? || id, ?, 'guest:keep_separate', ? FROM ${table}
         WHERE owner_scope = 'guest'`,
        [guestRowPrefix(accountId, resource), scope, this.now()],
      );
    }
  }

  private async getGuestCounts(
    db: SyncDatabaseConnection,
    accountId: string,
    scope: `qf:${string}`,
  ): Promise<QfGuestImportOffer> {
    const [bookmarks, notes, highlights] = await Promise.all([
      db.getFirstAsync(
        `SELECT COUNT(*) AS count FROM bookmarks AS guest
         WHERE owner_scope = 'guest' AND NOT EXISTS
           (SELECT 1 FROM qf_guest_imports WHERE owner_scope = ? AND id = ? || guest.id)`,
        [scope, guestRowPrefix(accountId, 'BOOKMARK')],
      ),
      db.getFirstAsync(
        `SELECT COUNT(*) AS count FROM notes AS guest
         WHERE owner_scope = 'guest' AND NOT EXISTS
           (SELECT 1 FROM qf_guest_imports WHERE owner_scope = ? AND id = ? || guest.id)`,
        [scope, guestRowPrefix(accountId, 'NOTE')],
      ),
      db.getFirstAsync(
        `SELECT COUNT(*) AS count FROM highlights AS guest
         WHERE owner_scope = 'guest' AND NOT EXISTS
           (SELECT 1 FROM qf_guest_imports WHERE owner_scope = ? AND id = ? || guest.id)`,
        [scope, guestRowPrefix(accountId, 'HIGHLIGHT')],
      ),
    ]);
    const bookmarkCount = (bookmarks as CountRow | null)?.count ?? 0;
    const noteCount = (notes as CountRow | null)?.count ?? 0;
    const highlightCount = (highlights as CountRow | null)?.count ?? 0;
    return {
      bookmarkCount,
      noteCount,
      highlightCount,
      totalCount: bookmarkCount + noteCount + highlightCount,
    };
  }

  private async copyBookmarks(
    db: SyncDatabaseConnection,
    accountId: string,
    scope: `qf:${string}`,
  ): Promise<number> {
    const rows = (await db.getAllAsync(
      `SELECT id, verse_key, surah_number, ayah_number, created_at, rewayah_id
       FROM bookmarks AS guest WHERE owner_scope = 'guest' AND NOT EXISTS
         (SELECT 1 FROM qf_guest_imports WHERE owner_scope = ? AND id = ? || guest.id)
       ORDER BY created_at, id`,
      [scope, guestRowPrefix(accountId, 'BOOKMARK')],
    )) as GuestBookmarkRow[];
    let copied = 0;
    for (const row of rows) {
      const duplicate = await db.getFirstAsync(
        `SELECT id FROM bookmarks WHERE owner_scope = ? AND verse_key = ?`,
        [scope, row.verse_key],
      );
      if (duplicate) {
        await db.runAsync(
          `DELETE FROM bookmarks WHERE owner_scope = 'guest' AND id = ?`,
          [row.id],
        );
        continue;
      }
      const id = this.generateId();
      await db.runAsync(
        `INSERT INTO bookmarks
           (id, owner_scope, verse_key, surah_number, ayah_number, created_at, rewayah_id, remote_id, server_created_at, server_updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`,
        [
          id,
          scope,
          row.verse_key,
          row.surah_number,
          row.ayah_number,
          row.created_at,
          row.rewayah_id ?? 'hafs',
        ],
      );
      await this.enqueue(db, {
        accountId,
        scope,
        resource: 'BOOKMARK',
        localId: id,
        payload: {
          verseKey: row.verse_key,
          surahNumber: row.surah_number,
          ayahNumber: row.ayah_number,
          rewayahId: row.rewayah_id ?? 'hafs',
          clientCreatedAt: row.created_at,
          clientUpdatedAt: row.created_at,
        },
        createdAt: row.created_at,
      });
      // Claim only the copied row, never a newer guest write that arrived while
      // this shared connection was awaiting I/O. Deletion rolls back with copy.
      await db.runAsync(
        `DELETE FROM bookmarks WHERE owner_scope = 'guest' AND id = ?`,
        [row.id],
      );
      copied += 1;
    }
    return copied;
  }

  private async copyNotes(
    db: SyncDatabaseConnection,
    accountId: string,
    scope: `qf:${string}`,
  ): Promise<{copied: number; skipped: Record<string, number>}> {
    const rows = (await db.getAllAsync(
      `SELECT id, verse_key, surah_number, ayah_number, content, verse_keys,
              created_at, updated_at, rewayah_id
       FROM notes AS guest WHERE owner_scope = 'guest' AND NOT EXISTS
         (SELECT 1 FROM qf_guest_imports WHERE owner_scope = ? AND id = ? || guest.id)
       ORDER BY created_at, id`,
      [scope, guestRowPrefix(accountId, 'NOTE')],
    )) as GuestNoteRow[];
    let copied = 0;
    const skipped: Record<string, number> = {};
    for (const row of rows) {
      const payload = {
        verseKey: row.verse_key,
        surahNumber: row.surah_number,
        ayahNumber: row.ayah_number,
        content: row.content,
        ...(row.verse_keys ? {verseKeys: row.verse_keys.split(',')} : {}),
        rewayahId: row.rewayah_id ?? 'hafs',
        clientCreatedAt: row.created_at,
        clientUpdatedAt: row.updated_at,
      };
      try {
        mapOutboxEntryToSyncMutation({
          resource: 'NOTE',
          mutationType: 'CREATE',
          remoteId: null,
          payloadJson: JSON.stringify(payload),
        });
      } catch (error) {
        if (!(error instanceof LocalUnsupportedNoteError)) throw error;
        skipped[error.reason] = (skipped[error.reason] ?? 0) + 1;
        continue; // Keep full guest source; no copy/claim ledger or deletion.
      }
      const id = this.generateId();
      await db.runAsync(
        `INSERT INTO notes
           (id, owner_scope, verse_key, surah_number, ayah_number, content, verse_keys, created_at, updated_at, rewayah_id, remote_id, server_created_at, server_updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`,
        [
          id,
          scope,
          row.verse_key,
          row.surah_number,
          row.ayah_number,
          row.content,
          row.verse_keys,
          row.created_at,
          row.updated_at,
          row.rewayah_id ?? 'hafs',
        ],
      );
      await this.enqueue(db, {
        accountId,
        scope,
        resource: 'NOTE',
        localId: id,
        payload: {
          verseKey: row.verse_key,
          surahNumber: row.surah_number,
          ayahNumber: row.ayah_number,
          content: row.content,
          ...(row.verse_keys ? {verseKeys: row.verse_keys.split(',')} : {}),
          rewayahId: row.rewayah_id ?? 'hafs',
          clientCreatedAt: row.created_at,
          clientUpdatedAt: row.updated_at,
        },
        createdAt: row.updated_at,
      });
      await db.runAsync(
        `DELETE FROM notes WHERE owner_scope = 'guest' AND id = ?`,
        [row.id],
      );
      copied += 1;
    }
    return {copied, skipped};
  }

  private async copyHighlights(
    db: SyncDatabaseConnection,
    accountId: string,
    scope: `qf:${string}`,
  ): Promise<number> {
    const rows = (await db.getAllAsync(
      `SELECT id, verse_key, surah_number, ayah_number, color, created_at, rewayah_id
       FROM highlights AS guest WHERE owner_scope = 'guest' AND NOT EXISTS
         (SELECT 1 FROM qf_guest_imports WHERE owner_scope = ? AND id = ? || guest.id)
       ORDER BY created_at, id`,
      [scope, guestRowPrefix(accountId, 'HIGHLIGHT')],
    )) as GuestHighlightRow[];
    let copied = 0;
    for (const row of rows) {
      const duplicate = await db.getFirstAsync(
        `SELECT id FROM highlights WHERE owner_scope = ? AND verse_key = ?`,
        [scope, row.verse_key],
      );
      if (duplicate) {
        await db.runAsync(
          `DELETE FROM highlights WHERE owner_scope = 'guest' AND id = ?`,
          [row.id],
        );
        continue;
      }
      await db.runAsync(
        `INSERT INTO highlights
           (id, owner_scope, verse_key, surah_number, ayah_number, color, created_at, rewayah_id, remote_id, server_created_at, server_updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`,
        [
          this.generateId(),
          scope,
          row.verse_key,
          row.surah_number,
          row.ayah_number,
          row.color,
          row.created_at,
          row.rewayah_id ?? 'hafs',
        ],
      );
      await db.runAsync(
        `DELETE FROM highlights WHERE owner_scope = 'guest' AND id = ?`,
        [row.id],
      );
      copied += 1;
    }
    return copied;
  }

  private async enqueue(
    db: SyncDatabaseConnection,
    input: {
      accountId: string;
      scope: `qf:${string}`;
      resource: 'BOOKMARK' | 'NOTE';
      localId: string;
      payload: Record<string, unknown>;
      createdAt: number;
    },
  ): Promise<void> {
    await db.runAsync(
      `INSERT INTO qf_sync_outbox (
         local_operation_id, owner_scope, account_id, resource, mutation_type,
         local_id, remote_id, payload_json, base_server_updated_at, attempts,
         next_attempt_at, created_at, revision, delivery_state
       ) VALUES (?, ?, ?, ?, 'CREATE', ?, NULL, ?, NULL, 0, NULL, ?, 1, 'PENDING')`,
      [
        this.generateId(),
        input.scope,
        input.accountId,
        input.resource,
        input.localId,
        JSON.stringify(input.payload),
        input.createdAt,
      ],
    );
  }
}

export const qfGuestImportService = new QfGuestImportService();
