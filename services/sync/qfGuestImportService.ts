import {
  verseAnnotationDatabase,
  type VerseAnnotationDatabase,
} from '@/services/database/VerseAnnotationDatabase';

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
    }
  | {status: 'kept_separate'}
  | {status: 'already_decided'; decision: QfGuestImportDecision};

interface QfGuestImportServiceOptions {
  database?: VerseAnnotationDatabase;
  now?: () => number;
  generateId?: () => string;
}

type SyncDatabaseConnection = Awaited<
  ReturnType<VerseAnnotationDatabase['getConnection']>
>;

interface DecisionRow {
  guest_owner_scope: string;
}

interface CountRow {
  count: number;
}

interface GuestBookmarkRow {
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
    if (await this.getDecisionInTransaction(db, scope)) return null;
    const counts = await this.getGuestCounts(db);
    return counts.totalCount > 0 ? counts : null;
  }

  async keepSeparate(accountId: string): Promise<QfGuestImportResult> {
    const db = await this.database.getConnection();
    const scope = ownerScope(accountId);
    let result: QfGuestImportResult = {status: 'kept_separate'};
    await db.withTransactionAsync(async () => {
      const existing = await this.getDecisionInTransaction(db, scope);
      if (existing) {
        result = {status: 'already_decided', decision: existing};
        return;
      }
      await db.runAsync(
        `INSERT INTO qf_guest_imports
           (id, owner_scope, guest_owner_scope, imported_at, bookmark_count, note_count, highlight_count)
         VALUES (?, ?, 'guest:keep_separate', ?, 0, 0, 0)`,
        [decisionId(accountId), scope, this.now()],
      );
    });
    return result;
  }

  async merge(accountId: string): Promise<QfGuestImportResult> {
    const db = await this.database.getConnection();
    const scope = ownerScope(accountId);
    let result: QfGuestImportResult = {
      status: 'merged',
      bookmarkCount: 0,
      noteCount: 0,
      highlightCount: 0,
    };

    await db.withTransactionAsync(async () => {
      const existing = await this.getDecisionInTransaction(db, scope);
      if (existing) {
        result = {status: 'already_decided', decision: existing};
        return;
      }

      const bookmarkCount = await this.copyBookmarks(db, accountId, scope);
      const noteCount = await this.copyNotes(db, accountId, scope);
      const highlightCount = await this.copyHighlights(db, scope);
      await db.runAsync(
        `INSERT INTO qf_guest_imports
           (id, owner_scope, guest_owner_scope, imported_at, bookmark_count, note_count, highlight_count)
         VALUES (?, ?, 'guest:merge', ?, ?, ?, ?)`,
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
       WHERE owner_scope = ? ORDER BY imported_at, id LIMIT 1`,
      [scope],
    )) as DecisionRow | null;
    return decisionFromRow(row);
  }

  private async getGuestCounts(
    db: SyncDatabaseConnection,
  ): Promise<QfGuestImportOffer> {
    const [bookmarks, notes, highlights] = await Promise.all([
      db.getFirstAsync(
        `SELECT COUNT(*) AS count FROM bookmarks WHERE owner_scope = 'guest'`,
      ),
      db.getFirstAsync(
        `SELECT COUNT(*) AS count FROM notes WHERE owner_scope = 'guest'`,
      ),
      db.getFirstAsync(
        `SELECT COUNT(*) AS count FROM highlights WHERE owner_scope = 'guest'`,
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
      `SELECT verse_key, surah_number, ayah_number, created_at, rewayah_id
       FROM bookmarks WHERE owner_scope = 'guest' ORDER BY created_at, id`,
    )) as GuestBookmarkRow[];
    let copied = 0;
    for (const row of rows) {
      const duplicate = await db.getFirstAsync(
        `SELECT id FROM bookmarks WHERE owner_scope = ? AND verse_key = ?`,
        [scope, row.verse_key],
      );
      if (duplicate) continue;
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
      copied += 1;
    }
    return copied;
  }

  private async copyNotes(
    db: SyncDatabaseConnection,
    accountId: string,
    scope: `qf:${string}`,
  ): Promise<number> {
    const rows = (await db.getAllAsync(
      `SELECT verse_key, surah_number, ayah_number, content, verse_keys,
              created_at, updated_at, rewayah_id
       FROM notes WHERE owner_scope = 'guest' ORDER BY created_at, id`,
    )) as GuestNoteRow[];
    for (const row of rows) {
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
    }
    return rows.length;
  }

  private async copyHighlights(
    db: SyncDatabaseConnection,
    scope: `qf:${string}`,
  ): Promise<number> {
    const rows = (await db.getAllAsync(
      `SELECT verse_key, surah_number, ayah_number, color, created_at, rewayah_id
       FROM highlights WHERE owner_scope = 'guest' ORDER BY created_at, id`,
    )) as GuestHighlightRow[];
    let copied = 0;
    for (const row of rows) {
      const duplicate = await db.getFirstAsync(
        `SELECT id FROM highlights WHERE owner_scope = ? AND verse_key = ?`,
        [scope, row.verse_key],
      );
      if (duplicate) continue;
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
