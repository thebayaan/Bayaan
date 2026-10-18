import {recentTracksKey, uploadsKey} from '../snapshotKeys';
import type {UploadedRecitation} from '@/types/uploads';
import type {RecentlyPlayedTrack} from '@/services/player/store/recentlyPlayedStore';

function entry(
  reciterId: string,
  surahId: number,
  progress: number,
  isUserUpload?: boolean,
): RecentlyPlayedTrack {
  return {
    reciter: {
      id: reciterId,
      name: reciterId,
      date: null,
      image_url: null,
      rewayat: [],
    },
    surah: {
      id: surahId,
      name: 's',
      revelation_place: 'Makkah',
      revelation_order: 1,
      bismillah_pre: false,
      name_arabic: 's',
      verses_count: 1,
      pages: '1',
      translated_name_english: 's',
    },
    rewayatId: 'w',
    progress,
    duration: 100,
    timestamp: 1,
    isUserUpload,
  };
}

describe('recentTracksKey', () => {
  it('ignores progress ticks within the same tenth', () => {
    expect(recentTracksKey([entry('a', 1, 0.41)])).toBe(
      recentTracksKey([entry('a', 1, 0.49)]),
    );
  });
  it('changes when progress crosses a tenth, so bars stay current', () => {
    expect(recentTracksKey([entry('a', 1, 0.1)])).not.toBe(
      recentTracksKey([entry('a', 1, 0.9)]),
    );
    expect(recentTracksKey([entry('a', 1, 0.39)])).not.toBe(
      recentTracksKey([entry('a', 1, 0.4)]),
    );
  });
  it('treats out of range progress as its bound', () => {
    expect(recentTracksKey([entry('a', 1, Number.NaN)])).toBe(
      recentTracksKey([entry('a', 1, 0)]),
    );
    expect(recentTracksKey([entry('a', 1, 3)])).toBe(
      recentTracksKey([entry('a', 1, 1)]),
    );
  });
  it('changes with order, membership and upload flag', () => {
    const base = recentTracksKey([entry('a', 1, 0), entry('b', 2, 0)]);
    expect(recentTracksKey([entry('b', 2, 0), entry('a', 1, 0)])).not.toBe(
      base,
    );
    expect(recentTracksKey([entry('a', 1, 0)])).not.toBe(base);
    expect(
      recentTracksKey([entry('a', 1, 0, true), entry('b', 2, 0)]),
    ).not.toBe(base);
  });
});

describe('recentTracksKey with uploads', () => {
  it('tells apart uploads that share the placeholder reciter and surah', () => {
    const one = {...entry('__uploads__', 0, 0, true), userRecitationId: 'u1'};
    const two = {...entry('__uploads__', 0, 0, true), userRecitationId: 'u2'};
    expect(recentTracksKey([one, two])).not.toBe(recentTracksKey([two, one]));
  });
});

function upload(
  id: string,
  overrides: Partial<UploadedRecitation> = {},
): UploadedRecitation {
  return {
    id,
    filePath: `${id}.mp3`,
    originalFilename: `${id}.mp3`,
    duration: 60,
    dateAdded: 1,
    type: null,
    surahNumber: null,
    startVerse: null,
    endVerse: null,
    title: null,
    category: null,
    reciterId: null,
    customReciterId: null,
    isPersonal: false,
    rewayah: null,
    style: null,
    recordingType: null,
    ...overrides,
  };
}

describe('uploadsKey', () => {
  it('ignores fields the car does not show and copies of the same rows', () => {
    const base = uploadsKey([upload('a'), upload('b')], []);
    expect(
      uploadsKey(
        [upload('a', {duration: 99, dateAdded: 5}), {...upload('b')}],
        [],
      ),
    ).toBe(base);
  });
  it('changes with order, membership, shown tags and custom reciter names', () => {
    const base = uploadsKey(
      [upload('a', {customReciterId: 'c'}), upload('b')],
      [{id: 'c', name: 'Me', imageUri: null, createdAt: 1}],
    );
    const custom = [{id: 'c', name: 'Me', imageUri: null, createdAt: 1}];
    expect(
      uploadsKey([upload('b'), upload('a', {customReciterId: 'c'})], custom),
    ).not.toBe(base);
    expect(uploadsKey([upload('a', {customReciterId: 'c'})], custom)).not.toBe(
      base,
    );
    expect(
      uploadsKey(
        [
          upload('a', {customReciterId: 'c', type: 'surah', surahNumber: 18}),
          upload('b'),
        ],
        custom,
      ),
    ).not.toBe(base);
    expect(
      uploadsKey(
        [upload('a', {customReciterId: 'c'}), upload('b')],
        [{id: 'c', name: 'Renamed', imageUri: null, createdAt: 1}],
      ),
    ).not.toBe(base);
  });
});
