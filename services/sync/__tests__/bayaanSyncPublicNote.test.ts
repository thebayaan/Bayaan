import {
  decodeBayaanSyncPullResponse,
  decodeBayaanSyncPushResponse,
  decodeBayaanSyncRequestMutation,
} from '@/services/sync/bayaanSyncCodec';

const publicNote = {
  resource: 'NOTE',
  type: 'CREATE',
  resourceId: 'public',
  timestamp: 200,
  data: {
    body: 'Public reflection',
    ranges: ['2:255-2:256'],
    saveToQR: true,
    source: 'provider',
    clientUpdatedAt: new Date(100).toISOString(),
  },
};
function response(mutations: unknown[]) {
  return {success: true, data: {lastMutationAt: 200, mutations}};
}

describe('validated public NOTE pull projection only', () => {
  it.each(['CREATE', 'UPDATE'])(
    'skips only the public %s effect and retains mixed resource effects and raw cardinality',
    type => {
      const privateNote = {
        ...publicNote,
        resourceId: 'private',
        data: {...publicNote.data, saveToQR: false},
      };
      const bookmark = {
        resource: 'BOOKMARK',
        type: 'CREATE',
        resourceId: 'bookmark',
        timestamp: 200,
        data: {type: 'ayah', key: 2, verseNumber: 255},
      };
      const reading = {
        resource: 'READING_SESSION',
        type: 'UPDATE',
        resourceId: 'reading',
        timestamp: 200,
        data: {chapterNumber: 3, verseNumber: 7},
      };
      const tombstone = {
        resource: 'NOTE',
        type: 'DELETE',
        resourceId: 'public',
        timestamp: 200,
      };
      expect(
        decodeBayaanSyncPullResponse(
          response([
            {...publicNote, type},
            privateNote,
            bookmark,
            reading,
            tombstone,
          ]),
        ),
      ).toEqual({
        lastMutationAt: 200,
        mutations: [privateNote, bookmark, reading, tombstone],
        receivedMutationCount: 5,
      });
    },
  );
  it('never projects public push receipts or authorizes outbound public notes', () => {
    expect(() => decodeBayaanSyncPushResponse(response([publicNote]))).toThrow(
      'Invalid Bayaan Sync response',
    );
    const {resourceId, timestamp, ...request} = publicNote;
    expect(() => decodeBayaanSyncRequestMutation(request)).toThrow(
      'Invalid Bayaan Sync response',
    );
    expect(resourceId).toBe('public');
    expect(timestamp).toBe(200);
  });
  it.each([
    {body: 'x'.repeat(200_001)},
    {body: 1},
    {ranges: []},
    {ranges: Array(101).fill('2:255-2:255')},
    {ranges: ['0:1-0:1']},
    {ranges: ['2:999-2:999']},
    {ranges: ['2:256-2:255']},
    {ranges: ['3:1-2:255']},
    {ranges: ['invalid']},
    {source: 4},
    {saveToQR: undefined},
    {saveToQR: null},
    {saveToQR: 'true'},
    {clientUpdatedAt: 'invalid'},
    {unknownField: true},
  ])(
    'malformed public/private data is rejected before skipping (%j)',
    extra => {
      for (const saveToQR of [true, false])
        expect(() =>
          decodeBayaanSyncPullResponse(
            response([
              {...publicNote, data: {...publicNote.data, saveToQR, ...extra}},
            ]),
          ),
        ).toThrow('Invalid Bayaan Sync response');
    },
  );
  it.each([
    {resourceId: ''},
    {resourceId: 'x'.repeat(257)},
    {timestamp: -1},
    {timestamp: '200'},
    {type: 'unknown'},
    {resource: 'unknown'},
    {unknown: true},
  ])(
    'valid-looking public bodies cannot mask malformed mutation metadata (%j)',
    extra => {
      expect(() =>
        decodeBayaanSyncPullResponse(response([{...publicNote, ...extra}])),
      ).toThrow('Invalid Bayaan Sync response');
    },
  );
  it('uses the UTF16 boundary identically for private and public body validation', () => {
    for (const saveToQR of [true, false]) {
      const valid = {
        ...publicNote,
        data: {...publicNote.data, saveToQR, body: '😀'.repeat(100_000)},
      };
      expect(
        decodeBayaanSyncPullResponse(response([valid])).mutations,
      ).toHaveLength(saveToQR ? 0 : 1);
      expect(() =>
        decodeBayaanSyncPullResponse(
          response([
            {...valid, data: {...valid.data, body: valid.data.body + 'x'}},
          ]),
        ),
      ).toThrow();
    }
  });
});
