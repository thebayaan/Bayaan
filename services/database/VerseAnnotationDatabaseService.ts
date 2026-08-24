import type {
  VerseBookmark,
  VerseNote,
  VerseHighlight,
  HighlightColor,
  AnnotationOwnerScope,
} from '@/types/verse-annotations';
import {
  ALL_REWAYAH_IDS,
  migratePersistedId,
  type RewayahId,
} from '@/services/rewayah/RewayahIdentity';
import {verseAnnotationDatabase} from '@/services/database/VerseAnnotationDatabase';
import {GUEST_OWNER_SCOPE} from '@/services/database/migrations/userSyncV1';

// Database row types (snake_case)
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

interface HighlightRow {
  id: string;
  owner_scope: AnnotationOwnerScope;
  verse_key: string;
  surah_number: number;
  ayah_number: number;
  color: string;
  created_at: number;
  rewayah_id: string | null;
  remote_id: string | null;
  server_created_at: number | null;
  server_updated_at: number | null;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function parseRewayahId(value: string | null): RewayahId | undefined {
  if (!value) return undefined;
  // Trust DB values were written by our own code; still narrow through the
  // known-set to be safe if a hand-edited DB surfaces something unexpected.
  const known = new Set<RewayahId>(ALL_REWAYAH_IDS);
  return known.has(value as RewayahId) ? (value as RewayahId) : undefined;
}

function resolveRewayahId(value: string | undefined): RewayahId {
  return migratePersistedId(value ?? 'hafs');
}

function mapBookmarkRow(row: BookmarkRow): VerseBookmark {
  return {
    id: row.id,
    ownerScope: row.owner_scope,
    verseKey: row.verse_key,
    surahNumber: row.surah_number,
    ayahNumber: row.ayah_number,
    createdAt: row.created_at,
    rewayahId: parseRewayahId(row.rewayah_id),
    remoteId: row.remote_id ?? undefined,
    serverCreatedAt: row.server_created_at ?? undefined,
    serverUpdatedAt: row.server_updated_at ?? undefined,
  };
}

function mapNoteRow(row: NoteRow): VerseNote {
  return {
    id: row.id,
    ownerScope: row.owner_scope,
    verseKey: row.verse_key,
    surahNumber: row.surah_number,
    ayahNumber: row.ayah_number,
    content: row.content,
    verseKeys: row.verse_keys ? row.verse_keys.split(',') : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    rewayahId: parseRewayahId(row.rewayah_id),
    remoteId: row.remote_id ?? undefined,
    serverCreatedAt: row.server_created_at ?? undefined,
    serverUpdatedAt: row.server_updated_at ?? undefined,
  };
}

function mapHighlightRow(row: HighlightRow): VerseHighlight {
  return {
    id: row.id,
    ownerScope: row.owner_scope,
    verseKey: row.verse_key,
    surahNumber: row.surah_number,
    ayahNumber: row.ayah_number,
    color: row.color as HighlightColor,
    createdAt: row.created_at,
    rewayahId: parseRewayahId(row.rewayah_id),
    remoteId: row.remote_id ?? undefined,
    serverCreatedAt: row.server_created_at ?? undefined,
    serverUpdatedAt: row.server_updated_at ?? undefined,
  };
}

function requireOwnerScope(
  ownerScope: AnnotationOwnerScope,
): AnnotationOwnerScope {
  if (!ownerScope) {
    throw new Error('ownerScope is required');
  }

  return ownerScope;
}

export class VerseAnnotationDatabaseService {
  constructor(
    private readonly database = verseAnnotationDatabase,
  ) {}

  async initialize(): Promise<void> {
    await this.database.initialize();
  }

  private async ensureReady() {
    return this.database.getConnection();
  }

  // Bookmark operations
  async addBookmark(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    rewayahId?: string,
  ): Promise<VerseBookmark> {
    return this.addBookmarkForOwnerScope(
      GUEST_OWNER_SCOPE,
      verseKey,
      surahNumber,
      ayahNumber,
      rewayahId,
    );
  }

