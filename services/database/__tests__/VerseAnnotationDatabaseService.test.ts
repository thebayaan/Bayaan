const mockDb = {
  runAsync: jest.fn(),
  getAllAsync: jest.fn(),
  getFirstAsync: jest.fn(),
};

jest.mock('@/services/rewayah/RewayahIdentity', () => ({
  ALL_REWAYAH_IDS: ['hafs', 'warsh'],
  PERSISTED_ID_MIGRATIONS: {},
  migratePersistedId: (value: string) => value,
}));

import {verseAnnotationDatabase} from '@/services/database/VerseAnnotationDatabase';
import {verseAnnotationDatabaseService} from '@/services/database/VerseAnnotationDatabaseService';

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .spyOn(verseAnnotationDatabase, 'getConnection')
    .mockResolvedValue(mockDb as never);
  jest.spyOn(verseAnnotationDatabase, 'initialize').mockResolvedValue();
  jest.spyOn(verseAnnotationDatabase, 'close').mockResolvedValue();
  mockDb.runAsync.mockResolvedValue(undefined);
  mockDb.getAllAsync.mockResolvedValue([]);
  mockDb.getFirstAsync.mockResolvedValue(null);
});

describe('VerseAnnotationDatabaseService owner-scoped local APIs', () => {
  it('keeps guest bookmark helpers guest-scoped while allowing explicit bookmark scopes for account callers', async () => {
    const guestBookmark = await verseAnnotationDatabaseService.addBookmark(
      '2:255',
      2,
      255,
      'hafs',
    );
    const accountBookmark =
      await verseAnnotationDatabaseService.addBookmarkForOwnerScope(
        'qf:reader-1',
        '2:255',
        2,
        255,
        'hafs',
      );

    expect(guestBookmark.ownerScope).toBe('guest');
    expect(accountBookmark.ownerScope).toBe('qf:reader-1');
    expect(mockDb.runAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO bookmarks'),
      expect.arrayContaining(['guest', '2:255', 2, 255, 'hafs']),
    );
    expect(mockDb.runAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO bookmarks'),
      expect.arrayContaining(['qf:reader-1', '2:255', 2, 255, 'hafs']),
    );
  });

  it('reads and mutates notes within the explicit owner scope supplied by the caller', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([
      {
        id: 'note-1',
        owner_scope: 'qf:reader-1',
        verse_key: '18:10',
        surah_number: 18,
        ayah_number: 10,
        content: 'account note',
        verse_keys: '18:10,18:11',
        created_at: 2001,
        updated_at: 3001,
        rewayah_id: 'hafs',
        remote_id: null,
        server_created_at: null,
        server_updated_at: null,
      },
    ]);

    const note = await verseAnnotationDatabaseService.addNoteForOwnerScope(
      'qf:reader-1',
      '18:10',
      18,
      10,
      'account note',
      ['18:10', '18:11'],
      'hafs',
    );
    const notes =
      await verseAnnotationDatabaseService.getNotesForVerseInOwnerScope(
        'qf:reader-1',
        '18:10',
      );
    await verseAnnotationDatabaseService.updateNoteInOwnerScope(
      'qf:reader-1',
      'note-1',
      'updated account note',
    );

    expect(note.ownerScope).toBe('qf:reader-1');
    expect(mockDb.runAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO notes'),
      expect.arrayContaining([
        'qf:reader-1',
        '18:10',
        18,
        10,
        'account note',
        '18:10,18:11',
        'hafs',
      ]),
    );
    expect(notes).toEqual([
      expect.objectContaining({
        id: 'note-1',
        ownerScope: 'qf:reader-1',
        verseKey: '18:10',
        verseKeys: ['18:10', '18:11'],
      }),
    ]);
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM notes WHERE owner_scope = ?'),
      ['qf:reader-1', '18:10', '%,18:10,%'],
    );
    expect(mockDb.runAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        'UPDATE notes SET content = ?, updated_at = ? WHERE owner_scope = ? AND id = ?',
      ),
      ['updated account note', expect.any(Number), 'qf:reader-1', 'note-1'],
    );
  });

  it('upserts and removes highlights inside the explicit owner scope instead of defaulting account data to guest', async () => {
    const highlight =
      await verseAnnotationDatabaseService.upsertHighlightForOwnerScope(
        'qf:reader-1',
        '55:13',
        55,
        13,
        'purple',
        'hafs',
      );
    await verseAnnotationDatabaseService.removeHighlightInOwnerScope(
      'qf:reader-1',
      '55:13',
    );

    expect(highlight.ownerScope).toBe('qf:reader-1');
    expect(mockDb.runAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO highlights'),
      expect.arrayContaining([
        'qf:reader-1',
        '55:13',
        55,
        13,
        'purple',
        'hafs',
      ]),
    );
    expect(mockDb.runAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        'DELETE FROM highlights WHERE owner_scope = ? AND verse_key = ?',
      ),
      ['qf:reader-1', '55:13'],
    );
  });
});
