import {
  buildVerseRanges,
  mapOutboxEntryToSyncMutation,
  type QfOutboxEntryLike,
} from '@/services/sync/qfSyncResourceMapper';

function createOutboxEntry(
  overrides: Partial<QfOutboxEntryLike> & Pick<QfOutboxEntryLike, 'resource' | 'mutationType' | 'payloadJson'>,
): QfOutboxEntryLike {
  return {
    resource: overrides.resource,
    mutationType: overrides.mutationType,
    remoteId: overrides.remoteId ?? null,
    payloadJson: overrides.payloadJson,
  };
}

describe('qfSyncResourceMapper', () => {
  it('maps bookmark creates and deletes without leaking local-only fields', () => {
    const bookmarkCreate = createOutboxEntry({
      resource: 'BOOKMARK',
      mutationType: 'CREATE',
      payloadJson: JSON.stringify({
        verseKey: '2:255',
        surahNumber: 2,
        ayahNumber: 255,
        rewayahId: 'warsh',
        clientCreatedAt: 1713511200000,
        clientUpdatedAt: 1713511200000,
      }),
    });
    const bookmarkDelete = createOutboxEntry({
      resource: 'BOOKMARK',
      mutationType: 'DELETE',
      remoteId: 'remote-bookmark-1',
      payloadJson: JSON.stringify({
        verseKey: '2:255',
        surahNumber: 2,
        ayahNumber: 255,
        rewayahId: 'warsh',
        clientCreatedAt: 1713511200000,
        clientUpdatedAt: 1713514800000,
      }),
    });

    expect(mapOutboxEntryToSyncMutation(bookmarkCreate)).toEqual({
      resource: 'BOOKMARK',
      type: 'CREATE',
      data: {
        key: 2,
        type: 'ayah',
        mushaf: 4,
        verseNumber: 255,
        clientCreatedAt: '2024-04-19T07:20:00.000Z',
        clientUpdatedAt: '2024-04-19T07:20:00.000Z',
      },
    });
    expect(mapOutboxEntryToSyncMutation(bookmarkDelete)).toEqual({
      resource: 'BOOKMARK',
      type: 'DELETE',
      resourceId: 'remote-bookmark-1',
      data: {},
    });
  });

  it('rejects bookmark updates because QF only accepts bookmark create or delete intent', () => {
    const bookmarkUpdate = createOutboxEntry({
      resource: 'BOOKMARK',
      mutationType: 'UPDATE',
      remoteId: 'remote-bookmark-1',
      payloadJson: JSON.stringify({
        verseKey: '2:255',
        surahNumber: 2,
        ayahNumber: 255,
        clientCreatedAt: 1713511200000,
        clientUpdatedAt: 1713514800000,
      }),
    });

    expect(() => mapOutboxEntryToSyncMutation(bookmarkUpdate)).toThrow(
      'BOOKMARK UPDATE is not supported',
    );
  });

  it('converts note verse keys into deterministic inclusive ranges and pins saveToQR false', () => {
    expect(buildVerseRanges(['2:255'])).toEqual(['2:255-2:255']);
    expect(buildVerseRanges(['2:255', '2:256', '2:257'])).toEqual([
      '2:255-2:257',
    ]);
    expect(buildVerseRanges(['2:255', '2:257'])).toEqual([
      '2:255-2:255',
      '2:257-2:257',
    ]);
    expect(buildVerseRanges(['2:286', '3:1', '3:2'])).toEqual([
      '2:286-3:2',
    ]);
    expect(buildVerseRanges(['3:2', '2:255', '2:255', '3:1'])).toEqual([
      '2:255-2:255',
      '3:1-3:2',
    ]);
    expect(() => buildVerseRanges(['2:255', 'invalid'])).toThrow(
      'Invalid verse key: invalid',
    );
    expect(() => buildVerseRanges(['0:1'])).toThrow(
      'Invalid verse key: 0:1',
    );
    expect(() => buildVerseRanges(['2:0'])).toThrow(
      'Invalid verse key: 2:0',
    );
    expect(() => buildVerseRanges(['2:287'])).toThrow(
      'Invalid verse key: 2:287',
    );
    expect(() => buildVerseRanges(['115:1'])).toThrow(
      'Invalid verse key: 115:1',
    );

    const noteCreate = createOutboxEntry({
      resource: 'NOTE',
      mutationType: 'CREATE',
      payloadJson: JSON.stringify({
        verseKey: '2:255',
        surahNumber: 2,
        ayahNumber: 255,
        content: 'Reflect on Ayat al-Kursi',
        verseKeys: ['2:255', '2:256', '2:257'],
        rewayahId: 'warsh',
        clientCreatedAt: 1713511200000,
        clientUpdatedAt: 1713514800000,
      }),
    });

    expect(mapOutboxEntryToSyncMutation(noteCreate)).toEqual({
      resource: 'NOTE',
      type: 'CREATE',
      data: {
        body: 'Reflect on Ayat al-Kursi',
        ranges: ['2:255-2:257'],
        saveToQR: false,
        clientCreatedAt: '2024-04-19T07:20:00.000Z',
        clientUpdatedAt: '2024-04-19T08:20:00.000Z',
      },
    });
  });

  it('maps note updates and deletes through remote ids without attached Quran Reflect entities', () => {
    const noteUpdate = createOutboxEntry({
      resource: 'NOTE',
      mutationType: 'UPDATE',
      remoteId: 'remote-note-1',
      payloadJson: JSON.stringify({
        verseKey: '18:10',
        surahNumber: 18,
        ayahNumber: 10,
        content: 'Updated cave note',
        verseKeys: ['18:10'],
        clientCreatedAt: 1713511200000,
        clientUpdatedAt: 1713514800000,
      }),
    });
    const noteDelete = createOutboxEntry({
      resource: 'NOTE',
      mutationType: 'DELETE',
      remoteId: 'remote-note-1',
      payloadJson: JSON.stringify({
        verseKey: '18:10',
        surahNumber: 18,
        ayahNumber: 10,
        content: 'Updated cave note',
        verseKeys: ['18:10'],
        clientCreatedAt: 1713511200000,
        clientUpdatedAt: 1713514800000,
      }),
    });

    expect(mapOutboxEntryToSyncMutation(noteUpdate)).toEqual({
      resource: 'NOTE',
      type: 'UPDATE',
      resourceId: 'remote-note-1',
      data: {
        body: 'Updated cave note',
        ranges: ['18:10-18:10'],
        saveToQR: false,
        clientCreatedAt: '2024-04-19T07:20:00.000Z',
        clientUpdatedAt: '2024-04-19T08:20:00.000Z',
      },
    });
    expect(mapOutboxEntryToSyncMutation(noteDelete)).toEqual({
      resource: 'NOTE',
      type: 'DELETE',
      resourceId: 'remote-note-1',
      data: {},
    });
  });

  it('maps reading sessions to resume locations only and drops page and rewayah from the upstream payload', () => {
    const readingCreate = createOutboxEntry({
      resource: 'READING_SESSION',
      mutationType: 'CREATE',
      payloadJson: JSON.stringify({
        verseKey: '3:7',
        surahNumber: 3,
        ayahNumber: 7,
        pageNumber: 88,
        rewayahId: 'hafs',
        clientCreatedAt: 1713511200000,
        clientUpdatedAt: 1713514800000,
      }),
    });
    const readingUpdate = createOutboxEntry({
      resource: 'READING_SESSION',
      mutationType: 'UPDATE',
      remoteId: 'remote-reading-1',
      payloadJson: JSON.stringify({
        verseKey: '3:8',
        surahNumber: 3,
        ayahNumber: 8,
        pageNumber: 89,
        rewayahId: 'warsh',
        clientCreatedAt: 1713511200000,
        clientUpdatedAt: 1713514800000,
      }),
    });

    expect(mapOutboxEntryToSyncMutation(readingCreate)).toEqual({
      resource: 'READING_SESSION',
      type: 'CREATE',
      data: {
        chapterNumber: 3,
        verseNumber: 7,
        clientCreatedAt: '2024-04-19T07:20:00.000Z',
        clientUpdatedAt: '2024-04-19T08:20:00.000Z',
      },
    });
    expect(mapOutboxEntryToSyncMutation(readingUpdate)).toEqual({
      resource: 'READING_SESSION',
      type: 'UPDATE',
      resourceId: 'remote-reading-1',
      data: {
        chapterNumber: 3,
        verseNumber: 8,
        clientUpdatedAt: '2024-04-19T08:20:00.000Z',
      },
    });
  });
});