  async addBookmarkForOwnerScope(
    ownerScope: AnnotationOwnerScope,
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    rewayahId?: string,
  ): Promise<VerseBookmark> {
    const db = await this.ensureReady();
    const resolvedOwnerScope = requireOwnerScope(ownerScope);
    const resolvedRewayahId = resolveRewayahId(rewayahId);

    const bookmark: VerseBookmark = {
      id: generateId(),
      ownerScope: resolvedOwnerScope,
      verseKey,
      surahNumber,
      ayahNumber,
      createdAt: Date.now(),
      rewayahId: resolvedRewayahId,
    };

    await db.runAsync(
      `INSERT INTO bookmarks (id, owner_scope, verse_key, surah_number, ayah_number, created_at, rewayah_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        bookmark.id,
        resolvedOwnerScope,
        bookmark.verseKey,
        bookmark.surahNumber,
        bookmark.ayahNumber,
        bookmark.createdAt,
        resolvedRewayahId,
      ],
    );

    return bookmark;
  }

  async removeBookmark(verseKey: string): Promise<void> {
    await this.removeBookmarkInOwnerScope(GUEST_OWNER_SCOPE, verseKey);
  }

  async removeBookmarkInOwnerScope(
    ownerScope: AnnotationOwnerScope,
    verseKey: string,
  ): Promise<void> {
    const db = await this.ensureReady();
    await db.runAsync(
      `DELETE FROM bookmarks WHERE owner_scope = ? AND verse_key = ?`,
      [requireOwnerScope(ownerScope), verseKey],
    );
  }

  async getBookmarksBySurah(surahNumber: number): Promise<VerseBookmark[]> {
    return this.getBookmarksBySurahInOwnerScope(GUEST_OWNER_SCOPE, surahNumber);
  }

  async getBookmarksBySurahInOwnerScope(
    ownerScope: AnnotationOwnerScope,
    surahNumber: number,
  ): Promise<VerseBookmark[]> {
    const db = await this.ensureReady();
    const rows = (await db.getAllAsync(
      `SELECT * FROM bookmarks WHERE owner_scope = ? AND surah_number = ? ORDER BY ayah_number`,
      [requireOwnerScope(ownerScope), surahNumber],
    )) as BookmarkRow[];
    return rows.map(mapBookmarkRow);
  }

  async getAllBookmarks(): Promise<VerseBookmark[]> {
    return this.getAllBookmarksInOwnerScope(GUEST_OWNER_SCOPE);
  }

  async getAllBookmarksInOwnerScope(
    ownerScope: AnnotationOwnerScope,
  ): Promise<VerseBookmark[]> {
    const db = await this.ensureReady();
    const rows = (await db.getAllAsync(
      `SELECT * FROM bookmarks WHERE owner_scope = ? ORDER BY created_at DESC`,
      [requireOwnerScope(ownerScope)],
    )) as BookmarkRow[];
    return rows.map(mapBookmarkRow);
  }

  async isBookmarked(verseKey: string): Promise<boolean> {
    return this.isBookmarkedInOwnerScope(GUEST_OWNER_SCOPE, verseKey);
  }

  async isBookmarkedInOwnerScope(
    ownerScope: AnnotationOwnerScope,
    verseKey: string,
  ): Promise<boolean> {
    const db = await this.ensureReady();
    const row = await db.getFirstAsync(
      `SELECT id FROM bookmarks WHERE owner_scope = ? AND verse_key = ?`,
      [requireOwnerScope(ownerScope), verseKey],
    );
    return row !== null;
  }

  // Note operations
  async addNote(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    content: string,
    verseKeys?: string[],
    rewayahId?: string,
  ): Promise<VerseNote> {
    return this.addNoteForOwnerScope(
      GUEST_OWNER_SCOPE,
      verseKey,
      surahNumber,
      ayahNumber,
      content,
      verseKeys,
      rewayahId,
    );
  }

  async addNoteForOwnerScope(
    ownerScope: AnnotationOwnerScope,
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    content: string,
    verseKeys?: string[],
    rewayahId?: string,
  ): Promise<VerseNote> {
    const db = await this.ensureReady();
    const resolvedOwnerScope = requireOwnerScope(ownerScope);

    const now = Date.now();
    const id = generateId();
    const verseKeysStr = verseKeys?.length ? verseKeys.join(',') : null;

    await db.runAsync(
      `INSERT INTO notes (id, owner_scope, verse_key, surah_number, ayah_number, content, verse_keys, created_at, updated_at, rewayah_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        resolvedOwnerScope,
        verseKey,
        surahNumber,
        ayahNumber,
        content,
        verseKeysStr,
        now,
        now,
        resolveRewayahId(rewayahId),
      ],
    );

    return {
      id,
      ownerScope: resolvedOwnerScope,
      verseKey,
      surahNumber,
      ayahNumber,
      content,
      verseKeys: verseKeys?.length ? verseKeys : undefined,
      createdAt: now,
      updatedAt: now,
      rewayahId: resolveRewayahId(rewayahId),
    };
  }

  async updateNote(noteId: string, content: string): Promise<void> {
    await this.updateNoteInOwnerScope(GUEST_OWNER_SCOPE, noteId, content);
  }

  async updateNoteInOwnerScope(
    ownerScope: AnnotationOwnerScope,
    noteId: string,
    content: string,
  ): Promise<void> {
    const db = await this.ensureReady();
    await db.runAsync(
      `UPDATE notes SET content = ?, updated_at = ? WHERE owner_scope = ? AND id = ?`,
      [content, Date.now(), requireOwnerScope(ownerScope), noteId],
    );
  }

  async getNoteById(noteId: string): Promise<VerseNote | null> {
    return this.getNoteByIdInOwnerScope(GUEST_OWNER_SCOPE, noteId);
  }

  async getNoteByIdInOwnerScope(
    ownerScope: AnnotationOwnerScope,
    noteId: string,
  ): Promise<VerseNote | null> {
    const db = await this.ensureReady();
    const row = (await db.getFirstAsync(
      `SELECT * FROM notes WHERE owner_scope = ? AND id = ?`,
      [requireOwnerScope(ownerScope), noteId],
    )) as NoteRow | null;
    return row ? mapNoteRow(row) : null;
  }

  async getNotesForVerse(verseKey: string): Promise<VerseNote[]> {
    return this.getNotesForVerseInOwnerScope(GUEST_OWNER_SCOPE, verseKey);
  }

  async getNotesForVerseInOwnerScope(
    ownerScope: AnnotationOwnerScope,
    verseKey: string,
  ): Promise<VerseNote[]> {
    const db = await this.ensureReady();
    const rows = (await db.getAllAsync(
      `SELECT * FROM notes WHERE owner_scope = ? AND (verse_key = ? OR (',' || verse_keys || ',') LIKE ?) ORDER BY created_at DESC`,
      [requireOwnerScope(ownerScope), verseKey, `%,${verseKey},%`],
    )) as NoteRow[];
    return rows.map(mapNoteRow);
  }

  async deleteNoteById(noteId: string): Promise<void> {
    await this.deleteNoteByIdInOwnerScope(GUEST_OWNER_SCOPE, noteId);
  }

  async deleteNoteByIdInOwnerScope(
    ownerScope: AnnotationOwnerScope,
    noteId: string,
  ): Promise<void> {
    const db = await this.ensureReady();
    await db.runAsync(`DELETE FROM notes WHERE owner_scope = ? AND id = ?`, [
      requireOwnerScope(ownerScope),
      noteId,
    ]);
  }

  async getNotesCountForVerse(verseKey: string): Promise<number> {
    return this.getNotesCountForVerseInOwnerScope(GUEST_OWNER_SCOPE, verseKey);
  }

  async getNotesCountForVerseInOwnerScope(
    ownerScope: AnnotationOwnerScope,
    verseKey: string,
  ): Promise<number> {
    const db = await this.ensureReady();
    const row = (await db.getFirstAsync(
      `SELECT COUNT(*) as count FROM notes WHERE owner_scope = ? AND (verse_key = ? OR (',' || verse_keys || ',') LIKE ?)`,
      [requireOwnerScope(ownerScope), verseKey, `%,${verseKey},%`],
    )) as {count: number} | null;
    return row?.count ?? 0;
  }

  async getAllNotes(): Promise<VerseNote[]> {
    return this.getAllNotesInOwnerScope(GUEST_OWNER_SCOPE);
  }

  async getAllNotesInOwnerScope(
    ownerScope: AnnotationOwnerScope,
  ): Promise<VerseNote[]> {
    const db = await this.ensureReady();
    const rows = (await db.getAllAsync(
      `SELECT * FROM notes WHERE owner_scope = ? ORDER BY updated_at DESC`,
      [requireOwnerScope(ownerScope)],
    )) as NoteRow[];
    return rows.map(mapNoteRow);
  }

  async getNotesBySurah(surahNumber: number): Promise<VerseNote[]> {
    return this.getNotesBySurahInOwnerScope(GUEST_OWNER_SCOPE, surahNumber);
  }

  async getNotesBySurahInOwnerScope(
    ownerScope: AnnotationOwnerScope,
    surahNumber: number,
  ): Promise<VerseNote[]> {
    const db = await this.ensureReady();
    const rows = (await db.getAllAsync(
      `SELECT * FROM notes WHERE owner_scope = ? AND surah_number = ? ORDER BY ayah_number`,
      [requireOwnerScope(ownerScope), surahNumber],
    )) as NoteRow[];
    return rows.map(mapNoteRow);
  }

  // Highlight operations
  async upsertHighlight(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    color: HighlightColor,
    rewayahId?: string,
  ): Promise<VerseHighlight> {
    return this.upsertHighlightForOwnerScope(
      GUEST_OWNER_SCOPE,
      verseKey,
      surahNumber,
      ayahNumber,
      color,
      rewayahId,
    );
  }

  async upsertHighlightForOwnerScope(
    ownerScope: AnnotationOwnerScope,
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    color: HighlightColor,
    rewayahId?: string,
  ): Promise<VerseHighlight> {
    const db = await this.ensureReady();
    const resolvedOwnerScope = requireOwnerScope(ownerScope);

    const now = Date.now();
    const id = generateId();

    await db.runAsync(
      `INSERT INTO highlights (id, owner_scope, verse_key, surah_number, ayah_number, color, created_at, rewayah_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(owner_scope, verse_key) DO UPDATE SET color = excluded.color, rewayah_id = excluded.rewayah_id`,
      [
        id,
        resolvedOwnerScope,
        verseKey,
        surahNumber,
        ayahNumber,
        color,
        now,
        resolveRewayahId(rewayahId),
      ],
    );

    return {
      id,
      ownerScope: resolvedOwnerScope,
      verseKey,
      surahNumber,
      ayahNumber,
      color,
      createdAt: now,
      rewayahId: resolveRewayahId(rewayahId),
    };
  }

  async removeHighlight(verseKey: string): Promise<void> {
    await this.removeHighlightInOwnerScope(GUEST_OWNER_SCOPE, verseKey);
  }

  async removeHighlightInOwnerScope(
    ownerScope: AnnotationOwnerScope,
    verseKey: string,
  ): Promise<void> {
    const db = await this.ensureReady();
    await db.runAsync(
      `DELETE FROM highlights WHERE owner_scope = ? AND verse_key = ?`,
      [requireOwnerScope(ownerScope), verseKey],
    );
  }

  async getHighlightsBySurah(surahNumber: number): Promise<VerseHighlight[]> {
    return this.getHighlightsBySurahInOwnerScope(GUEST_OWNER_SCOPE, surahNumber);
  }

  async getHighlightsBySurahInOwnerScope(
    ownerScope: AnnotationOwnerScope,
    surahNumber: number,
  ): Promise<VerseHighlight[]> {
    const db = await this.ensureReady();
    const rows = (await db.getAllAsync(
      `SELECT * FROM highlights WHERE owner_scope = ? AND surah_number = ? ORDER BY ayah_number`,
      [requireOwnerScope(ownerScope), surahNumber],
    )) as HighlightRow[];
    return rows.map(mapHighlightRow);
  }

  // Batch fetch for a surah
  async getAnnotationsForSurah(surahNumber: number): Promise<{
    bookmarks: VerseBookmark[];
    notes: VerseNote[];
    highlights: VerseHighlight[];
  }> {
    return this.getAnnotationsForSurahInOwnerScope(
      GUEST_OWNER_SCOPE,
      surahNumber,
    );
  }

  async getAnnotationsForSurahInOwnerScope(
    ownerScope: AnnotationOwnerScope,
    surahNumber: number,
  ): Promise<{
    bookmarks: VerseBookmark[];
    notes: VerseNote[];
    highlights: VerseHighlight[];
  }> {
    const [bookmarks, notes, highlights] = await Promise.all([
      this.getBookmarksBySurahInOwnerScope(ownerScope, surahNumber),
      this.getNotesBySurahInOwnerScope(ownerScope, surahNumber),
      this.getHighlightsBySurahInOwnerScope(ownerScope, surahNumber),
    ]);
    return {bookmarks, notes, highlights};
  }

  async close(): Promise<void> {
    await this.database.close();
  }
}

export const verseAnnotationDatabaseService =
  new VerseAnnotationDatabaseService();
